/**
 * Synchronized transcript viewer with karaoke-style word highlighting.
 * Supports click on any word for dictionary lookup.
 */

import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiPlay, HiBookOpen, HiTranslate } from 'react-icons/hi';
import { useAppStore } from '@/store/appStore';
import { useVideoPlayer } from '@/hooks/useVideoPlayer';
import { useDictionary } from '@/hooks/useDictionary';
import type { TranscriptSegment, WordTiming } from '@/types';

export default function TranscriptViewer() {
  const { transcript, playerState } = useAppStore();
  const { currentTime, seekTo, extractTranscript } = useVideoPlayer();
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
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }
  }, [playerState.current_segment]);

  // If no transcript, show extract button
  if (!transcript?.segments?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="w-16 h-16 rounded-full bg-surface-700/50 flex items-center justify-center">
          <HiTranslate className="w-8 h-8 text-surface-400" />
        </div>
        <p className="text-surface-400 text-center">لم يتم استخراج النص بعد</p>
        <button
          onClick={() => extractTranscript(useAppStore.getState().currentVideo?.id || '')}
          className="btn-primary"
        >
          <HiPlay className="w-4 h-4" />
          استخراج النص
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-surface-200">النص المتزامن</h3>
        <span className="text-xs text-surface-400">
          {transcript.segments.length} جملة
        </span>
      </div>

      {/* Transcript container */}
      <div
        ref={containerRef}
        className="space-y-1 max-h-[60vh] overflow-y-auto scrollbar-hide px-2"
      >
        <AnimatePresence>
          {transcript.segments.map((segment, idx) => (
            <TranscriptSegmentItem
              key={segment.index || idx}
              segment={segment}
              isActive={playerState.current_segment === segment.index}
              currentTime={currentTime}
              onClick={() => seekTo(segment.start)}
              onWordClick={lookupWord}
              ref={playerState.current_segment === segment.index ? activeSegmentRef : undefined}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Current line mini-player */}
      <CurrentLineBar
        segment={transcript.segments.find(s => s.index === playerState.current_segment) || null}
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
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{
        opacity: 1,
        x: 0,
        scale: isActive ? 1 : 0.98,
      }}
      transition={{ duration: 0.2 }}
      className={`p-3 rounded-xl cursor-pointer transition-all duration-200 ${
        isActive
          ? 'bg-primary-500/10 border-r-2 border-primary-500 shadow-sm'
          : 'hover:bg-surface-700/30 border-r-2 border-transparent'
      }`}
      onClick={onClick}
      dir="rtl"
    >
      <p className={`leading-relaxed ${isActive ? 'text-surface-100' : 'text-surface-300'}`}>
        {segment.words?.length > 0
          ? segment.words.map((word, wi) => (
              <WordSpan
                key={wi}
                word={word}
                isActive={isActive && currentTime >= word.start && currentTime <= word.end}
                isSentenceActive={isActive}
                onClick={(e) => {
                  e.stopPropagation();
                  onWordClick(word.word.replace(/[.,!?;:'"]/g, ''));
                }}
              />
            ))
          : segment.text.split(' ').map((w, i) => (
              <span
                key={i}
                className="transcript-word"
                onClick={(e) => {
                  e.stopPropagation();
                  onWordClick(w.replace(/[.,!?;:'"]/g, ''));
                }}
              >
                {w}{' '}
              </span>
            ))}
      </p>
      {/* Timestamp */}
      <span className="text-xs text-surface-500 mt-1 block">
        {formatTimestamp(segment.start)} - {formatTimestamp(segment.end)}
      </span>
    </motion.div>
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
  const duration = word.end - word.start;

  return (
    <span className="inline-block relative mx-0.5">
      <span
        className={`transcript-word text-base ${
          isActive
            ? 'active text-primary-300 font-semibold'
            : isSentenceActive
            ? 'text-surface-100'
            : 'text-surface-300'
        }`}
        onClick={onClick}
      >
        {word.word}
      </span>
      {/* Karaoke underline */}
      {isSentenceActive && (
        <span
          className="absolute bottom-0 left-0 h-0.5 bg-primary-400 rounded-full transition-all duration-100"
          style={{
            width: isActive ? '100%' : '0%',
            transitionDuration: `${Math.max(duration * 1000, 100)}ms`,
          }}
        />
      )}
      <span> </span>
    </span>
  );
}

/* Current line floating bar */
function CurrentLineBar({
  segment,
  currentTime,
}: {
  segment: TranscriptSegment | null;
  currentTime: number;
}) {
  if (!segment) return null;

  return (
    <div className="sticky bottom-0 mt-4 p-4 glass rounded-2xl border border-primary-500/20">
      <p className="text-sm text-surface-200 leading-relaxed text-center font-medium">
        {segment.text}
      </p>
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-primary-400">{formatTimestamp(currentTime)}</span>
        <div className="flex items-center gap-2">
          <span className="badge-primary text-xs">{formatTimestamp(segment.duration)}</span>
        </div>
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