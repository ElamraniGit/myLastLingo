/**
 * ReviewView — Unified Practice Hub
 *
 * Combines Flashcards + Quiz + Word Games in one cohesive screen.
 * Tabs:
 *   ① Cards   — SM-2 flashcard review (flip + rate)
 *   ② Quiz    — Multiple-choice / fill-in-the-blank
 *   ③ Games   — Spelling Bee · Word Scramble · Matching Pairs
 *
 * All three tabs share the same word pool and SM-2 state.
 * A persistent header shows due-count, streak, and session progress.
 */

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useDictionary } from '@/hooks/useDictionary';
import { useStore } from '@/store/appStore';
import { xpApi } from '@/lib/api';
import type { SavedWord, ReviewSummary } from '@/types';
import { speak as ttsSpeak } from '@/lib/tts';
import * as sfx from '@/lib/sfx';
import { awardXP } from '@/components/common/XPBar';
import { SpellingIcon, ScrambleIcon, MatchIcon } from '@/components/ui/Icons';

/* ─────────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────────── */
function speak(t: string, rate = 0.9) { ttsSpeak(t, { rate }); }

function shuffle<T>(a: T[]): T[] {
  const c = [...a];
  for (let i = c.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [c[i], c[j]] = [c[j], c[i]];
  }
  return c;
}

function primaryMeaning(w: SavedWord) { return w.meaning_en?.trim() || w.word; }

