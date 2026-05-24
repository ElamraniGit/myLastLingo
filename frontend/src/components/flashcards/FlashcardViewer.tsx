/**
 * Flashcard viewer with spaced repetition review system.
 * Flip animation, swipe gestures, and quality rating.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HiVolumeUp,
  HiCheck,
  HiX,
  HiRefresh,
  HiEmojiHappy,
  HiEmojiSad,
  HiLightningBolt,
} from 'react-icons/hi';
import { useDictionary } from '@/hooks/useDictionary';
import type { SavedWord } from '@/types';

const qualityOptions = [
  { value: 0, label: 'نسيت', emoji: '😵', color: 'red' },
  { value: 1, label: 'صعب', emoji: '😓', color: 'orange' },
  { value: 3, label: 'متوسط', emoji: '🤔', color: 'yellow' },
  { value: 5, label: 'سهل', emoji: '😊', color: 'green' },
];

export default function FlashcardViewer() {
  const { dueWords, loadDueWords, reviewWord } = useDictionary();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [swiping, setSwiping] = useState(false);
  const [direction, setDirection] = useState<'left' | 'right' | null>(null);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    loadDueWords();
  }, [loadDueWords]);

  // Reset when new words loaded
  useEffect(() => {
    setCurrentIndex(0);
    setIsFlipped(false);
  }, [dueWords.length]);

  const currentWord = dueWords[currentIndex];

  const handleFlip = useCallback(() => {
    setIsFlipped((prev) => !prev);
  }, []);

  const handleReview = useCallback(
    async (quality: number) => {
      if (!currentWord) return;
      
      await reviewWord(currentWord.id, quality);
      
      // Show result briefly
      setShowResult(true);
      setTimeout(() => {
        setShowResult(false);
        if (currentIndex < dueWords.length - 1) {
          setCurrentIndex((prev) => prev + 1);
          setIsFlipped(false);
        } else {
          // Reload for more words
          loadDueWords();
        }
      }, 500);
    },
    [currentWord, currentIndex, dueWords.length, reviewWord, loadDueWords]
  );

  const speak = useCallback((text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      speechSynthesis.speak(utterance);
    }
  }, []);

  if (dueWords.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-20 h-20 rounded-full bg-surface-700/50 flex items-center justify-center">
          <HiEmojiHappy className="w-10 h-10 text-surface-400" />
        </div>
        <h3 className="text-xl font-semibold text-surface-200">ممتاز! 🎉</h3>
        <p className="text-surface-400 text-center max-w-sm">
          لا توجد كلمات للمراجعة الآن. عد لاحقًا أو تعلم كلمات جديدة من الفيديوهات.
        </p>
        <button onClick={loadDueWords} className="btn-secondary mt-2">
          <HiRefresh className="w-4 h-4" />
          تحديث
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      {/* Progress */}
      <div className="flex items-center justify-between mb-6">
        <span className="text-sm text-surface-400">
          {currentIndex + 1} / {dueWords.length}
        </span>
        <div className="flex items-center gap-2">
          <HiLightningBolt className="w-4 h-4 text-yellow-400" />
          <span className="text-sm text-surface-400">مراجعة ذكية</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-surface-700 rounded-full mb-8 overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-primary-500 to-accent-500 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${((currentIndex + 1) / dueWords.length) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Flashcard */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentWord?.id}
          initial={{ opacity: 0, x: 200 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -200 }}
          className="flashcard"
          onClick={handleFlip}
        >
          <div className={`flashcard-inner ${isFlipped ? 'flipped' : ''}`}>
            {/* Front */}
            <div className="flashcard-front">
              <div className="flex items-center gap-3 mb-4">
                {currentWord?.part_of_speech && (
                  <span className="badge-primary text-xs">{currentWord.part_of_speech}</span>
                )}
                {currentWord?.level && (
                  <span className={`badge badge-level-${currentWord.level}`}>
                    {currentWord.level}
                  </span>
                )}
              </div>

              <h2 className="text-4xl font-bold text-surface-100 mb-3 text-center">
                {currentWord?.word}
              </h2>

              {currentWord?.pronunciation && (
                <p className="text-surface-400 font-mono text-lg">{currentWord.pronunciation}</p>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  speak(currentWord?.word || '');
                }}
                className="btn-icon btn-ghost text-primary-400 mt-4"
              >
                <HiVolumeUp className="w-6 h-6" />
              </button>

              <p className="text-surface-500 text-sm mt-6">اضغط للاطلاع على المعنى</p>
            </div>

            {/* Back */}
            <div className="flashcard-back">
              <div className="text-center space-y-4 w-full">
                {/* Arabic meaning */}
                <div>
                  <p className="text-xs text-surface-500 mb-1">الترجمة</p>
                  <p className="text-2xl font-semibold text-surface-100" dir="rtl">
                    {currentWord?.meaning_ar || 'غير متوفرة'}
                  </p>
                </div>

                {/* English meaning */}
                {currentWord?.meaning_en && (
                  <div>
                    <p className="text-xs text-surface-500 mb-1">المعنى</p>
                    <p className="text-base text-surface-300">{currentWord.meaning_en}</p>
                  </div>
                )}

                {/* Example */}
                {currentWord?.examples?.[0] && (
                  <div className="glass rounded-xl p-3 mt-2">
                    <p className="text-sm text-surface-300 leading-relaxed">{currentWord.examples[0]}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Rating buttons - shown when flipped */}
      <AnimatePresence>
        {isFlipped && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8"
          >
            <p className="text-center text-sm text-surface-400 mb-4">
              كيف كانت درجة تذكرك لهذه الكلمة؟
            </p>
            <div className="flex justify-center gap-3">
              {qualityOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleReview(opt.value)}
                  className="flex flex-col items-center gap-2 p-4 rounded-2xl glass-hover glass transition-all duration-200 hover:scale-105 min-w-[70px]"
                >
                  <span className="text-2xl">{opt.emoji}</span>
                  <span className="text-xs text-surface-400">{opt.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}