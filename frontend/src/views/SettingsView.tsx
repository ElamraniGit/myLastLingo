/**
 * Settings view — theme, speed, quality, font size, account, server status.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '@/store/appStore';
import { useAuth } from '@/hooks/useAuth';
import { authApi, BACKEND_ORIGIN } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { TranscriptFontSize, VideoQuality } from '@/types';

const QUALITY_OPTIONS: { value: VideoQuality; label: string; hint: string }[] = [
  { value: 'auto', label: 'Auto', hint: 'Let YouTube choose automatically' },
  { value: 'medium', label: '360p', hint: 'Balanced for most phones' },
  { value: 'large', label: '480p', hint: 'Better clarity, moderate data use' },
  { value: 'hd720', label: '720p', hint: 'HD quality on supported videos' },
  { value: 'hd1080', label: '1080p', hint: 'High quality when available' },
];

const FONT_OPTIONS: { value: TranscriptFontSize; label: string; preview: string }[] = [
  { value: 'sm', label: 'Small', preview: 'A' },
  { value: 'md', label: 'Medium', preview: 'A' },
  { value: 'lg', label: 'Large', preview: 'A' },
  { value: 'xl', label: 'Extra Large', preview: 'A' },
];

export default function SettingsView() {
  const {
    theme, toggleTheme,
    defaultSpeed, setDefaultSpeed,
    defaultVideoQuality, setDefaultVideoQuality,
    transcriptFontSize, setTranscriptFontSize,
    autoPauseOnWord, setAutoPauseOnWord,
    user, setUser,
  } = useStore();
  const { logout } = useAuth();

  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [profileForm, setProfileForm] = useState({ display_name: '', email: '', current_password: '', new_password: '' });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const backendLabel = useMemo(
    () => BACKEND_ORIGIN.replace(/^https?:\/\//, ''),
    []
  );

  useEffect(() => {
    fetch(`${BACKEND_ORIGIN}/health`)
      .then((r) => r.json())
      .then((d) => { setBackendOk(d.status === 'healthy'); })
      .catch(() => setBackendOk(false));

    if (user) {
      setProfileForm((f) => ({ ...f, display_name: user.display_name || '', email: user.email || '' }));
    }
  }, [user]);

  const saveProfile = async () => {
    setSaving(true);
    setSaveMsg('');
    try {
      await authApi.updateProfile({
        display_name: profileForm.display_name || undefined,
        email: profileForm.email || undefined,
        current_password: profileForm.current_password || undefined,
        new_password: profileForm.new_password || undefined,
      });
      const freshUser = await authApi.me();
      setUser(freshUser);
      setSaveMsg('Profile updated!');
      setProfileForm((f) => ({
        ...f,
        display_name: freshUser.display_name || '',
        email: freshUser.email || '',
        current_password: '',
        new_password: '',
      }));
    } catch (e: any) {
      setSaveMsg(e.message || 'Update failed');
    }
    setSaving(false);
  };

  const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-heading">Settings</h1>
        <p className="text-body text-sm mt-0.5">Customize your learning experience</p>
      </div>

      {/* Profile */}
      {user && (
        <div className="bg-card/60 border border-line/50 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-line/50 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-heading font-bold"
              style={{ backgroundColor: user.avatar_color }}>
              {(user.display_name || user.username)[0].toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-heading">{user.display_name || user.username}</p>
              <p className="text-xs text-muted">@{user.username}</p>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <Input
              label="Display Name"
              value={profileForm.display_name}
              onChange={(e) => setProfileForm((f) => ({ ...f, display_name: e.target.value }))}
              placeholder="Your display name"
            />
            <Input
              label="Email"
              type="email"
              value={profileForm.email}
              onChange={(e) => setProfileForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="your@email.com"
            />
            <div className="border-t border-line/50 pt-4">
              <p className="text-xs text-muted mb-3">Change Password (optional)</p>
              <div className="space-y-3">
                <Input
                  label="Current Password"
                  type="password"
                  value={profileForm.current_password}
                  onChange={(e) => setProfileForm((f) => ({ ...f, current_password: e.target.value }))}
                  placeholder="••••••"
                />
                <Input
                  label="New Password"
                  type="password"
                  value={profileForm.new_password}
                  onChange={(e) => setProfileForm((f) => ({ ...f, new_password: e.target.value }))}
                  placeholder="••••••"
                />
              </div>
            </div>
            {saveMsg && (
              <p className={`text-sm ${saveMsg.includes('!') ? 'text-green-400' : 'text-red-400'}`}>{saveMsg}</p>
            )}
            <Button onClick={saveProfile} loading={saving} variant="primary" size="sm">
              Save Profile
            </Button>
          </div>
        </div>
      )}

      {/* Playback settings */}
      <div className="bg-card/60 border border-line/50 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-line/50">
          <h3 className="font-semibold text-heading">🎬 Playback</h3>
        </div>
        <div className="divide-y divide-slate-700/30">
          <div className="flex items-center justify-between px-5 py-4 gap-4">
            <div>
              <p className="text-sm font-medium text-body">Default Speed</p>
              <p className="text-xs text-muted">Playback speed for new videos</p>
            </div>
            <div className="flex gap-1 flex-wrap justify-end">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => setDefaultSpeed(s)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
                    defaultSpeed === s ? 'bg-blue-600 text-heading' : 'bg-elevated text-body hover:bg-slate-600'
                  }`}
                >
                  {s}×
                </button>
              ))}
            </div>
          </div>

          <div className="px-5 py-4 space-y-3">
            <div>
              <p className="text-sm font-medium text-body">Default Video Quality</p>
              <p className="text-xs text-muted">Used when a new YouTube video starts</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {QUALITY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setDefaultVideoQuality(option.value)}
                  className={`text-left px-3 py-3 rounded-xl border transition-all ${
                    defaultVideoQuality === option.value
                      ? 'bg-blue-600/15 border-blue-500/40 text-blue-300'
                      : 'bg-surface/40 border-line text-body hover:border-line'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{option.label}</span>
                    {defaultVideoQuality === option.value && <span className="text-xs">✓</span>}
                  </div>
                  <p className="text-xs text-muted mt-1">{option.hint}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-sm font-medium text-body">Auto-pause on word click</p>
              <p className="text-xs text-muted">Pause video when you tap a word</p>
            </div>
            <button
              onClick={() => setAutoPauseOnWord(!autoPauseOnWord)}
              className={`relative w-12 h-6 rounded-full transition-colors ${autoPauseOnWord ? 'bg-blue-600' : 'bg-slate-600'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${autoPauseOnWord ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Appearance */}
      <div className="bg-card/60 border border-line/50 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-line/50">
          <h3 className="font-semibold text-heading">🎨 Appearance</h3>
        </div>
        <div className="divide-y divide-slate-700/30">
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-sm font-medium text-body">Dark Mode</p>
              <p className="text-xs text-muted">Current: {theme} mode</p>
            </div>
            <button
              onClick={toggleTheme}
              className={`relative w-12 h-6 rounded-full transition-colors ${theme === 'dark' ? 'bg-blue-600' : 'bg-slate-600'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${theme === 'dark' ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>

          <div className="px-5 py-4 space-y-3">
            <div>
              <p className="text-sm font-medium text-body">Subtitle Text Size</p>
              <p className="text-xs text-muted">Changes the subtitle/transcript reading size</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {FONT_OPTIONS.map((option) => {
                const sizeClass = option.value === 'sm'
                  ? 'text-base'
                  : option.value === 'md'
                  ? 'text-lg'
                  : option.value === 'lg'
                  ? 'text-xl'
                  : 'text-2xl';

                return (
                  <button
                    key={option.value}
                    onClick={() => setTranscriptFontSize(option.value)}
                    className={`rounded-xl border px-3 py-3 transition-all ${
                      transcriptFontSize === option.value
                        ? 'bg-blue-600/15 border-blue-500/40 text-blue-300'
                        : 'bg-surface/40 border-line text-body hover:border-line'
                    }`}
                  >
                    <div className={`font-semibold ${sizeClass}`}>{option.preview}</div>
                    <div className="text-xs mt-1">{option.label}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Backend status */}
      <div className="bg-card/60 border border-line/50 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-line/50">
          <h3 className="font-semibold text-heading">🖥 Backend</h3>
        </div>
        <div className="px-5 py-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-body">Status</span>
            <span className={`text-sm font-medium flex items-center gap-1.5 ${backendOk ? 'text-green-400' : 'text-red-400'}`}>
              <span className={`w-2 h-2 rounded-full ${backendOk ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              {backendOk === null ? 'Checking…' : backendOk ? 'Online' : 'Offline'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-body">API</span>
            <span className="text-xs text-muted font-mono">{backendLabel}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-body">Mode</span>
            <span className="text-xs text-green-400">100% Local</span>
          </div>
        </div>
      </div>

      {/* About */}
      <div className="bg-card/60 border border-line/50 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-line/50">
          <h3 className="font-semibold text-heading">ℹ️ About</h3>
        </div>
        <div className="px-5 py-4 space-y-2">
          {[
            ['App', 'LinguaLearn v2.1'],
            ['Mode', 'Local-first, no cloud'],
            ['Platform', 'Android / Termux / Desktop'],
            ['Privacy', '100% private, no data sent'],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between">
              <span className="text-sm text-body">{k}</span>
              <span className="text-sm text-body">{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Danger zone */}
      <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-red-400 mb-3">Danger Zone</h3>
        <Button onClick={logout} variant="danger" size="sm">
          Sign Out
        </Button>
      </div>
    </div>
  );
}
