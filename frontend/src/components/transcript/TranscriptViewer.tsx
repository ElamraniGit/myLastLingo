/**
 * TranscriptViewer — v5 (rebuilt from scratch)
 *
 * Design goals:
 *  ① Video sync  — active word highlighted; active segment scrolls into view
 *  ② Single tap  — opens WordPopup for that word
 *  ③ Long-press (500ms) + drag → custom word-range selection → bottom toolbar
 *  ④ No native browser selection → user-select:none → no browser popup
 *
 * KEY INSIGHT: onTouchMove is on the CONTAINER div, not individual spans.
 *   This ensures touchmove ALWAYS fires regardless of which element is
 *   under the finger during drag. Individual span handlers only capture
 *   the initial touchstart.
 */

import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { useStore } from '@/store/appStore';
import { useVideoPlayer } from '@/hooks/useVideoPlayer';
import { useDictionary } from '@/hooks/useDictionary';
import type { TranscriptSegment, WordTiming, TranscriptFontSize } from '@/types';
import { buildSavedMatchMap } from '@/lib/savedWordMatching';
import { Button } from '@/components/ui/Button';
import SelectionToolbar from '@/components/common/SelectionToolbar';

const FS: Record<TranscriptFontSize, string> = {
  sm: 'text-sm', md: 'text-base', lg: 'text-lg', xl: 'text-xl',
};
const FM: Record<TranscriptFontSize, string> = {
  sm: 'text-xs', md: 'text-xs', lg: 'text-xs', xl: 'text-sm',
};

