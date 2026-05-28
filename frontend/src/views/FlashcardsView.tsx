/**
 * Robust flashcard review experience.
 * Includes:
 * - standard flashcards mode
 * - quiz mode with distractors
 * - immediate queue loading
 * - smoother session progression
 * - review history preview
 * - keyboard shortcuts in flashcard mode
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useDictionary } from '@/hooks/useDictionary';
import { LevelBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { ReviewHistoryItem, ReviewSummary, SavedWord } from '@/types';

const QUALITY_OPTIONS = [
  { value: 0, key: '1', label: 'Again', emoji: '🔁', hint: '10 min', cls: 'border-red-500/30 hover:bg-red-500/10 hover:border-red-500/50' },
  { value: 2, key: '2', label: 'Hard', emoji: '😓', hint: '30 min', cls: 'border-orange-500/30 hover:bg-orange-500/10 hover:border-orange-500/50' },
  { value: 3, key: '3', label: 'Good', emoji: '🙂', hint: '1+ day', cls: 'border-yellow-500/30 hover:bg-yellow-500/10 hover:border-yellow-500/50' },
  { value: 5, key: '4', label: 'Easy', emoji: '🚀', hint: 'graduate faster', cls: 'border-green-500/30 hover:bg-green-500/10 hover:border-green-500/50' },
] as const;

const REVIEW_MODE_OPTIONS = [
  { id: 'flashcards', label: 'Flashcards' },
  { id: 'quiz', label: 'Quiz mode' },
] as const;

type ReviewMode = typeof REVIEW_MODE_OPTIONS[number]['id'];

function speak(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  u.rate = 0.85;
  window.speechSynthesis.speak(u);
}

function fmtNextReview(nextReview?: string) {
  if (!nextReview) return 'No review scheduled';
  const date = new Date(nextReview.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return nextReview;
  const diff = date.getTime() - Date.now();
  const minutes = Math.round(diff / 60000);
  if (minutes <= 0) return 'Due now';
  if (minutes < 60) return `In ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `In ${hours}h`;
  const days = Math.round(hours / 24);
  return `In ${days} day${days === 1 ? '' : 's'}`;
}

function qualityLabel(q?: number) {
  if (q == null) return '—';
  return QUALITY_OPTIONS.find((opt) => opt.value === q)?.label ?? String(q);
}

function getMeaningLabel(word: SavedWord) {
  return word.meaning_ar?.trim() || word.meaning_en?.trim() || `Definition for ${word.word}`;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function FlashcardsView() {
  const {
    loadDueWords,
    reviewWord,
    loadReviewSummary,
    loadReviewHistory,
    loadStats,
    loadVocabulary,
  } = useDictionary();

  const [queue, setQueue] = useState<SavedWord[]>([]);
  const [pool, setPool] = useState<SavedWord[]>([]);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [history, setHistory] = useState<ReviewHistoryItem[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [mode, setMode] = useState<ReviewMode>('flashcards');
  const [sessionDone, setSessionDone] = useState(0);
  const [sessionBreakdown, setSessionBreakdown] = useState({ again: 0, hard: 0, good: 0, easy: 0 });
  const [sessionCompleted, setSessionCompleted] = useState(false);

  const [quizChoices, setQuizChoices] = useState<SavedWord[]>([]);
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [quizAnswered, setQuizAnswered] = useState(false);
  const [quizCorrect, setQuizCorrect] = useState(false);

  const current = queue[0] ?? null;
  const totalAtStart = sessionDone + queue.length;
  const progressPct = totalAtStart > 0 ? (sessionDone / totalAtStart) * 100 : 0;

  const reloadQueue = useCallback(async (preserveSession = false) => {
    setInitialLoading(true);
    const [dueData, summaryData, vocabData] = await Promise.all([
      loadDueWords(40),
      loadReviewSummary().catch(() => null),
      loadVocabulary({ page: 1, limit: 200 }).catch(() => ({ words: [] })),
    ]);

    setQueue(dueData?.words || []);
    setSummary(summaryData || dueData?.summary || null);
    setPool(vocabData?.words || []);
    setFlipped(false);
    setSessionCompleted(false);
    setSelectedChoiceId(null);
    setQuizAnswered(false);
    setQuizCorrect(false);

    if (!preserveSession) {
      setSessionDone(0);
      setSessionBreakdown({ again: 0, hard: 0, good: 0, easy: 0 });
    }

    setInitialLoading(false);
  }, [loadDueWords, loadReviewSummary, loadVocabulary]);

  useEffect(() => {
    reloadQueue();
    loadStats();
  }, [reloadQueue, loadStats]);

  useEffect(() => {
    if (!current) {
      setHistory([]);
      return;
    }
    loadReviewHistory(current.id, 5)
      .then((data) => setHistory(data?.history || []))
      .catch(() => setHistory([]));
  }, [current?.id, loadReviewHistory]);

  useEffect(() => {
    if (!current) {
      setQuizChoices([]);
      setSelectedChoiceId(null);
      setQuizAnswered(false);
      setQuizCorrect(false);
      return;
    }

    const distractors = shuffle(
      pool.filter((item) => item.id !== current.id && getMeaningLabel(item) !== getMeaningLabel(current))
    ).slice(0, 3);
    setQuizChoices(shuffle([current, ...distractors]));
    setSelectedChoiceId(null);
    setQuizAnswered(false);
    setQuizCorrect(false);
    setFlipped(false);
  }, [current?.id, pool]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!current || submitting || mode !== 'flashcards') return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        setFlipped((v) => !v);
        return;
      }
      if (!flipped) return;
      const option = QUALITY_OPTIONS.find((item) => item.key === e.key);
      if (option) {
        e.preventDefault();
        handleReview(option.value);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current?.id, flipped, submitting, mode]);

  const handleReview = useCallback(async (quality: number) => {
    if (!current || submitting) return;

    setSubmitting(true);
    try {
      const result = await reviewWord(current.id, quality);
      setSummary(result?.summary || null);
      setSessionDone((v) => v + 1);
      setSessionBreakdown((prev) => ({
        again: prev.again + (quality === 0 ? 1 : 0),
        hard: prev.hard + (quality === 2 ? 1 : 0),
        good: prev.good + (quality === 3 ? 1 : 0),
        easy: prev.easy + (quality === 5 ? 1 : 0),
      }));

      setQueue((prev) => {
        const next = prev.slice(1);
        if (next.length === 0) setSessionCompleted(true);
        return next;
      });
      setFlipped(false);
      setSelectedChoiceId(null);
      setQuizAnswered(false);
      setQuizCorrect(false);
      await loadStats();
    } finally {
      setSubmitting(false);
    }
  }, [current, submitting, reviewWord, loadStats]);

  const submitQuizChoice = useCallback((choice: SavedWord) => {
    if (!current || quizAnswered) return;
    setSelectedChoiceId(choice.id);
    const correct = choice.id === current.id;
    setQuizAnswered(true);
    setQuizCorrect(correct);
  }, [current, quizAnswered]);

  const stageLabel = useMemo(() => {
    if (!current) return '';
    if ((current.reviewed_count || 0) === 0) return 'New';
    if (current.status === 'learning') return 'Learning';
    if (current.status === 'reviewing') return 'Reviewing';
    return 'Learned';
  }, [current]);

  if (initialLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <div className="w-10 h-10 border-[3px] border-slate-700 border-t-blue-500 rounded-full animate-spin mb-5" />
        <h2 className="text-xl font-bold text-white">Preparing review session…</h2>
        <p className="text-sm text-slate-500 mt-2">Loading due words and review statistics</p>
      </div>
    );
  }

  if (!current && !sessionCompleted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <div className="text-6xl mb-5">🎉</div>
        <h2 className="text-2xl font-bold text-white mb-2">All caught up!</h2>
        <p className="text-slate-400 max-w-sm">
          No words are due right now. Save more words from videos or come back when the next review is due.
        </p>
        {summary && (
          <div className="mt-6 grid grid-cols-2 gap-3 w-full max-w-sm">
            <StatCard label="Due now" value={summary.due_now} />
            <StatCard label="Never reviewed" value={summary.never_reviewed} />
            <StatCard label="Learning" value={summary.learning} />
            <StatCard label="Learned" value={summary.learned} />
          </div>
        )}
        <Button onClick={() => reloadQueue()} variant="outline" className="mt-6">
          Refresh Review Queue
        </Button>
      </div>
    );
  }

  if (!current && sessionCompleted) {
    return (
      <div className="max-w-xl mx-auto px-4 py-8 space-y-6 text-center">
        <div className="text-6xl">✅</div>
        <div>
          <h1 className="text-2xl font-bold text-white">Session complete</h1>
          <p className="text-slate-400 mt-1">You finished all cards that were due in this review round.</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Reviewed" value={sessionDone} />
          <StatCard label="Again" value={sessionBreakdown.again} />
          <StatCard label="Good" value={sessionBreakdown.good} />
          <StatCard label="Easy" value={sessionBreakdown.easy} />
        </div>

        {summary && (
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5 text-left">
            <h3 className="text-sm font-semibold text-slate-200 mb-3">Queue snapshot</h3>
            <div className="grid grid-cols-2 gap-3">
              <MiniRow label="Still due now" value={summary.due_now} />
              <MiniRow label="Learning" value={summary.learning} />
              <MiniRow label="Reviewing" value={summary.reviewing} />
              <MiniRow label="Learned" value={summary.learned} />
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={() => reloadQueue(true)} variant="primary">Check for More Due Cards</Button>
          <Button onClick={() => reloadQueue()} variant="outline">Start New Session</Button>
        </div>
      </div>
    );
  }

  const canQuiz = quizChoices.length >= 2;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white">Flashcard Review</h1>
          <p className="text-slate-400 text-sm">Strong spaced repetition session with flashcards and quiz mode</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-green-400">{sessionDone}</p>
          <p className="text-xs text-slate-500">reviewed this session</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {REVIEW_MODE_OPTIONS.map((item) => (
            <button
              key={item.id}
              disabled={item.id === 'quiz' && !canQuiz}
              onClick={() => setMode(item.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${mode === item.id ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'bg-slate-800/60 text-slate-400 border border-slate-700 hover:text-slate-200'} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {item.label}
            </button>
          ))}
        </div>
        {!canQuiz && <span className="text-xs text-slate-500">Quiz mode unlocks when you have at least 2 saved words with meanings.</span>}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Remaining" value={queue.length} />
        <StatCard label="Due now" value={summary?.due_now ?? queue.length} />
        <StatCard label="Learning" value={summary?.learning ?? 0} />
        <StatCard label="Never reviewed" value={summary?.never_reviewed ?? 0} />
      </div>

      <div>
        <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
          <span>{sessionDone} completed</span>
          <span>{queue.length} remaining</span>
        </div>
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      <div className="bg-slate-800/70 border border-slate-700/60 rounded-3xl shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700/50 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {current?.level && <LevelBadge level={current.level} />}
            <span className="text-xs px-2 py-1 rounded-full bg-slate-700 text-slate-300">{stageLabel}</span>
            {current?.part_of_speech && current.part_of_speech !== 'unknown' && (
              <span className="text-xs text-slate-500">{current.part_of_speech}</span>
            )}
          </div>
          <span className="text-xs text-slate-500">Next due: {fmtNextReview(current?.next_review)}</span>
        </div>

        {mode === 'flashcards' ? (
          <FlashcardPanel
            current={current}
            flipped={flipped}
            setFlipped={setFlipped}
            history={history}
          />
        ) : (
          <QuizPanel
            current={current}
            choices={quizChoices}
            answered={quizAnswered}
            correct={quizCorrect}
            selectedChoiceId={selectedChoiceId}
            onSelect={submitQuizChoice}
          />
        )}
      </div>

      {mode === 'flashcards' ? (
        !flipped ? (
          <div className="flex justify-center gap-3">
            <Button onClick={() => setFlipped(true)} variant="primary" className="px-8">Show Answer</Button>
            <Button onClick={() => speak(current?.word ?? '')} variant="outline">Pronounce</Button>
          </div>
        ) : (
          <RatingActions onRate={handleReview} disabled={submitting} />
        )
      ) : (
        <div className="space-y-3">
          {!quizAnswered ? (
            <div className="flex justify-center">
              <Button onClick={() => speak(current?.word ?? '')} variant="outline">Pronounce</Button>
            </div>
          ) : quizCorrect ? (
            <QuizResultActions
              correct
              disabled={submitting}
              onPrimary={() => handleReview(5)}
              onSecondary={() => handleReview(3)}
            />
          ) : (
            <QuizResultActions
              correct={false}
              disabled={submitting}
              onPrimary={() => handleReview(0)}
              onSecondary={() => handleReview(2)}
            />
          )}
        </div>
      )}
    </div>
  );
}

function FlashcardPanel({
  current,
  flipped,
  setFlipped,
  history,
}: {
  current: SavedWord | null;
  flipped: boolean;
  setFlipped: (value: boolean) => void;
  history: ReviewHistoryItem[];
}) {
  return !flipped ? (
    <div className="p-8 min-h-[320px] flex flex-col items-center justify-center text-center cursor-pointer" onClick={() => setFlipped(true)}>
      <h2 className="text-5xl font-bold text-white">{current?.word}</h2>
      {current?.pronunciation && <p className="text-slate-400 font-mono text-lg mt-3">{current.pronunciation}</p>}

      <button onClick={(e) => { e.stopPropagation(); speak(current?.word ?? ''); }} className="mt-5 p-3 rounded-2xl bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 transition-colors">🔊</button>

      {current?.sentence && (
        <div className="mt-6 max-w-xl px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-2xl">
          <p className="text-xs uppercase tracking-widest text-slate-500 mb-1">Context</p>
          <p className="text-sm text-slate-300 leading-relaxed">{current.sentence}</p>
        </div>
      )}

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <InfoChip label="Reviews" value={current?.reviewed_count ?? 0} />
        <InfoChip label="Lapses" value={current?.lapses ?? 0} />
        <InfoChip label="Ease" value={Number(current?.ease_factor ?? 2.5).toFixed(2)} />
      </div>

      <p className="text-sm text-slate-500 mt-6">Tap the card or press Space to reveal the answer</p>
    </div>
  ) : (
    <div className="p-8 min-h-[320px] flex flex-col justify-center">
      <div className="text-center mb-5">
        <p className="text-xs text-slate-500 mb-2">Meaning</p>
        {current?.meaning_ar ? (
          <p className="text-3xl font-bold text-white mb-3" style={{ direction: 'rtl', textAlign: 'center', unicodeBidi: 'isolate', fontFamily: "'Segoe UI', 'Noto Sans Arabic', Arial, sans-serif" }}>
            {current.meaning_ar}
          </p>
        ) : null}
        <p className="text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">{current?.meaning_en || 'No local definition available yet.'}</p>
      </div>

      {current?.examples?.[0] && (
        <div className="w-full bg-slate-900/50 border border-slate-700 rounded-2xl px-4 py-3 mt-2">
          <p className="text-xs uppercase tracking-widest text-slate-500 mb-1">Example</p>
          <p className="text-sm text-slate-300 leading-relaxed">“{current.examples[0]}”</p>
        </div>
      )}

      {current?.sentence && (
        <div className="w-full bg-blue-500/8 border border-blue-500/20 rounded-2xl px-4 py-3 mt-3">
          <p className="text-xs uppercase tracking-widest text-blue-400/80 mb-1">Saved from</p>
          <p className="text-sm text-slate-300 leading-relaxed">{current.sentence}</p>
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-4">
          <p className="text-xs uppercase tracking-widest text-slate-500 mb-2">Recent Attempts</p>
          <div className="flex flex-wrap gap-2">
            {history.map((item) => (
              <span key={item.id} className="px-2.5 py-1 rounded-full bg-slate-900/60 border border-slate-700 text-xs text-slate-300">
                {qualityLabel(item.quality)}
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="text-center text-sm text-slate-500 mt-6">Rate your recall or use keyboard 1–4</p>
    </div>
  );
}

function QuizPanel({
  current,
  choices,
  answered,
  correct,
  selectedChoiceId,
  onSelect,
}: {
  current: SavedWord | null;
  choices: SavedWord[];
  answered: boolean;
  correct: boolean;
  selectedChoiceId: string | null;
  onSelect: (choice: SavedWord) => void;
}) {
  return (
    <div className="p-8 min-h-[320px] flex flex-col justify-center">
      <div className="text-center mb-6">
        <p className="text-xs uppercase tracking-widest text-slate-500 mb-2">Choose the correct meaning</p>
        <h2 className="text-4xl font-bold text-white">{current?.word}</h2>
        {current?.pronunciation && <p className="text-slate-400 font-mono text-lg mt-2">{current.pronunciation}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {choices.map((choice, index) => {
          const isSelected = selectedChoiceId === choice.id;
          const isCorrectChoice = choice.id === current?.id;
          const stateCls = !answered
            ? 'border-slate-700 hover:border-slate-500 hover:bg-slate-800/80'
            : isCorrectChoice
            ? 'border-green-500/40 bg-green-500/10 text-green-300'
            : isSelected
            ? 'border-red-500/40 bg-red-500/10 text-red-300'
            : 'border-slate-700/60 text-slate-500';

          return (
            <button
              key={choice.id}
              disabled={answered}
              onClick={() => onSelect(choice)}
              className={`rounded-2xl border px-4 py-4 text-left transition-all ${stateCls}`}
            >
              <div className="text-xs text-slate-500 mb-1">Option {index + 1}</div>
              <div className="text-sm leading-relaxed">{getMeaningLabel(choice)}</div>
            </button>
          );
        })}
      </div>

      {answered && (
        <div className={`mt-5 rounded-2xl px-4 py-4 border ${correct ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
          <p className={`text-sm font-semibold ${correct ? 'text-green-300' : 'text-red-300'}`}>
            {correct ? 'Correct answer!' : 'Not quite.'}
          </p>
          <p className="text-sm text-slate-300 mt-2">Correct meaning: {getMeaningLabel(current as SavedWord)}</p>
          {current?.sentence && <p className="text-xs text-slate-500 mt-2">Context: {current.sentence}</p>}
        </div>
      )}
    </div>
  );
}

function RatingActions({ onRate, disabled }: { onRate: (quality: number) => void; disabled: boolean }) {
  return (
    <div className="space-y-3">
      <p className="text-center text-sm text-slate-500">How well did you remember it?</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {QUALITY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            disabled={disabled}
            onClick={() => onRate(opt.value)}
            className={`flex flex-col items-center gap-2 p-4 rounded-2xl border border-slate-700 bg-slate-800/50 transition-all duration-200 hover:scale-[1.02] active:scale-95 disabled:opacity-60 ${opt.cls}`}
          >
            <span className="text-2xl">{opt.emoji}</span>
            <span className="text-sm font-semibold text-slate-200">{opt.label}</span>
            <span className="text-xs text-slate-500">{opt.hint}</span>
            <span className="text-[11px] text-slate-600">Key {opt.key}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function QuizResultActions({
  correct,
  disabled,
  onPrimary,
  onSecondary,
}: {
  correct: boolean;
  disabled: boolean;
  onPrimary: () => void;
  onSecondary: () => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-center text-sm text-slate-500">
        {correct ? 'You got it right — how strong did it feel?' : 'You missed it — choose how soon you want to see it again.'}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Button onClick={onPrimary} disabled={disabled} variant={correct ? 'primary' : 'danger'}>
          {correct ? 'Mark Easy' : 'Mark Again'}
        </Button>
        <Button onClick={onSecondary} disabled={disabled} variant="outline">
          {correct ? 'Mark Good' : 'Mark Hard'}
        </Button>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 text-center">
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-slate-500 mt-1">{label}</p>
    </div>
  );
}

function InfoChip({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="px-3 py-1.5 bg-slate-900/60 border border-slate-700 rounded-full text-xs text-slate-300">
      <span className="text-slate-500 mr-1">{label}:</span>
      {value}
    </span>
  );
}

function MiniRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-200 font-medium">{value}</span>
    </div>
  );
}
