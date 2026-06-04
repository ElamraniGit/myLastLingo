/**
 * App shell — Apple-style nav bar (mobile bottom) + sidebar (desktop).
 */
import React, { useEffect, useState } from 'react';
import { useStore } from '@/store/appStore';
import { useAuth } from '@/hooks/useAuth';
import { BACKEND_ORIGIN } from '@/lib/api';
import type { AppPage } from '@/types';
import XPBar from './XPBar';
import { getPendingCount } from '@/lib/offlineStore';

const NAV: { id: AppPage; label: string; icon: (active: boolean) => React.ReactNode }[] = [
  {
    id: 'player', label: 'Home',
    icon: (a) => (
      <svg viewBox="0 0 24 24" fill={a ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    id: 'library', label: 'Library',
    icon: (a) => (
      <svg viewBox="0 0 24 24" fill={a ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
  },
  {
    id: 'vocabulary', label: 'Words',
    icon: (a) => (
      <svg viewBox="0 0 24 24" fill={a ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    ),
  },
  {
    id: 'flashcards', label: 'Review',
    icon: (a) => (
      <svg viewBox="0 0 24 24" fill={a ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <rect x="2" y="5" width="20" height="14" rx="3" />
        <path d="M2 10h20" />
      </svg>
    ),
  },
  {
    id: 'chat', label: 'AI',
    icon: (a) => (
      <svg viewBox="0 0 24 24" fill={a ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { currentPage, setPage, user } = useStore();
  const { logout } = useAuth();

  return (
    <div className="flex h-screen bg-base overflow-hidden">

      {/* ── Desktop sidebar ───────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-60 bg-surface shrink-0 border-r border-default">
        {/* Logo */}
        <div className="px-5 py-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white text-sm font-bold flex items-center justify-center select-none shadow-sm">
              L
            </div>
            <div>
              <div className="font-semibold text-sm text-heading">LinguaLearn</div>
              <div className="text-[10px] text-muted">English Learning</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
          {NAV.map(item => {
            const active = currentPage === item.id ||
              (item.id === 'player' && currentPage === 'home');
            return (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  active
                    ? 'bg-blue-600/10 text-blue-600 dark:text-blue-400'
                    : 'text-body hover:bg-card hover:text-heading'
                }`}
              >
                <span className={active ? 'text-blue-600 dark:text-blue-400' : 'text-muted'}>
                  {item.icon(active)}
                </span>
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
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
              style={{ backgroundColor: user?.avatar_color || '#3b82f6' }}
            >
              {(user?.display_name || user?.username || 'U')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="text-sm font-medium text-heading truncate">{user?.display_name || user?.username}</div>
              <div className="text-[11px] text-muted">View profile</div>
            </div>
          </button>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 nav-bar shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-600 text-white text-xs font-bold flex items-center justify-center select-none">
              L
            </div>
            <span className="font-semibold text-sm text-heading">LinguaLearn</span>
            <NetworkDot />
          </div>
          <div className="flex items-center gap-3">
            <XPBar />
            <button
              onClick={() => setPage('profile')}
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-sm"
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

        {/* Mobile bottom nav — Apple style */}
        <nav className="lg:hidden nav-bar flex shrink-0 pb-safe">
          {NAV.map(item => {
            const active = currentPage === item.id ||
              (item.id === 'player' && currentPage === 'home');
            return (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                className={`flex-1 flex flex-col items-center gap-0.5 pt-2 pb-1 transition-all duration-150 ${
                  active ? 'text-blue-600 dark:text-blue-400' : 'text-muted'
                }`}
              >
                {item.icon(active)}
                <span className={`text-[10px] font-medium ${active ? 'text-blue-600 dark:text-blue-400' : 'text-muted'}`}>
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

/** Small dot for mobile nav — green=online, amber=offline */
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
    <span className="inline-flex items-center gap-1 text-[10px] text-amber-500 font-medium">
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
    ? '📵 Offline'
    : ok === null ? 'Connecting…'
    : ok ? 'Backend online'
    : 'Backend offline';

  const dotColor = !netOnline
    ? 'bg-amber-400'
    : ok === null ? 'bg-yellow-400 animate-pulse'
    : ok ? 'bg-green-400'
    : 'bg-red-400';

  return (
    <div className="flex items-center justify-between gap-2 px-1">
      <div className="flex items-center gap-2">
        <div className={`w-1.5 h-1.5 rounded-full transition-colors ${dotColor}`} />
        <span className="text-xs text-muted">{label}</span>
      </div>
      {pending > 0 && (
        <span className="text-[10px] bg-amber-500/15 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-semibold">
          {pending} pending
        </span>
      )}
    </div>
  );
}
