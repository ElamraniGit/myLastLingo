/**
 * App shell — bottom nav (mobile) + sidebar (desktop).
 * Nav: Home, Library, Words, Review (4 items only).
 * User avatar → opens profile/settings/progress page.
 */
import React, { useEffect } from 'react';
import { useStore } from '@/store/appStore';
import { useAuth } from '@/hooks/useAuth';
import { BACKEND_ORIGIN } from '@/lib/api';
import type { AppPage } from '@/types';

/* ── SVG Icons (clean, modern, inline) ──────────────────────────── */
const Icons = {
  home: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  library: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  ),
  words: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  ),
  review: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" /><path d="M10 9l5 3-5 3V9z" />
    </svg>
  ),
};

const NAV: { id: AppPage; label: string; icon: React.ReactNode }[] = [
  { id: 'player',     label: 'Home',    icon: Icons.home },
  { id: 'library',    label: 'Library',  icon: Icons.library },
  { id: 'vocabulary', label: 'Words',    icon: Icons.words },
  { id: 'flashcards', label: 'Review',   icon: Icons.review },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { currentPage, setPage, theme, user } = useStore();
  const { logout } = useAuth();

  return (
    <div className="flex h-screen overflow-hidden bg-base">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 bg-surface/80 border-r border-line-s flex-shrink-0">
        <div className="px-5 py-5 border-b border-line-s">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-heading font-black text-base">L</span>
            </div>
            <div>
              <h1 className="font-bold text-heading text-sm leading-none">LinguaLearn</h1>
              <p className="text-muted text-[11px] mt-0.5">English Learning</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((item) => (
            <button key={item.id} onClick={() => setPage(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                currentPage === item.id
                  ? 'bg-blue-600/15 text-blue-400'
                  : 'text-body hover:text-heading hover:bg-card'
              }`}>
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
        {user && (
          <div className="px-3 py-4 border-t border-line-s">
            <button onClick={() => setPage('profile')}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-card transition-colors">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-heading text-sm font-bold flex-shrink-0"
                style={{ backgroundColor: user.avatar_color }}>
                {(user.display_name || user.username)[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-heading truncate">{user.display_name || user.username}</p>
                <p className="text-[11px] text-muted">@{user.username}</p>
              </div>
            </button>
          </div>
        )}
        <div className="px-5 pb-4"><BackendStatus /></div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-surface/90 border-b border-line-s backdrop-blur-sm flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-heading font-black text-xs">L</span>
            </div>
            <span className="font-bold text-heading text-sm">LinguaLearn</span>
          </div>
          {user && (
            <button onClick={() => setPage('profile')}
              className="w-8 h-8 rounded-full flex items-center justify-center text-heading text-sm font-bold shadow-md"
              style={{ backgroundColor: user.avatar_color }}>
              {(user.display_name || user.username)[0].toUpperCase()}
            </button>
          )}
        </header>

        <div className="flex-1 overflow-y-auto">{children}</div>

        {/* Mobile bottom nav — 4 items only */}
        <nav className="lg:hidden flex items-center bg-surface/95 border-t border-line-s px-2 pb-safe flex-shrink-0">
          {NAV.map((item) => (
            <button key={item.id} onClick={() => setPage(item.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 transition-colors ${
                currentPage === item.id ? 'text-blue-400' : 'text-muted'
              }`}>
              {item.icon}
              <span className="text-[10px] font-medium leading-none">{item.label}</span>
            </button>
          ))}
        </nav>
      </main>
    </div>
  );
}

function BackendStatus() {
  const [ok, setOk] = React.useState<boolean | null>(null);
  useEffect(() => {
    fetch(`${BACKEND_ORIGIN}/health`).then(r => setOk(r.ok)).catch(() => setOk(false));
  }, []);
  return (
    <div className="flex items-center gap-2 text-[11px] text-faint">
      <span className={`w-1.5 h-1.5 rounded-full ${ok === null ? 'bg-yellow-500 animate-pulse' : ok ? 'bg-green-500' : 'bg-red-500'}`} />
      <span>{ok === null ? 'Connecting…' : ok ? 'Online' : 'Offline'}</span>
    </div>
  );
}
