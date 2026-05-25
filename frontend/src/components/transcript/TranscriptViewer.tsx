import React, { useRef, useEffect, memo } from 'react';
import { useStore } from '@/store/appStore';
import { useVideoPlayer } from '@/hooks/useVideoPlayer';
import { useDictionary } from '@/hooks/useDictionary';
import type { TranscriptSegment, WordTiming } from '@/types';
import { Button } from '@/components/ui/Button';

function StatusBanner() {
  const { transcriptStatus } = useStore();
  const { extractTranscript } = useVideoPlayer();
  if (transcriptStatus === 'idle') return (
    <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
      <span className="text-4xl mb-4">📝</span>
      <p className="text-slate-300 font-medium mb-1">No subtitles yet</p>
      <p className="text-slate-500 text-sm mb-5">Extract subtitles to start interactive learning</p>
      <Button onClick={extractTranscript} variant="primary">Extract Subtitles</Button>
    </div>
  );
  if (transcriptStatus === 'loading') return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="w-10 h-10 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin mb-4" />
      <p className="text-slate-300 font-medium">Extracting subtitles…</p>
    </div>
  );
  if (transcriptStatus === 'processing') return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="w-10 h-10 border-2 border-slate-700 border-t-purple-500 rounded-full animate-spin mb-4" />
      <p className="text-slate-300 font-medium">Transcribing with Whisper AI…</p>
      <p className="text-slate-500 text-sm mt-1">This may take a few minutes</p>
    </div>
  );
  if (transcriptStatus === 'error') return (
    <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
      <span className="text-4xl mb-4">⚠️</span>
      <p className="text-slate-300 font-medium mb-4">Subtitle extraction failed</p>
      <Button onClick={extractTranscript} variant="outline" size="sm">Try Again</Button>
    </div>
  );
  return null;
}

export default function TranscriptViewer() {
  const { transcript, playerState, currentTime, transcriptStatus } = useStore();
  const { seekTo } = useVideoPlayer();
  const { lookupWord } = useDictionary();
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeRef.current || !containerRef.current) return;
    const c = containerRef.current, el = activeRef.current;
    const cr = c.getBoundingClientRect(), er = el.getBoundingClientRect();
    if (er.top < cr.top + 80 || er.bottom > cr.bottom - 80) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [playerState.current_segment]);

  if (transcriptStatus !== 'ready' || !transcript?.segments?.length) return <StatusBanner />;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm">📝</span>
          <span className="text-sm font-semibold text-slate-200">Subtitles</span>
          <span className="text-xs text-slate-500 ml-1">{transcript.segments.length} lines</span>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full ${transcript.source === 'youtube' ? 'bg-blue-500/15 text-blue-400' : 'bg-purple-500/15 text-purple-400'}`}>
          {transcript.source === 'youtube' ? 'YouTube' : 'Whisper AI'}
        </span>
      </div>
      <div ref={containerRef} className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5 scrollbar-thin">
        {transcript.segments.map((seg) => (
          <SegRow key={seg.index} segment={seg}
            isActive={playerState.current_segment === seg.index}
            currentTime={currentTime}
            onSeek={() => seekTo(seg.start)}
            onWordClick={(w) => lookupWord(w, seg.text)}
            ref={playerState.current_segment === seg.index ? activeRef : undefined}
          />
        ))}
      </div>
      <CurrentLine />
    </div>
  );
}

const SegRow = memo(React.forwardRef<HTMLDivElement, {
  segment: TranscriptSegment; isActive: boolean; currentTime: number;
  onSeek: () => void; onWordClick: (w: string) => void;
}>(({ segment, isActive, currentTime, onSeek, onWordClick }, ref) => (
  <div ref={ref} onClick={onSeek}
    className={`group rounded-xl px-3 py-2.5 cursor-pointer transition-all duration-200 ${isActive ? 'bg-blue-500/12 border border-blue-500/25' : 'hover:bg-slate-800/60 border border-transparent'}`}>
    <div className="flex flex-wrap gap-x-1 gap-y-0.5 leading-relaxed">
      {segment.words?.length > 0 ? segment.words.map((word, wi) => (
        <WordTok key={wi} word={word} isCurrent={currentTime >= word.start && currentTime <= word.end}
          isActive={isActive} onClick={(e) => { e.stopPropagation(); onWordClick(word.word.replace(/[^\w']/g, '')); }} />
      )) : segment.text.split(' ').map((w, i) => (
        <span key={i} onClick={(e) => { e.stopPropagation(); onWordClick(w.replace(/[^\w']/g, '')); }}
          className={`cursor-pointer px-0.5 rounded transition-colors hover:text-blue-300 hover:bg-blue-500/15 ${isActive ? 'text-slate-100' : 'text-slate-400'}`}>
          {w}
        </span>
      ))}
    </div>
    <div className="mt-1 text-xs text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
      {fmt(segment.start)} → {fmt(segment.end)}
    </div>
  </div>
)));
SegRow.displayName = 'SegRow';

function WordTok({ word, isCurrent, isActive, onClick }: { word: WordTiming; isCurrent: boolean; isActive: boolean; onClick: (e: React.MouseEvent) => void }) {
  return (
    <span onClick={onClick}
      className={`relative inline-block cursor-pointer px-0.5 rounded transition-all duration-100 select-none ${
        isCurrent ? 'text-blue-300 font-semibold bg-blue-500/20' :
        isActive ? 'text-slate-200 hover:text-blue-300 hover:bg-blue-500/15' :
        'text-slate-500 hover:text-slate-300 hover:bg-slate-700/50'
      }`}>
      {word.word}
      {isCurrent && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-400 rounded-full" />}
    </span>
  );
}

function CurrentLine() {
  const { transcript, playerState, currentTime } = useStore();
  const seg = transcript?.segments?.find((s) => s.index === playerState.current_segment);
  if (!seg) return null;
  const pct = seg.duration > 0 ? Math.min(((currentTime - seg.start) / seg.duration) * 100, 100) : 0;
  return (
    <div className="border-t border-slate-800 px-4 py-3 bg-slate-900/50 flex-shrink-0">
      <p className="text-sm text-slate-200 text-center line-clamp-2 mb-2 min-h-[1.25rem]">{seg.text}</p>
      <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
        <div className="h-full bg-blue-500 rounded-full transition-all duration-100" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function fmt(s: number) {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}
