/**
 * Library — all learning sources in one place.
 * YouTube videos + text content (paste/file/typed).
 * Add new sources via a modal with type selection.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useStore } from '@/store/appStore';
import { libraryApi, videosApi, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/Button';

/* ── Types ─────────────────────────────────────────────────────── */
interface Source {
  id: string;
  title: string;
  source_type: 'youtube' | 'text' | 'paste' | 'file';
  youtube_id?: string;
  channel?: string;
  duration?: number;
  thumbnail_url?: string;
  content?: string;
  word_count?: number;
  created_at?: string;
}

type AddMode = null | 'choose' | 'youtube' | 'text' | 'paste';

/* ── Helpers ───────────────────────────────────────────────────── */
function fmtDate(v?: string) {
  if (!v) return '';
  const d = new Date(v.replace(' ', 'T'));
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtDuration(s?: number) {
  if (!s) return '';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h}h${m}m` : `${m}m`;
}

const SOURCE_ICONS: Record<string, string> = {
  youtube: '🎬', text: '📄', paste: '📋', file: '📁',
};

const SOURCE_LABELS: Record<string, string> = {
  youtube: 'YouTube', text: 'Text', paste: 'Pasted', file: 'File',
};

/* ════════════════════════════════════════════════════════════════ */

export default function LibraryView() {
  const { setCurrentVideo, setPage, addRecentVideo } = useStore();
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [addMode, setAddMode] = useState<AddMode>(null);

  /* ── Load sources ────────────────────────────────────────────── */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await libraryApi.listSources();
      setSources(data?.sources || []);
    } catch { setSources([]); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── Open source ─────────────────────────────────────────────── */
  const openSource = useCallback((s: Source) => {
    if (s.source_type === 'youtube' && s.youtube_id) {
      setCurrentVideo(s as any);
      addRecentVideo(s as any);
      setPage('player');
    } else {
      // For text sources — navigate to player with text mode
      // For now show the content (future: text reader view)
      setCurrentVideo({ ...s, youtube_id: '' } as any);
      setPage('player');
    }
  }, [setCurrentVideo, addRecentVideo, setPage]);

  /* ── Delete source ───────────────────────────────────────────── */
  const deleteSource = useCallback(async (id: string) => {
    try {
      await libraryApi.deleteSource(id);
      setSources(prev => prev.filter(s => s.id !== id));
    } catch {}
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-heading">Library</h1>
          <p className="text-muted text-sm mt-0.5">{sources.length} source{sources.length === 1 ? '' : 's'}</p>
        </div>
        <Button onClick={() => setAddMode('choose')} variant="primary" size="sm">
          + Add Source
        </Button>
      </div>

      {/* Sources list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-line border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : sources.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">📖</div>
          <h2 className="text-lg font-semibold text-heading mb-2">Your library is empty</h2>
          <p className="text-body text-sm max-w-xs mx-auto mb-6">
            Add YouTube videos or text content to start learning English
          </p>
          <Button onClick={() => setAddMode('choose')} variant="primary">Add your first source</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {sources.map(s => (
            <div key={s.id}
              className="bg-card/50 border border-line/40 rounded-xl overflow-hidden hover:border-line transition-all group">
              <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={() => openSource(s)}>
                {/* Thumbnail or icon */}
                {s.source_type === 'youtube' && s.thumbnail_url ? (
                  <img src={s.thumbnail_url} alt="" className="w-20 h-12 rounded-lg object-cover bg-elevated flex-shrink-0" />
                ) : (
                  <div className="w-20 h-12 rounded-lg bg-elevated/60 flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl">{SOURCE_ICONS[s.source_type] || '📄'}</span>
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-heading line-clamp-1">{s.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-elevated/60 text-body">
                      {SOURCE_LABELS[s.source_type] || s.source_type}
                    </span>
                    {s.channel && <span className="text-xs text-muted">{s.channel}</span>}
                    {s.duration ? <span className="text-xs text-faint">{fmtDuration(s.duration)}</span> : null}
                    {(s.word_count ?? 0) > 0 && <span className="text-xs text-faint">{s.word_count} words</span>}
                    {s.created_at && <span className="text-xs text-faint">{fmtDate(s.created_at)}</span>}
                  </div>
                  {s.source_type !== 'youtube' && s.content && (
                    <p className="text-xs text-muted mt-1 line-clamp-1">{s.content}</p>
                  )}
                </div>

                {/* Delete */}
                <button onClick={e => { e.stopPropagation(); deleteSource(s.id); }}
                  className="p-2 rounded-lg text-faint hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0">
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Add Source Modal ────────────────────────────────────── */}
      {addMode && (
        <AddSourceModal
          mode={addMode}
          setMode={setAddMode}
          onAdded={load}
        />
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   ADD SOURCE MODAL
   ════════════════════════════════════════════════════════════════ */

function AddSourceModal({
  mode, setMode, onAdded,
}: {
  mode: AddMode;
  setMode: (m: AddMode) => void;
  onAdded: () => void;
}) {
  const { setCurrentVideo, setPage, addRecentVideo, defaultVideoQuality } = useStore();
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const close = () => { setMode(null); setError(''); };

  /* ── Submit YouTube ──────────────────────────────────────────── */
  const submitYoutube = async () => {
    if (!url.trim()) return;
    setBusy(true); setError('');
    try {
      const video = await videosApi.process(url.trim(), defaultVideoQuality);
      addRecentVideo(video);
      setCurrentVideo(video);
      onAdded();
      close();
      setPage('player');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load video');
    }
    setBusy(false);
  };

  /* ── Submit Text ─────────────────────────────────────────────── */
  const submitText = async (sourceType: string) => {
    const t = title.trim() || 'Untitled';
    const c = text.trim();
    if (c.length < 10) { setError('Content must be at least 10 characters'); return; }
    setBusy(true); setError('');
    try {
      await libraryApi.addText(t, c, sourceType);
      onAdded();
      close();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to add text');
    }
    setBusy(false);
  };

  /* ── File upload handler ─────────────────────────────────────── */
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!title.trim()) setTitle(file.name.replace(/\.[^.]+$/, ''));
    const reader = new FileReader();
    reader.onload = () => {
      setText(reader.result as string);
      setMode('text');
    };
    reader.readAsText(file);
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={close} />

      {/* Modal */}
      <div className="fixed inset-x-4 bottom-4 top-auto z-50 bg-surface border border-line/50 rounded-2xl shadow-2xl max-h-[80vh] overflow-y-auto
                      sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-line-s">
          <h2 className="text-lg font-bold text-heading">
            {mode === 'choose' && 'Add Source'}
            {mode === 'youtube' && '🎬 YouTube Video'}
            {mode === 'text' && '📄 Text Content'}
            {mode === 'paste' && '📋 Paste Text'}
          </h2>
          <button onClick={close} className="p-2 rounded-xl hover:bg-card text-muted hover:text-body">✕</button>
        </div>

        <div className="px-5 py-4 space-y-4">

          {/* ── Choose type ────────────────────────────────────── */}
          {mode === 'choose' && (
            <div className="space-y-3">
              <p className="text-sm text-body">What would you like to add?</p>

              <button onClick={() => setMode('youtube')}
                className="w-full flex items-center gap-4 p-4 bg-card/60 border border-line/40 rounded-xl hover:border-blue-500/30 hover:bg-blue-500/5 transition-all text-left">
                <span className="text-3xl">🎬</span>
                <div>
                  <p className="text-sm font-semibold text-heading">YouTube Video</p>
                  <p className="text-xs text-muted mt-0.5">Paste a YouTube URL to extract subtitles</p>
                </div>
              </button>

              <button onClick={() => setMode('paste')}
                className="w-full flex items-center gap-4 p-4 bg-card/60 border border-line/40 rounded-xl hover:border-purple-500/30 hover:bg-purple-500/5 transition-all text-left">
                <span className="text-3xl">📋</span>
                <div>
                  <p className="text-sm font-semibold text-heading">Paste Text</p>
                  <p className="text-xs text-muted mt-0.5">Paste any English text, story, or article</p>
                </div>
              </button>

              <button onClick={() => fileRef.current?.click()}
                className="w-full flex items-center gap-4 p-4 bg-card/60 border border-line/40 rounded-xl hover:border-green-500/30 hover:bg-green-500/5 transition-all text-left">
                <span className="text-3xl">📁</span>
                <div>
                  <p className="text-sm font-semibold text-heading">Upload Text File</p>
                  <p className="text-xs text-muted mt-0.5">.txt file with English content</p>
                </div>
              </button>
              <input ref={fileRef} type="file" accept=".txt,.text" onChange={handleFile} className="hidden" />
            </div>
          )}

          {/* ── YouTube URL input ──────────────────────────────── */}
          {mode === 'youtube' && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-body mb-1.5 block">YouTube URL</label>
                <input
                  type="text" value={url}
                  onChange={e => { setUrl(e.target.value); setError(''); }}
                  placeholder="https://youtube.com/watch?v=..."
                  className="w-full bg-card border border-line rounded-xl px-4 py-3 text-sm text-heading placeholder-muted focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setMode('choose')} variant="outline" className="flex-1">← Back</Button>
                <Button onClick={submitYoutube} variant="primary" loading={busy} className="flex-1">Add Video</Button>
              </div>
            </div>
          )}

          {/* ── Paste text input ───────────────────────────────── */}
          {(mode === 'paste' || mode === 'text') && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-body mb-1.5 block">Title</label>
                <input
                  type="text" value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. 'The Little Prince - Chapter 1'"
                  className="w-full bg-card border border-line rounded-xl px-4 py-3 text-sm text-heading placeholder-muted focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-medium text-body mb-1.5 block">
                  Content <span className="text-muted font-normal">({text.split(/\s+/).filter(Boolean).length} words)</span>
                </label>
                <textarea
                  value={text}
                  onChange={e => { setText(e.target.value); setError(''); }}
                  placeholder="Paste your English text here..."
                  rows={8}
                  className="w-full bg-card border border-line rounded-xl px-4 py-3 text-sm text-heading placeholder-muted focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-y"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setMode('choose')} variant="outline" className="flex-1">← Back</Button>
                <Button onClick={() => submitText(mode === 'paste' ? 'paste' : 'file')} variant="primary" loading={busy} className="flex-1">
                  Add to Library
                </Button>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="px-4 py-2.5 bg-red-500/10 border border-red-500/30 rounded-xl">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
