/**
 * TranscriptViewer — synchronized subtitles with custom word selection.
 *
 * Selection system (no native browser selection):
 *  - user-select: none on all text → no browser Copy/Share popup
 *  - Long press (500ms) on a word → starts custom selection mode
 *  - Drag to adjacent words → highlights word-by-word
 *  - Release → bottom-sheet SelectionToolbar appears
 *  - Single tap (< 500ms, no drag) → single word lookup (unchanged)
 */

import React, { useRef, useEffect, memo, useCallback, useState } from 'react';
import { useStore } from '@/store/appStore';
import { useVideoPlayer } from '@/hooks/useVideoPlayer';
import { useDictionary } from '@/hooks/useDictionary';
import type { TranscriptSegment, WordTiming, TranscriptFontSize } from '@/types';
import { Button } from '@/components/ui/Button';
import SelectionToolbar from '@/components/common/SelectionToolbar';
import PhraseInput from '@/components/common/PhraseInput';

const FONT_SIZE_CLASSES: Record<TranscriptFontSize, { row: string; current: string; meta: string }> = {
  sm: { row: 'text-sm',   current: 'text-sm',  meta: 'text-[11px]' },
  md: { row: 'text-base', current: 'text-sm',  meta: 'text-xs'     },
  lg: { row: 'text-lg',   current: 'text-base', meta: 'text-xs'    },
  xl: { row: 'text-xl',   current: 'text-lg',  meta: 'text-sm'     },
};

const LONG_PRESS_MS = 500;

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
      <p className="text-sm text-muted mb-5 max-w-xs leading-relaxed">Extract subtitles from YouTube captions.</p>
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

// ── Selection state ─────────────────────────────────────────────────────────

interface WordKey { segIndex: number; wordIndex: number; word: string; segText: string; }

