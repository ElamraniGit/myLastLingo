/**
 * TranscriptViewer — synchronized subtitles panel.
 * Auto-scrolls to the active segment as the video plays.
 *
 * Interactions:
 *  - Single tap on a word   → dictionary popup (single word)
 *  - Native text selection  → SelectionToolbar (multi-word phrase)
 *    Works exactly like selecting text anywhere on the phone:
 *    long-press → drag handles → toolbar appears
 *
 * Multi-word selection uses the browser's native Selection API.
 * We listen to 'selectionchange' on the transcript container,
 * detect when ≥2 words are selected, and show SelectionToolbar.
 */

import React, { useRef, useEffect, memo, useCallback, useState } from 'react';
import { useStore } from '@/store/appStore';
import { useVideoPlayer } from '@/hooks/useVideoPlayer';
import { useDictionary } from '@/hooks/useDictionary';
import type { TranscriptSegment, WordTiming, TranscriptFontSize } from '@/types';
import { Button } from '@/components/ui/Button';
import SelectionToolbar from '@/components/common/SelectionToolbar';

const FONT_SIZE_CLASSES: Record<TranscriptFontSize, { row: string; current: string; meta: string }> = {
  sm: { row: 'text-sm', current: 'text-sm', meta: 'text-[11px]' },
  md: { row: 'text-base', current: 'text-sm', meta: 'text-xs' },
  lg: { row: 'text-lg', current: 'text-base', meta: 'text-xs' },
  xl: { row: 'text-xl', current: 'text-lg', meta: 'text-sm' },
};

function getActiveWordIndex(words: WordTiming[], currentTime: number) {
  if (!Array.isArray(words) || words.length === 0) return -1;

  // Shift time slightly forward so highlight leads the audio
  const t = currentTime + 0.08;

  // Direct match (most common case)
  const exact = words.findIndex(
    (w) => t >= w.start && t <= w.end + 0.08
  );
  if (exact >= 0) return exact;

  // Nearest word within tolerance
  let bestIdx = -1;
  let bestDist = 0.2;
  for (let i = 0; i < words.length; i++) {
    const d = Math.min(Math.abs(t - words[i].start), Math.abs(t - words[i].end));
    if (d < bestDist) { bestDist = d; bestIdx = i; }
  }
  return bestIdx;
}

function StatusBanner() {
  const { transcriptStatus } = useStore();
  const { extractTranscript } = useVideoPlayer();

  if (transcriptStatus === 'idle') return (
    <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center" dir="ltr">
      <div className="w-14 h-14 rounded-2xl bg-card flex items-center justify-center mb-4 text-2xl">📝</div>
      <p className="text-base font-semibold text-heading mb-1">No subtitles loaded</p>
      <p className="text-sm text-muted mb-5 max-w-xs leading-relaxed">
        Extract subtitles from YouTube captions, or use local Whisper AI as fallback.
      </p>
      <Button onClick={extractTranscript} variant="primary">Extract Subtitles</Button>
    </div>
  );

  if (transcriptStatus === 'loading') return (
    <div className="flex flex-col items-center justify-center h-full py-16 text-center" dir="ltr">
      <div className="w-10 h-10 border-[3px] border-line border-t-blue-500 rounded-full animate-spin mb-5" />
      <p className="text-base font-semibold text-heading mb-1">Fetching subtitles…</p>
      <p className="text-sm text-muted">Checking YouTube captions</p>
    </div>
  );

  if (transcriptStatus === 'processing') return (
    <div className="flex flex-col items-center justify-center h-full py-16 text-center px-6" dir="ltr">
      <div className="w-10 h-10 border-[3px] border-line border-t-purple-500 rounded-full animate-spin mb-5" />
      <p className="text-base font-semibold text-heading mb-1">Transcribing with Whisper AI…</p>
      <p className="text-sm text-muted max-w-xs leading-relaxed">
        No YouTube captions found — running local speech-to-text. This may take a few minutes.
      </p>
    </div>
  );

  if (transcriptStatus === 'error') return (
    <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center" dir="ltr">
      <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4 text-2xl">⚠️</div>
      <p className="text-base font-semibold text-heading mb-1">Subtitle extraction failed</p>
      <p className="text-sm text-muted mb-5 max-w-xs leading-relaxed">
        This video may not have captions. Install{' '}
        <code className="text-body bg-card px-1 rounded">faster-whisper</code>{' '}
        for local transcription.
      </p>
      <Button onClick={extractTranscript} variant="outline" size="sm">Try Again</Button>
    </div>
  );

  return null;
}

