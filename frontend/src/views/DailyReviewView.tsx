/**
 * Daily / Weekly / Monthly review plan.
 *
 * Surfaces a balanced "what should I do today?" plan from /review/daily,
 * plus week-at-a-glance and month-at-a-glance summaries built from data
 * already returned by /review/dashboard.
 *
 * One-tap CTA jumps into the smart review session.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '@/store/appStore';
import { reviewApi } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import ActivityHeatmap from '@/components/review/ActivityHeatmap';
import type { ReviewDashboard, ReviewSummary, SavedWord } from '@/types';

interface DailyPlan {
  summary: ReviewSummary;
  due_count: number;
  recommended: SavedWord[];
  leeches: SavedWord[];
  estimated_minutes: number;
}

export default function DailyReviewView() {
  const setPage = useStore((s) => s.setPage);
  const activePage = useStore((s) => s.currentPage);

  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [dashboard, setDashboard] = useState<ReviewDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'today' | 'week' | 'month' | 'year'>('today');

  useEffect(() => {
    if (activePage !== 'daily') return;
    setLoading(true);
    Promise.all([
      reviewApi.daily().catch(() => null),
      reviewApi.dashboard().catch(() => null),
    ])
      .then(([p, d]) => {
        setPlan(p);
        setDashboard(d);
      })
      .finally(() => setLoading(false));
  }, [activePage]);

  const week = useMemo(() => buildWeekSummary(dashboard), [dashboard]);
  const month = useMemo(() => buildMonthSummary(dashboard, plan), [dashboard, plan]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-[3px] border-line border-t-blue-500 rounded-full animate-spin mb-5" />
        <p className="text-sm text-body">جارٍ تجهيز خطة المراجعة…</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-heading">خطة المراجعة</h1>
        <div className="flex gap-1 bg-card/50 rounded-xl p-1">
          {(['today', 'week', 'month', 'year'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                tab === t
                  ? 'bg-elevated text-heading'
                  : 'text-muted hover:text-body'
              }`}
            >
              {t === 'today' ? 'اليوم' : t === 'week' ? 'الأسبوع' : t === 'month' ? 'الشهر' : 'السنة'}
            </button>
          ))}
        </div>
      </header>

      {tab === 'today' && <TodayTab plan={plan} onStart={() => setPage('flashcards')} />}
      {tab === 'week' && <WeekTab data={week} />}
      {tab === 'month' && <MonthTab data={month} />}
      {tab === 'year' && <ActivityHeatmap days={365} />}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
 *  Today
 * ───────────────────────────────────────────────────────────────── */

