/**
 * TranscriptViewer — synchronized subtitles panel.
 * Auto-scrolls to the active segment as the video plays.
 *
 * Interactions:
 *  - Single tap on a word   → dictionary popup (single word)
 *  - Long-press / drag      → multi-word selection → SelectionToolbar
 *  - Tap on segment row     → seek video to that time
 *
 * Multi-word selection:
 *  On pointerdown, record the start word index.
 *  On pointermove, extend the selection range.
 *  On pointerup, if >1 word selected → show SelectionToolbar.
 *  If 1 word → fall through to single-word lookup.
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

// ── Global selection state (shared across all segments) ───────────────────────
interface WordSelection {
  segIndex: number;
  startWord: number;
  endWord: number;
}

export default function TranscriptViewer() {
  const { transcript, playerState, currentTime, transcriptStatus, transcriptFontSize, currentVideo } = useStore();
  const { seekTo } = useVideoPlayer();
  const { lookupWord } = useDictionary();
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);
  const lastScrolledSegment = useRef<number>(-1);

  // Multi-word selection state
  const [selection,  setSelection]  = useState<WordSelection | null>(null);
  const [toolbar, setToolbar] = useState<{
    phrase: string;
    sentence: string;
    position: { x: number; y: number };
  } | null>(null);
  // Auto-scroll active segment into view within the transcript container
  useEffect(() => {
    const segIdx = playerState.current_segment;
    if (segIdx === lastScrolledSegment.current) return;

    const el = activeRef.current;
    const container = containerRef.current;
    if (!el || !container) return;

    lastScrolledSegment.current = segIdx;

    // scrollIntoView works correctly here because the transcript
    // lives in its own overflow container (not the page body)
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [playerState.current_segment]);

  // ── Multi-word selection via Long-Press ────────────────────────────────────
  // Normal tap   → single word lookup (unchanged behaviour)
  // Long press (≥400ms) + drag → multi-word selection → SelectionToolbar
  const longPressTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressActive = useRef(false);
  const dragStartRef    = useRef<{ segIndex: number; wordIndex: number } | null>(null);
  const isDraggingRef   = useRef(false);
  const LONG_PRESS_MS   = 400;

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    longPressActive.current = false;
  }, []);

  const handleWordPointerDown = useCallback((
    e: React.PointerEvent,
    segIndex: number,
    wordIndex: number
  ) => {
    e.stopPropagation();
    cancelLongPress();
    isDraggingRef.current = false;
    longPressActive.current = false;
    setToolbar(null);

    // Start long-press timer — only activate selection mode after 400ms
    longPressTimer.current = setTimeout(() => {
      longPressActive.current = true;
      dragStartRef.current = { segIndex, wordIndex };
      setSelection({ segIndex, startWord: wordIndex, endWord: wordIndex });
      // Haptic feedback if supported
      if ('vibrate' in navigator) navigator.vibrate(30);
      // Capture pointer now for smooth drag
      try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {}
    }, LONG_PRESS_MS);
  }, [cancelLongPress]);

  const handleWordPointerMove = useCallback((
    e: React.PointerEvent,
    segIndex: number,
    wordIndex: number
  ) => {
    // If moved significantly before long-press fires → cancel long-press
    if (!longPressActive.current) {
      cancelLongPress();
      return;
    }
    if (!dragStartRef.current || dragStartRef.current.segIndex !== segIndex) return;
    isDraggingRef.current = true;
    const start = dragStartRef.current.wordIndex;
    setSelection({
      segIndex,
      startWord: Math.min(start, wordIndex),
      endWord:   Math.max(start, wordIndex),
    });
  }, [cancelLongPress]);

  const handleWordPointerUp = useCallback((
    e: React.PointerEvent,
    segIndex: number,
    wordIndex: number,
    word: string,
    segText: string,
    allWords: string[]
  ) => {
    e.stopPropagation();
    const wasLongPress = longPressActive.current;
    const wasDragging  = isDraggingRef.current;
    cancelLongPress();
    isDraggingRef.current = false;

    if (!wasLongPress) {
      // Normal tap — single word lookup
      setSelection(null);
      lookupWord(word, segText);
      dragStartRef.current = null;
      return;
    }

    if (!dragStartRef.current) return;
    const start = dragStartRef.current.wordIndex;
    dragStartRef.current = null;

    // Single word long-pressed (no drag) → treat as tap
    if (!wasDragging && start === wordIndex) {
      setSelection(null);
      lookupWord(word, segText);
      return;
    }

    // Multi-word selection → show toolbar
    const lo = Math.min(start, wordIndex);
    const hi = Math.max(start, wordIndex);
    const phrase = allWords.slice(lo, hi + 1).join(' ').replace(/[.,!?;:]+$/, '').trim();
    if (!phrase) { setSelection(null); return; }

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setToolbar({
      phrase,
      sentence: segText,
      position: { x: rect.left + rect.width / 2, y: rect.top },
    });
  }, [cancelLongPress, lookupWord]);

  const closeToolbar = useCallback(() => {
    setToolbar(null);
    setSelection(null);
  }, []);

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

      <div ref={containerRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-1 scrollbar-thin" dir="ltr">
        {transcript.segments.map((seg) => {
          const isActive = playerState.current_segment === seg.index;
          return (
            <SegmentRow
              key={seg.index}
              segment={seg}
              isActive={isActive}
              currentTime={currentTime}
              fontSize={transcriptFontSize}
              onSeek={() => seekTo(seg.start)}
              onWordClick={(word) => lookupWord(word, seg.text)}
              selection={selection?.segIndex === seg.index ? selection : null}
              onWordPointerDown={(e, wi, w) => handleWordPointerDown(e, seg.index, wi)}
              onWordPointerMove={(e, wi, w) => handleWordPointerMove(e, seg.index, wi)}
              onWordPointerUp={(e, wi, w, allW) => handleWordPointerUp(e, seg.index, wi, w, seg.text, allW)}
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
  selection: { startWord: number; endWord: number } | null;
  onWordPointerDown: (e: React.PointerEvent, wi: number, word: string) => void;
  onWordPointerMove: (e: React.PointerEvent, wi: number, word: string) => void;
  onWordPointerUp:   (e: React.PointerEvent, wi: number, word: string, allWords: string[]) => void;
}>(({ segment, isActive, currentTime, fontSize, onSeek, onWordClick, selection,
     onWordPointerDown, onWordPointerMove, onWordPointerUp }, ref) => {

  const clean = (w: string) => w.replace(/[^\w'-]/g, '').trim();
  const font = FONT_SIZE_CLASSES[fontSize] ?? FONT_SIZE_CLASSES.md;
  const activeWordIndex = getActiveWordIndex(segment.words || [], currentTime);

  // Build word list for pointer events
  const wordTokens: string[] = segment.words && segment.words.length > 0
    ? segment.words.map(w => w.word)
    : segment.text.split(' ');

  const isWordSelected = (wi: number) =>
    selection !== null && wi >= selection.startWord && wi <= selection.endWord;

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
          ? segment.words.map((word, wi) => (
              <WordToken
                key={wi}
                word={word}
                fontSize={fontSize}
                isCurrentWord={activeWordIndex === wi}
                isActiveSentence={isActive}
                isSelected={isWordSelected(wi)}
                onClick={(e) => {
                  e.stopPropagation();
                  const w = clean(word.word);
                  if (w) onWordClick(w);
                }}
                onPointerDown={e => onWordPointerDown(e, wi, word.word)}
                onPointerMove={e => onWordPointerMove(e, wi, word.word)}
                onPointerUp={e => onWordPointerUp(e, wi, clean(word.word), wordTokens.map(clean))}
              />
            ))
          : segment.text.split(' ').map((w, i) => {
              const c = clean(w);
              const selected = isWordSelected(i);
              return (
                <span
                  key={i}
                  style={{ direction: 'ltr', unicodeBidi: 'isolate', touchAction: 'auto' }}
                  onPointerDown={e => { e.stopPropagation(); onWordPointerDown(e, i, w); }}
                  onPointerMove={e => { e.stopPropagation(); onWordPointerMove(e, i, w); }}
                  onPointerUp={e => { e.stopPropagation(); onWordPointerUp(e, i, c, wordTokens.map(clean)); }}
                  onPointerCancel={e => { e.stopPropagation(); cancelLongPress(); }}
                  onClick={e => e.stopPropagation()}
                  className={`${font.row} cursor-pointer select-none px-0.5 py-px rounded transition-colors ${
                    selected
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
        {selection && (
          <span className="text-[10px] text-amber-400 ml-1">
            {selection.endWord - selection.startWord + 1} words selected
          </span>
        )}
      </div>
    </div>
  );
}));
SegmentRow.displayName = 'SegmentRow';

function WordToken({ word, fontSize, isCurrentWord, isActiveSentence, isSelected, onClick,
  onPointerDown, onPointerMove, onPointerUp }: {
  word: WordTiming;
  fontSize: TranscriptFontSize;
  isCurrentWord: boolean;
  isActiveSentence: boolean;
  isSelected: boolean;
  onClick: (e: React.MouseEvent) => void;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp:   (e: React.PointerEvent) => void;
}) {
  const font = FONT_SIZE_CLASSES[fontSize] ?? FONT_SIZE_CLASSES.md;

  return (
    <span
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{ direction: 'ltr', unicodeBidi: 'isolate', touchAction: 'auto' }}
      className={`${font.row} relative inline-block cursor-pointer select-none px-0.5 py-px rounded transition-colors ${
        isSelected
          ? 'bg-amber-400/30 text-amber-300 font-semibold'
          : isCurrentWord
          ? 'text-blue-300 font-semibold bg-blue-500/20'
          : isActiveSentence
          ? 'text-heading hover:text-blue-300 hover:bg-blue-500/15'
          : 'text-muted hover:text-heading hover:bg-elevated/60'
      }`}
    >
      {word.word}
      {isCurrentWord && !isSelected && (
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
