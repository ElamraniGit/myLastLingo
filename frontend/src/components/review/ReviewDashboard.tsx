/**
 * ReviewDashboard — visual analytics for the Smart Review System.
 *
 * Sections:
 *   • Top KPIs (mastered / familiar / learning / new / leeches / avg mastery)
 *   • Retention rate (quiz accuracy + flashcard recall, last 30 days)
 *   • 7-day progress sparkline (new words + reviews per day)
 *   • Upcoming review forecast (next 14 days)
 *   • Top error types + top missed words
 *
 * The component is self-contained: it fetches /review/dashboard on mount
 * via useReview and renders everything inline (no external charting lib
 * — uses pure SVG sparklines so it works inside the workspace preview).
 */

import React, { useEffect, useMemo } from 'react';
import { useReview } from '@/hooks/useReview';

const ERROR_LABELS: Record<string, string> = {
  semantic_confusion: 'تشابه دلالي',
  opposite_meaning: 'معنى معاكس',
  surface_similarity: 'تشابه في الشكل',
  context_mismatch: 'لا يناسب السياق',
  unknown_word: 'كلمة غير معروفة',
  slow_recall: 'استرجاع بطيء',
  timeout: 'انتهى الوقت',
};

export default function ReviewDashboard({ compact = false }: { compact?: boolean }) {
  const { dashboard, loadDashboard } = useReview();

  // ── All Hooks MUST be called unconditionally on every render ──────────
  // (React rule: hook order must be stable across renders.)
  useEffect(() => {
    loadDashboard().catch(() => null);
  }, [loadDashboard]);

  const days7 = useMemo(() => lastNDates(7), []);
  const days14 = useMemo(() => lastNDates(14, +1 /* future */), []);

  // ── Early return AFTER hooks ──────────────────────────────────────────
  if (!dashboard) {
    return (
      <div className="bg-card/40 border border-line/40 rounded-2xl p-6 text-center text-sm text-muted">
        جارٍ تحميل الإحصائيات…
      </div>
    );
  }

  const { stats, errors, forecast, retention_rate } = dashboard;

  const retention = Math.round((retention_rate?.flashcard_recall || 0) * 100);
  const accuracy = Math.round((retention_rate?.quiz_accuracy || 0) * 100);
  const avgMastery = Math.round(stats?.avg_mastery || 0);
  const avgResponseSec = ((stats?.avg_response_ms || 0) / 1000).toFixed(1);

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Kpi label="متقنة" value={stats.mastered} icon="🏆" tone="green" />
        <Kpi label="مألوفة" value={stats.familiar} icon="📚" tone="blue" />
        <Kpi label="قيد التعلم" value={stats.learning} icon="🌱" tone="orange" />
        <Kpi label="صعبة" value={stats.leeches} icon="🔥" tone="red" />
      </div>

      {!compact && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <Kpi label="معدل الإتقان" value={`${avgMastery}/100`} icon="🎯" />
          <Kpi label="الاحتفاظ" value={`${retention}%`} icon="🧠" tone="green" />
          <Kpi label="دقة الاختبار" value={`${accuracy}%`} icon="✅" tone="blue" />
          <Kpi label="متوسط الإجابة" value={`${avgResponseSec}ث`} icon="⏱️" />
          <Kpi label="الإجمالي" value={stats.total} icon="📦" />
          <Kpi label="جديدة" value={stats.new_count} icon="✨" />
        </div>
      )}

      {/* Last 7 days */}
      <Section title="آخر 7 أيام">
        <Sparkline
          days={days7}
          series={[
            { name: 'كلمات جديدة', color: '#3b82f6', data: days7.map((d) => stats.new_per_day_7d?.[d] || 0) },
            { name: 'مراجعات', color: '#a78bfa', data: days7.map((d) => stats.reviews_per_day_7d?.[d] || 0) },
          ]}
        />
      </Section>

      {/* Forecast */}
      <Section title="مراجعات قادمة (14 يوم)">
        <ForecastBars days={days14} values={days14.map((d) => forecast?.per_day?.[d] || 0)} />
      </Section>

      {/* Errors */}
      {(errors?.by_type?.length ?? 0) > 0 && (
        <Section title="تحليل الأخطاء (آخر 30 يوم)">
          <div className="space-y-1.5">
            {errors.by_type.slice(0, 5).map((e) => (
              <ErrorBar key={e.error_type} label={ERROR_LABELS[e.error_type] || e.error_type} n={e.n} max={errors.by_type[0].n} />
            ))}
          </div>
          {errors.top_missed_words?.length > 0 && (
            <div className="mt-3 pt-3 border-t border-line/40">
              <p className="text-[11px] uppercase tracking-wider text-muted mb-2">الكلمات الأكثر خطأً</p>
              <div className="flex flex-wrap gap-1.5">
                {errors.top_missed_words.slice(0, 8).map((w) => (
                  <span key={w.id} className="px-2.5 py-1 rounded-lg bg-red-500/10 text-red-300 text-xs font-medium">
                    {w.word} <span className="opacity-60">×{w.misses}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </Section>
      )}
    </div>
  );
}

/* ─── Atoms ─────────────────────────────────────────────────────── */

function Kpi({ label, value, icon, tone }: { label: string; value: number | string; icon?: string; tone?: 'green' | 'blue' | 'red' | 'orange' }) {
  const toneCls = {
    green: 'text-green-400',
    blue: 'text-blue-400',
    red: 'text-red-400',
    orange: 'text-orange-400',
  }[tone || 'blue'];
  return (
    <div className="bg-card/50 border border-line/40 rounded-2xl p-3 text-center">
      {icon && <div className={`text-lg ${tone ? toneCls : ''}`}>{icon}</div>}
      <p className="text-lg font-bold text-heading">{value}</p>
      <p className="text-[11px] text-muted leading-tight">{label}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card/40 border border-line/40 rounded-2xl p-4">
      <p className="text-xs font-semibold text-heading mb-3">{title}</p>
      {children}
    </div>
  );
}

function ErrorBar({ label, n, max }: { label: string; n: number; max: number }) {
  const pct = max > 0 ? (n / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-body w-32 truncate">{label}</span>
      <div className="flex-1 h-2 bg-card rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-red-500 to-orange-500 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted tabular-nums w-6 text-end">{n}</span>
    </div>
  );
}

function Sparkline({
  days,
  series,
}: {
  days: string[];
  series: Array<{ name: string; color: string; data: number[] }>;
}) {
  const W = 320;
  const H = 90;
  const padX = 10;
  const padY = 14;
  const max = Math.max(1, ...series.flatMap((s) => s.data));
  const step = (W - 2 * padX) / Math.max(1, days.length - 1);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block">
        {series.map((s, si) => {
          const pts = s.data.map((v, i) => `${padX + i * step},${H - padY - (v / max) * (H - 2 * padY)}`).join(' ');
          return (
            <g key={si}>
              <polyline fill="none" stroke={s.color} strokeWidth={2} points={pts} />
              {s.data.map((v, i) => (
                <circle
                  key={i}
                  cx={padX + i * step}
                  cy={H - padY - (v / max) * (H - 2 * padY)}
                  r={2.5}
                  fill={s.color}
                />
              ))}
            </g>
          );
        })}
      </svg>
      <div className="flex items-center gap-4 text-[11px] text-muted mt-2 justify-center">
        {series.map((s) => (
          <span key={s.name} className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

function ForecastBars({ days, values }: { days: string[]; values: number[] }) {
  const max = Math.max(1, ...values);
  return (
    <div>
      <div className="flex items-end gap-1 h-20">
        {values.map((v, i) => (
          <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1">
            <div
              className="w-full rounded-t bg-gradient-to-t from-blue-600/80 to-purple-500/80"
              style={{ height: `${(v / max) * 100}%`, minHeight: v > 0 ? 4 : 0 }}
              title={`${days[i]}: ${v}`}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-1 text-[9px] text-muted mt-1.5">
        {days.map((d, i) => (
          <span key={i} className="flex-1 text-center">
            {i % 2 === 0 ? d.slice(5) : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─── Helpers ───────────────────────────────────────────────────── */
function lastNDates(n: number, direction: 1 | -1 = -1): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(today);
    if (direction === -1) d.setDate(today.getDate() - (n - 1 - i));
    else d.setDate(today.getDate() + i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}
