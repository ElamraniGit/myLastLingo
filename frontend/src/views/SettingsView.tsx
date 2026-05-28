/**
 * Settings view — theme, speed, auto-pause, account, server status.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '@/store/appStore';
import { useAuth } from '@/hooks/useAuth';
import { authApi, BACKEND_ORIGIN } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function SettingsView() {
  const {
    theme, toggleTheme,
    defaultSpeed, setDefaultSpeed,
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
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-slate-400 text-sm mt-0.5">Customize your learning experience</p>
      </div>

      {/* Profile */}
      {user && (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700/50 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold"
              style={{ backgroundColor: user.avatar_color }}>
              {(user.display_name || user.username)[0].toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-white">{user.display_name || user.username}</p>
              <p className="text-xs text-slate-500">@{user.username}</p>
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
            <div className="border-t border-slate-700/50 pt-4">
              <p className="text-xs text-slate-500 mb-3">Change Password (optional)</p>
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
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700/50">
          <h3 className="font-semibold text-slate-200">🎬 Playback</h3>
        </div>
        <div className="divide-y divide-slate-700/30">
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-sm font-medium text-slate-300">Default Speed</p>
              <p className="text-xs text-slate-500">Playback speed for new videos</p>
            </div>
            <div className="flex gap-1">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => setDefaultSpeed(s)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
                    defaultSpeed === s ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                  }`}
                >
                  {s}×
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-sm font-medium text-slate-300">Auto-pause on word click</p>
              <p className="text-xs text-slate-500">Pause video when you tap a word</p>
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
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700/50">
          <h3 className="font-semibold text-slate-200">🎨 Appearance</h3>
        </div>
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <p className="text-sm font-medium text-slate-300">Dark Mode</p>
            <p className="text-xs text-slate-500">Current: {theme} mode</p>
          </div>
          <button
            onClick={toggleTheme}
            className={`relative w-12 h-6 rounded-full transition-colors ${theme === 'dark' ? 'bg-blue-600' : 'bg-slate-600'}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${theme === 'dark' ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </button>
        </div>
      </div>

      {/* Backend status */}
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700/50">
          <h3 className="font-semibold text-slate-200">🖥 Backend</h3>
        </div>
        <div className="px-5 py-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Status</span>
            <span className={`text-sm font-medium flex items-center gap-1.5 ${backendOk ? 'text-green-400' : 'text-red-400'}`}>
              <span className={`w-2 h-2 rounded-full ${backendOk ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              {backendOk === null ? 'Checking…' : backendOk ? 'Online' : 'Offline'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">API</span>
            <span className="text-xs text-slate-500 font-mono">{backendLabel}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Mode</span>
            <span className="text-xs text-green-400">100% Local</span>
          </div>
        </div>
      </div>

      {/* About */}
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700/50">
          <h3 className="font-semibold text-slate-200">ℹ️ About</h3>
        </div>
        <div className="px-5 py-4 space-y-2">
          {[
            ['App', 'LinguaLearn v2.0'],
            ['Mode', 'Local-first, no cloud'],
            ['Platform', 'Android / Termux / Desktop'],
            ['Privacy', '100% private, no data sent'],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between">
              <span className="text-sm text-slate-400">{k}</span>
              <span className="text-sm text-slate-300">{v}</span>
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
