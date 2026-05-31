/**
 * QuizCards — specialized question renderers for the Smart Review System.
 *
 * Each card is a stateless component that takes a QuizQuestion plus the
 * shared interaction handlers (onAnswer, onSpeak, etc.) and renders the
 * appropriate UI for its question type.
 *
 * Why split this file?
 *   • Keeps FlashcardsView readable.
 *   • Makes each question type independently testable.
 *   • New question types just need a new <XCard /> here + a switch case.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { QuizQuestion, QuizChoice } from '@/types';

/* ────────────────────────────────────────────────────────────────────
 *  Shared handler types
 * ───────────────────────────────────────────────────────────────── */

export interface AnswerPayload {
  is_correct: boolean;
  picked_label?: string;
  response_ms: number;
}

interface CardProps {
  q: QuizQuestion;
  answered: boolean;
  onAnswer: (payload: AnswerPayload) => void;
  onSpeak: (text: string) => void;
}

/* ════════════════════════════════════════════════════════════════════
 *  Public router — picks the right specialised card
 * ══════════════════════════════════════════════════════════════════ */

export function QuizCard(props: CardProps & {
  feedback: { correct: boolean; explanation: string; error?: string } | null;
  onNext: () => void;
  onViewDetail: () => void;
}) {
  const { q, feedback, onNext, onViewDetail } = props;

  // Multi-choice based types share the standard MC card.
  const mcTypes = new Set([
    'en_to_ar', 'ar_to_en', 'fill_blank', 'definition_match',
    'synonym_match', 'listening', 'reverse_listening',
  ]);

  return (
    <div className="bg-card/60 border border-line/50 rounded-3xl p-6 min-h-[340px] space-y-5 animate-fadeIn">
      {/* Question type badge */}
      <QuestionHeader q={q} onSpeak={props.onSpeak} />

      {/* Body: dispatch by type */}
      {mcTypes.has(q.type) && <MCCard {...props} />}
      {q.type === 'sentence_building' && <SentenceBuildingCard {...props} />}
      {q.type === 'error_detection' && <ErrorDetectionCard {...props} />}

      {/* Feedback (shared) */}
      {props.answered && feedback && (
        <FeedbackBanner feedback={feedback} />
      )}

      {/* Actions (shared) */}
      {props.answered && (
        <div className="grid grid-cols-2 gap-3">
          <Button onClick={onViewDetail} variant="outline">📖 تفاصيل</Button>
          <Button onClick={onNext} variant="primary">التالي →</Button>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
 *  Shared header + feedback banner
 * ────────────────────────────────────────────────────────────────── */

const TYPE_LABEL: Record<string, string> = {
  en_to_ar: 'اختر الترجمة الصحيحة',
  ar_to_en: 'اختر الكلمة الإنجليزية',
  fill_blank: 'أكمل الفراغ',
  definition_match: 'أي كلمة يصفها هذا التعريف؟',
  synonym_match: 'اختر المرادف',
  listening: 'استمع ثم اختر',
  reverse_listening: 'استمع للجملة',
  sentence_building: 'رتّب الجملة',
  error_detection: 'اكتشف الخطأ',
};

function QuestionHeader({ q, onSpeak }: { q: QuizQuestion; onSpeak: (t: string) => void }) {
  const showSpeak = q.audio_word || q.type !== 'sentence_building';
  return (
    <div className="flex items-center justify-between">
      <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-[11px] font-semibold uppercase tracking-wider">
        {TYPE_LABEL[q.type] || q.type}
      </span>
      {showSpeak && (
        <button
          onClick={() => onSpeak(q.audio_word || q.word)}
          className="p-2 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 transition-colors"
          aria-label="نطق"
        >
          🔊
        </button>
      )}
    </div>
  );
}

function FeedbackBanner({
  feedback,
}: {
  feedback: { correct: boolean; explanation: string; error?: string };
}) {
  return (
    <div
      className={`rounded-xl px-4 py-3 border text-sm space-y-1.5 ${
        feedback.correct
          ? 'bg-green-500/10 border-green-500/20 text-green-300'
          : 'bg-red-500/10 border-red-500/20 text-red-300'
      }`}
    >
      <p className="font-semibold">{feedback.correct ? '✓ إجابة صحيحة' : '✗ إجابة خاطئة'}</p>
      <p className="text-body/90 whitespace-pre-line">{feedback.explanation}</p>
      {feedback.error && <p className="text-xs opacity-80">💡 {feedback.error}</p>}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
 *  Multiple-choice card (covers 7 of 9 types)
 * ══════════════════════════════════════════════════════════════════ */

function MCCard({ q, answered, onAnswer, onSpeak }: CardProps) {
  const [picked, setPicked] = useState<string | null>(null);
  const startedAt = useRef<number>(Date.now());

  // Reset on question change
  useEffect(() => {
    setPicked(null);
    startedAt.current = Date.now();
    // Auto-play audio for listening types
    if (q.prompt_meta?.play_audio && q.audio_word) {
      // Small delay so the UI mounts first
      const t = setTimeout(() => onSpeak(q.audio_word!), 250);
      return () => clearTimeout(t);
    }
  }, [q.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePick = (c: QuizChoice) => {
    if (answered) return;
    setPicked(c.id);
    onAnswer({
      is_correct: !!c.is_correct,
      picked_label: c.label,
      response_ms: Date.now() - startedAt.current,
    });
  };

  const blankSentence = q.prompt_meta?.sentence_blanked as string | undefined;
  const definition = q.prompt_meta?.definition as string | undefined;
  const isRtlPrompt = q.prompt_meta?.direction === 'rtl';
  const hideWord = q.prompt_meta?.hide_word === true;

  return (
    <>
      {/* Prompt — varies by type */}
      <div className="text-center py-2 space-y-3">
        {/* Listening: just a big speaker button, no spelled word */}
        {q.type === 'listening' && hideWord && (
          <div className="flex flex-col items-center gap-3 py-4">
            <button
              onClick={() => onSpeak(q.audio_word || q.word)}
              className="w-24 h-24 rounded-full bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-4xl transition-all active:scale-95 shadow-lg shadow-blue-500/20"
              aria-label="تشغيل النطق"
            >
              🔊
            </button>
            <p className="text-xs text-muted">اضغط للاستماع مرة أخرى</p>
          </div>
        )}

        {blankSentence && (
          <p className="text-xl leading-relaxed text-heading px-2">{blankSentence}</p>
        )}

        {definition && (
          <p className="text-base text-body italic leading-relaxed">"{definition}"</p>
        )}

        {/* Default: show the word as the prompt */}
        {!hideWord && !blankSentence && !definition && (
          <h2
            className={`text-4xl font-extrabold text-heading ${isRtlPrompt ? 'text-right' : ''}`}
            style={
              isRtlPrompt
                ? { direction: 'rtl', fontFamily: "'Noto Sans Arabic', sans-serif" }
                : {}
            }
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
              onClick={() => handlePick(c)}
              className={`rounded-xl border px-4 py-3 text-start transition-all text-[15px] text-body ${cls}`}
            >
              <span className="text-faint me-2 font-mono">{i + 1}.</span>
              {c.label}
            </button>
          );
        })}
      </div>
    </>
  );
}

/* ════════════════════════════════════════════════════════════════════
 *  Sentence Building — drag-style re-ordering (tap-based, mobile-friendly)
 * ══════════════════════════════════════════════════════════════════ */

function SentenceBuildingCard({ q, answered, onAnswer, onSpeak }: CardProps) {
  const tokens = q.tokens || [];
  const correctOrder = q.correct_order || [];

  // selected = list of indices into `tokens`, in the user's chosen order
  const [selected, setSelected] = useState<number[]>([]);
  const startedAt = useRef<number>(Date.now());

  useEffect(() => {
    setSelected([]);
    startedAt.current = Date.now();
  }, [q.id]);

  const remainingIndices = tokens
    .map((_, i) => i)
    .filter((i) => !selected.includes(i));

  const handleSelect = (idx: number) => {
    if (answered) return;
    setSelected((s) => [...s, idx]);
  };

  const handleUnselect = (idx: number) => {
    if (answered) return;
    setSelected((s) => s.filter((i) => i !== idx));
  };

  const handleReset = () => {
    if (answered) return;
    setSelected([]);
  };

  const handleSubmit = () => {
    if (answered || selected.length !== tokens.length) return;
    const isCorrect = selected.every((idx, pos) => idx === correctOrder[pos]);
    const built = selected.map((i) => tokens[i]).join(' ');
    onAnswer({
      is_correct: isCorrect,
      picked_label: built,
      response_ms: Date.now() - startedAt.current,
    });
  };

  const userSentence = selected.map((i) => tokens[i]).join(' ');

  return (
    <div className="space-y-4">
      {/* Hint: speaker button to hear the target sentence */}
      <div className="flex items-center justify-between bg-blue-500/5 border border-blue-500/20 rounded-xl px-3 py-2">
        <p className="text-xs text-blue-200">💡 الكلمة المستهدفة: <span className="font-bold">{q.prompt_meta?.target_word || q.word}</span></p>
        {q.audio_word && (
          <button
            onClick={() => onSpeak(q.audio_word!)}
            className="text-xs px-2 py-1 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300"
          >
            🔊 استمع
          </button>
        )}
      </div>

      {/* Built sentence area */}
      <div className="min-h-[80px] bg-surface/50 border-2 border-dashed border-line/40 rounded-2xl p-3 flex flex-wrap gap-2 items-start content-start">
        {selected.length === 0 && (
          <p className="text-xs text-faint w-full text-center py-4">
            اضغط على الكلمات بالترتيب الصحيح
          </p>
        )}
        {selected.map((idx, pos) => (
          <button
            key={`sel-${pos}`}
            disabled={answered}
            onClick={() => handleUnselect(idx)}
            className="px-3 py-1.5 rounded-lg bg-blue-500/20 border border-blue-500/40 text-blue-100 text-sm hover:bg-blue-500/30 transition-colors disabled:opacity-60"
          >
            {tokens[idx]}
          </button>
        ))}
      </div>

      {/* Available tokens */}
      <div className="flex flex-wrap gap-2">
        {remainingIndices.map((idx) => (
          <button
            key={`tok-${idx}`}
            disabled={answered}
            onClick={() => handleSelect(idx)}
            className="px-3 py-1.5 rounded-lg bg-card/80 border border-line/50 text-body text-sm hover:border-blue-500/40 hover:bg-card transition-colors disabled:opacity-50"
          >
            {tokens[idx]}
          </button>
        ))}
      </div>

      {/* Actions */}
      {!answered && (
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={handleReset} variant="outline" disabled={selected.length === 0}>
            🔄 إعادة
          </Button>
          <Button
            onClick={handleSubmit}
            variant="primary"
            disabled={selected.length !== tokens.length}
          >
            تحقّق ✓
          </Button>
        </div>
      )}

      {answered && userSentence && (
        <div className="text-xs text-muted text-center">
          إجابتك: <span className="text-body">{userSentence}</span>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
 *  Error Detection — click the wrong word in the sentence
 * ══════════════════════════════════════════════════════════════════ */

function ErrorDetectionCard({ q, answered, onAnswer, onSpeak }: CardProps) {
  const [picked, setPicked] = useState<string | null>(null);
  const startedAt = useRef<number>(Date.now());

  useEffect(() => {
    setPicked(null);
    startedAt.current = Date.now();
  }, [q.id]);

  const handlePick = (c: QuizChoice) => {
    if (answered) return;
    setPicked(c.id);
    onAnswer({
      is_correct: !!c.is_correct,
      picked_label: c.label,
      response_ms: Date.now() - startedAt.current,
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted text-center">
        إحدى الكلمات في الجملة التالية غير صحيحة — اضغط عليها:
      </p>

      <div className="bg-surface/50 border border-line/40 rounded-2xl p-4 text-center">
        <p className="text-lg leading-loose flex flex-wrap justify-center gap-x-1.5 gap-y-2">
          {q.choices.map((c) => {
            const isThis = picked === c.id;
            let cls = 'hover:bg-blue-500/20 cursor-pointer';
            if (answered) {
              if (c.is_correct) cls = 'bg-red-500/30 text-red-200 ring-2 ring-red-500';
              else if (isThis) cls = 'bg-orange-500/30 text-orange-200 ring-2 ring-orange-500';
              else cls = 'opacity-60';
            }
            return (
              <span
                key={c.id}
                onClick={() => handlePick(c)}
                className={`inline-block px-2 py-0.5 rounded-md transition-all ${cls}`}
              >
                {c.label}
              </span>
            );
          })}
        </p>
      </div>

      {q.audio_word && (
        <div className="flex justify-center">
          <button
            onClick={() => onSpeak(q.audio_word!)}
            className="text-xs px-3 py-1.5 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 text-blue-300"
          >
            🔊 استمع للجملة الصحيحة
          </button>
        </div>
      )}
    </div>
  );
}
