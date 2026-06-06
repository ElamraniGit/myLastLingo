/**
 * XP Bar — Apple-style compact header widget.
 * Shows: streak 🔥 · daily goal 🎯 · level · XP bar
 * Streak number pulses/bounces when newly achieved.
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { xpApi } from '@/lib/api';

interface XPData {
  total_xp: number; level: number; streak_days: number;
  daily_xp: number; next_level_xp: number; progress: number;
  daily_goal?: number; daily_goal_met?: boolean;
}

export default function XPBar() {
  const [data, setData] = useState<XPData | null>(null);
  const prevStreak = useRef<number>(0);
  const [streakBounce, setStreakBounce] = useState(false);

  const refresh = useCallback(() => {
    xpApi.getStatus().then(d => {
      setData(prev => {
        // Animate if streak increased
        if (prev && d.streak_days > prev.streak_days) {
          setStreakBounce(true);
          setTimeout(() => setStreakBounce(false), 800);
        }
        return d;
      });
    }).catch(() => {});
  }, []);

  useEffect(() => { refresh(); const iv = setInterval(refresh, 30000); return () => clearInterval(iv); }, [refresh]);
  useEffect(() => { const h = () => refresh(); window.addEventListener('xp-updated', h); return () => window.removeEventListener('xp-updated', h); }, [refresh]);

  if (!data) return null;
  const pct = Math.min(data.progress, 100);
  const goal = data.daily_goal ?? 50;
  const dailyPct = Math.min(Math.round((data.daily_xp / Math.max(goal, 1)) * 100), 100);

  return (
    <div className="flex items-center gap-2.5">
      {/* Streak — pulses if newly incremented */}
      {data.streak_days > 0 && (
        <div className={`flex items-center gap-1 bg-orange-500/10 rounded-lg px-2 py-1 transition-all ${streakBounce ? 'scale-125' : 'scale-100'}`}>
          <span className={`text-orange-500 ${streakBounce ? 'animate-bounce' : ''} flex items-center`}><svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 22a7 7 0 0 1-7-7c0-4.5 3-7.5 4-10 1.5 2 2 4 2 6.5C12 9 14 7 15 4c2 3.5 3 5 3 7a7 7 0 0 1-6 6.93V22z" fill="currentColor" stroke="none"/></svg></span>
          <span className="text-xs font-semibold text-orange-500">{data.streak_days}</span>
        </div>
      )}

      {/* Daily goal (Phase 5): small progress pill toward today's XP goal */}
      <div
        className="flex items-center gap-1 bg-green-500/10 rounded-lg px-2 py-1"
        title={`Daily goal: ${data.daily_xp}/${goal} XP`}
        aria-label={`Daily goal ${data.daily_xp} of ${goal} XP`}
      >
        <span className="flex items-center text-xs">{data.daily_goal_met ? <svg className="w-3.5 h-3.5 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg> : <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/></svg>}</span>
        <span className={`text-[11px] font-semibold ${data.daily_goal_met ? 'text-green-500' : 'text-muted'}`}>
          {dailyPct}%
        </span>
      </div>

      {/* Level + bar */}
      <div className="flex items-center gap-1.5">
        <div className="w-5 h-5 rounded-full bg-yellow-500/15 text-yellow-500 text-[10px] font-bold flex items-center justify-center">
          {data.level}
        </div>
        <div className="w-14 h-1 bg-elevated rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[11px] font-medium text-muted">{data.total_xp}</span>
      </div>
    </div>
  );
}

export async function awardXP(action: string, amount?: number) {
  try {
    await xpApi.addXP(action, amount);
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('xp-updated'));
  } catch {}
}
