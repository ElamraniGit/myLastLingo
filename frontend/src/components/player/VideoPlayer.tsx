/**
 * Video player component with YouTube integration and local playback.
 */

import React, { useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import ReactPlayer from 'react-player';
import { HiPlay, HiPause, HiVolumeUp, HiVolumeOff, HiRefresh, HiFastForward, HiRewind } from 'react-icons/hi';
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
    <div className="relative rounded-2xl overflow-hidden bg-black">
      {/* Player */}
      <div className="aspect-video relative">
        <ReactPlayer
          ref={playerRef}
          url={youtubeUrl}
          width="100%"
          height="100%"
          playing={playing}
          volume={volume}
          playbackRate={speed}
          onProgress={onProgress}
          onDuration={onDuration}
          onReady={onReady}
          onEnded={onEnded}
          controls={false}
          style={{ borderRadius: '1rem' }}
        />

        {/* Overlay controls */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
      </div>

      {/* Controls bar */}
      <div className="bg-surface-900/95 backdrop-blur-sm px-4 py-3">
        {/* Progress bar */}
        <div className="relative mb-3 group cursor-pointer"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const percent = x / rect.width;
            seekTo(percent * duration);
          }}
        >
          <div className="h-1.5 bg-surface-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-primary-500 to-accent-500 rounded-full relative"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Play/Pause */}
            <button onClick={togglePlay} className="text-white p-2 rounded-xl hover:bg-surface-700/50 transition-all">
              {playing ? <HiPause className="w-5 h-5" /> : <HiPlay className="w-5 h-5" />}
            </button>

            {/* Skip back */}
            <button onClick={() => skipBackward(10)} className="p-2 rounded-xl hover:bg-surface-700/50 transition-all text-surface-300">
              <HiRewind className="w-4 h-4" />
            </button>

            {/* Skip forward */}
            <button onClick={() => skipForward(10)} className="p-2 rounded-xl hover:bg-surface-700/50 transition-all text-surface-300">
              <HiFastForward className="w-4 h-4" />
            </button>

            {/* Time display */}
            <span className="text-xs text-surface-400 font-mono min-w-[100px]">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Speed control */}
            <div className="relative group">
              <button className="p-2 rounded-xl hover:bg-surface-700/50 transition-all text-surface-300 text-xs font-mono">
                {speed}x
              </button>
              <div className="absolute bottom-full right-0 mb-2 p-2 glass rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSpeed(s)}
                    className={`block w-full text-right px-3 py-1.5 text-sm rounded-lg transition-colors ${
                      speed === s ? 'text-primary-400 bg-primary-500/10' : 'text-surface-300 hover:text-white hover:bg-surface-700'
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>

            {/* Loop */}
            <button
              onClick={() => toggleLoop()}
              className={`p-2 rounded-xl hover:bg-surface-700/50 transition-all ${loopEnabled ? 'text-primary-400 bg-primary-500/10' : 'text-surface-300'}`}
            >
              <HiRefresh className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
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
