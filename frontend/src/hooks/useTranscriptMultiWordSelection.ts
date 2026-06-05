import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, RefObject, TouchEvent as ReactTouchEvent } from 'react';

const LONG_PRESS_MS = 420;
const MOVE_CANCEL_PX = 10;
const EDGE_SCROLL_PX = 44;
const EDGE_SCROLL_STEP = 14;
const WORD_SELECTOR = '[data-seg-index][data-word-index]';

type WordTokenKey = `${number}:${number}`;
type InteractionMode = 'touch' | 'mouse';

interface SelectionToolbarState {
  phrase: string;
  sentence: string;
}

interface WordTokenMeta {
  key: WordTokenKey;
  word: string;
  sentence: string;
}

interface ActiveInteraction {
  mode: InteractionMode;
  touchId?: number;
  anchorKey: WordTokenKey;
  focusKey: WordTokenKey;
  startX: number;
  startY: number;
  startWord: string;
  startSentence: string;
  movedBeforeSelection: boolean;
  selecting: boolean;
}

interface UseTranscriptMultiWordSelectionOptions {
  containerRef: RefObject<HTMLElement>;
  lookupWord: (word: string, sentence?: string) => void | Promise<void>;
}

function makeKey(segIndex: number, wordIndex: number): WordTokenKey {
  return `${segIndex}:${wordIndex}`;
}

