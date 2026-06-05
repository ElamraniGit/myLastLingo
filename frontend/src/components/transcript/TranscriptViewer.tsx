/**
 * TranscriptViewer — synchronized subtitles panel.
 *
 * Each segment is rendered as CONTINUOUS TEXT (not fragmented spans),
 * so native browser text selection works perfectly across the full line.
 *
 * Interactions:
 *  - Tap a word         → dictionary popup (via click + position detection)
 *  - Select text        → browser native selection → SelectionToolbar
 *    (long-press on mobile, click-drag on desktop — exactly like any text app)
 */

import React, { useRef, useEffect, memo, useCallback, useState } from 'react';
import { useStore } from '@/store/appStore';
import { useVideoPlayer } from '@/hooks/useVideoPlayer';
import { useDictionary } from '@/hooks/useDictionary';
import type { TranscriptSegment, WordTiming, TranscriptFontSize } from '@/types';
import { Button } from '@/components/ui/Button';
import SelectionToolbar from '@/components/common/SelectionToolbar';

const FONT_SIZE_CLASSES: Record<TranscriptFontSize, { row: string; current: string; meta: string }> = {
  sm: { row: 'text-sm',   current: 'text-sm',  meta: 'text-[11px]' },
  md: { row: 'text-base', current: 'text-sm',  meta: 'text-xs' },
  lg: { row: 'text-lg',   current: 'text-base', meta: 'text-xs' },
  xl: { row: 'text-xl',   current: 'text-lg',  meta: 'text-sm' },
};

function getActiveWordIndex(words: WordTiming[], currentTime: number) {
  if (!Array.isArray(words) || words.length === 0) return -1;
  const t = currentTime + 0.08;
  const exact = words.findIndex(w => t >= w.start && t <= w.end + 0.08);
  if (exact >= 0) return exact;
  let bestIdx = -1, bestDist = 0.2;
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
    <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-card flex items-center justify-center mb-4 text-2xl">📝</div>
      <p className="text-base font-semibold text-heading mb-1">No subtitles loaded</p>
      <p className="text-sm text-muted mb-5 max-w-xs leading-relaxed">
        Extract subtitles from YouTube captions, or use local Whisper AI as fallback.
      </p>
      <Button onClick={extractTranscript} variant="primary">Extract Subtitles</Button>
    </div>
  );
  if (transcriptStatus === 'loading') return (
    <div className="flex flex-col items-center justify-center h-full py-16 text-center">
      <div className="w-10 h-10 border-[3px] border-line border-t-blue-500 rounded-full animate-spin mb-5" />
      <p className="text-base font-semibold text-heading mb-1">Fetching subtitles…</p>
    </div>
  );
  if (transcriptStatus === 'processing') return (
    <div className="flex flex-col items-center justify-center h-full py-16 text-center px-6">
      <div className="w-10 h-10 border-[3px] border-line border-t-purple-500 rounded-full animate-spin mb-5" />
      <p className="text-base font-semibold text-heading mb-1">Transcribing with Whisper AI…</p>
    </div>
  );
  if (transcriptStatus === 'error') return (
    <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4 text-2xl">⚠️</div>
      <p className="text-base font-semibold text-heading mb-1">Subtitle extraction failed</p>
      <Button onClick={extractTranscript} variant="outline" size="sm">Try Again</Button>
    </div>
  );
  return null;
}

