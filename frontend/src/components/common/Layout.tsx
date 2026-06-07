/**
 * App Shell — clean sidebar (desktop) + bottom nav (mobile).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '@/store/appStore';
import { useAuth } from '@/hooks/useAuth';
import { BACKEND_ORIGIN } from '@/lib/api';
import type { AppPage } from '@/types';
import XPBar from './XPBar';
import { getPendingCount } from '@/lib/offlineStore';
import {
  AppLogo, HomeIcon, LibraryIcon, WordsIcon, ReviewIcon, AIIcon,
} from '@/components/ui/Icons';
import { isMuted, toggleMuted } from '@/lib/sfx';

const NAV: { id: AppPage; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'player',     label: 'Home',     Icon: HomeIcon    },
  { id: 'library',    label: 'Library',  Icon: LibraryIcon },
  { id: 'vocabulary', label: 'Words',    Icon: WordsIcon   },
  { id: 'flashcards', label: 'Practice', Icon: ReviewIcon  },
  { id: 'chat',       label: 'AI',       Icon: AIIcon      },
];

function isActive(itemId: AppPage, currentPage: AppPage): boolean {
  if (itemId === currentPage) return true;
  if (itemId === 'player' && currentPage === 'home') return true;
  if (itemId === 'flashcards' && currentPage === 'games') return true;
  return false;
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { currentPage, setPage, user } = useStore();

  return (
    <div className="flex h-screen bg-base overflow-clip">

      {/* ── Desktop sidebar ─────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-56 bg-surface border-r border-default shrink-0">

        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-5 border-b border-subtle">
          <AppLogo size={30} className="shrink-0" />
          <div>
            <p className="text-sm font-bold text-heading leading-none tracking-tight">LinguaLearn</p>
            <p className="text-xs text-muted mt-0.5">English learning</p>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {NAV.map(item => {
            const active = isActive(item.id, currentPage);
            return (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-2xl text-sm font-medium
                            transition-all duration-150 ${
                  active
                    ? 'bg-accent-soft text-accent shadow-card'
                    : 'text-body hover:bg-card hover:text-heading'
                }`}
              >
                <item.Icon className={`w-[18px] h-[18px] shrink-0 ${active ? 'text-accent' : 'text-muted'}`} />
                <span className="flex-1 text-left">{item.label}</span>
                {active && <span className="w-1.5 h-1.5 rounded-full bg-accent" />}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-subtle space-y-2">
          <BackendStatus />
          <button
            onClick={() => setPage('profile')}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-card transition-colors"
          >
            <Avatar user={user} size={7} />
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium text-heading truncate leading-none">
                {user?.display_name || user?.username}
              </p>
              <p className="text-xs text-muted mt-0.5">Profile</p>
            </div>
          </button>
        </div>
      </aside>

      {/* ── Main area ───────────────────────────────────────── */}
      {/* NOTE: no overflow-hidden here — would create a containing block
          that breaks fixed-position children (WordPopup, modals) */}
      <div className="flex-1 flex flex-col min-w-0 overflow-clip">

        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center justify-between
                            px-4 py-3 shrink-0 bg-base/90 backdrop-blur border-b border-subtle z-30">
          <div className="flex items-center gap-2">
            <AppLogo size={26} />
            <NetworkBadge />
          </div>
          <div className="flex items-center gap-1.5">
            <MuteBtn />
            <XPBar />
            <button onClick={() => setPage('profile')}>
              <Avatar user={user} size={7} />
            </button>
          </div>
        </header>

        {/* Page */}
        <main className="flex-1 overflow-y-auto scrollbar-none">{children}</main>

        {/* Mobile bottom nav */}
        <nav className="lg:hidden nav-bar flex shrink-0 pb-safe">
          {NAV.map(item => {
            const active = isActive(item.id, currentPage);
            return (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5
                            pt-2 pb-1 transition-colors relative ${
                  active ? 'text-accent' : 'text-muted'
                }`}
              >
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2
                                   w-8 h-[3px] rounded-full bg-accent shadow-card" />
                )}
                <span className={`flex items-center justify-center w-10 h-10 rounded-2xl transition-all ${active ? 'bg-accent-soft' : 'bg-transparent'}`}>
                  <item.Icon className={`w-[22px] h-[22px] transition-transform ${active ? 'scale-105' : 'scale-100'}`} />
                </span>
                <span className="text-[11px] font-semibold tracking-tight">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

/* ── Avatar ─────────────────────────────────────────────────────── */
function Avatar({ user, size }: { user: any; size: number }) {
  const initials = (user?.display_name || user?.username || 'U')[0].toUpperCase();
  const dimension = useMemo(() => {
    const pxMap: Record<number, number> = { 7: 28, 8: 32, 9: 36 };
    return pxMap[size] ?? size * 4;
  }, [size]);

  if (user?.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt={user?.display_name || user?.username || 'User avatar'}
        className="rounded-full object-cover shrink-0 border border-default"
        style={{ width: dimension, height: dimension }}
      />
    );
  }

  return (
    <div
      className="rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 border border-default"
      style={{ width: dimension, height: dimension, backgroundColor: user?.avatar_color || '#2563eb' }}
    >
      {initials}
    </div>
  );
}

/* ── Mute button ─────────────────────────────────────────────────── */
function MuteBtn() {
  const [muted, setMuted] = React.useState(false);
  React.useEffect(() => { setMuted(isMuted()); }, []);
  return (
    <button
      onClick={() => setMuted(toggleMuted())}
      className="w-7 h-7 rounded-lg flex items-center justify-center text-muted hover:text-body hover:bg-card transition-colors"
    >
      {muted ? (
        <svg className="w-[15px] h-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" opacity="0.45"/>
          <line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
        </svg>
      ) : (
        <svg className="w-[15px] h-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
      )}
    </button>
  );
}

/* ── Offline indicator ───────────────────────────────────────────── */
function NetworkBadge() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  if (online) return null;
  return (
    <span className="flex items-center gap-1 text-xs text-warn font-semibold">
      <span className="w-1.5 h-1.5 rounded-full bg-warn animate-pulse" />
      Offline
    </span>
  );
}

/* ── Backend status (sidebar only) ──────────────────────────────── */
function BackendStatus() {
  const [ok, setOk] = useState<boolean | null>(null);
  const [pending, setPending] = useState(0);
  const [net, setNet] = useState(true);

  useEffect(() => {
    setNet(navigator.onLine);
    const on = () => setNet(true), off = () => setNet(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  useEffect(() => {
    const check = () => fetch(`${BACKEND_ORIGIN}/health`).then(r => setOk(r.ok)).catch(() => setOk(false));
    check(); const iv = setInterval(check, 30_000); return () => clearInterval(iv);
  }, []);
  useEffect(() => {
    const refresh = () => getPendingCount().then(setPending).catch(() => {});
    refresh(); const iv = setInterval(refresh, 10_000); return () => clearInterval(iv);
  }, []);

  const dot = !net ? 'bg-warn' : ok === null ? 'bg-warn animate-pulse' : ok ? 'bg-success' : 'bg-danger';
  const label = !net ? 'Offline' : ok === null ? 'Connecting…' : ok ? 'Connected' : 'Server down';

  return (
    <div className="flex items-center justify-between px-1">
      <div className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
        <span className="text-xs text-muted">{label}</span>
      </div>
      {pending > 0 && (
        <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold text-warn" style={{ backgroundColor: 'rgb(var(--warn) / 0.12)' }}>
          {pending}
        </span>
      )}
    </div>
  );
}