function fmtTime(s: number): string {
  if (!s || !isFinite(s)) return '0:00';
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function getActiveWordIndex(words: WordTiming[], t: number): number {
  if (!words?.length) return -1;
  const ct = t + 0.08;
  const exact = words.findIndex(w => ct >= w.start && ct <= w.end + 0.08);
  if (exact >= 0) return exact;
  let best = -1, bd = 0.2;
  for (let i = 0; i < words.length; i++) {
    const d = Math.min(Math.abs(ct - words[i].start), Math.abs(ct - words[i].end));
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

function wordElAt(x: number, y: number, container: HTMLElement): HTMLElement | null {
  const hit = (px: number, py: number): HTMLElement | null => {
    const el = document.elementFromPoint(px, py) as HTMLElement | null;
    if (!el) return null;
    let cur: HTMLElement | null = el;
    while (cur && cur !== container) {
      if (cur.dataset?.wi !== undefined) return cur;
      cur = cur.parentElement;
    }
    return null;
  };
  return (
    hit(x, y) ||
    hit(x - 15, y) || hit(x + 15, y) ||
    hit(x - 30, y) || hit(x + 30, y) ||
    hit(x, y - 8)  || hit(x, y + 8)  ||
    null
  );
}

function StatusBanner() {
  const { transcriptStatus } = useStore();
  const { extractTranscript } = useVideoPlayer();
  if (transcriptStatus === 'idle') return (
    <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center">
      <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-blue-500/10 flex items-center justify-center"><svg className="w-7 h-7 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></div>
      <p className="text-base font-semibold text-heading mb-2">No subtitles yet</p>
      <p className="text-sm text-muted mb-5 max-w-xs">Extract from YouTube captions or transcribe with Whisper AI.</p>
      <Button onClick={extractTranscript} variant="primary">Extract Subtitles</Button>
    </div>
  );
  if (transcriptStatus === 'loading') return (
    <div className="flex flex-col items-center justify-center h-full py-16 text-center">
      <div className="w-10 h-10 border-[3px] border-line border-t-blue-500 rounded-full animate-spin mb-4" />
      <p className="text-sm font-semibold text-heading">Fetching subtitles…</p>
    </div>
  );
  if (transcriptStatus === 'processing') return (
    <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center">
      <div className="w-10 h-10 border-[3px] border-line border-t-purple-500 rounded-full animate-spin mb-4" />
      <p className="text-sm font-semibold text-heading">Transcribing with Whisper AI…</p>
    </div>
  );
  if (transcriptStatus === 'error') return (
    <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center">
      <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-amber-500/10 flex items-center justify-center"><svg className="w-7 h-7 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="2.5"/></svg></div>
      <p className="text-sm font-semibold text-heading mb-2">Extraction failed</p>
      <Button onClick={extractTranscript} variant="outline" size="sm">Try Again</Button>
    </div>
  );
  return null;
}

interface SelRange { si: number; lo: number; hi: number; }

export default function TranscriptViewer() {
  const { transcript, playerState, currentTime, transcriptStatus, transcriptFontSize, currentVideo, savedWords } = useStore();
  const { seekTo }     = useVideoPlayer();
  const { lookupWord } = useDictionary();
  const scrollRef  = useRef<HTMLDivElement>(null);
  const activeRef  = useRef<HTMLDivElement>(null);
  const lastSeg    = useRef(-1);

  // Drag state (refs = no re-render during drag)
  const lpTimer       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selecting     = useRef(false);
  const wasTap        = useRef(true);
  const startSI       = useRef(-1);
  const startWI       = useRef(-1);
  const startWord     = useRef('');
  const startSentence = useRef('');
  const dragLo        = useRef(-1);
  const dragHi        = useRef(-1);

  // React state
  const [selRange, setSelRange] = useState<SelRange | null>(null);
  const [toolbar,  setToolbar]  = useState<{ phrase: string; sentence: string } | null>(null);

  const savedMatchBySegment = useMemo(() => {
    return (transcript?.segments ?? []).map(seg => {
      const displayWords = (seg.words?.length ? seg.words.map(w => w.word) : seg.text.split(' '));
      return buildSavedMatchMap(displayWords, savedWords);
    });
  }, [transcript?.segments, savedWords]);

  // Auto-scroll
  useEffect(() => {
    const idx = playerState.current_segment;
    if (idx === lastSeg.current) return;
    lastSeg.current = idx;
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [playerState.current_segment]);

  // Block native selection
  useEffect(() => {
    const block = (e: Event) => e.preventDefault();
    document.addEventListener('selectstart', block);
    return () => document.removeEventListener('selectstart', block);
  }, []);

  // Close toolbar on outside tap
  useEffect(() => {
    if (!toolbar) return;
    const onDown = (e: TouchEvent) => {
      const tb = document.querySelector('[data-selection-toolbar]');
      if (tb?.contains(e.target as Node)) return;
      setToolbar(null);
      setSelRange(null);
    };
    document.addEventListener('touchstart', onDown, { passive: true });
    return () => document.removeEventListener('touchstart', onDown);
  }, [toolbar]);

  const cancelLP = useCallback(() => {
    if (lpTimer.current) { clearTimeout(lpTimer.current); lpTimer.current = null; }
  }, []);

  const resetDrag = useCallback(() => {
    selecting.current = false;
    wasTap.current    = true;
    startSI.current   = -1;
    startWI.current   = -1;
    startWord.current = '';
    startSentence.current = '';
    dragLo.current    = -1;
    dragHi.current    = -1;
  }, []);

  // touchstart on a word — starts long-press timer
  const onWordTouchStart = useCallback((
    e: React.TouchEvent, si: number, wi: number, word: string, sentence: string,
  ) => {
    e.stopPropagation(); // prevent row onClick (seek) on tap
    // No preventDefault → allow scroll if long-press doesn't fire
    cancelLP();
    resetDrag();
    startSI.current = si;
    startWI.current = wi;
    startWord.current = word;
    startSentence.current = sentence;
    dragLo.current = wi;
    dragHi.current = wi;
    setToolbar(null);
    setSelRange(null);

    lpTimer.current = setTimeout(() => {
      lpTimer.current   = null;
      selecting.current = true;
      wasTap.current    = false;
      if ('vibrate' in navigator) navigator.vibrate(40);
      setSelRange({ si, lo: wi, hi: wi });
    }, 500);
  }, [cancelLP, resetDrag]);

  // touchmove on CONTAINER — extends selection
  const onScrollTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!selecting.current) {
      // Cancel long-press if user scrolls
      if (lpTimer.current) { cancelLP(); }
      return;
    }
    e.preventDefault(); // prevent scroll while selecting
    const container = scrollRef.current;
    if (!container) return;
    const el = wordElAt(touch.clientX, touch.clientY, container);
    if (!el) return;
    const curSI = parseInt(el.dataset.si ?? '-1', 10);
    const curWI = parseInt(el.dataset.wi ?? '-1', 10);
    if (curSI < 0 || curWI < 0 || curSI !== startSI.current) return;
    const lo = Math.min(startWI.current, curWI);
    const hi = Math.max(startWI.current, curWI);
    if (lo !== dragLo.current || hi !== dragHi.current) {
      dragLo.current = lo;
      dragHi.current = hi;
      setSelRange({ si: curSI, lo, hi });
    }
  }, [cancelLP]);

  // touchend on CONTAINER — tap or show toolbar
  const onScrollTouchEnd = useCallback(() => {
    const pending = !!lpTimer.current;
    cancelLP();
    if (!selecting.current) {
      if (pending && startWord.current) {
        const clean = startWord.current.replace(/[^\w'-]/g, '').trim();
        if (clean.length >= 2) lookupWord(clean, startSentence.current);
      }
      resetDrag();
      return;
    }
    const si  = startSI.current;
    const lo  = dragLo.current;
    const hi  = dragHi.current;
    const ctx = startSentence.current;
    resetDrag();
    if (si < 0 || lo < 0 || hi < lo) { setSelRange(null); return; }

    const container = scrollRef.current;
    if (!container) { setSelRange(null); return; }
    const spans = container.querySelectorAll<HTMLElement>(`[data-si="${si}"][data-wi]`);
    const words: string[] = [];
    spans.forEach(sp => {
      const wi = parseInt(sp.dataset.wi ?? '-1', 10);
      if (wi >= lo && wi <= hi) words.push(sp.dataset.word ?? '');
    });
    const phrase = words.filter(Boolean).join(' ').replace(/[.,!?;:""\''«»]+$/, '').trim();
    if (!phrase) { setSelRange(null); return; }
    // Re-apply the final range explicitly so the visual highlight persists after
    // touchend until the toolbar is dismissed.
    setSelRange({ si, lo, hi });
    setToolbar({ phrase, sentence: ctx || phrase });
  }, [cancelLP, resetDrag, lookupWord]);

  const closeToolbar = useCallback(() => {
    setToolbar(null);
    setSelRange(null);
    selecting.current = false;
  }, []);

  if (transcriptStatus !== 'ready' || !transcript?.segments?.length) {
    return <StatusBanner />;
  }

  const fs = FS[transcriptFontSize] ?? FS.md;
  const fm = FM[transcriptFontSize] ?? FM.md;

  return (
    <div className="flex flex-col h-full" dir="ltr">
      <div className="flex items-center justify-between px-4 py-3 border-b border-line-s shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <svg className="w-4 h-4 shrink-0 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>
          <span className="text-sm font-semibold text-heading shrink-0">Subtitles</span>
          <span className="text-xs text-faint bg-card px-2 py-0.5 rounded-full shrink-0">{transcript.segments.length}</span>
          <span className="text-xs text-faint truncate hidden sm:block">tap · hold &amp; drag</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-medium px-2 py-1 rounded-full shrink-0 ${transcript.source === 'youtube' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'}`}>
            {transcript.source === 'youtube' ? 'YT' : 'AI'}
          </span>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-3 space-y-1 scrollbar-thin"
        dir="ltr"
        style={{ WebkitUserSelect: 'none', userSelect: 'none' } as React.CSSProperties}
        onContextMenu={e => e.preventDefault()}
        onTouchMove={onScrollTouchMove}
        onTouchEnd={onScrollTouchEnd}
        onTouchCancel={onScrollTouchEnd}
      >
        {transcript.segments.map((seg, segListIndex) => {
          const isActive   = playerState.current_segment === seg.index;
          const activeWord = getActiveWordIndex(seg.words ?? [], currentTime);
          const segSel     = selRange?.si === seg.index ? selRange : null;
          const savedMatch = savedMatchBySegment[segListIndex];

          return (
            <div
              key={seg.index}
              ref={isActive ? activeRef : undefined}
              dir="ltr"
              onClick={() => seekTo(seg.start)}
              className={`group relative rounded-xl px-3 py-2.5 cursor-pointer border transition-colors ${isActive ? 'bg-blue-500/8 border-blue-500/20 shadow-sm' : 'border-transparent hover:bg-card/70 hover:border-line/50'}`}
            >
              {isActive && <div className="absolute left-0 top-2 bottom-2 w-[3px] bg-blue-500 rounded-full" />}
              <p className={`${fs} leading-loose pl-1`} style={{ direction: 'ltr', textAlign: 'left' }}>
                {(seg.words?.length ? seg.words : seg.text.split(' ').map(w => ({ word: w } as WordTiming))).map((wt, wi) => {
                  const word  = typeof wt === 'object' ? wt.word : wt;
                  const clean = word.replace(/[^\w'-]/g, '').trim();
                  const isSel = segSel ? wi >= segSel.lo && wi <= segSel.hi : false;
                  const isCur = seg.words?.length ? activeWord === wi : false;
                  const isSavedPhrase = !!savedMatch?.phraseIndexes.has(wi);
                  const isSavedWord = !!savedMatch?.singleWordIndexes.has(wi);
                  return (
                    <React.Fragment key={wi}>
                      <span
                        data-si={seg.index}
                        data-wi={wi}
                        data-word={clean}
                        onTouchStart={e => onWordTouchStart(e, seg.index, wi, clean, seg.text)}
                        className={[
                          fs, 'inline cursor-pointer rounded px-0.5 py-px transition-colors select-none',
                          isSel ? 'bg-blue-500/35 text-blue-100 font-semibold'
                          : isCur ? 'bg-blue-500/20 text-blue-300 font-semibold underline decoration-blue-400 decoration-2 underline-offset-2'
                          : isSavedPhrase ? 'bg-green-500/20 text-green-300 font-semibold ring-1 ring-green-500/20'
                          : isSavedWord ? 'text-green-400 font-medium underline decoration-green-500/40 decoration-2 underline-offset-2'
                          : isActive ? 'text-heading hover:bg-blue-500/10 hover:text-blue-300'
                          : 'text-muted hover:bg-elevated hover:text-heading',
                        ].join(' ')}
                      >{word}</span>
                      {wi < (seg.words?.length ?? seg.text.split(' ').length) - 1 ? ' ' : ''}
                    </React.Fragment>
                  );
                })}
              </p>
              <div className="mt-1 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className={`${fm} text-faint tabular-nums text-sm`}>{fmtTime(seg.start)} → {fmtTime(seg.end)}</span>
                <span className={`${fm} text-faint`}>{(seg.end - seg.start).toFixed(1)}s</span>
                {segSel && segSel.hi > segSel.lo && (
                  <span className={`${fm} text-blue-400 ml-1`}>{segSel.hi - segSel.lo + 1} words</span>
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
