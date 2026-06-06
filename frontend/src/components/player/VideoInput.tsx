/**
 * VideoInput — Apple-style redesign.
 * Clean URL input to add a YouTube video.
 */
import React, { useState, useCallback } from 'react';
import { useStore } from '@/store/appStore';
import { videosApi, ApiError } from '@/lib/api';

export default function VideoInput() {
  const [url,    setUrl]    = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error,  setError]  = useState('');
  const { setCurrentVideo, setPage, addRecentVideo, defaultVideoQuality } = useStore();

  const isYT = (s: string) =>
    /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/.test(s.trim()) ||
    /^[a-zA-Z0-9_-]{11}$/.test(s.trim());

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    const v = url.trim();
    if (!v) return;
    if (!isYT(v)) {
      setStatus('error');
      setError('Please enter a valid YouTube URL');
      return;
    }
    setStatus('loading');
    setError('');
    try {
      const video = await videosApi.process(v, defaultVideoQuality);
      addRecentVideo(video);
      setCurrentVideo(video);
      setStatus('idle');
      setUrl('');
      setPage('player');
    } catch (e) {
      setStatus('error');
      setError(e instanceof ApiError ? e.message : 'Failed to load video');
    }
  }, [url, defaultVideoQuality, addRecentVideo, setCurrentVideo, setPage]);

  return (
    <div className="bg-card border border-default rounded-2xl p-4">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-8 h-8 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0 text-red-500"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="1" y="4" width="15" height="16" rx="2"/><polygon points="16 9 23 4 23 20 16 15 16 9"/></svg></div>
        <div>
          <div className="text-sm font-semibold text-heading">Add YouTube Video</div>
          <div className="text-xs text-muted">Paste a URL to learn with subtitles</div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={url}
          onChange={e => { setUrl(e.target.value); setError(''); setStatus('idle'); }}
          placeholder="https://youtube.com/watch?v=..."
          className="input-field flex-1 text-sm py-2.5"
          dir="ltr"
        />
        <button
          type="submit"
          disabled={status === 'loading' || !url.trim()}
          className="btn-primary px-4 py-2.5 text-sm rounded-xl shrink-0"
        >
          {status === 'loading'
            ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin block" />
            : (<svg className='w-4 h-4' viewBox='0 0 24 24' fill='currentColor'><polygon points='5 3 19 12 5 21 5 3'/></svg>)}
        </button>
      </form>

      {error && (
        <p className="text-xs text-red-400 mt-2 flex items-center gap-1.5">
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="2.5"/></svg> {error}
        </p>
      )}
    </div>
  );
}
