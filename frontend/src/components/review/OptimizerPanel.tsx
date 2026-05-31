/**
 * OptimizerPanel — FSRS-Optimizer UI.
 *
 * Lets the user trigger a re-tune of their FSRS weights, see what the
 * result is in plain Arabic, and reset back to defaults if they want.
 */

import React, { useEffect, useState } from 'react';
import { v3Api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import type { OptimizerResult, OptimizerStatus } from '@/types';

export default function OptimizerPanel() {
  const [status, setStatus] = useState<OptimizerStatus | null>(null);
  const [result, setResult] = useState<OptimizerResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);

  const loadStatus = async () => {
    try {
      const s = await v3Api.optimizerStatus();
      setStatus(s);
    } catch {
      setStatus(null);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleRun = async () => {
    setBusy(true);
    setResult(null);
    try {
      const r = await v3Api.optimizerRun();
      setResult(r);
      await loadStatus();
    } catch (e: any) {
      setResult({
        sample_size: 0,
        converged: false,
        baseline_loss: 0,
        optimized_loss: 0,
        improvement_pct: 0,
        request_retention: 0.9,
        weights: {},
        notes: [`❌ خطأ: ${e?.message || 'فشل تشغيل المُحسِّن'}`],
      });
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('هل تريد فعلاً إعادة الأوزان إلى القيم الافتراضية؟')) return;
    setResetting(true);
    try {
      await v3Api.optimizerReset();
      setResult(null);
      await loadStatus();
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="bg-card/50 border border-line/40 rounded-2xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-heading">🤖 مُحسِّن FSRS</h3>
          <p className="text-[11px] text-muted leading-relaxed mt-0.5">
            يُعيد ضبط الجدولة بناءً على بياناتك. يحتاج 50+ مراجعة.
          </p>
        </div>
        {status?.is_tuned && (
          <span className="px-2 py-1 rounded-full bg-green-500/15 text-green-300 text-[10px] font-bold">
            ✓ مُخصَّص
          </span>
        )}
      </div>

      {/* Current status */}
      {status && (
        <div className="bg-elevated/40 rounded-xl p-3 space-y-1.5">
          {status.is_tuned ? (
            <>
              <Row label="هدف الاحتفاظ" value={`${Math.round((status.request_retention || 0) * 100)}%`} />
              <Row label="عدد المراجعات المُحلَّلة" value={String(status.sample_size || 0)} />
              <Row label="تحسّن التنبؤ" value={`${(status.improvement_pct || 0).toFixed(1)}%`} />
              {status.updated_at && (
                <Row label="آخر تحديث" value={formatDate(status.updated_at)} />
              )}
            </>
          ) : (
            <p className="text-xs text-muted leading-relaxed">
              {status.message || 'تستخدم الأوزان الافتراضية لـ FSRS.'}
            </p>
          )}
        </div>
      )}

      {/* Latest result (after run) */}
      {result && (
        <div
          className={`rounded-xl p-3 space-y-2 border ${
            result.converged
              ? 'bg-green-500/10 border-green-500/30'
              : 'bg-amber-500/10 border-amber-500/30'
          }`}
        >
          <p
            className={`text-xs font-bold ${
              result.converged ? 'text-green-300' : 'text-amber-300'
            }`}
          >
            {result.converged
              ? `✓ تم تحديث الأوزان (${result.improvement_pct.toFixed(1)}% تحسّن)`
              : '⚠️ لم يتم التحديث'}
          </p>
          <ul className="text-[11px] text-body leading-relaxed space-y-1">
            {result.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Button onClick={handleRun} variant="primary" loading={busy} disabled={busy}>
          {busy ? '⏳ جارٍ التحليل…' : '⚡ شغّل المُحسِّن'}
        </Button>
        {status?.is_tuned && (
          <Button
            onClick={handleReset}
            variant="outline"
            loading={resetting}
            disabled={resetting}
          >
            ↺ استعادة الافتراضي
          </Button>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted">{label}</span>
      <span className="text-body font-bold tabular-nums">{value}</span>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('ar', {
      day: 'numeric', month: 'short',
    });
  } catch {
    return iso;
  }
}