export default function TranscriptViewer() {
  const { transcript, playerState, currentTime, transcriptStatus, transcriptFontSize, currentVideo } = useStore();
  const { seekTo }     = useVideoPlayer();
  const { lookupWord } = useDictionary();
  const containerRef   = useRef<HTMLDivElement>(null);
  const activeRef      = useRef<HTMLDivElement>(null);
  const lastScrolled   = useRef<number>(-1);

  const [toolbar, setToolbar] = useState<{
    phrase: string; sentence: string; position: { x: number; y: number };
  } | null>(null);

  // ── Auto-scroll active segment ─────────────────────────────────────────────
  useEffect(() => {
    const idx = playerState.current_segment;
    if (idx === lastScrolled.current) return;
    const el = activeRef.current;
    if (!el || !containerRef.current) return;
    lastScrolled.current = idx;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [playerState.current_segment]);

  // ── Native selection → SelectionToolbar ────────────────────────────────────
  // We allow full native text selection (select-text).
  // On selectionchange, if ≥2 words selected inside our container → toolbar.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let selTimer: ReturnType<typeof setTimeout> | null = null;

    const onSelChange = () => {
      // Debounce — fire after selection settles (100ms)
      if (selTimer) clearTimeout(selTimer);
      selTimer = setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || !sel.rangeCount) return;

        const text = sel.toString().trim().replace(/\s+/g, ' ');
        const wordCount = text.split(/\s+/).filter(Boolean).length;
        if (wordCount < 2) return;

        // Verify selection is inside our container
        const range = sel.getRangeAt(0);
        if (!container.contains(range.commonAncestorContainer)) return;

        const rect = range.getBoundingClientRect();
        if (!rect.width && !rect.height) return;

        const phrase = text.replace(/[.,!?;:""''«»]+$/, '').trim();
        if (!phrase) return;

        // Find sentence context from nearest segment
        let sentence = phrase;
        const node = range.startContainer;
        let el: HTMLElement | null = node.nodeType === 1
          ? node as HTMLElement
          : node.parentElement;
        while (el && el !== container) {
          if (el.dataset?.segText) { sentence = el.dataset.segText; break; }
          el = el.parentElement;
        }

        setToolbar({
          phrase,
          sentence,
          position: {
            x: rect.left + rect.width / 2,
            y: Math.max(80, rect.top - 8),
          },
        });
      }, 100);
    };

    document.addEventListener('selectionchange', onSelChange);
    return () => {
      document.removeEventListener('selectionchange', onSelChange);
      if (selTimer) clearTimeout(selTimer);
    };
  }, []);

  // Close toolbar + clear selection when tapping outside
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!toolbar) return;
      // If tapping inside toolbar — don't close
      const toolbarEl = document.querySelector('[data-selection-toolbar]');
      if (toolbarEl?.contains(e.target as Node)) return;
      setToolbar(null);
      window.getSelection()?.removeAllRanges();
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [toolbar]);

  // Word click: tap a single word → lookup
  // We detect the tapped word from the click event target
  const handleWordClick = useCallback((word: string, segText: string) => {
    // Clear any multi-word selection first
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) {
      // User just finished a selection — don't fire single word lookup
      return;
    }
    setToolbar(null);
    lookupWord(word, segText);
  }, [lookupWord]);

  const closeToolbar = useCallback(() => {
    setToolbar(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  if (transcriptStatus !== 'ready' || !transcript?.segments?.length) {
    return <StatusBanner />;
  }

  return (
    <div className="flex flex-col h-full" dir="ltr">
      <div className="flex items-center justify-between px-4 py-3 border-b border-line-s flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm">📝</span>
          <span className="text-sm font-semibold text-heading">Subtitles</span>
          <span className="text-xs text-faint bg-card px-2 py-0.5 rounded-full ml-1">
            {transcript.segments.length} lines
          </span>
          <span className="text-[10px] text-faint hidden sm:block">· tap = lookup · select = save phrase</span>
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
          transcript.source === 'youtube'
            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
            : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
        }`}>
          {transcript.source === 'youtube' ? '▶ YouTube' : '🤖 Whisper AI'}
        </span>
      </div>

      {/* select-text: allow native selection */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-3 py-3 space-y-1 scrollbar-thin select-text"
        dir="ltr"
      >
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
              onWordClick={handleWordClick}
              ref={isActive ? activeRef : undefined}
            />
          );
        })}
      </div>

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
  onWordClick: (word: string, segText: string) => void;
}>(({ segment, isActive, currentTime, fontSize, onSeek, onWordClick }, ref) => {
  const clean = (w: string) => w.replace(/[^\w'-]/g, '').trim();
  const font  = FONT_SIZE_CLASSES[fontSize] ?? FONT_SIZE_CLASSES.md;
  const activeWordIndex = getActiveWordIndex(segment.words || [], currentTime);

  // Handle click: detect which word was clicked from selection/click position
  const handleClick = useCallback((e: React.MouseEvent) => {
    // If user just completed a multi-word selection, don't fire single lookup
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && (sel.toString().trim().split(/\s+/).length >= 2)) {
      e.stopPropagation();
      return;
    }

    // Single word click: use caretRangeFromPoint or closest word
    const target = e.target as HTMLElement;
    let cur: HTMLElement | null = target;
    while (cur && cur !== e.currentTarget) {
      if (cur.dataset?.word) {
        e.stopPropagation();
        const w = cur.dataset.word;
        if (w) onWordClick(w, segment.text);
        return;
      }
      cur = cur.parentElement;
    }

    // Fallback: seek on segment click
    onSeek();
  }, [onSeek, onWordClick, segment.text]);

  return (
    <div
      ref={ref}
      dir="ltr"
      onClick={handleClick}
      data-seg-index={segment.index}
      data-seg-text={segment.text}
      className={`group relative rounded-xl px-3 py-2.5 cursor-pointer border ${
        isActive ? 'bg-blue-500/8 border-blue-500/20 shadow-sm' : 'border-transparent hover:bg-card/70 hover:border-line/50'
      }`}
    >
      {isActive && <div className="absolute left-0 top-2 bottom-2 w-[3px] bg-blue-500 rounded-full" />}

      {/* Continuous text — NOT flex-wrap — for smooth selection */}
      <p
        className={`leading-relaxed pl-1 ${font.row}`}
        style={{ direction: 'ltr', textAlign: 'left' }}
      >
        {segment.words && segment.words.length > 0
          ? segment.words.map((word, wi) => (
              <span
                key={wi}
                data-word={clean(word.word)}
                data-seg-text={segment.text}
                className={`${font.row} cursor-pointer rounded transition-colors ${
                  activeWordIndex === wi
                    ? 'text-blue-300 font-semibold underline decoration-blue-400 decoration-2 underline-offset-2'
                    : isActive
                    ? 'text-heading hover:text-blue-300'
                    : 'text-muted hover:text-heading'
                }`}
              >
                {word.word}{wi < segment.words!.length - 1 ? ' ' : ''}
              </span>
            ))
          : <span
              data-seg-text={segment.text}
              className={isActive ? 'text-heading' : 'text-muted'}
            >
              {segment.text}
            </span>
        }
      </p>

      <div className="mt-1.5 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className={`${font.meta} text-faint tabular-nums`}>
          {fmtTime(segment.start)} → {fmtTime(segment.end)}
        </span>
        <span className={`${font.meta} text-faint`}>
          {(segment.end - segment.start).toFixed(1)}s
        </span>
      </div>
    </div>
  );
}));
SegmentRow.displayName = 'SegmentRow';

function fmtTime(s: number): string {
  if (!s || !isFinite(s)) return '0:00';
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}
