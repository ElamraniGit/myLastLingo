/**
 * Progress & statistics view — richer review analytics.
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

const QUALITY_LABELS: Record<string, string> = {
  '0': 'Again',
  '1': 'Poor',
  '2': 'Hard',
  '3': 'Good',
  '4': 'Easy',
  '5': 'Perfect',
};

export default function StatsView() {
  const { progress, recentVideos, user, setPage } = useStore();
  const { loadStats, loadReviewSummary } = useDictionary();
  const [summary, setSummary] = useState<ReviewSummary | null>(null);

  useEffect(() => {
    loadStats();
    loadReviewSummary().then(setSummary).catch(() => setSummary(null));
  }, [loadStats, loadReviewSummary]);

  const cards = [
    { emoji: '📹', label: 'Videos watched', value: recentVideos.length, color: 'text-blue-400' },
    { emoji: '💾', label: 'Words saved', value: progress?.total ?? 0, color: 'text-purple-400' },
    { emoji: '🔁', label: 'Total reviews', value: progress?.total_reviews ?? 0, color: 'text-cyan-400' },
    { emoji: '✅', label: 'Words learned', value: progress?.learned ?? 0, color: 'text-green-400' },
    { emoji: '🔔', label: 'Due now', value: summary?.due_now ?? progress?.due ?? 0, color: 'text-yellow-400' },
    { emoji: '📅', label: 'Reviewed today', value: progress?.reviewed_today ?? 0, color: 'text-orange-400' },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">My Progress</h1>
        <p className="text-slate-400 text-sm mt-0.5">Track your review pipeline, consistency, and memory strength</p>
      </div>

      {(summary?.due_now ?? progress?.due ?? 0) > 0 && (
        <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-lg font-semibold text-white">You have {(summary?.due_now ?? progress?.due ?? 0)} due review cards</p>
            <p className="text-sm text-slate-400">A quick review session now will strengthen retention.</p>
          </div>
          <Button onClick={() => setPage('flashcards')} variant="primary">Open Review</Button>
        </div>
      )}

      {(user?.streak_days ?? 0) > 0 && (
        <div className="bg-gradient-to-r from-orange-500/15 to-red-500/15 border border-orange-500/25 rounded-2xl p-5 flex items-center gap-4">
          <span className="text-4xl">🔥</span>
          <div>
            <p className="text-2xl font-bold text-white">{user?.streak_days} day streak!</p>
            <p className="text-sm text-slate-400">Keep it up — consistency is the engine of memory.</p>
          </div>
        </div>
      )}

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6">
          <h2 className="text-base font-semibold text-slate-200 mb-4">Review Pipeline</h2>
          <div className="space-y-3">
            <PipelineRow label="Never reviewed" value={summary?.never_reviewed ?? progress?.never_reviewed ?? 0} color="bg-purple-500" />
            <PipelineRow label="Learning" value={summary?.learning ?? progress?.learning ?? 0} color="bg-yellow-500" />
            <PipelineRow label="Reviewing" value={summary?.reviewing ?? progress?.reviewing ?? 0} color="bg-blue-500" />
            <PipelineRow label="Learned" value={summary?.learned ?? progress?.learned ?? 0} color="bg-green-500" />
          </div>
          <div className="grid grid-cols-2 gap-3 mt-5">
            <MiniStat label="Average ease" value={progress?.avg_ease?.toFixed(2) ?? '—'} />
            <MiniStat label="Total lapses" value={progress?.total_lapses ?? 0} />
            <MiniStat label="Active days (30d)" value={progress?.active_days_30 ?? 0} />
            <MiniStat label="Due today" value={progress?.due ?? 0} />
          </div>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6">
          <h2 className="text-base font-semibold text-slate-200 mb-4">Answer Quality Breakdown</h2>
          {progress?.recent_quality_breakdown && Object.keys(progress.recent_quality_breakdown).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(progress.recent_quality_breakdown).map(([quality, count]) => {
                const total = Object.values(progress.recent_quality_breakdown || {}).reduce((a, b) => a + Number(b || 0), 0);
                const pct = total > 0 ? (Number(count) / total) * 100 : 0;
                return (
                  <div key={quality}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="text-slate-300 font-medium">{QUALITY_LABELS[quality] ?? quality}</span>
                      <span className="text-slate-500">{count}</span>
                    </div>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-blue-500 transition-all duration-700" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No review history yet.</p>
          )}
        </div>
      </div>

      {progress?.level_distribution && Object.keys(progress.level_distribution).length > 0 && (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6">
          <h2 className="text-base font-semibold text-slate-200 mb-4">Word Levels</h2>
          <div className="space-y-3">
            {Object.entries(progress.level_distribution).map(([level, count]) => {
              const total = Object.values(progress.level_distribution || {}).reduce((a, b) => a + Number(b || 0), 0);
              const pct = total > 0 ? (Number(count) / total) * 100 : 0;
              return (
                <div key={level}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="text-slate-300 font-semibold">{level}</span>
                    <span className="text-slate-500">{count} words ({pct.toFixed(0)}%)</span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-1000 ${LEVEL_COLORS[level] ?? 'bg-slate-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6">
          <h2 className="text-base font-semibold text-slate-200 mb-4">Hardest Words</h2>
          {progress?.hardest_words && progress.hardest_words.length > 0 ? (
            <div className="space-y-3">
              {progress.hardest_words.map((word) => (
                <div key={`${word.word}-${word.next_review || ''}`} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-200">{word.word}</p>
                    <p className="text-xs text-slate-500">{word.status} · {word.reviewed_count} reviews</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-red-400">{word.lapses} lapses</p>
                    <p className="text-xs text-slate-500">{fmtDate(word.next_review)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Hard words will appear here after some review sessions.</p>
          )}
        </div>

        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6">
          <h2 className="text-base font-semibold text-slate-200 mb-4">Upcoming Reviews (7 days)</h2>
          {progress?.upcoming_review_days && Object.keys(progress.upcoming_review_days).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(progress.upcoming_review_days).map(([day, count]) => (
                <div key={day} className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">{fmtDate(day)}</span>
                  <span className="text-slate-500">{count} card{Number(count) === 1 ? '' : 's'}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No upcoming review schedule yet.</p>
          )}
        </div>
      </div>

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

      <div className="bg-blue-500/8 border border-blue-500/20 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-blue-400 mb-3">💡 Review Tips</h2>
        <ul className="space-y-2 text-sm text-slate-400">
          <li>• Use quiz mode to test recognition before rating yourself.</li>
          <li>• If a word feels shaky, choose Again or Hard — the schedule will adapt.</li>
          <li>• Watch the “Hardest Words” panel to spot words you keep forgetting.</li>
          <li>• Short daily sessions are better than rare long sessions.</li>
        </ul>
      </div>
    </div>
  );
}

function PipelineRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
        <span className="text-sm text-slate-300">{label}</span>
      </div>
      <span className="text-sm text-slate-500">{value}</span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-slate-900/50 rounded-xl px-3 py-3">
      <p className="text-lg font-bold text-slate-100">{value}</p>
      <p className="text-xs text-slate-500 mt-1">{label}</p>
    </div>
  );
}

function fmtDate(value?: string) {
  if (!value) return '—';
  const date = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
