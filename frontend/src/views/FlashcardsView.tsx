/**
 * Flashcards & Quiz — 100% English UI.
 * Primary language: English (meaning_en, definitions, examples).
 * Arabic translation shown only as a small hint on the back of the card.
 *
 * Improvements:
 *  - Session modes: Quick (5), Standard (20), Deep (40), CEFR filter
 *  - Smarter queue: hardest words first (lapses DESC, ease ASC)
 *  - Quiz: richer feedback panel after answering
 *  - Sound effects: flip, correct, wrong, complete
 *  - Streak milestone celebration
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useDictionary } from '@/hooks/useDictionary';
import { useStore } from '@/store/appStore';
import { xpApi } from '@/lib/api';
import type { SavedWord, ReviewSummary } from '@/types';
import { speak as ttsSpeak } from '@/lib/tts';
import * as sfx from '@/lib/sfx';

/* ── Helpers ───────────────────────────────────────────────────── */
function speak(t: string) { ttsSpeak(t, { rate: 0.9 }); }

function shuffle<T>(arr: T[]): T[] {
  const c = [...arr];
  for (let i = c.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [c[i], c[j]] = [c[j], c[i]];
  }
  return c;
}

/** Primary display meaning — always English first */
function primaryMeaning(w: SavedWord): string {
  return w.meaning_en?.trim() || w.word;
}

/** Short quiz label — English definition or word itself */
function quizLabel(w: SavedWord, type: QuizType): string {
  if (type === 'definition') return w.meaning_en?.trim() || w.word;
  if (type === 'fillblank')  return w.word;
  // translation quiz: show English meaning as the answer
  return w.meaning_en?.trim() || w.word;
}

/** Escape regex special characters for safe RegExp construction */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Create a fill-in-the-blank version of a sentence by replacing the target word.
 * Handles Unicode (Arabic, accented Latin) and regex-special words (C++, $100, etc.)
 * safely without throwing or leaving the sentence unchanged.
 */
function makeFillBlank(sentence: string | undefined, word: string): string {
  const s = (sentence ?? '').trim();
  const w = (word ?? '').trim();
  if (!s || !w) return '________ — can you guess this word?';

  const escaped = escapeRegExp(w);

  // Tier 1: Unicode-aware word boundaries (works for café, Arabic, C++, $100, etc.)
  try {
    const pattern = new RegExp(
      `(?<![\\p{L}\\p{M}\\p{N}_])${escaped}(?![\\p{L}\\p{M}\\p{N}_])`,
      'giu'
    );
    const result = s.replace(pattern, '________');
    if (result !== s) return result;
  } catch {
    // Browser lacks Unicode property / lookbehind support
  }

  // Tier 2: classic ASCII \b boundaries (covers plain English words)
  try {
    const pattern = new RegExp(`\\b${escaped}\\b`, 'gi');
    const result = s.replace(pattern, '________');
    if (result !== s) return result;
  } catch {
    // Shouldn't happen after escaping, but be safe
  }

  // Tier 3: literal case-insensitive substring replacement (last resort)
  let out = '';
  let rest = s;
  const lowerW = w.toLowerCase();
  while (rest.length > 0) {
    const idx = rest.toLowerCase().indexOf(lowerW);
    if (idx === -1) { out += rest; break; }
    out += rest.slice(0, idx) + '________';
    rest = rest.slice(idx + w.length);
  }
  return out;
}

/* ── Rating config ─────────────────────────────────────────────── */
const RATINGS = [
  { value: 0, label: 'Again',  hint: '10 min',  cls: 'border-red-500/30    bg-red-500/8    text-red-400'    },
  { value: 2, label: 'Hard',   hint: '30 min',  cls: 'border-orange-500/30 bg-orange-500/8 text-orange-400' },
  { value: 3, label: 'Good',   hint: '1 day',   cls: 'border-blue-500/30   bg-blue-500/8   text-blue-400'   },
  { value: 5, label: 'Easy',   hint: '4+ days', cls: 'border-green-500/30  bg-green-500/8  text-green-400'  },
] as const;

