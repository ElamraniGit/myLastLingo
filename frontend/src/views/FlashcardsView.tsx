/**
 * Flashcards & Quiz review — unified with the new dictionary system.
 * Features:
 *   - 3D card flip animation (front: word + hint, back: full info)
 *   - Quiz mode: translation, synonym, definition, fill-blank
 *   - Swipe-like rating (Again / Hard / Good / Easy)
 *   - Session progress tracking
 *   - Keyboard shortcuts
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useDictionary } from '@/hooks/useDictionary';
import { useStore } from '@/store/appStore';
import { LevelBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { SavedWord, ReviewSummary } from '@/types';
import { speak as ttsSpeak } from '@/lib/tts';

/* ── Constants ─────────────────────────────────────────────────── */
const RATINGS = [
  { value: 0, key: '1', label: 'Again', emoji: '🔁', hint: '10 min',   color: 'border-red-500/40 hover:bg-red-500/10' },
  { value: 2, key: '2', label: 'Hard',  emoji: '😓', hint: '30 min',   color: 'border-orange-500/40 hover:bg-orange-500/10' },
  { value: 3, key: '3', label: 'Good',  emoji: '🙂', hint: '1+ day',   color: 'border-blue-500/40 hover:bg-blue-500/10' },
  { value: 5, key: '4', label: 'Easy',  emoji: '🚀', hint: 'fast grad', color: 'border-green-500/40 hover:bg-green-500/10' },
] as const;

type QuizType = 'translation' | 'synonym' | 'definition' | 'fillblank';

const QUIZ_TYPES: { id: QuizType; label: string }[] = [
  { id: 'translation', label: 'Choose the correct translation' },
  { id: 'synonym', label: 'Choose the synonym' },
  { id: 'definition', label: 'Choose the correct definition' },
  { id: 'fillblank', label: 'Which word fits the sentence?' },
];

function speak(t: string) {
  // Natural neural voice for word pronunciation (browser fallback if offline)
  const rate = (t || '').trim().split(/\s+/).length <= 2 ? 0.9 : 1.0;
  ttsSpeak(t, { rate });
}

function shuffle<T>(arr: T[]): T[] {
  const c = [...arr];
  for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; }
  return c;
}

function meaning(w: SavedWord) { return w.meaning_ar?.trim() || w.meaning_en?.trim() || w.word; }

/* ════════════════════════════════════════════════════════════════ */

