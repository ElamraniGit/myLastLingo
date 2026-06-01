/**
 * Flashcards & Quiz — Apple-style redesign.
 * 100% English UI. Fixed word loading. Clean 3D flip cards.
 */
import React, { useState, useCallback, useEffect } from 'react';
import { useDictionary } from '@/hooks/useDictionary';
import { useStore } from '@/store/appStore';
import type { SavedWord, ReviewSummary } from '@/types';
import { speak as ttsSpeak } from '@/lib/tts';

/* ── Helpers ─────────────────────────────────────────────────────── */
function speak(t: string) { ttsSpeak(t, { rate: 0.9 }); }

function shuffle<T>(arr: T[]): T[] {
  const c = [...arr];
  for (let i = c.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [c[i], c[j]] = [c[j], c[i]];
  }
  return c;
}

function getMeaning(w: SavedWord): string {
  return w.meaning_en?.trim() || w.meaning_ar?.trim() || w.word;
}

/* ── Rating buttons ──────────────────────────────────────────────── */
const RATINGS = [
  { value: 0, label: 'Again', hint: '10 min',  bg: 'bg-red-500/10    border-red-500/30    text-red-400'    },
  { value: 2, label: 'Hard',  hint: '30 min',  bg: 'bg-orange-500/10 border-orange-500/30 text-orange-400' },
  { value: 3, label: 'Good',  hint: '1+ day',  bg: 'bg-blue-500/10   border-blue-500/30   text-blue-400'   },
  { value: 5, label: 'Easy',  hint: '4+ days', bg: 'bg-green-500/10  border-green-500/30  text-green-400'  },
] as const;

type Mode = 'flashcards' | 'quiz';
type QuizType = 'translation' | 'definition' | 'fillblank';

/* ════════════════════════════════════════════════════════════════ */

