/**
 * Flashcards & Quiz — 100% English UI.
 * Primary language: English (meaning_en, definitions, examples).
 * Arabic translation shown only as a small hint on the back of the card.
 */
import React, { useState, useCallback, useEffect } from 'react';
import { useDictionary } from '@/hooks/useDictionary';
import { useStore } from '@/store/appStore';
import type { SavedWord, ReviewSummary } from '@/types';
import { speak as ttsSpeak } from '@/lib/tts';

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

/* ── Rating config ─────────────────────────────────────────────── */
const RATINGS = [
  { value: 0, label: 'Again',  hint: '10 min',  cls: 'border-red-500/30    bg-red-500/8    text-red-400'    },
  { value: 2, label: 'Hard',   hint: '30 min',  cls: 'border-orange-500/30 bg-orange-500/8 text-orange-400' },
  { value: 3, label: 'Good',   hint: '1 day',   cls: 'border-blue-500/30   bg-blue-500/8   text-blue-400'   },
  { value: 5, label: 'Easy',   hint: '4+ days', cls: 'border-green-500/30  bg-green-500/8  text-green-400'  },
] as const;

type Mode      = 'flashcards' | 'quiz';
type QuizType  = 'definition' | 'fillblank' | 'word';

/* ════════════════════════════════════════════════════════════════ */

