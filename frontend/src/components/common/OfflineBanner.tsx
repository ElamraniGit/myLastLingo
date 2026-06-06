/**
 * OfflineBanner — شريط يُظهر حالة الاتصال + زر sync يدوي + عداد pending.
 */
import React, { useEffect, useState } from 'react';
import { useOffline } from '@/hooks/useOffline';

export default function OfflineBanner() {
  const { isOnline, isSyncing, pendingCount, lastSyncTime, syncNow } = useOffline();
  const [visible, setVisible] = useState(false);
  const [justCameBack, setJustCameBack] = useState(false);

  // Show banner when offline, or briefly when just came back online with pending
  useEffect(() => {
    if (!isOnline) {
      setVisible(true);
      setJustCameBack(false);
    } else if (pendingCount > 0 || isSyncing) {
      setVisible(true);
      setJustCameBack(true);
    } else {
      // Hide after 3s when fully synced
      const t = setTimeout(() => { setVisible(false); setJustCameBack(false); }, 3000);
      return () => clearTimeout(t);
    }
  }, [isOnline, pendingCount, isSyncing]);

  if (!visible) return null;

  // ── Offline ──────────────────────────────────────────────────────────────
  if (!isOnline) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-2.5
                      bg-amber-500 text-white text-xs font-semibold shadow-lg animate-fade-in">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.56 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="1" fill="currentColor" stroke="none"/></svg>
          <span>Offline mode — changes saved locally</span>
        </div>
        {pendingCount > 0 && (
          <span className="bg-white/20 px-2 py-0.5 rounded-full text-[11px]">
            {pendingCount} pending
          </span>
        )}
      </div>
    );
  }

  // ── Syncing ──────────────────────────────────────────────────────────────
  if (isSyncing) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-2.5
                      bg-blue-600 text-white text-xs font-semibold shadow-lg animate-fade-in">
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          <span>Syncing {pendingCount > 0 ? `${pendingCount} changes` : ''}…</span>
        </div>
      </div>
    );
  }

  // ── Back online with pending ─────────────────────────────────────────────
  if (justCameBack && pendingCount > 0) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-2.5
                      bg-blue-600 text-white text-xs font-semibold shadow-lg animate-fade-in">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
          <span>Back online — {pendingCount} changes to sync</span>
        </div>
        <button
          onClick={() => syncNow()}
          className="bg-white/20 hover:bg-white/30 px-2.5 py-1 rounded-lg text-[11px] transition-colors"
        >
          Sync now
        </button>
      </div>
    );
  }

  // ── All synced ───────────────────────────────────────────────────────────
  if (justCameBack) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center px-4 py-2.5
                      bg-green-600 text-white text-xs font-semibold shadow-lg animate-fade-in">
        <svg className="w-4 h-4 shrink-0 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
        <span>
          All synced
          {lastSyncTime && ` · ${lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
        </span>
      </div>
    );
  }

  return null;
}
