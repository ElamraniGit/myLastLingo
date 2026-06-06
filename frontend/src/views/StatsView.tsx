/**
 * StatsView — لوحة إحصاءات مرئية كاملة بـ SVG خالص.
 *
 * Charts (zero external deps):
 *  1. Mini Sparkline   — نقاط المراجعات الـ 7 أيام الماضية
 *  2. Activity Heatmap — شبكة 30 يوم (مثل GitHub contribution graph)
 *  3. Donut Chart      — توزيع حالة الكلمات (Learning / Reviewing / Learned)
 *  4. Bar Chart        — توزيع CEFR (A1→C2)
 *  5. Quality Bars     — معدّل جودة المراجعات (0→5)
 *  6. Upcoming Reviews — أيام المراجعات القادمة (7 أيام)
 *  7. Hardest Words    — أصعب 5 كلمات
 *  8. Top Tags         — أكثر الوسوم استخداماً
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useStore } from '@/store/appStore';
import { useDictionary } from '@/hooks/useDictionary';
import { xpApi } from '@/lib/api';
import type { UserProgress, ReviewSummary } from '@/types';

// ── Colour palette ────────────────────────────────────────────────────────────
const CEFR_COLORS: Record<string, string> = {
  A1: '#fb7185', A2: '#fb923c', B1: '#facc15',
  B2: '#4ade80', C1: '#60a5fa', C2: '#a78bfa',
};
const STATUS_COLORS = {
  learning:  '#f59e0b',
  reviewing: '#3b82f6',
  learned:   '#22c55e',
};
const QUALITY_COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#8b5cf6'];
const QUALITY_LABELS = ['0','1','2','3','4','5'];

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

function dateLabel(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function dayKey(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

// ── Sparkline ─────────────────────────────────────────────────────────────────
function Sparkline({ data, color = '#3b82f6', height = 48 }: {
  data: number[]; color?: string; height?: number;
}) {
  if (!data.length) return null;
  const w = 200, h = height;
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * w;
    const y = h - (v / max) * (h - 6) - 3;
    return `${x},${y}`;
  });
  const polyline = pts.join(' ');
  // Area fill: close the path bottom-right → bottom-left
  const last = pts[pts.length - 1];
  const first = pts[0];
  const area = `${first} ${polyline} ${(data.length - 1) / Math.max(data.length - 1, 1) * w},${h} 0,${h}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.25"/>
          <stop offset="100%" stopColor={color} stopOpacity="0.01"/>
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#spark-grad)"/>
      <polyline points={polyline} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      {/* Last point dot */}
      {pts.length > 0 && (() => {
        const [x, y] = last.split(',').map(Number);
        return <circle cx={x} cy={y} r="3" fill={color}/>;
      })()}
    </svg>
  );
}

// ── Donut chart ───────────────────────────────────────────────────────────────
function Donut({ segments, size = 120 }: {
  segments: { value: number; color: string; label: string }[];
  size?: number;
}) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const r = 42, cx = 60, cy = 60, circumference = 2 * Math.PI * r;
  let offset = 0;

  return (
    <svg viewBox="0 0 120 120" width={size} height={size}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgb(var(--bg-elevated))" strokeWidth="14"/>
      {segments.map((s, i) => {
        const pct   = s.value / total;
        const dash  = pct * circumference;
        const gap   = circumference - dash;
        const rotate = -90 + (offset / total) * 360;
        offset += s.value;
        return (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={s.color}
            strokeWidth="14"
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={0}
            strokeLinecap="butt"
            transform={`rotate(${rotate} ${cx} ${cy})`}
          />
        );
      })}
      {/* Centre total */}
      <text x={cx} y={cy - 5} textAnchor="middle" fontSize="18" fontWeight="700" fill="rgb(var(--tx-heading))">{fmt(total)}</text>
      <text x={cx} y={cy + 11} textAnchor="middle" fontSize="9" fill="rgb(var(--tx-muted))">words</text>
    </svg>
  );
}

