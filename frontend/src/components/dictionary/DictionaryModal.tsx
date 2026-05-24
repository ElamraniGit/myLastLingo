/**
 * Word dictionary modal with definitions, translations, and save functionality.
 * Bottom sheet style optimized for mobile.
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HiX,
  HiVolumeUp,
  HiBookmark,
  HiBookmarkAlt,
  HiTranslate,
  HiInformationCircle,
  HiStar,
  HiLightningBolt,
  HiCheck,
} from 'react-icons/hi';
import { useAppStore } from '@/store/appStore';
import { useDictionary } from '@/hooks/useDictionary';
import type { CEFRLevel } from '@/types';

const levelColors: Record<CEFRLevel, string> = {
  A1: 'badge-level-A1',
  A2: 'badge-level-A2',
  B1: 'badge-level-B1',
  B2: 'badge-level-B2',
  C1: 'badge-level-C1',
  C2: 'badge-level-C2',
};

const posColors: Record<string, string> = {
  noun: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  verb: 'bg-green-500/10 text-green-400 border-green-500/20',
  adjective: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  adverb: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  preposition: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  pronoun: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  conjunction: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  interjection: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  article: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
};

export default function DictionaryModal() {
  const { wordModalOpen, selectedWord, currentVideo } = useAppStore();
  const { closeWordModal, saveWord } = useDictionary();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = useCallback(async () => {
    if (!selectedWord) return;
    setSaving(true);
    try {
      await saveWord(
        selectedWord.word,
        currentVideo?.id,
        '', // sentence will be added from context
        `Learned from video: ${currentVideo?.title || 'unknown'}`
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }, [selectedWord, currentVideo, saveWord]);

  const speak = useCallback((text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      speechSynthesis.speak(utterance);
    }
  }, []);

  if (!selectedWord) return null;

  return (
    <AnimatePresence>
      {wordModalOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bottom-sheet-overlay"
            onClick={closeWordModal}
          />

          {/* Bottom sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="bottom-sheet"
          >
            {/* Handle */}
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 rounded-full bg-surface-600" />
            </div>

            <div className="px-6 pb-8 space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-2xl font-bold text-surface-100">{selectedWord.word}</h2>
                      <button
                        onClick={() => speak(selectedWord.word)}
                        className="btn-icon btn-ghost text-primary-400"
                      >
                        <HiVolumeUp className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`badge ${posColors[selectedWord.part_of_speech] || 'badge-primary'}`}>
                        {selectedWord.part_of_speech === 'unknown' ? 'كلمة' : selectedWord.part_of_speech}
                      </span>
                      <span className={`badge ${levelColors[selectedWord.level as CEFRLevel] || 'badge-primary'}`}>
                        {selectedWord.level}
                      </span>
                      {selectedWord.pronunciation && (
                        <span className="text-sm text-surface-400 font-mono">
                          {selectedWord.pronunciation}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button onClick={closeWordModal} className="btn-icon btn-ghost">
                  <HiX className="w-5 h-5" />
                </button>
              </div>

              {/* Meanings */}
              <div className="space-y-4">
                {/* Arabic meaning */}
                {selectedWord.meaning_ar && (
                  <div className="glass rounded-xl p-4">
                    <div className="flex items-center gap-2 text-surface-400 text-xs mb-2">
                      <HiTranslate className="w-4 h-4" />
                      <span>الترجمة للعربية</span>
                    </div>
                    <p className="text-xl font-semibold text-surface-100" dir="rtl">
                      {selectedWord.meaning_ar}
                    </p>
                  </div>
                )}

                {/* English meaning */}
                <div className="glass rounded-xl p-4">
                  <div className="flex items-center gap-2 text-surface-400 text-xs mb-2">
                    <HiInformationCircle className="w-4 h-4" />
                    <span>المعنى بالإنجليزية</span>
                  </div>
                  <p className="text-base text-surface-200 leading-relaxed">
                    {selectedWord.meaning_en}
                  </p>
                </div>
              </div>

              {/* Examples */}
              {selectedWord.examples && selectedWord.examples.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-surface-400 mb-3">أمثلة</h3>
                  <div className="space-y-2">
                    {selectedWord.examples.map((ex, i) => (
                      <div
                        key={i}
                        className="p-3 bg-surface-700/30 rounded-xl text-surface-300 text-sm leading-relaxed border border-surface-700/20"
                      >
                        {ex}
                        <button
                          onClick={() => speak(ex)}
                          className="btn-icon btn-ghost text-surface-500 float-left"
                        >
                          <HiVolumeUp className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Synonyms & Antonyms */}
              <div className="grid grid-cols-2 gap-4">
                {selectedWord.synonyms && selectedWord.synonyms.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-surface-400 mb-2">مرادفات</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedWord.synonyms.map((syn, i) => (
                        <span key={i} className="badge bg-green-500/10 text-green-400 border-green-500/20">
                          {syn}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedWord.antonyms && selectedWord.antonyms.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-surface-400 mb-2">أضداد</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedWord.antonyms.map((ant, i) => (
                        <span key={i} className="badge bg-red-500/10 text-red-400 border-red-500/20">
                          {ant}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Conjugations */}
              {selectedWord.conjugations && Object.keys(selectedWord.conjugations).length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-surface-400 mb-2">التصريفات</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(selectedWord.conjugations).map(([key, val]) => (
                      <div key={key} className="flex items-center justify-between p-2 bg-surface-700/20 rounded-lg">
                        <span className="text-xs text-surface-500">{key}</span>
                        <span className="text-sm text-surface-200">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Related words */}
              {selectedWord.related_words && selectedWord.related_words.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-surface-400 mb-2">كلمات مشابهة</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedWord.related_words.slice(0, 8).map((rw, i) => (
                      <span key={i} className="badge bg-primary-500/10 text-primary-400 border-primary-500/20">
                        {rw}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Save button */}
              <button
                onClick={handleSave}
                disabled={saving || saved}
                className={`w-full btn ${
                  saved
                    ? 'bg-green-500/20 text-green-400 border-green-500/30'
                    : 'btn-primary'
                } gap-2 py-3`}
              >
                {saved ? (
                  <>
                    <HiCheck className="w-5 h-5" />
                    تم الحفظ!
                  </>
                ) : (
                  <>
                    <HiBookmarkAlt className="w-5 h-5" />
                    {saving ? 'جاري الحفظ...' : 'حفظ الكلمة للمراجعة'}
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}