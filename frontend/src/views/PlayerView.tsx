/**
 * Main learning view: video + transcript side by side (desktop) or stacked (mobile).
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
  const { currentVideo, setPage, setCurrentVideo, resetPlayer } = useStore();

  if (!currentVideo) return <VideoInput />;

  return (
    <div className="flex flex-col lg:flex-row h-full">

      {/* ── Left: video ──────────────────────────────────────────────── */}
      <div className="flex flex-col lg:w-[55%] flex-shrink-0">
        {/* Back button + video info */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-2">
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

        <div className="px-4 pb-4">
          <VideoPlayer />
        </div>

        {/* Mobile: transcript below player */}
        <div className="lg:hidden flex-1 min-h-0 border-t border-slate-800">
          <TranscriptViewer />
        </div>
      </div>

      {/* ── Right: transcript (desktop) ──────────────────────────────── */}
      <div className="hidden lg:flex flex-col flex-1 min-w-0 border-l border-slate-800">
        <TranscriptViewer />
      </div>

      {/* ── Word popup ───────────────────────────────────────────────── */}
      <WordPopup />
    </div>
  );
}
