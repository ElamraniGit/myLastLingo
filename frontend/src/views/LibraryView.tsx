/**
 * Library — Apple-style redesign.
 * All learning sources: YouTube videos + text content.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useStore } from '@/store/appStore';
import { libraryApi, videosApi, ApiError } from '@/lib/api';
import { useDictionary } from '@/hooks/useDictionary';

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

type AddMode = null | 'choose' | 'youtube' | 'text' | 'word';

function fmtDate(v?: string) {
  if (!v) return '';
  const d = new Date(v.replace(' ', 'T'));
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function fmtDuration(s?: number) {
  if (!s) return '';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

const TYPE_ICON: Record<string, string>  = { youtube: '🎬', text: '📄', paste: '📋', file: '📁' };
const TYPE_LABEL: Record<string, string> = { youtube: 'Video', text: 'Text', paste: 'Text', file: 'File' };

/* ════════════════════════════════════════════════════════════════ */

export default function LibraryView() {
  const { setCurrentVideo, setPage, addRecentVideo, setCurrentTextId } = useStore();
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [addMode, setAddMode] = useState<AddMode>(null);
  const currentPage = useStore(s => s.currentPage);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await libraryApi.listSources();
      setSources(data?.sources || []);
    } catch { setSources([]); }
    setLoading(false);
  }, []);

  useEffect(() => { if (currentPage === 'library') load(); }, [currentPage]); // eslint-disable-line

  const openSource = useCallback((s: Source) => {
    if (s.source_type === 'youtube' && s.youtube_id) {
      setCurrentVideo(s as any);
      addRecentVideo(s as any);
      setPage('player');
    } else {
      setCurrentTextId(s.id);
      setPage('textreader');
    }
  }, [setCurrentVideo, addRecentVideo, setPage, setCurrentTextId]);

  const deleteSource = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this source?')) return;
    try {
      await libraryApi.deleteSource(id);
      setSources(prev => prev.filter(s => s.id !== id));
    } catch {}
  }, []);

  return (
    <div className="max-w-lg mx-auto pb-28 lg:pb-8 animate-fade-in">

      {/* ── Sticky header ───────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-base/90 backdrop-blur-xl border-b border-default px-4 pt-5 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-heading">Library</h2>
            <p className="text-xs text-muted mt-0.5">
              {sources.length} source{sources.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => setAddMode('choose')}
            className="btn-primary py-2 px-4 text-sm rounded-xl"
          >
            + Add
          </button>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────── */}
      <div className="px-4 pt-3">
        {loading ? (
          <div className="space-y-3 mt-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-3 items-center">
                <div className="skeleton w-16 h-11 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-3.5 rounded-md w-3/4" />
                  <div className="skeleton h-3 rounded-md w-1/2" />
                </div>
              </div>
            ))}
          </div>

        ) : sources.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-5xl mb-4">📖</div>
            <div className="text-base font-semibold text-heading mb-1">Library is empty</div>
            <div className="text-sm text-muted mb-6">Add YouTube videos or text to start learning</div>
            <button onClick={() => setAddMode('choose')} className="btn-primary px-6 py-2.5 text-sm rounded-xl">
              Add your first source
            </button>
          </div>

        ) : (
          <div className="space-y-2">
            {sources.map(s => (
              <button
                key={s.id}
                onClick={() => openSource(s)}
                className="w-full flex items-center gap-3 bg-card border border-default rounded-2xl p-3 card-hover text-left group"
              >
                {/* Thumbnail / icon */}
                {s.source_type === 'youtube' && s.thumbnail_url ? (
                  <img
                    src={s.thumbnail_url}
                    alt=""
                    className="w-16 h-11 rounded-xl object-cover shrink-0 bg-elevated"
                  />
                ) : (
                  <div className="w-16 h-11 rounded-xl bg-elevated flex items-center justify-center text-2xl shrink-0">
                    {TYPE_ICON[s.source_type] || '📄'}
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-heading truncate">{s.title}</div>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-elevated text-muted font-medium">
                      {TYPE_LABEL[s.source_type] || s.source_type}
                    </span>
                    {s.channel && <span className="text-xs text-muted truncate">{s.channel}</span>}
                    {s.duration ? <span className="text-xs text-faint">{fmtDuration(s.duration)}</span> : null}
                    {(s.word_count ?? 0) > 0 && <span className="text-xs text-faint">{s.word_count} words</span>}
                    {s.created_at && <span className="text-xs text-faint ml-auto">{fmtDate(s.created_at)}</span>}
                  </div>
                  {s.source_type !== 'youtube' && s.content && (
                    <p className="text-xs text-muted mt-1 line-clamp-1">{s.content}</p>
                  )}
                </div>

                {/* Delete */}
                <button
                  onClick={e => deleteSource(s.id, e)}
                  className="w-8 h-8 rounded-xl hover:bg-red-500/10 text-faint hover:text-red-500 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 shrink-0 text-sm"
                >🗑</button>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Add Modal ────────────────────────────────────────────── */}
      {addMode && (
        <AddModal
          mode={addMode}
          setMode={setAddMode}
          onAdded={load}
        />
      )}
    </div>
  );
}

/* ── Add Source Modal ─────────────────────────────────────────── */
function AddModal({
  mode, setMode, onAdded,
}: {
  mode: AddMode;
  setMode: (m: AddMode) => void;
  onAdded: () => void;
}) {
  const { setCurrentVideo, setPage, addRecentVideo, defaultVideoQuality } = useStore();
  const [url,   setUrl]   = useState('');
  const [title, setTitle] = useState('');
  const [text,  setText]  = useState('');
  const [word,  setWord]  = useState('');
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const close = () => { setMode(null); setError(''); };

  /* YouTube */
  const submitYoutube = async () => {
    if (!url.trim()) return;
    setBusy(true); setError('');
    try {
      const video = await videosApi.process(url.trim(), defaultVideoQuality);
      addRecentVideo(video);
      setCurrentVideo(video);
      onAdded(); close();
      setPage('player');
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Failed to load video'); }
    setBusy(false);
  };

  /* Text / Paste */
  const submitText = async () => {
    const t = title.trim() || 'Untitled';
    const c = text.trim();
    if (c.length < 10) { setError('Content must be at least 10 characters'); return; }
    setBusy(true); setError('');
    try {
      await libraryApi.addText(t, c, mode === 'text' ? 'text' : 'paste');
      onAdded(); close();
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Failed to add text'); }
    setBusy(false);
  };

  /* File */
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!title.trim()) setTitle(file.name.replace(/\.[^.]+$/, ''));
    const reader = new FileReader();
    reader.onload = () => { setText(reader.result as string); setMode('text'); };
    reader.readAsText(file);
  };

  const MODAL_TITLE: Record<string, string> = {
    choose: 'Add to Library',
    youtube: '🎬 YouTube Video',
    text: '📄 Text Content',
    word: '🔤 Add a Word',
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={close}
      />

      {/* Sheet */}
      <div className="fixed z-50 bottom-0 left-0 right-0 bg-surface rounded-t-3xl border-t border-default max-h-[88vh] overflow-y-auto animate-slide-up lg:left-1/2 lg:-translate-x-1/2 lg:w-full lg:max-w-md">

        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-elevated rounded-full" />
        </div>

        <div className="px-5 pb-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-bold text-heading">{MODAL_TITLE[mode!] || 'Add'}</h3>
            <button onClick={close} className="w-8 h-8 rounded-full bg-elevated text-muted hover:text-heading flex items-center justify-center text-sm transition-colors">✕</button>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 bg-red-500/8 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          {/* ── Choose type ──────────────────────────────────── */}
          {mode === 'choose' && (
            <div className="space-y-2">
              {[
                { m: 'youtube', icon: '🎬', title: 'YouTube Video',   sub: 'Paste a URL to extract subtitles' },
                { m: 'text',    icon: '📋', title: 'Paste Text',      sub: 'Any English text, article or story' },
                { m: null,      icon: '📁', title: 'Upload .txt File', sub: 'Read a text file from your device', file: true },
                { m: 'word',    icon: '🔤', title: 'Add a Word',      sub: 'Look up and save any English word' },
              ].map(item => (
                <button
                  key={item.title}
                  onClick={() => item.file ? fileRef.current?.click() : setMode(item.m as AddMode)}
                  className="w-full flex items-center gap-4 p-4 bg-card border border-default rounded-2xl hover:border-blue-500/30 active:scale-[0.98] transition-all text-left"
                >
                  <span className="text-2xl w-9 text-center">{item.icon}</span>
                  <div>
                    <div className="text-sm font-semibold text-heading">{item.title}</div>
                    <div className="text-xs text-muted mt-0.5">{item.sub}</div>
                  </div>
                </button>
              ))}
              <input ref={fileRef} type="file" accept=".txt" className="hidden" onChange={handleFile} />
            </div>
          )}

          {/* ── YouTube ──────────────────────────────────────── */}
          {mode === 'youtube' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">YouTube URL</label>
                <input
                  value={url}
                  onChange={e => { setUrl(e.target.value); setError(''); }}
                  placeholder="https://youtube.com/watch?v=..."
                  className="input-field text-sm"
                  autoFocus
                  dir="ltr"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setMode('choose')} className="flex-1 py-2.5 rounded-xl border border-default text-sm text-body hover:bg-card transition-colors">← Back</button>
                <button onClick={submitYoutube} disabled={busy || !url.trim()} className="btn-primary flex-1 py-2.5 text-sm rounded-xl">
                  {busy ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Loading…</span> : 'Add Video'}
                </button>
              </div>
            </div>
          )}

          {/* ── Text / Paste ─────────────────────────────────── */}
          {(mode === 'text') && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">Title</label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. The Little Prince — Ch. 1"
                  className="input-field text-sm"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">
                  Content <span className="text-faint">({text.split(/\s+/).filter(Boolean).length} words)</span>
                </label>
                <textarea
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder="Paste your English text here…"
                  rows={7}
                  className="input-field text-sm resize-none"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setMode('choose')} className="flex-1 py-2.5 rounded-xl border border-default text-sm text-body hover:bg-card transition-colors">← Back</button>
                <button onClick={submitText} disabled={busy || text.trim().length < 10} className="btn-primary flex-1 py-2.5 text-sm rounded-xl">
                  {busy ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Saving…</span> : 'Save Text'}
                </button>
              </div>
            </div>
          )}

          {/* ── Word lookup ──────────────────────────────────── */}
          {mode === 'word' && (
            <WordLookup onBack={() => setMode('choose')} onSaved={() => { onAdded(); close(); }} />
          )}
        </div>
      </div>
    </>
  );
}

