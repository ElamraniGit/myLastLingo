/**
 * Spaced repetition flashcard review — SM-2 algorithm.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useStore } from '@/store/appStore';
import { useDictionary } from '@/hooks/useDictionary';
import { LevelBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

const QUALITY_OPTIONS = [
  { value: 1, label: 'Hard',   emoji: '😓', cls: 'border-red-500/30 hover:bg-red-500/10 hover:border-red-500/50' },
  { value: 3, label: 'Good',   emoji: '🤔', cls: 'border-yellow-500/30 hover:bg-yellow-500/10 hover:border-yellow-500/50' },
  { value: 4, label: 'Easy',   emoji: '😊', cls: 'border-green-500/30 hover:bg-green-500/10 hover:border-green-500/50' },
  { value: 5, label: 'Perfect',emoji: '🎯', cls: 'border-blue-500/30 hover:bg-blue-500/10 hover:border-blue-500/50' },
];

function speak(text: string) {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US'; u.rate = 0.85;
    window.speechSynthesis.speak(u);
  }
}

export default function FlashcardsView() {
  const { dueWords } = useStore();
  const { loadDueWords, reviewWord } = useDictionary();

  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(0);

  useEffect(() => { loadDueWords(); }, []); // eslint-disable-line
  useEffect(() => { setIdx(0); setFlipped(false); setDone(0); }, [dueWords.length]);

  const current = dueWords[idx];

  const handleReview = useCallback(async (quality: number) => {
    if (!current) return;
    await reviewWord(current.id, quality);
    setDone((d) => d + 1);
    if (idx < dueWords.length - 1) {
      setIdx(idx + 1);
      setFlipped(false);
    } else {
      loadDueWords();
    }
  }, [current, idx, dueWords.length, reviewWord, loadDueWords]);

  if (dueWords.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <div className="text-6xl mb-5">🎉</div>
        <h2 className="text-2xl font-bold text-white mb-2">All caught up!</h2>
        <p className="text-slate-400 max-w-sm">
          No words due for review right now. Keep learning new words from videos and come back later.
        </p>
        <Button onClick={loadDueWords} variant="outline" className="mt-6">
          Refresh
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-white">Flashcard Review</h1>
          <p className="text-slate-400 text-sm">{dueWords.length} words due today</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-green-400">{done}</p>
          <p className="text-xs text-slate-500">reviewed</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-slate-800 rounded-full mb-6 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
          style={{ width: dueWords.length > 0 ? `${(idx / dueWords.length) * 100}%` : 0 }}
        />
      </div>

      {/* Card */}
      <div
        className="relative cursor-pointer select-none"
        style={{ perspective: 1000, minHeight: 260 }}
        onClick={() => setFlipped(!flipped)}
      >
        {/* Front */}
        <div className={`absolute inset-0 transition-all duration-500 backface-hidden ${flipped ? 'opacity-0 rotate-y-180' : 'opacity-100'}`}
          style={{ backfaceVisibility: 'hidden' }}>
          <div className="bg-slate-800/80 border border-slate-700 rounded-3xl p-8 flex flex-col items-center justify-center h-full min-h-[260px] shadow-2xl">
            {current?.level && <LevelBadge level={current.level} />}
            <h2 className="text-5xl font-bold text-white mt-4 mb-3">{current?.word}</h2>
            {current?.pronunciation && (
              <p className="text-slate-400 font-mono text-lg">{current.pronunciation}</p>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); speak(current?.word ?? ''); }}
              className="mt-5 p-3 rounded-2xl bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 transition-colors"
            >
              🔊
            </button>
            {current?.part_of_speech && current.part_of_speech !== 'unknown' && (
              <p className="text-xs text-slate-600 mt-3">{current.part_of_speech}</p>
            )}
            <p className="text-sm text-slate-600 mt-4">Tap to reveal meaning</p>
          </div>
        </div>

        {/* Back */}
        <div className={`absolute inset-0 transition-all duration-500 ${flipped ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <div className="bg-slate-800/80 border border-blue-500/20 rounded-3xl p-8 flex flex-col items-center justify-center h-full min-h-[260px] shadow-2xl">
            <p className="text-xs text-slate-500 mb-2">Arabic meaning</p>
            {current?.meaning_ar ? (
              <p className="text-3xl font-bold text-white mb-3" dir="rtl">{current.meaning_ar}</p>
            ) : (
              <p className="text-slate-500 mb-3">No Arabic translation</p>
            )}
            {current?.meaning_en && (
              <p className="text-sm text-slate-400 text-center max-w-xs leading-relaxed mb-3">
                {current.meaning_en}
              </p>
            )}
            {current?.examples?.[0] && (
              <div className="w-full bg-slate-900/50 rounded-xl px-4 py-3 mt-1">
                <p className="text-sm text-slate-400 leading-relaxed italic">
                  "{current.examples[0]}"
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quality buttons — only shown when flipped */}
      {flipped && (
        <div className="mt-6">
          <p className="text-center text-sm text-slate-500 mb-4">How well did you remember it?</p>
          <div className="grid grid-cols-4 gap-2">
            {QUALITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleReview(opt.value)}
                className={`flex flex-col items-center gap-2 p-3 rounded-2xl border border-slate-700 bg-slate-800/50 transition-all duration-200 hover:scale-105 active:scale-95 ${opt.cls}`}
              >
                <span className="text-2xl">{opt.emoji}</span>
                <span className="text-xs font-medium text-slate-400">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {!flipped && (
        <div className="mt-6 text-center">
          <button
            onClick={() => setFlipped(true)}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-all active:scale-95 shadow-lg shadow-blue-500/20"
          >
            Show Answer
          </button>
        </div>
      )}

      {/* Card counter */}
      <p className="text-center text-xs text-slate-600 mt-5">{idx + 1} of {dueWords.length}</p>
    </div>
  );
}