export default function FlashcardsView() {
  const activePage = useStore(s => s.currentPage);
  const { loadDueWords, loadVocabulary, loadReviewSummary, loadStats, reviewWord, lookupWord } = useDictionary();

  const [queue,     setQueue]    = useState<SavedWord[]>([]);
  const [pool,      setPool]     = useState<SavedWord[]>([]);
  const [summary,   setSummary]  = useState<ReviewSummary | null>(null);
  const [loading,   setLoading]  = useState(true);
  const [busy,      setBusy]     = useState(false);
  const [flipped,   setFlipped]  = useState(false);
  const [mode,      setMode]     = useState<Mode>('flashcards');
  const [done,      setDone]     = useState(0);
  const [completed, setCompleted]= useState(false);

  // Quiz state
  const [quizType,  setQuizType] = useState<QuizType>('translation');
  const [choices,   setChoices]  = useState<SavedWord[]>([]);
  const [picked,    setPicked]   = useState<string | null>(null);
  const [answered,  setAnswered] = useState(false);

  const current = queue[0] ?? null;
  const total   = done + queue.length;
  const pct     = total > 0 ? Math.round((done / total) * 100) : 0;

  /* ── Load words ─────────────────────────────────────────────── */
  const reload = useCallback(async () => {
    setLoading(true);
    setCompleted(false);
    setDone(0);
    setFlipped(false);
    try {
      const [dueData, vocabData, summaryData] = await Promise.all([
        loadDueWords(40),
        loadVocabulary({ page: 1, limit: 200 }),
        loadReviewSummary().catch(() => null),
      ]);

      const words = dueData?.words ?? [];
      const allWords = vocabData?.words ?? [];
      setQueue(words);
      setPool(allWords);
      setSummary(summaryData ?? dueData?.summary ?? null);
    } catch (err) {
      console.error('Failed to load review words:', err);
      setQueue([]);
    } finally {
      setLoading(false);
    }
  }, [loadDueWords, loadVocabulary, loadReviewSummary]);

  useEffect(() => {
    if (activePage === 'flashcards') {
      reload();
      loadStats();
    }
  }, [activePage]); // eslint-disable-line

  /* ── Setup quiz choices when card changes ───────────────────── */
  useEffect(() => {
    if (!current || !pool.length) return;

    const others = shuffle(
      pool.filter(w => w.id !== current.id && getMeaning(w) !== getMeaning(current))
    ).slice(0, 3);
    setChoices(shuffle([current, ...others]));
    setPicked(null);
    setAnswered(false);
    setFlipped(false);

    // Pick quiz type based on available data
    const types: QuizType[] = ['translation'];
    if (current.meaning_en) types.push('definition');
    if (current.sentence)   types.push('fillblank');
    setQuizType(types[Math.floor(Math.random() * types.length)]);
  }, [current?.id]); // eslint-disable-line

  /* ── Keyboard shortcuts ─────────────────────────────────────── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!current || busy || mode !== 'flashcards') return;
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setFlipped(v => !v); return; }
      if (!flipped) return;
      const idx = ['1','2','3','4'].indexOf(e.key);
      if (idx >= 0) { e.preventDefault(); handleRate(RATINGS[idx].value); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current?.id, flipped, busy, mode]); // eslint-disable-line

  /* ── Rate word ──────────────────────────────────────────────── */
  const handleRate = useCallback(async (quality: number) => {
    if (!current || busy) return;
    setBusy(true);
    try {
      const res = await reviewWord(current.id, quality);
      setSummary((res as any)?.summary ?? null);
      setDone(v => v + 1);
      setQueue(prev => {
        const next = prev.slice(1);
        if (!next.length) setCompleted(true);
        return next;
      });
      setFlipped(false);
      setPicked(null);
      setAnswered(false);
    } finally {
      setBusy(false);
    }
  }, [current, busy, reviewWord]);

  /* ── Loading ────────────────────────────────────────────────── */
  if (loading) return (
    <div className="flex flex-col items-center justify-center h-full gap-4 py-20">
      <div className="w-16 h-24 skeleton rounded-2xl" />
      <div className="w-32 h-3 skeleton rounded-lg" />
      <div className="w-24 h-3 skeleton rounded-lg" />
    </div>
  );

  /* ── Empty / Done ───────────────────────────────────────────── */
  if (!current) return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center pb-20 animate-fade-in">
      <div className="text-6xl mb-5">{completed ? '🎉' : '✅'}</div>
      <h2 className="text-2xl font-bold text-heading mb-2">
        {completed ? 'Session Complete!' : 'All Caught Up!'}
      </h2>
      <p className="text-sm text-muted mb-2">
        {completed
          ? `You reviewed ${done} card${done === 1 ? '' : 's'} this session.`
          : 'No words are due for review right now.'}
      </p>

      {/* Stats */}
      {summary && (
        <div className="flex gap-3 my-6">
          {[
            { label: 'Total',     val: summary.total_saved ?? 0,  color: 'text-heading' },
            { label: 'Learning',  val: summary.learning    ?? 0,  color: 'text-amber-500' },
            { label: 'Reviewing', val: summary.reviewing   ?? 0,  color: 'text-blue-500' },
            { label: 'Learned',   val: summary.learned     ?? 0,  color: 'text-green-500' },
          ].map(s => (
            <div key={s.label} className="bg-card border border-default rounded-2xl px-4 py-3 text-center">
              <div className={`text-xl font-bold ${s.color}`}>{s.val}</div>
              <div className="text-[10px] text-muted mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={reload}
        className="btn-primary px-8 py-3 rounded-xl text-sm"
      >
        Refresh Queue
      </button>
    </div>
  );

  /* ── Main UI ────────────────────────────────────────────────── */
  return (
    <div className="max-w-lg mx-auto px-4 pt-5 pb-28 lg:pb-8 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-heading">Review</h2>
          <p className="text-xs text-muted">{queue.length} card{queue.length !== 1 ? 's' : ''} remaining</p>
        </div>
        {/* Mode toggle */}
        <div className="flex bg-card border border-default rounded-xl p-1 gap-1">
          {(['flashcards', 'quiz'] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mode === m
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-muted hover:text-heading'
              }`}
            >
              {m === 'flashcards' ? '🃏 Cards' : '❓ Quiz'}
            </button>
          ))}
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 h-1.5 bg-elevated rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs text-muted font-medium shrink-0">{done}/{total}</span>
      </div>

      {/* ══════════ FLASHCARD MODE ══════════ */}
      {mode === 'flashcards' && (
        <>
          {/* 3D flip card */}
          <div
            className="flashcard-wrap cursor-pointer mb-5 select-none"
            onClick={() => setFlipped(v => !v)}
          >
            <div className={`flashcard-inner relative min-h-[280px] ${flipped ? 'flipped' : ''}`}>

              {/* FRONT */}
              <div className="flashcard-face absolute inset-0 bg-card border border-default rounded-3xl flex flex-col items-center justify-center p-6 text-center">
                {/* Level badge */}
                {current.level && (
                  <span className="text-[10px] px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-500 font-semibold mb-3">
                    {current.level}
                  </span>
                )}
                <h2 className="text-4xl font-bold text-heading tracking-tight mb-2">
                  {current.word}
                </h2>
                {current.pronunciation && (
                  <p className="text-sm text-muted font-mono mb-4">{current.pronunciation}</p>
                )}
                <button
                  onClick={e => { e.stopPropagation(); speak(current.word); }}
                  className="w-11 h-11 rounded-2xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 flex items-center justify-center text-xl transition-colors mb-6"
                >🔊</button>
                <p className="text-xs text-faint">Tap to reveal answer</p>
              </div>

              {/* BACK */}
              <div className="flashcard-back absolute inset-0 bg-card border border-default rounded-3xl flex flex-col p-6 overflow-y-auto">
                <div className="flex-1 space-y-4">

                  {/* Word + pronunciation */}
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-2xl font-bold text-heading">{current.word}</h3>
                      {current.pronunciation && (
                        <p className="text-xs text-muted font-mono mt-0.5">{current.pronunciation}</p>
                      )}
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); speak(current.word); }}
                      className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0"
                    >🔊</button>
                  </div>

                  {/* Translation (Arabic) */}
                  {current.meaning_ar && (
                    <div className="bg-elevated/60 rounded-2xl px-4 py-3">
                      <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Arabic</p>
                      <p
                        className="text-lg font-bold text-heading"
                        style={{ direction: 'rtl', fontFamily: "'Segoe UI', 'Noto Sans Arabic', sans-serif" }}
                      >{current.meaning_ar}</p>
                    </div>
                  )}

                  {/* English definition */}
                  {current.meaning_en && (
                    <div>
                      <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Definition</p>
                      <p className="text-sm text-heading leading-relaxed">{current.meaning_en}</p>
                    </div>
                  )}

                  {/* Example sentence */}
                  {(current.examples?.length ?? 0) > 0 && (
                    <div>
                      <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Example</p>
                      <p className="text-sm text-body italic">"{current.examples![0]}"</p>
                    </div>
                  )}

                  {/* View full details */}
                  <button
                    onClick={e => { e.stopPropagation(); lookupWord(current.word, current.sentence || ''); }}
                    className="text-xs text-blue-500 hover:text-blue-400 transition-colors"
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
                onClick={() => setFlipped(true)}
                className="btn-primary flex-1 py-3 rounded-2xl text-sm"
              >
                Show Answer
              </button>
              <button
                onClick={() => speak(current.word)}
                className="w-12 h-12 rounded-2xl bg-card border border-default text-heading flex items-center justify-center text-lg hover:bg-elevated transition-colors"
              >🔊</button>
            </div>
          ) : (
            <div>
              <p className="text-xs text-center text-muted mb-3 font-medium">How well did you know it?</p>
              <div className="grid grid-cols-4 gap-2">
                {RATINGS.map((r, i) => (
                  <button
                    key={r.label}
                    onClick={() => handleRate(r.value)}
                    disabled={busy}
                    className={`flex flex-col items-center gap-1 p-3 rounded-2xl border transition-all active:scale-95 disabled:opacity-40 ${r.bg}`}
                  >
                    <span className="text-xs font-bold">{r.label}</span>
                    <span className="text-[10px] opacity-70">{r.hint}</span>
                    <span className="text-[10px] text-muted">[{i + 1}]</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ══════════ QUIZ MODE ══════════ */}
      {mode === 'quiz' && (
        <>
          {/* Question */}
          <div className="bg-card border border-default rounded-3xl p-6 mb-4 text-center">
            <p className="text-xs text-muted uppercase tracking-wider mb-4 font-medium">
              {quizType === 'translation' && 'Choose the correct translation'}
              {quizType === 'definition'  && 'Choose the correct definition'}
              {quizType === 'fillblank'   && 'Which word fits the blank?'}
            </p>

            {quizType !== 'fillblank' ? (
              <>
                <h2 className="text-4xl font-bold text-heading mb-2">{current.word}</h2>
                {current.pronunciation && (
                  <p className="text-sm text-muted font-mono">{current.pronunciation}</p>
                )}
              </>
            ) : (
              <p className="text-base text-heading leading-relaxed font-medium">
                {current.sentence?.replace(
                  new RegExp(`\\b${current.word}\\b`, 'gi'), '________'
                ) || `________ is used in English.`}
              </p>
            )}
          </div>

          {/* Choices */}
          <div className="space-y-2 mb-4">
            {choices.map((c, i) => {
              const isCorrect = c.id === current.id;
              const isPicked  = picked === c.id;

              let label = getMeaning(c);
              if (quizType === 'definition') label = c.meaning_en || c.word;
              if (quizType === 'fillblank')  label = c.word;

              const style = !answered
                ? 'border-default hover:border-blue-500/30 hover:bg-blue-500/5'
                : isCorrect
                  ? 'border-green-500/50 bg-green-500/10 text-green-400'
                  : isPicked
                    ? 'border-red-500/50 bg-red-500/10 text-red-400'
                    : 'border-default opacity-40';

              return (
                <button
                  key={c.id}
                  onClick={() => { if (!answered) { setPicked(c.id); setAnswered(true); } }}
                  disabled={answered}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border text-left transition-all ${style}`}
                >
                  <span className="w-6 h-6 rounded-lg bg-elevated text-muted text-xs font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-sm text-heading">{label}</span>
                  {answered && isCorrect && <span className="ml-auto text-green-400">✓</span>}
                  {answered && isPicked && !isCorrect && <span className="ml-auto text-red-400">✗</span>}
                </button>
              );
            })}
          </div>

          {/* Feedback + next button */}
          {answered ? (
            <div>
              <div className={`text-center text-sm font-semibold mb-4 ${
                picked === current.id ? 'text-green-400' : 'text-red-400'
              }`}>
                {picked === current.id
                  ? '✓ Correct!'
                  : `✗ The answer was: ${getMeaning(current)}`}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleRate(picked === current.id ? 5 : 0)}
                  disabled={busy}
                  className={`flex-1 py-3 rounded-2xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-40 ${
                    picked === current.id
                      ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                      : 'bg-red-500/15 text-red-400 border border-red-500/30'
                  }`}
                >
                  {picked === current.id ? '🚀 Easy — Next' : '🔁 Again — Next'}
                </button>
                <button
                  onClick={() => handleRate(picked === current.id ? 3 : 2)}
                  disabled={busy}
                  className="flex-1 py-3 rounded-2xl text-sm font-semibold border border-default text-body hover:bg-card transition-all active:scale-95 disabled:opacity-40"
                >
                  {picked === current.id ? '🙂 Good' : '😓 Hard'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => speak(current.word)}
              className="w-full py-3 rounded-2xl border border-default text-sm text-body hover:bg-card transition-colors"
            >
              🔊 Pronounce word
            </button>
          )}
        </>
      )}
    </div>
  );
}
