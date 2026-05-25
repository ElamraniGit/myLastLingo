/**
 * Main player page combining video player, transcript, and dictionary.
 *
 * Bug #16 note: This file is imported by _app.tsx directly, not used as
 * a Next.js route. It lives in pages/ but is a "view" component.
 * It is safe as long as Next.js doesn't index it as a page
 * (since _app.tsx overrides rendering completely).
 */

import React, { useEffect } from 'react';
import VideoInput from '@/components/player/VideoInput';
import VideoPlayer from '@/components/player/VideoPlayer';
import TranscriptViewer from '@/components/transcript/TranscriptViewer';
import DictionaryModal from '@/components/dictionary/DictionaryModal';
import { useAppStore } from '@/store/appStore';
import { useVideoPlayer } from '@/hooks/useVideoPlayer';

export default function PlayerPage() {
  const { currentVideo, transcript, loading, error, clearError } = useAppStore();
  const { extractTranscript } = useVideoPlayer();

  // Auto-extract transcript when a video is loaded and no transcript exists
  useEffect(() => {
    if (currentVideo && !transcript && !loading) {
      extractTranscript(currentVideo.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentVideo?.id]);

  if (!currentVideo) {
    return <VideoInput />;
  }

  return (
    <div className="flex flex-col h-full min-h-screen gap-0">
      {/* Video section */}
      <div className="flex-shrink-0">
        <VideoPlayer />

        {/* Video info */}
        <div className="px-4 py-3 border-b border-surface-700/50">
          <h2 className="text-sm font-semibold text-surface-100 line-clamp-1">
            {currentVideo.title}
          </h2>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-surface-400">{currentVideo.channel}</span>
            {currentVideo.duration > 0 && (
              <>
                <span className="text-surface-600">•</span>
                <span className="text-xs text-surface-500">{formatDuration(currentVideo.duration)}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-4 mt-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center justify-between">
          <span className="text-sm text-red-400">{error}</span>
          <button onClick={clearError} className="text-red-400 hover:text-red-300 ml-2 text-lg leading-none">
            ×
          </button>
        </div>
      )}

      {/* Loading banner */}
      {loading && !transcript && (
        <div className="mx-4 mt-2 px-3 py-2 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin flex-shrink-0" />
          <span className="text-sm text-blue-400">جاري استخراج الترجمة...</span>
        </div>
      )}

      {/* Transcript panel */}
      <div className="flex-1 overflow-hidden">
        <TranscriptViewer />
      </div>

      {/* Dictionary modal (bottom sheet) */}
      <DictionaryModal />
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}س ${m}د`;
  return `${m} دقيقة`;
}
