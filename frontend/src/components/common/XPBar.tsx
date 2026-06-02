/**
 * XP Bar — Apple-style compact header widget.
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
  const refresh = useCallback(() => { xpApi.getStatus().then(setData).catch(() => {}); }, []);

  useEffect(() => { refresh(); const iv = setInterval(refresh, 30000); return () => clearInterval(iv); }, [refresh]);
  useEffect(() => { const h = () => refresh(); window.addEventListener('xp-updated', h); return () => window.removeEventListener('xp-updated', h); }, [refresh]);

  if (!data) return null;
  const pct = Math.min(data.progress, 100);
  const goal = data.daily_goal ?? 50;
  const dailyPct = Math.min(Math.round((data.daily_xp / Math.max(goal, 1)) * 100), 100);

  return (
    <div className="flex items-center gap-2.5">
      {/* Streak */}
      {data.streak_days > 0 && (
        <div className="flex items-center gap-1 bg-orange-500/10 rounded-lg px-2 py-1">
          <span className="text-xs">🔥</span>
          <span className="text-xs font-semibold text-orange-500">{data.streak_days}</span>
        </div>
      )}

      {/* Daily goal (Phase 5): small progress pill toward today's XP goal */}
      <div
        className="flex items-center gap-1 bg-green-500/10 rounded-lg px-2 py-1"
        title={`Daily goal: ${data.daily_xp}/${goal} XP`}
        aria-label={`Daily goal ${data.daily_xp} of ${goal} XP`}
      >
        <span className="text-xs">{data.daily_goal_met ? '✅' : '🎯'}</span>
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
