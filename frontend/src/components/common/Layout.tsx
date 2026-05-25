/**
 * App shell — bottom nav (mobile) + sidebar (desktop). English UI.
 */
import React, { useEffect } from 'react';
import { useStore } from '@/store/appStore';
import { useAuth } from '@/hooks/useAuth';
import type { AppPage } from '@/types';

const NAV: { id: AppPage; label: string; emoji: string }[] = [
  { id: 'player',     label: 'Learn',    emoji: '🎬' },
  { id: 'vocabulary', label: 'Words',    emoji: '📚' },
  { id: 'flashcards', label: 'Review',   emoji: '🔄' },
  { id: 'stats',      label: 'Progress', emoji: '📊' },
  { id: 'settings',   label: 'Settings', emoji: '⚙️' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { currentPage, setPage, theme, user } = useStore();
  const { logout } = useAuth();

  return (
    <div className={`flex h-screen overflow-hidden ${theme === 'dark' ? 'bg-slate-950' : 'bg-slate-100'}`}>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 bg-slate-900/80 border-r border-slate-800 flex-shrink-0">
        <div className="px-5 py-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white font-black text-base">L</span>
            </div>
            <div>
              <h1 className="font-bold text-white text-sm leading-none">LinguaLearn</h1>
              <p className="text-slate-500 text-xs mt-0.5">English Learning</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((item) => (
            <button key={item.id} onClick={() => setPage(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                currentPage === item.id
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}>
              <span className="text-base">{item.emoji}</span>{item.label}
            </button>
          ))}
        </nav>
        {user && (
          <div className="px-3 py-4 border-t border-slate-800">
            <button onClick={() => setPage('profile')}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800 transition-all group">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                style={{ backgroundColor: user.avatar_color }}>
                {(user.display_name || user.username)[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-slate-200 truncate">{user.display_name || user.username}</p>
                <p className="text-xs text-slate-500">@{user.username}</p>
              </div>
            </button>
            <button onClick={logout} className="w-full mt-1 px-3 py-2 rounded-xl text-xs text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all text-left">
              Sign out
            </button>
          </div>
        )}
        <div className="px-5 pb-4">
          <BackendStatus />
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-slate-900/80 border-b border-slate-800 backdrop-blur-sm flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-black text-xs">L</span>
            </div>
            <span className="font-bold text-white text-sm">LinguaLearn</span>
          </div>
          {user && (
            <button onClick={() => setPage('profile')}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-sm font-bold"
              style={{ backgroundColor: user.avatar_color }}>
              {(user.display_name || user.username)[0].toUpperCase()}
            </button>
          )}
        </header>

        <div className="flex-1 overflow-y-auto">{children}</div>

        {/* Mobile bottom nav */}
        <nav className="lg:hidden flex items-center bg-slate-900/95 border-t border-slate-800 px-1 pb-safe flex-shrink-0">
          {NAV.map((item) => (
            <button key={item.id} onClick={() => setPage(item.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-3 transition-all duration-200 ${
                currentPage === item.id ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'
              }`}>
              <span className="text-lg leading-none">{item.emoji}</span>
              <span className="text-xs font-medium leading-none mt-1">{item.label}</span>
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
    fetch('http://127.0.0.1:8080/health').then((r) => setOk(r.ok)).catch(() => setOk(false));
  }, []);
  return (
    <div className="flex items-center gap-2 text-xs text-slate-600">
      <span className={`w-2 h-2 rounded-full ${ok === null ? 'bg-yellow-500 animate-pulse' : ok ? 'bg-green-500' : 'bg-red-500'}`} />
      <span>{ok === null ? 'Connecting...' : ok ? 'Backend online' : 'Backend offline'}</span>
    </div>
  );
}