export default function FlashcardsView() {
  const activePage = useStore(s => s.currentPage);
  const {
    loadDueWords, loadVocabulary, loadReviewSummary,
    loadStats, reviewWord, lookupWord,
  } = useDictionary();

  const [queue,     setQueue]     = useState<SavedWord[]>([]);
  const [pool,      setPool]      = useState<SavedWord[]>([]);
  const [summary,   setSummary]   = useState<ReviewSummary | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [busy,      setBusy]      = useState(false);
  const [flipped,   setFlipped]   = useState(false);
  const [mode,      setMode]      = useState<Mode>('flashcards');
  const [done,      setDone]      = useState(0);
  const [completed, setCompleted] = useState(false);

  // Quiz
  const [quizType,  setQuizType]  = useState<QuizType>('definition');
  const [choices,   setChoices]   = useState<SavedWord[]>([]);
  const [picked,    setPicked]    = useState<string | null>(null);
  const [answered,  setAnswered]  = useState(false);

  const current = queue[0] ?? null;
  const total   = done + queue.length;
  const pct     = total > 0 ? Math.round((done / total) * 100) : 0;

  /* ── Load ────────────────────────────────────────────────────── */
  const reload = useCallback(async () => {
    setLoading(true);
    setCompleted(false);
    setDone(0);
    setFlipped(false);
    setPicked(null);
    setAnswered(false);
    try {
      const [dueData, vocabData, sumData] = await Promise.all([
        loadDueWords(40),
        loadVocabulary({ page: 1, limit: 200 }),
        loadReviewSummary().catch(() => null),
      ]);
      setQueue(dueData?.words  ?? []);
      setPool(vocabData?.words ?? []);
      setSummary(sumData ?? (dueData as any)?.summary ?? null);
    } catch (e) {
      console.error('Flashcards load error:', e);
      setQueue([]);
    } finally {
      setLoading(false);
    }
  }, [loadDueWords, loadVocabulary, loadReviewSummary]);

  useEffect(() => {
    if (activePage === 'flashcards') { reload(); loadStats(); }
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
    if (current.sentence) types.push('fillblank');
    types.push('word');
    setQuizType(types[Math.floor(Math.random() * types.length)]);
  }, [current?.id]); // eslint-disable-line

  /* ── Keyboard shortcuts ──────────────────────────────────────── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!current || busy || mode !== 'flashcards') return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault(); setFlipped(v => !v); return;
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
    <div className="flex flex-col items-center justify-center min-h-full px-6 text-center py-16 animate-fade-in">
      <div className="text-6xl mb-5">{completed ? '🎉' : '✅'}</div>
      <h2 className="text-2xl font-bold text-heading mb-2">
        {completed ? 'Session Complete!' : 'All Caught Up!'}
      </h2>
      <p className="text-sm text-muted mb-8 max-w-xs">
        {completed
          ? `Great work! You reviewed ${done} card${done !== 1 ? 's' : ''} this session.`
          : 'No words are due for review right now. Come back later!'}
      </p>

      {/* Stats */}
      {summary && (
        <div className="grid grid-cols-4 gap-2 w-full max-w-sm mb-8">
          {[
            { label: 'Total',     val: (summary as any).total_saved ?? 0, color: 'text-heading'     },
            { label: 'Learning',  val: summary.learning   ?? 0,           color: 'text-amber-500'   },
            { label: 'Reviewing', val: summary.reviewing  ?? 0,           color: 'text-blue-500'    },
            { label: 'Learned',   val: summary.learned    ?? 0,           color: 'text-green-500'   },
          ].map(s => (
            <div key={s.label} className="bg-card border border-default rounded-2xl py-3 text-center">
              <div className={`text-xl font-bold ${s.color}`}>{s.val}</div>
              <div className="text-[10px] text-muted mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <button onClick={reload} className="btn-primary px-10 py-3 rounded-2xl text-sm">
        Refresh Queue
      </button>
    </div>
  );

  /* ── Main ────────────────────────────────────────────────────── */
  return (
    <div className="max-w-lg mx-auto px-4 pt-5 pb-28 lg:pb-8 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-heading">Review</h2>
          <p className="text-xs text-muted mt-0.5">
            {queue.length} card{queue.length !== 1 ? 's' : ''} remaining
          </p>
        </div>
        <div className="flex bg-card border border-default rounded-xl p-1 gap-1">
          {(['flashcards', 'quiz'] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mode === m ? 'bg-blue-600 text-white shadow-sm' : 'text-muted hover:text-heading'
              }`}
            >
              {m === 'flashcards' ? '🃏 Cards' : '❓ Quiz'}
            </button>
          ))}
        </div>
      </div>

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
            onClick={() => setFlipped(v => !v)}
          >
            <div className={`flashcard-inner relative ${flipped ? 'flipped' : ''}`}
              style={{ minHeight: 300 }}>

              {/* ── FRONT ─────────────────────────────────────── */}
              <div className="flashcard-face absolute inset-0 bg-card border border-default
                              rounded-3xl flex flex-col items-center justify-center p-8 text-center gap-3">

                {/* Status + Level */}
                <div className="flex items-center gap-2">
                  {current.level && (
                    <span className="text-[10px] px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-500 font-bold uppercase">
                      {current.level}
                    </span>
                  )}
                  {current.status && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-lg font-medium uppercase ${
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
                >🔊</button>

                <p className="text-xs text-faint mt-2">Tap card to reveal answer</p>
              </div>

              {/* ── BACK ──────────────────────────────────────── */}
              <div className="flashcard-back absolute inset-0 bg-card border border-default
                              rounded-3xl flex flex-col p-6 overflow-y-auto gap-4">

                {/* Word + pronunciation header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold text-heading">{current.word}</h3>
                    {current.pronunciation && (
                      <p className="text-xs text-muted font-mono">{current.pronunciation}</p>
                    )}
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); speak(current.word); }}
                    className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500
                               flex items-center justify-center shrink-0 text-lg"
                  >🔊</button>
                </div>

                {/* English definition — PRIMARY */}
                {current.meaning_en && (
                  <div className="bg-elevated/50 rounded-2xl px-4 py-3">
                    <p className="text-[10px] text-muted uppercase tracking-wider font-semibold mb-1">
                      Definition
                    </p>
                    <p className="text-sm text-heading leading-relaxed">{current.meaning_en}</p>
                  </div>
                )}

                {/* Example sentence */}
                {(current.examples?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-[10px] text-muted uppercase tracking-wider font-semibold mb-1">
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
                    <p className="text-[10px] text-muted uppercase tracking-wider font-semibold mb-1">
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
                    <span className="text-[10px] text-faint uppercase tracking-wider shrink-0">AR</span>
                    <p className="text-xs text-muted" style={{ direction: 'rtl' }}>
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

          {/* Action buttons */}
          {!flipped ? (
            <div className="flex gap-2">
              <button
                onClick={() => setFlipped(true)}
                className="btn-primary flex-1 py-3.5 rounded-2xl text-sm font-semibold"
              >
                Show Answer
              </button>
              <button
                onClick={() => speak(current.word)}
                className="w-12 h-12 rounded-2xl bg-card border border-default text-lg
                           flex items-center justify-center hover:bg-elevated transition-colors"
              >🔊</button>
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
                    <span className="text-[10px] opacity-70">{r.hint}</span>
                    <span className="text-[10px] text-faint">[{i + 1}]</span>
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
                {current.sentence
                  ? current.sentence.replace(
                      new RegExp(`\\b${current.word}\\b`, 'gi'), '________'
                    )
                  : `________ — can you guess this word?`}
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
                  onClick={() => { if (!answered) { setPicked(c.id); setAnswered(true); } }}
                  disabled={answered}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border
                              text-left transition-all ${style}`}
                >
                  <span className="w-6 h-6 rounded-lg bg-elevated text-muted text-xs font-bold
                                   flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-sm flex-1">{label}</span>
                  {answered && isCorrect && <span className="text-green-400 shrink-0">✓</span>}
                  {answered && isPicked && !isCorrect && <span className="text-red-400 shrink-0">✗</span>}
                </button>
              );
            })}
          </div>

          {/* Feedback + Next */}
          {answered ? (
            <>
              {/* Result message */}
              <div className={`text-center text-sm font-semibold mb-4 py-3 rounded-2xl ${
                picked === current.id
                  ? 'bg-green-500/10 text-green-400'
                  : 'bg-red-500/10 text-red-400'
              }`}>
                {picked === current.id
                  ? '✓ Correct!'
                  : `✗ The answer was: "${primaryMeaning(current)}"`}
              </div>

              {/* Arabic hint after answer */}
              {current.meaning_ar && (
                <p className="text-center text-xs text-faint mb-4">
                  Arabic: <span style={{ direction: 'rtl' }}>{current.meaning_ar}</span>
                </p>
              )}

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
                  {picked === current.id ? '🚀 Easy — Next' : '🔁 Again — Next'}
                </button>
                <button
                  onClick={() => handleRate(picked === current.id ? 3 : 2)}
                  disabled={busy}
                  className="py-3.5 rounded-2xl text-sm font-semibold border border-default
                             text-body hover:bg-card transition-all active:scale-95 disabled:opacity-40"
                >
                  {picked === current.id ? '🙂 Good' : '😓 Hard'}
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={() => speak(current.word)}
              className="w-full py-3 rounded-2xl border border-default text-sm text-muted
                         hover:bg-card transition-colors"
            >
              🔊 Hear the word
            </button>
          )}
        </>
      )}
    </div>
  );
}
