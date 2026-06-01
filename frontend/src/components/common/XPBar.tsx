/**
 * XP Bar — shows level, XP progress, streak, and daily XP in the header.
 * Compact design for mobile top bar.
 *
 * FIX BUG-16: Simplified pct calculation (removed redundant /100 * 100).
 */

import React, { useEffect, useState, useCallback } from 'react';
import { xpApi } from '@/lib/api';

interface XPData {
  total_xp: number;
  level: number;
  streak_days: number;
  daily_xp: number;
  next_level_xp: number;
  progress: number;  // 0–99 XP within current level
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

  // FIX BUG-16: progress is already 0–99, so percentage = progress directly.
  // (data.progress / 100) * 100 simplifies to just data.progress.
  const pct = Math.min(data.progress, 100);

  return (
    <div className="flex items-center gap-2 text-xs">
      {/* Streak */}
      {data.streak_days > 0 && (
        <div className="flex items-center gap-0.5 text-orange-400 font-medium">
          <span>🔥</span>
          <span>{data.streak_days}</span>
        </div>
      )}

      {/* Level + XP bar */}
      <div className="flex items-center gap-1.5">
        <div className="w-5 h-5 rounded-full bg-yellow-500/20 text-yellow-400 text-[10px] font-bold flex items-center justify-center">
          {data.level}
        </div>

        {/* Progress bar */}
        <div className="w-16 h-1.5 bg-elevated rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>

        <span className="text-muted font-medium">{data.total_xp}</span>
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
