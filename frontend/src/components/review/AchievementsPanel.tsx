/**
 * AchievementsPanel — visual catalogue of all achievements + their unlock
 * state for the current user.
 *
 * Pure presentation; fetches the catalogue from /api/v1/xp/achievements
 * on mount. Locked items are grayed-out and progress is shown as a
 * percentage in the header.
 */

import React, { useEffect, useState } from 'react';
import { xpApi } from '@/lib/api';
import type { Achievement, AchievementsResponse, AchievementTier } from '@/types';

const TIER_COLOR: Record<AchievementTier, string> = {
  bronze: 'from-amber-700/40 to-amber-900/40 border-amber-700/40',
  silver: 'from-slate-400/40 to-slate-600/40 border-slate-400/40',
  gold: 'from-yellow-500/40 to-yellow-700/40 border-yellow-500/40',
  legendary: 'from-purple-500/40 to-fuchsia-700/40 border-purple-500/40',
};

const TIER_LABEL: Record<AchievementTier, string> = {
  bronze: 'برونزي',
  silver: 'فضي',
  gold: 'ذهبي',
  legendary: 'أسطوري',
};

export default function AchievementsPanel({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<AchievementsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'locked'>('all');

  useEffect(() => {
    let cancelled = false;
    xpApi
      .getAchievements()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="bg-card/40 border border-line/40 rounded-2xl p-6 text-center text-sm text-muted">
        جارٍ تحميل الإنجازات…
      </div>
    );
  }
  if (!data) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-sm text-red-300">
        تعذّر تحميل الإنجازات.
      </div>
    );
  }

  const items =
    filter === 'all'
      ? data.achievements
      : data.achievements.filter((a) => (filter === 'unlocked' ? a.unlocked : !a.unlocked));

  const pct = data.total_count > 0 ? (data.unlocked_count / data.total_count) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Header w/ progress */}
      <div className="bg-card/50 border border-line/40 rounded-2xl p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-heading">🏆 الإنجازات</h3>
          <span className="text-xs text-muted tabular-nums">
            {data.unlocked_count} / {data.total_count}
          </span>
        </div>
        <div className="h-2 bg-elevated rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Filter chips */}
      {!compact && (
        <div className="flex gap-1.5">
          {(['all', 'unlocked', 'locked'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all ${
                filter === f
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                  : 'bg-card text-muted border border-transparent hover:text-body'
              }`}
            >
              {f === 'all' ? 'الكل' : f === 'unlocked' ? '✓ مفتوحة' : '🔒 مقفلة'}
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      <div className={`grid gap-2 ${compact ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-3'}`}>
        {items.map((a) => (
          <AchievementCard key={a.id} a={a} compact={compact} />
        ))}
      </div>
    </div>
  );
}

function AchievementCard({ a, compact }: { a: Achievement; compact?: boolean }) {
  const gradient = TIER_COLOR[a.tier];
  return (
    <div
      className={`relative rounded-2xl border bg-gradient-to-br p-3 text-center transition-all ${
        a.unlocked
          ? gradient
          : 'bg-card/30 border-line/30 grayscale opacity-50'
      }`}
      title={a.description}
    >
      <div className={`text-3xl mb-1 ${!a.unlocked ? 'filter blur-[1px]' : ''}`}>
        {a.unlocked ? a.icon : '🔒'}
      </div>
      <p
        className={`text-xs font-bold leading-tight ${
          a.unlocked ? 'text-heading' : 'text-muted'
        }`}
      >
        {a.title}
      </p>
      {!compact && (
        <>
          <p className="text-[10px] text-muted mt-1 leading-tight line-clamp-2 h-[26px]">
            {a.description}
          </p>
          <div className="flex items-center justify-between mt-2 text-[10px]">
            <span
              className={`px-1.5 py-0.5 rounded ${
                a.unlocked ? 'bg-card/50 text-body' : 'text-muted'
              }`}
            >
              {TIER_LABEL[a.tier]}
            </span>
            <span className="text-amber-400 font-bold">+{a.xp_reward}xp</span>
          </div>
        </>
      )}
    </div>
  );
}
