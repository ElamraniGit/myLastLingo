/**
 * Vocabulary management page - saved words with filtering and stats.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HiBookOpen,
  HiTrash,
  HiVolumeUp,
  HiFilter,
  HiSearch,
  HiChevronDown,
  HiStar,
} from 'react-icons/hi';
import { useDictionary } from '@/hooks/useDictionary';
import { useAppStore } from '@/store/appStore';
import type { SavedWord, CEFRLevel } from '@/types';

const levelColors: Record<string, string> = {
  A1: 'badge-level-A1', A2: 'badge-level-A2', B1: 'badge-level-B1',
  B2: 'badge-level-B2', C1: 'badge-level-C1', C2: 'badge-level-C2',
};

export default function VocabularyPage() {
  const { progress, loadStats } = useDictionary();
  const [words, setWords] = useState<SavedWord[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchWords = useCallback(async () => {
    setLoading(true);
    try {
      const data = await useDictionary().loadVocabulary(
        filter === 'all' ? undefined : filter
      );
      if (data?.words) setWords(data.words);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchWords();
    loadStats();
  }, [fetchWords, loadStats]);

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      speechSynthesis.speak(utterance);
    }
  };

  const filtered = words.filter(
    (w) => w.word.toLowerCase().includes(search.toLowerCase())
  );

  const tabs = [
    { id: 'all', label: 'الكل' },
    { id: 'learning', label: 'قيد التعلم' },
    { id: 'learned', label: 'متعلم' },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-100">مفرداتي</h1>
          <p className="text-surface-400 text-sm mt-1">
            {progress?.total_saved_words || 0} كلمة محفوظة
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            <div className="w-8 h-8 rounded-full bg-primary-500/20 border-2 border-surface-800 flex items-center justify-center">
              <span className="text-xs text-primary-400 font-bold">{progress?.learned_words || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'المجموع', value: progress?.total_saved_words || 0, color: 'text-primary-400' },
          { label: 'المتعلمة', value: progress?.learned_words || 0, color: 'text-green-400' },
          { label: 'للمراجعة', value: progress?.due_reviews || 0, color: 'text-yellow-400' },
        ].map((stat, i) => (
          <div key={i} className="glass rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-surface-400 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Level distribution */}
      {progress?.level_distribution && Object.keys(progress.level_distribution).length > 0 && (
        <div className="glass rounded-xl p-4">
          <h3 className="text-sm font-medium text-surface-400 mb-3">توزيع المستويات</h3>
          <div className="flex gap-2">
            {Object.entries(progress.level_distribution).map(([level, count]) => (
              <div key={level} className="flex-1">
                <div className="h-2 bg-surface-700 rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${
                      level === 'A1' ? 'bg-green-500' :
                      level === 'A2' ? 'bg-emerald-500' :
                      level === 'B1' ? 'bg-blue-500' :
                      level === 'B2' ? 'bg-violet-500' :
                      level === 'C1' ? 'bg-orange-500' : 'bg-red-500'
                    }`}
                    initial={{ width: 0 }}
                    animate={{ width: `${(count / Math.max(...Object.values(progress.level_distribution))) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-surface-400 text-center mt-1">{level}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search and filter tabs */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <HiSearch className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث في المفردات..."
            className="input pr-10"
            dir="rtl"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              filter === tab.id
                ? 'bg-primary-500/10 text-primary-400 border border-primary-500/20'
                : 'text-surface-400 hover:text-surface-200 hover:bg-surface-700/30'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Words list */}
      <div className="space-y-2">
        <AnimatePresence>
          {filtered.map((word, i) => (
            <motion.div
              key={word.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ delay: i * 0.03 }}
              className="glass rounded-xl p-4 flex items-center justify-between hover:bg-surface-700/40 transition-all duration-200 group"
            >
              <div className="flex items-center gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold text-surface-100">{word.word}</span>
                    <span className={`badge ${levelColors[word.level]}`}>{word.level}</span>
                    {word.part_of_speech && (
                      <span className="badge-primary text-xs">{word.part_of_speech}</span>
                    )}
                  </div>
                  <p className="text-sm text-surface-400 mt-1" dir="rtl">
                    {word.meaning_ar}
                  </p>
                  {word.sentence && (
                    <p className="text-xs text-surface-500 mt-1 line-clamp-1">{word.sentence}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => speak(word.word)}
                  className="btn-icon btn-ghost text-primary-400"
                >
                  <HiVolumeUp className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-1">
                  <HiStar className={`w-4 h-4 ${word.status === 'learned' ? 'text-yellow-400' : 'text-surface-600'}`} />
                  <span className="text-xs text-surface-500">
                    {word.repetitions}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {!loading && filtered.length === 0 && (
          <div className="text-center py-12 text-surface-400">
            <HiBookOpen className="w-12 h-12 mx-auto mb-3 text-surface-600" />
            <p>لا توجد كلمات هنا</p>
            <p className="text-sm mt-1">تعلم كلمات جديدة من الفيديوهات</p>
          </div>
        )}
      </div>
    </div>
  );
}