export default function FlashcardsView() {
  const currentPage = useStore.getState().currentPage;
  const { loadDueWords, reviewWord, loadReviewSummary, loadStats, loadVocabulary, lookupWord } = useDictionary();

  const [queue, setQueue] = useState<SavedWord[]>([]);
  const [pool, setPool] = useState<SavedWord[]>([]);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [mode, setMode] = useState<'flashcards' | 'quiz'>('flashcards');
  const [done, setDone] = useState(0);
  const [completed, setCompleted] = useState(false);

  // Quiz state
  const [quizType, setQuizType] = useState<QuizType>('translation');
  const [choices, setChoices] = useState<SavedWord[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);

  const current = queue[0] ?? null;
  const total = done + queue.length;
  const pct = total > 0 ? (done / total) * 100 : 0;

  /* ── Load queue ──────────────────────────────────────────────── */
  const reload = useCallback(async () => {
    setLoading(true);
    const [d, s, v] = await Promise.all([
      loadDueWords(40), loadReviewSummary().catch(() => null),
      loadVocabulary({ page: 1, limit: 200 }).catch(() => ({ words: [] })),
    ]);
    setQueue(d?.words || []); setSummary(s || d?.summary || null); setPool(v?.words || []);
    setFlipped(false); setCompleted(false); setDone(0); setLoading(false);
  }, [loadDueWords, loadReviewSummary, loadVocabulary]);

  const activePage = useStore((s) => s.currentPage);
  useEffect(() => { if (activePage === 'flashcards') { reload(); loadStats(); } }, [activePage]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Setup quiz choices when card changes ────────────────────── */
  useEffect(() => {
    if (!current) return;
    const others = shuffle(pool.filter(w => w.id !== current.id && meaning(w) !== meaning(current))).slice(0, 3);
    setChoices(shuffle([current, ...others]));
    setPicked(null); setAnswered(false); setFlipped(false);
    // Pick random quiz type
    const types: QuizType[] = ['translation'];
    if ((current.synonyms?.length ?? 0) > 0) types.push('synonym');
    if (current.meaning_en) types.push('definition');
    if (current.sentence) types.push('fillblank');
    setQuizType(types[Math.floor(Math.random() * types.length)]);
  }, [current?.id, pool]);

  /* ── Keyboard shortcuts ──────────────────────────────────────── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!current || busy || mode !== 'flashcards') return;
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setFlipped(v => !v); return; }
      if (!flipped) return;
      const r = RATINGS.find(x => x.key === e.key);
      if (r) { e.preventDefault(); handleRate(r.value); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current?.id, flipped, busy, mode]);

  /* ── Rate ─────────────────────────────────────────────────────── */
  const handleRate = useCallback(async (quality: number) => {
    if (!current || busy) return;
    setBusy(true);
    try {
      const res = await reviewWord(current.id, quality);
      setSummary(res?.summary || null);
      setDone(v => v + 1);
      setQueue(prev => { const n = prev.slice(1); if (!n.length) setCompleted(true); return n; });
      setFlipped(false); setPicked(null); setAnswered(false);
      await loadStats();
    } finally { setBusy(false); }
  }, [current, busy, reviewWord, loadStats]);

  /* ── Open full word popup (fetches complete data from API) ──── */
  const openWordDetail = useCallback(() => {
    if (!current) return;
    lookupWord(current.word, current.sentence || '');
  }, [current, lookupWord]);

  /* ── Loading ─────────────────────────────────────────────────── */
  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="w-10 h-10 border-[3px] border-line border-t-blue-500 rounded-full animate-spin mb-5" />
      <p className="text-lg font-bold text-heading">Loading review session…</p>
    </div>
  );

  /* ── Empty / Completed ───────────────────────────────────────── */
  if (!current) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="text-6xl mb-5">{completed ? '✅' : '🎉'}</div>
      <h2 className="text-2xl font-bold text-heading mb-2">{completed ? 'Session complete!' : 'All caught up!'}</h2>
      <p className="text-body max-w-sm mb-6">
        {completed ? `You reviewed ${done} card${done === 1 ? '' : 's'} this session.` : 'No words are due right now.'}
      </p>
      {summary && (
        <div className="grid grid-cols-2 gap-3 w-full max-w-xs mb-6">
          <Stat label="Due" value={summary.due_now} />
          <Stat label="Learning" value={summary.learning} />
          <Stat label="Reviewing" value={summary.reviewing} />
          <Stat label="Learned" value={summary.learned} />
        </div>
      )}
      <Button onClick={() => reload()} variant="outline">Refresh Queue</Button>
    </div>
  );

  /* ── Main UI ─────────────────────────────────────────────────── */
  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-heading">Review</h1>
          <div className="flex gap-1.5">
            {(['flashcards', 'quiz'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${mode === m ? 'bg-blue-600 text-heading' : 'bg-card text-body hover:text-heading'}`}>
                {m === 'flashcards' ? '🃏 Cards' : '❓ Quiz'}
              </button>
            ))}
          </div>
        </div>
        {/* Progress bar */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-card rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs text-muted tabular-nums">{done}/{total}</span>
        </div>
      </div>

      {/* ── FLASHCARD MODE ─────────────────────────────────────── */}
      {mode === 'flashcards' && (
        <>
          <div className="flashcard-wrap" style={{ perspective: '1200px' }}>
            <div
              className={`relative w-full transition-transform duration-500 cursor-pointer ${flipped ? 'flashcard-flipped' : ''}`}
              style={{ transformStyle: 'preserve-3d', transform: flipped ? 'rotateY(180deg)' : 'rotateY(0)' }}
              onClick={() => setFlipped(v => !v)}
            >
              {/* FRONT */}
              <div className="bg-card/60 border border-line/50 rounded-3xl p-8 min-h-[320px] flex flex-col items-center justify-center text-center"
                   style={{ backfaceVisibility: 'hidden' }}>
                <LevelBadge level={(current.level || 'B1') as any} />
                <h2 className="text-4xl font-extrabold text-heading mt-4">{current.word}</h2>
                {current.pronunciation && <p className="text-body font-mono text-lg mt-2">{current.pronunciation}</p>}
                <button onClick={e => { e.stopPropagation(); speak(current.word); }}
                  className="mt-5 p-3 rounded-2xl bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 transition-colors text-lg">🔊</button>
                {current.meaning_en && (
                  <p className="text-sm text-muted mt-5 max-w-xs leading-relaxed italic">
                    💡 {current.meaning_en.length > 80 ? current.meaning_en.slice(0, 80) + '…' : current.meaning_en}
                  </p>
                )}
                <p className="text-xs text-faint mt-6">Tap to reveal ↻</p>
              </div>

              {/* BACK — clean: translation + definition + example only */}
              <div className="absolute inset-0 bg-card/60 border border-line/50 rounded-3xl p-6 flex flex-col items-center justify-center text-center overflow-y-auto"
                   style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                {/* Arabic translation */}
                {current.meaning_ar ? (
                  <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-2xl px-6 py-4 mb-5 w-full">
                    <p className="text-[11px] text-blue-400/60 uppercase tracking-wider mb-1">الترجمة</p>
                    <p className="text-2xl font-bold text-heading" style={{ direction: 'rtl', fontFamily: "'Noto Sans Arabic', sans-serif" }}>
                      {current.meaning_ar}
                    </p>
                  </div>
                ) : null}

                {/* Definition */}
                {current.meaning_en && (
                  <div className="mb-5 w-full">
                    <p className="text-[11px] text-muted uppercase tracking-wider mb-1.5">Definition</p>
                    <p className="text-[15px] text-heading leading-relaxed">{current.meaning_en}</p>
                  </div>
                )}

                {/* One example */}
                {(current.examples?.length ?? 0) > 0 && (
                  <div className="bg-surface/50 border border-line/40 rounded-xl px-4 py-3 w-full mb-4">
                    <p className="text-[11px] text-muted uppercase tracking-wider mb-1">Example</p>
                    <p className="text-sm text-body leading-relaxed italic">"{current.examples![0]}"</p>
                  </div>
                )}

                {/* View full details button */}
                <button onClick={e => { e.stopPropagation(); openWordDetail(); }}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors mt-2 px-4 py-2 rounded-lg hover:bg-blue-500/10">
                  📖 View full details →
                </button>
              </div>
            </div>
          </div>

          {/* Rating buttons */}
          {!flipped ? (
            <div className="flex justify-center gap-3">
              <Button onClick={() => setFlipped(true)} variant="primary" className="px-8">Show Answer</Button>
              <Button onClick={() => speak(current.word)} variant="outline">🔊</Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-center text-sm text-muted">How well did you know it?</p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                {RATINGS.map(r => (
                  <button key={r.value} disabled={busy} onClick={() => handleRate(r.value)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border bg-card/50 transition-all active:scale-95 disabled:opacity-50 ${r.color}`}>
                    <span className="text-xl">{r.emoji}</span>
                    <span className="text-xs font-semibold text-heading">{r.label}</span>
                    <span className="text-[10px] text-muted">{r.hint}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── QUIZ MODE ──────────────────────────────────────────── */}
      {mode === 'quiz' && (
        <>
          <div className="bg-card/60 border border-line/50 rounded-3xl p-6 min-h-[320px]">
            <p className="text-xs text-muted uppercase tracking-wider text-center mb-4">
              {quizType === 'translation' && 'Choose the correct translation'}
              {quizType === 'synonym' && `Choose a synonym for "${current.word}"`}
              {quizType === 'definition' && 'Which definition matches this word?'}
              {quizType === 'fillblank' && 'Which word fits the sentence?'}
            </p>

            {quizType !== 'fillblank' ? (
              <div className="text-center mb-6">
                <h2 className="text-3xl font-bold text-heading">{current.word}</h2>
                {current.pronunciation && <p className="text-body font-mono mt-1">{current.pronunciation}</p>}
              </div>
            ) : (
              <div className="bg-surface/50 border border-line rounded-xl px-4 py-3 mb-6 text-center">
                <p className="text-sm text-body leading-relaxed">
                  {current.sentence?.replace(new RegExp(`\\b${current.word}\\b`, 'gi'), '________') || `________ is used in English.`}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-2.5">
              {choices.map((c, i) => {
                const isThis = picked === c.id;
                const isCorrect = c.id === current.id;
                let label = meaning(c);
                if (quizType === 'synonym') label = c.synonyms?.[0] || c.word;
                if (quizType === 'definition') label = c.meaning_en || c.word;
                if (quizType === 'fillblank') label = c.word;

                const cls = !answered
                  ? 'border-line hover:border-line hover:bg-card/80'
                  : isCorrect ? 'border-green-500/40 bg-green-500/10'
                  : isThis ? 'border-red-500/40 bg-red-500/10'
                  : 'border-line/40 opacity-50';

                return (
                  <button key={c.id} disabled={answered} onClick={() => { setPicked(c.id); setAnswered(true); }}
                    className={`rounded-xl border px-4 py-3 text-left transition-all text-sm text-body ${cls}`}>
                    <span className="text-faint mr-2">{i + 1}.</span>{label}
                  </button>
                );
              })}
            </div>

            {answered && (
              <div className={`mt-4 rounded-xl px-4 py-3 border text-sm ${picked === current.id ? 'bg-green-500/10 border-green-500/20 text-green-300' : 'bg-red-500/10 border-red-500/20 text-red-300'}`}>
                {picked === current.id ? '✓ Correct!' : `✗ The answer is: ${meaning(current)}`}
              </div>
            )}
          </div>

          {!answered ? (
            <div className="flex justify-center">
              <Button onClick={() => speak(current.word)} variant="outline">🔊 Pronounce</Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Button onClick={() => handleRate(picked === current.id ? 5 : 0)} disabled={busy}
                variant={picked === current.id ? 'primary' : 'danger'}>
                {picked === current.id ? '🚀 Easy' : '🔁 Again'}
              </Button>
              <Button onClick={() => handleRate(picked === current.id ? 3 : 2)} disabled={busy} variant="outline">
                {picked === current.id ? '🙂 Good' : '😓 Hard'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-card/60 border border-line/50 rounded-2xl p-3 text-center">
      <p className="text-xl font-bold text-heading">{value}</p>
      <p className="text-[11px] text-muted">{label}</p>
    </div>
  );
}
