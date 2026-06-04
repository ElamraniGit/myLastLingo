/**
 * NotificationCenter — In-app toast notification system.
 *
 * Renders a stack of toasts in the top-right corner (desktop) or
 * top-center (mobile). Each toast:
 *  - slides down on enter, slides up on exit
 *  - has a progress bar that drains over `duration` ms
 *  - has optional action button that navigates to a page
 *  - dismissible by tap/click or swipe-right (mobile)
 *  - max 4 toasts visible at once (oldest auto-removed)
 *  - pauses progress on hover
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useStore } from '@/store/appStore';
import { onInApp, type InAppNotif, type NotifType } from '@/lib/notifications';

const TYPE_STYLES: Record<NotifType, { bg: string; border: string; bar: string }> = {
  review_reminder: { bg: 'bg-blue-600/95',   border: 'border-blue-500/40',   bar: 'bg-blue-300'  },
  streak_warning:  { bg: 'bg-orange-600/95', border: 'border-orange-500/40', bar: 'bg-orange-300'},
  streak_achieved: { bg: 'bg-orange-500/95', border: 'border-orange-400/40', bar: 'bg-yellow-300'},
  daily_goal:      { bg: 'bg-green-600/95',  border: 'border-green-500/40',  bar: 'bg-green-300' },
  milestone:       { bg: 'bg-purple-600/95', border: 'border-purple-500/40', bar: 'bg-purple-300'},
  offline_synced:  { bg: 'bg-slate-700/95',  border: 'border-slate-600/40',  bar: 'bg-slate-400' },
  info:            { bg: 'bg-slate-700/95',  border: 'border-slate-600/40',  bar: 'bg-slate-400' },
};

// ── Single Toast ──────────────────────────────────────────────────────────────
function Toast({ notif, onDismiss }: { notif: InAppNotif; onDismiss: (id: string) => void }) {
  const { setPage } = useStore();
  const [visible,  setVisible]  = useState(false);
  const [progress, setProgress] = useState(100);
  const [paused,   setPaused]   = useState(false);
  const startRef  = useRef<number>(Date.now());
  const elapsed   = useRef<number>(0);
  const rafRef    = useRef<number | null>(null);
  const duration  = notif.duration ?? 5000;
  const style     = TYPE_STYLES[notif.type] ?? TYPE_STYLES.info;

  // Animate in
  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  // Progress bar
  useEffect(() => {
    if (paused) {
      elapsed.current += Date.now() - startRef.current;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    startRef.current = Date.now();

    const tick = () => {
      const total = elapsed.current + (Date.now() - startRef.current);
      const pct   = Math.max(0, 100 - (total / duration) * 100);
      setProgress(pct);
      if (pct > 0) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        dismiss();
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [paused]); // eslint-disable-line

  const dismiss = useCallback(() => {
    setVisible(false);
    setTimeout(() => onDismiss(notif.id), 300);
  }, [notif.id, onDismiss]);

  const handleAction = useCallback(() => {
    if (notif.action?.page) setPage(notif.action.page as any);
    dismiss();
  }, [notif.action, setPage, dismiss]);

  return (
    <div
      className={`relative w-full max-w-sm rounded-2xl border shadow-2xl overflow-hidden
                  transition-all duration-300 select-none cursor-default
                  ${style.bg} ${style.border}
                  ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-3'}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Content */}
      <div className="flex items-start gap-3 px-4 pt-3.5 pb-3">
        {notif.icon && (
          <span className="text-xl shrink-0 mt-0.5">{notif.icon}</span>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white leading-tight">{notif.title}</p>
          <p className="text-xs text-white/75 mt-0.5 leading-relaxed">{notif.body}</p>
          {notif.action && (
            <button
              onClick={handleAction}
              className="mt-2 text-xs font-semibold text-white bg-white/20 hover:bg-white/30
                         px-3 py-1 rounded-lg transition-colors"
            >
              {notif.action.label}
            </button>
          )}
        </div>
        <button
          onClick={dismiss}
          className="w-6 h-6 rounded-lg flex items-center justify-center text-white/60
                     hover:text-white hover:bg-white/15 transition-colors shrink-0 mt-0.5"
          aria-label="Dismiss"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
               strokeLinecap="round" className="w-3.5 h-3.5">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-white/10">
        <div
          className={`h-full ${style.bar} transition-none`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// ── Notification Center ───────────────────────────────────────────────────────
export default function NotificationCenter() {
  const [toasts, setToasts] = useState<InAppNotif[]>([]);

  const add = useCallback((notif: InAppNotif) => {
    setToasts(prev => {
      const next = [notif, ...prev];
      // Max 4 toasts; discard oldest
      return next.slice(0, 4);
    });
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(n => n.id !== id));
  }, []);

  // Subscribe to in-app notification events
  useEffect(() => onInApp(add), [add]);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-16 right-3 left-3 z-[60] flex flex-col gap-2
                 lg:left-auto lg:right-4 lg:top-4 lg:w-80 pointer-events-none"
    >
      {toasts.map(n => (
        <div key={n.id} className="pointer-events-auto">
          <Toast notif={n} onDismiss={dismiss}/>
        </div>
      ))}
    </div>
  );
}