type Mode      = 'flashcards' | 'quiz';
type QuizType  = 'definition' | 'fillblank' | 'word';
type SessionMode = 'quick' | 'standard' | 'deep' | 'cefr';
type CEFRFilter  = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | null;

// Session configs
const SESSION_CONFIGS: Record<SessionMode, { label: string; icon: React.ReactNode; count: number; desc: string }> = {
  quick:    { label: 'Quick',    icon: (<svg className='w-5 h-5' viewBox='0 0 24 24' fill='currentColor'><polygon points='13 2 3 14 12 14 11 22 21 10 12 10 13 2'/></svg>), count: 5,   desc: '5 words · ~2 min' },
  standard: { label: 'Standard', icon: (<svg className='w-5 h-5' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round'><rect x='3' y='3' width='5' height='18' rx='1'/><rect x='10' y='3' width='5' height='18' rx='1'/><path d='M17 3l4 2v14l-4 2V3z'/></svg>), count: 20,  desc: '20 words · ~8 min' },
  deep:     { label: 'Deep',     icon: (<svg className='w-5 h-5' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round'><path d='M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24A2.5 2.5 0 0 1 9.5 2z'/><path d='M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24A2.5 2.5 0 0 0 14.5 2z'/></svg>), count: 40,  desc: '40 words · ~15 min' },
  cefr:     { label: 'By Level', icon: (<svg className='w-5 h-5' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round'><circle cx='12' cy='12' r='10'/><circle cx='12' cy='12' r='6'/><circle cx='12' cy='12' r='2' fill='currentColor' stroke='none'/></svg>), count: 20,  desc: 'Filter by CEFR level' },
};

// Sort queue: hardest first (most lapses, lowest ease), then by due date
function sortBySM2(words: SavedWord[]): SavedWord[] {
  return [...words].sort((a, b) => {
    const lapsesDiff = (b.lapses ?? 0) - (a.lapses ?? 0);
    if (lapsesDiff !== 0) return lapsesDiff;
    const easeDiff = (a.ease_factor ?? 2.5) - (b.ease_factor ?? 2.5);
    if (Math.abs(easeDiff) > 0.1) return easeDiff;
    const aDate = a.next_review ? new Date(a.next_review.replace(' ', 'T')).getTime() : 0;
    const bDate = b.next_review ? new Date(b.next_review.replace(' ', 'T')).getTime() : 0;
    return aDate - bDate;
  });
}

/* ════════════════════════════════════════════════════════════════ */

export default function FlashcardsView() {
  const activePage = useStore(s => s.currentPage);
  const {
    loadDueWords, loadVocabulary, loadReviewSummary,
    loadStats, reviewWord, lookupWord,
  } = useDictionary();

  const [queue,        setQueue]        = useState<SavedWord[]>([]);
  const [pool,         setPool]         = useState<SavedWord[]>([]);
  const [summary,      setSummary]      = useState<ReviewSummary | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [busy,         setBusy]         = useState(false);
  const [flipped,      setFlipped]      = useState(false);
  const [mode,         setMode]         = useState<Mode>('flashcards');
  const [done,         setDone]         = useState(0);
  const [completed,    setCompleted]    = useState(false);
  const [sessionMode,  setSessionMode]  = useState<SessionMode>('standard');
  const [cefrFilter,   setCefrFilter]   = useState<CEFRFilter>(null);
  const [showConfig,   setShowConfig]   = useState(false);
  const [streakData,   setStreakData]   = useState<any>(null);
  const [streakAlert,  setStreakAlert]  = useState<string | null>(null);

  // Quiz
  const [quizType,  setQuizType]  = useState<QuizType>('definition');
  const [choices,   setChoices]   = useState<SavedWord[]>([]);
  const [picked,    setPicked]    = useState<string | null>(null);
  const [answered,  setAnswered]  = useState(false);

  const current = queue[0] ?? null;
  const total   = done + queue.length;
  const pct     = total > 0 ? Math.round((done / total) * 100) : 0;

  /* ── Load streak data ────────────────────────────────────────── */
  const loadStreak = useCallback(async () => {
    try { const d = await xpApi.getStatus(); setStreakData(d); } catch {}
  }, []);

  /* ── Load ────────────────────────────────────────────────────── */
  const reload = useCallback(async (sm: SessionMode = sessionMode, cf: CEFRFilter = cefrFilter) => {
    setLoading(true);
    setCompleted(false);
    setDone(0);
    setFlipped(false);
    setPicked(null);
    setAnswered(false);
    setShowConfig(false);
    const count = SESSION_CONFIGS[sm].count;
    try {
      const [dueData, vocabData, sumData] = await Promise.all([
        loadDueWords(sm === 'deep' ? 80 : 50),  // fetch more, then slice
        loadVocabulary({ page: 1, limit: 300, level: cf ?? undefined }),
        loadReviewSummary().catch(() => null),
      ]);
      let words: SavedWord[] = dueData?.words ?? [];
      // Filter by CEFR if set
      if (cf) words = words.filter(w => w.level === cf);
      // Smart sort: hardest first
      words = sortBySM2(words);
      // Limit to session count
      setQueue(words.slice(0, count));
      setPool(vocabData?.words ?? []);
      setSummary(sumData ?? (dueData as any)?.summary ?? null);
    } catch (e) {
      setQueue([]);
    } finally {
      setLoading(false);
    }
  }, [sessionMode, cefrFilter, loadDueWords, loadVocabulary, loadReviewSummary]);

  useEffect(() => {
    if (activePage === 'flashcards') {
      reload();
      loadStats();
      loadStreak();
    }
  }, [activePage]); // eslint-disable-line

  /* ── Quiz setup on card change ───────────────────────────────── */
  useEffect(() => {
    if (!current) return;

    // Build distractors (English meanings, not Arabic)
    const distractors = shuffle(
      pool.filter(w => w.id !== current.id && primaryMeaning(w) !== primaryMeaning(current))
    ).slice(0, 3);
    setChoices(shuffle([current, ...distractors]));
    setPicked(null);
    setAnswered(false);
    setFlipped(false);

    // Pick quiz type based on available data
    const types: QuizType[] = ['definition'];
    const meaningfulSentence =
      current.sentence?.trim().length > 0 &&
      current.sentence.trim().toLowerCase().includes(current.word.toLowerCase());
    if (meaningfulSentence) types.push('fillblank');
    if (current.meaning_en?.trim()) types.push('word');
    setQuizType(types[Math.floor(Math.random() * types.length)]);
  }, [current?.id]); // eslint-disable-line

  /* ── Keyboard shortcuts ──────────────────────────────────────── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!current || busy || mode !== 'flashcards') return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault(); sfx.flip(); setFlipped(v => !v); return;
      }
      if (!flipped) return;
      const idx = ['1','2','3','4'].indexOf(e.key);
      if (idx >= 0) { e.preventDefault(); handleRate(RATINGS[idx].value); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current?.id, flipped, busy, mode]); // eslint-disable-line

  /* ── Rate ────────────────────────────────────────────────────── */
  const handleRate = useCallback(async (quality: number) => {
    if (!current || busy) return;
    setBusy(true);
    // Sound: quality 3-5 = correct, 0-2 = wrong
    if (quality >= 3) sfx.correct(); else sfx.wrong();
    try {
      const res = await reviewWord(current.id, quality);
      setSummary((res as any)?.summary ?? null);
      const newDone = done + 1;
      setDone(newDone);
      setQueue(prev => {
        const next = prev.slice(1);
        if (!next.length) {
          setCompleted(true);
          setTimeout(() => sfx.complete(), 300);
          // Refresh streak after session
          loadStreak();
        }
        return next;
      });
      setFlipped(false);
      setPicked(null);
      setAnswered(false);

      // Streak milestone alerts
      if (newDone === 5)  { sfx.streak(); setStreakAlert('5 cards done! Keep going!'); setTimeout(() => setStreakAlert(null), 2500); }
      if (newDone === 10) { sfx.streak(); setStreakAlert('10 cards! You\'re on fire!'); setTimeout(() => setStreakAlert(null), 2500); }
      if (newDone === 20) { sfx.streak(); setStreakAlert('20 cards! Amazing session!'); setTimeout(() => setStreakAlert(null), 2500); }
    } finally {
      setBusy(false);
    }
  }, [current, busy, reviewWord]);

  /* ── Loading ─────────────────────────────────────────────────── */
  if (loading) return (
    <div className="flex flex-col items-center justify-center h-full gap-5 py-20 px-6">
      <div className="w-full max-w-sm h-60 skeleton rounded-3xl" />
      <div className="flex gap-2 w-full max-w-sm">
        {[...Array(4)].map((_, i) => <div key={i} className="flex-1 h-14 skeleton rounded-2xl" />)}
      </div>
    </div>
  );

  /* ── Empty / Done ────────────────────────────────────────────── */
  if (!current) return (
    <div className="flex flex-col items-center justify-center min-h-full px-6 text-center py-12 animate-fade-in">
      <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center">{completed ? <svg className="w-7 h-7 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M5.8 11.3L2 22l10.7-3.79"/><path d="M4 3h.01M22 8h.01M15 2h.01M22 20h.01M22 2l-2.24 2.24"/><path d="M22 13l-2 2M14 8l-2 2"/><path d="M4 14l2 2"/></svg> : <svg className="w-6 h-6 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.15"/><polyline points="20 6 9 17 4 12"/></svg>}</div>
      <h2 className="text-3xl font-bold text-heading tracking-tight mb-2">
        {completed ? 'Session Complete!' : 'All Caught Up!'}
      </h2>
      <p className="text-sm text-muted mb-2 max-w-xs">
        {completed
          ? `Great work! You reviewed ${done} card${done !== 1 ? 's' : ''} this session.`
          : 'No words are due for review right now.'}
      </p>

      {/* Streak display */}
      {streakData && streakData.streak_days > 0 && (
        <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-full px-4 py-1.5 mb-6">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22a7 7 0 0 1-7-7c0-4.5 3-7.5 4-10 1.5 2 2 4 2 6.5C12 9 14 7 15 4c2 3.5 3 5 3 7a7 7 0 0 1-6 6.93V22z"/></svg>
          <span className="text-sm font-bold text-orange-500">{streakData.streak_days}-day streak!</span>
        </div>
      )}

      {/* Stats */}
      {summary && (
        <div className="grid grid-cols-4 gap-2 w-full max-w-sm mb-6">
          {[
            { label: 'Total',     val: (summary as any).total_saved ?? 0, color: 'text-heading'   },
            { label: 'Learning',  val: summary.learning   ?? 0,           color: 'text-amber-500' },
            { label: 'Reviewing', val: summary.reviewing  ?? 0,           color: 'text-blue-500'  },
            { label: 'Learned',   val: summary.learned    ?? 0,           color: 'text-green-500' },
          ].map(s => (
            <div key={s.label} className="bg-card border border-default rounded-2xl py-3 text-center">
              <div className={`text-xl font-bold ${s.color}`}>{s.val}</div>
              <div className="text-xs text-muted mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-col gap-2 w-full max-w-xs">
        <button onClick={() => reload()} className="btn-primary py-3 rounded-2xl text-sm">
          {completed ? 'New Session' : 'Check Again'}
        </button>
        {/* Quick practice even when nothing is due */}
        {!completed && (
          <button
            onClick={() => {
              setSessionMode('quick');
              reload('quick', null);
            }}
            className="py-3 rounded-2xl border border-default text-sm text-body hover:bg-card transition-colors"
          >
            Quick Practice (5 words)
          </button>
        )}
      </div>
    </div>
  );

  /* ── Main ────────────────────────────────────────────────────── */
  return (
    <div className="max-w-lg mx-auto px-4 pt-5 pb-28 lg:pb-8 animate-fade-in">

      {/* Streak milestone alert */}
      {streakAlert && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[80] bg-orange-500 text-white text-sm font-bold
                        px-5 py-2.5 rounded-2xl shadow-xl animate-pop-in whitespace-nowrap">
          {streakAlert}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-xl font-bold text-heading">Review</h2>
          <p className="text-xs text-muted mt-0.5">
            {queue.length} card{queue.length !== 1 ? 's' : ''} · {SESSION_CONFIGS[sessionMode].icon} {SESSION_CONFIGS[sessionMode].label}
            {cefrFilter && <span className="ml-1 text-blue-500 font-semibold">{cefrFilter}</span>}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Session config button */}
          <button
            onClick={() => setShowConfig(v => !v)}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              showConfig ? 'border-blue-500/40 bg-blue-500/10 text-blue-500' : 'border-default text-muted hover:text-body bg-card'
            }`}
            title="Session settings"
          >
            ⚙️
          </button>
          {/* Mode toggle */}
          <div className="flex bg-card border border-default rounded-xl p-1 gap-1">
            {(['flashcards', 'quiz'] as Mode[]).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  mode === m ? 'bg-blue-600 text-white shadow-sm' : 'text-muted hover:text-heading'
                }`}
              >
                {m === 'flashcards' ? (<><svg className='w-3.5 h-3.5 inline mr-1' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round'><rect x='2' y='4' width='20' height='16' rx='3'/></svg>Cards</>) : (<><svg className='w-3.5 h-3.5 inline mr-1' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round'><circle cx='12' cy='12' r='10'/><path d='M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3'/><line x1='12' y1='17' x2='12.01' y2='17' strokeWidth='2.5'/></svg>Quiz</>)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Session config panel */}
      {showConfig && (
        <div className="bg-card border border-default rounded-2xl p-4 mb-4 animate-fade-in space-y-3">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider">Session Mode</p>
          <div className="grid grid-cols-2 gap-2">
            {(Object.entries(SESSION_CONFIGS) as [SessionMode, typeof SESSION_CONFIGS[SessionMode]][]).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => { setSessionMode(key); if (key !== 'cefr') { setCefrFilter(null); reload(key, null); } }}
                className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                  sessionMode === key ? 'border-blue-500/40 bg-blue-500/8 text-blue-500' : 'border-default hover:border-blue-500/20 text-body'
                }`}
              >
                <span className="text-lg shrink-0">{cfg.icon}</span>
                <div>
                  <div className="text-sm font-semibold">{cfg.label}</div>
                  <div className="text-sm text-muted">{cfg.desc}</div>
                </div>
              </button>
            ))}
          </div>
          {sessionMode === 'cefr' && (
            <div>
              <p className="text-xs text-muted mb-2">Filter by level:</p>
              <div className="flex gap-1.5 flex-wrap">
                {(['A1','A2','B1','B2','C1','C2'] as const).map(lvl => (
                  <button
                    key={lvl}
                    onClick={() => { setCefrFilter(lvl); reload('cefr', lvl); }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      cefrFilter === lvl ? 'border-blue-500 bg-blue-500/15 text-blue-500' : 'border-default text-muted hover:border-blue-500/30'
                    }`}
                  >{lvl}</button>
                ))}
              </div>
            </div>
          )}
          {sessionMode !== 'cefr' && (
            <button onClick={() => reload()} className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold active:scale-[0.98] transition-all">
              Start {SESSION_CONFIGS[sessionMode].label} Session
            </button>
          )}

          {/* Streak info */}
          {streakData && (
            <div className={`flex items-center justify-between px-3 py-2 rounded-xl text-sm ${
              streakData.streak_days > 0 ? 'bg-orange-500/10 border border-orange-500/20' : 'bg-elevated'
            }`}>
              <span className="text-muted text-xs">Current streak</span>
              <div className="flex items-center gap-1">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22a7 7 0 0 1-7-7c0-4.5 3-7.5 4-10 1.5 2 2 4 2 6.5C12 9 14 7 15 4c2 3.5 3 5 3 7a7 7 0 0 1-6 6.93V22z"/></svg>
                <span className={`font-bold text-sm ${streakData.streak_days > 0 ? 'text-orange-500' : 'text-faint'}`}>
                  {streakData.streak_days} day{streakData.streak_days !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Progress */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1 h-1.5 bg-elevated rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs font-medium text-muted shrink-0">{done} / {total}</span>
      </div>

      {/* ════ FLASHCARD MODE ════ */}
      {mode === 'flashcards' && (
        <>
          {/* 3D Card */}
          <div
            className="flashcard-wrap cursor-pointer mb-5 select-none"
            onClick={() => { sfx.flip(); setFlipped(v => !v); }}
          >
            <div className={`flashcard-inner relative ${flipped ? 'flipped' : ''}`}
              style={{ minHeight: 300 }}>

              {/* ── FRONT ─────────────────────────────────────── */}
              <div className="flashcard-face absolute inset-0 bg-card border border-default
                              rounded-3xl flex flex-col items-center justify-center p-8 text-center gap-3">

                {/* Status + Level */}
                <div className="flex items-center gap-2">
                  {current.level && (
                    <span className="text-xs px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-500 font-bold uppercase">
                      {current.level}
                    </span>
                  )}
                  {current.status && (
                    <span className={`text-xs px-2 py-0.5 rounded-lg font-medium uppercase ${
                      current.status === 'learning'  ? 'bg-amber-500/10 text-amber-500' :
                      current.status === 'reviewing' ? 'bg-blue-500/10 text-blue-400'  :
                                                        'bg-green-500/10 text-green-500'
                    }`}>{current.status}</span>
                  )}
                </div>

                {/* Word */}
                <h2 className="text-5xl font-bold text-heading tracking-tight">
                  {current.word}
                </h2>

                {/* Pronunciation */}
                {current.pronunciation && (
                  <p className="text-sm text-muted font-mono">{current.pronunciation}</p>
                )}

                {/* Part of speech */}
                {current.part_of_speech && current.part_of_speech !== 'unknown' && (
                  <p className="text-xs text-faint italic">{current.part_of_speech}</p>
                )}

                {/* Pronounce button */}
                <button
                  onClick={e => { e.stopPropagation(); speak(current.word); }}
                  className="w-11 h-11 rounded-2xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-500
                             flex items-center justify-center text-xl transition-colors mt-1"
                ><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" opacity="0.9"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg></button>

                <p className="text-xs text-faint mt-2">Tap card to reveal answer</p>
              </div>

              {/* ── BACK ──────────────────────────────────────── */}
              <div className="flashcard-back absolute inset-0 bg-card border border-default
                              rounded-3xl flex flex-col">
                <div className="flex flex-col p-6 overflow-y-auto gap-4 h-full">

                {/* Word + pronunciation header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-3xl font-bold text-heading tracking-tight">{current.word}</h3>
                    {current.pronunciation && (
                      <p className="text-xs text-muted font-mono">{current.pronunciation}</p>
                    )}
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); speak(current.word); }}
                    className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500
                               flex items-center justify-center shrink-0 text-lg"
                  ><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" opacity="0.9"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg></button>
                </div>

                {/* English definition — PRIMARY */}
                {current.meaning_en && (
                  <div className="bg-elevated/50 rounded-2xl px-4 py-3">
                    <p className="text-xs text-muted uppercase tracking-wider font-semibold mb-1">
                      Definition
                    </p>
                    <p className="text-sm text-heading leading-relaxed">{current.meaning_en}</p>
                  </div>
                )}

                {/* Example sentence */}
                {(current.examples?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-xs text-muted uppercase tracking-wider font-semibold mb-1">
                      Example
                    </p>
                    <p className="text-sm text-body italic leading-relaxed">
                      "{current.examples![0]}"
                    </p>
                  </div>
                )}

                {/* Context sentence (from video/text) */}
                {current.sentence && !(current.examples?.length) && (
                  <div>
                    <p className="text-xs text-muted uppercase tracking-wider font-semibold mb-1">
                      Context
                    </p>
                    <p className="text-sm text-body italic leading-relaxed">
                      "{current.sentence}"
                    </p>
                  </div>
                )}

                {/* Arabic translation — small hint, not dominant */}
                {current.meaning_ar && (
                  <div className="flex items-center gap-2 pt-1 border-t border-default">
                    <span className="text-xs text-faint uppercase tracking-wider shrink-0">AR</span>
                    <p className="text-sm text-muted" style={{ direction: 'rtl', fontFamily: "'Segoe UI', 'Noto Sans Arabic', Arial, sans-serif" }}>
                      {current.meaning_ar}
                    </p>
                  </div>
                )}

                {/* View full details */}
                <button
                  onClick={e => { e.stopPropagation(); lookupWord(current.word, current.sentence || ''); }}
                  className="text-xs text-blue-500 hover:text-blue-400 transition-colors self-start"
                >
                  View full details →
                </button>
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          {!flipped ? (
            <div className="flex gap-2">
              <button
                onClick={() => { sfx.flip(); setFlipped(true); }}
                className="btn-primary flex-1 py-3.5 rounded-2xl text-sm font-semibold"
              >
                Show Answer
              </button>
              <button
                onClick={() => speak(current.word)}
                className="w-12 h-12 rounded-2xl bg-card border border-default text-lg
                           flex items-center justify-center hover:bg-elevated transition-colors"
              ><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" opacity="0.9"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg></button>
            </div>
          ) : (
            <div>
              <p className="text-xs text-center text-muted mb-3 font-medium">
                How well did you know it?
                <span className="text-faint ml-1">(keyboard: 1–4)</span>
              </p>
              <div className="grid grid-cols-4 gap-2">
                {RATINGS.map((r, i) => (
                  <button
                    key={r.label}
                    onClick={() => handleRate(r.value)}
                    disabled={busy}
                    className={`flex flex-col items-center gap-1.5 py-3 rounded-2xl border
                                transition-all active:scale-95 disabled:opacity-40 ${r.cls}`}
                  >
                    <span className="text-sm font-bold">{r.label}</span>
                    <span className="text-xs opacity-70">{r.hint}</span>
                    <span className="text-xs text-faint">[{i + 1}]</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ════ QUIZ MODE ════ */}
      {mode === 'quiz' && (
        <>
          {/* Question card */}
          <div className="bg-card border border-default rounded-3xl p-6 mb-4 text-center">
            <p className="text-xs text-muted uppercase tracking-wider font-semibold mb-4">
              {quizType === 'definition' && 'What is the definition of this word?'}
              {quizType === 'fillblank'  && 'Which word completes the sentence?'}
              {quizType === 'word'       && 'Which word matches this definition?'}
            </p>

            {quizType === 'fillblank' ? (
              <p className="text-base text-heading leading-relaxed font-medium">
                {makeFillBlank(current.sentence, current.word)}
              </p>
            ) : quizType === 'word' ? (
              /* Show English definition, ask for the word */
              <p className="text-base text-heading leading-relaxed">
                {current.meaning_en || `What word has this meaning?`}
              </p>
            ) : (
              /* Show word, ask for definition */
              <>
                <h2 className="text-4xl font-bold text-heading mb-2">{current.word}</h2>
                {current.pronunciation && (
                  <p className="text-sm text-muted font-mono">{current.pronunciation}</p>
                )}
              </>
            )}
          </div>

          {/* Choices */}
          <div className="space-y-2 mb-4">
            {choices.map((c, i) => {
              const isCorrect = c.id === current.id;
              const isPicked  = picked === c.id;

              // Answer label — always English
              const label = quizType === 'word' || quizType === 'fillblank'
                ? c.word
                : (c.meaning_en?.trim() || c.word);

              const style = !answered
                ? 'border-default hover:border-blue-500/30 hover:bg-blue-500/5 text-heading'
                : isCorrect
                  ? 'border-green-500/50 bg-green-500/10 text-green-400'
                  : isPicked
                    ? 'border-red-500/50 bg-red-500/10 text-red-400'
                    : 'border-default opacity-40 text-muted';

              return (
                <button
                  key={c.id}
                  onClick={() => {
                    if (!answered) {
                      const isCorrect = c.id === current.id;
                      if (isCorrect) sfx.correct(); else sfx.wrong();
                      setPicked(c.id);
                      setAnswered(true);
                    }
                  }}
                  disabled={answered}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border
                              text-left transition-all ${style}`}
                >
                  <span className="w-6 h-6 rounded-lg bg-elevated text-muted text-xs font-bold
                                   flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-sm flex-1">{label}</span>
                  {answered && isCorrect && <svg className="w-4 h-4 text-green-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                  {answered && isPicked && !isCorrect && <svg className="w-4 h-4 text-red-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>}
                </button>
              );
            })}
          </div>

          {/* Feedback + Next */}
          {answered ? (
            <>
              {/* Result banner — larger and more visible */}
              <div className={`rounded-2xl p-4 mb-3 animate-fade-in ${
                picked === current.id
                  ? 'bg-green-500/10 border border-green-500/30'
                  : 'bg-red-500/10 border border-red-500/30'
              }`}>
                <p className={`text-sm font-bold mb-1 ${
                  picked === current.id ? 'text-green-400' : 'text-red-400'
                }`}>
                  {picked === current.id ? 'Correct!' : 'Wrong'}
                </p>
                {picked !== current.id && (
                  <p className="text-sm text-muted">
                    Correct answer: <span className="font-semibold text-heading">{primaryMeaning(current)}</span>
                  </p>
                )}
                {/* Show full English definition after answering */}
                {current.meaning_en && (
                  <p className="text-xs text-body mt-2 leading-relaxed border-t border-default/50 pt-2">
                    {current.meaning_en}
                  </p>
                )}
                {/* Example for context */}
                {(current.examples?.length ?? 0) > 0 && (
                  <p className="text-xs text-muted italic mt-1 leading-relaxed">
                    "{current.examples![0]}"
                  </p>
                )}
                {/* Arabic hint */}
                {current.meaning_ar && (
                  <p className="text-xs text-faint mt-1.5">
                    <span className="opacity-60">AR: </span>
                    <span style={{ direction: 'rtl', fontFamily: "'Segoe UI', 'Noto Sans Arabic', Arial, sans-serif" }}>
                      {current.meaning_ar}
                    </span>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleRate(picked === current.id ? 5 : 0)}
                  disabled={busy}
                  className={`py-3.5 rounded-2xl text-sm font-semibold transition-all
                              active:scale-95 disabled:opacity-40 border ${
                    picked === current.id
                      ? 'bg-green-500/10 border-green-500/30 text-green-400'
                      : 'bg-red-500/10 border-red-500/30 text-red-400'
                  }`}
                >
                  {picked === current.id ? 'Easy — Next →' : 'Again — Next →'}
                </button>
                <button
                  onClick={() => handleRate(picked === current.id ? 3 : 2)}
                  disabled={busy}
                  className="py-3.5 rounded-2xl text-sm font-semibold border border-default
                             text-body hover:bg-card transition-all active:scale-95 disabled:opacity-40"
                >
                  {picked === current.id ? 'Good' : 'Hard'}
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={() => speak(current.word)}
              className="w-full py-3 rounded-2xl border border-default text-sm text-muted
                         hover:bg-card transition-colors"
            >
              <span className="flex items-center justify-center gap-1.5"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" opacity="0.9"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>Hear the word</span>
            </button>
          )}
        </>
      )}
    </div>
  );
}