// ── Heatmap (30 days) ─────────────────────────────────────────────────────────
function Heatmap({ data }: { data: Record<string, number> }) {
  const days = Array.from({ length: 30 }, (_, i) => 30 - i - 1);
  const max  = Math.max(...Object.values(data), 1);
  const cols = 10, rows = 3;
  const cellW = 28, cellH = 28, gap = 4;
  const totalW = cols * (cellW + gap);
  const totalH = rows * (cellH + gap);

  function intensity(count: number): string {
    if (!count) return 'rgb(var(--bg-elevated))';
    const p = count / max;
    if (p < 0.25) return '#1e3a5f';
    if (p < 0.5)  return '#1d4ed8';
    if (p < 0.75) return '#3b82f6';
    return '#93c5fd';
  }

  return (
    <svg viewBox={`0 0 ${totalW} ${totalH}`} className="w-full max-w-xs mx-auto">
      {days.map((daysAgo, idx) => {
        const col  = Math.floor(idx / rows);
        const row  = idx % rows;
        const key  = dayKey(daysAgo);
        const count = data[key] ?? 0;
        const x    = col * (cellW + gap);
        const y    = row * (cellH + gap);
        return (
          <g key={key}>
            <rect
              x={x} y={y}
              width={cellW} height={cellH}
              rx="5"
              fill={intensity(count)}
            />
            {count > 0 && (
              <text x={x + cellW/2} y={y + cellH/2 + 4} textAnchor="middle" fontSize="9" fill="white" fontWeight="600">
                {count}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── Horizontal bar chart ──────────────────────────────────────────────────────
function HBar({ label, value, max, color, suffix = '' }: {
  label: string; value: number; max: number; color: string; suffix?: string;
}) {
  const pct = max > 0 ? Math.max(3, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-bold text-body w-7 shrink-0">{label}</span>
      <div className="flex-1 h-5 bg-elevated rounded-full overflow-hidden relative">
        <div
          className="h-full rounded-full transition-all duration-700 flex items-center justify-end pr-2"
          style={{ width: `${pct}%`, backgroundColor: color }}
        >
          {value > 0 && (
            <span className="text-xs font-bold text-white">{value}{suffix}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Upcoming reviews bar ──────────────────────────────────────────────────────
function UpcomingBar({ data }: { data: Record<string, number> }) {
  const today = new Date();
  const days  = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const key   = d.toISOString().slice(0, 10);
    const count = data[key] ?? 0;
    const label = i === 0 ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' });
    return { key, count, label };
  });
  const max = Math.max(...days.map(d => d.count), 1);

  return (
    <div className="flex items-end gap-2 h-20">
      {days.map(d => {
        const pct  = d.count ? Math.max(12, Math.round((d.count / max) * 100)) : 4;
        const isToday = d.label === 'Today';
        return (
          <div key={d.key} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-xs text-muted font-medium">{d.count || ''}</span>
            <div className="w-full rounded-t-lg transition-all duration-700"
                 style={{ height: `${pct}%`, backgroundColor: isToday ? '#3b82f6' : '#64748b44' }}/>
            <span className={`text-xs font-medium ${isToday ? 'text-blue-500' : 'text-faint'}`}>{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function StatsView() {
  const { setPage, progress } = useStore();
  const { loadStats } = useDictionary();
  const [loading, setLoading] = useState(true);
  const [xpData,  setXpData]  = useState<any>(null);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);

  // Derive 7-day sparkline from upcoming_review_days (past 7 days) as proxy,
  // or build a flat line from total_reviews
  const upcomingDays: Record<string, number> = (progress?.upcoming_review_days as any) ?? {};
  const qualityBreakdown: Record<string, number> = (progress?.recent_quality_breakdown as any) ?? {};
  const levelDist: Record<string, number> = (progress?.level_distribution as any) ?? {};
  const hardestWords = progress?.hardest_words ?? [];
  const topTags      = progress?.top_tags ?? [];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await loadStats();
      const xp = await xpApi.getStatus().catch(() => null);
      setXpData(xp);
    } finally {
      setLoading(false);
    }
  }, [loadStats]);

  useEffect(() => { load(); }, []); // eslint-disable-line

  // ── Derived stats ───────────────────────────────────────────────────────────
  const totalWords  = progress?.total    ?? 0;
  const learning    = progress?.learning ?? 0;
  const reviewing   = (progress as any)?.reviewing ?? 0;
  const learned     = progress?.learned  ?? 0;
  const totalReviews = progress?.total_reviews ?? 0;
  const avgEase      = (progress as any)?.avg_ease ?? 0;
  const activeDays   = progress?.active_days_30 ?? 0;
  const reviewedToday = progress?.reviewed_today ?? 0;
  const streak       = xpData?.streak_days ?? (progress as any)?.streak_days ?? 0;
  const totalXP      = xpData?.total_xp ?? 0;
  const level        = xpData?.level ?? 1;
  const dailyXP      = xpData?.daily_xp ?? 0;
  const dailyGoal    = xpData?.daily_goal ?? 50;

  // Donut segments
  const donutSegments = [
    { value: learning,  color: STATUS_COLORS.learning,  label: 'Learning'  },
    { value: reviewing, color: STATUS_COLORS.reviewing, label: 'Reviewing' },
    { value: learned,   color: STATUS_COLORS.learned,   label: 'Learned'   },
  ].filter(s => s.value > 0);

  // CEFR max for bar scaling
  const cefrMax = Math.max(...Object.values(levelDist).map(Number), 1);

  // Quality breakdown
  const qualityData = QUALITY_LABELS.map(q => ({ label: q, value: qualityBreakdown[q] ?? 0, color: QUALITY_COLORS[Number(q)] }));
  const qualityMax  = Math.max(...qualityData.map(d => d.value), 1);

  // Average quality (weighted)
  const totalQ = qualityData.reduce((a, d) => a + d.value, 0);
  const avgQ   = totalQ > 0
    ? (qualityData.reduce((a, d) => a + d.value * Number(d.label), 0) / totalQ).toFixed(1)
    : '—';

  // Sparkline: build 7-point series from upcoming days reversed (past isn't stored,
  // so we use a rolling window of reviewed_today as anchor with flat line)
  const sparkData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    return upcomingDays[key] ?? (i === 6 ? reviewedToday : 0);
  });

  // ── Skeleton ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="max-w-lg mx-auto px-4 pt-5 pb-28 space-y-4 animate-fade-in">
      {[...Array(6)].map((_, i) => <div key={i} className={`skeleton rounded-2xl ${i === 0 ? 'h-24' : 'h-40'}`}/>)}
    </div>
  );

  return (
    <div className="max-w-lg mx-auto px-4 pt-5 pb-28 lg:pb-8 space-y-4 animate-fade-in">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setPage('player')}
          className="w-9 h-9 rounded-xl hover:bg-card text-muted hover:text-body flex items-center justify-center transition-colors"
          aria-label="Back"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-heading tracking-tight">Statistics</h1>
          <p className="text-sm text-muted">Your learning analytics</p>
        </div>
        <button
          onClick={load}
          className="ml-auto w-9 h-9 rounded-xl hover:bg-card text-muted hover:text-body flex items-center justify-center transition-colors"
          aria-label="Refresh"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
        </button>
      </div>

      {/* ── Hero metric row ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { icon: (<svg className='w-4 h-4' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round'><rect x='3' y='3' width='5' height='18' rx='1'/><rect x='10' y='3' width='5' height='18' rx='1'/><path d='M17 3l4 2v14l-4 2V3z'/></svg>), label: 'Total',   val: fmt(totalWords),   color: 'text-heading' },
          { icon: (<svg className='w-4 h-4' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round'><polyline points='20 6 9 17 4 12'/></svg>), label: 'Learned', val: fmt(learned),      color: 'text-green-400' },
          { icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22a7 7 0 0 1-7-7c0-4.5 3-7.5 4-10 1.5 2 2 4 2 6.5C12 9 14 7 15 4c2 3.5 3 5 3 7a7 7 0 0 1-6 6.93V22z"/></svg>, label: 'Streak',  val: `${streak}d`,      color: 'text-orange-400' },
          { icon: '⭐', label: 'Level',   val: String(level),     color: 'text-yellow-400' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-default rounded-2xl py-3 text-center">
            <div className="text-lg mb-0.5">{s.icon}</div>
            <div className={`text-base font-bold ${s.color}`}>{s.val}</div>
            <div className="text-xs text-faint uppercase tracking-wide">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Activity row ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Reviews',     val: fmt(totalReviews), sub: 'total',       color: 'text-cyan-400'   },
          { label: 'Today',       val: String(reviewedToday), sub: 'reviewed', color: 'text-blue-400'  },
          { label: 'Active Days', val: String(activeDays),   sub: 'last 30d', color: 'text-purple-400' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-default rounded-2xl p-3 text-center">
            <div className={`text-xl font-bold ${s.color}`}>{s.val}</div>
            <div className="text-xs text-muted mt-0.5">{s.label}</div>
            <div className="text-xs text-faint">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* ── XP + Daily goal ─────────────────────────────────────────────────── */}
      {xpData && (
        <div className="bg-card border border-default rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-heading">XP &amp; Daily Goal</h2>
            <span className="text-xs text-faint">{totalXP} total XP</span>
          </div>
          <div className="flex items-center gap-4">
            {/* XP ring */}
            <div className="relative w-16 h-16 shrink-0">
              <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
                <circle cx="32" cy="32" r="26" fill="none" stroke="rgb(var(--bg-elevated))" strokeWidth="7"/>
                <circle
                  cx="32" cy="32" r="26" fill="none"
                  stroke="#3b82f6" strokeWidth="7"
                  strokeDasharray={`${2*Math.PI*26}`}
                  strokeDashoffset={`${2*Math.PI*26 * (1 - Math.min(dailyXP/Math.max(dailyGoal,1), 1))}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xs font-bold text-heading">{dailyXP}</span>
                <span className="text-[8px] text-faint">/{dailyGoal}</span>
              </div>
            </div>
            <div className="flex-1">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-body font-medium">Daily goal</span>
                <span className="text-muted">{Math.min(100, Math.round(dailyXP/Math.max(dailyGoal,1)*100))}%</span>
              </div>
              <div className="h-2.5 bg-elevated rounded-full overflow-hidden mb-3">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-700"
                  style={{ width: `${Math.min(100, Math.round(dailyXP/Math.max(dailyGoal,1)*100))}%` }}
                />
              </div>
              <div className="flex gap-3 text-xs text-muted">
                <span className="flex items-center gap-1"><svg className="w-4 h-4 text-yellow-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 9H4a2 2 0 0 1-2-2V5h4"/><path d="M18 9h2a2 2 0 0 0 2-2V5h-4"/><path d="M4 5h16v4a8 8 0 0 1-16 0z"/><path d="M12 17v4M8 21h8"/></svg>Level <b className="text-heading">{level}</b></span>
                <span>⭐ <b className="text-heading">{(level*100) - totalXP}</b> XP to next</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Donut + Status ───────────────────────────────────────────────────── */}
      {totalWords > 0 && (
        <div className="bg-card border border-default rounded-2xl p-4">
          <h2 className="text-sm font-semibold text-heading mb-3">Vocabulary Status</h2>
          <div className="flex items-center gap-6">
            <Donut segments={donutSegments} size={110}/>
            <div className="flex-1 space-y-2.5">
              {[
                { label: 'Learning',  value: learning,  color: STATUS_COLORS.learning  },
                { label: 'Reviewing', value: reviewing, color: STATUS_COLORS.reviewing },
                { label: 'Learned',   value: learned,   color: STATUS_COLORS.learned   },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }}/>
                  <span className="text-xs text-body flex-1">{s.label}</span>
                  <span className="text-xs font-semibold text-heading">{s.value}</span>
                  <span className="text-xs text-faint w-8 text-right">
                    {totalWords > 0 ? `${Math.round((s.value/totalWords)*100)}%` : '—'}
                  </span>
                </div>
              ))}
              {avgEase > 0 && (
                <div className="pt-1 border-t border-subtle">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted">Avg ease factor</span>
                    <span className="font-semibold text-heading">{Number(avgEase).toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 7-day Sparkline ─────────────────────────────────────────────────── */}
      <div className="bg-card border border-default rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-heading">7-Day Activity</h2>
          <span className="text-xs text-faint">{dateLabel(6)} — Today</span>
        </div>
        <Sparkline data={sparkData} color="#3b82f6" height={56}/>
        <div className="flex justify-between text-xs text-faint mt-1">
          {Array.from({length:7},(_,i)=>6-i).map(d=>(
            <span key={d}>{d===0?'Today':new Date(Date.now()-d*86400000).toLocaleDateString('en',{weekday:'narrow'})}</span>
          ))}
        </div>
      </div>

      {/* ── Activity Heatmap ─────────────────────────────────────────────────── */}
      <div className="bg-card border border-default rounded-2xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-heading">30-Day Heatmap</h2>
          <div className="flex items-center gap-1.5 text-xs text-faint">
            <span>Less</span>
            {['#1e3a5f','#1d4ed8','#3b82f6','#93c5fd'].map(c=>(
              <div key={c} className="w-3 h-3 rounded-sm" style={{backgroundColor:c}}/>
            ))}
            <span>More</span>
          </div>
        </div>
        <Heatmap data={upcomingDays}/>
        <p className="text-xs text-faint text-center mt-3">Reviews per day — last 30 days</p>
      </div>

      {/* ── Upcoming Reviews ─────────────────────────────────────────────────── */}
      {Object.keys(upcomingDays).length > 0 && (
        <div className="bg-card border border-default rounded-2xl p-4">
          <h2 className="text-sm font-semibold text-heading mb-3">Upcoming Reviews</h2>
          <UpcomingBar data={upcomingDays}/>
        </div>
      )}

      {/* ── CEFR Distribution ────────────────────────────────────────────────── */}
      {Object.keys(levelDist).length > 0 && (
        <div className="bg-card border border-default rounded-2xl p-4">
          <h2 className="text-sm font-semibold text-heading mb-3">CEFR Levels</h2>
          <div className="space-y-2.5">
            {['A1','A2','B1','B2','C1','C2']
              .filter(l => levelDist[l])
              .map(l => (
                <HBar
                  key={l}
                  label={l}
                  value={levelDist[l] ?? 0}
                  max={cefrMax}
                  color={CEFR_COLORS[l]}
                />
              ))}
          </div>
        </div>
      )}

      {/* ── Quality Breakdown ────────────────────────────────────────────────── */}
      {totalReviews > 0 && (
        <div className="bg-card border border-default rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-heading">Review Quality</h2>
            <span className="text-sm text-muted">avg <b className="text-heading">{avgQ}</b>/5</span>
          </div>
          <div className="space-y-2">
            {qualityData.filter(d=>d.value>0).map(d=>(
              <HBar key={d.label} label={d.label} value={d.value} max={qualityMax} color={d.color} suffix=" reviews"/>
            ))}
          </div>
          <div className="flex gap-1 mt-3 justify-center">
            {QUALITY_LABELS.map((q,i)=>(
              <div key={q} className="flex flex-col items-center gap-0.5">
                <div className="w-4 h-1 rounded-full" style={{backgroundColor:QUALITY_COLORS[i]}}/>
                <span className="text-[8px] text-faint">{['Again','Hard','Hard','Good','Good','Easy'][i]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Hardest Words ────────────────────────────────────────────────────── */}
      {hardestWords.length > 0 && (
        <div className="bg-card border border-default rounded-2xl p-4">
          <h2 className="text-sm font-semibold text-heading mb-3 flex items-center gap-1.5"><svg className="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="currentColor"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>Hardest Words</h2>
          <div className="space-y-2">
            {hardestWords.slice(0,5).map((w:any, i:number) => (
              <div key={i} className="flex items-center gap-3 py-1.5 border-b border-subtle last:border-0">
                <span className="text-xs text-faint w-4 shrink-0">#{i+1}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-base font-semibold text-heading">{w.word}</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-sm text-muted">{w.reviewed_count} reviews</span>
                    <span className="text-xs text-red-400">{w.lapses} lapses</span>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                  w.status==='learning'  ? 'bg-amber-500/10 text-amber-500' :
                  w.status==='reviewing' ? 'bg-blue-500/10  text-blue-500'  :
                                           'bg-green-500/10 text-green-500'
                }`}>{w.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Top Tags ─────────────────────────────────────────────────────────── */}
      {topTags.length > 0 && (
        <div className="bg-card border border-default rounded-2xl p-4">
          <h2 className="text-sm font-semibold text-heading mb-3 flex items-center gap-1.5"><svg className="w-4 h-4 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7" strokeWidth="3"/></svg>Top Tags</h2>
          <div className="flex flex-wrap gap-2">
            {topTags.slice(0,10).map((t:any) => (
              <div key={t.tag}
                className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-500 rounded-full px-3 py-1 text-xs font-medium">
                <span>{t.tag}</span>
                <span className="bg-blue-500/20 rounded-full px-1.5 py-0.5 text-xs font-bold">{t.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────────────────────── */}
      {totalWords === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-blue-500/10 flex items-center justify-center"><svg className="w-8 h-8 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg></div>
          <div className="text-base font-semibold text-heading mb-1">No data yet</div>
          <div className="text-sm text-muted">Save some words and do reviews to see your stats</div>
        </div>
      )}
    </div>
  );
}
