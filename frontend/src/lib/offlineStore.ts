/**
 * offlineStore.ts — IndexedDB offline store for LinguaLearn.
 *
 * Queues (synced when back online):
 *   reviewQueue  — SM-2 reviews done offline
 *   saveQueue    — words saved offline
 *   deleteQueue  — words deleted offline
 *   xpQueue      — XP actions earned offline (reviews, games, etc.)
 *
 * Caches (read when offline):
 *   savedWords      — full vocabulary
 *   dueWords        — words due for review
 *   dictionaryCache — looked-up word definitions
 *   summaryStore    — review summary + user progress
 *   meta            — timestamps, config
 */

import type { SavedWord, Word, ReviewSummary, UserProgress } from '@/types';

const DB_NAME    = 'lingualearn-offline';
const DB_VERSION = 3;   // bumped: added xpQueue store

// ── Types ────────────────────────────────────────────────────────────────────

export interface PendingReview {
  id:          string;
  savedWordId: string;
  quality:     number;    // 0-5 SM-2 quality
  reviewedAt:  string;    // ISO
  synced:      boolean;
}

export interface PendingSave {
  id:        string;
  word:      string;
  videoId?:  string;
  sentence?: string;
  context?:  string;
  savedAt:   string;
  synced:    boolean;
}

export interface PendingDelete {
  id:          string;
  savedWordId: string;
  deletedAt:   string;
  synced:      boolean;
}

/** One XP action earned offline (game correct, review, etc.) */
export interface PendingXP {
  id:          string;
  action:      string;    // e.g. "review_word", "game_spelling"
  amount:      number;    // XP amount
  occurredAt:  string;    // ISO — when it happened (for streak calc)
  synced:      boolean;
}

// ── DB open ──────────────────────────────────────────────────────────────────

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB unavailable')); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      const existing = db.objectStoreNames;

      if (!existing.contains('savedWords')) {
        const s = db.createObjectStore('savedWords', { keyPath: 'id' });
        s.createIndex('status',      'status');
        s.createIndex('next_review', 'next_review');
      }
      if (!existing.contains('dueWords'))        db.createObjectStore('dueWords',        { keyPath: 'id' });
      if (!existing.contains('dictionaryCache')) db.createObjectStore('dictionaryCache', { keyPath: 'word' });

      if (!existing.contains('reviewQueue')) {
        const s = db.createObjectStore('reviewQueue', { keyPath: 'id' });
        s.createIndex('synced', 'synced');
      }
      if (!existing.contains('saveQueue')) {
        const s = db.createObjectStore('saveQueue', { keyPath: 'id' });
        s.createIndex('synced', 'synced');
      }
      if (!existing.contains('deleteQueue')) {
        const s = db.createObjectStore('deleteQueue', { keyPath: 'id' });
        s.createIndex('synced', 'synced');
      }
      // NEW in v3
      if (!existing.contains('xpQueue')) {
        const s = db.createObjectStore('xpQueue', { keyPath: 'id' });
        s.createIndex('synced', 'synced');
      }

      if (!existing.contains('summaryStore')) db.createObjectStore('summaryStore', { keyPath: 'key' });
      if (!existing.contains('meta'))          db.createObjectStore('meta',          { keyPath: 'key' });
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
  return dbPromise;
}

// ── Generic helpers ───────────────────────────────────────────────────────────

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(db => new Promise<T>((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    const r = fn(s);
    r.onsuccess = () => resolve(r.result);
    r.onerror   = () => reject(r.error);
  }));
}

function txAll<T>(store: string): Promise<T[]> {
  return openDB().then(db => new Promise<T[]>((resolve, reject) => {
    const t = db.transaction(store, 'readonly');
    const r = t.objectStore(store).getAll();
    r.onsuccess = () => resolve(r.result as T[]);
    r.onerror   = () => reject(r.error);
  }));
}

function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ── Saved words cache ────────────────────────────────────────────────────────

export async function cacheAllWords(words: SavedWord[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction('savedWords', 'readwrite');
    const s = t.objectStore('savedWords');
    s.clear();
    for (const w of words) s.put(w);
    t.oncomplete = () => resolve();
    t.onerror    = () => reject(t.error);
  });
}

export const getCachedWords    = ()                => txAll<SavedWord>('savedWords');
export const upsertCachedWord  = (w: SavedWord)   => tx('savedWords', 'readwrite', s => s.put(w)) as Promise<any>;
export const removeCachedWord  = (id: string)     => tx('savedWords', 'readwrite', s => s.delete(id)) as Promise<any>;

// ── Due words cache ───────────────────────────────────────────────────────────

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

export const getCachedDueWords = () => txAll<SavedWord>('dueWords');

