/**
 * offlineStore.ts — IndexedDB wrapper for full offline support.
 *
 * Stores:
 *  - savedWords     : كل كلمات المستخدم المحفوظة
 *  - dueWords       : الكلمات المستحقة للمراجعة
 *  - dictionaryCache: نتائج البحث في القاموس
 *  - reviewQueue    : مراجعات pending للـ sync لاحقاً
 *  - saveQueue      : كلمات saved offline للـ sync لاحقاً
 *  - deleteQueue    : كلمات محذوفة offline للـ sync لاحقاً
 *  - reviewSummary  : ملخص المراجعات
 *  - userProgress   : إحصاءات التقدم
 *  - meta           : بيانات عامة (آخر sync، إلخ)
 */

import type { SavedWord, Word, ReviewSummary, UserProgress } from '@/types';

const DB_NAME    = 'lingualearn-offline';
const DB_VERSION = 2;

// ── Queue item types ────────────────────────────────────────────────────────

export interface PendingReview {
  id: string;            // UUID محلي
  savedWordId: string;
  quality: number;       // 0-5
  reviewedAt: string;    // ISO timestamp
  synced: boolean;
}

export interface PendingSave {
  id: string;
  word: string;
  videoId?: string;
  sentence?: string;
  context?: string;
  savedAt: string;
  synced: boolean;
}

export interface PendingDelete {
  id: string;
  savedWordId: string;
  deletedAt: string;
  synced: boolean;
}

// ── DB open ─────────────────────────────────────────────────────────────────

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;

      // Vocabulary
      if (!db.objectStoreNames.contains('savedWords')) {
        const store = db.createObjectStore('savedWords', { keyPath: 'id' });
        store.createIndex('status', 'status');
        store.createIndex('next_review', 'next_review');
      }

      // Due words cache
      if (!db.objectStoreNames.contains('dueWords')) {
        db.createObjectStore('dueWords', { keyPath: 'id' });
      }

      // Dictionary cache
      if (!db.objectStoreNames.contains('dictionaryCache')) {
        db.createObjectStore('dictionaryCache', { keyPath: 'word' });
      }

      // Pending review operations
      if (!db.objectStoreNames.contains('reviewQueue')) {
        const store = db.createObjectStore('reviewQueue', { keyPath: 'id' });
        store.createIndex('synced', 'synced');
      }

      // Pending save operations
      if (!db.objectStoreNames.contains('saveQueue')) {
        const store = db.createObjectStore('saveQueue', { keyPath: 'id' });
        store.createIndex('synced', 'synced');
      }

      // Pending delete operations
      if (!db.objectStoreNames.contains('deleteQueue')) {
        const store = db.createObjectStore('deleteQueue', { keyPath: 'id' });
        store.createIndex('synced', 'synced');
      }

      // Review summary + progress
      if (!db.objectStoreNames.contains('summaryStore')) {
        db.createObjectStore('summaryStore', { keyPath: 'key' });
      }

      // Meta (timestamps, etc.)
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });

  return dbPromise;
}

// ── Generic helpers ─────────────────────────────────────────────────────────

function tx<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDB().then(
    db => new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      const store       = transaction.objectStore(storeName);
      const request     = fn(store);
      request.onsuccess = () => resolve(request.result);
      request.onerror   = () => reject(request.error);
    })
  );
}

function txAll<T>(storeName: string): Promise<T[]> {
  return openDB().then(
    db => new Promise<T[]>((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store       = transaction.objectStore(storeName);
      const request     = store.getAll();
      request.onsuccess = () => resolve(request.result as T[]);
      request.onerror   = () => reject(request.error);
    })
  );
}

// ── Saved Words ─────────────────────────────────────────────────────────────

export async function cacheAllWords(words: SavedWord[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction('savedWords', 'readwrite');
    const s = t.objectStore('savedWords');
    // Clear then re-insert for a clean cache
    s.clear();
    for (const w of words) s.put(w);
    t.oncomplete = () => resolve();
    t.onerror    = () => reject(t.error);
  });
}

export function getCachedWords(): Promise<SavedWord[]> {
  return txAll<SavedWord>('savedWords');
}

export async function upsertCachedWord(word: SavedWord): Promise<void> {
  await tx('savedWords', 'readwrite', s => s.put(word));
}

export async function removeCachedWord(savedId: string): Promise<void> {
  await tx('savedWords', 'readwrite', s => s.delete(savedId));
}

// ── Due Words ───────────────────────────────────────────────────────────────

export async function cacheDueWords(words: SavedWord[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction('dueWords', 'readwrite');
    const s = t.objectStore('dueWords');
    s.clear();
    for (const w of words) s.put(w);
    t.oncomplete = () => resolve();
    t.onerror    = () => reject(t.error);
  });
}

