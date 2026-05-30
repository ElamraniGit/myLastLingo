/**
 * XP Bar — shows level, XP progress, streak, and daily XP in the header.
 * Compact design for mobile top bar.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { xpApi } from '@/lib/api';

interface XPData {
  total_xp: number;
  level: number;
  streak_days: number;
  daily_xp: number;
  next_level_xp: number;
  progress: number;
}

export default function XPBar() {
  const [data, setData] = useState<XPData | null>(null);

  const refresh = useCallback(() => {
    xpApi.getStatus().then(setData).catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    // Refresh every 30 seconds
    const iv = setInterval(refresh, 30000);
    return () => clearInterval(iv);
  }, [refresh]);

  // Listen for custom XP events
  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener('xp-updated', handler);
    return () => window.removeEventListener('xp-updated', handler);
  }, [refresh]);

  if (!data) return null;

  const pct = data.next_level_xp > 0 ? Math.min((data.progress / 100) * 100, 100) : 0;

  return (
    <div className="flex items-center gap-2">
      {/* Streak */}
      {data.streak_days > 0 && (
        <div className="flex items-center gap-0.5 text-orange-400" title={`${data.streak_days} day streak`}>
          <span className="text-xs">🔥</span>
          <span className="text-[10px] font-bold">{data.streak_days}</span>
        </div>
      )}

      {/* Level + XP bar */}
      <div className="flex items-center gap-1.5">
        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-sm">
          <span className="text-[9px] font-black text-white">{data.level}</span>
        </div>
        <div className="w-16 h-1.5 bg-elevated rounded-full overflow-hidden" title={`${data.progress}/100 XP to next level`}>
          <div
            className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[10px] text-muted font-medium tabular-nums">{data.total_xp}</span>
      </div>
    </div>
  );
}

/**
 * Helper to award XP from anywhere in the app.
 * Usage: import { awardXP } from '@/components/common/XPBar';
 *        awardXP('save_word');
 */
export async function awardXP(action: string, amount?: number) {
  try {
    await xpApi.addXP(action, amount);
    // Dispatch event so XPBar refreshes
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('xp-updated'));
    }
  } catch {
    // Silently fail — XP is non-critical
  }
}
