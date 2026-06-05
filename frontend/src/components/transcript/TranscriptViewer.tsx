/**
 * TranscriptViewer — synchronized subtitles panel.
 *
 * Interactions:
 *  - Tap a word     → dictionary popup (single word)
 *  - Drag ≥10px     → multi-word selection → SelectionToolbar
 *
 * Selection uses document-level pointermove/pointerup listeners
 * so events arrive regardless of which child is under the finger.
 * Context menu is blocked to prevent the browser popup.
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
        No YouTube captions found — running local speech-to-text.
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
  const { seekTo }    = useVideoPlayer();
  const { lookupWord } = useDictionary();
  const containerRef   = useRef<HTMLDivElement>(null);
  const activeRef      = useRef<HTMLDivElement>(null);
  const lastScrolled   = useRef<number>(-1);

  // ── Toolbar state ──────────────────────────────────────────────────────────
  const [toolbar, setToolbar] = useState<{
    phrase: string; sentence: string; position: { x: number; y: number };
  } | null>(null);
  const [selHighlight, setSelHighlight] = useState<{
    segIndex: number; lo: number; hi: number;
  } | null>(null);

  // ── Drag refs (not state — no re-render during drag) ───────────────────────
  const ptrStart      = useRef<{ x: number; y: number; id: number } | null>(null);
  const dragging      = useRef(false);
  const dragStartSeg  = useRef(-1);   // segment at pointer-down (fixed)
  const dragStartWi   = useRef(-1);   // word index at pointer-down (fixed)
  const dragSeg       = useRef(-1);
  const dragLo        = useRef(-1);
  const dragHi        = useRef(-1);
  const dragTxt       = useRef('');

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    const idx = playerState.current_segment;
    if (idx === lastScrolled.current) return;
    const el = activeRef.current;
    if (!el || !containerRef.current) return;
    lastScrolled.current = idx;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [playerState.current_segment]);

  // ── Helper: find word span under a point ───────────────────────────────────
  const getWordEl = useCallback((x: number, y: number): HTMLElement | null => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    if (!el || !containerRef.current) return null;
    let cur: HTMLElement | null = el;
    while (cur && cur !== containerRef.current) {
      if (cur.dataset?.wordIndex !== undefined) return cur;
      cur = cur.parentElement;
    }
    return null;
  }, []);

  // ── Document-level listeners (bypass child stopPropagation) ───────────────
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!ptrStart.current || e.pointerId !== ptrStart.current.id) return;
      const dx = e.clientX - ptrStart.current.x;
      const dy = e.clientY - ptrStart.current.y;

      if (!dragging.current) {
        if (Math.sqrt(dx*dx + dy*dy) < 8) return;
        dragging.current = true;
        // Capture start word index ONCE when drag begins
        const startEl = getWordEl(ptrStart.current.x, ptrStart.current.y);
        if (startEl) {
          dragStartSeg.current = parseInt(startEl.dataset.segIndex  || '-1', 10);
          dragStartWi.current  = parseInt(startEl.dataset.wordIndex || '-1', 10);
          dragSeg.current      = dragStartSeg.current;
          dragTxt.current      = startEl.dataset.segText || '';
        }
      }

      if (dragStartWi.current < 0 || dragStartSeg.current < 0) return;

      const el = getWordEl(e.clientX, e.clientY);
      if (!el) return;
      const si = parseInt(el.dataset.segIndex  || '-1', 10);
      const wi = parseInt(el.dataset.wordIndex || '-1', 10);
      if (wi < 0 || si !== dragStartSeg.current) return;

      // lo = min(start, current), hi = max(start, current)
      dragLo.current = Math.min(dragStartWi.current, wi);
      dragHi.current = Math.max(dragStartWi.current, wi);
      if (el.dataset.segText) dragTxt.current = el.dataset.segText;

      setSelHighlight({ segIndex: si, lo: dragLo.current, hi: dragHi.current });
    };

    const onUp = (e: PointerEvent) => {
      if (!ptrStart.current || e.pointerId !== ptrStart.current.id) return;
      const wasDrag = dragging.current;
      const si      = dragSeg.current;
      const lo      = dragLo.current;
      const hi      = dragHi.current;
      const txt     = dragTxt.current;

      // Reset all drag state FIRST
      ptrStart.current     = null;
      dragging.current     = false;
      dragStartSeg.current = -1;
      dragStartWi.current  = -1;
      dragSeg.current      = -1;
      dragLo.current       = -1;
      dragHi.current       = -1;
      dragTxt.current      = '';
      setSelHighlight(null);

      if (!wasDrag || si < 0 || lo < 0 || hi - lo < 1) return;

      const container = containerRef.current;
      if (!container) return;
      const spans = container.querySelectorAll<HTMLElement>(
        `[data-seg-index="${si}"][data-word-index]`
      );
      const words: string[] = [];
      spans.forEach(sp => {
        const wi2 = parseInt(sp.dataset.wordIndex || '-1', 10);
        if (wi2 >= lo && wi2 <= hi) words.push(sp.dataset.word || '');
      });
      const phrase = words.filter(Boolean).join(' ')
        .replace(/[.,!?;:“”‘’\s]+$/, '').trim();
      if (!phrase || words.length < 2) return;

      const cr = container.getBoundingClientRect();
      setToolbar({
        phrase,
        sentence: txt || phrase,
        position: { x: cr.left + cr.width / 2, y: Math.max(80, e.clientY - 60) },
      });
    };

    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerup',   onUp);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup',   onUp);
    };
  }, [getWordEl]);

  // Block context menu on the container (prevent browser Copy/Share popup)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const block = (e: Event) => e.preventDefault();
    el.addEventListener('contextmenu', block);
    return () => el.removeEventListener('contextmenu', block);
  }, []);

  const handleWordClick = useCallback((word: string, segText: string) => {
    if (dragging.current) return;
    setToolbar(null);
    lookupWord(word, segText);
  }, [lookupWord]);

  const closeToolbar = useCallback(() => { setToolbar(null); }, []);

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
          <span className="text-[10px] text-faint hidden sm:block">· tap = lookup · drag = select phrase</span>
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
        onPointerDown={e => {
          if (e.pointerType === 'mouse' && e.button !== 0) return;
          if (!containerRef.current?.contains(e.target as Node)) return;
          ptrStart.current   = { x: e.clientX, y: e.clientY, id: e.pointerId };
          dragging.current   = false;
          dragSeg.current    = -1; dragLo.current = -1; dragHi.current = -1;
          dragTxt.current    = '';
          setSelHighlight(null);
          setToolbar(null);
        }}
      >
        {transcript.segments.map((seg) => {
          const isActive  = playerState.current_segment === seg.index;
          const highlight = selHighlight?.segIndex === seg.index ? selHighlight : null;
          return (
            <SegmentRow
              key={seg.index}
              segment={seg}
              isActive={isActive}
              currentTime={currentTime}
              fontSize={transcriptFontSize}
              onSeek={() => seekTo(seg.start)}
              onWordClick={(word) => handleWordClick(word, seg.text)}
              highlightLo={highlight?.lo ?? -1}
              highlightHi={highlight?.hi ?? -1}
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
  onWordClick: (word: string) => void;
  highlightLo: number;
  highlightHi: number;
}>(({ segment, isActive, currentTime, fontSize, onSeek, onWordClick, highlightLo, highlightHi }, ref) => {
  const clean = (w: string) => w.replace(/[^\w'-]/g, '').trim();
  const font  = FONT_SIZE_CLASSES[fontSize] ?? FONT_SIZE_CLASSES.md;
  const activeWordIndex = getActiveWordIndex(segment.words || [], currentTime);

  const isHL = (wi: number) => highlightLo >= 0 && wi >= highlightLo && wi <= highlightHi;

  return (
    <div
      ref={ref}
      onClick={onSeek}
      dir="ltr"
      className={`group relative rounded-xl px-3 py-2.5 cursor-pointer border ${
        isActive ? 'bg-blue-500/8 border-blue-500/20 shadow-sm' : 'border-transparent hover:bg-card/70 hover:border-line/50'
      }`}
    >
      {isActive && <div className="absolute left-0 top-2 bottom-2 w-[3px] bg-blue-500 rounded-full" />}
      <div className={`flex flex-wrap gap-x-1 gap-y-1 leading-relaxed pl-1 ${font.row}`} style={{ direction: 'ltr', textAlign: 'left' }}>
        {segment.words && segment.words.length > 0
          ? segment.words.map((word, wi) => (
              <span
                key={wi}
                data-word={clean(word.word)}
                data-seg-index={segment.index}
                data-word-index={wi}
                data-seg-text={segment.text}
                onClick={e => { e.stopPropagation(); const w = clean(word.word); if (w) onWordClick(w); }}
                style={{ direction: 'ltr', unicodeBidi: 'isolate' }}
                className={`${font.row} relative inline-block cursor-pointer px-0.5 py-px rounded transition-colors ${
                  isHL(wi) ? 'bg-amber-400/30 text-amber-300 font-semibold'
                  : activeWordIndex === wi ? 'text-blue-300 font-semibold bg-blue-500/20'
                  : isActive ? 'text-heading hover:text-blue-300 hover:bg-blue-500/15'
                  : 'text-muted hover:text-heading hover:bg-elevated/60'
                }`}
              >
                {word.word}
                {activeWordIndex === wi && !isHL(wi) && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-400 rounded-full" />
                )}
              </span>
            ))
          : segment.text.split(' ').map((w, i) => {
              const c = clean(w);
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
                    isHL(i) ? 'bg-amber-400/30 text-amber-300'
                    : isActive ? 'text-heading hover:text-blue-300 hover:bg-blue-500/15'
                    : 'text-muted hover:text-heading hover:bg-elevated/60'
                  }`}
                >
                  {w}
                </span>
              );
            })}
      </div>
      <div className="mt-1.5 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className={`${font.meta} text-faint tabular-nums`}>{fmtTime(segment.start)} → {fmtTime(segment.end)}</span>
        <span className={`${font.meta} text-faint`}>{(segment.end - segment.start).toFixed(1)}s</span>
        {highlightLo >= 0 && highlightHi > highlightLo && (
          <span className="text-[10px] text-amber-400 ml-1">{highlightHi - highlightLo + 1} words selected</span>
        )}
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
