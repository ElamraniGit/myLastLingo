/**
 * useNotifications — Orchestrates both push + in-app notifications.
 *
 * On app start:
 *  1. If notifications enabled + permission granted → schedule daily push
 *  2. Check due words → show in-app review reminder if due > 0
 *  3. Check streak → warn if no review yet today and streak > 0
 *  4. Listen for SW 'NAVIGATE' messages → setPage()
 *
 * Also exports helpers for settings UI.
 */

import { useEffect, useCallback } from 'react';
import { useStore } from '@/store/appStore';
import { vocabularyApi, xpApi } from '@/lib/api';
import {
  NotifSettings,
  requestNotificationPermission,
  notificationPermission,
  scheduleDailyReviewNotification,
  sendStreakWarningNotification,
  notifyReviewReady,
  notifyStreakWarning,
  notifyStreakAchieved,
  notifyDailyGoal,
  notifyMilestone,
  notifyOfflineSynced,
} from '@/lib/notifications';

// Re-export for convenience
export {
  NotifSettings,
  requestNotificationPermission,
  notificationPermission,
  notifyReviewReady,
  notifyStreakWarning,
  notifyStreakAchieved,
  notifyDailyGoal,
  notifyMilestone,
  notifyOfflineSynced,
};

// Milestone thresholds (total words saved)
const MILESTONES = [10, 25, 50, 100, 200, 500];

export function useNotifications() {
  const { setPage, user } = useStore();

  // ── Listen for SW NAVIGATE messages ────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'NAVIGATE' && event.data.page) {
        setPage(event.data.page);
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, [setPage]);

  // ── Bootstrap on mount ──────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined' || !user) return;

    // Small delay — don't block initial render
    const t = setTimeout(async () => {
      try {
        await runNotificationCheck(user);
      } catch {}
    }, 3500);

    return () => clearTimeout(t);
  }, [user]); // eslint-disable-line
}

// ── Main check (runs once on mount, after 3.5s) ───────────────────────────────
async function runNotificationCheck(user: any) {
  const enabled    = NotifSettings.isEnabled();
  const permission = notificationPermission();
  const timeStr    = NotifSettings.getTime();

  // 1. Schedule push notification if enabled + granted
  if (enabled && permission === 'granted') {
    try {
      const data = await vocabularyApi.due(1);
      const due  = data?.count ?? 0;
      await scheduleDailyReviewNotification(due, timeStr);
    } catch {}
  }

  // 2. Fetch live due + xp data for in-app checks
  let dueCount = 0;
  let xpData: any = null;
  try {
    const [dueRes, xp] = await Promise.all([
      vocabularyApi.due(1),
      xpApi.getStatus(),
    ]);
    dueCount = dueRes?.count ?? 0;
    xpData   = xp;
  } catch {}

  // 3. In-app: review reminder (only if due > 0 and not shown today)
  const lastReviewNotif = localStorage.getItem('ll-notif-review-shown');
  const todayKey        = new Date().toISOString().slice(0, 10);
  if (dueCount > 0 && lastReviewNotif !== todayKey) {
    notifyReviewReady(dueCount);
    localStorage.setItem('ll-notif-review-shown', todayKey);
  }

  // 4. In-app: streak warning (>0 streak, no review today yet)
  const streak        = xpData?.streak_days ?? user?.streak_days ?? 0;
  const reviewedToday = xpData?.reviewed_today ?? 0;
  if (streak > 0 && reviewedToday === 0 && NotifSettings.isStreakWarn()) {
    const lastWarn = localStorage.getItem('ll-notif-streak-warn-shown');
    if (lastWarn !== todayKey) {
      // Delay streak warning by 2h after daily-review notif to avoid noise
      setTimeout(() => {
        notifyStreakWarning(streak);
        if (enabled && permission === 'granted') {
          sendStreakWarningNotification(streak).catch(() => {});
        }
      }, 7200000); // 2h
      localStorage.setItem('ll-notif-streak-warn-shown', todayKey);
    }
  }

  // 5. Daily goal celebration
  if (xpData) {
    const dailyXP   = xpData.daily_xp   ?? 0;
    const dailyGoal = xpData.daily_goal  ?? 50;
    const lastGoal  = localStorage.getItem('ll-notif-goal-shown');
    if (dailyXP >= dailyGoal && dailyXP > 0 && lastGoal !== todayKey) {
      notifyDailyGoal(dailyXP, dailyGoal);
      localStorage.setItem('ll-notif-goal-shown', todayKey);
    }
  }

  // 6. Milestone check (total saved words)
  try {
    const stats = await vocabularyApi.stats();
    const total = stats?.total ?? 0;
    const lastMilestone = parseInt(localStorage.getItem('ll-notif-milestone') || '0', 10);
    const nextMilestone = MILESTONES.find(m => m > lastMilestone && total >= m);
    if (nextMilestone) {
      notifyMilestone(`${nextMilestone} words saved!`);
      localStorage.setItem('ll-notif-milestone', String(nextMilestone));
    }
  } catch {}
}