function TodayTab({ plan, onStart }: { plan: DailyPlan | null; onStart: () => void }) {
  if (!plan) {
    return (
      <div className="bg-card/40 border border-line/40 rounded-2xl p-8 text-center space-y-3">
        <div className="text-5xl">🌅</div>
        <p className="text-body">لا توجد بيانات بعد. ابدأ بحفظ كلمات من الفيديو أو القارئ.</p>
      </div>
    );
  }

  const due = plan.due_count;
  const leech = plan.leeches?.length || 0;

  return (
    <div className="space-y-4">
      {/* Hero CTA */}
      <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-3xl p-6 text-center space-y-3">
        <div className="text-5xl">{due > 0 ? '🎯' : '✨'}</div>
        <h2 className="text-lg font-bold text-heading">
          {due > 0
            ? `لديك ${due} كلمة جاهزة للمراجعة`
            : 'لا توجد كلمات مستحقة الآن'}
        </h2>
        {due > 0 && (
          <p className="text-sm text-body">⏱️ ~{plan.estimated_minutes} دقيقة</p>
        )}
        <Button onClick={onStart} variant="primary" className="w-full">
          {due > 0 ? '🚀 ابدأ المراجعة' : '💪 جلسة ممارسة'}
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2.5">
        <SummaryCard label="جديدة" value={plan.summary.never_reviewed} icon="✨" tone="blue" />
        <SummaryCard label="قيد التعلم" value={plan.summary.learning} icon="🌱" tone="orange" />
        <SummaryCard label="قيد المراجعة" value={plan.summary.reviewing} icon="📚" tone="blue" />
        <SummaryCard label="متقنة" value={plan.summary.learned} icon="🏆" tone="green" />
      </div>

      {/* Leech alert */}
      {leech > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔥</span>
            <p className="text-sm font-bold text-red-200">
              {leech} كلمة صعبة (Leech)
            </p>
          </div>
          <p className="text-xs text-red-300/80">
            هذه الكلمات أخفقت معها أكثر من 6 مرات. ركّز عليها في جلسة ممارسة.
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {plan.leeches.slice(0, 8).map((w) => (
              <span
                key={w.id}
                className="px-2 py-0.5 rounded-md bg-red-500/15 text-red-200 text-xs font-medium"
              >
                {w.word}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recommended preview */}
      {plan.recommended?.length > 0 && (
        <div className="bg-card/50 border border-line/40 rounded-2xl p-4 space-y-3">
          <h3 className="text-xs font-semibold text-heading uppercase tracking-wider">
            الكلمات المقترحة اليوم
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {plan.recommended.slice(0, 12).map((w) => (
              <span
                key={w.id}
                className="px-2 py-1 rounded-md bg-elevated text-body text-xs"
              >
                {w.word}
              </span>
            ))}
            {plan.recommended.length > 12 && (
              <span className="text-xs text-muted self-center">
                +{plan.recommended.length - 12} أخرى
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
 *  Week  (last 7 days)
 * ───────────────────────────────────────────────────────────────── */

interface WeekData {
  reviewsTotal: number;
  newWordsTotal: number;
  perDay: Array<{ date: string; reviews: number; newWords: number; label: string }>;
  retentionPct: number;
  avgMastery: number;
}

function buildWeekSummary(d: ReviewDashboard | null): WeekData | null {
  if (!d) return null;
  const days: string[] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const dt = new Date(today);
    dt.setDate(today.getDate() - i);
    days.push(dt.toISOString().slice(0, 10));
  }
  const perDay = days.map((day) => ({
    date: day,
    reviews: d.stats.reviews_per_day_7d?.[day] || 0,
    newWords: d.stats.new_per_day_7d?.[day] || 0,
    label: new Date(day).toLocaleDateString('ar', { weekday: 'short' }),
  }));
  return {
    reviewsTotal: perDay.reduce((a, x) => a + x.reviews, 0),
    newWordsTotal: perDay.reduce((a, x) => a + x.newWords, 0),
    perDay,
    retentionPct: Math.round((d.retention_rate?.flashcard_recall || 0) * 100),
    avgMastery: Math.round(d.stats.avg_mastery || 0),
  };
}

function WeekTab({ data }: { data: WeekData | null }) {
  if (!data) return <EmptyTab label="لا توجد بيانات للأسبوع." />;
  const maxBar = Math.max(1, ...data.perDay.map((d) => d.reviews + d.newWords));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5">
        <SummaryCard label="مراجعات" value={data.reviewsTotal} icon="🔁" tone="blue" />
        <SummaryCard label="كلمات جديدة" value={data.newWordsTotal} icon="✨" tone="green" />
        <SummaryCard label="الاحتفاظ" value={`${data.retentionPct}%`} icon="🧠" tone="green" />
        <SummaryCard label="معدل الإتقان" value={`${data.avgMastery}/100`} icon="🎯" />
      </div>

      <div className="bg-card/50 border border-line/40 rounded-2xl p-4">
        <h3 className="text-xs font-semibold text-heading mb-3">آخر 7 أيام</h3>
        <div className="flex items-end gap-2 h-32">
          {data.perDay.map((d, i) => {
            const total = d.reviews + d.newWords;
            const h = (total / maxBar) * 100;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="text-[9px] text-muted tabular-nums">
                  {total > 0 ? total : ''}
                </div>
                <div
                  className="w-full rounded-t bg-gradient-to-t from-blue-600/80 to-purple-500/80 min-h-[3px] transition-all"
                  style={{ height: `${h}%` }}
                  title={`${d.date}: ${d.reviews} مراجعة، ${d.newWords} جديدة`}
                />
                <div className="text-[10px] text-muted">{d.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
 *  Month  (current month + forecast)
 * ───────────────────────────────────────────────────────────────── */

interface MonthData {
  totalWords: number;
  mastered: number;
  learning: number;
  familiar: number;
  leeches: number;
  upcoming: Array<{ date: string; n: number; label: string }>;
  upcomingTotal: number;
}

function buildMonthSummary(d: ReviewDashboard | null, p: DailyPlan | null): MonthData | null {
  if (!d) return null;
  const today = new Date();
  const upcoming: MonthData['upcoming'] = [];
  for (let i = 0; i < 30; i++) {
    const dt = new Date(today);
    dt.setDate(today.getDate() + i);
    const key = dt.toISOString().slice(0, 10);
    upcoming.push({
      date: key,
      n: d.forecast?.per_day?.[key] || 0,
      label: dt.toLocaleDateString('ar', { day: 'numeric' }),
    });
  }
  return {
    totalWords: d.stats.total,
    mastered: d.stats.mastered,
    familiar: d.stats.familiar,
    learning: d.stats.learning + d.stats.new_count,
    leeches: d.stats.leeches,
    upcoming,
    upcomingTotal: upcoming.reduce((a, x) => a + x.n, 0),
  };
}

function MonthTab({ data }: { data: MonthData | null }) {
  if (!data) return <EmptyTab label="لا توجد بيانات للشهر." />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5">
        <SummaryCard label="إجمالي الكلمات" value={data.totalWords} icon="📦" />
        <SummaryCard label="مراجعات قادمة (30 ي)" value={data.upcomingTotal} icon="📅" tone="blue" />
        <SummaryCard label="متقنة" value={data.mastered} icon="🏆" tone="green" />
        <SummaryCard label="صعبة" value={data.leeches} icon="🔥" tone="red" />
      </div>

      <PipelineBar
        mastered={data.mastered}
        familiar={data.familiar}
        learning={data.learning}
      />

      <ForecastHeatmap upcoming={data.upcoming} />
    </div>
  );
}

function PipelineBar({
  mastered,
  familiar,
  learning,
}: {
  mastered: number;
  familiar: number;
  learning: number;
}) {
  const total = Math.max(1, mastered + familiar + learning);
  const pct = (n: number) => (n / total) * 100;
  return (
    <div className="bg-card/50 border border-line/40 rounded-2xl p-4 space-y-2">
      <h3 className="text-xs font-semibold text-heading">رحلة الكلمات</h3>
      <div className="h-3 bg-elevated rounded-full overflow-hidden flex">
        {learning > 0 && (
          <div
            className="bg-orange-500"
            style={{ width: `${pct(learning)}%` }}
            title={`قيد التعلم: ${learning}`}
          />
        )}
        {familiar > 0 && (
          <div
            className="bg-blue-500"
            style={{ width: `${pct(familiar)}%` }}
            title={`مألوفة: ${familiar}`}
          />
        )}
        {mastered > 0 && (
          <div
            className="bg-green-500"
            style={{ width: `${pct(mastered)}%` }}
            title={`متقنة: ${mastered}`}
          />
        )}
      </div>
      <div className="flex justify-between text-[10px] text-muted">
        <span>🌱 {learning}</span>
        <span>📚 {familiar}</span>
        <span>🏆 {mastered}</span>
      </div>
    </div>
  );
}

function ForecastHeatmap({
  upcoming,
}: {
  upcoming: Array<{ date: string; n: number; label: string }>;
}) {
  const max = Math.max(1, ...upcoming.map((u) => u.n));
  return (
    <div className="bg-card/50 border border-line/40 rounded-2xl p-4">
      <h3 className="text-xs font-semibold text-heading mb-3">المراجعات القادمة (30 يوم)</h3>
      <div className="grid grid-cols-10 gap-1">
        {upcoming.map((u, i) => {
          const intensity = u.n / max;
          const bg =
            u.n === 0
              ? 'bg-elevated'
              : intensity < 0.33
              ? 'bg-green-500/30'
              : intensity < 0.66
              ? 'bg-green-500/60'
              : 'bg-green-500';
          return (
            <div
              key={i}
              className={`aspect-square rounded-sm flex items-center justify-center text-[8px] text-heading/70 ${bg}`}
              title={`${u.date}: ${u.n} مراجعة`}
            >
              {u.n > 0 ? u.n : ''}
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-muted mt-2 text-center">
        من اليوم إلى 30 يوماً قادمة — كل خانة = يوم
      </p>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
 *  Atoms
 * ───────────────────────────────────────────────────────────────── */

function SummaryCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number | string;
  icon: string;
  tone?: 'green' | 'blue' | 'red' | 'orange';
}) {
  const colors = {
    green: 'text-green-400',
    blue: 'text-blue-400',
    red: 'text-red-400',
    orange: 'text-orange-400',
  } as const;
  return (
    <div className="bg-card/60 border border-line/40 rounded-2xl p-3 text-center">
      <div className={`text-xl ${tone ? colors[tone] : ''}`}>{icon}</div>
      <p className="text-lg font-bold text-heading mt-0.5">{value}</p>
      <p className="text-[11px] text-muted leading-tight">{label}</p>
    </div>
  );
}

function EmptyTab({ label }: { label: string }) {
  return (
    <div className="bg-card/40 border border-line/40 rounded-2xl p-8 text-center text-sm text-muted">
      {label}
    </div>
  );
}
