/**
 * CoreLibraryView — Core English 3000 built-in vocabulary browser.
 *
 * Features:
 *  · Browse 3000 essential English words organised by CEFR level
 *  · Search by word, definition, or Arabic translation
 *  · Filter by CEFR level (A1–C2) and part of speech
 *  · Per-word SM-2 progress tracking (identical to normal vocabulary)
 *  · Start review sessions from any level or the full library
 *  · Full word detail view (definition, synonyms, examples, collocations)
 *  · Integrates with existing Practice tab (Review + Quiz + Games)
 */

import React, {
  useState, useEffect, useCallback, useRef, useMemo
} from 'react';
import { coreApi, vocabularyApi } from '@/lib/api';
import { useStore } from '@/store/appStore';
import { awardXP } from '@/components/common/XPBar';
import * as sfx from '@/lib/sfx';
import { applyLocalSM2 } from '@/lib/offlineStore';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CoreWord {
  id: string;
  word: string;
  pronunciation?: string;
  part_of_speech?: string;
  level: string;
  freq_rank: number;
  meaning_en: string;
  meaning_ar: string;
  synonyms?: string[];
  antonyms?: string[];
  collocations?: string[];
  example?: string;
  progress?: {
    status: 'new' | 'learning' | 'reviewing' | 'learned';
    ease_factor: number;
    interval: number;
    repetitions: number;
    lapses: number;
    reviewed_count: number;
    next_review?: string;
  } | null;
}

interface Progress {
  total_words: number;
  started: number;
  learning: number;
  reviewing: number;
  learned: number;
  due_now: number;
  not_started: number;
  by_level: { level: string; started: number; learned: number; total: number }[];
}

const LEVELS  = ['A1','A2','B1','B2','C1','C2'] as const;
const LEVEL_COLORS: Record<string, string> = {
  A1: 'bg-green-500/15 text-green-500 border-green-500/30',
  A2: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  B1: 'bg-blue-500/15 text-blue-500 border-blue-500/30',
  B2: 'bg-indigo-500/15 text-indigo-500 border-indigo-500/30',
  C1: 'bg-purple-500/15 text-purple-500 border-purple-500/30',
  C2: 'bg-rose-500/15 text-rose-500 border-rose-500/30',
};
const STATUS_DOT: Record<string, string> = {
  new:       'bg-muted',
  learning:  'bg-amber-400',
  reviewing: 'bg-blue-400',
  learned:   'bg-green-400',
};

type Tab = 'browse' | 'review' | 'progress';