/* ── Word Lookup inside modal ─────────────────────────────────── */
function WordLookup({ onBack, onSaved }: { onBack: () => void; onSaved: () => void }) {
  const [word,   setWord]   = useState('');
  const [busy,   setBusy]   = useState(false);
  const [error,  setError]  = useState('');
  const [result, setResult] = useState<any>(null);
  const { lookupWord } = useDictionary();

  const search = async () => {
    const w = word.trim().toLowerCase();
    if (!w) return;
    setBusy(true); setError('');
    try {
      await lookupWord(w, '');
      setResult({ word: w });
    } catch { setError('Word not found'); }
    setBusy(false);
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-muted mb-1.5">English Word</label>
        <input
          value={word}
          onChange={e => { setWord(e.target.value); setError(''); setResult(null); }}
          onKeyDown={e => e.key === 'Enter' && search()}
          placeholder="e.g. ambiguous"
          className="input-field text-sm"
          autoFocus
        />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {result && <p className="text-xs text-green-400">✓ Word popup opened — save it from there!</p>}
      <div className="flex gap-2">
        <button onClick={onBack} className="flex-1 py-2.5 rounded-xl border border-default text-sm text-body hover:bg-card transition-colors">← Back</button>
        <button onClick={search} disabled={busy || !word.trim()} className="btn-primary flex-1 py-2.5 text-sm rounded-xl">
          {busy ? 'Looking up…' : 'Look Up'}
        </button>
      </div>
    </div>
  );
}
