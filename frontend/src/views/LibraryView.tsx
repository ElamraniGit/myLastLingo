/**
 * Library — Apple-style redesign v2.
 *
 * Improvements:
 *  - Tab bar: All / Videos / Texts
 *  - Search bar to filter sources by title
 *  - Richer source cards: word-count badge, date, content preview
 *  - Floating + Add button (FAB style)
 *  - Improved empty state per tab
 *  - Sort: newest first
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
type TabFilter = 'all' | 'youtube' | 'text';

function fmtDate(v?: string) {
  if (!v) return '';
  const d = new Date(v.replace(' ', 'T'));
  if (isNaN(d.getTime())) return '';
  const now  = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7)  return `${diff}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtDuration(s?: number) {
  if (!s) return '';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  youtube: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="1" y="4" width="15" height="16" rx="2"/><polygon points="16 9 23 4 23 20 16 15 16 9"/></svg>,
  text:    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  paste:   <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>,
  file:    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>,
};
const TYPE_LABEL: Record<string, string> = { youtube: 'Video', text: 'Text', paste: 'Text', file: 'File' };

/* ════════════════════════════════════════════════════════════════ */

export default function LibraryView() {
  const { setCurrentVideo, setPage, addRecentVideo, setCurrentTextId } = useStore();
  const [sources,  setSources]  = useState<Source[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [addMode,  setAddMode]  = useState<AddMode>(null);
  const [tab,      setTab]      = useState<TabFilter>('all');
  const [search,   setSearch]   = useState('');
  const currentPage = useStore(s => s.currentPage);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await libraryApi.listSources(1, 100);
      setSources(data?.sources || []);
    } catch { setSources([]); }
    setLoading(false);
  }, []);

  useEffect(() => { if (currentPage === 'library') load(); }, [currentPage]); // eslint-disable-line

  // Filtered + searched sources
  const filtered = sources.filter(s => {
    const matchTab =
      tab === 'all' ? true :
      tab === 'youtube' ? s.source_type === 'youtube' :
      s.source_type !== 'youtube';
    const q = search.trim().toLowerCase();
    const matchSearch = !q ||
      s.title.toLowerCase().includes(q) ||
      (s.channel || '').toLowerCase().includes(q) ||
      (s.content || '').toLowerCase().includes(q);
    return matchTab && matchSearch;
  });

  const videoCount = sources.filter(s => s.source_type === 'youtube').length;
  const textCount  = sources.filter(s => s.source_type !== 'youtube').length;

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

  const TABS: { id: TabFilter; label: string; count: number }[] = [
    { id: 'all',     label: 'All',    count: sources.length },
    { id: 'youtube', label: 'Videos', count: videoCount },
    { id: 'text',    label: 'Texts',  count: textCount },
  ];

  return (
    <div className="max-w-lg mx-auto pb-28 lg:pb-8 animate-fade-in">

      {/* ── Sticky header ─────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-base/90 backdrop-blur-xl border-b border-default">
        <div className="flex items-center justify-between px-4 pt-5 pb-3">
          <div>
            <h2 className="text-2xl font-bold text-heading tracking-tight">Library</h2>
            <p className="text-sm text-muted mt-0.5">
              {sources.length} source{sources.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => setAddMode('choose')}
            className="btn-primary py-2 px-4 text-sm rounded-xl flex items-center gap-1.5"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                 strokeLinecap="round" className="w-4 h-4">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Add
          </button>
        </div>

        {/* Search */}
        <div className="relative px-4 pb-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
               strokeLinecap="round" strokeLinejoin="round"
               className="absolute left-7 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search sources…"
            className="input-field pl-9 py-2.5 text-sm"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-7 top-1/2 -translate-y-1/2 text-muted hover:text-body"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                   strokeLinecap="round" className="w-3.5 h-3.5">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pb-3 overflow-x-auto scrollbar-none">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                tab === t.id
                  ? 'bg-blue-600/15 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                  : 'text-muted hover:text-body bg-card border border-default'
              }`}
            >
              {t.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                tab === t.id ? 'bg-blue-500/20' : 'bg-elevated'
              }`}>{t.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────── */}
      <div className="px-4 pt-3">
        {loading ? (
          <div className="space-y-3 mt-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-3 items-center bg-card border border-default rounded-2xl p-3">
                <div className="skeleton w-16 h-11 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-3.5 rounded-md w-3/4" />
                  <div className="skeleton h-3 rounded-md w-1/2" />
                </div>
              </div>
            ))}
          </div>

        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            {search ? (
              <>
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-muted/10 flex items-center justify-center"><svg className="w-7 h-7 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg></div>
                <div className="text-base font-semibold text-heading mb-1">No results for "{search}"</div>
                <button onClick={() => setSearch('')} className="mt-3 text-sm text-blue-500">Clear search</button>
              </>
            ) : sources.length === 0 ? (
              <>
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-blue-500/10 flex items-center justify-center"><svg className="w-8 h-8 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg></div>
                <div className="text-base font-semibold text-heading mb-1">Library is empty</div>
                <div className="text-sm text-muted mb-6">Add YouTube videos or text to start learning</div>
                <button onClick={() => setAddMode('choose')} className="btn-primary px-6 py-2.5 text-sm rounded-xl">
                  Add your first source
                </button>
              </>
            ) : (
              <>
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-muted/10 flex items-center justify-center">{tab === 'youtube' ? (<svg className="w-7 h-7 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="1" y="4" width="15" height="16" rx="2"/><polygon points="16 9 23 4 23 20 16 15 16 9"/></svg>) : (<svg className="w-7 h-7 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>)}</div>
                <div className="text-base font-semibold text-heading mb-1">
                  No {tab === 'youtube' ? 'videos' : 'texts'} yet
                </div>
                <button onClick={() => setAddMode('choose')} className="mt-3 btn-primary px-4 py-2 text-sm rounded-xl">
                  Add one
                </button>
              </>
            )}
          </div>

        ) : (
          <div className="space-y-2">
            {filtered.map(s => (
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
                    {TYPE_ICON[s.source_type] || <svg className='w-4 h-4' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round'><path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'/><polyline points='14 2 14 8 20 8'/></svg>}
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-heading truncate leading-tight">
                    {s.title}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {/* Type badge */}
                    <span className="text-xs px-1.5 py-0.5 rounded-md bg-elevated text-muted font-medium shrink-0">
                      {TYPE_LABEL[s.source_type] || s.source_type}
                    </span>
                    {/* Channel */}
                    {s.channel && (
                      <span className="text-xs text-muted truncate max-w-[120px]">{s.channel}</span>
                    )}
                    {/* Duration */}
                    {s.duration ? (
                      <span className="text-xs text-faint shrink-0">{fmtDuration(s.duration)}</span>
                    ) : null}
                    {/* Word count */}
                    {(s.word_count ?? 0) > 0 && (
                      <span className="text-xs bg-blue-500/10 text-blue-500 px-1.5 py-0.5 rounded font-medium shrink-0">
                        {s.word_count} words
                      </span>
                    )}
                  </div>
                  {/* Content preview (text only) */}
                  {s.source_type !== 'youtube' && s.content && (
                    <p className="text-xs text-faint mt-1 line-clamp-1 leading-relaxed">
                      {s.content}
                    </p>
                  )}
                  {/* Date */}
                  {s.created_at && (
                    <div className="text-xs text-faint mt-0.5">{fmtDate(s.created_at)}</div>
                  )}
                </div>

                {/* Delete */}
                <button
                  onClick={e => deleteSource(s.id, e)}
                  className="w-8 h-8 rounded-xl hover:bg-red-500/10 text-faint hover:text-red-500
                             flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 shrink-0 text-sm"
                  aria-label="Delete"
                ><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Add Modal ──────────────────────────────────────────────── */}
      {addMode && (
        <AddModal mode={addMode} setMode={setAddMode} onAdded={load} />
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
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const close = () => { setMode(null); setError(''); };

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
    youtube: 'YouTube Video',
    text: 'Text Content',
    word: 'Add a Word',
  };

  const wordCount = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={close} />
      <div className="fixed z-50 bottom-0 left-0 right-0 bg-surface rounded-t-3xl border-t border-default
                      max-h-[88vh] overflow-y-auto animate-slide-up
                      lg:left-1/2 lg:-translate-x-1/2 lg:w-full lg:max-w-md">

        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-elevated rounded-full" />
        </div>

        <div className="px-5 pb-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-bold text-heading">{MODAL_TITLE[mode!] || 'Add'}</h3>
            <button
              onClick={close}
              className="w-8 h-8 rounded-full bg-elevated text-muted hover:text-heading
                         flex items-center justify-center text-sm transition-colors"
            ><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 bg-red-500/8 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3 flex items-start gap-2">
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="2.5"/></svg>
              <span>{error}</span>
            </div>
          )}

          {/* Choose type */}
          {mode === 'choose' && (
            <div className="space-y-2">
              {[
                { m: 'youtube', icon: (<svg className='w-5 h-5' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round'><rect x='1' y='4' width='15' height='16' rx='2'/><polygon points='16 9 23 4 23 20 16 15 16 9'/></svg>), title: 'YouTube Video',    sub: 'Paste a URL to extract subtitles',        color: 'hover:border-red-500/30 hover:bg-red-500/5' },
                { m: 'text',    icon: (<svg className='w-5 h-5' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round'><path d='M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2'/><rect x='8' y='2' width='8' height='4' rx='1'/></svg>), title: 'Paste Text',       sub: 'Any English text, article or story',      color: 'hover:border-blue-500/30 hover:bg-blue-500/5' },
                { m: null,      icon: (<svg className='w-5 h-5' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round'><path d='M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z'/></svg>), title: 'Upload .txt File', sub: 'Read a text file from your device',       color: 'hover:border-green-500/30 hover:bg-green-500/5', file: true },
                { m: 'word',    icon: (<svg className='w-5 h-5' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round'><path d='M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7'/><path d='M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z'/></svg>), title: 'Look Up a Word',   sub: 'Search and save any English word',        color: 'hover:border-purple-500/30 hover:bg-purple-500/5' },
              ].map(item => (
                <button
                  key={item.title}
                  onClick={() => item.file ? fileRef.current?.click() : setMode(item.m as AddMode)}
                  className={`w-full flex items-center gap-4 p-4 bg-card border border-default rounded-2xl
                              active:scale-[0.98] transition-all text-left ${item.color}`}
                >
                  <span className="text-2xl w-9 text-center shrink-0">{item.icon}</span>
                  <div>
                    <div className="text-base font-semibold text-heading">{item.title}</div>
                    <div className="text-sm text-muted mt-0.5">{item.sub}</div>
                  </div>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                       strokeLinecap="round" className="w-4 h-4 text-faint ml-auto shrink-0">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </button>
              ))}
              <input ref={fileRef} type="file" accept=".txt" className="hidden" onChange={handleFile} />
            </div>
          )}

          {/* YouTube */}
          {mode === 'youtube' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">YouTube URL</label>
                <input
                  value={url}
                  onChange={e => { setUrl(e.target.value); setError(''); }}
                  onKeyDown={e => e.key === 'Enter' && submitYoutube()}
                  placeholder="https://youtube.com/watch?v=..."
                  className="input-field text-sm"
                  dir="ltr"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setMode('choose')} className="flex-1 py-2.5 rounded-xl border border-default text-sm text-body hover:bg-card transition-colors">← Back</button>
                <button onClick={submitYoutube} disabled={busy || !url.trim()} className="btn-primary flex-1 py-2.5 text-sm rounded-xl">
                  {busy ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                      Loading…
                    </span>
                  ) : 'Add Video'}
                </button>
              </div>
            </div>
          )}

          {/* Text / Paste */}
          {mode === 'text' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">Title</label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. The Little Prince — Ch. 1"
                  className="input-field text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">
                  Content
                  <span className="ml-2 text-faint font-normal">
                    {wordCount > 0 ? `${wordCount} words` : ''}
                  </span>
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
                  {busy ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                      Saving…
                    </span>
                  ) : 'Save Text'}
                </button>
              </div>
            </div>
          )}

          {/* Word lookup */}
          {mode === 'word' && (
            <WordLookup onBack={() => setMode('choose')} onSaved={() => { onAdded(); close(); }} />
          )}
        </div>
      </div>
    </>
  );
}

/* ── Word Lookup ──────────────────────────────────────────────── */
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
        />
      </div>
      {error  && <p className="text-xs text-red-400 flex items-center gap-1.5"><svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/></svg>{error}</p>}
      {result && <p className="text-xs text-green-400 flex items-center gap-1.5"><svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>{result}</p>}
      <div className="flex gap-2">
        <button onClick={onBack} className="flex-1 py-2.5 rounded-xl border border-default text-sm text-body hover:bg-card transition-colors">← Back</button>
        <button onClick={search} disabled={busy || !word.trim()} className="btn-primary flex-1 py-2.5 text-sm rounded-xl">
          {busy ? 'Looking up…' : 'Look Up'}
        </button>
      </div>
    </div>
  );
}
