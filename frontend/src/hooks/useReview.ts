/**
 * useReview — React hook for the Smart Review System.
 *
 * Exposes:
 *   - startSession()      → builds an interleaved quiz session
 *   - submitAnswer()      → records answer + drives FSRS automatically
 *   - rateFlashcard()     → Anki-style Again/Hard/Good/Easy
 *   - loadDashboard()     → analytics
 *   - loadDailyPlan()     → today's balanced plan
 */

import { useCallback, useState } from 'react';
import { reviewApi } from '@/lib/api';
import { awardXP } from '@/components/common/XPBar';
import type { QuizSession, ReviewDashboard, FsrsRating } from '@/types';

export function useReview() {
  const [session, setSession] = useState<QuizSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [dashboard, setDashboard] = useState<ReviewDashboard | null>(null);

  const startSession = useCallback(
    async (opts: {
      max_questions?: number;
      focus_difficult?: boolean;
      include_all?: boolean;
      sort?: 'smart' | 'random' | 'weakest' | 'newest' | 'oldest';
    } = {}) => {
      setLoading(true);
      setSession(null); // clear stale session first so the UI shows loading
      try {
        const data = await reviewApi.startSession(opts);
        const s: QuizSession | null = data?.session ?? null;
        setSession(s);
        return {
          session: s,
          summary: data?.summary ?? null,
          message: data?.message as string | undefined,
          mode: data?.mode as 'due' | 'practice' | undefined,
          can_practice: !!data?.can_practice,
          error: undefined as string | undefined,
        };
      } catch (e: any) {
        console.error('startSession failed', e);
        setSession(null);
        // Surface the real reason so users can act on it.
        const status = e?.status;
        const msg = e?.message || 'فشل تحميل الجلسة';
        let userMessage: string;
        if (status === 404) {
          userMessage = '❌ نقطة API غير موجودة (404). يبدو أن الـ backend يعمل بنسخة قديمة. أعد تشغيله بعد سحب آخر التحديثات: git pull → python run.py';
        } else if (status === 401 || status === 403) {
          userMessage = '🔒 الجلسة منتهية. سجّل الدخول مجدداً.';
        } else if (status === 0 || status === 408) {
          userMessage = '🔌 لا يمكن الاتصال بـ backend. تأكد أن python run.py يعمل على المنفذ 8080.';
        } else if (status >= 500) {
          userMessage = `💥 خطأ في الخادم (${status}): ${msg}`;
        } else {
          userMessage = `⚠️ ${msg}${status ? ` (${status})` : ''}`;
        }
        return {
          session: null,
          summary: null,
          message: userMessage,
          mode: undefined,
          can_practice: false,
          error: userMessage,
        };
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const submitAnswer = useCallback(
    async (payload: {
      saved_word_id: string;
      question_type: string;
      is_correct: boolean;
      picked_label?: string;
      response_ms?: number;
      rate_card?: boolean;
    }) => {
      const res = await reviewApi.submitAnswer({ rate_card: true, ...payload });
      if (payload.is_correct) awardXP('review_word');
      return res;
    },
    [],
  );

  const rateFlashcard = useCallback(async (savedWordId: string, rating: FsrsRating, responseMs = 0) => {
    const res = await reviewApi.rateFlashcard(savedWordId, rating, responseMs);
    awardXP(rating >= 3 ? 'review_perfect' : 'review_word');
    return res;
  }, []);

  const loadDashboard = useCallback(async () => {
    const d = (await reviewApi.dashboard()) as ReviewDashboard;
    setDashboard(d);
    return d;
  }, []);

  const loadDailyPlan = useCallback(async () => reviewApi.daily(), []);

  return {
    session,
    setSession,
    loading,
    dashboard,
    startSession,
    submitAnswer,
    rateFlashcard,
    loadDashboard,
    loadDailyPlan,
  };
}
