/**
 * Smart Review View — unified flashcards + interleaved quiz session.
 *
 * Pedagogy:
 *   • Active Recall      — answer is always hidden until the user commits.
 *   • Retrieval Practice — distractors are mined from the user's real pool.
 *   • Interleaving       — question types alternate within a single session.
 *   • Context-Based      — fill-blank uses the original source sentence.
 *   • Desirable Difficulty — adaptive question type based on mastery score.
 *   • Spaced Repetition  — every answer drives FSRS (Stability/Difficulty).
 *
 * Modes:
 *   • "smart"      — interleaved quiz (default; calls /review/session)
 *   • "flashcards" — classic Anki-style flip with Again/Hard/Good/Easy
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@/store/appStore';
import { useReview } from '@/hooks/useReview';
import { useDictionary } from '@/hooks/useDictionary';
import { Button } from '@/components/ui/Button';
import { LevelBadge } from '@/components/ui/Badge';
import ReviewDashboard from '@/components/review/ReviewDashboard';
import { speak as ttsSpeak } from '@/lib/tts';
import type {
  QuizQuestion,
  QuizSession,
  SavedWord,
  FsrsRating,
} from '@/types';

/* ── Constants ──────────────────────────────────────────────────────── */
const RATINGS: Array<{
  value: FsrsRating;
  key: string;
  label: string;
  emoji: string;
  hint: string;
  color: string;
}> = [
  { value: 1, key: '1', label: 'Again', emoji: '🔁', hint: '10 دقائق', color: 'border-red-500/40 hover:bg-red-500/10' },
  { value: 2, key: '2', label: 'Hard', emoji: '😓', hint: '30 دقيقة', color: 'border-orange-500/40 hover:bg-orange-500/10' },
  { value: 3, key: '3', label: 'Good', emoji: '🙂', hint: 'يوم+', color: 'border-blue-500/40 hover:bg-blue-500/10' },
  { value: 4, key: '4', label: 'Easy', emoji: '🚀', hint: '4 أيام+', color: 'border-green-500/40 hover:bg-green-500/10' },
];

const QUESTION_TYPE_LABEL: Record<string, string> = {
  en_to_ar: 'اختر الترجمة الصحيحة',
  ar_to_en: 'اختر الكلمة الإنجليزية',
  fill_blank: 'أكمل الفراغ',
  definition_match: 'أي كلمة يصفها هذا التعريف؟',
  synonym_match: 'اختر المرادف',
  listening: 'استمع ثم اختر',
};

function speakWord(text: string) {
  const rate = (text || '').trim().split(/\s+/).length <= 2 ? 0.9 : 1.0;
  ttsSpeak(text, { rate });
}

/* ════════════════════════════════════════════════════════════════════ */

