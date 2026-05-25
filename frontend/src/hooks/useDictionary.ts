import { useCallback } from 'react';
import { useStore } from '@/store/appStore';
import { dictionaryApi, vocabularyApi } from '@/lib/api';

export function useDictionary() {
  const {
    setSelectedWord, setWordPopupOpen, setWordPopupSentence,
    setSavedWords, setDueWords, setProgress,
    autoPauseOnWord, updatePlayerState,
  } = useStore();

  const lookupWord = useCallback(async (word: string, sentence = '') => {
    const clean = word.replace(/[.,!?;:'"()[\]{}]/g, '').trim().toLowerCase();
    if (!clean || clean.length < 2) return;
    if (autoPauseOnWord) updatePlayerState({ playing: false });
    setWordPopupSentence(sentence);
    try {
      const data = await dictionaryApi.lookup(clean);
      setSelectedWord(data);
      setWordPopupOpen(true);
    } catch {}
  }, [autoPauseOnWord, updatePlayerState, setSelectedWord, setWordPopupOpen, setWordPopupSentence]);

  const closeWordPopup = useCallback(() => {
    setWordPopupOpen(false);
    setSelectedWord(null);
  }, [setWordPopupOpen, setSelectedWord]);

  const saveWord = useCallback(async (word: string, videoId?: string, sentence?: string, context?: string) => {
    try {
      await vocabularyApi.save(word, videoId, sentence, context);
      const data = await vocabularyApi.list();
      if (data?.words) setSavedWords(data.words);
      return true;
    } catch { return false; }
  }, [setSavedWords]);

  const loadVocabulary = useCallback(async (status?: string, page = 1) => {
    const data = await vocabularyApi.list(status, page);
    if (data?.words) setSavedWords(data.words);
    return data;
  }, [setSavedWords]);

  const loadDueWords = useCallback(async () => {
    try { const data = await vocabularyApi.due(); if (data?.words) setDueWords(data.words); } catch {}
  }, [setDueWords]);

  const reviewWord = useCallback(async (savedWordId: string, quality: number) => {
    await vocabularyApi.review(savedWordId, quality);
    try { const data = await vocabularyApi.due(); if (data?.words) setDueWords(data.words); } catch {}
    try { const data = await vocabularyApi.stats(); if (data) setProgress(data); } catch {}
  }, [setDueWords, setProgress]);

  const loadStats = useCallback(async () => {
    try { const data = await vocabularyApi.stats(); if (data) setProgress(data); } catch {}
  }, [setProgress]);

  const deleteWord = useCallback(async (savedId: string) => {
    await vocabularyApi.delete(savedId);
    const data = await vocabularyApi.list();
    if (data?.words) setSavedWords(data.words);
  }, [setSavedWords]);

  return { lookupWord, closeWordPopup, saveWord, loadVocabulary, loadDueWords, reviewWord, loadStats, deleteWord };
}
