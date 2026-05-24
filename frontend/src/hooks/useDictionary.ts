/**
 * Hook for dictionary lookups and vocabulary management.
 */

import { useState, useCallback } from 'react';
import { useAppStore } from '@/store/appStore';
import api from '@/services/api';
import type { Word, SavedWord } from '@/types';

export function useDictionary() {
  const {
    selectedWord,
    setSelectedWord,
    wordModalOpen,
    setWordModalOpen,
    setLoading,
    setError,
    savedWords,
    addSavedWord,
    dueWords,
    setDueWords,
    progress,
    setProgress,
  } = useAppStore();

  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);

  // Look up a word
  const lookupWord = useCallback(
    async (word: string) => {
      setLoading(true);
      try {
        const data = await api.dictionary.lookup(word);
        setSelectedWord(data);
        setWordModalOpen(true);
        return data;
      } catch (err: any) {
        setError(err.message || 'Word lookup failed');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [setSelectedWord, setWordModalOpen, setLoading, setError]
  );

  // Search dictionary
  const searchDictionary = useCallback(async (query: string) => {
    try {
      const data = await api.dictionary.search(query);
      setSearchResults(data.results || []);
      return data;
    } catch {
      setSearchResults([]);
      return null;
    }
  }, []);

  // Get suggestions
  const getSuggestions = useCallback(async (prefix: string) => {
    if (prefix.length < 2) {
      setSuggestions([]);
      return;
    }
    try {
      const data = await api.dictionary.suggest(prefix);
      setSuggestions(data.suggestions || []);
    } catch {
      setSuggestions([]);
    }
  }, []);

  // Save word to vocabulary
  const saveWord = useCallback(
    async (
      word: string,
      videoId?: string,
      sentence?: string,
      context?: string
    ) => {
      try {
        const data = await api.vocabulary.save(word, videoId, sentence, context);
        // Refresh saved words
        const wordsData = await api.vocabulary.list();
        if (wordsData?.words) {
          useAppStore.getState().setSavedWords(wordsData.words);
        }
        return data;
      } catch (err: any) {
        setError(err.message || 'Failed to save word');
        return null;
      }
    },
    [setError]
  );

  // Review a word
  const reviewWord = useCallback(
    async (savedWordId: string, quality: number) => {
      try {
        await api.vocabulary.review(savedWordId, quality);
        // Refresh due words
        const dueData = await api.vocabulary.due();
        if (dueData?.words) {
          setDueWords(dueData.words);
        }
        // Refresh stats
        const statsData = await api.vocabulary.stats();
        if (statsData) {
          setProgress(statsData);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to record review');
      }
    },
    [setDueWords, setProgress, setError]
  );

  // Load due words
  const loadDueWords = useCallback(async () => {
    try {
      const data = await api.vocabulary.due();
      if (data?.words) {
        setDueWords(data.words);
      }
    } catch {
      // Silent fail
    }
  }, [setDueWords]);

  // Load vocabulary list
  const loadVocabulary = useCallback(
    async (status?: string, page = 1) => {
      try {
        const data = await api.vocabulary.list(status, page);
        if (data?.words) {
          useAppStore.getState().setSavedWords(data.words);
        }
        return data;
      } catch {
        return null;
      }
    },
    []
  );

  // Load stats
  const loadStats = useCallback(async () => {
    try {
      const data = await api.vocabulary.stats();
      if (data) {
        setProgress(data);
      }
      return data;
    } catch {
      return null;
    }
  }, [setProgress]);

  // Close word modal
  const closeWordModal = useCallback(() => {
    setWordModalOpen(false);
    setSelectedWord(null);
  }, [setWordModalOpen, setSelectedWord]);

  return {
    // State
    selectedWord,
    wordModalOpen,
    searchResults,
    suggestions,
    savedWords,
    dueWords,
    progress,
    // Actions
    lookupWord,
    searchDictionary,
    getSuggestions,
    saveWord,
    reviewWord,
    loadDueWords,
    loadVocabulary,
    loadStats,
    closeWordModal,
  };
}