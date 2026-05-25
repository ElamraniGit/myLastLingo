/**
 * Video player component with YouTube integration and local playback.
 *
 * FIXES:
 *  - Uses the single useVideoPlayer() instance (no duplicate hook in TranscriptViewer).
 *  - Proper volume control wiring.
 *  - Mobile-friendly controls.
 */

import React, { useCallback } from 'react';
import ReactPlayer from 'react-player/youtube';
import { useAppStore } from '@/store/appStore';
import { useVideoPlayer } from '@/hooks/useVideoPlayer';

export default function VideoPlayer() {
  const { currentVideo } = useAppStore();
  const {
    playerRef,
    playerReady,
    currentTime,
    duration,
    playing,
    speed,
    volume,
    loopEnabled,
    togglePlay,
    seekTo,
    setSpeed,
    skipForward,
    skipBackward,
    toggleLoop,
    onProgress,
    onDuration,
    onReady,
    onEnded,
  } = useVideoPlayer();

  if (!currentVideo) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const youtubeUrl = `https://www.youtube.com/watch?v=${currentVideo.youtube_id}`;

  return (
    <div className="relative w-full bg-black rounded-2xl overflow-hidden shadow-2xl">
      {/* ReactPlayer */}
      <div className="relative w-full aspect-video">
        <ReactPlayer
          ref={playerRef}
          url={youtubeUrl}
          playing={playing}
          playbackRate={speed}
          volume={volume}
          width="100%"
          height="100%"
          onProgress={onProgress}
          onDuration={onDuration}
          onReady={onReady}
          onEnded={onEnded}
          config={{
            playerVars: {
              // Disable YouTube logo and related videos for cleaner UX
              modestbranding: 1,
              rel: 0,
              iv_load_policy: 3,
            },
          }}
        />
      </div>

      {/* Controls bar */}
      <div className="bg-surface-900/95 px-3 py-2">
        {/* Progress bar */}
        <div
          className="relative h-2 bg-surface-700 rounded-full mb-3 cursor-pointer group"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const pct = x / rect.width;
            seekTo(pct * duration);
          }}
        >
          <div
            className="h-full bg-primary-500 rounded-full relative transition-all duration-100"
            style={{ width: `${progress}%` }}
          >
            {/* Scrubber handle */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* Buttons row */}
        <div className="flex items-center gap-2">
          {/* Skip back 10s */}
          <button
            onClick={() => skipBackward(10)}
            className="text-surface-300 hover:text-white p-1.5 rounded-lg hover:bg-surface-700/50 transition-all text-sm"
            title="10 ثوان للخلف"
          >
            ⏮ 10
          </button>

          {/* Play / Pause */}
          <button
            onClick={togglePlay}
            className="text-white bg-primary-600 hover:bg-primary-500 p-2.5 rounded-xl transition-all shadow"
            title={playing ? 'إيقاف' : 'تشغيل'}
          >
            {playing ? '⏸' : '▶'}
          </button>

          {/* Skip forward 10s */}
          <button
            onClick={() => skipForward(10)}
            className="text-surface-300 hover:text-white p-1.5 rounded-lg hover:bg-surface-700/50 transition-all text-sm"
            title="10 ثوان للأمام"
          >
            10 ⏭
          </button>

          {/* Time display */}
          <span className="text-xs text-surface-400 ml-1 tabular-nums">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          <div className="flex-1" />

          {/* Speed control */}
          <SpeedMenu speed={speed} setSpeed={setSpeed} />

          {/* Loop toggle */}
          <button
            onClick={() => toggleLoop()}
            className={`p-1.5 rounded-lg text-sm transition-all ${
              loopEnabled
                ? 'text-primary-400 bg-primary-500/20'
                : 'text-surface-400 hover:text-white hover:bg-surface-700/50'
            }`}
            title={loopEnabled ? 'إلغاء التكرار' : 'تكرار الجملة'}
          >
            🔁
          </button>
        </div>
      </div>

      {/* Not ready overlay */}
      {!playerReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-900/80 rounded-2xl">
          <div className="text-center">
            <div className="w-10 h-10 border-2 border-surface-600 border-t-primary-500 rounded-full animate-spin mx-auto mb-2" />
            <p className="text-surface-400 text-sm">جاري تحميل المشغل...</p>
          </div>
        </div>
      )}
    </div>
  );
}

function SpeedMenu({
  speed,
  setSpeed,
}: {
  speed: number;
  setSpeed: (s: number) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="text-surface-300 hover:text-white px-2 py-1 rounded-lg hover:bg-surface-700/50 text-xs font-mono transition-all"
      >
        {speed}x
      </button>
      {open && (
        <div className="absolute bottom-full right-0 mb-1 bg-surface-800 border border-surface-700 rounded-xl shadow-xl z-50 overflow-hidden min-w-[80px]">
          {speeds.map((s) => (
            <button
              key={s}
              onClick={() => {
                setSpeed(s);
                setOpen(false);
              }}
              className={`block w-full text-right px-3 py-2 text-sm transition-colors ${
                speed === s
                  ? 'text-primary-400 bg-primary-500/10 font-semibold'
                  : 'text-surface-300 hover:text-white hover:bg-surface-700'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
