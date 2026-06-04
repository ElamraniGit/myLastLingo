/**
 * useOffline.ts — Network state monitor + automatic sync on reconnection.
 *
 * Features:
 *  - مراقبة online/offline في الوقت الفعلي
 *  - sync تلقائي عند العودة للاتصال
 *  - عرض عدد العمليات المعلقة
 *  - منع sync مزدوج (mutex)
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useStore } from '@/store/appStore';
import { vocabularyApi } from '@/lib/api';
import {
  getPendingReviews,
  getPendingSaves,
  getPendingDeletes,
  markReviewSynced,
  markSaveSynced,
  markDeleteSynced,
  clearSyncedReviews,
  clearSyncedSaves,
  clearSyncedDeletes,
  cacheAllWords,
  cacheDueWords,
  cacheSummary,
  cacheProgress,
  setLastSyncTime,
  getPendingCount,
} from '@/lib/offlineStore';

export interface OfflineState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime: Date | null;
  syncNow: () => Promise<void>;
}

// Global mutex — منع sync متعددة في نفس الوقت
let syncMutex = false;

export function useOffline(): OfflineState {
  const [isOnline,    setIsOnline]    = useState(true);
  const [isSyncing,   setIsSyncing]   = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncTime, setLastSyncTimeState] = useState<Date | null>(null);

  const { setSavedWords, setDueWords, setProgress } = useStore();
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refresh pending count
  const refreshPending = useCallback(async () => {
    try {
      const count = await getPendingCount();
      setPendingCount(count);
    } catch {}
  }, []);

  // ── Core sync function ────────────────────────────────────────────────────
  const syncNow = useCallback(async () => {
    if (syncMutex || !navigator.onLine) return;
    syncMutex = true;
    setIsSyncing(true);

    try {
      // 1. Flush pending deletes first (أولاً — يتجنب conflict مع saves)
      const pendingDeletes = await getPendingDeletes();
      for (const d of pendingDeletes) {
        try {
          await vocabularyApi.delete(d.savedWordId);
          await markDeleteSynced(d.id);
        } catch (e: any) {
          // 404 = already deleted on server → mark as synced
          if (e?.status === 404) await markDeleteSynced(d.id);
        }
      }
      await clearSyncedDeletes();

      // 2. Flush pending saves
      const pendingSaves = await getPendingSaves();
      for (const s of pendingSaves) {
        try {
          await vocabularyApi.save(s.word, s.videoId, s.sentence, s.context);
          await markSaveSynced(s.id);
        } catch (e: any) {
          // 400 = word already saved → mark as synced
          if (e?.status === 400 || e?.status === 409) await markSaveSynced(s.id);
        }
      }
      await clearSyncedSaves();

      // 3. Flush pending reviews
      const pendingReviews = await getPendingReviews();
      for (const r of pendingReviews) {
        try {
          await vocabularyApi.review(r.savedWordId, r.quality);
          await markReviewSynced(r.id);
        } catch (e: any) {
          // 404 = word deleted in the meantime → mark as synced
          if (e?.status === 404) await markReviewSynced(r.id);
        }
      }
      await clearSyncedReviews();

      // 4. Refresh vocabulary from server → update local cache + Zustand
      const [vocabData, dueData, sumData, progData] = await Promise.allSettled([
        vocabularyApi.list({ page: 1, limit: 500 }),
        vocabularyApi.due(40),
        vocabularyApi.reviewSummary(),
        vocabularyApi.stats(),
      ]);

      if (vocabData.status === 'fulfilled' && vocabData.value?.words) {
        setSavedWords(vocabData.value.words);
        await cacheAllWords(vocabData.value.words);
      }
      if (dueData.status === 'fulfilled' && dueData.value?.words) {
        setDueWords(dueData.value.words);
        await cacheDueWords(dueData.value.words);
      }
      if (sumData.status === 'fulfilled' && sumData.value) {
        await cacheSummary(sumData.value);
      }
      if (progData.status === 'fulfilled' && progData.value) {
        setProgress(progData.value);
        await cacheProgress(progData.value);
      }

      // 5. Update sync timestamp
      await setLastSyncTime();
      setLastSyncTimeState(new Date());
      await refreshPending();

    } catch (err) {
      console.warn('[Offline] Sync failed:', err);
    } finally {
      syncMutex = false;
      setIsSyncing(false);
    }
  }, [setSavedWords, setDueWords, setProgress, refreshPending]);

  // ── Monitor network state ─────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Initial state
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      // Debounce sync slightly — wait 1.5s for stable connection
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = setTimeout(syncNow, 1500);
    };

    const handleOffline = () => {
      setIsOnline(false);
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };

    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial sync if online
    if (navigator.onLine) {
      syncTimeoutRef.current = setTimeout(syncNow, 2000);
    }

    // Load pending count
    refreshPending();

    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [syncNow, refreshPending]);

  // Refresh pending count every 10s
  useEffect(() => {
    const iv = setInterval(refreshPending, 10_000);
    return () => clearInterval(iv);
  }, [refreshPending]);

  return { isOnline, isSyncing, pendingCount, lastSyncTime, syncNow };
}

// Export singleton for non-hook usage (e.g. from useDictionary)
export async function triggerBackgroundSync(): Promise<void> {
  if (syncMutex || !navigator.onLine) return;
  // Fire and forget
  useOfflineSingleton?.();
}

// Simple ref to allow external trigger
let useOfflineSingleton: (() => void) | null = null;
export function registerSyncTrigger(fn: () => void) {
  useOfflineSingleton = fn;
}
