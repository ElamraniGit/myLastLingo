/**
 * XPBar — compact header widget: streak · daily goal · level bar
 */
import React, { useEffect, useState, useCallback } from 'react';
import { xpApi } from '@/lib/api';

interface XPData {
  total_xp: number; level: number; streak_days: number;
  daily_xp: number; next_level_xp: number; progress: number;
  daily_goal?: number; daily_goal_met?: boolean;
}

export default function XPBar() {
  const [data, setData] = useState<XPData | null>(null);
  const [bounce, setBounce] = useState(false);

  const refresh = useCallback(() => {
    xpApi.getStatus().then(d => {
      setData(prev => {
        if (prev && d.streak_days > prev.streak_days) {
          setBounce(true); setTimeout(() => setBounce(false), 700);
        }
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
      <div
        className="flex items-center gap-1 bg-card rounded-md px-1.5 py-0.5"
        title={`Daily goal: ${data.daily_xp}/${goal} XP`}
      >
        {data.daily_goal_met ? (
          <svg className="w-3 h-3 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
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
        <span className="w-4.5 h-4.5 rounded-full bg-yellow-500/15 text-yellow-500 text-xs font-bold flex items-center justify-center">
          {data.level}
        </span>
        <div className="w-12 h-1 bg-elevated rounded-full overflow-hidden">
          <div className="h-full bg-accent rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

export async function awardXP(action: string, amount?: number) {
  try {
    await xpApi.addXP(action, amount);
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('xp-updated'));
  } catch { /* noop */ }
}
