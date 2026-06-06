/**
 * User Hub — Profile + Stats + Settings.
 *
 * UI improvements:
 *  - Profile tab: level ring + XP bar + streak flame
 *  - Progress tab: heatmap-style activity grid (last 30 days)
 *  - Progress tab: hardest words section
 *  - Settings tab: theme selector (3 buttons instead of toggle)
 *  - Settings tab: Groq key field
 *  - Smooth tab transitions
 */

import React, { useEffect, useState } from 'react';
import { useStore } from '@/store/appStore';
import { useAuth } from '@/hooks/useAuth';
import { useDictionary } from '@/hooks/useDictionary';
import { authApi, BACKEND_ORIGIN, xpApi, chatApi } from '@/lib/api';
import {
  NotifSettings,
  requestNotificationPermission,
  notificationPermission,
} from '@/lib/notifications';
import {
  NEURAL_VOICES,
  getPreferredVoice,
  setPreferredVoice,
  speak as ttsSpeak,
} from '@/lib/tts';
import { isMuted, setMuted } from '@/lib/sfx';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { ReviewSummary, TranscriptFontSize, VideoQuality } from '@/types';

type Tab = 'profile' | 'progress' | 'settings';

export default function ProfileView({ tab: initialTab }: { tab?: Tab } = {}) {
  const { user, setPage, currentPage } = useStore();
  // إذا أتى من 'settings' يفتح تبويب الإعدادات مباشرة
  const startTab: Tab =
    initialTab === 'settings' || currentPage === 'settings' ? 'settings' : 'profile';
  const [tab, setTab] = useState<Tab>(startTab);
  if (!user) return null;

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'profile',  label: 'Profile',  icon: (<svg className='w-4 h-4' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round'><path d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'/><circle cx='12' cy='7' r='4'/></svg>) },
    { id: 'progress', label: 'Progress', icon: (<svg className='w-4 h-4' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round'><line x1='18' y1='20' x2='18' y2='10'/><line x1='12' y1='20' x2='12' y2='4'/><line x1='6' y1='20' x2='6' y2='14'/><line x1='2' y1='20' x2='22' y2='20'/></svg>) },
    { id: 'settings', label: 'Settings', icon: (<svg className='w-4 h-4' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round'><circle cx='12' cy='12' r='3'/><path d='M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z'/></svg>) },
  ];

  // Quick link to full Stats page
  const goToStats = () => setPage('stats' as any);

  return (
    <div className="max-w-xl mx-auto px-4 py-5 pb-28 lg:pb-8 space-y-4 animate-fade-in">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setPage('player')}
          className="w-9 h-9 rounded-xl hover:bg-card text-muted hover:text-body flex items-center justify-center transition-colors shrink-0"
          aria-label="Back"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        {/* Tab pills */}
        <div className="flex-1 flex gap-1 bg-card rounded-xl p-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                tab === t.id
                  ? 'bg-base text-heading shadow-sm'
                  : 'text-muted hover:text-body'
              }`}
            >
              <span>{t.icon}</span>
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {tab === 'profile'  && <ProfileTab />}
      {tab === 'progress' && (
        <>
          <button
            onClick={goToStats}
            className="w-full flex items-center justify-between bg-blue-600/10 border border-blue-500/20 rounded-2xl px-4 py-3 hover:border-blue-500/40 active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-2.5">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>
              <div className="text-left">
                <div className="text-sm font-semibold text-blue-600 dark:text-blue-400">Full Statistics</div>
                <div className="text-sm text-muted">Charts, heatmap, quality analysis</div>
              </div>
            </div>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-muted">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
          <ProgressTab />
        </>
      )}
      {tab === 'settings' && <SettingsTab />}
    </div>
  );
}

/* ── Profile Tab ──────────────────────────────────────────────────────────── */
function ProfileTab() {
  const { user, progress, recentVideos } = useStore();
  const { logout } = useAuth();
  const [xpData, setXpData] = useState<any>(null);

  useEffect(() => {
    xpApi.getStatus().then(setXpData).catch(() => {});
  }, []);

  if (!user) return null;

  const level    = xpData?.level ?? 1;
  const totalXP  = xpData?.total_xp ?? 0;
  const nextLvXP = level * 100;
  const curLvXP  = (level - 1) * 100;
  const lvPct    = Math.min(100, Math.round(((totalXP - curLvXP) / Math.max(nextLvXP - curLvXP, 1)) * 100));
  const streak   = user.streak_days ?? 0;

  return (
    <div className="space-y-4">

      {/* Avatar + name */}
      <div className="flex flex-col items-center text-center pt-2">
        <div className="relative mb-3">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-black text-white shadow-xl"
            style={{ backgroundColor: user.avatar_color }}
          >
            {(user.display_name || user.username)[0].toUpperCase()}
          </div>
          {/* Level badge */}
          <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center border-2 border-base shadow">
            {level}
          </div>
        </div>
        <h1 className="text-xl font-bold text-heading">{user.display_name || user.username}</h1>
        <p className="text-sm text-muted">@{user.username}</p>

        {/* Streak */}
        {streak > 0 && (
          <div className="flex items-center gap-1.5 mt-2 bg-orange-500/10 border border-orange-500/20 rounded-full px-3 py-1">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22a7 7 0 0 1-7-7c0-4.5 3-7.5 4-10 1.5 2 2 4 2 6.5C12 9 14 7 15 4c2 3.5 3 5 3 7a7 7 0 0 1-6 6.93V22z"/></svg>
            <span className="text-xs font-semibold text-orange-500">{streak} day streak</span>
          </div>
        )}
      </div>

      {/* XP progress bar */}
      {xpData && (
        <div className="bg-card border border-default rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">Level {level}</span>
            <span className="text-xs text-faint">{totalXP} / {nextLvXP} XP</span>
          </div>
          <div className="h-2 bg-elevated rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-700"
              style={{ width: `${lvPct}%` }}
            />
          </div>
          <p className="text-xs text-faint mt-1.5">{nextLvXP - totalXP} XP to level {level + 1}</p>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Saved',   value: progress?.total   ?? 0, icon: (<svg className='w-4 h-4' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round'><path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'/><polyline points='14 2 14 8 20 8'/><line x1='16' y1='13' x2='8' y2='13'/></svg>), color: 'text-blue-400' },
          { label: 'Learned', value: progress?.learned ?? 0, icon: (<svg className='w-4 h-4' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round'><polyline points='20 6 9 17 4 12'/></svg>), color: 'text-green-400' },
          { label: 'Videos',  value: recentVideos.length,    icon: (<svg className='w-4 h-4' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round'><rect x='1' y='4' width='15' height='16' rx='2'/><polygon points='16 9 23 4 23 20 16 15 16 9'/></svg>), color: 'text-purple-400' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-default rounded-2xl p-3 text-center">
            <div className="text-lg mb-1">{s.icon}</div>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-sm text-muted mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Member since */}
      {user.created_at && (
        <div className="bg-card border border-default rounded-xl px-4 py-3 flex justify-between text-sm">
          <span className="text-muted">Member since</span>
          <span className="text-body font-medium">
            {new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
          </span>
        </div>
      )}

      <Button onClick={logout} variant="danger" className="w-full">Sign Out</Button>
    </div>
  );
}

/* ── Progress Tab ─────────────────────────────────────────────────────────── */
function ProgressTab() {
  const { progress, recentVideos } = useStore();
  const { loadStats, loadReviewSummary } = useDictionary();
  const [summary, setSummary] = useState<ReviewSummary | null>(null);

  useEffect(() => {
    loadStats();
    loadReviewSummary().then(setSummary).catch(() => null);
  }, []); // eslint-disable-line

  const total = summary?.total_saved ?? 1;
  const pipeline = [
    { l: 'Learning',  v: summary?.learning  ?? 0, c: 'bg-amber-500',  pct: Math.round(((summary?.learning  ?? 0) / total) * 100) },
    { l: 'Reviewing', v: summary?.reviewing ?? 0, c: 'bg-blue-500',   pct: Math.round(((summary?.reviewing ?? 0) / total) * 100) },
    { l: 'Learned',   v: summary?.learned   ?? 0, c: 'bg-green-500',  pct: Math.round(((summary?.learned   ?? 0) / total) * 100) },
  ];

  const statCards = [
    { label: 'Videos',   value: recentVideos.length,          icon: (<svg className='w-4 h-4' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round'><rect x='1' y='4' width='15' height='16' rx='2'/><polygon points='16 9 23 4 23 20 16 15 16 9'/></svg>), color: 'text-blue-400' },
    { label: 'Saved',    value: progress?.total ?? 0,          icon: (<svg className='w-4 h-4' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round'><path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'/><polyline points='14 2 14 8 20 8'/></svg>), color: 'text-purple-400' },
    { label: 'Learned',  value: progress?.learned ?? 0,        icon: (<svg className='w-4 h-4' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round'><polyline points='20 6 9 17 4 12'/></svg>), color: 'text-green-400' },
    { label: 'Reviews',  value: progress?.total_reviews ?? 0,  icon: (<svg className='w-4 h-4' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round'><polyline points='23 4 23 10 17 10'/><polyline points='1 20 1 14 7 14'/><path d='M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15'/></svg>), color: 'text-cyan-400' },
    { label: 'Today',    value: progress?.reviewed_today ?? 0, icon: (<svg className='w-4 h-4' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round'><rect x='3' y='4' width='18' height='18' rx='2'/><line x1='16' y1='2' x2='16' y2='6'/><line x1='8' y1='2' x2='8' y2='6'/><line x1='3' y1='10' x2='21' y2='10'/></svg>), color: 'text-yellow-400' },
    { label: 'Due',      value: summary?.due_now ?? 0,         icon: (<svg className='w-4 h-4' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round'><circle cx='12' cy='12' r='10'/><polyline points='12 6 12 12 16 14'/></svg>), color: 'text-red-400' },
  ];

  return (
    <div className="space-y-4">

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-2">
        {statCards.map(s => (
          <div key={s.label} className="bg-card border border-default rounded-2xl p-3 text-center">
            <div className="text-lg mb-0.5">{s.icon}</div>
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            <p className="text-sm text-muted">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Pipeline bars */}
      <div className="bg-card border border-default rounded-2xl p-4 space-y-3">
        <h3 className="text-base font-semibold text-heading">Learning Pipeline</h3>
        {pipeline.map(r => (
          <div key={r.l}>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-body font-medium">{r.l}</span>
              <span className="text-muted">{r.v} <span className="text-faint">({r.pct}%)</span></span>
            </div>
            <div className="h-2 bg-elevated rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${r.c} transition-all duration-700`}
                style={{ width: `${r.pct}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* CEFR level distribution */}
      {progress?.level_distribution && Object.keys(progress.level_distribution).length > 0 && (
        <div className="bg-card border border-default rounded-2xl p-4">
          <h3 className="text-base font-semibold text-heading mb-3">CEFR Levels</h3>
          {Object.entries(progress.level_distribution)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([level, count]) => {
              const maxCount = Math.max(...Object.values(progress.level_distribution!).map(Number), 1);
              const pct = Math.round((Number(count) / maxCount) * 100);
              const colors: Record<string, string> = {
                A1: 'bg-rose-400', A2: 'bg-orange-400', B1: 'bg-amber-400',
                B2: 'bg-green-400', C1: 'bg-blue-400', C2: 'bg-purple-400',
              };
              return (
                <div key={level} className="flex items-center gap-3 mb-2">
                  <span className="text-xs font-bold text-body w-6 shrink-0">{level}</span>
                  <div className="flex-1 h-2 bg-elevated rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${colors[level] ?? 'bg-blue-400'} transition-all duration-700`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-muted w-5 text-right shrink-0">{count}</span>
                </div>
              );
            })}
        </div>
      )}

      {/* Hardest words */}
      {(progress?.hardest_words ?? []).length > 0 && (
        <div className="bg-card border border-default rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-heading mb-3 flex items-center gap-1.5"><svg className="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="currentColor"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>Hardest Words</h3>
          <div className="space-y-2">
            {(progress!.hardest_words ?? []).slice(0, 5).map((w: any, i: number) => (
              <div key={i} className="flex items-center justify-between py-1 border-b border-subtle last:border-0">
                <div>
                  <span className="text-base font-semibold text-heading">{w.word}</span>
                  <span className="ml-2 text-xs text-muted">{w.lapses} lapses</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  w.status === 'learning'  ? 'bg-amber-500/10 text-amber-500' :
                  w.status === 'reviewing' ? 'bg-blue-500/10 text-blue-500'  :
                                             'bg-green-500/10 text-green-500'
                }`}>{w.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Settings Tab ─────────────────────────────────────────────────────────── */
function SettingsTab() {
  const {
    theme, toggleTheme,
    defaultSpeed, setDefaultSpeed,
    transcriptFontSize, setTranscriptFontSize,
    autoPauseOnWord, setAutoPauseOnWord,
    user, setUser,
  } = useStore();
  const [form, setForm]       = useState({ display_name: '', email: '', current_password: '', new_password: '' });
  const [saving, setSaving]   = useState(false);
  const [msg, setMsg]         = useState('');
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [groqKey, setGroqKey] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [keyMsg, setKeyMsg]   = useState('');

  useEffect(() => {
    fetch(`${BACKEND_ORIGIN}/health`).then(r => r.json()).then(d => setBackendOk(d.status === 'healthy')).catch(() => setBackendOk(false));
    if (user) setForm(f => ({ ...f, display_name: user.display_name || '', email: user.email || '' }));
  }, [user]);

  const saveProfile = async () => {
    setSaving(true); setMsg('');
    try {
      await authApi.updateProfile({
        display_name:     form.display_name     || undefined,
        email:            form.email            || undefined,
        current_password: form.current_password || undefined,
        new_password:     form.new_password     || undefined,
      });
      const fresh = await authApi.me();
      setUser(fresh);
      setMsg('Saved!');
      setForm(f => ({ ...f, current_password: '', new_password: '' }));
    } catch (e: any) { setMsg(`Error: ${e.message || 'Failed'}`); }
    setSaving(false);
  };

  const saveGroqKey = async () => {
    if (!groqKey.trim()) return;
    setSavingKey(true); setKeyMsg('');
    try {
      await chatApi.setKey(groqKey.trim());
      setKeyMsg('Key saved');
      setGroqKey('');
    } catch { setKeyMsg('Save failed'); }
    setSavingKey(false);
  };

  return (
    <div className="space-y-4">

      {/* Appearance */}
      <div className="bg-card border border-default rounded-2xl p-4">
        <h3 className="text-base font-semibold text-heading mb-3">Appearance</h3>
        <div className="flex gap-2">
          {(['auto', 'dark', 'light'] as const).map(t => {
            const labels = { auto: 'Auto', dark: 'Dark', light: 'Light' };
            return (
              <button
                key={t}
                onClick={() => { if (theme !== t) toggleTheme(); }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all border ${
                  theme === t
                    ? 'bg-blue-600/10 border-blue-500/40 text-blue-600 dark:text-blue-400'
                    : 'border-default text-muted hover:text-body hover:bg-elevated'
                }`}
              >
                {labels[t]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Playback */}
      <div className="bg-card border border-default rounded-2xl p-4 space-y-4">
        <h3 className="text-base font-semibold text-heading">Playback</h3>

        <div className="flex items-center justify-between">
          <span className="text-sm text-body">Default speed</span>
          <div className="flex gap-1">
            {[0.75, 1, 1.25, 1.5].map(s => (
              <button
                key={s}
                onClick={() => setDefaultSpeed(s)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
                  defaultSpeed === s ? 'bg-blue-600 text-white' : 'bg-elevated text-body hover:bg-card'
                }`}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-body">Pause on word click</span>
          <button
            onClick={() => setAutoPauseOnWord(!autoPauseOnWord)}
            className={`w-10 h-5.5 rounded-full transition-colors relative ${autoPauseOnWord ? 'bg-blue-600' : 'bg-elevated'}`}
            style={{ height: 22, width: 40 }}
          >
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${autoPauseOnWord ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm text-body">Sound effects</span>
            <p className="text-sm text-muted">Flip, correct, wrong, save…</p>
          </div>
          <SfxToggle />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-body">Transcript font</span>
          <div className="flex gap-1">
            {(['sm', 'md', 'lg', 'xl'] as TranscriptFontSize[]).map(s => (
              <button
                key={s}
                onClick={() => setTranscriptFontSize(s)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  transcriptFontSize === s ? 'bg-blue-600 text-white' : 'bg-elevated text-body hover:bg-card'
                }`}
              >
                {s.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* AI */}
      <div className="bg-card border border-default rounded-2xl p-4 space-y-3">
        <h3 className="text-base font-semibold text-heading">AI Assistant</h3>
        <p className="text-xs text-muted leading-relaxed">
          Groq API key for the AI chat. Free at{' '}
          <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">
            console.groq.com/keys
          </a>
        </p>
        <div className="flex gap-2">
          <input
            type="password"
            value={groqKey}
            onChange={e => setGroqKey(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveGroqKey()}
            placeholder="gsk_..."
            className="input-field flex-1 py-2.5 text-sm"
          />
          <Button onClick={saveGroqKey} loading={savingKey} variant="primary" size="sm">Save</Button>
        </div>
        {keyMsg && <p className={`text-xs ${keyMsg === 'Key saved' ? 'text-green-400' : 'text-red-400'}`}>{keyMsg}</p>}
      </div>

      {/* Edit profile */}
      <div className="bg-card border border-default rounded-2xl p-4 space-y-3">
        <h3 className="text-base font-semibold text-heading">Edit Profile</h3>
        <Input label="Display Name" value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} />
        <Input label="Email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
        <Input label="Current Password" type="password" value={form.current_password} onChange={e => setForm(f => ({ ...f, current_password: e.target.value }))} placeholder="Only if changing password" />
        <Input label="New Password" type="password" value={form.new_password} onChange={e => setForm(f => ({ ...f, new_password: e.target.value }))} />
        {msg && <p className={`text-xs ${msg === 'Saved!' ? 'text-green-400' : 'text-red-400'}`}>{msg}</p>}
        <Button onClick={saveProfile} loading={saving} variant="primary" size="sm">Save Changes</Button>
      </div>

      {/* Voice Settings */}
      <VoiceSettings />

      {/* Notifications */}
      <NotificationSettings />

      {/* Backend status */}
      <div className="bg-card border border-default rounded-xl px-4 py-3 flex items-center justify-between">
        <span className="text-sm text-body">Backend status</span>
        <span className={`text-xs flex items-center gap-1.5 font-medium ${backendOk ? 'text-green-400' : 'text-red-400'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${backendOk ? 'bg-green-400' : 'bg-red-400'}`} />
          {backendOk === null ? 'Checking…' : backendOk ? 'Online' : 'Offline'}
        </span>
      </div>
    </div>
  );
}

/* ── Notification Settings ────────────────────────────────────────────────── */
/* ── SFX Toggle ──────────────────────────────────────────────────────────── */
function SfxToggle() {
  const [muted, setMutedState] = React.useState(false);
  React.useEffect(() => { setMutedState(isMuted()); }, []);
  const toggle = () => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  };
  return (
    <button
      onClick={toggle}
      style={{ height: 22, width: 40 }}
      className={`rounded-full transition-colors relative ${!muted ? 'bg-blue-600' : 'bg-elevated'}`}
    >
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${!muted ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );
}

function NotificationSettings() {
  const [enabled,    setEnabled]    = React.useState(false);
  const [streakWarn, setStreakWarn] = React.useState(true);
  const [time,       setTime]       = React.useState('09:00');
  const [permission, setPermission] = React.useState<string>('default');
  const [requesting, setRequesting] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    setEnabled(NotifSettings.isEnabled());
    setStreakWarn(NotifSettings.isStreakWarn());
    setTime(NotifSettings.getTime());
    setPermission(notificationPermission());
  }, []);

  const handleToggle = async () => {
    if (!enabled) {
      if (permission !== 'granted') {
        setRequesting(true);
        const granted = await requestNotificationPermission();
        setRequesting(false);
        setPermission(notificationPermission());
        if (!granted) return;
      }
      NotifSettings.setEnabled(true);
      setEnabled(true);
    } else {
      NotifSettings.setEnabled(false);
      setEnabled(false);
    }
  };

  const handleStreakToggle = () => {
    const next = !streakWarn;
    NotifSettings.setStreakWarn(next);
    setStreakWarn(next);
  };

  const handleTimeChange = (t: string) => {
    setTime(t);
    NotifSettings.setTime(t);
  };

  const isUnsupported = permission === 'unsupported';
  const isDenied      = permission === 'denied';

  return (
    <div className="bg-card border border-default rounded-2xl p-4 space-y-4">
      <h3 className="text-sm font-semibold text-heading flex items-center gap-1.5"><svg className="w-4 h-4 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>Notifications</h3>

      {isUnsupported && (
        <p className="text-xs text-muted bg-elevated rounded-xl p-3">
          Notifications are not supported in this browser.
        </p>
      )}

      {isDenied && (
        <p className="text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
          Notifications blocked. Enable them in your device settings.
        </p>
      )}

      {!isUnsupported && !isDenied && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-body">Daily review reminder</span>
              <p className="text-sm text-muted">Push notification when words are due</p>
            </div>
            <button
              onClick={handleToggle}
              disabled={requesting}
              style={{ height: 22, width: 40 }}
              className={`rounded-full transition-colors relative disabled:opacity-50 ${enabled ? 'bg-blue-600' : 'bg-elevated'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {enabled && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-body">Reminder time</span>
              <input
                type="time"
                value={time}
                onChange={e => handleTimeChange(e.target.value)}
                className="bg-elevated border border-default rounded-lg px-2 py-1 text-xs text-body outline-none focus:border-blue-500/50"
              />
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-body">Streak warning</span>
              <p className="text-sm text-muted">Alert if you haven't reviewed today</p>
            </div>
            <button
              onClick={handleStreakToggle}
              style={{ height: 22, width: 40 }}
              className={`rounded-full transition-colors relative ${streakWarn ? 'bg-orange-500' : 'bg-elevated'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${streakWarn ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Voice Settings ──────────────────────────────────────────────────────── */
function VoiceSettings() {
  const [selected,  setSelected]  = React.useState(getPreferredVoice);
  const [testing,   setTesting]   = React.useState<string | null>(null);

  const handleSelect = (id: string) => {
    setSelected(id);
    setPreferredVoice(id);
  };

  const handleTest = async (id: string) => {
    if (testing) return;
    setTesting(id);
    setPreferredVoice(id);
    setSelected(id);
    await ttsSpeak('Hello! This is how I sound.', { voice: id, rate: 1.0 });
    setTesting(null);
  };

  return (
    <div className="bg-card border border-default rounded-2xl p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-heading flex items-center gap-1.5"><svg className="w-4 h-4 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" opacity="0.9"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>Voice</h3>
        <p className="text-sm text-muted mt-0.5">
          Neural voices via Microsoft Edge TTS (free, requires internet)
        </p>
      </div>
      <div className="space-y-2">
        {NEURAL_VOICES.map(v => (
          <div
            key={v.id}
            className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
              selected === v.id
                ? 'border-blue-500/40 bg-blue-500/8'
                : 'border-default hover:border-blue-500/20 hover:bg-card'
            }`}
          >
            <button
              onClick={() => handleSelect(v.id)}
              className="flex items-center gap-3 flex-1 text-left"
            >
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                selected === v.id ? 'border-blue-500 bg-blue-500' : 'border-muted'
              }`}>
                {selected === v.id && (
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                )}
              </div>
              <div>
                <div className="text-base font-medium text-heading">{v.label}</div>
              </div>
            </button>
            <button
              onClick={() => handleTest(v.id)}
              disabled={!!testing}
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm transition-all ${
                testing === v.id
                  ? 'bg-blue-500/20 text-blue-400 animate-pulse'
                  : 'hover:bg-blue-500/10 text-muted hover:text-blue-500'
              } disabled:opacity-50`}
              title="Test this voice"
            >
              {testing === v.id ? (<svg className='w-3.5 h-3.5 animate-spin' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round'><path d='M21 12a9 9 0 1 1-6.219-8.56'/></svg>) : (<svg className='w-3.5 h-3.5' viewBox='0 0 24 24' fill='currentColor'><polygon points='5 3 19 12 5 21 5 3'/></svg>)}
            </button>
          </div>
        ))}
      </div>
      <p className="text-xs text-faint leading-relaxed">
        If neural voice is unavailable (offline), the app falls back to your device's built-in voice automatically.
      </p>
    </div>
  );
}
