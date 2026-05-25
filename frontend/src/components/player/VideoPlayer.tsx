import React, { useState, useCallback } from 'react';
import ReactPlayer from 'react-player/youtube';
import { useVideoPlayer } from '@/hooks/useVideoPlayer';
import { useStore } from '@/store/appStore';

function fmtTime(s: number) {
  if (!s || !isFinite(s)) return '0:00';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  if (h) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${m}:${String(sec).padStart(2,'0')}`;
}

export default function VideoPlayer() {
  const { currentVideo } = useStore();
  const {
    playerRef, playing, speed, volume, loopEnabled,
    currentTime, duration,
    togglePlay, seekTo, setSpeed, setVolume,
    skipForward, skipBackward, toggleLoop,
    onProgress, onDuration, onReady, onEnded,
  } = useVideoPlayer();

  const [speedOpen, setSpeedOpen] = useState(false);
  const [volOpen, setVolOpen] = useState(false);
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    seekTo(((e.clientX - rect.left) / rect.width) * duration);
  }, [duration, seekTo]);

  if (!currentVideo) return null;

  return (
    <div className="relative bg-black rounded-2xl overflow-hidden shadow-2xl">
      <div className="aspect-video w-full">
        <ReactPlayer
          ref={playerRef}
          url={`https://www.youtube.com/watch?v=${currentVideo.youtube_id}`}
          playing={playing} playbackRate={speed} volume={volume}
          width="100%" height="100%"
          onProgress={onProgress} onDuration={onDuration} onReady={onReady} onEnded={onEnded}
          config={{ playerVars: { modestbranding: 1, rel: 0, iv_load_policy: 3 } }}
        />
      </div>
      <div className="bg-gradient-to-t from-black/90 via-black/40 to-transparent px-3 py-3">
        {/* Progress bar */}
        <div className="h-1.5 bg-white/20 rounded-full cursor-pointer mb-3 group relative" onClick={handleSeek}>
          <div className="h-full bg-blue-500 rounded-full relative transition-all duration-100" style={{ width: `${progress}%` }}>
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
        {/* Controls */}
        <div className="flex items-center gap-1 sm:gap-2">
          <button onClick={() => skipBackward(10)} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-all text-xs">⏮ 10s</button>
          <button onClick={togglePlay} className="w-10 h-10 flex items-center justify-center bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow transition-all active:scale-95 flex-shrink-0">
            {playing ? '⏸' : '▶'}
          </button>
          <button onClick={() => skipForward(10)} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-all text-xs">10s ⏭</button>
          <span className="text-white/60 text-xs tabular-nums ml-1">{fmtTime(currentTime)} / {fmtTime(duration)}</span>
          <div className="flex-1" />
          <button onClick={() => toggleLoop()} className={`p-2 rounded-lg text-sm transition-all ${loopEnabled ? 'text-blue-400 bg-blue-500/20' : 'text-white/50 hover:text-white hover:bg-white/10'}`}>🔁</button>
          {/* Volume */}
          <div className="relative">
            <button onClick={() => setVolOpen(!volOpen)} className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 text-sm">
              {volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
            </button>
            {volOpen && (
              <div className="absolute bottom-full right-0 mb-2 bg-slate-800 border border-slate-700 rounded-xl p-3 shadow-xl z-50 w-32">
                <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => setVolume(+e.target.value)} className="w-full accent-blue-500" />
                <p className="text-xs text-slate-400 text-center mt-1">{Math.round(volume * 100)}%</p>
              </div>
            )}
          </div>
          {/* Speed */}
          <div className="relative">
            <button onClick={() => setSpeedOpen(!speedOpen)} className="text-white/60 hover:text-white px-2 py-1.5 rounded-lg hover:bg-white/10 text-xs font-mono">{speed}×</button>
            {speedOpen && (
              <div className="absolute bottom-full right-0 mb-2 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden min-w-[80px]">
                {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((s) => (
                  <button key={s} onClick={() => { setSpeed(s); setSpeedOpen(false); }}
                    className={`block w-full text-center px-4 py-2 text-sm transition-colors ${speed === s ? 'bg-blue-500/20 text-blue-400 font-semibold' : 'text-slate-300 hover:bg-slate-700'}`}>
                    {s}×
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