export default function TranscriptViewer() {
  const { transcript, playerState, currentTime, transcriptStatus, transcriptFontSize, currentVideo } = useStore();
  const { seekTo }     = useVideoPlayer();
  const { lookupWord } = useDictionary();
  const containerRef   = useRef<HTMLDivElement>(null);
  const activeRef      = useRef<HTMLDivElement>(null);
  const lastScrolled   = useRef<number>(-1);

  // ── Custom selection state ─────────────────────────────────────────────────
  const [toolbar, setToolbar] = useState<{ phrase: string; sentence: string } | null>(null);

  // Selected word range
  const [selRange, setSelRange] = useState<{
    segIndex: number; lo: number; hi: number;
  } | null>(null);

  // Drag tracking (all in refs — no re-render during drag)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSelecting    = useRef(false);   // long-press fired
  const isTap          = useRef(true);    // no movement yet
  const startKey       = useRef<WordKey | null>(null);
  const currentSegIdx  = useRef(-1);
  const dragLo         = useRef(-1);
  const dragHi         = useRef(-1);
  const activePointerId = useRef(-1);

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    const idx = playerState.current_segment;
    if (idx === lastScrolled.current) return;
    const el = activeRef.current;
    if (!el || !containerRef.current) return;
    lastScrolled.current = idx;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [playerState.current_segment]);

  // ── Prevent any native selection globally on the transcript ───────────────
  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault();
    document.addEventListener('selectstart', prevent);
    return () => document.removeEventListener('selectstart', prevent);
  }, []);

  // ── Get word element under pointer ────────────────────────────────────────
  const getWordElAt = useCallback((x: number, y: number): HTMLElement | null => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    if (!el) return null;
    let cur: HTMLElement | null = el;
    while (cur && cur !== containerRef.current) {
      if (cur.dataset?.wordIndex !== undefined && cur.dataset?.segIndex !== undefined) return cur;
      cur = cur.parentElement;
    }
    return null;
  }, []);

  // ── Document-level pointer events (bypass stopPropagation) ─────────────────
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== activePointerId.current) return;
      if (!isSelecting.current) {
        // Check if moved before long press fired → cancel it
        const start = startKey.current;
        if (start && longPressTimer.current) {
          const el = getWordElAt(e.clientX, e.clientY);
          if (el) {
            const si = parseInt(el.dataset.segIndex || '-1', 10);
            const wi = parseInt(el.dataset.wordIndex || '-1', 10);
            // If moved to different word, cancel long press
            if (si !== start.segIndex || wi !== start.wordIndex) {
              clearTimeout(longPressTimer.current);
              longPressTimer.current = null;
              startKey.current = null;
            }
          }
        }
        return;
      }

      // With setPointerCapture, elementFromPoint still works using e.clientX/Y
      // Release capture temporarily to hit-test, then re-capture
      const captureEl = e.target as HTMLElement | null;
      if (captureEl?.releasePointerCapture) {
        try { captureEl.releasePointerCapture(e.pointerId); } catch {}
      }
      const el = getWordElAt(e.clientX, e.clientY);
      if (captureEl?.setPointerCapture) {
        try { captureEl.setPointerCapture(e.pointerId); } catch {}
      }

      if (!el) return;
      const si = parseInt(el.dataset.segIndex || '-1', 10);
      const wi = parseInt(el.dataset.wordIndex || '-1', 10);
      if (si < 0 || wi < 0) return;
      if (si !== currentSegIdx.current) return; // stay in same segment

      dragLo.current = Math.min(startKey.current?.wordIndex ?? wi, wi);
      dragHi.current = Math.max(startKey.current?.wordIndex ?? wi, wi);
      setSelRange({ segIndex: si, lo: dragLo.current, hi: dragHi.current });
    };

    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== activePointerId.current) return;
      activePointerId.current = -1;

      // Cancel pending long press
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }

      if (!isSelecting.current) {
        // Was a tap — single word lookup
        const start = startKey.current;
        startKey.current = null;
        if (start && isTap.current) {
          const clean = start.word.replace(/[^\w'-]/g, '').trim();
          if (clean.length >= 2) lookupWord(clean, start.segText);
        }
        return;
      }

      // End of selection drag
      isSelecting.current = false;
      const si  = currentSegIdx.current;
      const lo  = dragLo.current;
      const hi  = dragHi.current;
      const txt = startKey.current?.segText || '';
      startKey.current = null;

      if (si < 0 || lo < 0 || hi < 0) { setSelRange(null); return; }

      // Collect words from DOM
      const container = containerRef.current;
      if (!container) { setSelRange(null); return; }
      const spans = container.querySelectorAll<HTMLElement>(
        `[data-seg-index="${si}"][data-word-index]`
      );
      const words: string[] = [];
      spans.forEach(sp => {
        const wi = parseInt(sp.dataset.wordIndex || '-1', 10);
        if (wi >= lo && wi <= hi) words.push(sp.dataset.word || '');
      });
      const phrase = words.filter(Boolean).join(' ').replace(/[.,!?;:]+$/, '').trim();

      if (!phrase) { setSelRange(null); return; }

      setToolbar({ phrase, sentence: txt || phrase });
    };

    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerup',   onUp);
    document.addEventListener('pointercancel', onUp);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup',   onUp);
      document.removeEventListener('pointercancel', onUp);
    };
  }, [getWordElAt, lookupWord]);

  // ── Word pointer down (start of tap or long-press) ─────────────────────────
  const onWordDown = useCallback((
    e: React.PointerEvent,
    segIndex: number,
    wordIndex: number,
    word: string,
    segText: string
  ) => {
    // Do NOT stopPropagation — document listeners need the events
    e.preventDefault(); // prevent text selection only

    // Capture pointer on the element so pointermove/up reach document
    // even when finger moves to gaps between words
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}

    // Cancel previous
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    isSelecting.current  = false;
    isTap.current        = true;
    activePointerId.current = e.pointerId;
    startKey.current     = { segIndex, wordIndex, word, segText };
    dragLo.current       = wordIndex;
    dragHi.current       = wordIndex;
    currentSegIdx.current = segIndex;

    // Close existing toolbar
    setToolbar(null);
    setSelRange(null);

    // Start long-press timer
    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null;
      isSelecting.current   = true;
      isTap.current         = false;
      // Haptic feedback
      if ('vibrate' in navigator) navigator.vibrate(30);
      // Show initial single-word selection
      setSelRange({ segIndex, lo: wordIndex, hi: wordIndex });
    }, LONG_PRESS_MS);
  }, []);

  const closeToolbar = useCallback(() => {
    setToolbar(null);
    setSelRange(null);
    isSelecting.current = false;
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
          <span className="text-[10px] text-faint hidden sm:block">· tap = lookup · hold = select</span>
        </div>
        <div className="flex items-center gap-2">
          <PhraseInput videoId={currentVideo?.id} label="+ Phrase" />
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
            transcript.source === 'youtube'
              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
              : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
          }`}>
            {transcript.source === 'youtube' ? '▶ YouTube' : '🤖 Whisper AI'}
          </span>
        </div>
      </div>

      {/* transcript-words disables all native browser selection */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-3 py-3 space-y-1 scrollbar-thin transcript-words"
        dir="ltr"
        onContextMenu={e => e.preventDefault()}
      >
        {transcript.segments.map((seg) => {
          const isActive = playerState.current_segment === seg.index;
          const activeWordIdx = getActiveWordIndex(seg.words || [], currentTime);
          const font = FONT_SIZE_CLASSES[transcriptFontSize] ?? FONT_SIZE_CLASSES.md;
          const segSel = selRange?.segIndex === seg.index ? selRange : null;

          return (
            <div
              key={seg.index}
              ref={isActive ? activeRef : undefined}
              onClick={() => seekTo(seg.start)}
              dir="ltr"
              className={`group relative rounded-xl px-3 py-2.5 cursor-pointer border ${
                isActive ? 'bg-blue-500/8 border-blue-500/20 shadow-sm' : 'border-transparent hover:bg-card/70'
              }`}
            >
              {isActive && <div className="absolute left-0 top-2 bottom-2 w-[3px] bg-blue-500 rounded-full" />}

              <p className={`leading-relaxed pl-1 ${font.row}`} style={{ direction: 'ltr' }}>
                {seg.words && seg.words.length > 0
                  ? seg.words.map((word, wi) => {
                      const clean = word.word.replace(/[^\w'-]/g, '').trim();
                      const isSel = segSel ? wi >= segSel.lo && wi <= segSel.hi : false;
                      const isCur = activeWordIdx === wi;
                      return (
                        <span
                          key={wi}
                          className={`word-token ${isSel ? 'word-selected' : ''} ${font.row} inline cursor-pointer px-0.5 py-px transition-colors ${
                            isCur && !isSel
                              ? 'text-blue-300 font-semibold underline decoration-blue-400 decoration-2 underline-offset-2'
                              : !isSel && isActive
                              ? 'text-heading hover:text-blue-300'
                              : !isSel
                              ? 'text-muted hover:text-heading'
                              : ''
                          }`}
                          data-word={clean}
                          data-seg-index={seg.index}
                          data-word-index={wi}
                          data-seg-text={seg.text}
                          onPointerDown={e => onWordDown(e, seg.index, wi, clean, seg.text)}
                        >
                          {word.word}{wi < seg.words!.length - 1 ? ' ' : ''}
                        </span>
                      );
                    })
                  : (
                    <span
                      className={`word-token ${font.row} cursor-pointer ${isActive ? 'text-heading' : 'text-muted'}`}
                      data-word={seg.text}
                      data-seg-index={seg.index}
                      data-word-index={0}
                      data-seg-text={seg.text}
                      onPointerDown={e => onWordDown(e, seg.index, 0, seg.text, seg.text)}
                    >
                      {seg.text}
                    </span>
                  )
                }
              </p>

              <div className="mt-1.5 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className={`${font.meta} text-faint tabular-nums`}>
                  {fmtTime(seg.start)} → {fmtTime(seg.end)}
                </span>
                {segSel && segSel.hi > segSel.lo && (
                  <span className="text-[10px] text-blue-400 ml-1">
                    {segSel.hi - segSel.lo + 1} words
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {toolbar && (
        <SelectionToolbar
          phrase={toolbar.phrase}
          sentence={toolbar.sentence}
          onClose={closeToolbar}
          videoId={currentVideo?.id}
        />
      )}
    </div>
  );
}

function fmtTime(s: number): string {
  if (!s || !isFinite(s)) return '0:00';
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}