// ── Dictionary cache ─────────────────────────────────────────────────────────

export const cacheWord      = (w: Word)    => tx('dictionaryCache', 'readwrite', s => s.put(w)) as Promise<any>;
export const getCachedWord  = (word: string) =>
  tx<Word | undefined>('dictionaryCache', 'readonly', s => s.get(word.toLowerCase()));

// ── Review queue ──────────────────────────────────────────────────────────────

export async function enqueueReview(savedWordId: string, quality: number): Promise<PendingReview> {
  const item: PendingReview = {
    id: uid('rev'), savedWordId, quality,
    reviewedAt: new Date().toISOString(), synced: false,
  };
  await tx('reviewQueue', 'readwrite', s => s.put(item));
  return item;
}

export const getPendingReviews = () =>
  txAll<PendingReview>('reviewQueue').then(all => all.filter(r => !r.synced));

export async function markReviewSynced(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction('reviewQueue', 'readwrite');
    const s = t.objectStore('reviewQueue');
    const r = s.get(id);
    r.onsuccess = () => { if (r.result) s.put({ ...r.result, synced: true }); t.oncomplete = () => resolve(); };
    r.onerror   = () => reject(r.error);
  });
}

export async function clearSyncedReviews(): Promise<void> {
  const all = await txAll<PendingReview>('reviewQueue');
  const db  = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction('reviewQueue', 'readwrite');
    const s = t.objectStore('reviewQueue');
    for (const r of all) if (r.synced) s.delete(r.id);
    t.oncomplete = () => resolve(); t.onerror = () => reject(t.error);
  });
}

// ── Save queue ────────────────────────────────────────────────────────────────

export async function enqueueSave(
  word: string, videoId?: string, sentence?: string, context?: string
): Promise<PendingSave> {
  const item: PendingSave = {
    id: uid('save'), word, videoId, sentence, context,
    savedAt: new Date().toISOString(), synced: false,
  };
  await tx('saveQueue', 'readwrite', s => s.put(item));
  return item;
}

export const getPendingSaves = () =>
  txAll<PendingSave>('saveQueue').then(all => all.filter(r => !r.synced));

export async function markSaveSynced(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction('saveQueue', 'readwrite');
    const s = t.objectStore('saveQueue');
    const r = s.get(id);
    r.onsuccess = () => { if (r.result) s.put({ ...r.result, synced: true }); t.oncomplete = () => resolve(); };
    r.onerror   = () => reject(r.error);
  });
}

export async function clearSyncedSaves(): Promise<void> {
  const all = await txAll<PendingSave>('saveQueue');
  const db  = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction('saveQueue', 'readwrite');
    const s = t.objectStore('saveQueue');
    for (const r of all) if (r.synced) s.delete(r.id);
    t.oncomplete = () => resolve(); t.onerror = () => reject(t.error);
  });
}

// ── Delete queue ──────────────────────────────────────────────────────────────

export async function enqueueDelete(savedWordId: string): Promise<PendingDelete> {
  const item: PendingDelete = {
    id: uid('del'), savedWordId,
    deletedAt: new Date().toISOString(), synced: false,
  };
  await tx('deleteQueue', 'readwrite', s => s.put(item));
  return item;
}

export const getPendingDeletes = () =>
  txAll<PendingDelete>('deleteQueue').then(all => all.filter(r => !r.synced));

export async function markDeleteSynced(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction('deleteQueue', 'readwrite');
    const s = t.objectStore('deleteQueue');
    const r = s.get(id);
    r.onsuccess = () => { if (r.result) s.put({ ...r.result, synced: true }); t.oncomplete = () => resolve(); };
    r.onerror   = () => reject(r.error);
  });
}

export async function clearSyncedDeletes(): Promise<void> {
  const all = await txAll<PendingDelete>('deleteQueue');
  const db  = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction('deleteQueue', 'readwrite');
    const s = t.objectStore('deleteQueue');
    for (const r of all) if (r.synced) s.delete(r.id);
    t.oncomplete = () => resolve(); t.onerror = () => reject(t.error);
  });
}

// ── XP queue (NEW) ────────────────────────────────────────────────────────────

export async function enqueueXP(action: string, amount: number): Promise<PendingXP> {
  const item: PendingXP = {
    id: uid('xp'), action, amount,
    occurredAt: new Date().toISOString(), synced: false,
  };
  await tx('xpQueue', 'readwrite', s => s.put(item));
  return item;
}

export const getPendingXP = () =>
  txAll<PendingXP>('xpQueue').then(all => all.filter(r => !r.synced));

export async function markXPSynced(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction('xpQueue', 'readwrite');
    const s = t.objectStore('xpQueue');
    const r = s.get(id);
    r.onsuccess = () => { if (r.result) s.put({ ...r.result, synced: true }); t.oncomplete = () => resolve(); };
    r.onerror   = () => reject(r.error);
  });
}

