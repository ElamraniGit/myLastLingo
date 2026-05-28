/**
 * TranscriptViewer — synchronized subtitles panel.
 * ALL text is LTR. dir="ltr" enforced on every container.
 * Click word → dictionary + auto-pause.
 * Click segment → seek.
 * Auto-scroll to active segment.
 */

import React, { useRef, useEffect, memo } from 'react';
import { useStore } from '@/store/appStore';
import { useVideoPlayer } from '@/hooks/useVideoPlayer';
import { useDictionary } from '@/hooks/useDictionary';
import type { TranscriptSegment, WordTiming, TranscriptFontSize } from '@/types';
import { Button } from '@/components/ui/Button';

const FONT_SIZE_CLASSES: Record<TranscriptFontSize, { row: string; current: string; meta: string }> = {
  sm: { row: 'text-sm', current: 'text-sm', meta: 'text-[11px]' },
  md: { row: 'text-base', current: 'text-sm', meta: 'text-xs' },
  lg: { row: 'text-lg', current: 'text-base', meta: 'text-xs' },
  xl: { row: 'text-xl', current: 'text-lg', meta: 'text-sm' },
};

function StatusBanner() {
  const { transcriptStatus } = useStore();
  const { extractTranscript } = useVideoPlayer();

  if (transcriptStatus === 'idle') return (
    <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center" dir="ltr">
      <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center mb-4 text-2xl">📝</div>
      <p className="text-base font-semibold text-slate-200 mb-1">No subtitles loaded</p>
      <p className="text-sm text-slate-500 mb-5 max-w-xs leading-relaxed">
        Extract subtitles from YouTube captions, or use local Whisper AI as fallback.
      </p>
      <Button onClick={extractTranscript} variant="primary">Extract Subtitles</Button>
    </div>
  );

  if (transcriptStatus === 'loading') return (
    <div className="flex flex-col items-center justify-center h-full py-16 text-center" dir="ltr">
      <div className="w-10 h-10 border-[3px] border-slate-700 border-t-blue-500 rounded-full animate-spin mb-5" />
      <p className="text-base font-semibold text-slate-200 mb-1">Fetching subtitles…</p>
      <p className="text-sm text-slate-500">Checking YouTube captions</p>
    </div>
  );

  if (transcriptStatus === 'processing') return (
    <div className="flex flex-col items-center justify-center h-full py-16 text-center px-6" dir="ltr">
      <div className="w-10 h-10 border-[3px] border-slate-700 border-t-purple-500 rounded-full animate-spin mb-5" />
      <p className="text-base font-semibold text-slate-200 mb-1">Transcribing with Whisper AI…</p>
      <p className="text-sm text-slate-500 max-w-xs leading-relaxed">
        No YouTube captions found — running local speech-to-text. This may take a few minutes.
      </p>
    </div>
  );

  if (transcriptStatus === 'error') return (
    <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center" dir="ltr">
      <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4 text-2xl">⚠️</div>
      <p className="text-base font-semibold text-slate-200 mb-1">Subtitle extraction failed</p>
      <p className="text-sm text-slate-500 mb-5 max-w-xs leading-relaxed">
        This video may not have captions. Install{' '}
        <code className="text-slate-400 bg-slate-800 px-1 rounded">faster-whisper</code>{' '}
        for local transcription.
      </p>
      <Button onClick={extractTranscript} variant="outline" size="sm">Try Again</Button>
    </div>
  );

  return null;
}

