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

// ══════════════════════════════════════════════════════════════════════════════
// REVIEW TAB — full practice system: Flashcards · Quiz · Games
// ══════════════════════════════════════════════════════════════════════════════

type PracticeMode = 'menu' | 'cards' | 'quiz' | 'spelling' | 'scramble' | 'matching';
type SessionMode  = 'smart' | 'new' | 'review' | 'random';
type QuizType     = 'definition' | 'arabic' | 'fillblank';

const RATINGS = [
  { q: 0, label: 'Again', hint: '10m', cls: 'border-red-500/30 bg-red-500/8 text-red-400'       },
  { q: 2, label: 'Hard',  hint: '30m', cls: 'border-orange-500/30 bg-orange-500/8 text-orange-400' },
  { q: 3, label: 'Good',  hint: '1d',  cls: 'border-blue-500/30 bg-blue-500/8 text-blue-400'     },
  { q: 5, label: 'Easy',  hint: '4d+', cls: 'border-green-500/30 bg-green-500/8 text-green-400'  },
] as const;

function shuffle<T>(a: T[]): T[] {
  const c = [...a];
  for (let i = c.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [c[i], c[j]] = [c[j], c[i]];
  }
  return c;
}

function ReviewTab() {
  const [mode,       setMode]       = React.useState<PracticeMode>('menu');
  const [allWords,   setAllWords]   = React.useState<CoreWord[]>([]);
  const [loading,    setLoading]    = React.useState(true);
  const [level,      setLevel]      = React.useState('');
  const [sessMode,   setSessMode]   = React.useState<SessionMode>('smart');
  const [sessCount,  setSessCount]  = React.useState(20);

  const loadWords = React.useCallback(async (lvl = level, sm = sessMode) => {
    setLoading(true);
    try {
      const res = await coreApi.getPracticeWords(sm, lvl || undefined, 200);
      setAllWords(res.words || []);
    } catch { /* noop */ }
    setLoading(false);
  }, [level, sessMode]);

  React.useEffect(() => { loadWords(); }, []); // eslint-disable-line

  const startSession = (practiceMode: PracticeMode) => {
    setMode(practiceMode);
  };

  if (mode === 'cards')    return <FlashcardSession words={allWords.slice(0, sessCount)} onBack={() => { setMode('menu'); loadWords(); }} />;
  if (mode === 'quiz')     return <QuizSession      words={allWords.slice(0, sessCount)} allWords={allWords} onBack={() => { setMode('menu'); loadWords(); }} />;
  if (mode === 'spelling') return <SpellingSession  words={allWords.filter(w => w.word.length >= 4).slice(0, sessCount)} onBack={() => { setMode('menu'); loadWords(); }} />;
  if (mode === 'scramble') return <ScrambleSession  words={allWords.filter(w => w.word.length >= 4 && !w.word.includes(' ')).slice(0, sessCount)} onBack={() => { setMode('menu'); loadWords(); }} />;
  if (mode === 'matching') return <MatchingSession  words={allWords.filter(w => w.meaning_en).slice(0, Math.min(sessCount, 60))} onBack={() => { setMode('menu'); loadWords(); }} />;

  // ── Menu ──────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-lg mx-auto px-4 py-4 pb-28 space-y-4">

      {/* Level + mode filters */}
      <div className="bg-card border border-default rounded-2xl p-4 space-y-3">
        <div>
          <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">CEFR Level</p>
          <div className="flex gap-1.5 flex-wrap">
            <button onClick={() => { setLevel(''); loadWords('', sessMode); }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                !level ? 'bg-blue-600 text-white border-blue-600' : 'bg-elevated border-default text-muted'
              }`}>All</button>
            {LEVELS.map(l => (
              <button key={l} onClick={() => { setLevel(l); loadWords(l, sessMode); }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                  level === l ? 'bg-blue-600 text-white border-blue-600' : `${LEVEL_COLORS[l]} border`
                }`}>{l}</button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Priority</p>
          <div className="flex gap-1.5">
            {([
              { id: 'smart'  as SessionMode, label: 'Smart',   desc: 'Due first' },
              { id: 'new'    as SessionMode, label: 'New',     desc: 'Unseen' },
              { id: 'review' as SessionMode, label: 'Review',  desc: 'In progress' },
              { id: 'random' as SessionMode, label: 'Random',  desc: 'Any' },
            ]).map(m => (
              <button key={m.id} onClick={() => { setSessMode(m.id); loadWords(level, m.id); }}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${
                  sessMode === m.id
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-elevated border-default text-muted hover:text-body'
                }`}>{m.label}</button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Session size</p>
          <div className="flex gap-1.5">
            {[10, 20, 30, 50].map(n => (
              <button key={n} onClick={() => setSessCount(n)}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${
                  sessCount === n
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-elevated border-default text-muted hover:text-body'
                }`}>{n}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Word pool summary */}
      {loading ? (
        <div className="skeleton h-16 rounded-2xl" />
      ) : (
        <div className="bg-card border border-default rounded-2xl px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-heading">{Math.min(sessCount, allWords.length)} words selected</p>
            <p className="text-xs text-muted">
              {allWords.filter(w => w.progress?.status === 'new' || !w.progress).length} new ·{' '}
              {allWords.filter(w => w.progress?.status === 'learning').length} learning ·{' '}
              {allWords.filter(w => w.progress?.status === 'learned').length} mastered
            </p>
          </div>
          <div className={`text-xs px-2 py-1 rounded-lg border font-semibold ${level ? LEVEL_COLORS[level] : 'bg-blue-500/10 text-blue-500 border-blue-500/20'}`}>
            {level || 'All levels'}
          </div>
        </div>
      )}

      {/* Practice modes */}
      <p className="text-xs font-semibold text-muted uppercase tracking-wider">Choose Activity</p>

      <div className="space-y-2.5">

        {/* Flashcards */}
        <button onClick={() => startSession('cards')} disabled={loading || allWords.length === 0}
          className="w-full flex items-center gap-4 bg-card border border-default rounded-2xl p-4
                     hover:border-blue-500/30 hover:bg-blue-500/4 active:scale-[0.98] transition-all
                     text-left group disabled:opacity-40">
          <div className="w-12 h-12 rounded-xl bg-blue-500/12 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <svg className="w-6 h-6 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <rect x="2" y="4" width="20" height="16" rx="3"/>
              <path d="M8 10h8M8 14h5"/>
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-heading">Flashcards</p>
            <p className="text-xs text-muted mt-0.5">Flip cards · Rate Again/Hard/Good/Easy · SM-2 spaced repetition</p>
          </div>
          <svg className="w-4 h-4 text-faint group-hover:translate-x-0.5 transition-transform shrink-0"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>

        {/* Quiz */}
        <button onClick={() => startSession('quiz')} disabled={loading || allWords.length < 4}
          className="w-full flex items-center gap-4 bg-card border border-default rounded-2xl p-4
                     hover:border-purple-500/30 hover:bg-purple-500/4 active:scale-[0.98] transition-all
                     text-left group disabled:opacity-40">
          <div className="w-12 h-12 rounded-xl bg-purple-500/12 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <svg className="w-6 h-6 text-purple-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
              <line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="2.5"/>
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-heading">Multiple Choice Quiz</p>
            <p className="text-xs text-muted mt-0.5">Pick the correct definition or translation</p>
          </div>
          <svg className="w-4 h-4 text-faint group-hover:translate-x-0.5 transition-transform shrink-0"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>

        {/* Spelling Bee */}
        <button onClick={() => startSession('spelling')} disabled={loading || allWords.filter(w => w.word.length >= 4).length < 4}
          className="w-full flex items-center gap-4 bg-card border border-default rounded-2xl p-4
                     hover:border-amber-500/30 hover:bg-amber-500/4 active:scale-[0.98] transition-all
                     text-left group disabled:opacity-40">
          <div className="w-12 h-12 rounded-xl bg-amber-500/12 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <svg className="w-6 h-6 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <rect x="3" y="3" width="18" height="18" rx="3"/>
              <path d="M8 16l2-6 2 6M9.5 13h3"/>
              <path d="M14 8v8M17 8h-3v4h3M17 12h-3"/>
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-heading">Spelling Bee</p>
            <p className="text-xs text-muted mt-0.5">Hear the word · Type it correctly · +5 XP each</p>
          </div>
          <svg className="w-4 h-4 text-faint group-hover:translate-x-0.5 transition-transform shrink-0"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>

        {/* Word Scramble */}
        <button onClick={() => startSession('scramble')} disabled={loading || allWords.filter(w => w.word.length >= 4 && !w.word.includes(' ')).length < 4}
          className="w-full flex items-center gap-4 bg-card border border-default rounded-2xl p-4
                     hover:border-green-500/30 hover:bg-green-500/4 active:scale-[0.98] transition-all
                     text-left group disabled:opacity-40">
          <div className="w-12 h-12 rounded-xl bg-green-500/12 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <svg className="w-6 h-6 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <rect x="2" y="2" width="9" height="9" rx="2"/><rect x="13" y="2" width="9" height="9" rx="2"/>
              <rect x="2" y="13" width="9" height="9" rx="2"/><rect x="13" y="13" width="9" height="9" rx="2"/>
              <path d="M7 7l10 10M17 7L7 17" strokeWidth="2"/>
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-heading">Word Scramble</p>
            <p className="text-xs text-muted mt-0.5">Rearrange shuffled letters to form the word</p>
          </div>
          <svg className="w-4 h-4 text-faint group-hover:translate-x-0.5 transition-transform shrink-0"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>

        {/* Matching Pairs */}
        <button onClick={() => startSession('matching')} disabled={loading || allWords.filter(w => w.meaning_en).length < 6}
          className="w-full flex items-center gap-4 bg-card border border-default rounded-2xl p-4
                     hover:border-cyan-500/30 hover:bg-cyan-500/4 active:scale-[0.98] transition-all
                     text-left group disabled:opacity-40">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/12 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <svg className="w-6 h-6 text-cyan-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <rect x="2" y="4" width="8" height="6" rx="1.5"/>
              <rect x="14" y="4" width="8" height="6" rx="1.5"/>
              <rect x="2" y="14" width="8" height="6" rx="1.5"/>
              <rect x="14" y="14" width="8" height="6" rx="1.5"/>
              <path d="M10 7h4M10 17h4"/>
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-heading">Matching Pairs</p>
            <p className="text-xs text-muted mt-0.5">Match words to definitions — tap to reveal</p>
          </div>
          <svg className="w-4 h-4 text-faint group-hover:translate-x-0.5 transition-transform shrink-0"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// FLASHCARD SESSION
// ══════════════════════════════════════════════════════════════════════════════

function FlashcardSession({ words, onBack }: { words: CoreWord[]; onBack: () => void }) {
  const pool     = React.useMemo(() => shuffle(words), [words]);
  const [idx,    setIdx]    = React.useState(0);
  const [flipped,setFlipped]= React.useState(false);
  const [done,   setDone]   = React.useState(0);
  const [streak, setStreak] = React.useState(0);
  const [finished,setFinished] = React.useState(false);

  const current = pool[idx];
  const total   = pool.length;
  const pct     = Math.round((done / total) * 100);

  const handleRate = React.useCallback(async (q: number) => {
    if (!current) return;
    try {
      await coreApi.review(current.id, q);
      awardXP(q >= 4 ? 'review_perfect' : 'review_word');
    } catch { /* noop */ }
    if (q >= 3) { sfx.correct(); setStreak(s => s + 1); }
    else { sfx.wrong(); setStreak(0); }
    const newDone = done + 1;
    setDone(newDone);
    if (idx + 1 >= total) { sfx.complete(); setFinished(true); }
    else { setIdx(i => i + 1); setFlipped(false); }
  }, [current, done, idx, total]);

  // keyboard
  React.useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); sfx.flip(); setFlipped(v => !v); return; }
      if (!flipped) return;
      const map: Record<string,number> = { '1': 0, '2': 2, '3': 3, '4': 5 };
      if (map[e.key] !== undefined) handleRate(map[e.key]);
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [flipped, handleRate]);

  if (finished) return <SessionComplete score={done} total={total} activity="Flashcards" onBack={onBack} onReplay={() => { setIdx(0); setFlipped(false); setDone(0); setStreak(0); setFinished(false); }} />;

  return (
    <div className="flex flex-col h-full">
      <SessionHeader title="Flashcards" onBack={onBack} idx={idx} total={total} score={streak} label="streak" />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 py-5 pb-28 space-y-4">

          {/* 3D Flashcard */}
          <div className="flashcard-wrap select-none" onClick={() => { sfx.flip(); setFlipped(v => !v); }}>
            <div className={`flashcard-inner rounded-3xl min-h-[280px] cursor-pointer relative ${flipped ? 'flipped' : ''}`}>
              {/* Front */}
              <div className="flashcard-face bg-card border border-default rounded-3xl p-6
                              flex flex-col items-center justify-center text-center absolute inset-0 min-h-[280px]">
                <span className={`text-xs px-2 py-0.5 rounded-lg border font-bold mb-3 ${LEVEL_COLORS[current.level]}`}>
                  {current.level}
                </span>
                {current.part_of_speech && (
                  <span className="text-xs text-muted italic mb-2">{current.part_of_speech}</span>
                )}
                <h2 className="text-4xl font-bold text-heading tracking-tight mb-2">{current.word}</h2>
                {current.pronunciation && (
                  <p className="text-sm text-muted font-mono mb-3">{current.pronunciation}</p>
                )}
                <p className="text-xs text-faint">Tap to reveal · Space to flip</p>
                {/* SM-2 ease bar */}
                <div className="absolute bottom-4 left-4 right-4 h-1 bg-elevated rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${
                    (current.ease_factor ?? 2.5) >= 2.7 ? 'bg-green-500' :
                    (current.ease_factor ?? 2.5) >= 2.0 ? 'bg-blue-500' : 'bg-amber-500'
                  }`} style={{ width: `${Math.round(((( current.ease_factor ?? 2.5) - 1.3) / 1.7) * 100)}%` }} />
                </div>
              </div>
              {/* Back */}
              <div className="flashcard-back bg-card border border-default rounded-3xl p-6
                              flex flex-col absolute inset-0 min-h-[280px] overflow-y-auto">
                <p className="text-xs text-muted uppercase tracking-wider mb-2">Definition</p>
                <p className="text-lg font-semibold text-heading leading-relaxed mb-3">{current.meaning_en}</p>
                {current.meaning_ar && (
                  <p className="text-base text-muted text-right mb-3"
                    style={{ direction: 'rtl', fontFamily: "'Segoe UI', 'Noto Sans Arabic', sans-serif" }}>
                    {current.meaning_ar}
                  </p>
                )}
                {current.example && (
                  <p className="text-sm text-body italic border-t border-subtle pt-3">"{current.example}"</p>
                )}
                {(current.synonyms?.length ?? 0) > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {current.synonyms!.slice(0,4).map(s => (
                      <span key={s} className="text-xs px-2 py-0.5 bg-green-500/8 text-green-500 rounded-lg">{s}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Rating buttons */}
          {!flipped ? (
            <button onClick={() => { sfx.flip(); setFlipped(true); }} className="btn-primary w-full py-4 text-base">
              Show Answer
            </button>
          ) : (
            <div>
              <p className="text-xs text-center text-muted mb-3 font-medium">
                How well did you know it? <span className="text-faint">(keys 1–4)</span>
              </p>
              <div className="grid grid-cols-4 gap-2">
                {RATINGS.map((r, i) => (
                  <button key={r.q} onClick={() => handleRate(r.q)}
                    className={`flex flex-col items-center gap-1 py-3 rounded-2xl border transition-all active:scale-95 ${r.cls}`}>
                    <span className="text-sm font-bold">{r.label}</span>
                    <span className="text-xs opacity-70">{r.hint}</span>
                    <span className="text-xs text-faint">[{i+1}]</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// QUIZ SESSION
// ══════════════════════════════════════════════════════════════════════════════

function QuizSession({ words, allWords, onBack }: { words: CoreWord[]; allWords: CoreWord[]; onBack: () => void }) {
  const pool    = React.useMemo(() => shuffle(words), [words]);
  const [idx,   setIdx]    = React.useState(0);
  const [score, setScore]  = React.useState(0);
  const [picked, setPicked]= React.useState<string | null>(null);
  const [answered, setAnswered] = React.useState(false);
  const [choices, setChoices] = React.useState<CoreWord[]>([]);
  const [qType, setQType]  = React.useState<QuizType>('definition');
  const [done,  setDone]   = React.useState(false);

  const current = pool[idx];
  const total   = pool.length;

  // Build choices for current word
  React.useEffect(() => {
    if (!current) return;
    const distractors = shuffle(allWords.filter(w => w.id !== current.id)).slice(0, 3);
    setChoices(shuffle([current, ...distractors]));
    setPicked(null); setAnswered(false);
    const types: QuizType[] = ['definition'];
    if (current.meaning_ar) types.push('arabic');
    if (current.example && current.example.toLowerCase().includes(current.word.toLowerCase())) types.push('fillblank');
    setQType(types[Math.floor(Math.random() * types.length)]);
  }, [idx, current?.id, allWords]); // eslint-disable-line

  const handlePick = async (id: string) => {
    if (answered) return;
    const correct = id === current.id;
    setPicked(id); setAnswered(true);
    if (correct) { sfx.correct(); setScore(s => s + 1); }
    else sfx.wrong();
    try {
      await coreApi.review(current.id, correct ? 4 : 1);
      awardXP(correct ? 'review_word' : 'game_correct');
    } catch { /* noop */ }
  };

  const next = () => {
    if (idx + 1 >= total) { sfx.complete(); setDone(true); }
    else { setIdx(i => i + 1); }
  };

  if (done) return <SessionComplete score={score} total={total} activity="Quiz" onBack={onBack} onReplay={() => { setIdx(0); setScore(0); setDone(false); }} />;

  const fillBlankSentence = (sentence: string, word: string) => {
    return sentence.replace(new RegExp(word, 'gi'), '________');
  };

  return (
    <div className="flex flex-col h-full">
      <SessionHeader title="Quiz" onBack={onBack} idx={idx} total={total} score={score} label="correct" />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 py-5 pb-28 space-y-4">

          {/* Question card */}
          <div className="bg-card border border-default rounded-3xl p-5 text-center">
            <p className="text-xs text-muted uppercase tracking-wider font-semibold mb-3">
              {qType === 'definition' ? 'What does this word mean?' :
               qType === 'arabic'    ? 'What is the Arabic translation?' :
                                       'Complete the sentence'}
            </p>
            {qType === 'fillblank' && current.example ? (
              <p className="text-base text-heading font-medium leading-relaxed">
                {fillBlankSentence(current.example, current.word)}
              </p>
            ) : (
              <>
                <h2 className="text-4xl font-bold text-heading tracking-tight mb-1">{current.word}</h2>
                {current.pronunciation && <p className="text-sm text-muted font-mono">{current.pronunciation}</p>}
              </>
            )}
          </div>

          {/* Choices */}
          <div className="space-y-2">
            {choices.map((ch, i) => {
              const isCorrect = ch.id === current.id;
              const isPicked  = picked === ch.id;
              const label = qType === 'arabic' ? ch.meaning_ar || ch.word :
                            qType === 'fillblank' ? ch.word :
                            ch.meaning_en || ch.word;
              const style = !answered
                ? 'border-default hover:border-blue-500/30 hover:bg-blue-500/5 active:scale-[0.99]'
                : isCorrect  ? 'border-green-500/50 bg-green-500/10'
                : isPicked   ? 'border-red-500/50 bg-red-500/10'
                : 'border-default opacity-40';
              return (
                <button key={ch.id} onClick={() => handlePick(ch.id)} disabled={answered}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border text-left transition-all ${style}`}>
                  <span className={`w-7 h-7 rounded-xl text-xs font-bold flex items-center justify-center shrink-0 ${
                    !answered ? 'bg-elevated text-muted' :
                    isCorrect ? 'bg-green-500/20 text-green-500' :
                    isPicked  ? 'bg-red-500/20 text-red-500' :
                    'bg-elevated text-faint'
                  }`}>{i+1}</span>
                  <span className="text-sm flex-1 text-heading leading-snug"
                    style={qType === 'arabic' ? { direction: 'rtl', fontFamily: "'Noto Sans Arabic', sans-serif" } : {}}>
                    {label}
                  </span>
                  {answered && isCorrect && <svg className="w-4 h-4 text-green-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                  {answered && isPicked && !isCorrect && <svg className="w-4 h-4 text-red-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>}
                </button>
              );
            })}
          </div>

          {/* Feedback + Next */}
          {answered && (
            <>
              <div className={`rounded-2xl p-4 border ${picked === current.id ? 'bg-green-500/8 border-green-500/25' : 'bg-red-500/8 border-red-500/25'}`}>
                <p className={`text-sm font-bold mb-1 ${picked === current.id ? 'text-green-400' : 'text-red-400'}`}>
                  {picked === current.id ? 'Correct!' : 'Incorrect'}
                </p>
                {picked !== current.id && (
                  <p className="text-sm text-muted">Answer: <span className="font-semibold text-heading">{current.meaning_en}</span></p>
                )}
                {current.example && (
                  <p className="text-sm text-body mt-2 italic border-t border-default/40 pt-2">"{current.example}"</p>
                )}
              </div>
              <button onClick={next} className="btn-primary w-full py-3.5 text-sm">
                {idx + 1 >= total ? 'See Results' : 'Next →'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SPELLING SESSION
// ══════════════════════════════════════════════════════════════════════════════

function SpellingSession({ words, onBack }: { words: CoreWord[]; onBack: () => void }) {
  const pool     = React.useMemo(() => shuffle(words), [words]);
  const [idx,    setIdx]    = React.useState(0);
  const [input,  setInput]  = React.useState('');
  const [result, setResult] = React.useState<'correct'|'wrong'|null>(null);
  const [score,  setScore]  = React.useState(0);
  const [done,   setDone]   = React.useState(false);
  const [hint,   setHint]   = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const current = pool[idx];
  const total   = pool.length;

  const speakWord = React.useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(current.word);
      u.rate = 0.75; u.lang = 'en-US';
      speechSynthesis.speak(u);
    }
  }, [current]);

  React.useEffect(() => { if (current) { setHint(false); setTimeout(speakWord, 300); } }, [idx]); // eslint-disable-line

  const submit = () => {
    if (!input.trim() || result) return;
    const ok = input.trim().toLowerCase() === current.word.toLowerCase();
    setResult(ok ? 'correct' : 'wrong');
    if (ok) { sfx.correct(); setScore(s => s+1); awardXP('game_spelling'); coreApi.review(current.id, 4).catch(() => {}); }
    else { sfx.wrong(); coreApi.review(current.id, 1).catch(() => {}); }
  };

  const next = () => {
    if (idx + 1 >= total) { sfx.complete(); setDone(true); return; }
    setIdx(i => i+1); setInput(''); setResult(null);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  if (done) return <SessionComplete score={score} total={total} activity="Spelling Bee" onBack={onBack} onReplay={() => { setIdx(0); setInput(''); setResult(null); setScore(0); setDone(false); }} />;

  const TILE_COLORS = ['text-blue-400','text-purple-400','text-green-400','text-orange-400','text-pink-400','text-cyan-400'];

  return (
    <div className="flex flex-col h-full">
      <SessionHeader title="Spelling Bee" onBack={onBack} idx={idx} total={total} score={score} label="correct" />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto px-4 py-5 pb-28 space-y-5">

          {/* Definition + listen */}
          <div className="bg-card border border-default rounded-3xl p-6 text-center">
            <button onClick={speakWord}
              className="w-16 h-16 rounded-2xl bg-blue-500/10 hover:bg-blue-500/18 text-blue-500
                         flex items-center justify-center mx-auto mb-4 transition-colors active:scale-95">
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" opacity="0.9"/>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
              </svg>
            </button>
            <p className="text-sm text-muted mb-2">Listen and type the word</p>
            <p className="text-base text-body leading-relaxed font-medium">{current.meaning_en}</p>
            {current.meaning_ar && (
              <p className="text-sm text-muted mt-1.5 text-right"
                style={{ direction: 'rtl', fontFamily: "'Noto Sans Arabic', sans-serif" }}>
                {current.meaning_ar}
              </p>
            )}
            {!hint ? (
              <button onClick={() => setHint(true)} className="mt-3 text-xs text-faint hover:text-muted">
                Show hint
              </button>
            ) : (
              <p className="mt-3 text-sm text-muted font-mono tracking-widest">
                {current.word[0]}{'_'.repeat(current.word.length - 1)} ({current.word.length} letters)
              </p>
            )}
            {result && (
              <div className={`mt-4 rounded-2xl p-3 border ${result === 'correct' ? 'bg-green-500/10 border-green-500/25' : 'bg-red-500/10 border-red-500/25'}`}>
                <p className={`font-bold text-base ${result === 'correct' ? 'text-green-400' : 'text-red-400'}`}>
                  {result === 'correct' ? 'Correct! +5 XP' : `The word was: "${current.word}"`}
                </p>
              </div>
            )}
          </div>

          {/* Letter tiles (on correct) */}
          {result === 'correct' && (
            <div className="flex flex-wrap justify-center gap-1.5">
              {current.word.split('').map((l, i) => (
                <span key={i} className={`w-9 h-9 rounded-xl bg-card border border-default flex items-center justify-center text-sm font-bold ${TILE_COLORS[i % TILE_COLORS.length]}`}>
                  {l.toUpperCase()}
                </span>
              ))}
            </div>
          )}

          {/* Input */}
          {!result && (
            <div className="flex gap-2">
              <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submit()}
                placeholder="Type the word…" autoComplete="off" autoCapitalize="none" spellCheck={false}
                className="input-field flex-1 text-lg tracking-wider" autoFocus />
              <button onClick={submit}
                className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-500
                           flex items-center justify-center hover:bg-blue-500/18 transition-colors">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </button>
            </div>
          )}

          {result && (
            <button onClick={next} className="btn-primary w-full py-3.5 text-sm">
              {idx + 1 >= total ? 'See Results' : 'Next →'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SCRAMBLE SESSION
// ══════════════════════════════════════════════════════════════════════════════

function ScrambleSession({ words, onBack }: { words: CoreWord[]; onBack: () => void }) {
  const pool    = React.useMemo(() => shuffle(words), [words]);
  const [idx,   setIdx]    = React.useState(0);
  const [tiles, setTiles]  = React.useState<string[]>([]);
  const [sel,   setSel]    = React.useState<number[]>([]);
  const [result,setResult] = React.useState<'correct'|'wrong'|null>(null);
  const [score, setScore]  = React.useState(0);
  const [done,  setDone]   = React.useState(false);

  const current = pool[idx]; const total = pool.length;
  const TILE_COLORS = ['bg-blue-500/15 text-blue-300','bg-purple-500/15 text-purple-300','bg-green-500/15 text-green-300','bg-orange-500/15 text-orange-300','bg-pink-500/15 text-pink-300','bg-cyan-500/15 text-cyan-300'];

  const init = React.useCallback((w: CoreWord) => { setTiles(shuffle(w.word.split(''))); setSel([]); setResult(null); }, []);
  React.useEffect(() => { if (current) init(current); }, [idx]); // eslint-disable-line

  const guess = sel.map(i => tiles[i]).join('');
  React.useEffect(() => {
    if (!current || result || sel.length !== current.word.length || sel.length < 2) return;
    const t = setTimeout(() => {
      const ok = guess.toLowerCase() === current.word.toLowerCase();
      setResult(ok ? 'correct' : 'wrong');
      if (ok) { sfx.correct(); setScore(s => s+1); awardXP('game_scramble'); coreApi.review(current.id, 4).catch(() => {}); }
      else { sfx.wrong(); coreApi.review(current.id, 1).catch(() => {}); }
    }, 150);
    return () => clearTimeout(t);
  }, [sel, current, guess, result]); // eslint-disable-line

  const next = () => {
    if (idx + 1 >= total) { sfx.complete(); setDone(true); return; }
    setIdx(i => i+1);
  };

  if (done) return <SessionComplete score={score} total={total} activity="Word Scramble" onBack={onBack} onReplay={() => { setIdx(0); setScore(0); setDone(false); init(pool[0]); }} />;

  return (
    <div className="flex flex-col h-full">
      <SessionHeader title="Word Scramble" onBack={onBack} idx={idx} total={total} score={score} label="correct" />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto px-4 py-5 pb-28 space-y-5">
          {/* Definition */}
          <div className="bg-card border border-default rounded-3xl p-5 text-center">
            <p className="text-xs text-muted uppercase tracking-wider mb-2">What word is this?</p>
            <p className="text-base text-heading font-medium leading-relaxed">{current.meaning_en}</p>
            {current.meaning_ar && (
              <p className="text-sm text-muted mt-2 text-right"
                style={{ direction: 'rtl', fontFamily: "'Noto Sans Arabic', sans-serif" }}>
                {current.meaning_ar}
              </p>
            )}
          </div>
          {/* Answer slots */}
          <div className="flex justify-center gap-1.5 flex-wrap min-h-[44px]">
            {current.word.split('').map((_, i) => (
              <span key={i} className={`w-10 h-10 rounded-xl border flex items-center justify-center text-sm font-bold transition-all ${
                sel[i] !== undefined
                  ? TILE_COLORS[sel[i] % TILE_COLORS.length] + ' border-transparent'
                  : 'border-dashed border-elevated text-faint'
              }`}>
                {sel[i] !== undefined ? tiles[sel[i]].toUpperCase() : ''}
              </span>
            ))}
          </div>
          {/* Result */}
          {result && (
            <div className={`rounded-2xl p-4 border text-center ${result === 'correct' ? 'bg-green-500/10 border-green-500/25' : 'bg-red-500/10 border-red-500/25'}`}>
              <p className={`font-bold text-base ${result === 'correct' ? 'text-green-400' : 'text-red-400'}`}>
                {result === 'correct' ? `"${current.word}" — Correct! +4 XP` : `Answer: "${current.word}"`}
              </p>
            </div>
          )}
          {/* Letter tiles */}
          <div className="flex flex-wrap justify-center gap-2">
            {tiles.map((l, i) => {
              const isSel = sel.includes(i);
              return (
                <button key={i} disabled={!!result}
                  onClick={() => {
                    sfx.tap();
                    if (isSel) setSel(prev => prev.filter(x => x !== i));
                    else setSel(prev => [...prev, i]);
                  }}
                  className={`w-11 h-11 rounded-2xl text-base font-bold transition-all active:scale-90 ${
                    isSel ? 'opacity-40 bg-elevated border border-transparent text-muted scale-95'
                          : TILE_COLORS[i % TILE_COLORS.length] + ' hover:scale-105'
                  }`}>
                  {l.toUpperCase()}
                </button>
              );
            })}
          </div>
          {/* Controls */}
          <div className="flex gap-2">
            {!result ? (
              <>
                <button onClick={() => setSel(prev => prev.slice(0, -1))}
                  className="flex-1 py-3 rounded-2xl border border-default text-sm text-muted hover:bg-card">Remove</button>
                <button onClick={() => { init(current); sfx.tap(); }}
                  className="flex-1 py-3 rounded-2xl border border-default text-sm text-muted hover:bg-card flex items-center justify-center gap-1.5">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                  </svg>Shuffle
                </button>
              </>
            ) : (
              <button onClick={next} className="flex-1 btn-primary py-3.5 text-sm">
                {idx + 1 >= total ? 'See Results' : 'Next →'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MATCHING PAIRS SESSION
// ══════════════════════════════════════════════════════════════════════════════

type MatchCard = { id: string; type: 'word'|'def'; text: string; pairId: string };

function MatchingSession({ words, onBack }: { words: CoreWord[]; onBack: () => void }) {
  const COUNT = 6;
  const [roundWords, setRoundWords] = React.useState<CoreWord[]>([]);
  const [cards,   setCards]   = React.useState<MatchCard[]>([]);
  const [flipped, setFlipped] = React.useState<string[]>([]);
  const [matched, setMatched] = React.useState<string[]>([]);
  const [wrong,   setWrong]   = React.useState<string[]>([]);
  const [moves,   setMoves]   = React.useState(0);
  const [score,   setScore]   = React.useState(0);
  const [done,    setDone]    = React.useState(false);
  const busy = React.useRef(false);

  const init = React.useCallback((wordList: CoreWord[]) => {
    const chosen = shuffle(wordList.filter(w => w.meaning_en)).slice(0, COUNT);
    setRoundWords(chosen);
    const deck: MatchCard[] = [];
    chosen.forEach(w => {
      deck.push({ id: `w_${w.id}`, type: 'word', text: w.word,       pairId: w.id });
      deck.push({ id: `d_${w.id}`, type: 'def',  text: w.meaning_en, pairId: w.id });
    });
    setCards(shuffle(deck));
    setFlipped([]); setMatched([]); setWrong([]);
    setScore(0); setMoves(0); setDone(false);
    busy.current = false;
  }, []);

  React.useEffect(() => { init(words); }, []); // eslint-disable-line

  const tap = React.useCallback((id: string) => {
    if (busy.current || matched.includes(id) || flipped.includes(id)) return;
    const next = [...flipped, id];
    setFlipped(next); sfx.tap();
    if (next.length === 2) {
      busy.current = true; setMoves(m => m+1);
      const [a, b] = next.map(i => cards.find(c => c.id === i)!);
      if (a.pairId === b.pairId) {
        sfx.correct();
        const nm = [...matched, a.id, b.id];
        setMatched(nm); setScore(s => s+1); setFlipped([]);
        busy.current = false;
        awardXP('game_matching');
        coreApi.review(a.pairId, 4).catch(() => {});
        if (nm.length === cards.length) { sfx.complete(); setDone(true); }
      } else {
        sfx.wrong();
        setWrong([a.id, b.id]);
        setTimeout(() => { setFlipped([]); setWrong([]); busy.current = false; }, 900);
      }
    }
  }, [flipped, matched, cards]);

  if (done) return <SessionComplete score={score} total={roundWords.length} activity={`Matching Pairs · ${moves} moves`} onBack={onBack} onReplay={() => init(words)} />;

  const pairsLeft = roundWords.length - matched.length / 2;
  return (
    <div className="flex flex-col h-full">
      <SessionHeader title="Matching Pairs" onBack={onBack} idx={matched.length/2} total={roundWords.length} score={score} label="pairs" />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto px-4 py-4 pb-28">
          <div className="flex justify-between items-center mb-4 text-sm text-muted">
            <span>Tap word → then its definition</span>
            <span className="font-semibold text-heading">{pairsLeft} left</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {cards.map(card => {
              const isFlipped = flipped.includes(card.id);
              const isMatched = matched.includes(card.id);
              const isWrong   = wrong.includes(card.id);
              return (
                <button key={card.id} onClick={() => tap(card.id)} disabled={isMatched}
                  className={`rounded-2xl p-4 text-left min-h-[80px] flex items-center justify-center border-2 transition-all active:scale-95 ${
                    isMatched ? 'border-green-500/40 bg-green-500/10 opacity-70 cursor-default'
                    : isWrong  ? 'border-red-500/40 bg-red-500/10'
                    : isFlipped ? 'border-blue-500/60 bg-blue-600/15'
                    : card.type === 'word'
                      ? 'border-blue-500/25 bg-blue-500/8 hover:border-blue-500/50'
                      : 'border-purple-500/25 bg-purple-500/8 hover:border-purple-500/50'
                  }`}>
                  {!isFlipped && !isMatched && !isWrong ? (
                    <span className="text-2xl opacity-30 mx-auto">{card.type === 'word' ? '?' : '···'}</span>
                  ) : (
                    <span className={`w-full ${card.type === 'word' ? 'text-sm font-bold text-center' : 'text-xs leading-relaxed'} ${
                      isMatched ? 'text-green-400' : isWrong ? 'text-red-400' : isFlipped ? 'text-blue-300' : 'text-heading'
                    }`}>{card.text}</span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-center mt-4 text-sm text-faint">{matched.length/2} / {roundWords.length} · {moves} moves</p>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SHARED: Session Header + Session Complete
// ══════════════════════════════════════════════════════════════════════════════

function SessionHeader({ title, onBack, idx, total, score, label }: {
  title: string; onBack: () => void; idx: number; total: number; score: number; label: string;
}) {
  const pct = total > 0 ? Math.round((idx / total) * 100) : 0;
  return (
    <div className="shrink-0 px-4 pt-4 pb-3 border-b border-subtle bg-base">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={onBack}
            className="w-9 h-9 rounded-xl hover:bg-card text-muted hover:text-body flex items-center justify-center transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="w-4 h-4">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <div className="flex-1">
            <p className="text-sm font-bold text-heading">{title}</p>
            <p className="text-xs text-muted">{idx} / {total} words</p>
          </div>
          <div className="flex items-center gap-1.5 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-3 py-1.5">
            <svg className="w-3.5 h-3.5 text-yellow-500" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            <span className="text-sm font-bold text-yellow-500">{score}</span>
            <span className="text-xs text-yellow-500/70">{label}</span>
          </div>
        </div>
        <div className="h-1.5 bg-elevated rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

function SessionComplete({ score, total, activity, onBack, onReplay }: {
  score: number; total: number; activity: string;
  onBack: () => void; onReplay: () => void;
}) {
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const ringColor = pct === 100 ? '#facc15' : pct >= 70 ? '#22c55e' : pct >= 40 ? '#3b82f6' : '#ef4444';
  const msg = pct === 100 ? 'Perfect!' : pct >= 80 ? 'Excellent!' : pct >= 60 ? 'Well done!' : pct >= 40 ? 'Keep going!' : 'Keep practising!';

  React.useEffect(() => { sfx.complete(); }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-4 pt-4 pb-3 border-b border-subtle bg-base">
        <div className="max-w-lg mx-auto">
          <button onClick={onBack} className="w-9 h-9 rounded-xl hover:bg-card text-muted flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="w-4 h-4">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto px-4 pt-8 pb-28 text-center">
          {/* Accuracy ring */}
          <div className="flex justify-center mb-5">
            <div className="relative w-32 h-32">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" stroke="rgb(var(--bg-elevated))" strokeWidth="10"/>
                <circle cx="50" cy="50" r="40" fill="none" stroke={ringColor} strokeWidth="10"
                  strokeDasharray={`${2*Math.PI*40}`}
                  strokeDashoffset={`${2*Math.PI*40*(1-pct/100)}`}
                  strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease' }}/>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-black text-heading">{pct}%</span>
                <span className="text-xs text-faint">accuracy</span>
              </div>
            </div>
          </div>
          <h2 className="text-2xl font-black text-heading mb-1">{msg}</h2>
          <p className="text-sm text-muted mb-5">{activity}</p>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="bg-card border border-default rounded-2xl py-4 text-center">
              <p className="text-2xl font-black text-green-400">{score}</p>
              <p className="text-xs text-faint">Correct</p>
            </div>
            <div className="bg-card border border-default rounded-2xl py-4 text-center">
              <p className="text-2xl font-black text-red-400">{total - score}</p>
              <p className="text-xs text-faint">Wrong</p>
            </div>
          </div>

          {/* XP */}
          <div className="flex items-center justify-center gap-2 text-sm mb-6 bg-yellow-500/8 border border-yellow-500/20 rounded-2xl py-3">
            <svg className="w-4 h-4 text-yellow-500" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            <span className="font-semibold text-heading">{score * 4}+ XP earned</span>
          </div>

          <div className="flex gap-3">
            <button onClick={onBack} className="flex-1 py-4 rounded-2xl border border-default text-sm font-semibold text-body hover:bg-card">
              Back to menu
            </button>
            <button onClick={onReplay} className="flex-1 btn-primary py-4 rounded-2xl text-sm">
              Play again
            </button>
          </div>
        </div>
      </div>
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
