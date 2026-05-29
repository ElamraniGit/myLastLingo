/**
 * Progress & statistics — learning analytics dashboard.
 */

import React, { useEffect, useState } from 'react';
import { useStore } from '@/store/appStore';
import { useDictionary } from '@/hooks/useDictionary';
import { Button } from '@/components/ui/Button';
import type { ReviewSummary } from '@/types';

const LEVEL_COLORS: Record<string, string> = {
  A1: 'bg-green-500', A2: 'bg-emerald-500', B1: 'bg-blue-500',
  B2: 'bg-violet-500', C1: 'bg-orange-500', C2: 'bg-red-500',
};

export default function StatsView() {
  const { progress, recentVideos, user, setPage } = useStore();
  const { loadStats, loadReviewSummary } = useDictionary();
  const [summary, setSummary] = useState<ReviewSummary | null>(null);

  useEffect(() => {
    loadStats();
    loadReviewSummary().then(setSummary).catch(() => null);
  }, [loadStats, loadReviewSummary]);

  const stats = [
    { emoji: '📹', label: 'Videos', value: recentVideos.length, color: 'text-blue-400' },
    { emoji: '💾', label: 'Saved', value: progress?.total ?? 0, color: 'text-purple-400' },
    { emoji: '✅', label: 'Learned', value: progress?.learned ?? 0, color: 'text-green-400' },
    { emoji: '🔁', label: 'Reviews', value: progress?.total_reviews ?? 0, color: 'text-cyan-400' },
    { emoji: '📊', label: 'Today', value: progress?.reviewed_today ?? 0, color: 'text-yellow-400' },
    { emoji: '🔔', label: 'Due', value: summary?.due_now ?? progress?.due ?? 0, color: 'text-red-400' },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-heading">My Progress</h1>
        <p className="text-muted text-sm">Track your learning journey</p>
      </div>

      {/* Due banner */}
      {(summary?.due_now ?? 0) > 0 && (
        <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-heading">{summary!.due_now} cards due for review</p>
            <p className="text-xs text-body">Quick session strengthens retention</p>
          </div>
          <Button onClick={() => setPage('flashcards')} variant="primary" size="sm">Review</Button>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2.5">
        {stats.map(s => (
          <div key={s.label} className="bg-card/60 border border-line/40 rounded-2xl p-4 text-center">
            <span className="text-lg">{s.emoji}</span>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-muted mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Pipeline */}
      <div className="bg-card/60 border border-line/40 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-heading mb-4">Review Pipeline</h2>
        <div className="space-y-3">
          {[
            { label: 'Never reviewed', value: summary?.never_reviewed ?? 0, color: 'bg-purple-500' },
            { label: 'Learning', value: summary?.learning ?? 0, color: 'bg-yellow-500' },
            { label: 'Reviewing', value: summary?.reviewing ?? 0, color: 'bg-blue-500' },
            { label: 'Learned', value: summary?.learned ?? 0, color: 'bg-green-500' },
          ].map(r => {
            const total = (summary?.total_saved ?? 1) || 1;
            const pct = Math.round((r.value / total) * 100);
            return (
              <div key={r.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-body">{r.label}</span>
                  <span className="text-muted">{r.value} ({pct}%)</span>
                </div>
                <div className="h-2 bg-elevated rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-700 ${r.color}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Word levels */}
      {progress?.level_distribution && Object.keys(progress.level_distribution).length > 0 && (
        <div className="bg-card/60 border border-line/40 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-heading mb-4">Word Levels</h2>
          <div className="space-y-2">
            {Object.entries(progress.level_distribution).map(([level, count]) => {
              const total = Object.values(progress.level_distribution!).reduce((a, b) => a + Number(b), 0) || 1;
              const pct = Math.round((Number(count) / total) * 100);
              return (
                <div key={level} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-body w-6">{level}</span>
                  <div className="flex-1 h-2 bg-elevated rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${LEVEL_COLORS[level] ?? 'bg-slate-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-muted w-8 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Hardest words */}
      {(progress?.hardest_words?.length ?? 0) > 0 && (
        <div className="bg-card/60 border border-line/40 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-heading mb-3">Hardest Words</h2>
          <div className="space-y-2">
            {progress!.hardest_words!.map(w => (
              <div key={w.word} className="flex items-center justify-between text-sm">
                <span className="text-heading font-medium">{w.word}</span>
                <span className="text-xs text-red-400">{w.lapses} lapses · {w.reviewed_count} reviews</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent videos */}
      {recentVideos.length > 0 && (
        <div className="bg-card/60 border border-line/40 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-heading mb-3">Recent Videos</h2>
          <div className="space-y-2">
            {recentVideos.slice(0, 5).map(v => (
              <div key={v.id} className="flex items-center gap-3">
                {v.thumbnail_url ? (
                  <img src={v.thumbnail_url} alt="" className="w-12 h-8 rounded-lg object-cover bg-elevated" />
                ) : (
                  <div className="w-12 h-8 rounded-lg bg-elevated flex items-center justify-center text-xs">🎬</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-heading truncate">{v.title}</p>
                  <p className="text-xs text-muted">{v.channel}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="bg-blue-500/5 border border-blue-500/15 rounded-2xl p-4">
        <h3 className="text-xs font-semibold text-blue-400 mb-2">💡 Tips</h3>
        <ul className="space-y-1 text-xs text-body">
          <li>• Review cards daily for best retention</li>
          <li>• Try quiz mode to test yourself differently</li>
          <li>• Click any saved word to see full details</li>
        </ul>
      </div>
    </div>
  );
}