// ══════════════════════════════════════════════════════════════════════════════
export default function CoreLibraryView() {
  const { setPage } = useStore();
  const [tab, setTab] = useState<Tab>('browse');

  return (
    <div className="flex flex-col h-full bg-base">

      {/* Header */}
      <div className="shrink-0 px-4 pt-5 pb-0 border-b border-subtle">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600
                            flex items-center justify-center shadow-sm shrink-0">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-heading tracking-tight">Core English 3000</h1>
              <p className="text-xs text-muted">Essential vocabulary for every learner</p>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 bg-elevated rounded-2xl p-1">
            {([
              { id: 'browse'   as Tab, label: 'Browse' },
              { id: 'review'   as Tab, label: 'Review' },
              { id: 'progress' as Tab, label: 'Progress' },
            ]).map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
                  tab === t.id ? 'bg-base text-heading shadow-card' : 'text-muted hover:text-body'
                }`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-none">
        {tab === 'browse'   && <BrowseTab />}
        {tab === 'review'   && <ReviewTab />}
        {tab === 'progress' && <ProgressTab />}
      </div>
    </div>
  );
}

// ── Browse Tab ────────────────────────────────────────────────────────────────

function BrowseTab() {
  const [words,      setWords]      = useState<CoreWord[]>([]);
  const [total,      setTotal]      = useState(0);
  const [page,       setPage_]      = useState(1);
  const [loading,    setLoading]    = useState(false);
  const [search,     setSearch]     = useState('');
  const [level,      setLevel]      = useState('');
  const [sort,       setSort]       = useState('freq');
  const [selected,   setSelected]   = useState<CoreWord | null>(null);

  const searchRef = useRef<ReturnType<typeof setTimeout>>();

  const load = useCallback(async (pg = 1, srch = search, lvl = level, srt = sort) => {
    setLoading(true);
    try {
      const res = await coreApi.listWords({
        search: srch || undefined, level: lvl || undefined,
        page: pg, limit: 50, sort: srt,
      });
      if (pg === 1) setWords(res.words || []);
      else setWords(prev => [...prev, ...(res.words || [])]);
      setTotal(res.total || 0);
      setPage_(pg);
    } catch { /* noop */ }
    setLoading(false);
  }, [search, level, sort]);

  useEffect(() => { load(1, search, level, sort); }, [level, sort]); // eslint-disable-line

  const handleSearch = (v: string) => {
    setSearch(v);
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => load(1, v, level, sort), 350);
  };

  const hasMore = words.length < total;

  return (
    <div className="max-w-lg mx-auto px-4 py-4 pb-28">

      {/* Search */}
      <div className="relative mb-3">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted"
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          value={search} onChange={e => handleSearch(e.target.value)}
          placeholder="Search words, definitions, Arabic…"
          className="input-field pl-10 text-sm"
        />
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-none pb-1">
        <button onClick={() => setLevel('')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 border transition-all ${
            !level ? 'bg-blue-600 text-white border-blue-600' : 'bg-card border-default text-muted hover:text-body'
          }`}>All</button>
        {LEVELS.map(l => (
          <button key={l} onClick={() => setLevel(level === l ? '' : l)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 border transition-all ${
              level === l
                ? 'bg-blue-600 text-white border-blue-600'
                : `${LEVEL_COLORS[l]} border`
            }`}>{l}</button>
        ))}
        <select value={sort} onChange={e => setSort(e.target.value)}
          className="ml-auto px-2 py-1.5 rounded-xl text-xs bg-card border border-default text-body shrink-0">
          <option value="freq">Frequency</option>
          <option value="alpha">A → Z</option>
          <option value="level">Level</option>
        </select>
      </div>

      {/* Count */}
      <p className="text-xs text-muted mb-3">{total.toLocaleString()} words</p>

      {/* Word list */}
      {loading && words.length === 0 ? (
        <div className="space-y-2">
          {[...Array(8)].map((_,i) => <div key={i} className="skeleton h-16 rounded-2xl"/>)}
        </div>
      ) : (
        <div className="space-y-2">
          {words.map(w => (
            <WordCard key={w.id} word={w} onClick={() => setSelected(w)} />
          ))}
          {hasMore && (
            <button onClick={() => load(page + 1)}
              disabled={loading}
              className="w-full py-3 rounded-2xl border border-default text-sm text-muted
                         hover:bg-card transition-colors disabled:opacity-40">
              {loading ? 'Loading…' : `Load more (${total - words.length} remaining)`}
            </button>
          )}
        </div>
      )}

      {/* Word detail sheet */}
      {selected && (
        <WordDetailSheet word={selected} onClose={() => setSelected(null)}
          onProgressUpdate={(id, q) => {
            coreApi.review(id, q).catch(() => {});
            awardXP(q >= 4 ? 'review_perfect' : 'review_word');
            sfx.correct();
            setWords(prev => prev.map(w => w.id === id ? {
              ...w,
              progress: {
                ...(w.progress || { status: 'new', ease_factor: 2.5, interval: 0, repetitions: 0, lapses: 0, reviewed_count: 0 }),
                status: q >= 3 ? 'reviewing' : 'learning',
                reviewed_count: (w.progress?.reviewed_count || 0) + 1,
              }
            } : w));
          }}
        />
      )}
    </div>
  );
}

// ── Word Card ─────────────────────────────────────────────────────────────────

function WordCard({ word: w, onClick }: { word: CoreWord; onClick: () => void }) {
  const status = w.progress?.status || 'new';
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-3 bg-card border border-default rounded-2xl
                 px-4 py-3.5 text-left hover:border-blue-500/30 hover:bg-blue-500/4
                 active:scale-[0.99] transition-all group">
      {/* Status dot */}
      <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[status]}`} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-base font-bold text-heading">{w.word}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded-md border font-semibold ${LEVEL_COLORS[w.level]}`}>
            {w.level}
          </span>
          {w.part_of_speech && (
            <span className="text-xs text-faint italic">{w.part_of_speech}</span>
          )}
        </div>
        <p className="text-sm text-body truncate">{w.meaning_en}</p>
        {w.meaning_ar && (
          <p className="text-xs text-muted truncate" style={{ direction: 'rtl', fontFamily: "'Segoe UI', 'Noto Sans Arabic', sans-serif" }}>
            {w.meaning_ar}
          </p>
        )}
      </div>

      <svg className="w-4 h-4 text-faint group-hover:translate-x-0.5 transition-transform shrink-0"
        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </button>
  );
}

// ── Word Detail Sheet ─────────────────────────────────────────────────────────

function WordDetailSheet({ word: w, onClose, onProgressUpdate }: {
  word: CoreWord;
  onClose: () => void;
  onProgressUpdate: (id: string, quality: number) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  const handleSave = async () => {
    if (saving || saved) return;
    setSaving(true);
    try {
      await vocabularyApi.save(w.word, undefined, w.example || '', `Core English 3000 — ${w.level}`);
      setSaved(true);
      sfx.save();
      awardXP('save_word');
    } catch { /* noop */ }
    setSaving(false);
  };

  const handleRate = (q: number) => {
    onProgressUpdate(w.id, q);
  };

  return (
    <div className="fixed inset-0 z-[60]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="absolute bottom-0 left-0 right-0 bg-surface rounded-t-3xl
                      max-h-[90vh] overflow-y-auto z-[70] border-t border-default"
        onClick={e => e.stopPropagation()}>

        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 sticky top-0 bg-surface z-10">
          <div className="w-10 h-1 bg-elevated rounded-full" />
        </div>

        <div className="px-5 pb-8 pt-2 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-3xl font-bold text-heading tracking-tight">{w.word}</h2>
                <span className={`text-xs px-2 py-0.5 rounded-lg border font-bold ${LEVEL_COLORS[w.level]}`}>
                  {w.level}
                </span>
              </div>
              {w.pronunciation && (
                <p className="text-sm text-muted font-mono">{w.pronunciation}</p>
              )}
              {w.part_of_speech && (
                <span className="inline-block mt-1 text-xs px-2 py-0.5 bg-blue-500/10 text-blue-500 rounded-lg font-medium">
                  {w.part_of_speech}
                </span>
              )}
            </div>
            <button onClick={onClose}
              className="w-8 h-8 rounded-full bg-elevated text-muted flex items-center justify-center">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>

          {/* Arabic */}
          {w.meaning_ar && (
            <div className="bg-blue-500/6 border border-blue-500/15 rounded-2xl p-3.5">
              <p className="text-xs text-blue-400/70 uppercase tracking-wider mb-1">Arabic</p>
              <p className="text-lg font-semibold text-heading text-right"
                style={{ direction: 'rtl', fontFamily: "'Segoe UI', 'Noto Sans Arabic', sans-serif" }}>
                {w.meaning_ar}
              </p>
            </div>
          )}

          {/* English definition */}
          <div className="bg-card border border-default rounded-2xl p-3.5">
            <p className="text-xs text-muted uppercase tracking-wider mb-1">Definition</p>
            <p className="text-base text-heading leading-relaxed">{w.meaning_en}</p>
          </div>

          {/* Example */}
          {w.example && (
            <div className="bg-elevated/50 rounded-2xl p-3.5">
              <p className="text-xs text-muted uppercase tracking-wider mb-1">Example</p>
              <p className="text-sm text-body italic leading-relaxed">"{w.example}"</p>
            </div>
          )}

          {/* Synonyms */}
          {(w.synonyms?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs text-muted uppercase tracking-wider mb-2">Synonyms</p>
              <div className="flex flex-wrap gap-1.5">
                {w.synonyms!.slice(0, 8).map(s => (
                  <span key={s} className="text-xs px-2.5 py-1 bg-green-500/8 border border-green-500/20
                                           text-green-500 rounded-xl font-medium">{s}</span>
                ))}
              </div>
            </div>
          )}

          {/* Antonyms */}
          {(w.antonyms?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs text-muted uppercase tracking-wider mb-2">Antonyms</p>
              <div className="flex flex-wrap gap-1.5">
                {w.antonyms!.slice(0, 6).map(a => (
                  <span key={a} className="text-xs px-2.5 py-1 bg-red-500/8 border border-red-500/20
                                           text-red-400 rounded-xl font-medium">{a}</span>
                ))}
              </div>
            </div>
          )}

          {/* Collocations */}
          {(w.collocations?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs text-muted uppercase tracking-wider mb-2">Common Phrases</p>
              <div className="space-y-1">
                {w.collocations!.slice(0, 5).map(c => (
                  <p key={c} className="text-sm text-body">
                    <span className="text-heading font-medium">→</span> {c}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* SM-2 quick review */}
          <div className="pt-2 border-t border-subtle">
            <p className="text-xs text-muted text-center mb-3">Rate your knowledge of this word</p>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {[
                { q: 0, label: 'Again', hint: '10m', cls: 'border-red-500/30 bg-red-500/8 text-red-400' },
                { q: 2, label: 'Hard',  hint: '30m', cls: 'border-orange-500/30 bg-orange-500/8 text-orange-400' },
                { q: 3, label: 'Good',  hint: '1d',  cls: 'border-blue-500/30 bg-blue-500/8 text-blue-400' },
                { q: 5, label: 'Easy',  hint: '4d+', cls: 'border-green-500/30 bg-green-500/8 text-green-400' },
              ].map(r => (
                <button key={r.q} onClick={() => handleRate(r.q)}
                  className={`flex flex-col items-center gap-1 py-3 rounded-2xl border
                              transition-all active:scale-95 ${r.cls}`}>
                  <span className="text-sm font-bold">{r.label}</span>
                  <span className="text-xs opacity-70">{r.hint}</span>
                </button>
              ))}
            </div>

            {/* Save to vocabulary */}
            {saved ? (
              <div className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl
                              bg-green-500/10 border border-green-500/25 text-green-500 text-sm font-medium">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Saved to vocabulary
              </div>
            ) : (
              <button onClick={handleSave} disabled={saving}
                className="w-full btn-primary py-3 text-sm">
                {saving ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                    Saving…
                  </span>
                ) : '+ Save to my vocabulary'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Review Tab ────────────────────────────────────────────────────────────────

function ReviewTab() {
  const [dueWords,  setDueWords]  = useState<CoreWord[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [level,     setLevel]     = useState('');
  const [idx,       setIdx]       = useState(0);
  const [flipped,   setFlipped]   = useState(false);
  const [done,      setDone]      = useState(0);
  const [session,   setSession]   = useState<CoreWord[]>([]);
  const [reviewing, setReviewing] = useState(false);

  const loadDue = useCallback(async (lvl = level) => {
    setLoading(true);
    try {
      const res = await coreApi.getDueWords(50, lvl || undefined);
      setDueWords(res.words || []);
    } catch { /* noop */ }
    setLoading(false);
  }, [level]);

  useEffect(() => { loadDue(); }, []); // eslint-disable-line

  const startSession = (words: CoreWord[], count: number) => {
    setSession(words.slice(0, count));
    setIdx(0); setFlipped(false); setDone(0); setReviewing(true);
  };

  const handleRate = async (q: number) => {
    const current = session[idx];
    if (!current) return;
    try {
      await coreApi.review(current.id, q);
      awardXP(q >= 4 ? 'review_perfect' : 'review_word');
      if (q >= 3) sfx.correct(); else sfx.wrong();
    } catch { /* noop */ }

    if (idx + 1 >= session.length) {
      sfx.complete();
      setReviewing(false);
      setDone(session.length);
      loadDue(level);
    } else {
      setIdx(i => i + 1);
      setFlipped(false);
    }
  };

  if (reviewing) {
    const current = session[idx];
    const pct = Math.round((idx / session.length) * 100);
    return (
      <div className="max-w-lg mx-auto px-4 py-5 pb-28">
        {/* Progress */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-muted mb-1">
            <span>{idx} / {session.length}</span>
            <span>{pct}%</span>
          </div>
          <div className="h-1.5 bg-elevated rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all"
              style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Flashcard */}
        <div className="flashcard-wrap select-none mb-4" onClick={() => { sfx.flip(); setFlipped(v => !v); }}>
          <div className={`flashcard-inner rounded-3xl min-h-[260px] cursor-pointer relative ${flipped ? 'flipped' : ''}`}>
            {/* Front */}
            <div className="flashcard-face bg-card border border-default rounded-3xl p-6 flex flex-col items-center justify-center text-center absolute inset-0 min-h-[260px]">
              <span className={`text-xs px-2 py-0.5 rounded-lg border font-bold mb-3 ${LEVEL_COLORS[current.level]}`}>
                {current.level}
              </span>
              <h2 className="text-4xl font-bold text-heading tracking-tight mb-2">{current.word}</h2>
              {current.pronunciation && (
                <p className="text-sm text-muted font-mono">{current.pronunciation}</p>
              )}
              <p className="text-xs text-faint mt-4">Tap to reveal</p>
            </div>
            {/* Back */}
            <div className="flashcard-back bg-card border border-default rounded-3xl p-6 flex flex-col absolute inset-0 min-h-[260px] overflow-y-auto">
              <p className="text-base font-semibold text-heading leading-relaxed mb-3">{current.meaning_en}</p>
              {current.meaning_ar && (
                <p className="text-sm text-muted text-right mb-3"
                  style={{ direction: 'rtl', fontFamily: "'Segoe UI', 'Noto Sans Arabic', sans-serif" }}>
                  {current.meaning_ar}
                </p>
              )}
              {current.example && (
                <p className="text-sm text-body italic border-t border-subtle pt-3">"{current.example}"</p>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        {flipped ? (
          <div className="grid grid-cols-4 gap-2">
            {[
              { q: 0, label: 'Again', hint: '10m', cls: 'border-red-500/30 bg-red-500/8 text-red-400' },
              { q: 2, label: 'Hard',  hint: '30m', cls: 'border-orange-500/30 bg-orange-500/8 text-orange-400' },
              { q: 3, label: 'Good',  hint: '1d',  cls: 'border-blue-500/30 bg-blue-500/8 text-blue-400' },
              { q: 5, label: 'Easy',  hint: '4d+', cls: 'border-green-500/30 bg-green-500/8 text-green-400' },
            ].map(r => (
              <button key={r.q} onClick={() => handleRate(r.q)}
                className={`flex flex-col items-center gap-1 py-3 rounded-2xl border transition-all active:scale-95 ${r.cls}`}>
                <span className="text-sm font-bold">{r.label}</span>
                <span className="text-xs opacity-70">{r.hint}</span>
              </button>
            ))}
          </div>
        ) : (
          <button onClick={() => { sfx.flip(); setFlipped(true); }}
            className="btn-primary w-full py-4 text-base">
            Show Answer
          </button>
        )}

        <button onClick={() => setReviewing(false)}
          className="w-full mt-3 py-2.5 rounded-2xl border border-default text-sm text-muted hover:bg-card">
          ← Back to menu
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-5 pb-28 space-y-4">

      {/* Level filter */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
        <button onClick={() => { setLevel(''); loadDue(''); }}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 border transition-all ${
            !level ? 'bg-blue-600 text-white border-blue-600' : 'bg-card border-default text-muted'
          }`}>All levels</button>
        {LEVELS.map(l => (
          <button key={l} onClick={() => { setLevel(l); loadDue(l); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 border transition-all ${
              level === l ? 'bg-blue-600 text-white border-blue-600' : `${LEVEL_COLORS[l]} border`
            }`}>{l}</button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_,i) => <div key={i} className="skeleton h-20 rounded-2xl"/>)}
        </div>
      ) : dueWords.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-green-500/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h3 className="text-lg font-bold text-heading mb-1">All caught up!</h3>
          <p className="text-sm text-muted">No Core 3000 words due for review.</p>
          <p className="text-xs text-faint mt-2">Start studying words from the Browse tab first.</p>
        </div>
      ) : (
        <>
          <div className="bg-card border border-default rounded-2xl p-4 text-center">
            <p className="text-3xl font-bold text-heading mb-0.5">{dueWords.length}</p>
            <p className="text-sm text-muted">words due for review</p>
          </div>

          <div className="space-y-2">
            {[5, 15, 30, dueWords.length].filter((n,i,a) => a.indexOf(n) === i && n <= dueWords.length).map(n => (
              <button key={n} onClick={() => startSession(dueWords, n)}
                className="w-full flex items-center justify-between bg-card border border-default
                           rounded-2xl px-4 py-3.5 hover:border-blue-500/30 hover:bg-blue-500/4
                           active:scale-[0.99] transition-all">
                <div className="text-left">
                  <p className="text-sm font-semibold text-heading">
                    {n === dueWords.length ? 'Review all' : `Quick ${n}`}
                  </p>
                  <p className="text-xs text-muted">{n} words · ~{Math.ceil(n * 0.5)} min</p>
                </div>
                <svg className="w-4 h-4 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Progress Tab ──────────────────────────────────────────────────────────────

function ProgressTab() {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    coreApi.getProgress()
      .then(setProgress)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="max-w-lg mx-auto px-4 py-5 space-y-3">
      {[...Array(4)].map((_,i) => <div key={i} className="skeleton h-20 rounded-2xl"/>)}
    </div>
  );

  if (!progress) return null;

  const masteredPct = progress.total_words > 0
    ? Math.round((progress.learned / progress.total_words) * 100)
    : 0;

  return (
    <div className="max-w-lg mx-auto px-4 py-5 pb-28 space-y-4">

      {/* Overall ring */}
      <div className="bg-card border border-default rounded-3xl p-6 flex items-center gap-6">
        <div className="relative w-24 h-24 shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="40" fill="none" stroke="rgb(var(--bg-elevated))" strokeWidth="10"/>
            <circle cx="50" cy="50" r="40" fill="none" stroke="#3b82f6" strokeWidth="10"
              strokeDasharray={`${2 * Math.PI * 40}`}
              strokeDashoffset={`${2 * Math.PI * 40 * (1 - masteredPct / 100)}`}
              strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease' }}/>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-black text-heading">{masteredPct}%</span>
            <span className="text-xs text-faint">mastered</span>
          </div>
        </div>
        <div className="flex-1">
          <h3 className="text-base font-bold text-heading mb-2">Core 3000 Progress</h3>
          <div className="space-y-1">
            {[
              { label: 'Total words',   val: progress.total_words, color: 'text-heading' },
              { label: 'Started',       val: progress.started,     color: 'text-blue-500' },
              { label: 'Mastered',      val: progress.learned,     color: 'text-green-500' },
              { label: 'Due now',       val: progress.due_now,     color: 'text-amber-500' },
            ].map(s => (
              <div key={s.label} className="flex justify-between text-sm">
                <span className="text-muted">{s.label}</span>
                <span className={`font-bold ${s.color}`}>{s.val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* By level */}
      <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">By CEFR Level</h3>
      {LEVELS.map(l => {
        const d = progress.by_level.find(b => b.level === l);
        const total   = d?.total   || 0;
        const learned = d?.learned || 0;
        const started = d?.started || 0;
        const pct = total > 0 ? Math.round((learned / total) * 100) : 0;
        return (
          <div key={l} className="bg-card border border-default rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs px-2 py-0.5 rounded-lg border font-bold ${LEVEL_COLORS[l]}`}>{l}</span>
              <div className="text-right">
                <span className="text-xs text-muted">{learned} / {total} mastered</span>
              </div>
            </div>
            <div className="h-2 bg-elevated rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full transition-all duration-700"
                style={{ width: `${pct}%` }} />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs text-faint">{started - learned} learning</span>
              <span className="text-xs text-faint">{pct}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
