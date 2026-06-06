/**
 * XPBar — compact header widget: streak · daily goal · level bar
 *
 * awardXP():
 *   - Online  → calls /xp/add immediately + fires 'xp-updated' event
 *   - Offline → enqueues in IndexedDB xpQueue + updates local optimistic state
 *               Synced automatically when device comes back online (useOffline)
 */
import React, { useEffect, useState, useCallback } from 'react';
import { xpApi } from '@/lib/api';
import { enqueueXP } from '@/lib/offlineStore';

interface XPData {
  total_xp: number; level: number; streak_days: number;
  daily_xp: number; next_level_xp: number; progress: number;
  daily_goal?: number; daily_goal_met?: boolean;
}

// Local optimistic XP accumulator (reset on page load from server)
let _localXP = 0;

export default function XPBar() {
  const [data,   setData]   = useState<XPData | null>(null);
  const [bounce, setBounce] = useState(false);

  const refresh = useCallback(() => {
    xpApi.getStatus().then(d => {
      setData(prev => {
        if (prev && d.streak_days > prev.streak_days) {
          setBounce(true);
          setTimeout(() => setBounce(false), 700);
        }
        _localXP = 0;  // server data received — reset local optimistic counter
        return d;
      });
    }).catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 30_000);
    return () => clearInterval(iv);
  }, [refresh]);

  useEffect(() => {
    const h = () => refresh();
    window.addEventListener('xp-updated', h);
    return () => window.removeEventListener('xp-updated', h);
  }, [refresh]);

  // Listen for optimistic local XP events (offline)
  useEffect(() => {
    const h = (e: Event) => {
      const amount = (e as CustomEvent<number>).detail ?? 0;
      setData(prev => {
        if (!prev) return prev;
        const newTotal   = prev.total_xp + amount;
        const newDaily   = prev.daily_xp + amount;
        const goal       = prev.daily_goal ?? 50;
        return {
          ...prev,
          total_xp:      newTotal,
          daily_xp:      newDaily,
          progress:      newTotal % 100,
          level:         Math.floor(newTotal / 100) + 1,
          next_level_xp: (Math.floor(newTotal / 100) + 1) * 100,
          daily_goal_met: newDaily >= goal,
        };
      });
    };
    window.addEventListener('xp-local', h as EventListener);
    return () => window.removeEventListener('xp-local', h as EventListener);
  }, []);

  if (!data) return null;

  const pct      = Math.min(data.progress, 100);
  const goal     = data.daily_goal ?? 50;
  const dailyPct = Math.min(Math.round((data.daily_xp / Math.max(goal, 1)) * 100), 100);

  return (
    <div className="flex items-center gap-2">

      {/* Streak */}
      {data.streak_days > 0 && (
        <div className={`flex items-center gap-1 bg-orange-500/10 rounded-md px-1.5 py-0.5 transition-transform ${bounce ? 'scale-125' : 'scale-100'}`}>
          <svg className={`w-3 h-3 text-orange-500 ${bounce ? 'animate-bounce' : ''}`} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 22a7 7 0 0 1-7-7c0-4.5 3-7.5 4-10 1.5 2 2 4 2 6.5C12 9 14 7 15 4c2 3.5 3 5 3 7a7 7 0 0 1-6 6.93V22z"/>
          </svg>
          <span className="text-xs font-bold text-orange-500">{data.streak_days}</span>
        </div>
      )}

      {/* Daily goal */}
      <div className="flex items-center gap-1 bg-card rounded-md px-1.5 py-0.5" title={`Daily: ${data.daily_xp}/${goal} XP`}>
        {data.daily_goal_met ? (
          <svg className="w-3 h-3 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
        ) : (
          <svg className="w-3 h-3 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/>
            <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/>
          </svg>
        )}
        <span className={`text-xs font-semibold ${data.daily_goal_met ? 'text-green-500' : 'text-muted'}`}>{dailyPct}%</span>
      </div>

      {/* Level + bar */}
      <div className="flex items-center gap-1">
        <span className="w-[18px] h-[18px] rounded-full bg-yellow-500/15 text-yellow-500 text-xs font-bold flex items-center justify-center shrink-0">
          {data.level}
        </span>
        <div className="w-12 h-1 bg-elevated rounded-full overflow-hidden">
          <div className="h-full bg-accent rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

// ── XP_AMOUNTS (mirrors backend) ─────────────────────────────────────────────
const XP_AMOUNTS: Record<string, number> = {
  watch_minute:   2,
  save_word:      5,
  review_word:    3,
  review_perfect: 5,
  pronunciation:  4,
  chat_message:   1,
  daily_login:   10,
  game_correct:   4,
  game_complete: 10,
  game_spelling:  5,
  game_scramble:  4,
  game_matching:  3,
};

/**
 * awardXP — call this everywhere XP should be given.
 *
 * Online  → POST /xp/add  → dispatch 'xp-updated'
 * Offline → enqueue in IndexedDB → dispatch 'xp-local' (optimistic UI)
 *           Synced automatically when useOffline detects reconnection.
 */
export async function awardXP(action: string, amount?: number): Promise<void> {
  const xp = amount ?? XP_AMOUNTS[action] ?? 1;

  if (typeof window !== 'undefined' && navigator.onLine) {
    try {
      await xpApi.addXP(action, xp);
      window.dispatchEvent(new Event('xp-updated'));
      return;
    } catch {
      // Network error despite onLine flag — fall through to offline path
    }
  }

  // Offline path: queue + optimistic update
  try {
    await enqueueXP(action, xp);
  } catch { /* IndexedDB unavailable — just do optimistic */ }

  // Fire optimistic UI event
  window.dispatchEvent(new CustomEvent<number>('xp-local', { detail: xp }));
}
