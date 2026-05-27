/**
 * Word dictionary popup — bottom sheet on mobile, modal on desktop.
 * Shows: pronunciation, meaning (EN+AR), examples, synonyms, save button.
 * Auto-pause on open (controlled by store.autoPauseOnWord).
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useStore } from '@/store/appStore';
import { useDictionary } from '@/hooks/useDictionary';
import { useVideoPlayer } from '@/hooks/useVideoPlayer';
import { LevelBadge, Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { CEFRLevel } from '@/types';

const POS_COLORS: Record<string, string> = {
  noun:        'bg-sky-500/15 text-sky-400',
  verb:        'bg-green-500/15 text-green-400',
  adjective:   'bg-purple-500/15 text-purple-400',
  adverb:      'bg-orange-500/15 text-orange-400',
  preposition: 'bg-pink-500/15 text-pink-400',
  pronoun:     'bg-yellow-500/15 text-yellow-400',
  conjunction: 'bg-teal-500/15 text-teal-400',
  article:     'bg-rose-500/15 text-rose-400',
};

export default function WordPopup() {
  const { wordPopupOpen, selectedWord, wordPopupSentence, currentVideo } = useStore();
  const { closeWordPopup, saveWord } = useDictionary();
  const { seekTo, play } = useVideoPlayer();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // Reset saved state when word changes
  useEffect(() => { setSaved(false); }, [selectedWord?.word]);

  const speak = useCallback((text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.rate = 0.85;
      window.speechSynthesis.speak(u);
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!selectedWord || saving || saved) return;
    setSaving(true);
    const ok = await saveWord(
      selectedWord.word,
      currentVideo?.id,
      wordPopupSentence,
      `Learned from: ${currentVideo?.title || 'video'}`
    );
    if (ok) setSaved(true);
    setSaving(false);
  }, [selectedWord, saving, saved, saveWord, currentVideo, wordPopupSentence]);

  if (!wordPopupOpen || !selectedWord) return null;

  const posColor = POS_COLORS[selectedWord.part_of_speech?.toLowerCase()] ?? 'bg-slate-700 text-slate-300';

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={closeWordPopup}
      />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-800 rounded-t-3xl shadow-2xl max-h-[85vh] overflow-y-auto lg:left-auto lg:right-4 lg:bottom-4 lg:w-96 lg:rounded-2xl lg:border">

        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 lg:hidden">
          <div className="w-10 h-1 bg-slate-700 rounded-full" />
        </div>

        <div className="px-5 pb-6 pt-2">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h2 className="text-2xl font-bold text-white">{selectedWord.word}</h2>
                <LevelBadge level={selectedWord.level as CEFRLevel} />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {selectedWord.part_of_speech && selectedWord.part_of_speech !== 'unknown' && (
                  <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${posColor}`}>
                    {selectedWord.part_of_speech}
                  </span>
                )}
                {selectedWord.pronunciation && (
                  <span className="text-sm text-slate-400 font-mono">{selectedWord.pronunciation}</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 ml-2">
              <button
                onClick={() => speak(selectedWord.word)}
                className="p-2.5 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 transition-colors"
                title="Pronounce"
              >
                🔊
              </button>
              <button
                onClick={closeWordPopup}
                className="p-2.5 rounded-xl hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Meanings */}
          <div className="space-y-3">
            {selectedWord.meaning_ar && (
              <div className="bg-slate-800/60 rounded-xl px-4 py-3">
                <p className="text-xs text-slate-500 mb-1">Arabic Translation</p>
                <p className="text-lg font-semibold text-slate-100" style={{ direction: 'rtl', textAlign: 'right', unicodeBidi: 'isolate', fontFamily: "'Segoe UI', 'Noto Sans Arabic', Arial, sans-serif" }}>
                  {selectedWord.meaning_ar}
                </p>
              </div>
            )}

            {selectedWord.meaning_en && (
              <div>
                <p className="text-xs text-slate-500 mb-1">Definition</p>
                <p className="text-sm text-slate-300 leading-relaxed">{selectedWord.meaning_en}</p>
              </div>
            )}
          </div>

          {/* Context sentence */}
          {wordPopupSentence && (
            <div className="mt-4 px-4 py-3 bg-blue-500/8 border border-blue-500/20 rounded-xl">
              <p className="text-xs text-blue-400/70 mb-1">In context</p>
              <p className="text-sm text-slate-300 leading-relaxed">
                {wordPopupSentence.split(new RegExp(`(${selectedWord.word})`, 'i')).map((part, i) =>
                  part.toLowerCase() === selectedWord.word.toLowerCase()
                    ? <mark key={i} className="bg-blue-500/30 text-blue-300 rounded px-0.5">{part}</mark>
                    : <span key={i}>{part}</span>
                )}
              </p>
            </div>
          )}

          {/* Examples */}
          {selectedWord.examples?.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-slate-500 mb-2">Examples</p>
              <div className="space-y-2">
                {selectedWord.examples.slice(0, 3).map((ex, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-blue-500 mt-0.5 flex-shrink-0">•</span>
                    <p className="text-sm text-slate-400 leading-relaxed">{ex}</p>
                    <button
                      onClick={() => speak(ex)}
                      className="flex-shrink-0 text-slate-600 hover:text-slate-400 transition-colors text-xs mt-0.5"
                    >
                      🔊
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Synonyms / Antonyms */}
          {(selectedWord.synonyms?.length > 0 || selectedWord.antonyms?.length > 0) && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              {selectedWord.synonyms?.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 mb-2">Synonyms</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedWord.synonyms.slice(0, 4).map((s) => (
                      <span key={s} className="text-xs px-2 py-1 bg-green-500/10 text-green-400 rounded-lg border border-green-500/20">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {selectedWord.antonyms?.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 mb-2">Antonyms</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedWord.antonyms.slice(0, 4).map((a) => (
                      <span key={a} className="text-xs px-2 py-1 bg-red-500/10 text-red-400 rounded-lg border border-red-500/20">
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Conjugations */}
          {selectedWord.conjugations && Object.keys(selectedWord.conjugations).length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-slate-500 mb-2">Conjugations</p>
              <div className="grid grid-cols-2 gap-1.5">
                {Object.entries(selectedWord.conjugations).map(([k, v]) => (
                  <div key={k} className="flex justify-between items-center px-3 py-1.5 bg-slate-800/60 rounded-lg">
                    <span className="text-xs text-slate-500">{k}</span>
                    <span className="text-xs text-slate-300 font-medium">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Save button */}
          <div className="mt-5 flex gap-2">
            <Button
              onClick={handleSave}
              loading={saving}
              variant={saved ? 'secondary' : 'primary'}
              className="flex-1"
            >
              {saved ? '✓ Saved to vocabulary' : '+ Save word'}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
