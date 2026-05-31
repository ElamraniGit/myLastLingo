/**
 * AdaptiveIntroPanel — controls the daily new-word quota.
 *
 * Shows:
 *   • current target + how many added today
 *   • smart recommendation for *now* (with explanation)
 *   • adjustable slider + auto-adjust toggle
 */

import React, { useEffect, useState } from 'react';
import { v3Api } from '@/lib/api';
import type { IntroSettings, IntroRecommendation } from '@/types';

export default function AdaptiveIntroPanel() {
  const [settings, setSettings] = useState<IntroSettings | null>(null);
  const [rec, setRec] = useState<IntroRecommendation | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const [s, r] = await Promise.all([
        v3Api.introSettings(),
        v3Api.introRecommendation(),
      ]);
      setSettings(s);
      setRec(r);
    } catch {
      setSettings(null);
      setRec(null);
    }
  };

  useEffect(() => { load(); }, []);

  const handleTargetChange = async (newTarget: number) => {
    setSaving(true);
    try {
      const s = await v3Api.introUpdateSettings({ daily_new_target: newTarget });
      setSettings(s);
      const r = await v3Api.introRecommendation();
      setRec(r);
    } finally {
      setSaving(false);
    }
  };

  const handleAutoToggle = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const s = await v3Api.introUpdateSettings({ auto_adjust: !settings.auto_adjust });
      setSettings(s);
      const r = await v3Api.introRecommendation();
      setRec(r);
    } finally {
      setSaving(false);
    }
  };

  if (!settings) {
    return (
      <div className="bg-card/40 border border-line/40 rounded-2xl p-4 text-center text-xs text-muted">
        جارٍ تحميل إعدادات التقديم…
      </div>
    );
  }

  const progress = settings.daily_new_target > 0
    ? Math.min(100, (settings.introduced_today / settings.daily_new_target) * 100)
    : 0;

  return (
    <div className="bg-card/50 border border-line/40 rounded-2xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-heading">🎓 التقديم التكيفي</h3>
          <p className="text-[11px] text-muted leading-relaxed mt-0.5">
            عدد الكلمات الجديدة المثالي لإضافتها يومياً.
          </p>
        </div>
        {rec && rec.suggested_now > 0 && (
          <span className="px-2 py-1 rounded-full bg-purple-500/15 text-purple-300 text-[10px] font-bold">
            +{rec.suggested_now} مُقترح الآن
          </span>
        )}
      </div>

      {/* Today's progress */}
      <div className="bg-elevated/40 rounded-xl p-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-body">تقدّم اليوم</span>
          <span className="text-heading font-bold tabular-nums">
            {settings.introduced_today} / {settings.daily_new_target}
          </span>
        </div>
        <div className="h-2 bg-elevated rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        {progress >= 100 && (
          <p className="text-[10px] text-green-300">✓ أكملت هدفك اليومي!</p>
        )}
      </div>

      {/* Recommendation notes */}
      {rec && rec.notes.length > 0 && (
        <ul className="text-[11px] text-body leading-relaxed space-y-1 bg-elevated/20 rounded-lg p-2.5">
          {rec.notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}

      {/* Target slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <label className="text-body">الهدف اليومي</label>
          <span className="text-heading font-bold tabular-nums">
            {settings.daily_new_target}
          </span>
        </div>
        <input
          type="range"
          min={1}
          max={30}
          step={1}
          value={settings.daily_new_target}
          disabled={saving}
          onChange={(e) => {
            const v = parseInt(e.target.value);
            // Optimistic UI then debounce the save on mouseup via blur
            setSettings({ ...settings, daily_new_target: v });
          }}
          onMouseUp={(e) => handleTargetChange(parseInt((e.target as HTMLInputElement).value))}
          onTouchEnd={(e) => handleTargetChange(parseInt((e.target as HTMLInputElement).value))}
          className="w-full accent-purple-500"
        />
        <div className="flex justify-between text-[9px] text-faint">
          <span>1</span>
          <span>5 (موصى به)</span>
          <span>15</span>
          <span>30</span>
        </div>
      </div>

      {/* Auto-adjust toggle */}
      <div className="flex items-center justify-between text-sm">
        <label className="cursor-pointer text-body" onClick={handleAutoToggle}>
          ⚡ تعديل تلقائي حسب الحمل
        </label>
        <button
          onClick={handleAutoToggle}
          disabled={saving}
          className={`w-10 h-5 rounded-full transition-colors relative ${
            settings.auto_adjust ? 'bg-purple-600' : 'bg-elevated'
          }`}
        >
          <span
            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
              settings.auto_adjust ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>
      {settings.auto_adjust && (
        <p className="text-[10px] text-muted leading-relaxed">
          سيُخفّض التطبيق العدد المُقترح إذا كان لديك مراجعات كثيرة مستحقة أو أخطاء حديثة.
        </p>
      )}
    </div>
  );
}
