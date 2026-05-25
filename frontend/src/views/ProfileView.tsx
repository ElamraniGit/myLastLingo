/**
 * User profile view.
 */

import React from 'react';
import { useStore } from '@/store/appStore';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { LevelBadge } from '@/components/ui/Badge';

export default function ProfileView() {
  const { user, progress, recentVideos, setPage } = useStore();
  const { logout } = useAuth();

  if (!user) return null;

  const initial = (user.display_name || user.username)[0].toUpperCase();

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
      {/* Avatar + name */}
      <div className="flex flex-col items-center text-center">
        <div
          className="w-24 h-24 rounded-3xl flex items-center justify-center text-4xl font-black text-white shadow-2xl mb-4"
          style={{ backgroundColor: user.avatar_color }}
        >
          {initial}
        </div>
        <h1 className="text-2xl font-bold text-white">{user.display_name || user.username}</h1>
        <p className="text-slate-500 text-sm">@{user.username}</p>
        {user.email && <p className="text-slate-600 text-xs mt-0.5">{user.email}</p>}

        {(user.streak_days ?? 0) > 0 && (
          <div className="flex items-center gap-1.5 mt-3 px-3 py-1.5 bg-orange-500/15 border border-orange-500/25 rounded-full">
            <span>🔥</span>
            <span className="text-sm font-semibold text-orange-400">{user.streak_days} day streak</span>
          </div>
        )}
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Saved', value: progress?.total ?? 0, color: 'text-blue-400' },
          { label: 'Learned', value: progress?.learned ?? 0, color: 'text-green-400' },
          { label: 'Videos', value: recentVideos.length, color: 'text-purple-400' },
        ].map((s) => (
          <div key={s.label} className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Member since */}
      {user.created_at && (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl px-5 py-4 flex items-center justify-between">
          <p className="text-sm text-slate-400">Member since</p>
          <p className="text-sm text-slate-300">
            {new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-3">
        <Button onClick={() => setPage('settings')} variant="secondary" className="w-full">
          ⚙️  Edit Profile & Settings
        </Button>
        <Button onClick={logout} variant="danger" className="w-full">
          Sign Out
        </Button>
      </div>
    </div>
  );
}