export function getCachedDueWords(): Promise<SavedWord[]> {
  return txAll<SavedWord>('dueWords');
}

// ── Dictionary Cache ────────────────────────────────────────────────────────

export async function cacheWord(word: Word): Promise<void> {
  await tx('dictionaryCache', 'readwrite', s => s.put(word));
}

export async function getCachedWord(word: string): Promise<Word | undefined> {
  return tx<Word | undefined>('dictionaryCache', 'readonly', s =>
    s.get(word.toLowerCase())
  );
}

// ── Review Queue (offline-first) ────────────────────────────────────────────

export async function enqueueReview(
  savedWordId: string,
  quality: number
): Promise<PendingReview> {
  const item: PendingReview = {
    id: `rev_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    savedWordId,
    quality,
    reviewedAt: new Date().toISOString(),
    synced: false,
  };
  await tx('reviewQueue', 'readwrite', s => s.put(item));
  return item;
}

export function getPendingReviews(): Promise<PendingReview[]> {
  return txAll<PendingReview>('reviewQueue').then(all =>
    all.filter(r => !r.synced)
  );
}

export async function markReviewSynced(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction('reviewQueue', 'readwrite');
    const s = t.objectStore('reviewQueue');
    const req = s.get(id);
    req.onsuccess = () => {
      const item = req.result;
      if (item) { item.synced = true; s.put(item); }
      t.oncomplete = () => resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

export async function clearSyncedReviews(): Promise<void> {
  const all = await txAll<PendingReview>('reviewQueue');
  const db  = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction('reviewQueue', 'readwrite');
    const s = t.objectStore('reviewQueue');
    for (const r of all) { if (r.synced) s.delete(r.id); }
    t.oncomplete = () => resolve();
    t.onerror    = () => reject(t.error);
  });
}

// ── Save Queue (offline-first) ──────────────────────────────────────────────

export async function enqueueSave(
  word: string,
  videoId?: string,
  sentence?: string,
  context?: string
): Promise<PendingSave> {
  const item: PendingSave = {
    id: `save_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    word,
    videoId,
    sentence,
    context,
    savedAt: new Date().toISOString(),
    synced: false,
  };
  await tx('saveQueue', 'readwrite', s => s.put(item));
  return item;
}

export function getPendingSaves(): Promise<PendingSave[]> {
  return txAll<PendingSave>('saveQueue').then(all =>
    all.filter(r => !r.synced)
  );
}

export async function markSaveSynced(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction('saveQueue', 'readwrite');
    const s = t.objectStore('saveQueue');
    const req = s.get(id);
    req.onsuccess = () => {
      const item = req.result;
      if (item) { item.synced = true; s.put(item); }
      t.oncomplete = () => resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

export async function clearSyncedSaves(): Promise<void> {
  const all = await txAll<PendingSave>('saveQueue');
  const db  = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction('saveQueue', 'readwrite');
    const s = t.objectStore('saveQueue');
    for (const r of all) { if (r.synced) s.delete(r.id); }
    t.oncomplete = () => resolve();
    t.onerror    = () => reject(t.error);
  });
}

// ── Delete Queue (offline-first) ────────────────────────────────────────────