export async function clearSyncedXP(): Promise<void> {
  const all = await txAll<PendingXP>('xpQueue');
  const db  = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction('xpQueue', 'readwrite');
    const s = t.objectStore('xpQueue');
    for (const r of all) if (r.synced) s.delete(r.id);
    t.oncomplete = () => resolve(); t.onerror = () => reject(t.error);
  });
}

// ── Summary / progress cache ──────────────────────────────────────────────────

export const cacheSummary       = (s: ReviewSummary) => tx('summaryStore', 'readwrite', st => st.put({ key: 'summary',  value: s })) as Promise<any>;
export const cacheProgress      = (p: UserProgress)  => tx('summaryStore', 'readwrite', st => st.put({ key: 'progress', value: p })) as Promise<any>;

export const getCachedSummary  = (): Promise<ReviewSummary | null> =>
  tx<any>('summaryStore', 'readonly', s => s.get('summary')).then(r => r?.value ?? null);
export const getCachedProgress = (): Promise<UserProgress | null> =>
  tx<any>('summaryStore', 'readonly', s => s.get('progress')).then(r => r?.value ?? null);

// ── Meta ─────────────────────────────────────────────────────────────────────

export const setMeta         = (key: string, value: any) => tx('meta', 'readwrite', s => s.put({ key, value })) as Promise<any>;
export const getMeta         = (key: string): Promise<any> => tx<any>('meta', 'readonly', s => s.get(key)).then(r => r?.value);
export const getLastSyncTime = (): Promise<Date | null> => getMeta('lastSync').then(ts => ts ? new Date(ts) : null);
export const setLastSyncTime = () => setMeta('lastSync', new Date().toISOString());

// ── Pending counts ────────────────────────────────────────────────────────────

export async function getPendingCount(): Promise<number> {
  const [rev, sav, del, xp] = await Promise.all([
    getPendingReviews(),
    getPendingSaves(),
    getPendingDeletes(),
    getPendingXP(),
  ]);
  return rev.length + sav.length + del.length + xp.length;
}

// ── Local SM-2 (offline review) ───────────────────────────────────────────────

export function applyLocalSM2(word: SavedWord, quality: number): SavedWord {
  const now      = new Date();
  const ease     = parseFloat(String(word.ease_factor   ?? 2.5));
  const interval = parseInt  (String(word.interval      ?? 0));
  const reps     = parseInt  (String(word.repetitions   ?? 0));
  const lapses   = parseInt  (String(word.lapses        ?? 0));
  const revCount = parseInt  (String(word.reviewed_count ?? 0));

  let newEase = ease, newInterval = interval, newReps = reps;
  let newLapses = lapses, newStatus = word.status;
  let nextReview: Date;

  if (quality <= 1) {
    newEase = Math.max(1.3, ease - 0.20); newInterval = 0; newReps = 0;
    newStatus = 'learning'; newLapses += 1;
    nextReview = new Date(now.getTime() + 10 * 60_000);
  } else if (quality === 2) {
    newEase = Math.max(1.3, ease - 0.15); newInterval = 0; newReps = 0;
    newStatus = 'learning';
    nextReview = new Date(now.getTime() + 30 * 60_000);
  } else if (quality === 3) {
    newEase = Math.min(3.0, Math.max(1.3, ease - 0.02));
    if (reps < 1) { newReps = 1; newInterval = 1; newStatus = 'learning'; }
    else { newReps += 1; newInterval = Math.max(2, Math.round(Math.max(1, interval) * ease)); newStatus = newInterval >= 30 ? 'learned' : 'reviewing'; }
    nextReview = new Date(now.getTime() + newInterval * 86_400_000);
  } else if (quality === 4) {
    newEase = Math.min(3.0, Math.max(1.3, ease + 0.05));
    if (reps < 1) { newReps = 2; newInterval = 3; }
    else { newReps += 1; newInterval = Math.max(interval + 1, Math.round(Math.max(1, interval) * (ease + 0.15))); }
    newStatus = newInterval >= 30 ? 'learned' : 'reviewing';
    nextReview = new Date(now.getTime() + newInterval * 86_400_000);
  } else {
    newEase = Math.min(3.0, Math.max(1.3, ease + 0.10));
    if (reps < 1) { newReps = 2; newInterval = 4; }
    else { newReps += 1; newInterval = Math.max(interval + 2, Math.round(Math.max(1, interval) * (ease + 0.30))); }
    newStatus = newInterval >= 30 ? 'learned' : 'reviewing';
    nextReview = new Date(now.getTime() + newInterval * 86_400_000);
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
