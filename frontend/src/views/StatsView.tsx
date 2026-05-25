/**
 * Progress & statistics view.
 */

import React, { useEffect } from 'react';
import { useStore } from '@/store/appStore';
import { useDictionary } from '@/hooks/useDictionary';

const LEVEL_COLORS: Record<string, string> = {
  A1: 'bg-green-500', A2: 'bg-emerald-500', B1: 'bg-blue-500',
  B2: 'bg-violet-500', C1: 'bg-orange-500', C2: 'bg-red-500',
};

export default function StatsView() {
  const { progress, recentVideos, user } = useStore();
  const { loadStats } = useDictionary();

  useEffect(() => { loadStats(); }, []); // eslint-disable-line

  const cards = [
    { emoji: '📹', label: 'Videos watched', value: recentVideos.length, color: 'text-blue-400' },
    { emoji: '💾', label: 'Words saved', value: progress?.total ?? 0, color: 'text-purple-400' },
    { emoji: '✅', label: 'Words learned', value: progress?.learned ?? 0, color: 'text-green-400' },
    { emoji: '🔔', label: 'Due for review', value: progress?.due ?? 0, color: 'text-yellow-400' },
    { emoji: '📅', label: 'Reviewed today', value: progress?.reviewed_today ?? 0, color: 'text-cyan-400' },
    { emoji: '🗓', label: 'Active days (30d)', value: progress?.active_days_30 ?? 0, color: 'text-orange-400' },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">My Progress</h1>
        <p className="text-slate-400 text-sm mt-0.5">Track your English learning journey</p>
      </div>

      {/* Streak */}
      {(user?.streak_days ?? 0) > 0 && (
        <div className="bg-gradient-to-r from-orange-500/15 to-red-500/15 border border-orange-500/25 rounded-2xl p-5 flex items-center gap-4">
          <span className="text-4xl">🔥</span>
          <div>
            <p className="text-2xl font-bold text-white">{user?.streak_days} day streak!</p>
            <p className="text-sm text-slate-400">Keep it up — consistency is key</p>
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5 hover:border-slate-600 transition-colors">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{c.emoji}</span>
            </div>
            <p className={`text-3xl font-bold ${c.color}`}>{c.value}</p>
            <p className="text-xs text-slate-500 mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Level distribution */}
      {progress?.level_distribution && Object.keys(progress.level_distribution).length > 0 && (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6">
          <h2 className="text-base font-semibold text-slate-200 mb-4">Word Levels</h2>
          <div className="space-y-3">
            {Object.entries(progress.level_distribution).map(([level, count]) => {
              const total = Object.values(progress.level_distribution!).reduce((a, b) => a + b, 0);
              const pct = total > 0 ? (count / total) * 100 : 0;
              return (
                <div key={level}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="text-slate-300 font-semibold">{level}</span>
                    <span className="text-slate-500">{count} words ({pct.toFixed(0)}%)</span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${LEVEL_COLORS[level] ?? 'bg-slate-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent videos */}
      {recentVideos.length > 0 && (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6">
          <h2 className="text-base font-semibold text-slate-200 mb-4">Recent Videos</h2>
          <div className="space-y-3">
            {recentVideos.slice(0, 5).map((v) => (
              <div key={v.id} className="flex items-center gap-3">
                {v.thumbnail_url ? (
                  <img src={v.thumbnail_url} alt="" className="w-14 h-9 rounded-lg object-cover bg-slate-700 flex-shrink-0" />
                ) : (
                  <div className="w-14 h-9 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0">
                    <span className="text-slate-500 text-sm">🎬</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 line-clamp-1">{v.title}</p>
                  <p className="text-xs text-slate-500">{v.channel}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="bg-blue-500/8 border border-blue-500/20 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-blue-400 mb-3">💡 Learning Tips</h2>
        <ul className="space-y-2 text-sm text-slate-400">
          <li>• Review flashcards daily for best retention</li>
          <li>• Click words in videos to save them instantly</li>
          <li>• Use the loop feature to repeat difficult sentences</li>
          <li>• Slow down playback speed (0.75×) for complex content</li>
        </ul>
      </div>
    </div>
  );
}
