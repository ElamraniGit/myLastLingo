import { useCallback } from 'react';
import { useStore } from '@/store/appStore';
import { dictionaryApi, vocabularyApi } from '@/lib/api';
import type { VocabularyListParams } from '@/types';

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

  const lookupWord = useCallback(async (word: string, sentence = '') => {
    const clean = word.replace(/[.,!?;:'"()[\]{}]/g, '').trim().toLowerCase();
    if (!clean || clean.length < 2) return;

    const wasPlaying = useStore.getState().playerState.playing;
    setResumeAfterWordPopup(wasPlaying);
    if (wasPlaying) updatePlayerState({ playing: false });
    setWordPopupSentence(sentence);

    try {
      const data = await dictionaryApi.lookup(clean);
      setSelectedWord(data);
      setWordPopupOpen(true);
    } catch {
      setResumeAfterWordPopup(false);
      if (wasPlaying) updatePlayerState({ playing: true });
    }
  }, [updatePlayerState, setSelectedWord, setWordPopupOpen, setWordPopupSentence, setResumeAfterWordPopup]);

  const closeWordPopup = useCallback(() => {
    const shouldResume = useStore.getState().resumeAfterWordPopup;
    setWordPopupOpen(false);
    setSelectedWord(null);
    setResumeAfterWordPopup(false);
    if (shouldResume) updatePlayerState({ playing: true });
  }, [setWordPopupOpen, setSelectedWord, setResumeAfterWordPopup, updatePlayerState]);

  const saveWord = useCallback(async (word: string, videoId?: string, sentence?: string, context?: string) => {
    try {
      await vocabularyApi.save(word, videoId, sentence, context);
      const data = await vocabularyApi.list();
      if (data?.words) setSavedWords(data.words);
      return true;
    } catch {
      return false;
    }
  }, [setSavedWords]);

  const loadVocabulary = useCallback(async (params: VocabularyListParams = {}) => {
    const data = await vocabularyApi.list(params);
    if (data?.words) setSavedWords(data.words);
    return data;
  }, [setSavedWords]);

  const loadVocabularyFilters = useCallback(async () => {
    return vocabularyApi.filters();
  }, []);

  const updateSavedWord = useCallback(async (savedId: string, data: { tags?: string[]; notes?: string; favorite?: boolean }) => {
    const result = await vocabularyApi.update(savedId, data);
    return result?.word;
  }, []);

  const loadDueWords = useCallback(async (limit = 20) => {
    try {
      const data = await vocabularyApi.due(limit);
      if (data?.words) setDueWords(data.words);
      return data;
    } catch {
      return { words: [], count: 0 };
    }
  }, [setDueWords]);

  const reviewWord = useCallback(async (savedWordId: string, quality: number) => {
    const result = await vocabularyApi.review(savedWordId, quality);
    try {
      const due = await vocabularyApi.due();
      if (due?.words) setDueWords(due.words);
    } catch {}
    try {
      const stats = await vocabularyApi.stats();
      if (stats) setProgress(stats);
    } catch {}
    try {
      const vocab = await vocabularyApi.list();
      if (vocab?.words) setSavedWords(vocab.words);
    } catch {}
    return result;
  }, [setDueWords, setProgress, setSavedWords]);

  const loadReviewSummary = useCallback(async () => {
    return vocabularyApi.reviewSummary();
  }, []);

  const loadReviewHistory = useCallback(async (savedWordId: string, limit = 20) => {
    return vocabularyApi.reviewHistory(savedWordId, limit);
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const data = await vocabularyApi.stats();
      if (data) setProgress(data);
      return data;
    } catch {
      return null;
    }
  }, [setProgress]);

  const deleteWord = useCallback(async (savedId: string) => {
    await vocabularyApi.delete(savedId);
    const data = await vocabularyApi.list();
    if (data?.words) setSavedWords(data.words);
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
