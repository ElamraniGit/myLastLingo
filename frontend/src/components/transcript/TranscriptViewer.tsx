/**
 * Synchronized transcript viewer with karaoke-style word highlighting.
 * Supports clicking any word for dictionary lookup.
 *
 * FIXES APPLIED:
 *  - Bug #12 fix: Reads `currentTime` and `currentSegmentIndex` from Zustand store
 *    instead of calling useVideoPlayer() again (which created a detached hook instance
 *    with its own stale currentTime=0).
 */

import React, { useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '@/store/appStore';
import { useDictionary } from '@/hooks/useDictionary';
import { useVideoPlayer } from '@/hooks/useVideoPlayer';
import type { TranscriptSegment, WordTiming } from '@/types';

export default function TranscriptViewer() {
  const { transcript, playerState, currentTime } = useAppStore();
  // Bug #12 fix: only use useVideoPlayer for seekTo and extractTranscript —
  // NOT for currentTime (which came from a separate hook state before).
  const { seekTo, extractTranscript } = useVideoPlayer();
  const { lookupWord } = useDictionary();
  const containerRef = useRef<HTMLDivElement>(null);
  const activeSegmentRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to current segment
  useEffect(() => {
    if (activeSegmentRef.current && containerRef.current) {
      const container = containerRef.current;
      const element = activeSegmentRef.current;
      const containerRect = container.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();

      if (
        elementRect.top < containerRect.top + 100 ||
        elementRect.bottom > containerRect.bottom - 100
      ) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [playerState.current_segment]);

  // If no transcript, show extract button
  if (!transcript?.segments?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
        <div className="text-5xl mb-2">📝</div>
        <p className="text-surface-400 text-lg">لم يتم استخراج النص بعد</p>
        <button
          onClick={() => extractTranscript(useAppStore.getState().currentVideo?.id || '')}
          className="btn-primary"
        >
          <span>🔍</span>
          استخراج النص
        </button>
        <p className="text-surface-500 text-sm max-w-xs">
          سيتم استخراج الترجمة من YouTube أو محليًا باستخدام Whisper
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-700/50">
        <h3 className="text-sm font-semibold text-surface-200 flex items-center gap-2">
          <span>📝</span>
          النص المتزامن
        </h3>
        <span className="badge badge-primary text-xs">
          {transcript.segments.length} جملة
        </span>
      </div>

      {/* Transcript container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-3 py-2 space-y-1 scrollbar-hide"
      >
        {transcript.segments.map((segment) => (
          <TranscriptSegmentItem
            key={segment.index}
            segment={segment}
            isActive={playerState.current_segment === segment.index}
            // Bug #12 fix: currentTime comes from Zustand store via parent
            currentTime={currentTime}
            onClick={() => seekTo(segment.start)}
            onWordClick={lookupWord}
            ref={playerState.current_segment === segment.index ? activeSegmentRef : undefined}
          />
        ))}
      </div>

      {/* Current line mini-display */}
      <CurrentLineBar
        segment={
          transcript.segments.find((s) => s.index === playerState.current_segment) || null
        }
        currentTime={currentTime}
      />
    </div>
  );
}

/* Individual transcript segment with karaoke words */
const TranscriptSegmentItem = React.forwardRef<
  HTMLDivElement,
  {
    segment: TranscriptSegment;
    isActive: boolean;
    currentTime: number;
    onClick: () => void;
    onWordClick: (word: string) => void;
  }
>(({ segment, isActive, currentTime, onClick, onWordClick }, ref) => {
  return (
    <div
      ref={ref}
      onClick={onClick}
      className={`
        group rounded-xl px-3 py-2.5 cursor-pointer transition-all duration-200
        ${isActive
          ? 'bg-primary-500/15 border border-primary-500/30'
          : 'hover:bg-surface-700/40 border border-transparent'
        }
      `}
    >
      <div className="flex flex-wrap gap-x-1 gap-y-0.5 leading-relaxed">
        {segment.words?.length > 0
          ? segment.words.map((word, wi) => (
              <WordSpan
                key={wi}
                word={word}
                isActive={currentTime >= word.start && currentTime <= word.end}
                isSentenceActive={isActive}
                onClick={(e) => {
                  e.stopPropagation();
                  onWordClick(word.word.replace(/[.,!?;:'"()[\]]/g, ''));
                }}
              />
            ))
          : segment.text.split(' ').map((w, i) => (
              <span
                key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  onWordClick(w.replace(/[.,!?;:'"()[\]]/g, ''));
                }}
                className="transcript-word text-surface-200 hover:text-primary-300 hover:bg-primary-500/20 rounded px-0.5 cursor-pointer"
              >
                {w}
              </span>
            ))}
      </div>

      {/* Timestamp */}
      <div className="mt-1 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-xs text-surface-500">
          {formatTimestamp(segment.start)} → {formatTimestamp(segment.end)}
        </span>
      </div>
    </div>
  );
});

TranscriptSegmentItem.displayName = 'TranscriptSegmentItem';

/* Individual word with karaoke highlighting */
function WordSpan({
  word,
  isActive,
  isSentenceActive,
  onClick,
}: {
  word: WordTiming;
  isActive: boolean;
  isSentenceActive: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <span
      onClick={onClick}
      className={`
        transcript-word relative inline-block px-0.5 py-0 rounded cursor-pointer
        transition-all duration-150 select-none
        ${isActive
          ? 'text-primary-300 font-semibold bg-primary-500/25'
          : isSentenceActive
          ? 'text-surface-100'
          : 'text-surface-400 hover:text-surface-200'
        }
      `}
    >
      {word.word}
      {/* Karaoke underline animation for active word */}
      {isActive && (
        <span
          className="absolute bottom-0 left-0 h-0.5 bg-primary-400 rounded-full"
          style={{ width: '100%' }}
        />
      )}
    </span>
  );
}

/* Current line floating bar at bottom */
function CurrentLineBar({
  segment,
  currentTime,
}: {
  segment: TranscriptSegment | null;
  currentTime: number;
}) {
  if (!segment) return null;

  const progress =
    segment.duration > 0
      ? Math.min(((currentTime - segment.start) / segment.duration) * 100, 100)
      : 0;

  return (
    <div className="border-t border-surface-700/50 px-4 py-3 bg-surface-800/80">
      <div className="text-sm text-surface-200 text-center mb-2 line-clamp-2">
        {segment.text}
      </div>
      {/* Progress bar */}
      <div className="h-1 bg-surface-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary-500 rounded-full transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

function formatTimestamp(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
