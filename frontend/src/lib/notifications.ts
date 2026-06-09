/**
 * notifications.ts — Unified notification system.
 *
 * TWO layers:
 *  1. Push Notifications (Web Push API via Service Worker)
 *     - Works even when app is closed (Android / desktop Chrome)
 *     - Scheduled via setTimeout in SW (no server needed)
 *     - Shows native OS notification: "X words due for review"
 *
 *  2. In-App Notifications (custom event bus)
 *     - Toast/banner shown while the app is open
 *     - Types: review_reminder, streak_warning, streak_achieved,
 *              daily_goal, milestone, offline_synced
 *
 * Storage keys (localStorage):
 *  ll-notif-enabled        'true'|'false'
 *  ll-notif-time           'HH:MM' (default '09:00')
 *  ll-notif-streak-warn    'true'|'false'
 *  ll-notif-scheduled-at   ISO timestamp of last schedule
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type NotifType =
  | 'review_reminder'
  | 'streak_warning'
  | 'streak_achieved'
  | 'daily_goal'
  | 'milestone'
  | 'offline_synced'
  | 'info';

export interface InAppNotif {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  icon?: string;
  action?: { label: string; page: string };
  duration?: number; // ms, default 5000
  createdAt: number;
}

// ── Settings ──────────────────────────────────────────────────────────────────

export const NotifSettings = {
  isEnabled():      boolean { return localStorage.getItem('ll-notif-enabled')      === 'true'; },
  isStreakWarn():   boolean { return localStorage.getItem('ll-notif-streak-warn')  !== 'false'; },
  getTime():        string  { return localStorage.getItem('ll-notif-time')          || '09:00'; },

  setEnabled(v: boolean)    { localStorage.setItem('ll-notif-enabled',     String(v)); },
  setStreakWarn(v: boolean)  { localStorage.setItem('ll-notif-streak-warn', String(v)); },
  setTime(t: string)        { localStorage.setItem('ll-notif-time', t); },
};

// ── Permission request ────────────────────────────────────────────────────────

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied')  return false;

  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

// ── Push notification (via SW) ────────────────────────────────────────────────

export async function scheduleDailyReviewNotification(
  dueCount: number,
  timeStr: string   // 'HH:MM'
): Promise<void> {
  if (typeof window === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  if (!('serviceWorker' in navigator)) return;

  const sw = await navigator.serviceWorker.ready.catch(() => null);
  if (!sw) return;

  // Calculate ms until next occurrence of timeStr today (or tomorrow)
  const [hStr, mStr] = timeStr.split(':');
  const h = parseInt(hStr, 10) || 9;
  const m = parseInt(mStr, 10) || 0;

  const now  = new Date();
  const next = new Date();
  next.setHours(h, m, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1); // tomorrow

  const msUntil = next.getTime() - now.getTime();

  // Tell SW to fire a notification after msUntil ms
  sw.active?.postMessage({
    type: 'SCHEDULE_NOTIFICATION',
    payload: {
      delayMs:  msUntil,
      title:    dueCount > 0 ? `${dueCount} words due for review` : 'Time to study!',
      body:     dueCount > 0
        ? `You have ${dueCount} word${dueCount === 1 ? '' : 's'} waiting. Keep your streak alive!`
        : 'Open LinguaLearn and do a quick review session.',
      icon:  '/icons/icon-192x192.svg',
      badge: '/icons/icon-192x192.svg',
      tag:   'll-daily-review',
      data:  { page: 'flashcards' },
    },
  });

  localStorage.setItem('ll-notif-scheduled-at', new Date().toISOString());
}

export async function sendTestNotification(): Promise<boolean> {
  // Lets the user confirm push notifications actually work on their device.
  if (typeof window === 'undefined' || Notification.permission !== 'granted') return false;
  if (!('serviceWorker' in navigator)) return false;
  const sw = await navigator.serviceWorker.ready.catch(() => null);
  if (!sw) return false;

  sw.active?.postMessage({
    type: 'SCHEDULE_NOTIFICATION',
    payload: {
      delayMs: 0, // immediate
      title:   '✅ Notifications are on',
      body:    "Great! You'll get a daily reminder to review your words.",
      icon:    '/icons/icon-192x192.svg',
      badge:   '/icons/icon-192x192.svg',
      tag:     'll-test',
      data:    { page: 'flashcards' },
    },
  });
  return true;
}

export async function sendStreakWarningNotification(streakDays: number): Promise<void> {
  if (Notification.permission !== 'granted') return;
  if (!('serviceWorker' in navigator)) return;
  const sw = await navigator.serviceWorker.ready.catch(() => null);
  if (!sw) return;

  sw.active?.postMessage({
    type: 'SCHEDULE_NOTIFICATION',
    payload: {
      delayMs: 0,  // immediate
      title:   `Streak at risk — ${streakDays} days`,
      body:    "Don't break your streak! Do a quick review now.",
      icon:    '/icons/icon-192x192.svg',
      tag:     'll-streak-warn',
      data:    { page: 'flashcards' },
    },
  });
}

// ── In-App event bus ──────────────────────────────────────────────────────────

const NOTIF_EVENT = 'll:notification';

export function emitInApp(notif: Omit<InAppNotif, 'id' | 'createdAt'>): void {
  if (typeof window === 'undefined') return;
  const full: InAppNotif = {
    ...notif,
    id:        `n_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    createdAt: Date.now(),
    duration:  notif.duration ?? 5000,
  };
  window.dispatchEvent(new CustomEvent(NOTIF_EVENT, { detail: full }));
}

export function onInApp(handler: (n: InAppNotif) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const fn = (e: Event) => handler((e as CustomEvent<InAppNotif>).detail);
  window.addEventListener(NOTIF_EVENT, fn);
  return () => window.removeEventListener(NOTIF_EVENT, fn);
}

// ── Convenience emitters ──────────────────────────────────────────────────────

export function notifyReviewReady(dueCount: number): void {
  emitInApp({
    type:   'review_reminder',
    title:  `${dueCount} words due`,
    body:   `Tap to start your review session`,
    icon:   '📖',
    action: { label: 'Review now', page: 'flashcards' },
    duration: 8000,
  });
}

export function notifyStreakWarning(streakDays: number): void {
  emitInApp({
    type:   'streak_warning',
    title:  'Streak at risk!',
    body:   `You have a ${streakDays}-day streak. Don't lose it — review something!`,
    icon:   '🔔',
    action: { label: 'Review now', page: 'flashcards' },
    duration: 10000,
  });
}

export function notifyStreakAchieved(streakDays: number): void {
  emitInApp({
    type:   'streak_achieved',
    title:  `${streakDays}-day streak!`,
    body:   `Amazing! You've studied ${streakDays} days in a row.`,
    icon:   '🔔',
    duration: 6000,
  });
}

export function notifyDailyGoal(xp: number, goal: number): void {
  emitInApp({
    type:   'daily_goal',
    title:  `⭐ Daily goal reached!`,
    body:   `You earned ${xp} XP today — goal of ${goal} XP achieved!`,
    icon:   '⭐',
    duration: 6000,
  });
}

export function notifyMilestone(label: string): void {
  emitInApp({
    type:   'milestone',
    title:  `Milestone: ${label}`,
    body:   `Keep up the great work!`,
    icon:   '🌟',
    duration: 7000,
  });
}

export function notifyOfflineSynced(count: number): void {
  emitInApp({
    type:   'offline_synced',
    title:  `Synced ${count} offline change${count === 1 ? '' : 's'}`,
    body:   `Your data is up to date.`,
    icon:   '✓',
    duration: 4000,
  });
}
