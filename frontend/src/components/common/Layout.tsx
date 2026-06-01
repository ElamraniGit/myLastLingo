/**
 * App shell — bottom nav (mobile) + sidebar (desktop).
 * Nav: Home, Library, Words, Review, AI (5 items).
 * User avatar → opens profile/settings/progress page.
 *
 * FIX BUG-15: BackendStatus now re-checks every 30s instead of once on mount.
 */
import React, { useEffect, useState } from 'react';
import { useStore } from '@/store/appStore';
import { useAuth } from '@/hooks/useAuth';
import { BACKEND_ORIGIN } from '@/lib/api';
import type { AppPage } from '@/types';
import XPBar from './XPBar';

/* ── SVG Icons (clean, modern, inline) ──────────────────────────── */
const Icons = {
  home: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  library: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  ),
  words: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  ),
  review: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  ),
  chat: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
};

const NAV: { id: AppPage; label: string; icon: React.ReactNode }[] = [
  { id: 'player',     label: 'Home',    icon: Icons.home    },
  { id: 'library',    label: 'Library', icon: Icons.library },
  { id: 'vocabulary', label: 'Words',   icon: Icons.words   },
  { id: 'flashcards', label: 'Review',  icon: Icons.review  },
  { id: 'chat',       label: 'AI',      icon: Icons.chat    },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { currentPage, setPage, theme, user } = useStore();
  const { logout } = useAuth();

  return (
    <div className="flex h-screen bg-base text-heading overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 bg-surface border-r border-default shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-default">
          <div className="w-8 h-8 rounded-xl bg-blue-600 text-white text-sm font-bold flex items-center justify-center select-none">
            L
          </div>
          <span className="font-semibold text-sm text-heading">LinguaLearn</span>
        </div>

        {/* Nav items */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                currentPage === item.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-body hover:bg-card hover:text-heading'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        {/* Backend status */}
        <div className="p-3 border-t border-default">
          <BackendStatus />
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-surface border-b border-default shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
              L
            </div>
            <span className="font-semibold text-sm">LinguaLearn</span>
          </div>
          <div className="flex items-center gap-3">
            <XPBar />
            <button
              onClick={() => setPage('profile')}
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
              style={{ backgroundColor: user?.avatar_color || '#3b82f6' }}
            >
              {(user?.display_name || user?.username || 'U')[0].toUpperCase()}
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden flex border-t border-default bg-surface shrink-0 pb-safe">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors ${
                currentPage === item.id
                  ? 'text-blue-500'
                  : 'text-muted'
              }`}
            >
              <span className={currentPage === item.id ? 'text-blue-500' : 'text-muted'}>
                {item.icon}
              </span>
              {item.label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

// FIX BUG-15: BackendStatus now polls every 30s instead of only checking once on mount
function BackendStatus() {
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    const check = () => {
      fetch(`${BACKEND_ORIGIN}/health`)
        .then(r => setOk(r.ok))
        .catch(() => setOk(false));
    };

    check(); // immediate check on mount

    // FIX BUG-15: Re-check every 30 seconds
    const iv = setInterval(check, 30_000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="flex items-center gap-2 text-xs text-muted px-1">
      <div className={`w-1.5 h-1.5 rounded-full ${
        ok === null ? 'bg-yellow-400 animate-pulse' :
        ok ? 'bg-green-400' : 'bg-red-400'
      }`} />
      <span>
        {ok === null ? 'Connecting…' : ok ? 'Online' : 'Offline'}
      </span>
    </div>
  );
}
