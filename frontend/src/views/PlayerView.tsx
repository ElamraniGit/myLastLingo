/**
 * Main learning view.
 * Mobile:  video (fixed top half) + transcript (scrollable bottom half)
 * Desktop: video (left 55%) + transcript (right 45%)
 * Each section is independent — scrolling transcript never moves the video.
 */

import React from 'react';
import { useStore } from '@/store/appStore';
import VideoInput from '@/components/player/VideoInput';
import VideoPlayer from '@/components/player/VideoPlayer';
import TranscriptViewer from '@/components/transcript/TranscriptViewer';
import WordPopup from '@/components/dictionary/WordPopup';

function fmtDuration(s: number) {
  if (!s) return '';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

export default function PlayerView() {
  const { currentVideo, resetPlayer } = useStore();

  if (!currentVideo) return <VideoInput />;

  return (
    <div className="flex flex-col lg:flex-row h-full overflow-hidden">

      {/* ════════ VIDEO SECTION (fixed, never scrolls) ════════ */}
      <div className="flex-shrink-0 bg-slate-950 lg:w-[55%] lg:h-full lg:overflow-hidden">
        {/* Back + title */}
        <div className="flex items-center gap-3 px-4 pt-3 pb-1">
          <button
            onClick={() => resetPlayer()}
            className="p-2 rounded-xl hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-all flex-shrink-0"
          >
            ← Back
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-100 line-clamp-1">{currentVideo.title}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {currentVideo.channel}
              {currentVideo.duration > 0 && <> · {fmtDuration(currentVideo.duration)}</>}
            </p>
          </div>
        </div>
        <div className="px-4 pb-2">
          <VideoPlayer />
        </div>
      </div>

      {/* ════════ TRANSCRIPT SECTION (own scroll, fills remaining space) ════════ */}
      <div className="flex-1 min-h-0 overflow-hidden border-t lg:border-t-0 lg:border-l border-slate-800">
        <TranscriptViewer />
      </div>

      {/* ════════ Word popup ════════ */}
      <WordPopup />
    </div>
  );
}
