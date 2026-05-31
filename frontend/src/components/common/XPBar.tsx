/**
 * XP Bar — shows level, XP progress, streak, and daily XP in the header.
 *
 * Also globally manages "achievement-unlocked" toasts so any awardXP() call
 * anywhere in the app automatically triggers a celebration banner.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { xpApi } from '@/lib/api';
import type { Achievement, XPStatus } from '@/types';

export default function XPBar() {
  const [data, setData] = useState<XPStatus | null>(null);
  const [toasts, setToasts] = useState<Achievement[]>([]);

  const refresh = useCallback(() => {
    xpApi.getStatus().then(setData).catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 30000);
    return () => clearInterval(iv);
  }, [refresh]);

  // React to global XP/achievement events
  useEffect(() => {
    const refreshHandler = () => refresh();
    const unlockHandler = (e: Event) => {
      const ce = e as CustomEvent<Achievement[]>;
      const list = ce.detail || [];
      if (!list.length) return;
      setToasts((t) => [...t, ...list]);
      // Auto-dismiss each toast after 5s
      list.forEach((a) => {
        setTimeout(() => {
          setToasts((t) => t.filter((x) => x.id !== a.id));
        }, 5500);
      });
    };
    window.addEventListener('xp-updated', refreshHandler);
    window.addEventListener('achievement-unlocked', unlockHandler);
    return () => {
      window.removeEventListener('xp-updated', refreshHandler);
      window.removeEventListener('achievement-unlocked', unlockHandler);
    };
  }, [refresh]);

  if (!data) return null;

  const pct = data.next_level_xp > 0 ? Math.min((data.progress / 100) * 100, 100) : 0;
  const longest = data.longest_streak ?? data.streak_days;

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Streak */}
        {data.streak_days > 0 && (
          <div
            className="flex items-center gap-0.5 text-orange-400"
            title={`سلسلة حالية: ${data.streak_days} يوم${
              longest > data.streak_days ? ` · الأطول: ${longest}` : ''
            }`}
          >
            <span className="text-xs">🔥</span>
            <span className="text-[10px] font-bold">{data.streak_days}</span>
          </div>
        )}

        {/* Level + XP bar */}
        <div className="flex items-center gap-1.5">
          <div
            className="w-5 h-5 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-sm"
            title={`المستوى ${data.level}`}
          >
            <span className="text-[9px] font-black text-white">{data.level}</span>
          </div>
          <div
            className="w-16 h-1.5 bg-elevated rounded-full overflow-hidden"
            title={`${data.progress}/100 XP إلى المستوى التالي`}
          >
            <div
              className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-[10px] text-muted font-medium tabular-nums">
            {data.total_xp}
          </span>
        </div>
      </div>

      {/* Achievement toasts (fixed bottom-center, stack upward) */}
      {toasts.length > 0 && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center pointer-events-none">
          {toasts.map((a, idx) => (
            <div
              key={a.id + idx}
              className="pointer-events-auto bg-gradient-to-r from-yellow-500/95 to-amber-600/95 text-white rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3 max-w-sm animate-fadeIn"
              role="status"
            >
              <div className="text-3xl">{a.icon}</div>
              <div className="flex-1 text-start">
                <p className="text-[10px] uppercase tracking-wider opacity-90">
                  🏆 إنجاز جديد
                </p>
                <p className="font-bold leading-tight">{a.title}</p>
                <p className="text-xs opacity-90">+{a.xp_reward} XP</p>
              </div>
              <button
                onClick={() => setToasts((t) => t.filter((x) => x.id !== a.id))}
                className="text-white/70 hover:text-white text-sm"
                aria-label="إغلاق"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/**
 * Helper to award XP from anywhere in the app.
 * Automatically:
 *   • refreshes the XP bar via 'xp-updated'
 *   • dispatches 'achievement-unlocked' for any newly-unlocked items so
 *     the bar shows a celebration toast.
 *
 * Usage:
 *   import { awardXP } from '@/components/common/XPBar';
 *   awardXP('save_word');
 */
export async function awardXP(action: string, amount?: number) {
  try {
    const res = await xpApi.addXP(action, amount);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('xp-updated'));
      const newAch: Achievement[] = res?.new_achievements || [];
      if (newAch.length > 0) {
        window.dispatchEvent(
          new CustomEvent('achievement-unlocked', { detail: newAch }),
        );
      }
    }
    return res;
  } catch {
    // XP is non-critical — silently ignore.
    return null;
  }
}
