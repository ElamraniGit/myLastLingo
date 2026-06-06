/**
 * App shell — refined navigation with larger text and cleaner hierarchy.
 */
import React, { useEffect, useState } from 'react';
import { useStore } from '@/store/appStore';
import { useAuth } from '@/hooks/useAuth';
import { BACKEND_ORIGIN } from '@/lib/api';
import type { AppPage } from '@/types';
import XPBar from './XPBar';
import { getPendingCount } from '@/lib/offlineStore';
import { AppLogo, HomeIcon, LibraryIcon, WordsIcon, ReviewIcon, AIIcon } from '@/components/ui/Icons';
import { isMuted, toggleMuted } from '@/lib/sfx';

const NAV: { id: AppPage; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'player',     label: 'Home',    Icon: HomeIcon    },
  { id: 'library',    label: 'Library', Icon: LibraryIcon },
  { id: 'vocabulary', label: 'Words',   Icon: WordsIcon   },
  { id: 'flashcards', label: 'Practice',Icon: ReviewIcon  },
  { id: 'chat',       label: 'AI',      Icon: AIIcon      },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { currentPage, setPage, user } = useStore();
  const { logout } = useAuth();

  return (
    <div className="flex h-screen bg-base overflow-hidden">

      {/* ── Desktop sidebar ───────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-64 bg-surface shrink-0 border-r border-default">
        {/* Logo */}
        <div className="px-5 py-7">
          <div className="flex items-center gap-3">
            <AppLogo size={38} className="select-none" />
            <div>
              <div className="font-bold text-base text-heading tracking-tight">LinguaLearn</div>
              <div className="text-xs text-muted mt-0.5">English Learning</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {NAV.map(item => {
            const active = currentPage === item.id ||
              (item.id === 'player' && currentPage === 'home') ||
              (item.id === 'flashcards' && currentPage === 'games');
            return (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-150 ${
                  active
                    ? 'bg-blue-600/12 text-blue-600 dark:text-blue-400'
                    : 'text-body hover:bg-card hover:text-heading'
                }`}
              >
                <item.Icon className={`w-5 h-5 shrink-0 ${active ? 'text-blue-600 dark:text-blue-400' : 'text-muted'}`} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* User + backend status */}
        <div className="p-4 border-t border-default space-y-3">
          <BackendStatus />
          <button
            onClick={() => setPage('profile')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-card transition-colors"
          >
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 shadow-sm"
              style={{ backgroundColor: user?.avatar_color || '#3b82f6' }}
            >
              {(user?.display_name || user?.username || 'U')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="text-sm font-semibold text-heading truncate">{user?.display_name || user?.username}</div>
              <div className="text-xs text-muted">View profile</div>
            </div>
          </button>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 nav-bar shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-2.5">
            <AppLogo size={32} className="select-none" />
            <NetworkDot />
          </div>
          <div className="flex items-center gap-2">
            <MuteButton />
            <XPBar />
            <button
              onClick={() => setPage('profile')}
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 shadow-sm"
              style={{ backgroundColor: user?.avatar_color || '#3b82f6' }}
            >
              {(user?.display_name || user?.username || 'U')[0].toUpperCase()}
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto scrollbar-none">
          {children}
        </main>

        {/* Mobile bottom nav — iOS style, larger touch targets */}
        <nav className="lg:hidden nav-bar flex shrink-0 pb-safe">
          {NAV.map(item => {
            const active = currentPage === item.id ||
              (item.id === 'player' && currentPage === 'home') ||
              (item.id === 'flashcards' && currentPage === 'games');
            return (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                className={`flex-1 flex flex-col items-center gap-1 pt-2.5 pb-1.5 transition-all duration-150 relative ${
                  active ? 'text-blue-600 dark:text-blue-400' : 'text-muted'
                }`}
              >
                {/* Active pill indicator */}
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-blue-500" />
                )}
                <item.Icon className={`w-6 h-6 transition-transform ${active ? 'scale-110' : 'scale-100'}`} />
                <span className="text-xs font-semibold tracking-tight">
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

/** Mute/Unmute sound effects button */
function MuteButton() {
  const [muted, setMuted] = React.useState(false);
  React.useEffect(() => { setMuted(isMuted()); }, []);
  const toggle = () => { const m = toggleMuted(); setMuted(m); };
  return (
    <button
      onClick={toggle}
      title={muted ? 'Unmute sounds' : 'Mute sounds'}
      className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-body hover:bg-card transition-colors"
    >
      {muted ? (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" opacity="0.5"/>
          <line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
        </svg>
      ) : (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
      )}
    </button>
  );
}

function NetworkDot() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setOnline(navigator.onLine);
    const on  = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online',  on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  if (online) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-amber-500 font-semibold">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
      Offline
    </span>
  );
}

function BackendStatus() {
  const [ok,      setOk]      = useState<boolean | null>(null);
  const [pending, setPending] = useState(0);
  const [netOnline, setNetOnline] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setNetOnline(navigator.onLine);
      const onOnline  = () => setNetOnline(true);
      const onOffline = () => setNetOnline(false);
      window.addEventListener('online',  onOnline);
      window.addEventListener('offline', onOffline);
      return () => {
        window.removeEventListener('online',  onOnline);
        window.removeEventListener('offline', onOffline);
      };
    }
  }, []);

  useEffect(() => {
    const check = () => {
      fetch(`${BACKEND_ORIGIN}/health`).then(r => setOk(r.ok)).catch(() => setOk(false));
    };
    check();
    const iv = setInterval(check, 30_000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const refresh = () => getPendingCount().then(setPending).catch(() => {});
    refresh();
    const iv = setInterval(refresh, 10_000);
    return () => clearInterval(iv);
  }, []);

  const label = !netOnline
    ? 'Offline'
    : ok === null ? 'Connecting…'
    : ok ? 'Online'
    : 'Server offline';

  const dotColor = !netOnline
    ? 'bg-amber-400'
    : ok === null ? 'bg-yellow-400 animate-pulse'
    : ok ? 'bg-green-400'
    : 'bg-red-400';

  return (
    <div className="flex items-center justify-between gap-2 px-1">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full transition-colors ${dotColor}`} />
        <span className="text-xs text-muted">{label}</span>
      </div>
      {pending > 0 && (
        <span className="text-xs bg-amber-500/12 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full font-semibold">
          {pending} pending
        </span>
      )}
    </div>
  );
}
