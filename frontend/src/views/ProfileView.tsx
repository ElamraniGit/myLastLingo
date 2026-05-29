/**
 * User Hub — Profile + Settings + Progress in one page.
 * Accessed by tapping the user avatar.
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useStore } from '@/store/appStore';
import { useAuth } from '@/hooks/useAuth';
import { useDictionary } from '@/hooks/useDictionary';
import { authApi, BACKEND_ORIGIN } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { ReviewSummary, TranscriptFontSize, VideoQuality } from '@/types';

type Tab = 'profile' | 'progress' | 'settings';

export default function ProfileView() {
  const { user, setPage } = useStore();
  const [tab, setTab] = useState<Tab>('profile');

  if (!user) return null;

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'profile', label: 'Profile', icon: <UserIcon /> },
    { id: 'progress', label: 'Progress', icon: <ChartIcon /> },
    { id: 'settings', label: 'Settings', icon: <GearIcon /> },
  ];

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-5">
      {/* Back + tabs */}
      <div className="flex items-center gap-2">
        <button onClick={() => setPage('player')} className="p-2 rounded-xl hover:bg-slate-800 text-slate-500 hover:text-slate-300 flex-shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>
        <div className="flex-1 flex gap-1 bg-slate-800/50 rounded-xl p-1">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                tab === t.id ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'
              }`}>
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'profile' && <ProfileTab />}
      {tab === 'progress' && <ProgressTab />}
      {tab === 'settings' && <SettingsTab />}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   PROFILE TAB
   ════════════════════════════════════════════════════════════════ */
function ProfileTab() {
  const { user, progress, recentVideos } = useStore();
  const { logout } = useAuth();
  if (!user) return null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center text-center">
        <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-black text-white shadow-xl mb-3"
          style={{ backgroundColor: user.avatar_color }}>
          {(user.display_name || user.username)[0].toUpperCase()}
        </div>
        <h1 className="text-xl font-bold text-white">{user.display_name || user.username}</h1>
        <p className="text-slate-500 text-sm">@{user.username}</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Saved', value: progress?.total ?? 0, color: 'text-blue-400' },
          { label: 'Learned', value: progress?.learned ?? 0, color: 'text-green-400' },
          { label: 'Videos', value: recentVideos.length, color: 'text-purple-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-3 text-center">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      {user.created_at && (
        <div className="bg-slate-800/50 border border-slate-700/40 rounded-xl px-4 py-3 flex justify-between text-sm">
          <span className="text-slate-500">Member since</span>
          <span className="text-slate-300">{new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}</span>
        </div>
      )}

      <Button onClick={logout} variant="danger" className="w-full">Sign Out</Button>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   PROGRESS TAB
   ════════════════════════════════════════════════════════════════ */
function ProgressTab() {
  const { progress, recentVideos } = useStore();
  const { loadStats, loadReviewSummary } = useDictionary();
  const [summary, setSummary] = useState<ReviewSummary | null>(null);

  useEffect(() => { loadStats(); loadReviewSummary().then(setSummary).catch(() => null); }, []);

  const stats = [
    { label: 'Videos', value: recentVideos.length, color: 'text-blue-400' },
    { label: 'Saved', value: progress?.total ?? 0, color: 'text-purple-400' },
    { label: 'Learned', value: progress?.learned ?? 0, color: 'text-green-400' },
    { label: 'Reviews', value: progress?.total_reviews ?? 0, color: 'text-cyan-400' },
    { label: 'Today', value: progress?.reviewed_today ?? 0, color: 'text-yellow-400' },
    { label: 'Due', value: summary?.due_now ?? 0, color: 'text-red-400' },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2">
        {stats.map(s => (
          <div key={s.label} className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-3 text-center">
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-200">Pipeline</h3>
        {[
          { l: 'Learning', v: summary?.learning ?? 0, c: 'bg-yellow-500' },
          { l: 'Reviewing', v: summary?.reviewing ?? 0, c: 'bg-blue-500' },
          { l: 'Learned', v: summary?.learned ?? 0, c: 'bg-green-500' },
        ].map(r => {
          const total = (summary?.total_saved ?? 1) || 1;
          return (
            <div key={r.l}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">{r.l}</span>
                <span className="text-slate-500">{r.v}</span>
              </div>
              <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${r.c}`} style={{ width: `${Math.round((r.v / total) * 100)}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {progress?.level_distribution && Object.keys(progress.level_distribution).length > 0 && (
        <div className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">Levels</h3>
          {Object.entries(progress.level_distribution).map(([level, count]) => (
            <div key={level} className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-bold text-slate-400 w-5">{level}</span>
              <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.round((Number(count) / Math.max(Object.values(progress.level_distribution!).reduce((a,b) => a + Number(b), 0), 1)) * 100)}%` }} />
              </div>
              <span className="text-[10px] text-slate-500 w-5 text-right">{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   SETTINGS TAB
   ════════════════════════════════════════════════════════════════ */
function SettingsTab() {
  const {
    theme, toggleTheme,
    defaultSpeed, setDefaultSpeed,
    autoPauseOnWord, setAutoPauseOnWord,
    user, setUser,
  } = useStore();
  const [form, setForm] = useState({ display_name: '', email: '', current_password: '', new_password: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [backendOk, setBackendOk] = useState<boolean | null>(null);

  useEffect(() => {
    fetch(`${BACKEND_ORIGIN}/health`).then(r => r.json()).then(d => setBackendOk(d.status === 'healthy')).catch(() => setBackendOk(false));
    if (user) setForm(f => ({ ...f, display_name: user.display_name || '', email: user.email || '' }));
  }, [user]);

  const saveProfile = async () => {
    setSaving(true); setMsg('');
    try {
      await authApi.updateProfile({
        display_name: form.display_name || undefined,
        email: form.email || undefined,
        current_password: form.current_password || undefined,
        new_password: form.new_password || undefined,
      });
      const fresh = await authApi.me();
      setUser(fresh);
      setMsg('Saved!');
      setForm(f => ({ ...f, current_password: '', new_password: '' }));
    } catch (e: any) { setMsg(e.message || 'Failed'); }
    setSaving(false);
  };

  return (
    <div className="space-y-5">
      {/* Profile edit */}
      <div className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-200">Edit Profile</h3>
        <Input label="Display Name" value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} />
        <Input label="Email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
        <Input label="Current Password" type="password" value={form.current_password} onChange={e => setForm(f => ({ ...f, current_password: e.target.value }))} placeholder="Only if changing password" />
        <Input label="New Password" type="password" value={form.new_password} onChange={e => setForm(f => ({ ...f, new_password: e.target.value }))} />
        {msg && <p className={`text-xs ${msg === 'Saved!' ? 'text-green-400' : 'text-red-400'}`}>{msg}</p>}
        <Button onClick={saveProfile} loading={saving} variant="primary" size="sm">Save</Button>
      </div>

      {/* Playback */}
      <div className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-200">Playback</h3>
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-400">Default speed</span>
          <div className="flex gap-1">
            {[0.75, 1, 1.25, 1.5].map(s => (
              <button key={s} onClick={() => setDefaultSpeed(s)}
                className={`px-2 py-1 rounded-lg text-xs font-mono ${defaultSpeed === s ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
                {s}×
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-400">Pause on word click</span>
          <button onClick={() => setAutoPauseOnWord(!autoPauseOnWord)}
            className={`w-10 h-5 rounded-full transition-colors relative ${autoPauseOnWord ? 'bg-blue-600' : 'bg-slate-600'}`}>
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${autoPauseOnWord ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
      </div>

      {/* Appearance */}
      <div className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-400">Dark mode</span>
          <button onClick={toggleTheme}
            className={`w-10 h-5 rounded-full transition-colors relative ${theme === 'dark' ? 'bg-blue-600' : 'bg-slate-600'}`}>
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${theme === 'dark' ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
      </div>

      {/* Backend */}
      <div className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-4 flex items-center justify-between">
        <span className="text-sm text-slate-400">Backend</span>
        <span className={`text-xs flex items-center gap-1.5 ${backendOk ? 'text-green-400' : 'text-red-400'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${backendOk ? 'bg-green-500' : 'bg-red-500'}`} />
          {backendOk ? 'Online' : 'Offline'}
        </span>
      </div>
    </div>
  );
}

/* ── Tiny SVG icons for tabs ───────────────────────────────────── */
function UserIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
}
function ChartIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>;
}
function GearIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
}
