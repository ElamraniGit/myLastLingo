import { useCallback, useRef, useState } from 'react';
import type { RefObject, TouchEvent } from 'react';

const LONG_PRESS_MS = 500;
const WORD_SELECTOR = '[data-seg-index][data-word-index]';

type WordTokenKey = `${number}:${number}`;

interface SelectionToolbarState {
  phrase: string;
  sentence: string;
}

interface WordTokenMeta {
  key: WordTokenKey;
  segIndex: number;
  wordIndex: number;
  word: string;
  sentence: string;
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
    segIndex,
    wordIndex,
    word: el.dataset.word ?? '',
    sentence: el.dataset.segText ?? '',
  };
}

function findTokenAt(container: HTMLElement, x: number, y: number): HTMLElement | null {
  const hit = (px: number, py: number) => {
    const el = document.elementFromPoint(px, py) as HTMLElement | null;
    let current: HTMLElement | null = el;

    while (current && current !== container) {
      if (current.matches?.(WORD_SELECTOR)) return current;
      current = current.parentElement;
    }

    return null;
  };

  return hit(x, y)
    || hit(x - 15, y) || hit(x + 15, y)
    || hit(x - 30, y) || hit(x + 30, y)
    || hit(x, y - 6) || hit(x, y + 6);
}

function getOrderedTokens(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(WORD_SELECTOR));
}

function buildSelectionFromDom(
  container: HTMLElement,
  anchorKey: WordTokenKey,
  focusKey: WordTokenKey,
) {
  const tokens = getOrderedTokens(container);
  const anchorIndex = tokens.findIndex(token => readTokenMeta(token)?.key === anchorKey);
  const focusIndex = tokens.findIndex(token => readTokenMeta(token)?.key === focusKey);

  if (anchorIndex < 0 || focusIndex < 0) {
    return { selectedKeys: new Set<WordTokenKey>(), phrase: '', sentence: '' };
  }

  const lo = Math.min(anchorIndex, focusIndex);
  const hi = Math.max(anchorIndex, focusIndex);
  const selectedTokens = tokens.slice(lo, hi + 1);
  const selectedKeys = new Set<WordTokenKey>();
  const phraseWords: string[] = [];
  const sentenceParts: string[] = [];
  const seenSentences = new Set<string>();

  selectedTokens.forEach(token => {
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

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSelecting = useRef(false);
  const isTap = useRef(true);
  const anchorKey = useRef<WordTokenKey | null>(null);
  const focusKey = useRef<WordTokenKey | null>(null);
  const startWord = useRef('');
  const startSentence = useRef('');

  const clearTimer = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const resetSelection = useCallback(() => {
    clearTimer();
    isSelecting.current = false;
    isTap.current = true;
    anchorKey.current = null;
    focusKey.current = null;
    startWord.current = '';
    startSentence.current = '';
    setSelectedKeys(new Set());
  }, [clearTimer]);

  const closeToolbar = useCallback(() => {
    setToolbar(null);
    resetSelection();
  }, [resetSelection]);

  const startSelectionAtToken = useCallback((token: WordTokenMeta) => {
    const container = containerRef.current;
    if (!container) return;

    isSelecting.current = true;
    isTap.current = false;
    anchorKey.current = token.key;
    focusKey.current = token.key;

    if ('vibrate' in navigator) navigator.vibrate(40);

    const selection = buildSelectionFromDom(container, token.key, token.key);
    setSelectedKeys(selection.selectedKeys);
  }, [containerRef]);

  const onWordTouchStart = useCallback((
    event: TouchEvent,
    segIndex: number,
    wordIndex: number,
    word: string,
    sentence: string,
  ) => {
    event.stopPropagation();

    clearTimer();
    setToolbar(null);
    setSelectedKeys(new Set());

    isSelecting.current = false;
    isTap.current = true;
    const tokenKey = makeKey(segIndex, wordIndex);
    anchorKey.current = tokenKey;
    focusKey.current = tokenKey;
    startWord.current = word;
    startSentence.current = sentence;

    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null;
      startSelectionAtToken({
        key: tokenKey,
        segIndex,
        wordIndex,
        word,
        sentence,
      });
    }, LONG_PRESS_MS);
  }, [clearTimer, startSelectionAtToken]);

  const onContainerTouchMove = useCallback((event: TouchEvent) => {
    if (!isSelecting.current) {
      clearTimer();
      return;
    }

    event.preventDefault();

    const container = containerRef.current;
    const touch = event.touches[0];
    const startKey = anchorKey.current;
    if (!container || !touch || !startKey) return;

    const token = findTokenAt(container, touch.clientX, touch.clientY);
    if (!token) return;

    const meta = readTokenMeta(token);
    if (!meta || meta.key === focusKey.current) return;

    focusKey.current = meta.key;
    const selection = buildSelectionFromDom(container, startKey, meta.key);
    setSelectedKeys(selection.selectedKeys);
  }, [clearTimer, containerRef]);

  const onContainerTouchEnd = useCallback(() => {
    clearTimer();

    if (!isSelecting.current) {
      if (isTap.current && startWord.current) {
        const clean = cleanLookupWord(startWord.current);
        if (clean.length >= 2) lookupWord(clean, startSentence.current);
      }

      startWord.current = '';
      startSentence.current = '';
      return;
    }

    isSelecting.current = false;

    const container = containerRef.current;
    const startKey = anchorKey.current;
    const endKey = focusKey.current;

    if (!container || !startKey || !endKey) {
      resetSelection();
      return;
    }

    const selection = buildSelectionFromDom(container, startKey, endKey);
    if (!selection.phrase) {
      resetSelection();
      return;
    }

    setSelectedKeys(selection.selectedKeys);
    setToolbar({
      phrase: selection.phrase,
      sentence: selection.sentence || selection.phrase,
    });

    startWord.current = '';
    startSentence.current = '';
  }, [clearTimer, containerRef, lookupWord, resetSelection]);

  const isWordSelected = useCallback((segIndex: number, wordIndex: number) => {
    return selectedKeys.has(makeKey(segIndex, wordIndex));
  }, [selectedKeys]);

  return {
    toolbar,
    isWordSelected,
    onWordTouchStart,
    onContainerTouchMove,
    onContainerTouchEnd,
    closeToolbar,
  };
}
