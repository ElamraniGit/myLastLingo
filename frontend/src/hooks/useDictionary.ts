/**
 * useDictionary.ts — Dictionary & vocabulary hook.
 *
 * Offline-first behaviour:
 *  - lookupWord : tries server → falls back to IndexedDB cache
 *  - saveWord   : if offline → enqueues in saveQueue + updates local cache
 *  - reviewWord : if offline → applies SM-2 locally + enqueues in reviewQueue
 *  - deleteWord : if offline → removes from local cache + enqueues in deleteQueue
 *  - loadVocabulary / loadDueWords : tries server → falls back to IndexedDB
 */

import { useCallback } from 'react';
import { useStore } from '@/store/appStore';
import { dictionaryApi, vocabularyApi } from '@/lib/api';
import { awardXP } from '@/components/common/XPBar';
import type { VocabularyListParams } from '@/types';
import {
  getCachedWord,
  cacheWord,
  getCachedWords,
  getCachedDueWords,
  getCachedSummary,
  getCachedProgress,
  cacheAllWords,
  cacheDueWords,
  upsertCachedWord,
  removeCachedWord,
  enqueueReview,
  enqueueSave,
  enqueueDelete,
  applyLocalSM2,
} from '@/lib/offlineStore';

export function useDictionary() {
  const {
    setSelectedWord,
    setWordPopupOpen,
    setWordPopupSentence,
    setResumeAfterWordPopup,
    setSavedWords,
    setDueWords,
    setProgress,
    updatePlayerState,
  } = useStore();

  // ── lookupWord ─────────────────────────────────────────────────────────────
  const lookupWord = useCallback(async (word: string, sentence = '') => {
    const clean = word.replace(/[.,!?;:'"()\[\]{}]/g, '').trim().toLowerCase();
    if (!clean || clean.length < 2) return;

    const state = useStore.getState();
    const wasPlaying      = state.playerState.playing;
    const shouldAutoPause = state.autoPauseOnWord;

    if (shouldAutoPause && wasPlaying) {
      setResumeAfterWordPopup(true);
      updatePlayerState({ playing: false });
    } else {
      setResumeAfterWordPopup(false);
    }

    setWordPopupSentence(sentence);

    try {
      if (navigator.onLine) {
        // Online: fetch from server, cache result
        const data = await dictionaryApi.lookup(clean);
        await cacheWord(data);
        setSelectedWord(data);
        setWordPopupOpen(true);
      } else {
        // Offline: serve from IndexedDB cache
        const cached = await getCachedWord(clean);
        if (cached) {
          setSelectedWord(cached);
          setWordPopupOpen(true);
        } else {
          // Not in cache — show minimal offline entry
          setSelectedWord({
            id: clean,
            word: clean,
            pronunciation: '',
            part_of_speech: 'unknown',
            level: 'B1',
            meaning_ar: '',
            meaning_en: '(offline — definition not cached)',
            definitions: [],
            examples: [],
            synonyms: [],
            antonyms: [],
          } as any);
          setWordPopupOpen(true);
        }
      }
    } catch {
      // Network error → try cache
      try {
        const cached = await getCachedWord(clean);
        if (cached) {
          setSelectedWord(cached);
          setWordPopupOpen(true);
          return;
        }
      } catch {}
      setResumeAfterWordPopup(false);
      if (shouldAutoPause && wasPlaying) updatePlayerState({ playing: true });
    }
  }, [updatePlayerState, setSelectedWord, setWordPopupOpen, setWordPopupSentence, setResumeAfterWordPopup]);

  // ── closeWordPopup ─────────────────────────────────────────────────────────
  const closeWordPopup = useCallback(() => {
    const shouldResume = useStore.getState().resumeAfterWordPopup;
    setWordPopupOpen(false);
    setSelectedWord(null);
    setResumeAfterWordPopup(false);
    if (shouldResume) updatePlayerState({ playing: true });
  }, [setWordPopupOpen, setSelectedWord, setResumeAfterWordPopup, updatePlayerState]);

  // ── saveWord (offline-first) ───────────────────────────────────────────────
  const saveWord = useCallback(async (
    word: string,
    videoId?: string,
    sentence?: string,
    context?: string
  ) => {
    try {
      if (navigator.onLine) {
        await vocabularyApi.save(word, videoId, sentence, context);
        const data = await vocabularyApi.list();
        if (data?.words) {
          setSavedWords(data.words);
          await cacheAllWords(data.words);
        }
      } else {
        // Offline: enqueue + update local Zustand store immediately
        await enqueueSave(word, videoId, sentence, context);
        // Add optimistic word to local list
        const currentWords = useStore.getState().savedWords;
        const alreadyExists = currentWords.some(w => w.word === word.toLowerCase());
        if (!alreadyExists) {
          const optimistic: any = {
            id: `offline_${Date.now()}`,
            word_id: `offline_${word}`,
            word: word.toLowerCase(),
            pronunciation: '',
            part_of_speech: 'unknown',
            meaning_ar: '',
            meaning_en: '(syncing…)',
            level: 'B1',
            status: 'learning',
            ease_factor: 2.5,
            interval: 0,
            repetitions: 0,
            reviewed_count: 0,
            next_review: new Date().toISOString(),
            created_at: new Date().toISOString(),
            sentence: sentence || '',
            context: context || '',
            video_id: videoId,
            tags: [],
            favorite: false,
          };
          setSavedWords([optimistic, ...currentWords]);
        }
      }
      awardXP('save_word');
      return true;
    } catch {
      return false;
    }
  }, [setSavedWords]);

  // ── loadVocabulary (offline-first) ─────────────────────────────────────────
  const loadVocabulary = useCallback(async (params: VocabularyListParams = {}) => {
    try {
      if (navigator.onLine) {
        const data = await vocabularyApi.list(params);
        if (data?.words) {
          setSavedWords(data.words);
          // Cache full list (no filter) for offline use
          if (!params.status && !params.search) {
            await cacheAllWords(data.words);
          }
        }
        return data;
      } else {
        // Offline: serve from IndexedDB
        let cached = await getCachedWords();
        // Apply filters locally
        if (params.status) cached = cached.filter(w => w.status === params.status);
        if (params.search) {
          const q = params.search.toLowerCase();
          cached = cached.filter(w =>
            w.word.toLowerCase().includes(q) ||
            (w.meaning_en || '').toLowerCase().includes(q)
          );
        }
        // Apply sort locally
        if (params.sort === 'alphabetical') {
          cached.sort((a, b) => a.word.localeCompare(b.word));
        } else if (params.sort === 'newest') {
          cached.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
        } else if (params.sort === 'oldest') {
          cached.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
        }
        setSavedWords(cached);
        return { words: cached, total: cached.length, page: 1, pages: 1 };
      }
    } catch {
      // Fallback to cache on network error
      const cached = await getCachedWords().catch(() => []);
      if (cached.length) setSavedWords(cached);
      return { words: cached, total: cached.length, page: 1, pages: 1 };
    }
  }, [setSavedWords]);

  // ── loadVocabularyFilters ──────────────────────────────────────────────────
  const loadVocabularyFilters = useCallback(async () => {
    if (!navigator.onLine) return { levels: [], videos: [], tags: [] };
    return vocabularyApi.filters();
  }, []);

  // ── updateSavedWord ────────────────────────────────────────────────────────
  const updateSavedWord = useCallback(async (
    savedId: string,
    data: { tags?: string[]; notes?: string; favorite?: boolean }
  ) => {
    if (!navigator.onLine) {
      // Optimistic update locally
      const words = useStore.getState().savedWords;
      const updated = words.map(w =>
        w.id === savedId ? { ...w, ...data } : w
      );
      setSavedWords(updated);
      // Update cache
      const word = updated.find(w => w.id === savedId);
      if (word) await upsertCachedWord(word);
      return word;
    }
    const result = await vocabularyApi.update(savedId, data);
    return result?.word;
  }, [setSavedWords]);

  // ── loadDueWords (offline-first) ───────────────────────────────────────────
  const loadDueWords = useCallback(async (limit = 20) => {
    try {
      if (navigator.onLine) {
        const data = await vocabularyApi.due(limit);
        if (data?.words) {
          setDueWords(data.words);
          await cacheDueWords(data.words);
        }
        return data;
      } else {
        // Offline: compute due words from local cache
        const now = new Date();
        const cached = await getCachedWords();
        const due = cached
          .filter(w => {
            if (!w.next_review) return true;
            const reviewDate = new Date(w.next_review.replace(' ', 'T'));
            return reviewDate <= now;
          })
          .sort((a, b) => {
            // learning first, then by next_review
            if (a.status === 'learning' && b.status !== 'learning') return -1;
            if (b.status === 'learning' && a.status !== 'learning') return 1;
            return new Date(a.next_review || 0).getTime() - new Date(b.next_review || 0).getTime();
          })
          .slice(0, limit);
        setDueWords(due);
        return { words: due, count: due.length };
      }
    } catch {
      // Fallback to cache
      try {
        const due = await getCachedDueWords();
        if (due.length) setDueWords(due);
        return { words: due, count: due.length };
      } catch {
        return { words: [], count: 0 };
      }
    }
  }, [setDueWords]);

  // ── reviewWord (offline-first) ─────────────────────────────────────────────
  const reviewWord = useCallback(async (savedWordId: string, quality: number) => {
    if (navigator.onLine) {
      const result = await vocabularyApi.review(savedWordId, quality);
      awardXP(quality >= 4 ? 'review_perfect' : 'review_word');
      try {
        const due = await vocabularyApi.due();
        if (due?.words) {
          setDueWords(due.words);
          await cacheDueWords(due.words);
        }
      } catch {}
      try {
        const stats = await vocabularyApi.stats();
        if (stats) {
          setProgress(stats);
        }
      } catch {}
      try {
        const vocab = await vocabularyApi.list();
        if (vocab?.words) {
          setSavedWords(vocab.words);
          await cacheAllWords(vocab.words);
        }
      } catch {}
      return result;
    } else {
      // Offline: apply SM-2 locally + enqueue for later sync
      const words   = useStore.getState().savedWords;
      const current = words.find(w => w.id === savedWordId);
      if (!current) return null;

      const updated = applyLocalSM2(current, quality);
      await upsertCachedWord(updated);
      await enqueueReview(savedWordId, quality);

      // Update Zustand
      const newWords = words.map(w => w.id === savedWordId ? updated : w);
      setSavedWords(newWords);

      // Remove from due list
      const due = useStore.getState().dueWords.filter(w => w.id !== savedWordId);
      setDueWords(due);

      awardXP(quality >= 4 ? 'review_perfect' : 'review_word');
      return updated;
    }
  }, [setDueWords, setProgress, setSavedWords]);

  // ── loadReviewSummary (offline-first) ──────────────────────────────────────
  const loadReviewSummary = useCallback(async () => {
    try {
      if (navigator.onLine) return vocabularyApi.reviewSummary();
      return getCachedSummary();
    } catch {
      return getCachedSummary();
    }
  }, []);

  // ── loadReviewHistory ──────────────────────────────────────────────────────
  const loadReviewHistory = useCallback(async (savedWordId: string, limit = 20) => {
    if (!navigator.onLine) return { history: [], count: 0 };
    return vocabularyApi.reviewHistory(savedWordId, limit);
  }, []);

  // ── loadStats (offline-first) ──────────────────────────────────────────────
  const loadStats = useCallback(async () => {
    try {
      if (navigator.onLine) {
        const data = await vocabularyApi.stats();
        if (data) setProgress(data);
        return data;
      } else {
        const cached = await getCachedProgress();
        if (cached) setProgress(cached);
        return cached;
      }
    } catch {
      try {
        const cached = await getCachedProgress();
        if (cached) setProgress(cached);
        return cached;
      } catch {
        return null;
      }
    }
  }, [setProgress]);

  // ── deleteWord (offline-first) ─────────────────────────────────────────────
  const deleteWord = useCallback(async (savedId: string) => {
    // Remove from local state immediately (optimistic)
    const words = useStore.getState().savedWords;
    setSavedWords(words.filter(w => w.id !== savedId));
    await removeCachedWord(savedId);

    if (navigator.onLine) {
      await vocabularyApi.delete(savedId);
      const data = await vocabularyApi.list();
      if (data?.words) {
        setSavedWords(data.words);
        await cacheAllWords(data.words);
      }
    } else {
      // Enqueue delete for later sync
      await enqueueDelete(savedId);
    }
  }, [setSavedWords]);

  return {
    lookupWord,
    closeWordPopup,
    saveWord,
    loadVocabulary,
    loadVocabularyFilters,
    updateSavedWord,
    loadDueWords,
    reviewWord,
    loadReviewSummary,
    loadReviewHistory,
    loadStats,
    deleteWord,
  };
}
