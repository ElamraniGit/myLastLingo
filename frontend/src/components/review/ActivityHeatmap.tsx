/**
 * ActivityHeatmap — GitHub-style yearly contribution grid.
 *
 * Renders the last 365 days as a 7×53 grid of colored cells (one per day).
 * Each cell's intensity (0..4) maps to a shade of green; hovering shows
 * a tooltip with the day's reviews + new words.
 *
 * Pure SVG, no external charting library — works inside the workspace
 * sandbox preview.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { v3Api } from '@/lib/api';
import type { HeatmapData, HeatmapCell } from '@/types';

// Tailwind classes per intensity bucket. Bucket 0 = no activity.
const INTENSITY_CLASS: Record<number, string> = {
  0: 'fill-slate-700/40',
  1: 'fill-green-700/60',
  2: 'fill-green-600/80',
  3: 'fill-green-500',
  4: 'fill-green-400',
};

const MONTH_NAMES_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

const WEEKDAY_NAMES_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export default function ActivityHeatmap({ days = 365 }: { days?: number }) {
  const [data, setData] = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<{ cell: HeatmapCell; x: number; y: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    v3Api
      .activityHeatmap(days)
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setData(null))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [days]);

  // Organise cells into weeks (columns) of weekdays (rows)
  const weeks = useMemo(() => organiseByWeeks(data?.cells || []), [data]);

  if (loading) {
    return (
      <div className="bg-card/40 border border-line/40 rounded-2xl p-6 text-center text-sm text-muted">
        جارٍ تحميل خريطة النشاط…
      </div>
    );
  }
  if (!data) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-sm text-red-300">
        تعذّر تحميل خريطة النشاط.
      </div>
    );
  }

  // SVG geometry
  const CELL = 12;
  const GAP = 3;
  const STEP = CELL + GAP;
  const PAD_LEFT = 28;   // weekday labels
  const PAD_TOP = 18;    // month labels
  const numWeeks = weeks.length;
  const width = PAD_LEFT + numWeeks * STEP + GAP;
  const height = PAD_TOP + 7 * STEP + GAP;

  // Month labels: pick the first week whose Sunday is in a new month.
  const monthLabels = computeMonthLabels(weeks, STEP, PAD_LEFT);

  return (
    <div className="bg-card/50 border border-line/40 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-heading">🗓️ نشاطك خلال السنة</h3>
        <div className="flex items-center gap-2 text-[10px] text-muted">
          أقل
          <div className="flex gap-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-sm ${INTENSITY_CLASS[i].replace('fill-', 'bg-')}`}
              />
            ))}
          </div>
          أكثر
        </div>
      </div>

      {/* SVG grid — horizontally scrollable on narrow screens */}
      <div className="overflow-x-auto pb-2 -mx-1 px-1 relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="block min-w-[640px] w-full h-auto">
          {/* Month labels */}
          {monthLabels.map((m, i) => (
            <text
              key={i}
              x={m.x}
              y={12}
              className="fill-muted text-[9px]"
              style={{ fontSize: 9 }}
            >
              {m.label}
            </text>
          ))}

          {/* Weekday labels (every other day to save space) */}
          {[1, 3, 5].map((d) => (
            <text
              key={d}
              x={2}
              y={PAD_TOP + d * STEP + CELL / 2 + 3}
              className="fill-muted"
              style={{ fontSize: 8 }}
            >
              {WEEKDAY_NAMES_AR[d].slice(0, 3)}
            </text>
          ))}

          {/* Cells */}
          {weeks.map((week, wi) =>
            week.map((cell, di) => {
              if (!cell) return null;
              const x = PAD_LEFT + wi * STEP;
              const y = PAD_TOP + di * STEP;
              return (
                <rect
                  key={`${wi}-${di}`}
                  x={x}
                  y={y}
                  width={CELL}
                  height={CELL}
                  rx={2.5}
                  className={`${INTENSITY_CLASS[cell.intensity]} hover:stroke-white hover:stroke-1 cursor-pointer transition-all`}
                  onMouseEnter={(e) => setTooltip({
                    cell,
                    x: x + CELL / 2,
                    y: y - 4,
                  })}
                  onMouseLeave={() => setTooltip(null)}
                  onTouchStart={() => setTooltip({ cell, x: x + CELL / 2, y: y - 4 })}
                />
              );
            }),
          )}
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute pointer-events-none bg-black/90 text-white text-[10px] rounded-lg px-2 py-1 shadow-lg z-10 whitespace-nowrap"
            style={{
              left: `${(tooltip.x / width) * 100}%`,
              top: `${Math.max(0, tooltip.y - 30)}px`,
              transform: 'translateX(-50%)',
            }}
          >
            <div className="font-bold">{formatArabicDate(tooltip.cell.day)}</div>
            <div className="opacity-90">
              {tooltip.cell.total === 0
                ? 'بدون نشاط'
                : `${tooltip.cell.reviews} مراجعة · ${tooltip.cell.new_words} جديدة`}
            </div>
          </div>
        )}
      </div>

      {/* Aggregate stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
        <Stat label="إجمالي المراجعات" value={data.total_reviews} icon="🔁" />
        <Stat label="كلمات جديدة" value={data.total_new_words} icon="✨" />
        <Stat label="أيام نشطة" value={`${data.active_days}/${data.days}`} icon="📅" />
        <Stat label="أطول سلسلة" value={data.longest_streak} icon="🔥" />
      </div>

      {data.current_streak > 0 && (
        <p className="text-center text-xs text-orange-300 pt-1">
          🔥 سلسلة حالية: <span className="font-bold">{data.current_streak}</span> يوم
        </p>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
 *  Helpers
 * ───────────────────────────────────────────────────────────────── */

/** Group flat cells into columns of 7 (Sunday at index 0). */
function organiseByWeeks(cells: HeatmapCell[]): (HeatmapCell | null)[][] {
  if (!cells.length) return [];
  const weeks: (HeatmapCell | null)[][] = [];
  const first = new Date(cells[0].day);
  const firstWeekday = first.getDay(); // 0 (Sun) .. 6 (Sat)

  // Pad the first week so cells[0] lands in the right weekday row.
  let week: (HeatmapCell | null)[] = Array(firstWeekday).fill(null);

  for (const c of cells) {
    week.push(c);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }
  return weeks;
}

function computeMonthLabels(
  weeks: (HeatmapCell | null)[][],
  step: number,
  padLeft: number,
): Array<{ x: number; label: string }> {
  const out: Array<{ x: number; label: string }> = [];
  let lastMonth = -1;
  weeks.forEach((week, wi) => {
    // Use first non-null cell in this week to get its month
    const firstCell = week.find((c) => c !== null);
    if (!firstCell) return;
    const m = new Date(firstCell.day).getMonth();
    if (m !== lastMonth) {
      out.push({ x: padLeft + wi * step, label: MONTH_NAMES_AR[m] });
      lastMonth = m;
    }
  });
  return out;
}

function formatArabicDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('ar', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function Stat({ label, value, icon }: { label: string; value: number | string; icon: string }) {
  return (
    <div className="bg-elevated/50 rounded-lg p-2 text-center">
      <div className="text-base">{icon}</div>
      <div className="text-sm font-bold text-heading">{value}</div>
      <div className="text-[10px] text-muted">{label}</div>
    </div>
  );
}