export async function enqueueDelete(savedWordId: string): Promise<PendingDelete> {
  const item: PendingDelete = {
    id: `del_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    savedWordId,
    deletedAt: new Date().toISOString(),
    synced: false,
  };
  await tx('deleteQueue', 'readwrite', s => s.put(item));
  return item;
}

export function getPendingDeletes(): Promise<PendingDelete[]> {
  return txAll<PendingDelete>('deleteQueue').then(all =>
    all.filter(r => !r.synced)
  );
}

export async function markDeleteSynced(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction('deleteQueue', 'readwrite');
    const s = t.objectStore('deleteQueue');
    const req = s.get(id);
    req.onsuccess = () => {
      const item = req.result;
      if (item) { item.synced = true; s.put(item); }
      t.oncomplete = () => resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

export async function clearSyncedDeletes(): Promise<void> {
  const all = await txAll<PendingDelete>('deleteQueue');
  const db  = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction('deleteQueue', 'readwrite');
    const s = t.objectStore('deleteQueue');
    for (const r of all) { if (r.synced) s.delete(r.id); }
    t.oncomplete = () => resolve();
    t.onerror    = () => reject(t.error);
  });
}

// ── Summary & Progress ──────────────────────────────────────────────────────

export async function cacheSummary(summary: ReviewSummary): Promise<void> {
  await tx('summaryStore', 'readwrite', s => s.put({ key: 'reviewSummary', data: summary }));
}

export async function getCachedSummary(): Promise<ReviewSummary | null> {
  const result = await tx<any>('summaryStore', 'readonly', s => s.get('reviewSummary'));
  return result?.data ?? null;
}

export async function cacheProgress(progress: UserProgress): Promise<void> {
  await tx('summaryStore', 'readwrite', s => s.put({ key: 'userProgress', data: progress }));
}

export async function getCachedProgress(): Promise<UserProgress | null> {
  const result = await tx<any>('summaryStore', 'readonly', s => s.get('userProgress'));
  return result?.data ?? null;
}

// ── Meta ────────────────────────────────────────────────────────────────────

export async function setMeta(key: string, value: any): Promise<void> {
  await tx('meta', 'readwrite', s => s.put({ key, value }));
}

export async function getMeta(key: string): Promise<any> {
  const result = await tx<any>('meta', 'readonly', s => s.get(key));
  return result?.value;
}

export async function getLastSyncTime(): Promise<Date | null> {
  const ts = await getMeta('lastSync');
  return ts ? new Date(ts) : null;
}

export async function setLastSyncTime(): Promise<void> {
  await setMeta('lastSync', new Date().toISOString());
}

// ── Pending counts (for UI badge) ───────────────────────────────────────────

export async function getPendingCount(): Promise<number> {
  const [reviews, saves, deletes] = await Promise.all([
    getPendingReviews(),
    getPendingSaves(),
    getPendingDeletes(),
  ]);
  return reviews.length + saves.length + deletes.length;
}

// ── Local SM-2 update (for offline review) ──────────────────────────────────

export function applyLocalSM2(word: SavedWord, quality: number): SavedWord {
  const now = new Date();
  const ease      = parseFloat(String(word.ease_factor ?? 2.5));
  const interval  = parseInt(String(word.interval ?? 0));
  const reps      = parseInt(String(word.repetitions ?? 0));
  const lapses    = parseInt(String(word.lapses ?? 0));
  const revCount  = parseInt(String(word.reviewed_count ?? 0));
  const hadBefore = revCount > 0 || !!word.last_reviewed;

  let newEase = ease, newInterval = interval, newReps = reps;
  let newLapses = lapses, newStatus = word.status;
  let nextReview: Date;

  if (quality <= 1) {
    newEase     = Math.max(1.3, ease - 0.20);
    newInterval = 0; newReps = 0;
    newStatus   = 'learning';
    nextReview  = new Date(now.getTime() + 10 * 60 * 1000);
    if (hadBefore) newLapses += 1;
  } else if (quality === 2) {
    newEase     = Math.max(1.3, ease - 0.15);
    newInterval = 0; newReps = 0;
    newStatus   = 'learning';
    nextReview  = new Date(now.getTime() + 30 * 60 * 1000);
  } else if (quality === 3) {
    newEase = Math.min(3.0, Math.max(1.3, ease - 0.02));
    if (reps < 1) {
      newReps = 1; newInterval = 1; newStatus = 'learning';
    } else {
      newReps += 1; newInterval = Math.max(2, Math.round(Math.max(1, interval) * ease));
      newStatus = newInterval >= 30 ? 'learned' : 'reviewing';
    }
    nextReview = new Date(now.getTime() + newInterval * 86400 * 1000);
  } else if (quality === 4) {
    newEase = Math.min(3.0, Math.max(1.3, ease + 0.05));
    if (reps < 1) {
      newReps = 2; newInterval = 3;
    } else {
      newReps += 1; newInterval = Math.max(interval + 1, Math.round(Math.max(1, interval) * (ease + 0.15)));
    }
    newStatus  = newInterval >= 30 ? 'learned' : 'reviewing';
    nextReview = new Date(now.getTime() + newInterval * 86400 * 1000);
  } else {
    newEase = Math.min(3.0, Math.max(1.3, ease + 0.10));
    if (reps < 1) {
      newReps = 2; newInterval = 4;
    } else {
      newReps += 1; newInterval = Math.max(interval + 2, Math.round(Math.max(1, interval) * (ease + 0.30)));
    }
    newStatus  = newInterval >= 30 ? 'learned' : 'reviewing';
    nextReview = new Date(now.getTime() + newInterval * 86400 * 1000);
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

  return {
    ...word,
    ease_factor:    newEase,
    interval:       newInterval,
    repetitions:    newReps,
    lapses:         newLapses,
    reviewed_count: revCount + 1,
    last_quality:   quality,
    last_reviewed:  fmt(now),
    next_review:    fmt(nextReview),
    status:         newStatus as SavedWord['status'],
  };
}