export default function TranscriptViewer() {
  const { transcript, playerState, currentTime, transcriptStatus, transcriptFontSize } = useStore();
  const { seekTo } = useVideoPlayer();
  const { lookupWord } = useDictionary();
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);
  const font = FONT_SIZE_CLASSES[transcriptFontSize] ?? FONT_SIZE_CLASSES.md;

  useEffect(() => {
    const el = activeRef.current;
    const container = containerRef.current;
    if (!el || !container) return;
    const cr = container.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    if (er.top < cr.top + 80 || er.bottom > cr.bottom - 80) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [playerState.current_segment]);

  if (transcriptStatus !== 'ready' || !transcript?.segments?.length) {
    return <StatusBanner />;
  }

  return (
    <div className="flex flex-col h-full" dir="ltr">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm leading-none">📝</span>
          <span className="text-sm font-semibold text-slate-200">Subtitles</span>
          <span className="text-xs text-slate-600 bg-slate-800 px-2 py-0.5 rounded-full ml-1">
            {transcript.segments.length} lines
          </span>
          <span className="text-xs text-slate-500">Font: {transcriptFontSize.toUpperCase()}</span>
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
          transcript.source === 'youtube'
            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
            : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
        }`}>
          {transcript.source === 'youtube' ? '▶ YouTube' : '🤖 Whisper AI'}
        </span>
      </div>

      {/* Segments */}
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
              ref={isActive ? activeRef : undefined}
            />
          );
        })}
      </div>

      {/* Current line bar */}
      <CurrentLineBar fontSize={transcriptFontSize} />
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
}>(({ segment, isActive, currentTime, fontSize, onSeek, onWordClick }, ref) => {
  const clean = (w: string) => w.replace(/[^\w'-]/g, '').trim();
  const font = FONT_SIZE_CLASSES[fontSize] ?? FONT_SIZE_CLASSES.md;

  return (
    <div
      ref={ref}
      onClick={onSeek}
      dir="ltr"
      className={`group relative rounded-xl px-3 py-2.5 cursor-pointer transition-all duration-200 border ${
        isActive
          ? 'bg-blue-500/8 border-blue-500/20 shadow-sm'
          : 'border-transparent hover:bg-slate-800/70 hover:border-slate-700/50'
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
                isCurrentWord={currentTime >= word.start && currentTime <= word.end}
                isActiveSentence={isActive}
                onClick={(e) => {
                  e.stopPropagation();
                  const w = clean(word.word);
                  if (w) onWordClick(w);
                }}
              />
            ))
          : segment.text.split(' ').map((w, i) => {
              const c = clean(w);
              return (
                <span
                  key={i}
                  onClick={(e) => { e.stopPropagation(); if (c) onWordClick(c); }}
                  style={{ direction: 'ltr', unicodeBidi: 'isolate' }}
                  className={`${font.row} cursor-pointer select-none px-0.5 rounded transition-colors duration-100 ${
                    isActive
                      ? 'text-slate-100 hover:text-blue-300 hover:bg-blue-500/15'
                      : 'text-slate-500 hover:text-slate-200 hover:bg-slate-700/60'
                  }`}
                >
                  {w}
                </span>
              );
            })}
      </div>

      <div className="mt-1.5 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <span className={`${font.meta} text-slate-600 tabular-nums`}>
          {fmtTime(segment.start)} → {fmtTime(segment.end)}
        </span>
        <span className={`${font.meta} text-slate-700`}>
          {(segment.end - segment.start).toFixed(1)}s
        </span>
      </div>
    </div>
  );
}));
SegmentRow.displayName = 'SegmentRow';

function WordToken({ word, fontSize, isCurrentWord, isActiveSentence, onClick }: {
  word: WordTiming;
  fontSize: TranscriptFontSize;
  isCurrentWord: boolean;
  isActiveSentence: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  const font = FONT_SIZE_CLASSES[fontSize] ?? FONT_SIZE_CLASSES.md;

  return (
    <span
      onClick={onClick}
      style={{ direction: 'ltr', unicodeBidi: 'isolate' }}
      className={`${font.row} relative inline-block cursor-pointer select-none px-0.5 py-px rounded transition-all duration-100 ${
        isCurrentWord
          ? 'text-blue-300 font-semibold bg-blue-500/20'
          : isActiveSentence
          ? 'text-slate-100 hover:text-blue-300 hover:bg-blue-500/15'
          : 'text-slate-500 hover:text-slate-200 hover:bg-slate-700/60'
      }`}
    >
      {word.word}
      {isCurrentWord && (
        <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-400 rounded-full" />
      )}
    </span>
  );
}

function CurrentLineBar({ fontSize }: { fontSize: TranscriptFontSize }) {
  const { transcript, playerState, currentTime } = useStore();
  const font = FONT_SIZE_CLASSES[fontSize] ?? FONT_SIZE_CLASSES.md;
  const seg = transcript?.segments?.find((s) => s.index === playerState.current_segment);
  if (!seg) return null;

  const pct = seg.duration > 0
    ? Math.min(((currentTime - seg.start) / seg.duration) * 100, 100)
    : 0;

  return (
    <div className="flex-shrink-0 border-t border-slate-800 px-4 pt-3 pb-4 bg-slate-900/60" dir="ltr">
      <p
        className={`${font.current} text-slate-200 text-center leading-relaxed line-clamp-2 mb-2.5 min-h-[1.25rem] font-medium`}
        style={{ direction: 'ltr', textAlign: 'center' }}
      >
        {seg.text}
      </p>
      <div className="h-[3px] bg-slate-800 rounded-full overflow-hidden">
        <div className="h-full bg-blue-500 rounded-full transition-all duration-100" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between mt-1.5">
        <span className={`${font.meta} text-slate-700 tabular-nums`}>{fmtTime(seg.start)}</span>
        <span className={`${font.meta} text-slate-700 tabular-nums`}>{fmtTime(seg.end)}</span>
      </div>
    </div>
  );
}

function fmtTime(s: number): string {
  if (!s || !isFinite(s)) return '0:00';
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}