export default function FlashcardsView() {
  const activePage = useStore((s) => s.currentPage);

  const {
    session,
    setSession,
    loading,
    startSession,
    submitAnswer,
    rateFlashcard,
    loadDashboard,
    dashboard,
  } = useReview();
  const { loadDueWords, lookupWord, loadStats } = useDictionary();

  // Mode: smart (interleaved quiz) | flashcards (classic flip)
  const [mode, setMode] = useState<'smart' | 'flashcards'>('smart');

  // Smart-quiz state
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [feedback, setFeedback] = useState<{ correct: boolean; explanation: string; error?: string } | null>(null);
  const startedAt = useRef<number>(0);
  const sessionStartAt = useRef<number>(0);

  // Flashcard state
  const [dueWords, setDueWords] = useState<SavedWord[]>([]);
  const [fcIdx, setFcIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const fcStartedAt = useRef<number>(0);

  const [focusDifficult, setFocusDifficult] = useState(false);
  const [practiceMode, setPracticeMode] = useState(false);      // ignore SRS due dates
  const [practiceSort, setPracticeSort] = useState<'smart' | 'random' | 'weakest' | 'newest' | 'oldest'>('smart');
  const [sessionComplete, setSessionComplete] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [emptyMessage, setEmptyMessage] = useState<string | null>(null);
  const [canPractice, setCanPractice] = useState(false);
  const [currentMode, setCurrentMode] = useState<'due' | 'practice' | null>(null);
  const [reloadKey, setReloadKey] = useState(0); // force re-trigger of boot effect

  const currentQ: QuizQuestion | null = session?.questions?.[idx] ?? null;
  const currentFc: SavedWord | null = dueWords[fcIdx] ?? null;

  /* ── Boot ─────────────────────────────────────────────────────── */
  const bootSmart = useCallback(async () => {
    setSessionComplete(false);
    setEmptyMessage(null);
    setCanPractice(false);
    setIdx(0);
    setCorrectCount(0);
    setPicked(null);
    setAnswered(false);
    setFeedback(null);
    sessionStartAt.current = Date.now();
    const { session: s, message, mode, can_practice } = await startSession({
      max_questions: 10,
      focus_difficult: focusDifficult,
      include_all: practiceMode,
      sort: practiceMode ? practiceSort : 'smart',
    });
    setCurrentMode(mode || null);
    if (!s || s.questions.length === 0) {
      setEmptyMessage(message || 'لا توجد كلمات مستحقة للمراجعة الآن.');
      setCanPractice(can_practice);
      setSessionComplete(true);
    }
    startedAt.current = Date.now();
    loadDashboard().catch(() => null);
  }, [startSession, loadDashboard, focusDifficult, practiceMode, practiceSort]);

  const bootFlashcards = useCallback(async () => {
    setSessionComplete(false);
    setEmptyMessage(null);
    setFcIdx(0);
    setFlipped(false);
    setDueWords([]);
    const data = await loadDueWords(20);
    const words = data?.words || [];
    setDueWords(words);
    fcStartedAt.current = Date.now();
    if (!words.length) {
      setEmptyMessage('لا توجد كلمات مستحقة للمراجعة الآن.');
      setSessionComplete(true);
    }
  }, [loadDueWords]);

  // Manual "new session" handler — forces full reset and re-boot
  const startNewSession = useCallback(() => {
    setReloadKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (activePage !== 'flashcards') return;
    if (mode === 'smart') bootSmart();
    else bootFlashcards();
  }, [activePage, mode, reloadKey, practiceMode, practiceSort]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Keyboard shortcuts ───────────────────────────────────────── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (mode === 'smart' && currentQ && !answered) {
        const n = parseInt(e.key, 10);
        if (n >= 1 && n <= currentQ.choices.length) {
          e.preventDefault();
          handlePick(currentQ.choices[n - 1].id);
        }
      } else if (mode === 'flashcards' && currentFc) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          setFlipped((v) => !v);
        } else if (flipped) {
          const r = RATINGS.find((x) => x.key === e.key);
          if (r) {
            e.preventDefault();
            handleRate(r.value);
          }
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, currentQ?.id, currentFc?.id, flipped, answered]); // eslint-disable-line

  /* ── Smart quiz answer ────────────────────────────────────────── */
  const handlePick = useCallback(
    async (choiceId: string) => {
      if (!currentQ || answered) return;
      setPicked(choiceId);
      setAnswered(true);
      const chosen = currentQ.choices.find((c) => c.id === choiceId)!;
      const responseMs = Date.now() - startedAt.current;

      try {
        const res = await submitAnswer({
          saved_word_id: currentQ.saved_word_id,
          question_type: currentQ.type,
          is_correct: !!chosen.is_correct,
          picked_label: chosen.label,
          response_ms: responseMs,
          rate_card: true,
        });
        if (chosen.is_correct) setCorrectCount((c) => c + 1);
        setFeedback({
          correct: !!chosen.is_correct,
          explanation: currentQ.explanation,
          error: res?.error_reason ?? undefined,
        });
        loadStats().catch(() => null);
      } catch {
        setFeedback({ correct: !!chosen.is_correct, explanation: currentQ.explanation });
      }
    },
    [currentQ, answered, submitAnswer, loadStats],
  );

  const nextQuestion = useCallback(() => {
    if (!session) return;
    if (idx + 1 >= session.questions.length) {
      setSessionComplete(true);
      loadDashboard().catch(() => null);
      return;
    }
    setIdx((i) => i + 1);
    setPicked(null);
    setAnswered(false);
    setFeedback(null);
    startedAt.current = Date.now();
  }, [idx, session, loadDashboard]);

  /* ── Flashcard rating ─────────────────────────────────────────── */
  const handleRate = useCallback(
    async (rating: FsrsRating) => {
      if (!currentFc || busy) return;
      setBusy(true);
      const responseMs = Date.now() - fcStartedAt.current;
      try {
        await rateFlashcard(currentFc.id, rating, responseMs);
        const next = fcIdx + 1;
        if (next >= dueWords.length) {
          setSessionComplete(true);
          loadDashboard().catch(() => null);
        } else {
          setFcIdx(next);
          setFlipped(false);
          fcStartedAt.current = Date.now();
        }
      } finally {
        setBusy(false);
      }
    },
    [currentFc, busy, rateFlashcard, fcIdx, dueWords.length, loadDashboard],
  );

  /* ── Loading ──────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-[3px] border-line border-t-blue-500 rounded-full animate-spin mb-5" />
        <p className="text-lg font-bold text-heading">جارٍ تجهيز جلسة المراجعة…</p>
      </div>
    );
  }

  /* ── Empty / Completed ────────────────────────────────────────── */
  const noCurrent = mode === 'smart' ? !currentQ : !currentFc;
  if (sessionComplete || noCurrent) {
    const total = mode === 'smart' ? session?.questions?.length ?? 0 : dueWords.length;
    const acc = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    const minutes = Math.max(1, Math.round((Date.now() - (sessionStartAt.current || Date.now())) / 60000));
    const isEmpty = total === 0 || !!emptyMessage;

    return (
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        <div className="text-center">
          <div className="text-6xl mb-3">{isEmpty ? '✨' : '🎉'}</div>
          <h2 className="text-2xl font-bold text-heading mb-1">
            {isEmpty ? 'كل الكلمات محدّثة!' : 'انتهت الجلسة!'}
          </h2>
          <p className="text-body">
            {isEmpty
              ? emptyMessage || 'لا توجد كلمات مستحقة للمراجعة الآن.'
              : `${correctCount}/${total} صحيحة · ${acc}% · ~${minutes} دقيقة`}
          </p>
          {!isEmpty && practiceMode && (
            <p className="text-[11px] text-purple-300 mt-2">💪 وضع الممارسة — لم تُحدَّث مواعيد المراجعة بناءً على الجدول الذكي بنفس قوة الجلسة المجدوَلة.</p>
          )}
          {isEmpty && canPractice && (
            <p className="text-xs text-muted mt-3">
              لا توجد كلمات مستحقة، لكن لديك كلمات محفوظة — جرّب وضع الممارسة لمراجعة أي كلمة الآن.
            </p>
          )}
          {isEmpty && !canPractice && (
            <p className="text-xs text-muted mt-3">
              احفظ كلمات جديدة من الفيديو أو القارئ، أو عُد لاحقاً عندما تحين مواعيد المراجعة.
            </p>
          )}
        </div>

        {dashboard && (
          <div className="grid grid-cols-2 gap-3">
            <Stat label="متقنة" value={dashboard.stats.mastered} icon="🏆" />
            <Stat label="مألوفة" value={dashboard.stats.familiar} icon="📚" />
            <Stat label="قيد التعلم" value={dashboard.stats.learning} icon="🌱" />
            <Stat
              label="معدل الاحتفاظ"
              value={`${Math.round((dashboard.retention_rate?.flashcard_recall || 0) * 100)}%`}
              icon="🎯"
            />
          </div>
        )}

        <div className="flex flex-col gap-2">
          {/* Primary action: re-run same mode */}
          <Button onClick={startNewSession} variant="primary" disabled={loading}>
            {loading ? '⏳ جارٍ التحميل…' : isEmpty ? '🔄 تحقّق مجدداً' : '🔁 جلسة جديدة'}
          </Button>

          {/* Practice-mode CTA — main fix for "no due words" frustration */}
          {isEmpty && canPractice && !practiceMode && (
            <Button
              onClick={() => {
                setPracticeMode(true);
                setReloadKey((k) => k + 1);
              }}
              variant="primary"
              className="bg-purple-600 hover:bg-purple-700"
            >
              💪 ابدأ جلسة ممارسة (أي كلمة)
            </Button>
          )}

          {/* Toggle back from practice to scheduled mode */}
          {practiceMode && (
            <Button
              onClick={() => {
                setPracticeMode(false);
                setReloadKey((k) => k + 1);
              }}
              variant="outline"
            >
              📅 العودة لوضع المراجعة المجدوَلة
            </Button>
          )}

          <Button onClick={() => setMode(mode === 'smart' ? 'flashcards' : 'smart')} variant="outline">
            {mode === 'smart' ? '🃏 تبديل لبطاقات Anki' : '❓ تبديل لاختبار ذكي'}
          </Button>

          {isEmpty && !canPractice && (
            <Button onClick={() => useStore.getState().setPage('vocabulary')} variant="outline">
              📚 الذهاب إلى قاموسي
            </Button>
          )}
        </div>
      </div>
    );
  }

  /* ── Header (shared) ──────────────────────────────────────────── */
  const total = mode === 'smart' ? session?.questions?.length ?? 0 : dueWords.length;
  const cur = mode === 'smart' ? idx + 1 : fcIdx + 1;
  const pct = total ? (cur / total) * 100 : 0;

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
      {/* Mode toggle + progress */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-heading">المراجعة الذكية</h1>
          <div className="flex gap-1.5">
            <ModeBtn active={mode === 'smart'} onClick={() => setMode('smart')} icon="❓" label="ذكي" />
            <ModeBtn active={mode === 'flashcards'} onClick={() => setMode('flashcards')} icon="🃏" label="بطاقات" />
            <button
              onClick={() => setShowDashboard((v) => !v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                showDashboard ? 'bg-purple-600 text-heading' : 'bg-card text-body hover:text-heading'
              }`}
              title="الإحصائيات"
            >
              📊
            </button>
          </div>
        </div>

        {showDashboard && (
          <div className="mb-4">
            <ReviewDashboard />
          </div>
        )}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-card rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs text-muted tabular-nums">
            {cur}/{total}
          </span>
        </div>
        {mode === 'smart' && (
          <div className="mt-2 space-y-1.5">
            {/* Mode pill: due vs practice */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => {
                  setPracticeMode(false);
                  setReloadKey((k) => k + 1);
                }}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${
                  !practiceMode ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' : 'bg-card text-muted border border-transparent hover:text-body'
                }`}
              >
                📅 المجدوَلة (Due)
              </button>
              <button
                onClick={() => {
                  setPracticeMode(true);
                  setReloadKey((k) => k + 1);
                }}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${
                  practiceMode ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' : 'bg-card text-muted border border-transparent hover:text-body'
                }`}
                title="مارِس أي كلمة محفوظة بغض النظر عن موعد المراجعة"
              >
                💪 ممارسة (الكل)
              </button>

              {/* Practice-mode sort selector */}
              {practiceMode && (
                <select
                  value={practiceSort}
                  onChange={(e) => setPracticeSort(e.target.value as any)}
                  className="ms-auto text-[11px] bg-card border border-line/40 rounded-lg px-2 py-1 text-body cursor-pointer"
                >
                  <option value="smart">🧠 ذكي</option>
                  <option value="weakest">⚠️ الأضعف أولاً</option>
                  <option value="random">🎲 عشوائي</option>
                  <option value="newest">🆕 الأحدث</option>
                  <option value="oldest">📜 الأقدم</option>
                </select>
              )}
            </div>

            <label className="flex items-center gap-2 text-xs text-muted cursor-pointer select-none">
              <input
                type="checkbox"
                checked={focusDifficult}
                onChange={(e) => setFocusDifficult(e.target.checked)}
                className="rounded"
              />
              ركّز على الكلمات الصعبة (Leeches)
            </label>
          </div>
        )}
      </div>

      {/* SMART QUIZ */}
      {mode === 'smart' && currentQ && (
        <SmartQuestionCard
          q={currentQ}
          picked={picked}
          answered={answered}
          feedback={feedback}
          onPick={handlePick}
          onNext={nextQuestion}
          onSpeak={() => currentQ.audio_word && speakWord(currentQ.audio_word)}
          onViewDetail={() => lookupWord(currentQ.word, currentQ.prompt_meta?.original_sentence || '')}
        />
      )}

      {/* FLASHCARDS */}
      {mode === 'flashcards' && currentFc && (
        <FlashcardClassic
          w={currentFc}
          flipped={flipped}
          onFlip={() => setFlipped((v) => !v)}
          onRate={handleRate}
          busy={busy}
          onSpeak={() => speakWord(currentFc.word)}
          onViewDetail={() => lookupWord(currentFc.word, currentFc.sentence || '')}
        />
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════ */
/* ─── Smart Question Card ─────────────────────────────────────────── */

function SmartQuestionCard({
  q,
  picked,
  answered,
  feedback,
  onPick,
  onNext,
  onSpeak,
  onViewDetail,
}: {
  q: QuizQuestion;
  picked: string | null;
  answered: boolean;
  feedback: { correct: boolean; explanation: string; error?: string } | null;
  onPick: (id: string) => void;
  onNext: () => void;
  onSpeak: () => void;
  onViewDetail: () => void;
}) {
  const blankSentence = q.prompt_meta?.sentence_blanked as string | undefined;
  const definition = q.prompt_meta?.definition as string | undefined;
  const isRtlPrompt = q.prompt_meta?.direction === 'rtl';

  return (
    <div className="bg-card/60 border border-line/50 rounded-3xl p-6 min-h-[340px] space-y-5 animate-fadeIn">
      {/* Question type badge */}
      <div className="flex items-center justify-between">
        <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-[11px] font-semibold uppercase tracking-wider">
          {QUESTION_TYPE_LABEL[q.type] || q.type}
        </span>
        <button
          onClick={onSpeak}
          className="p-2 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 transition-colors"
          aria-label="نطق"
        >
          🔊
        </button>
      </div>

      {/* Prompt */}
      <div className="text-center py-2">
        {blankSentence ? (
          <p className="text-xl leading-relaxed text-heading">{blankSentence}</p>
        ) : definition ? (
          <p className="text-base text-body italic leading-relaxed">"{definition}"</p>
        ) : (
          <h2
            className={`text-4xl font-extrabold text-heading ${isRtlPrompt ? 'text-right' : ''}`}
            style={isRtlPrompt ? { direction: 'rtl', fontFamily: "'Noto Sans Arabic', sans-serif" } : {}}
          >
            {q.prompt}
          </h2>
        )}
      </div>

      {/* Choices */}
      <div className="grid gap-2.5">
        {q.choices.map((c, i) => {
          const isThis = picked === c.id;
          let cls = 'border-line hover:border-blue-500/40 hover:bg-card/80';
          if (answered) {
            if (c.is_correct) cls = 'border-green-500/50 bg-green-500/10 text-green-200';
            else if (isThis) cls = 'border-red-500/50 bg-red-500/10 text-red-200';
            else cls = 'border-line/30 opacity-50';
          }
          return (
            <button
              key={c.id}
              disabled={answered}
              onClick={() => onPick(c.id)}
              className={`rounded-xl border px-4 py-3 text-start transition-all text-[15px] text-body ${cls}`}
            >
              <span className="text-faint me-2 font-mono">{i + 1}.</span>
              {c.label}
            </button>
          );
        })}
      </div>

      {/* Feedback */}
      {answered && feedback && (
        <div
          className={`rounded-xl px-4 py-3 border text-sm space-y-1.5 ${
            feedback.correct
              ? 'bg-green-500/10 border-green-500/20 text-green-300'
              : 'bg-red-500/10 border-red-500/20 text-red-300'
          }`}
        >
          <p className="font-semibold">{feedback.correct ? '✓ إجابة صحيحة' : '✗ إجابة خاطئة'}</p>
          <p className="text-body/90">{feedback.explanation}</p>
          {feedback.error && <p className="text-xs opacity-80">💡 {feedback.error}</p>}
        </div>
      )}

      {/* Actions */}
      {answered && (
        <div className="grid grid-cols-2 gap-3">
          <Button onClick={onViewDetail} variant="outline">
            📖 تفاصيل
          </Button>
          <Button onClick={onNext} variant="primary">
            التالي →
          </Button>
        </div>
      )}
    </div>
  );
}

/* ─── Classic Flashcard ───────────────────────────────────────────── */

function FlashcardClassic({
  w,
  flipped,
  onFlip,
  onRate,
  busy,
  onSpeak,
  onViewDetail,
}: {
  w: SavedWord;
  flipped: boolean;
  onFlip: () => void;
  onRate: (r: FsrsRating) => void;
  busy: boolean;
  onSpeak: () => void;
  onViewDetail: () => void;
}) {
  return (
    <>
      <div style={{ perspective: '1200px' }}>
        <div
          className="relative w-full transition-transform duration-500 cursor-pointer"
          style={{
            transformStyle: 'preserve-3d',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0)',
          }}
          onClick={onFlip}
        >
          {/* FRONT */}
          <div
            className="bg-card/60 border border-line/50 rounded-3xl p-8 min-h-[320px] flex flex-col items-center justify-center text-center"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <div className="flex items-center gap-2 mb-2">
              <LevelBadge level={(w.level || 'B1') as any} />
              {w.stage && <StageBadge stage={w.stage} />}
              {typeof w.mastery_score === 'number' && (
                <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 text-[10px] font-bold">
                  {w.mastery_score}/100
                </span>
              )}
            </div>
            <h2 className="text-4xl font-extrabold text-heading mt-3">{w.word}</h2>
            {w.pronunciation && <p className="text-body font-mono text-lg mt-2">{w.pronunciation}</p>}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSpeak();
              }}
              className="mt-5 p-3 rounded-2xl bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 transition-colors text-lg"
            >
              🔊
            </button>
            <p className="text-xs text-faint mt-6">اضغط للكشف ↻</p>
          </div>

          {/* BACK */}
          <div
            className="absolute inset-0 bg-card/60 border border-line/50 rounded-3xl p-6 flex flex-col items-center justify-center text-center overflow-y-auto"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            {w.meaning_ar && (
              <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-2xl px-6 py-4 mb-4 w-full">
                <p className="text-[11px] text-blue-400/60 uppercase tracking-wider mb-1">الترجمة</p>
                <p
                  className="text-2xl font-bold text-heading"
                  style={{ direction: 'rtl', fontFamily: "'Noto Sans Arabic', sans-serif" }}
                >
                  {w.meaning_ar}
                </p>
              </div>
            )}
            {w.meaning_en && (
              <div className="mb-4 w-full">
                <p className="text-[11px] text-muted uppercase tracking-wider mb-1.5">Definition</p>
                <p className="text-[15px] text-heading leading-relaxed">{w.meaning_en}</p>
              </div>
            )}
            {(w.examples?.length ?? 0) > 0 && (
              <div className="bg-surface/50 border border-line/40 rounded-xl px-4 py-3 w-full mb-3">
                <p className="text-[11px] text-muted uppercase tracking-wider mb-1">Example</p>
                <p className="text-sm text-body leading-relaxed italic">"{w.examples![0]}"</p>
              </div>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewDetail();
              }}
              className="text-xs text-blue-400 hover:text-blue-300 mt-2 px-4 py-2 rounded-lg hover:bg-blue-500/10"
            >
              📖 تفاصيل كاملة →
            </button>
          </div>
        </div>
      </div>

      {/* Rating buttons (only when flipped) */}
      {!flipped ? (
        <div className="flex justify-center gap-3">
          <Button onClick={onFlip} variant="primary" className="px-8">
            إظهار الإجابة
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-center text-sm text-muted">ما مدى معرفتك بها؟</p>
          <div className="grid grid-cols-4 gap-2">
            {RATINGS.map((r) => (
              <button
                key={r.value}
                disabled={busy}
                onClick={() => onRate(r.value)}
                className={`flex flex-col items-center gap-1 p-3 rounded-2xl border bg-card/50 transition-all active:scale-95 disabled:opacity-50 ${r.color}`}
              >
                <span className="text-xl">{r.emoji}</span>
                <span className="text-xs font-semibold text-heading">{r.label}</span>
                <span className="text-[10px] text-muted">{r.hint}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

/* ─── Tiny atoms ──────────────────────────────────────────────────── */

function ModeBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: string; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
        active ? 'bg-blue-600 text-heading' : 'bg-card text-body hover:text-heading'
      }`}
    >
      {icon} {label}
    </button>
  );
}

function StageBadge({ stage }: { stage: string }) {
  const map: Record<string, { label: string; color: string }> = {
    new: { label: 'جديدة', color: 'bg-slate-500/15 text-slate-300' },
    learning: { label: 'قيد التعلم', color: 'bg-orange-500/15 text-orange-300' },
    familiar: { label: 'مألوفة', color: 'bg-blue-500/15 text-blue-300' },
    mastered: { label: 'متقنة', color: 'bg-green-500/15 text-green-300' },
  };
  const v = map[stage] || map.new;
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${v.color}`}>{v.label}</span>;
}

function Stat({ label, value, icon }: { label: string; value: number | string; icon?: string }) {
  return (
    <div className="bg-card/60 border border-line/50 rounded-2xl p-3 text-center">
      {icon && <div className="text-lg mb-0.5">{icon}</div>}
      <p className="text-xl font-bold text-heading">{value}</p>
      <p className="text-[11px] text-muted">{label}</p>
    </div>
  );
}
