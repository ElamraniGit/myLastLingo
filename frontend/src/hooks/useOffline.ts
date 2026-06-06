/**
 * useOffline — Network monitor + automatic sync queue flusher.
 *
 * Syncs on reconnection (in order):
 *   1. Pending deletes
 *   2. Pending saves
 *   3. Pending reviews  (SM-2 results)
 *   4. Pending XP       (reviews + game scores — batch request)
 *   5. Refresh vocabulary / due words / summary from server
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useStore } from '@/store/appStore';
import { vocabularyApi, xpApi } from '@/lib/api';
import {
  getPendingReviews, getPendingSaves, getPendingDeletes, getPendingXP,
  markReviewSynced,  markSaveSynced,  markDeleteSynced,  markXPSynced,
  clearSyncedReviews, clearSyncedSaves, clearSyncedDeletes, clearSyncedXP,
  cacheAllWords, cacheDueWords, cacheSummary, cacheProgress,
  setLastSyncTime, getPendingCount,
} from '@/lib/offlineStore';

export interface OfflineState {
  isOnline:     boolean;
  isSyncing:    boolean;
  pendingCount: number;
  lastSyncTime: Date | null;
  syncNow:      () => Promise<void>;
}

let syncMutex = false;   // prevent concurrent syncs

export function useOffline(): OfflineState {
  const [isOnline,      setIsOnline]      = useState(true);
  const [isSyncing,     setIsSyncing]     = useState(false);
  const [pendingCount,  setPendingCount]  = useState(0);
  const [lastSyncTime,  setLastSyncTimeState] = useState<Date | null>(null);

  const { setSavedWords, setDueWords, setProgress } = useStore();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshPending = useCallback(async () => {
    try { setPendingCount(await getPendingCount()); } catch { /* noop */ }
  }, []);

  // ── Core sync ──────────────────────────────────────────────────────────────
  const syncNow = useCallback(async () => {
    if (syncMutex || !navigator.onLine) return;
    syncMutex = true;
    setIsSyncing(true);

    try {
      // 1. Deletes first (avoid save/delete conflicts)
      for (const d of await getPendingDeletes()) {
        try {
          await vocabularyApi.delete(d.savedWordId);
          await markDeleteSynced(d.id);
        } catch (e: any) {
          if (e?.status === 404) await markDeleteSynced(d.id);
        }
      }
      await clearSyncedDeletes();

      // 2. Saves
      for (const s of await getPendingSaves()) {
        try {
          await vocabularyApi.save(s.word, s.videoId, s.sentence, s.context);
          await markSaveSynced(s.id);
        } catch (e: any) {
          if (e?.status === 400 || e?.status === 409) await markSaveSynced(s.id);
        }
      }
      await clearSyncedSaves();

      // 3. Reviews (SM-2)
      for (const r of await getPendingReviews()) {
        try {
          await vocabularyApi.review(r.savedWordId, r.quality);
          await markReviewSynced(r.id);
        } catch (e: any) {
          if (e?.status === 404) await markReviewSynced(r.id);
        }
      }
      await clearSyncedReviews();

      // 4. XP queue — flush as a single batch request
      const pendingXP = await getPendingXP();
      if (pendingXP.length > 0) {
        try {
          await xpApi.batchXP(
            pendingXP.map(x => ({
              action:      x.action,
              amount:      x.amount,
              occurred_at: x.occurredAt,
            }))
          );
          // Mark all synced
          await Promise.all(pendingXP.map(x => markXPSynced(x.id)));
          // Refresh XP bar from server
          window.dispatchEvent(new Event('xp-updated'));
        } catch {
          // Server error — keep in queue, will retry next sync
        }
      }
      await clearSyncedXP();

      // 5. Refresh data from server
      const [vocabRes, dueRes, sumRes, progRes] = await Promise.allSettled([
        vocabularyApi.list({ page: 1, limit: 500 }),
        vocabularyApi.due(40),
        vocabularyApi.reviewSummary(),
        vocabularyApi.stats(),
      ]);

      if (vocabRes.status === 'fulfilled' && vocabRes.value?.words) {
        setSavedWords(vocabRes.value.words);
        await cacheAllWords(vocabRes.value.words);
      }
      if (dueRes.status === 'fulfilled' && dueRes.value?.words) {
        setDueWords(dueRes.value.words);
        await cacheDueWords(dueRes.value.words);
      }
      if (sumRes.status === 'fulfilled'  && sumRes.value)  await cacheSummary(sumRes.value);
      if (progRes.status === 'fulfilled' && progRes.value) {
        setProgress(progRes.value);
        await cacheProgress(progRes.value);
      }

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

  // ── Network listeners ──────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsOnline(navigator.onLine);

    const onOnline = () => {
      setIsOnline(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(syncNow, 1500);
    };
    const onOffline = () => {
      setIsOnline(false);
      if (timerRef.current) clearTimeout(timerRef.current);
    };

    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);

    if (navigator.onLine) timerRef.current = setTimeout(syncNow, 2000);
    refreshPending();

    return () => {
      window.removeEventListener('online',  onOnline);
      window.removeEventListener('offline', onOffline);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [syncNow, refreshPending]);

  // Refresh badge counter every 10 s
  useEffect(() => {
    const iv = setInterval(refreshPending, 10_000);
    return () => clearInterval(iv);
  }, [refreshPending]);

  return { isOnline, isSyncing, pendingCount, lastSyncTime, syncNow };
}