export default function TranscriptViewer() {
  const { transcript, playerState, currentTime, transcriptStatus, transcriptFontSize, currentVideo } = useStore();
  const { seekTo } = useVideoPlayer();
  const { lookupWord } = useDictionary();
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef    = useRef<HTMLDivElement>(null);
  const lastScrolledSegment = useRef<number>(-1);

  // ── Custom selection state ─────────────────────────────────────────────────
  const [toolbar, setToolbar] = useState<{
    phrase: string; sentence: string; position: { x: number; y: number };
  } | null>(null);

  // Selection tracking via pointer events on the CONTAINER
  // (avoids the setPointerCapture-in-setTimeout problem)
  const selWords   = useRef<string[]>([]);    // words accumulated during drag
  const selSegText = useRef<string>('');       // sentence context
  const pointerDownRef = useRef<{ x: number; y: number } | null>(null);
  const isDragging     = useRef(false);
  const [selectionHighlight, setSelectionHighlight] = useState<{
    segIndex: number; wordIndices: Set<number>;
  } | null>(null);

  // ── Auto-scroll active segment ─────────────────────────────────────────────
  useEffect(() => {
    const segIdx = playerState.current_segment;
    if (segIdx === lastScrolledSegment.current) return;
    const el = activeRef.current;
    const container = containerRef.current;
    if (!el || !container) return;
    lastScrolledSegment.current = segIdx;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [playerState.current_segment]);

  // ── Prevent browser context menu (stops "Copy/Paste/Share" popup) ──────────
  const preventContextMenu = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
  }, []);

  // ── Get word element under a touch/pointer point ───────────────────────────
  const getWordAt = useCallback((clientX: number, clientY: number) => {
    const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    if (!el) return null;
    // Walk up to find a [data-word] span
    let cur: HTMLElement | null = el;
    while (cur && cur !== containerRef.current) {
      if (cur.dataset?.word) return cur;
      cur = cur.parentElement;
    }
    return null;
  }, []);

  // ── Pointer down on container ──────────────────────────────────────────────
  const onContainerPointerDown = useCallback((e: React.PointerEvent) => {
    // Only track touch or left-mouse
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointerDownRef.current = { x: e.clientX, y: e.clientY };
    isDragging.current = false;
    selWords.current = [];
    selSegText.current = '';
    setSelectionHighlight(null);
    setToolbar(null);
  }, []);

  // ── Pointer move on container ──────────────────────────────────────────────
  const onContainerPointerMove = useCallback((e: React.PointerEvent) => {
    if (!pointerDownRef.current) return;
    const dx = e.clientX - pointerDownRef.current.x;
    const dy = e.clientY - pointerDownRef.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Start drag only after moving ≥12px (avoids accidental activation)
    if (!isDragging.current && dist < 12) return;
    isDragging.current = true;

    const wordEl = getWordAt(e.clientX, e.clientY);
    if (!wordEl) return;

    const word    = wordEl.dataset.word || '';
    const segIdx  = parseInt(wordEl.dataset.segIndex || '-1', 10);
    const wordIdx = parseInt(wordEl.dataset.wordIndex || '-1', 10);
    const segText = wordEl.dataset.segText || '';

    if (!word || segIdx < 0) return;

    selSegText.current = segText;

    // Accumulate unique words in order
    const key = `${segIdx}-${wordIdx}`;
    if (!selWords.current.includes(key)) {
      selWords.current.push(key);
    }

    // Build highlight
    setSelectionHighlight(prev => {
      const indices = new Set(prev?.segIndex === segIdx ? prev.wordIndices : new Set<number>());
      if (wordIdx >= 0) indices.add(wordIdx);
      return { segIndex: segIdx, wordIndices: indices };
    });
  }, [getWordAt]);

  // ── Pointer up on container ────────────────────────────────────────────────
  const onContainerPointerUp = useCallback((e: React.PointerEvent) => {
    const wasDragging = isDragging.current;
    pointerDownRef.current = null;
    isDragging.current = false;

    if (!wasDragging) {
      // Normal tap — handled by onClick on the word span
      setSelectionHighlight(null);
      return;
    }

    // Build phrase from highlighted words
    const highlight = selectionHighlight;
    setSelectionHighlight(null);

    if (!highlight || highlight.wordIndices.size < 2) return;

    // Get words in order from the DOM
    const container = containerRef.current;
    if (!container) return;
    const spans = container.querySelectorAll<HTMLElement>(
      `[data-seg-index="${highlight.segIndex}"][data-word]`
    );
    const indices = Array.from(highlight.wordIndices).sort((a, b) => a - b);
    const lo = indices[0];
    const hi = indices[indices.length - 1];
    const words: string[] = [];
    spans.forEach(span => {
      const wi = parseInt(span.dataset.wordIndex || '-1', 10);
      if (wi >= lo && wi <= hi) words.push(span.dataset.word || '');
    });

    const phrase = words.join(' ').replace(/[.,!?;:]+$/, '').trim();
    if (!phrase || words.length < 2) return;

    const containerRect = containerRef.current!.getBoundingClientRect();
    setToolbar({
      phrase,
      sentence: selSegText.current || phrase,
      position: {
        x: containerRect.left + containerRect.width / 2,
        y: e.clientY,
      },
    });
  }, [selectionHighlight]);

  const closeToolbar = useCallback(() => {
    setToolbar(null);
  }, []);

  const handleWordClick = useCallback((word: string, segText: string) => {
    setToolbar(null);
    lookupWord(word, segText);
  }, [lookupWord]);

  if (transcriptStatus !== 'ready' || !transcript?.segments?.length) {
    return <StatusBanner />;
  }

  return (
    <div className="flex flex-col h-full" dir="ltr">
      <div className="flex items-center justify-between px-4 py-3 border-b border-line-s flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm leading-none">📝</span>
          <span className="text-sm font-semibold text-heading">Subtitles</span>
          <span className="text-xs text-faint bg-card px-2 py-0.5 rounded-full ml-1">
            {transcript.segments.length} lines
          </span>
          <span className="text-[10px] text-faint hidden sm:block">· tap = lookup · hold & drag = select phrase</span>
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
          transcript.source === 'youtube'
            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
            : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
        }`}>
          {transcript.source === 'youtube' ? '▶ YouTube' : '🤖 Whisper AI'}
        </span>
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-3 py-3 space-y-1 scrollbar-thin select-none"
        dir="ltr"
        onPointerDown={onContainerPointerDown}
        onPointerMove={onContainerPointerMove}
        onPointerUp={onContainerPointerUp}
        onPointerCancel={() => { pointerDownRef.current = null; isDragging.current = false; setSelectionHighlight(null); }}
        onContextMenu={preventContextMenu}
      >
        {transcript.segments.map((seg) => {
          const isActive = playerState.current_segment === seg.index;
          const highlight = selectionHighlight?.segIndex === seg.index
            ? selectionHighlight.wordIndices : null;
          return (
            <SegmentRow
              key={seg.index}
              segment={seg}
              isActive={isActive}
              currentTime={currentTime}
              fontSize={transcriptFontSize}
              onSeek={() => seekTo(seg.start)}
              onWordClick={(word) => handleWordClick(word, seg.text)}
              highlightIndices={highlight}
              ref={isActive ? activeRef : undefined}
            />
          );
        })}
      </div>

      {/* Multi-word selection toolbar */}
      {toolbar && (
        <SelectionToolbar
          phrase={toolbar.phrase}
          sentence={toolbar.sentence}
          position={toolbar.position}
          onClose={closeToolbar}
          videoId={currentVideo?.id}
        />
      )}
    </div>
  );
}

const SegmentRow = memo(React.forwardRef<HTMLDivElement, {
  segment: TranscriptSegment;
  isActive: boolean;
  currentTime: number;
  fontSize: TranscriptFontSize;
  onSeek: () => void;
  onWordClick: (word: string) => void;
  highlightIndices: Set<number> | null;
}>(({ segment, isActive, currentTime, fontSize, onSeek, onWordClick, highlightIndices }, ref) => {

  const clean = (w: string) => w.replace(/[^\w'-]/g, '').trim();
  const font  = FONT_SIZE_CLASSES[fontSize] ?? FONT_SIZE_CLASSES.md;
  const activeWordIndex = getActiveWordIndex(segment.words || [], currentTime);

  return (
    <div
      ref={ref}
      onClick={onSeek}
      dir="ltr"
      className={`group relative rounded-xl px-3 py-2.5 cursor-pointer border ${
        isActive
          ? 'bg-blue-500/8 border-blue-500/20 shadow-sm'
          : 'border-transparent hover:bg-card/70 hover:border-line/50'
      }`}
    >
      {isActive && (
        <div className="absolute left-0 top-2 bottom-2 w-[3px] bg-blue-500 rounded-full" />
      )}

      <div
        className={`flex flex-wrap gap-x-1 gap-y-1 leading-relaxed pl-1 ${font.row}`}
        style={{ direction: 'ltr', textAlign: 'left' }}
      >
        {segment.words && segment.words.length > 0
          ? segment.words.map((word, wi) => {
              const isHighlighted = highlightIndices?.has(wi) ?? false;
              return (
                <WordToken
                  key={wi}
                  word={word}
                  fontSize={fontSize}
                  isCurrentWord={activeWordIndex === wi}
                  isActiveSentence={isActive}
                  isHighlighted={isHighlighted}
                  segIndex={segment.index}
                  wordIndex={wi}
                  segText={segment.text}
                  onClick={(e) => {
                    e.stopPropagation();
                    const w = clean(word.word);
                    if (w) onWordClick(w);
                  }}
                />
              );
            })
          : segment.text.split(' ').map((w, i) => {
              const c = clean(w);
              const isHighlighted = highlightIndices?.has(i) ?? false;
              return (
                <span
                  key={i}
                  data-word={c}
                  data-seg-index={segment.index}
                  data-word-index={i}
                  data-seg-text={segment.text}
                  style={{ direction: 'ltr', unicodeBidi: 'isolate' }}
                  onClick={e => { e.stopPropagation(); if (c) onWordClick(c); }}
                  className={`${font.row} cursor-pointer px-0.5 py-px rounded transition-colors ${
                    isHighlighted
                      ? 'bg-amber-400/30 text-amber-300'
                      : isActive
                      ? 'text-heading hover:text-blue-300 hover:bg-blue-500/15'
                      : 'text-muted hover:text-heading hover:bg-elevated/60'
                  }`}
                >
                  {w}
                </span>
              );
            })}
      </div>

      <div className="mt-1.5 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <span className={`${font.meta} text-faint tabular-nums`}>
          {fmtTime(segment.start)} → {fmtTime(segment.end)}
        </span>
        <span className={`${font.meta} text-faint`}>
          {(segment.end - segment.start).toFixed(1)}s
        </span>
        {highlightIndices && highlightIndices.size > 1 && (
          <span className="text-[10px] text-amber-400 ml-1">
            {highlightIndices.size} words selected
          </span>
        )}
      </div>
    </div>
  );
}));
SegmentRow.displayName = 'SegmentRow';

function WordToken({ word, fontSize, isCurrentWord, isActiveSentence, isHighlighted,
  segIndex, wordIndex, segText, onClick }: {
  word: WordTiming;
  fontSize: TranscriptFontSize;
  isCurrentWord: boolean;
  isActiveSentence: boolean;
  isHighlighted: boolean;
  segIndex: number;
  wordIndex: number;
  segText: string;
  onClick: (e: React.MouseEvent) => void;
}) {
  const font = FONT_SIZE_CLASSES[fontSize] ?? FONT_SIZE_CLASSES.md;
  const clean = word.word.replace(/[^\w'-]/g, '').trim();

  return (
    <span
      onClick={onClick}
      data-word={clean}
      data-seg-index={segIndex}
      data-word-index={wordIndex}
      data-seg-text={segText}
      style={{ direction: 'ltr', unicodeBidi: 'isolate' }}
      className={`${font.row} relative inline-block cursor-pointer px-0.5 py-px rounded transition-colors ${
        isHighlighted
          ? 'bg-amber-400/30 text-amber-300 font-semibold'
          : isCurrentWord
          ? 'text-blue-300 font-semibold bg-blue-500/20'
          : isActiveSentence
          ? 'text-heading hover:text-blue-300 hover:bg-blue-500/15'
          : 'text-muted hover:text-heading hover:bg-elevated/60'
      }`}
    >
      {word.word}
      {isCurrentWord && !isHighlighted && (
        <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-400 rounded-full" />
      )}
    </span>
  );
}


function fmtTime(s: number): string {
  if (!s || !isFinite(s)) return '0:00';
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}