function cleanLookupWord(word: string): string {
  return word.replace(/[^\w'-]/g, '').trim();
}

function cleanPhraseWord(word: string): string {
  return word.replace(/[.,!?;:]+$/g, '').trim();
}

function readTokenMeta(el: HTMLElement): WordTokenMeta | null {
  const segIndex = Number.parseInt(el.dataset.segIndex ?? '', 10);
  const wordIndex = Number.parseInt(el.dataset.wordIndex ?? '', 10);

  if (!Number.isFinite(segIndex) || !Number.isFinite(wordIndex)) return null;

  return {
    key: makeKey(segIndex, wordIndex),
    word: el.dataset.word ?? '',
    sentence: el.dataset.segText ?? '',
  };
}

function findTokenAt(container: HTMLElement, x: number, y: number): HTMLElement | null {
  const offsets = [
    [0, 0],
    [-10, 0], [10, 0], [-22, 0], [22, 0], [-36, 0], [36, 0],
    [0, -8], [0, 8], [-16, -8], [16, -8], [-16, 8], [16, 8],
  ];

  for (const [dx, dy] of offsets) {
    const el = document.elementFromPoint(x + dx, y + dy) as HTMLElement | null;
    let current: HTMLElement | null = el;

    while (current && current !== container) {
      if (current.matches?.(WORD_SELECTOR)) return current;
      current = current.parentElement;
    }
  }

  return null;
}

function buildSelectionFromDom(
  container: HTMLElement,
  anchorKey: WordTokenKey,
  focusKey: WordTokenKey,
) {
  const tokens = Array.from(container.querySelectorAll<HTMLElement>(WORD_SELECTOR));
  const anchorIndex = tokens.findIndex(token => readTokenMeta(token)?.key === anchorKey);
  const focusIndex = tokens.findIndex(token => readTokenMeta(token)?.key === focusKey);

  if (anchorIndex < 0 || focusIndex < 0) {
    return { selectedKeys: new Set<WordTokenKey>(), phrase: '', sentence: '' };
  }

  const lo = Math.min(anchorIndex, focusIndex);
  const hi = Math.max(anchorIndex, focusIndex);
  const selectedKeys = new Set<WordTokenKey>();
  const phraseWords: string[] = [];
  const sentenceParts: string[] = [];
  const seenSentences = new Set<string>();

  tokens.slice(lo, hi + 1).forEach(token => {
    const meta = readTokenMeta(token);
    if (!meta) return;

    selectedKeys.add(meta.key);

    const phraseWord = cleanPhraseWord(meta.word);
    if (phraseWord) phraseWords.push(phraseWord);

    const sentence = meta.sentence.trim();
    if (sentence && !seenSentences.has(sentence)) {
      seenSentences.add(sentence);
      sentenceParts.push(sentence);
    }
  });

  return {
    selectedKeys,
    phrase: phraseWords.join(' ').trim(),
    sentence: sentenceParts.join(' ').trim(),
  };
}

export function useTranscriptMultiWordSelection({
  containerRef,
  lookupWord,
}: UseTranscriptMultiWordSelectionOptions) {
  const [toolbar, setToolbar] = useState<SelectionToolbarState | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<WordTokenKey>>(new Set());

  const interactionRef = useRef<ActiveInteraction | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressNextClickRef = useRef(false);

  const clearLongPressTimer = useCallback(() => {
    if (!longPressTimerRef.current) return;
    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  }, []);

  const resetVisualSelection = useCallback(() => {
    clearLongPressTimer();
    interactionRef.current = null;
    setSelectedKeys(new Set());
  }, [clearLongPressTimer]);

  const closeToolbar = useCallback(() => {
    setToolbar(null);
    resetVisualSelection();
  }, [resetVisualSelection]);

  const applySelection = useCallback((anchorKey: WordTokenKey, focusKey: WordTokenKey) => {
    const container = containerRef.current;
    if (!container) return null;

    const selection = buildSelectionFromDom(container, anchorKey, focusKey);
    setSelectedKeys(selection.selectedKeys);
    return selection;
  }, [containerRef]);

  const activateSelection = useCallback(() => {
    const interaction = interactionRef.current;
    if (!interaction) return;

    interaction.selecting = true;
    interaction.focusKey = interaction.anchorKey;
    suppressNextClickRef.current = true;

    if ('vibrate' in navigator) navigator.vibrate(35);

    applySelection(interaction.anchorKey, interaction.focusKey);
  }, [applySelection]);

  const scheduleLongPress = useCallback(() => {
    clearLongPressTimer();
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      activateSelection();
    }, LONG_PRESS_MS);
  }, [activateSelection, clearLongPressTimer]);

  const updateSelectionAtPoint = useCallback((x: number, y: number) => {
    const interaction = interactionRef.current;
    const container = containerRef.current;
    if (!interaction || !container) return;

    const bounds = container.getBoundingClientRect();
    if (y < bounds.top + EDGE_SCROLL_PX) container.scrollTop -= EDGE_SCROLL_STEP;
    if (y > bounds.bottom - EDGE_SCROLL_PX) container.scrollTop += EDGE_SCROLL_STEP;

    const token = findTokenAt(container, x, y);
    if (!token) return;

    const meta = readTokenMeta(token);
    if (!meta || meta.key === interaction.focusKey) return;

    interaction.focusKey = meta.key;
    applySelection(interaction.anchorKey, interaction.focusKey);
  }, [applySelection, containerRef]);

  const markMoveBeforeSelection = useCallback((x: number, y: number) => {
    const interaction = interactionRef.current;
    if (!interaction || interaction.selecting) return false;

    const dx = x - interaction.startX;
    const dy = y - interaction.startY;
    const moved = Math.hypot(dx, dy) > MOVE_CANCEL_PX;

    if (!moved) return false;

    interaction.movedBeforeSelection = true;

    const verticalScrollIntent = Math.abs(dy) > MOVE_CANCEL_PX && Math.abs(dy) > Math.abs(dx) * 1.2;
    if (verticalScrollIntent) clearLongPressTimer();

    return true;
  }, [clearLongPressTimer]);

  const finishInteraction = useCallback(() => {
    const interaction = interactionRef.current;
    clearLongPressTimer();

    if (!interaction) return;

    interactionRef.current = null;

    if (!interaction.selecting) {
      if (!interaction.movedBeforeSelection) {
        suppressNextClickRef.current = true;
        const clean = cleanLookupWord(interaction.startWord);
        if (clean.length >= 2) lookupWord(clean, interaction.startSentence);
      }
      return;
    }

    suppressNextClickRef.current = true;

    const selection = applySelection(interaction.anchorKey, interaction.focusKey);
    if (!selection?.phrase) {
      setSelectedKeys(new Set());
      return;
    }

    setToolbar({
      phrase: selection.phrase,
      sentence: selection.sentence || selection.phrase,
    });
  }, [applySelection, clearLongPressTimer, lookupWord]);

  const cancelInteraction = useCallback(() => {
    clearLongPressTimer();
    interactionRef.current = null;
  }, [clearLongPressTimer]);

  const onDocumentTouchMove = useCallback((event: TouchEvent) => {
    const interaction = interactionRef.current;
    if (!interaction || interaction.mode !== 'touch') return;

    const touch = Array.from(event.touches).find(item => item.identifier === interaction.touchId);
    if (!touch) return;

    if (!interaction.selecting) {
      markMoveBeforeSelection(touch.clientX, touch.clientY);
      return;
    }

    event.preventDefault();
    updateSelectionAtPoint(touch.clientX, touch.clientY);
  }, [markMoveBeforeSelection, updateSelectionAtPoint]);

  const onDocumentTouchEnd = useCallback((event: TouchEvent) => {
    const interaction = interactionRef.current;
    if (!interaction || interaction.mode !== 'touch') return;

    const changedTouch = Array.from(event.changedTouches).find(item => item.identifier === interaction.touchId);
    if (!changedTouch) return;

    finishInteraction();
  }, [finishInteraction]);

  const onDocumentMouseMove = useCallback((event: MouseEvent) => {
    const interaction = interactionRef.current;
    if (!interaction || interaction.mode !== 'mouse') return;

    if (!interaction.selecting) {
      markMoveBeforeSelection(event.clientX, event.clientY);
      return;
    }

    event.preventDefault();
    updateSelectionAtPoint(event.clientX, event.clientY);
  }, [markMoveBeforeSelection, updateSelectionAtPoint]);

  const onDocumentMouseUp = useCallback(() => {
    const interaction = interactionRef.current;
    if (!interaction || interaction.mode !== 'mouse') return;

    finishInteraction();
  }, [finishInteraction]);

  useEffect(() => {
    const touchOptions: AddEventListenerOptions = { passive: false };

    document.addEventListener('touchmove', onDocumentTouchMove, touchOptions);
    document.addEventListener('touchend', onDocumentTouchEnd);
    document.addEventListener('touchcancel', cancelInteraction);
    document.addEventListener('mousemove', onDocumentMouseMove);
    document.addEventListener('mouseup', onDocumentMouseUp);

    return () => {
      document.removeEventListener('touchmove', onDocumentTouchMove);
      document.removeEventListener('touchend', onDocumentTouchEnd);
      document.removeEventListener('touchcancel', cancelInteraction);
      document.removeEventListener('mousemove', onDocumentMouseMove);
      document.removeEventListener('mouseup', onDocumentMouseUp);
      clearLongPressTimer();
    };
  }, [cancelInteraction, clearLongPressTimer, onDocumentMouseMove, onDocumentMouseUp, onDocumentTouchEnd, onDocumentTouchMove]);

  const beginInteraction = useCallback((
    mode: InteractionMode,
    point: { x: number; y: number; touchId?: number },
    segIndex: number,
    wordIndex: number,
    word: string,
    sentence: string,
  ) => {
    const tokenKey = makeKey(segIndex, wordIndex);

    clearLongPressTimer();
    setToolbar(null);
    setSelectedKeys(new Set());

    interactionRef.current = {
      mode,
      touchId: point.touchId,
      anchorKey: tokenKey,
      focusKey: tokenKey,
      startX: point.x,
      startY: point.y,
      startWord: word,
      startSentence: sentence,
      movedBeforeSelection: false,
      selecting: false,
    };

    scheduleLongPress();
  }, [clearLongPressTimer, scheduleLongPress]);

  const onWordTouchStart = useCallback((
    event: ReactTouchEvent,
    segIndex: number,
    wordIndex: number,
    word: string,
    sentence: string,
  ) => {
    if (event.touches.length !== 1) return;

    event.stopPropagation();

    const touch = event.touches[0];
    beginInteraction('touch', {
      x: touch.clientX,
      y: touch.clientY,
      touchId: touch.identifier,
    }, segIndex, wordIndex, word, sentence);
  }, [beginInteraction]);

  const onWordMouseDown = useCallback((
    event: ReactMouseEvent,
    segIndex: number,
    wordIndex: number,
    word: string,
    sentence: string,
  ) => {
    if (event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();

    beginInteraction('mouse', {
      x: event.clientX,
      y: event.clientY,
    }, segIndex, wordIndex, word, sentence);
  }, [beginInteraction]);

  const onWordClickCapture = useCallback((event: ReactMouseEvent) => {
    event.stopPropagation();

    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      event.preventDefault();
    }
  }, []);

  const isWordSelected = useCallback((segIndex: number, wordIndex: number) => {
    return selectedKeys.has(makeKey(segIndex, wordIndex));
  }, [selectedKeys]);

  return {
    toolbar,
    isWordSelected,
    onWordTouchStart,
    onWordMouseDown,
    onWordClickCapture,
    closeToolbar,
  };
}
