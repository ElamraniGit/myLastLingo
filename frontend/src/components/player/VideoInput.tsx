import React, { useState, useCallback } from 'react';
import { useStore } from '@/store/appStore';
import { videosApi, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/Button';

export default function VideoInput() {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<'idle'|'loading'|'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const {
    setCurrentVideo,
    setPage,
    recentVideos,
    addRecentVideo,
    defaultVideoQuality,
  } = useStore();

  const isYT = (s: string) =>
    /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/.test(s.trim()) ||
    /^[a-zA-Z0-9_-]{11}$/.test(s.trim());

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    const v = url.trim();
    if (!v) return;
    if (!isYT(v)) {
      setStatus('error');
      setErrorMsg('Please enter a valid YouTube URL or video ID');
      return;
    }
    setStatus('loading');
    setErrorMsg('');
    try {
      const video = await videosApi.process(v, defaultVideoQuality);
      addRecentVideo(video);
      setCurrentVideo(video);
      setPage('player');
    } catch (e) {
      setStatus('error');
      setErrorMsg(e instanceof ApiError ? e.message : 'Failed to load video');
    } finally {
      setStatus('idle');
    }
  }, [url, defaultVideoQuality, addRecentVideo, setCurrentVideo, setPage]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 py-10 max-w-xl mx-auto w-full">
      <div className="text-center mb-10">
        <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl mx-auto mb-5 flex items-center justify-center shadow-2xl shadow-blue-500/30">
          <span className="text-4xl">🎬</span>
        </div>
        <h2 className="text-3xl font-bold text-white mb-2">Learn English</h2>
        <p className="text-slate-400 text-base">Paste a YouTube URL and start learning with interactive subtitles</p>
      </div>
      <form onSubmit={handleSubmit} className="w-full space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setErrorMsg(''); setStatus('idle'); }}
            placeholder="https://youtube.com/watch?v=..."
            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-sm"
            dir="ltr"
          />
          <Button type="submit" variant="primary" loading={status==='loading'} className="px-6 whitespace-nowrap">
            Start ▶
          </Button>
        </div>
        <p className="text-xs text-slate-500 px-1">
          Default playback quality: <span className="text-slate-300 font-medium">{defaultVideoQuality === 'auto' ? 'Auto' : defaultVideoQuality}</span>
        </p>
        {errorMsg && (
          <div className="px-4 py-2.5 bg-red-500/10 border border-red-500/30 rounded-xl">
            <p className="text-sm text-red-400">{errorMsg}</p>
          </div>
        )}
      </form>
      <div className="flex flex-wrap justify-center gap-2 mt-8">
        {['📝 Synced subtitles','🔍 Click any word','🔊 Pronunciation','💾 Save vocabulary','🔁 Spaced repetition','📵 Works offline'].map((f) => (
          <span key={f} className="px-3 py-1.5 bg-slate-800/80 border border-slate-700/50 rounded-full text-xs text-slate-400">{f}</span>
        ))}
      </div>
      {recentVideos.length > 0 && (
        <div className="w-full mt-10">
          <h3 className="text-sm font-semibold text-slate-400 mb-3 px-1">Recent Videos</h3>
          <div className="space-y-2">
            {recentVideos.slice(0, 5).map((video) => (
              <button key={video.id} onClick={() => { setCurrentVideo(video); setPage('player'); }}
                className="w-full flex items-center gap-3 p-3 bg-slate-800/60 border border-slate-700/50 rounded-xl hover:bg-slate-700/60 transition-all text-left group">
                {video.thumbnail_url ? (
                  <img src={video.thumbnail_url} alt="" className="w-16 h-10 rounded-lg object-cover flex-shrink-0 bg-slate-700" />
                ) : (
                  <div className="w-16 h-10 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0"><span className="text-slate-500">🎬</span></div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200 line-clamp-1">{video.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{video.channel}</p>
                </div>
                <span className="text-slate-600">▶</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