function escapeRegExp(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function makeFillBlank(sentence: string | undefined, word: string): string {
  const s = (sentence ?? '').trim(), w = (word ?? '').trim();
  if (!s || !w) return '________ — can you guess this word?';
  try {
    const r = new RegExp(`(?<![\\p{L}\\p{M}\\p{N}_])${escapeRegExp(w)}(?![\\p{L}\\p{M}\\p{N}_])`, 'giu');
    const out = s.replace(r, '________');
    if (out !== s) return out;
  } catch { /* noop */ }
  return s.replace(new RegExp(escapeRegExp(w), 'gi'), '________');
}

function sortBySM2(words: SavedWord[]): SavedWord[] {
  return [...words].sort((a, b) => {
    const ld = (b.lapses ?? 0) - (a.lapses ?? 0);
    if (ld !== 0) return ld;
    const ed = (a.ease_factor ?? 2.5) - (b.ease_factor ?? 2.5);
    if (Math.abs(ed) > 0.1) return ed;
    const aD = a.next_review ? new Date(a.next_review.replace(' ', 'T')).getTime() : 0;
    const bD = b.next_review ? new Date(b.next_review.replace(' ', 'T')).getTime() : 0;
    return aD - bD;
  });
}

function filterPlayable(words: SavedWord[]): SavedWord[] {
  return words.filter(w =>
    w.word && w.word.length >= 4 && w.word.length <= 20 &&
    w.meaning_en?.trim().length > 5 && !w.word.includes(' ')
  );
}

/* ─────────────────────────────────────────────────────────────────
   TYPES
───────────────────────────────────────────────────────────────── */
type Tab         = 'cards' | 'quiz' | 'games';
type QuizType    = 'definition' | 'fillblank' | 'word';
type GameMode    = 'menu' | 'spelling' | 'scramble' | 'matching';
type SessionSize = 5 | 10 | 20 | 40;
type CEFRLevel   = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

const RATINGS = [
  { value: 0, label: 'Again', hint: '10m',  cls: 'border-red-500/30 bg-red-500/8 text-red-400'       },
  { value: 2, label: 'Hard',  hint: '30m',  cls: 'border-orange-500/30 bg-orange-500/8 text-orange-400' },
  { value: 3, label: 'Good',  hint: '1d',   cls: 'border-blue-500/30 bg-blue-500/8 text-blue-400'     },
  { value: 5, label: 'Easy',  hint: '4d+',  cls: 'border-green-500/30 bg-green-500/8 text-green-400'  },
] as const;

/* ─────────────────────────────────────────────────────────────────
   ROOT — ReviewView
───────────────────────────────────────────────────────────────── */
export default function ReviewView() {
  const { currentPage, setPage, setCurrentSavedWordId, savedWords } = useStore();
  const { loadDueWords, loadVocabulary, loadReviewSummary, loadStats, reviewWord } = useDictionary();

  /* Tab state */
  const [tab,      setTab]      = useState<Tab>('cards');
  const [gameMode, setGameMode] = useState<GameMode>('menu');

  /* Data */
  const [queue,   setQueue]   = useState<SavedWord[]>([]);
  const [pool,    setPool]    = useState<SavedWord[]>([]);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [loading, setLoading] = useState(true);

  /* Session config */
  const [sessionSize,  setSessionSize]  = useState<SessionSize>(20);
  const [cefrFilter,   setCefrFilter]   = useState<CEFRLevel | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  /* Progress */
  const [done,      setDone]      = useState(0);
  const [completed, setCompleted] = useState(false);
  const [streakData, setStreakData] = useState<any>(null);
  const [streakAlert, setStreakAlert] = useState<string | null>(null);

  /* Cards */
  const [flipped, setFlipped] = useState(false);
  const [busy,    setBusy]    = useState(false);

  /* Quiz */
  const [quizType, setQuizType] = useState<QuizType>('definition');
  const [choices,  setChoices]  = useState<SavedWord[]>([]);
  const [picked,   setPicked]   = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);

  const current = queue[0] ?? null;
  const total   = done + queue.length;
  const pct     = total > 0 ? Math.round((done / total) * 100) : 0;

  const playable = useMemo(() => filterPlayable(savedWords), [savedWords]);

  /* ── Load streak ──────────────────────────────────────────────── */
  const loadStreak = useCallback(async () => {
    try { setStreakData(await xpApi.getStatus()); } catch { /* noop */ }
  }, []);

  /* ── Load session ─────────────────────────────────────────────── */
  const reload = useCallback(async (size = sessionSize, cefr = cefrFilter) => {
    setLoading(true); setCompleted(false);
    setDone(0); setFlipped(false); setPicked(null); setAnswered(false);
    try {
      const [dueData, vocabData, sumData] = await Promise.all([
        loadDueWords(Math.max(size * 2, 50)),
        loadVocabulary({ page: 1, limit: 300, level: cefr ?? undefined }),
        loadReviewSummary().catch(() => null),
      ]);
      let words: SavedWord[] = dueData?.words ?? [];
      if (cefr) words = words.filter(w => w.level === cefr);
      words = sortBySM2(words).slice(0, size);
      setQueue(words);
      setPool(vocabData?.words ?? []);
      setSummary(sumData ?? null);
    } catch { setQueue([]); }
    finally { setLoading(false); }
  }, [sessionSize, cefrFilter, loadDueWords, loadVocabulary, loadReviewSummary]);

  useEffect(() => {
    if (currentPage === 'flashcards') { reload(); loadStats(); loadStreak(); }
  }, [currentPage]); // eslint-disable-line

  /* ── Quiz distractors ─────────────────────────────────────────── */
  useEffect(() => {
    if (!current) return;
    const dist = shuffle(pool.filter(w => w.id !== current.id && primaryMeaning(w) !== primaryMeaning(current))).slice(0, 3);
    setChoices(shuffle([current, ...dist]));
    setPicked(null); setAnswered(false); setFlipped(false);
    const types: QuizType[] = ['definition'];
    const hasSentence = current.sentence?.trim().toLowerCase().includes(current.word.toLowerCase());
    if (hasSentence) types.push('fillblank');
    if (current.meaning_en?.trim()) types.push('word');
    setQuizType(types[Math.floor(Math.random() * types.length)]);
  }, [current?.id]); // eslint-disable-line

  /* ── Keyboard ─────────────────────────────────────────────────── */
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (!current || busy || tab !== 'cards') return;
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); sfx.flip(); setFlipped(v => !v); return; }
      if (!flipped) return;
      const idx = ['1','2','3','4'].indexOf(e.key);
      if (idx >= 0) { e.preventDefault(); handleRate(RATINGS[idx].value); }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [current?.id, flipped, busy, tab]); // eslint-disable-line

  /* ── Rate word (SM-2) ─────────────────────────────────────────── */
  const handleRate = useCallback(async (quality: number) => {
    if (!current || busy) return;
    setBusy(true);
    if (quality >= 3) sfx.correct(); else sfx.wrong();
    try {
      const res = await reviewWord(current.id, quality);
      setSummary((res as any)?.summary ?? null);
      const newDone = done + 1;
      setDone(newDone);
      setQueue(prev => {
        const next = prev.slice(1);
        if (!next.length) { setCompleted(true); setTimeout(() => sfx.complete(), 300); loadStreak(); }
        return next;
      });
      setFlipped(false); setPicked(null); setAnswered(false);
      if (newDone === 5)  { sfx.streak(); setStreakAlert('5 cards done! Keep going!'); setTimeout(() => setStreakAlert(null), 2500); }
      if (newDone === 10) { sfx.streak(); setStreakAlert('10 cards! On fire!');        setTimeout(() => setStreakAlert(null), 2500); }
      if (newDone === 20) { sfx.streak(); setStreakAlert('20 cards! Amazing!');         setTimeout(() => setStreakAlert(null), 2500); }
    } finally { setBusy(false); }
  }, [current, busy, done, reviewWord, loadStreak]);

  /* ─────────────────────────────────────────────────────────────
     GAMES SUB-ROUTER
  ──────────────────────────────────────────────────────────────── */
  if (tab === 'games' && gameMode === 'spelling')
    return <SpellingBee  words={playable} onBack={() => setGameMode('menu')} />;
  if (tab === 'games' && gameMode === 'scramble')
    return <WordScramble words={playable} onBack={() => setGameMode('menu')} />;
  if (tab === 'games' && gameMode === 'matching')
    return <MatchingPairs words={playable} onBack={() => setGameMode('menu')} />;

  /* ─────────────────────────────────────────────────────────────
     RENDER
  ──────────────────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col h-full">

      {/* ── Page Header ──────────────────────────────────────────── */}
      <div className="shrink-0 px-4 pt-5 pb-3 border-b border-subtle bg-base">
        <div className="max-w-lg mx-auto">

          {/* Title row */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-heading tracking-tight">Practice</h1>
              <p className="text-sm text-muted mt-0.5">
                {summary?.due_now
                  ? <><span className="text-blue-500 font-semibold">{summary.due_now}</span> due · {summary.learned ?? 0} learned</>
                  : 'All caught up!'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Streak badge */}
              {streakData?.streak_days > 0 && (
                <div className="flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/20 rounded-xl px-2.5 py-1.5">
                  <svg className="w-3.5 h-3.5 text-orange-500" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 22a7 7 0 0 1-7-7c0-4.5 3-7.5 4-10 1.5 2 2 4 2 6.5C12 9 14 7 15 4c2 3.5 3 5 3 7a7 7 0 0 1-6 6.93V22z"/>
                  </svg>
                  <span className="text-sm font-bold text-orange-500">{streakData.streak_days}</span>
                </div>
              )}
              {/* Settings (cards/quiz tabs only) */}
              {tab !== 'games' && (
                <button
                  onClick={() => setShowSettings(v => !v)}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors
                              ${showSettings ? 'bg-blue-500/10 text-blue-500' : 'hover:bg-card text-muted hover:text-body'}`}
                >
                  <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/>
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Session settings panel */}
          {showSettings && tab !== 'games' && (
            <div className="bg-card border border-default rounded-2xl p-4 mb-4 space-y-4 animate-fade-in">
              {/* Session size */}
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Session size</p>
                <div className="flex gap-2">
                  {([5, 10, 20, 40] as SessionSize[]).map(n => (
                    <button
                      key={n}
                      onClick={() => { setSessionSize(n); reload(n, cefrFilter); setShowSettings(false); }}
                      className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all border ${
                        sessionSize === n
                          ? 'bg-blue-500/10 border-blue-500/40 text-blue-500'
                          : 'border-default text-muted hover:border-default hover:text-body'
                      }`}
                    >{n}</button>
                  ))}
                </div>
              </div>
              {/* CEFR filter */}
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">CEFR level</p>
                <div className="flex flex-wrap gap-2">
                  {([null, 'A1','A2','B1','B2','C1','C2'] as (CEFRLevel|null)[]).map(l => (
                    <button
                      key={l ?? 'all'}
                      onClick={() => { setCefrFilter(l); reload(sessionSize, l); setShowSettings(false); }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                        cefrFilter === l
                          ? 'bg-blue-500/10 border-blue-500/40 text-blue-500'
                          : 'border-default text-muted hover:text-body'
                      }`}
                    >{l ?? 'All'}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Tab bar ──────────────────────────────────────────── */}
          <div className="flex bg-elevated rounded-2xl p-1 gap-1">
            {([
              { id: 'cards' as Tab, label: 'Cards',
                icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="4" width="20" height="16" rx="3"/><path d="M8 10h8M8 14h5"/><circle cx="18" cy="14" r="2" fill="currentColor" stroke="none"/></svg> },
              { id: 'quiz'  as Tab, label: 'Quiz',
                icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="2.5"/></svg> },
              { id: 'games' as Tab, label: 'Games',
                icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="6" width="20" height="12" rx="4"/><path d="M7 12h4M9 10v4"/><circle cx="16" cy="11" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="13" r="1" fill="currentColor" stroke="none"/></svg> },
            ]).map(t => (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); if (t.id !== 'games') setGameMode('menu'); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  tab === t.id
                    ? 'bg-base text-heading shadow-card'
                    : 'text-muted hover:text-body'
                }`}
              >
                <span className={tab === t.id ? 'text-blue-500' : ''}>{t.icon}</span>
                {t.label}
                {/* Due badge on Cards tab */}
                {t.id === 'cards' && (summary?.due_now ?? 0) > 0 && (
                  <span className="ml-0.5 min-w-[18px] h-[18px] text-[11px] font-bold bg-blue-500 text-white rounded-full flex items-center justify-center px-1">
                    {summary!.due_now}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Session progress bar (cards + quiz) */}
          {tab !== 'games' && total > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted">{done} / {total}</span>
                <span className="text-xs font-semibold text-blue-500">{pct}%</span>
              </div>
              <div className="h-1.5 bg-elevated rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
                  style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Streak alert toast ─────────────────────────────────────── */}
      {streakAlert && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 animate-pop-in">
          <div className="flex items-center gap-2 bg-orange-500 text-white text-sm font-semibold px-4 py-2.5 rounded-2xl shadow-lg">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 22a7 7 0 0 1-7-7c0-4.5 3-7.5 4-10 1.5 2 2 4 2 6.5C12 9 14 7 15 4c2 3.5 3 5 3 7a7 7 0 0 1-6 6.93V22z"/>
            </svg>
            {streakAlert}
          </div>
        </div>
      )}

      {/* ── Tab Content ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto scrollbar-none">
        <div className="max-w-lg mx-auto px-4 py-5 pb-28 lg:pb-8">

          {/* ════════ CARDS TAB ════════ */}
          {tab === 'cards' && (
            <CardsTab
              current={current}
              loading={loading}
              completed={completed}
              done={done}
              summary={summary}
              streakData={streakData}
              flipped={flipped}
              busy={busy}
              onFlip={() => { sfx.flip(); setFlipped(v => !v); }}
              onRate={handleRate}
              onReload={() => reload()}
              onSpeak={() => current && speak(current.word)}
              onViewDetail={() => {
                if (current) {
                  setCurrentSavedWordId(current.id);
                  setPage('worddetail');
                }
              }}
            />
          )}

          {/* ════════ QUIZ TAB ════════ */}
          {tab === 'quiz' && (
            <QuizTab
              current={current}
              loading={loading}
              completed={completed}
              done={done}
              summary={summary}
              streakData={streakData}
              quizType={quizType}
              choices={choices}
              picked={picked}
              answered={answered}
              busy={busy}
              onPick={(id) => {
                if (answered) return;
                const isOk = id === current!.id;
                if (isOk) sfx.correct(); else sfx.wrong();
                setPicked(id); setAnswered(true);
              }}
              onRate={handleRate}
              onReload={() => reload()}
              onSpeak={() => current && speak(current.word)}
            />
          )}

          {/* ════════ GAMES TAB ════════ */}
          {tab === 'games' && (
            <GamesTab
              playable={playable}
              loading={loading}
              gameMode={gameMode}
              setGameMode={setGameMode}
              setPage={setPage}
            />
          )}

        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   CARDS TAB
───────────────────────────────────────────────────────────────── */
function CardsTab({
  current, loading, completed, done, summary, streakData,
  flipped, busy, onFlip, onRate, onReload, onSpeak, onViewDetail,
}: {
  current: SavedWord | null; loading: boolean; completed: boolean;
  done: number; summary: ReviewSummary | null; streakData: any;
  flipped: boolean; busy: boolean;
  onFlip: () => void; onRate: (q: number) => void;
  onReload: () => void; onSpeak: () => void; onViewDetail: () => void;
}) {
  if (loading) return <CardsSkeleton />;
  if (!current) return (
    <EmptyState completed={completed} done={done} summary={summary} streakData={streakData} onReload={onReload} />
  );

  const CEFR_COLOR: Record<string, string> = {
    A1:'text-green-400', A2:'text-green-500',
    B1:'text-blue-400',  B2:'text-blue-500',
    C1:'text-purple-400',C2:'text-purple-500',
  };

  return (
    <div className="space-y-4 animate-fade-in">

      {/* ── Flashcard 3D ── */}
      <div className="flashcard-wrap select-none" onClick={onFlip}>
        <div className={`flashcard-inner rounded-3xl min-h-[280px] relative cursor-pointer ${flipped ? 'flipped' : ''}`}>

          {/* Front */}
          <div className="flashcard-face bg-card border border-default rounded-3xl p-6 flex flex-col items-center justify-center text-center min-h-[280px] absolute inset-0">
            <div className="mb-2 flex items-center gap-2">
              {current.level && (
                <span className={`text-xs font-bold uppercase tracking-wider ${CEFR_COLOR[current.level] ?? 'text-muted'}`}>
                  {current.level}
                </span>
              )}
              {current.part_of_speech && (
                <span className="text-xs text-faint">{current.part_of_speech}</span>
              )}
            </div>
            <h2 className="text-4xl font-bold text-heading tracking-tight mb-2">{current.word}</h2>
            {current.pronunciation && (
              <p className="text-sm text-muted font-mono mb-3">{current.pronunciation}</p>
            )}
            <div className="w-8 h-0.5 rounded-full bg-elevated my-2" />
            <p className="text-sm text-faint mt-1">Tap to reveal</p>

            {/* SM-2 ease indicator */}
            <div className="absolute bottom-4 left-4 right-4">
              <div className="h-1 bg-elevated rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    (current.ease_factor ?? 2.5) >= 2.7 ? 'bg-green-500' :
                    (current.ease_factor ?? 2.5) >= 2.0 ? 'bg-blue-500' : 'bg-amber-500'
                  }`}
                  style={{ width: `${Math.round(((( current.ease_factor ?? 2.5) - 1.3) / (3.0 - 1.3)) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Back */}
          <div className="flashcard-back bg-card border border-default rounded-3xl p-6 flex flex-col min-h-[280px] absolute inset-0 overflow-y-auto">
            <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Definition</p>
            <p className="text-lg font-semibold text-heading leading-relaxed flex-1">
              {primaryMeaning(current)}
            </p>

            {current.sentence && (
              <div className="mt-3 bg-elevated/60 rounded-2xl px-4 py-3">
                <p className="text-xs text-muted uppercase tracking-wider mb-1">Example</p>
                <p className="text-sm text-body italic leading-relaxed">"{current.sentence}"</p>
              </div>
            )}

            {current.meaning_ar && (
              <p className="text-sm text-faint mt-3 text-right"
                style={{ direction: 'rtl', fontFamily: "'Segoe UI', 'Noto Sans Arabic', Arial, sans-serif" }}>
                {current.meaning_ar}
              </p>
            )}

            <button onClick={e => { e.stopPropagation(); onViewDetail(); }}
              className="mt-3 text-xs text-blue-500 hover:text-blue-400 self-start">
              View full details →
            </button>
          </div>
        </div>
      </div>

      {/* ── Actions ── */}
      {!flipped ? (
        <div className="flex gap-2">
          <button onClick={onFlip}
            className="btn-primary flex-1 py-4 rounded-2xl text-base font-semibold">
            Show Answer
          </button>
          <button onClick={e => { e.stopPropagation(); onSpeak(); }}
            className="w-14 h-14 rounded-2xl bg-card border border-default flex items-center justify-center hover:bg-elevated transition-colors">
            <svg className="w-5 h-5 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" opacity="0.9"/>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
            </svg>
          </button>
        </div>
      ) : (
        <div>
          <p className="text-sm text-center text-muted mb-3 font-medium">
            How well did you know it?
            <span className="text-faint ml-1 text-xs">(keys 1–4)</span>
          </p>
          <div className="grid grid-cols-4 gap-2">
            {RATINGS.map((r, i) => (
              <button key={r.label} onClick={() => onRate(r.value)} disabled={busy}
                className={`flex flex-col items-center gap-1 py-3.5 rounded-2xl border transition-all active:scale-95 disabled:opacity-40 ${r.cls}`}>
                <span className="text-sm font-bold">{r.label}</span>
                <span className="text-xs opacity-70">{r.hint}</span>
                <span className="text-xs text-faint">[{i+1}]</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   QUIZ TAB
───────────────────────────────────────────────────────────────── */
function QuizTab({
  current, loading, completed, done, summary, streakData,
  quizType, choices, picked, answered, busy,
  onPick, onRate, onReload, onSpeak,
}: {
  current: SavedWord | null; loading: boolean; completed: boolean;
  done: number; summary: ReviewSummary | null; streakData: any;
  quizType: QuizType; choices: SavedWord[];
  picked: string | null; answered: boolean; busy: boolean;
  onPick: (id: string) => void; onRate: (q: number) => void;
  onReload: () => void; onSpeak: () => void;
}) {
  if (loading) return <CardsSkeleton />;
  if (!current) return (
    <EmptyState completed={completed} done={done} summary={summary} streakData={streakData} onReload={onReload} />
  );

  return (
    <div className="space-y-4 animate-fade-in">

      {/* Question card */}
      <div className="bg-card border border-default rounded-3xl p-6 text-center">
        <p className="text-xs text-muted uppercase tracking-wider font-semibold mb-4">
          {quizType === 'definition' && 'What does this word mean?'}
          {quizType === 'fillblank'  && 'Complete the sentence'}
          {quizType === 'word'       && 'Which word fits this definition?'}
        </p>

        {quizType === 'fillblank' ? (
          <p className="text-base text-heading leading-relaxed font-medium">
            {makeFillBlank(current.sentence, current.word)}
          </p>
        ) : quizType === 'word' ? (
          <p className="text-base text-heading leading-relaxed">{current.meaning_en || 'What word has this meaning?'}</p>
        ) : (
          <>
            <h2 className="text-4xl font-bold text-heading tracking-tight mb-1">{current.word}</h2>
            {current.pronunciation && <p className="text-sm text-muted font-mono">{current.pronunciation}</p>}
          </>
        )}
      </div>

      {/* Choices */}
      <div className="space-y-2">
        {choices.map((c, i) => {
          const isCorrect = c.id === current.id, isPicked = picked === c.id;
          const label = (quizType === 'word' || quizType === 'fillblank') ? c.word : (c.meaning_en?.trim() || c.word);
          const style = !answered
            ? 'border-default hover:border-blue-500/30 hover:bg-blue-500/5 text-heading active:scale-[0.99]'
            : isCorrect  ? 'border-green-500/50 bg-green-500/10 text-green-400'
            : isPicked   ? 'border-red-500/50 bg-red-500/10 text-red-400'
            : 'border-default opacity-40 text-muted';
          return (
            <button key={c.id} onClick={() => onPick(c.id)} disabled={answered}
              className={`w-full flex items-center gap-3 px-4 py-4 rounded-2xl border text-left transition-all ${style}`}>
              <span className="w-7 h-7 rounded-xl bg-elevated text-muted text-xs font-bold flex items-center justify-center shrink-0">{i+1}</span>
              <span className="text-base flex-1 leading-snug">{label}</span>
              {answered && isCorrect && (
                <svg className="w-5 h-5 text-green-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              )}
              {answered && isPicked && !isCorrect && (
                <svg className="w-5 h-5 text-red-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              )}
            </button>
          );
        })}
      </div>

      {/* Feedback + next */}
      {answered ? (
        <>
          <div className={`rounded-2xl p-4 animate-fade-in border ${
            picked === current.id ? 'bg-green-500/8 border-green-500/25' : 'bg-red-500/8 border-red-500/25'
          }`}>
            <p className={`text-sm font-bold mb-1.5 ${picked === current.id ? 'text-green-400' : 'text-red-400'}`}>
              {picked === current.id ? 'Correct!' : 'Incorrect'}
            </p>
            {picked !== current.id && (
              <p className="text-sm text-muted">Correct: <span className="font-semibold text-heading">{primaryMeaning(current)}</span></p>
            )}
            {current.meaning_en && (
              <p className="text-sm text-body mt-2 leading-relaxed border-t border-default/40 pt-2">{current.meaning_en}</p>
            )}
            {current.examples?.[0] && (
              <p className="text-sm text-muted italic mt-1.5">"{current.examples[0]}"</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => onRate(picked === current.id ? 5 : 0)} disabled={busy}
              className={`py-4 rounded-2xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-40 border ${
                picked === current.id
                  ? 'bg-green-500/10 border-green-500/30 text-green-400'
                  : 'bg-red-500/10 border-red-500/30 text-red-400'
              }`}>
              {picked === current.id ? 'Easy — Next' : 'Again — Next'}
            </button>
            <button onClick={() => onRate(picked === current.id ? 3 : 2)} disabled={busy}
              className="py-4 rounded-2xl text-sm font-semibold border border-default text-body hover:bg-card transition-all active:scale-95 disabled:opacity-40">
              {picked === current.id ? 'Good' : 'Hard'}
            </button>
          </div>
        </>
      ) : (
        <button onClick={onSpeak}
          className="w-full py-3.5 rounded-2xl border border-default text-sm font-medium text-muted hover:bg-card transition-colors flex items-center justify-center gap-2">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" opacity="0.9"/>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
          </svg>
          Hear the word
        </button>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   GAMES TAB
───────────────────────────────────────────────────────────────── */
function GamesTab({ playable, loading, gameMode, setGameMode, setPage }: {
  playable: SavedWord[]; loading: boolean;
  gameMode: GameMode; setGameMode: (g: GameMode) => void;
  setPage: (p: any) => void;
}) {
  const hard = playable.filter(w => (w.ease_factor ?? 2.5) < 2.0).length;

  if (loading) return (
    <div className="space-y-3 animate-fade-in">
      {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}
    </div>
  );

  if (playable.length < 4) return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-blue-500/10 flex items-center justify-center">
        <svg className="w-8 h-8 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="18" rx="1"/>
          <path d="M17 3l4 2v14l-4 2V3z"/>
        </svg>
      </div>
      <h3 className="text-lg font-bold text-heading mb-2">Not enough words yet</h3>
      <p className="text-sm text-muted mb-6 max-w-xs">Save at least 4 words with English definitions to play.</p>
      <button onClick={() => setPage('library')} className="btn-primary px-6 py-3 rounded-2xl text-sm">
        Go to Library
      </button>
    </div>
  );

  return (
    <div className="space-y-3 animate-fade-in">

      <p className="text-xs text-muted mb-4">
        {playable.length} words available
        {hard > 0 && <> · <span className="text-red-400 font-semibold">{hard} need practice</span></>}
      </p>

      {/* Spelling Bee */}
      <GameCard
        Icon={SpellingIcon}
        title="Spelling Bee"
        desc="Listen to the word, type it correctly"
        xp="+5 XP"
        skill="Spelling & Memory"
        color="blue"
        wordCount={Math.min(15, playable.length)}
        onClick={() => setGameMode('spelling')}
      />

      {/* Word Scramble */}
      <GameCard
        Icon={ScrambleIcon}
        title="Word Scramble"
        desc="Rearrange the shuffled letters"
        xp="+4 XP"
        skill="Letter Recognition"
        color="green"
        wordCount={Math.min(12, playable.length)}
        onClick={() => setGameMode('scramble')}
      />

      {/* Matching Pairs */}
      <GameCard
        Icon={MatchIcon}
        title="Matching Pairs"
        desc="Match words to their definitions"
        xp="+3 XP"
        skill="Vocabulary Depth"
        color="purple"
        wordCount={Math.min(6, Math.floor(playable.length / 2)) * 2}
        onClick={() => setGameMode('matching')}
      />

      <p className="text-center text-xs text-faint pt-2">
        All games use your saved words · XP counts toward your level
      </p>
    </div>
  );
}

function GameCard({ Icon, title, desc, xp, skill, color, wordCount, onClick }: {
  Icon: React.ComponentType<{className?: string}>; title: string; desc: string;
  xp: string; skill: string; color: 'blue'|'green'|'purple'; wordCount: number; onClick: () => void;
}) {
  const cl = {
    blue:   { bg: 'bg-blue-600/12',   border: 'hover:border-blue-500/30 hover:bg-blue-500/5',   badge: 'bg-blue-500/10 text-blue-500'   },
    green:  { bg: 'bg-green-600/12',  border: 'hover:border-green-500/30 hover:bg-green-500/5',  badge: 'bg-green-500/10 text-green-500'  },
    purple: { bg: 'bg-purple-600/12', border: 'hover:border-purple-500/30 hover:bg-purple-500/5', badge: 'bg-purple-500/10 text-purple-500' },
  }[color];

  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-4 bg-card border border-default rounded-2xl p-5 ${cl.border} active:scale-[0.98] transition-all text-left group`}>
      <div className={`w-14 h-14 rounded-2xl ${cl.bg} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform`}>
        <Icon className="w-7 h-7" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-base font-bold text-heading">{title}</div>
        <div className="text-sm text-muted mt-0.5">{desc}</div>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${cl.badge}`}>{xp}</span>
          <span className="text-xs text-faint">{skill}</span>
          <span className="text-xs text-faint ml-auto">{wordCount} words</span>
        </div>
      </div>
      <svg className="w-5 h-5 text-faint group-hover:translate-x-0.5 transition-transform shrink-0"
        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────────
   EMPTY / COMPLETE STATE
───────────────────────────────────────────────────────────────── */
function EmptyState({ completed, done, summary, streakData, onReload }: {
  completed: boolean; done: number; summary: ReviewSummary | null; streakData: any; onReload: () => void;
}) {
  return (
    <div className="flex flex-col items-center text-center py-10 animate-fade-in">

      <div className="w-20 h-20 rounded-3xl bg-blue-500/10 flex items-center justify-center mb-5">
        {completed ? (
          <svg className="w-10 h-10 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M5.8 11.3L2 22l10.7-3.79"/><path d="M4 3h.01M22 8h.01M15 2h.01M22 20h.01M22 2l-2.24 2.24"/>
            <path d="M22 13l-2 2M14 8l-2 2"/><path d="M4 14l2 2"/>
          </svg>
        ) : (
          <svg className="w-10 h-10 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        )}
      </div>

      <h2 className="text-2xl font-bold text-heading tracking-tight mb-1">
        {completed ? 'Session Complete!' : 'All Caught Up!'}
      </h2>
      <p className="text-sm text-muted mb-4 max-w-xs leading-relaxed">
        {completed
          ? `You reviewed ${done} card${done !== 1 ? 's' : ''} this session.`
          : 'No words are due for review right now. Come back later!'}
      </p>

      {streakData?.streak_days > 0 && (
        <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-full px-4 py-2 mb-5">
          <svg className="w-4 h-4 text-orange-500" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 22a7 7 0 0 1-7-7c0-4.5 3-7.5 4-10 1.5 2 2 4 2 6.5C12 9 14 7 15 4c2 3.5 3 5 3 7a7 7 0 0 1-6 6.93V22z"/>
          </svg>
          <span className="text-sm font-bold text-orange-500">{streakData.streak_days}-day streak!</span>
        </div>
      )}

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

      <button onClick={onReload} className="btn-primary py-3.5 px-8 rounded-2xl text-sm">
        {completed ? 'New Session' : 'Check Again'}
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   SKELETON
───────────────────────────────────────────────────────────────── */
function CardsSkeleton() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="skeleton h-[280px] rounded-3xl w-full" />
      <div className="flex gap-2">
        <div className="skeleton h-14 flex-1 rounded-2xl" />
        <div className="skeleton h-14 w-14 rounded-2xl" />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   ════════ GAMES (extracted from old GamesView) ════════
───────────────────────────────────────────────────────────────── */

/* ── GAME HEADER ── */
function GameHeader({ title, onBack, score, idx, total }: {
  title: string; onBack: () => void; score: number; idx: number; total: number;
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
            <div className="text-base font-bold text-heading">{title}</div>
            <div className="text-sm text-muted">{idx} / {total} words</div>
          </div>
          <div className="flex items-center gap-1.5 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-3 py-1.5">
            <svg className="w-3.5 h-3.5 text-yellow-500" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            <span className="text-sm font-bold text-yellow-500">{score}</span>
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

/* ── GAME COMPLETE ── */
function GameComplete({ score, total, game, subtitle, skipped = 0, onBack, onReplay }: {
  score: number; total: number; game: string; subtitle?: string;
  skipped?: number; onBack: () => void; onReplay: () => void;
}) {
  const attempted = total - skipped;
  const pct = attempted > 0 ? Math.round((score / attempted) * 100) : 0;
  const msg = pct === 100 ? 'Perfect score!' : pct >= 80 ? 'Great job!' : pct >= 60 ? 'Well done!' : pct >= 40 ? 'Keep it up!' : 'Keep practising!';
  const ringColor = pct === 100 ? '#facc15' : pct >= 70 ? '#22c55e' : pct >= 40 ? '#3b82f6' : '#ef4444';
  const xpEarned = score * 4;
  useEffect(() => { sfx.complete(); }, []);

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
        <div className="max-w-md mx-auto px-4 pt-8 pb-28 text-center animate-fade-in">

          {/* Ring */}
          <div className="flex items-center justify-center mb-6">
            <div className="relative w-32 h-32">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" stroke="rgb(var(--bg-elevated))" strokeWidth="10"/>
                <circle cx="50" cy="50" r="40" fill="none" stroke={ringColor} strokeWidth="10"
                  strokeDasharray={`${2 * Math.PI * 40}`}
                  strokeDashoffset={`${2 * Math.PI * 40 * (1 - pct / 100)}`}
                  strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease' }}/>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-black text-heading">{pct}%</span>
                <span className="text-xs text-faint">accuracy</span>
              </div>
            </div>
          </div>

          <h2 className="text-2xl font-black text-heading mb-1">{msg}</h2>
          <p className="text-sm text-muted mb-1">{game}</p>
          {subtitle && <p className="text-xs text-faint mb-5">{subtitle}</p>}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: 'Correct', val: score,             color: 'text-green-400' },
              { label: 'Wrong',   val: attempted - score, color: 'text-red-400'   },
              { label: 'Skipped', val: skipped,           color: 'text-muted'     },
            ].map(s => (
              <div key={s.label} className="bg-card border border-default rounded-2xl py-4 text-center">
                <div className={`text-2xl font-black ${s.color}`}>{s.val}</div>
                <div className="text-xs text-faint mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* XP */}
          <div className="flex items-center justify-center gap-2 text-sm mb-6 bg-yellow-500/8 border border-yellow-500/20 rounded-2xl py-3">
            <svg className="w-4 h-4 text-yellow-500" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            <span className="font-semibold text-heading">{xpEarned}+ XP earned</span>
          </div>

          <div className="flex gap-3">
            <button onClick={onBack}
              className="flex-1 py-4 rounded-2xl border border-default text-sm font-semibold text-body hover:bg-card transition-colors">
              Back to Games
            </button>
            <button onClick={onReplay} className="flex-1 btn-primary py-4 rounded-2xl text-sm">
              <span className="flex items-center justify-center gap-1.5">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
                Play Again
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   SPELLING BEE
───────────────────────────────────────────────────────────────── */
function SpellingBee({ words, onBack }: { words: SavedWord[]; onBack: () => void }) {
  const pool    = useMemo(() => shuffle(words).slice(0, 15), []); // eslint-disable-line
  const [idx,      setIdx]      = useState(0);
  const [input,    setInput]    = useState('');
  const [result,   setResult]   = useState<'correct'|'wrong'|null>(null);
  const [score,    setScore]    = useState(0);
  const [done,     setDone]     = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [skipped,  setSkipped]  = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const current = pool[idx], total = pool.length;
  const playWord = useCallback(() => { if (current) speak(current.word, 0.75); }, [current]);
  useEffect(() => { if (current) { setShowHint(false); setTimeout(playWord, 300); } }, [idx]); // eslint-disable-line

  const submit = useCallback(() => {
    if (!input.trim() || result) return;
    const ok = input.trim().toLowerCase() === current.word.toLowerCase();
    setResult(ok ? 'correct' : 'wrong');
    if (ok) { sfx.correct(); setScore(s => s+1); awardXP('review_perfect'); } else sfx.wrong();
  }, [input, result, current]);

  const next = useCallback((skipping = false) => {
    if (skipping) setSkipped(s => s+1);
    if (idx + 1 >= total) { setDone(true); return; }
    setIdx(i => i+1); setInput(''); setResult(null);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [idx, total]);

  if (done) return <GameComplete score={score} total={total} game="Spelling Bee" skipped={skipped} onBack={onBack} onReplay={() => { setIdx(0); setInput(''); setResult(null); setScore(0); setDone(false); setSkipped(0); }} />;

  const LETTER_COLORS = ['text-blue-400','text-purple-400','text-green-400','text-orange-400','text-pink-400','text-cyan-400'];

  return (
    <div className="flex flex-col h-full">
      <GameHeader title="Spelling Bee" onBack={onBack} score={score} idx={idx} total={total} />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto px-4 py-5 pb-28 space-y-5 animate-fade-in">

          {/* Word display */}
          <div className="bg-card border border-default rounded-3xl p-8 text-center">
            <button onClick={playWord}
              className="w-16 h-16 rounded-2xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 flex items-center justify-center mx-auto mb-4 transition-colors active:scale-95">
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" opacity="0.9"/>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
              </svg>
            </button>
            <p className="text-sm text-muted mb-3">Listen and type the word</p>
            {showHint && (
              <p className="text-sm text-faint font-mono tracking-widest">
                {current.word[0]}{'_'.repeat(current.word.length - 1)} ({current.word.length} letters)
              </p>
            )}
            {!showHint && (
              <button onClick={() => setShowHint(true)} className="text-xs text-faint hover:text-muted transition-colors">
                Show hint
              </button>
            )}

            {result && (
              <div className={`mt-4 rounded-2xl p-3 animate-fade-in border ${
                result === 'correct' ? 'bg-green-500/10 border-green-500/25' : 'bg-red-500/10 border-red-500/25'
              }`}>
                <p className={`font-bold text-base ${result === 'correct' ? 'text-green-400' : 'text-red-400'}`}>
                  {result === 'correct' ? 'Correct! +5 XP' : `The word was: "${current.word}"`}
                </p>
                {result === 'wrong' && current.meaning_en && (
                  <p className="text-sm text-muted mt-1">{current.meaning_en}</p>
                )}
              </div>
            )}
          </div>

          {/* Input */}
          {!result && (
            <div className="flex gap-2">
              <input ref={inputRef} value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submit()}
                placeholder="Type the word…"
                autoComplete="off" autoCapitalize="none" spellCheck={false}
                className="input-field flex-1 text-lg tracking-wider"
              />
              <button onClick={submit}
                className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-500 flex items-center justify-center hover:bg-blue-500/20 transition-colors">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </button>
            </div>
          )}

          {/* Letter tiles */}
          {result === 'correct' && (
            <div className="flex flex-wrap justify-center gap-1.5">
              {current.word.split('').map((l, i) => (
                <span key={i} className={`w-10 h-10 rounded-xl bg-card border border-default flex items-center justify-center text-base font-bold ${LETTER_COLORS[i % LETTER_COLORS.length]}`}>
                  {l.toUpperCase()}
                </span>
              ))}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2">
            {!result && (
              <button onClick={() => next(true)}
                className="flex-1 py-3.5 rounded-2xl border border-default text-sm font-medium text-muted hover:bg-card transition-colors">
                Skip
              </button>
            )}
            {result && (
              <button onClick={() => next(false)}
                className="flex-1 btn-primary py-3.5 rounded-2xl text-sm font-semibold">
                {idx + 1 >= total ? 'See Results' : 'Next →'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   WORD SCRAMBLE
───────────────────────────────────────────────────────────────── */
function WordScramble({ words, onBack }: { words: SavedWord[]; onBack: () => void }) {
  const pool    = useMemo(() => shuffle(words).slice(0, 12), []); // eslint-disable-line
  const [idx,      setIdx]      = useState(0);
  const [tiles,    setTiles]    = useState<string[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [result,   setResult]   = useState<'correct'|'wrong'|null>(null);
  const [score,    setScore]    = useState(0);
  const [done,     setDone]     = useState(false);

  const current = pool[idx], total = pool.length;
  const TILE_COLORS = ['bg-blue-500/15 text-blue-300','bg-purple-500/15 text-purple-300','bg-green-500/15 text-green-300','bg-orange-500/15 text-orange-300','bg-pink-500/15 text-pink-300','bg-cyan-500/15 text-cyan-300'];

  const initTiles = useCallback((w: SavedWord) => {
    setTiles(shuffle(w.word.split(''))); setSelected([]); setResult(null);
  }, []);
  useEffect(() => { if (current) initTiles(current); }, [idx]); // eslint-disable-line

  const guess = selected.map(i => tiles[i]).join('');

  useEffect(() => {
    if (!current || result || selected.length !== current.word.length || selected.length < 2) return;
    const timer = setTimeout(() => {
      const ok = guess.toLowerCase() === current.word.toLowerCase();
      setResult(ok ? 'correct' : 'wrong');
      if (ok) { sfx.correct(); setScore(s => s+1); awardXP('review_word'); } else sfx.wrong();
    }, 150);
    return () => clearTimeout(timer);
  }, [selected, current, guess, result]);

  const toggleTile = (i: number) => {
    if (result) return; sfx.tap();
    if (selected.includes(i)) setSelected(prev => prev.filter(x => x !== i));
    else setSelected(prev => [...prev, i]);
  };

  const next = () => {
    if (idx + 1 >= total) { setDone(true); return; }
    setIdx(i => i+1);
  };

  if (done) return <GameComplete score={score} total={total} game="Word Scramble" onBack={onBack} onReplay={() => { setIdx(0); setScore(0); setDone(false); initTiles(pool[0]); }} />;

  return (
    <div className="flex flex-col h-full">
      <GameHeader title="Word Scramble" onBack={onBack} score={score} idx={idx} total={total} />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto px-4 py-5 pb-28 space-y-5 animate-fade-in">

          {/* Definition card */}
          <div className="bg-card border border-default rounded-3xl p-6 text-center">
            <p className="text-xs text-muted uppercase tracking-wider mb-3">What word is this?</p>
            <p className="text-base text-heading leading-relaxed font-medium">{current.meaning_en}</p>
            {current.sentence && (
              <p className="text-sm text-muted italic mt-3 border-t border-subtle pt-3">"{current.sentence}"</p>
            )}
          </div>

          {/* Answer display */}
          <div className="flex justify-center gap-1.5 flex-wrap min-h-[48px]">
            {current.word.split('').map((_, i) => (
              <span key={i} className={`w-10 h-10 rounded-xl border flex items-center justify-center text-base font-bold transition-all ${
                selected[i] !== undefined
                  ? TILE_COLORS[selected[i] % TILE_COLORS.length] + ' border-transparent'
                  : 'border-dashed border-elevated text-faint'
              }`}>
                {selected[i] !== undefined ? tiles[selected[i]].toUpperCase() : ''}
              </span>
            ))}
          </div>

          {/* Result */}
          {result && (
            <div className={`rounded-2xl p-4 border animate-fade-in text-center ${
              result === 'correct' ? 'bg-green-500/10 border-green-500/25' : 'bg-red-500/10 border-red-500/25'
            }`}>
              <p className={`font-bold text-base ${result === 'correct' ? 'text-green-400' : 'text-red-400'}`}>
                {result === 'correct' ? `"${current.word}" — Correct! +4 XP` : `The answer was: "${current.word}"`}
              </p>
            </div>
          )}

          {/* Letter tiles */}
          <div className="flex flex-wrap justify-center gap-2">
            {tiles.map((l, i) => {
              const isSelected = selected.includes(i);
              return (
                <button key={i} onClick={() => toggleTile(i)} disabled={!!result}
                  className={`w-12 h-12 rounded-2xl text-base font-bold transition-all active:scale-90 border ${
                    isSelected
                      ? 'opacity-40 border-transparent bg-elevated text-muted scale-95'
                      : TILE_COLORS[i % TILE_COLORS.length] + ' border-transparent hover:scale-105'
                  }`}>
                  {l.toUpperCase()}
                </button>
              );
            })}
          </div>

          {/* Controls */}
          <div className="flex gap-2">
            {!result && (
              <>
                <button onClick={() => setSelected(prev => prev.slice(0, -1))}
                  className="flex-1 py-3.5 rounded-2xl border border-default text-sm font-medium text-muted hover:bg-card transition-colors">
                  Remove
                </button>
                <button onClick={() => { initTiles(current); sfx.tap(); }}
                  className="flex-1 py-3.5 rounded-2xl border border-default text-sm font-medium text-muted hover:bg-card transition-colors flex items-center justify-center gap-1.5">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                  </svg>
                  Shuffle
                </button>
              </>
            )}
            {result && (
              <button onClick={next} className="flex-1 btn-primary py-3.5 rounded-2xl text-sm font-semibold">
                {idx + 1 >= total ? 'See Results' : 'Next →'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   MATCHING PAIRS
───────────────────────────────────────────────────────────────── */
type MatchCard = { id: string; type: 'word'|'def'; text: string; pairId: string | number };
const COUNT = 6;

function MatchingPairs({ words, onBack }: { words: SavedWord[]; onBack: () => void }) {
  const [roundWords, setRoundWords] = useState<SavedWord[]>([]);
  const [cards,   setCards]   = useState<MatchCard[]>([]);
  const [flipped, setFlipped] = useState<string[]>([]);
  const [matched, setMatched] = useState<string[]>([]);
  const [wrong,   setWrong]   = useState<string[]>([]);
  const [score,   setScore]   = useState(0);
  const [moves,   setMoves]   = useState(0);
  const [done,    setDone]    = useState(false);
  const busy = useRef(false);

  const init = useCallback((wordList: SavedWord[]) => {
    const chosen = shuffle(wordList.filter(w => w.meaning_en)).slice(0, COUNT);
    setRoundWords(chosen);
    const deck: MatchCard[] = [];
    chosen.forEach(w => {
      deck.push({ id: `w_${w.id}`, type: 'word', text: w.word,        pairId: w.id });
      deck.push({ id: `d_${w.id}`, type: 'def',  text: w.meaning_en!, pairId: w.id });
    });
    setCards(shuffle(deck));
    setFlipped([]); setMatched([]); setWrong([]);
    setScore(0); setMoves(0); setDone(false);
    busy.current = false;
  }, []);

  useEffect(() => { init(words); }, []); // eslint-disable-line

  const tap = useCallback((id: string) => {
    if (busy.current || matched.includes(id) || flipped.includes(id)) return;
    const next = [...flipped, id];
    setFlipped(next); sfx.tap();
    if (next.length === 2) {
      busy.current = true; setMoves(m => m+1);
      const [a, b] = next.map(i => cards.find(c => c.id === i)!);
      if (a.pairId === b.pairId) {
        sfx.correct();
        const newM = [...matched, a.id, b.id];
        setMatched(newM); setScore(s => s+1); awardXP('review_word'); setFlipped([]);
        busy.current = false;
        if (newM.length === cards.length) { sfx.complete(); setDone(true); }
      } else {
        sfx.wrong(); setWrong([a.id, b.id]);
        setTimeout(() => { setFlipped([]); setWrong([]); busy.current = false; }, 900);
      }
    }
  }, [flipped, matched, cards]);

  if (done) return (
    <GameComplete score={score} total={roundWords.length}
      game="Matching Pairs" subtitle={`${moves} move${moves !== 1 ? 's' : ''}`}
      onBack={onBack} onReplay={() => init(words)} />
  );

  const pairsLeft = roundWords.length - matched.length / 2;

  return (
    <div className="flex flex-col h-full">
      <GameHeader title="Matching Pairs" onBack={onBack} score={score} idx={matched.length / 2} total={roundWords.length} />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto px-4 py-4 pb-28 animate-fade-in">

          <div className="flex items-center justify-between mb-4 text-sm text-muted">
            <span>Tap a word, then its definition</span>
            <span className="font-semibold text-heading">{pairsLeft} pairs left</span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {cards.map(card => {
              const isFlipped = flipped.includes(card.id);
              const isMatched = matched.includes(card.id);
              const isWrong   = wrong.includes(card.id);

              return (
                <button key={card.id} onClick={() => tap(card.id)} disabled={isMatched}
                  className={`rounded-2xl p-4 text-left min-h-[80px] flex items-center justify-center border-2 transition-all active:scale-95 ${
                    isMatched ? 'border-green-500/40 bg-green-500/10 cursor-default opacity-70'
                    : isWrong  ? 'border-red-500/40 bg-red-500/10'
                    : isFlipped ? 'border-blue-500/60 bg-blue-600/15'
                    : card.type === 'word'
                      ? 'border-blue-500/25 bg-blue-500/8 hover:border-blue-500/50'
                      : 'border-purple-500/25 bg-purple-500/8 hover:border-purple-500/50'
                  }`}>
                  {!isFlipped && !isMatched && !isWrong ? (
                    <span className="text-2xl opacity-30 mx-auto">
                      {card.type === 'word' ? '?' : '···'}
                    </span>
                  ) : (
                    <span className={`w-full ${
                      card.type === 'word'
                        ? 'text-sm font-bold text-center'
                        : 'text-xs leading-relaxed line-clamp-4'
                    } ${isMatched ? 'text-green-400' : isWrong ? 'text-red-400' : isFlipped ? 'text-blue-300' : 'text-heading'}`}>
                      {card.text}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <p className="text-center mt-5 text-sm text-faint">
            {matched.length / 2} / {roundWords.length} matched · {moves} moves
          </p>
        </div>
      </div>
    </div>
  );
}
