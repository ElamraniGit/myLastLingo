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
    async (opts: { max_questions?: number; focus_difficult?: boolean } = {}) => {
      setLoading(true);
      try {
        const data = await reviewApi.startSession(opts);
        const s: QuizSession | null = data?.session ?? null;
        setSession(s);
        return { session: s, summary: data?.summary ?? null };
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
