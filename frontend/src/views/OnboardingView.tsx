/**
 * OnboardingView — Feature tour for new users.
 *
 * 4 slides (swipeable dots):
 *  1. Welcome — شرح التطبيق باختصار
 *  2. Learn from Videos — كيف تعمل المشغّل والترجمة
 *  3. Build Your Vocabulary — SM-2 + flashcards
 *  4. Track Your Progress — Stats + streaks + XP
 *
 * Controls:
 *  - Next / Skip / Get Started buttons
 *  - Dot indicators
 *  - Keyboard: ArrowRight / ArrowLeft / Enter
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '@/store/appStore';

interface Slide {
  emoji: string;
  title: string;
  subtitle: string;
  features: { icon: string; text: string }[];
  gradient: string;
  dotColor: string;
}

const SLIDES: Slide[] = [
  {
    emoji: '👋',
    title: 'Welcome to LinguaLearn!',
    subtitle: 'Your personal English coach — powered by real content you enjoy.',
    features: [
      { icon: '🎬', text: 'Learn from YouTube videos with interactive subtitles' },
      { icon: '📚', text: 'Build a personal vocabulary with spaced repetition' },
      { icon: '🤖', text: 'Chat with an AI tutor that knows your words' },
      { icon: '📵', text: 'Works offline — your data stays on your device' },
    ],
    gradient: 'from-blue-600/20 to-indigo-600/20',
    dotColor: 'bg-blue-500',
  },
  {
    emoji: '🎬',
    title: 'Learn from Real Videos',
    subtitle: 'Paste any YouTube URL. Tap any word to instantly look it up.',
    features: [
      { icon: '📝', text: 'Synchronized subtitles — follow along word by word' },
      { icon: '🔊', text: 'Neural TTS — hear any word or sentence pronounced' },
      { icon: '💡', text: 'Tap a word → definition, translation, examples' },
      { icon: '➕', text: 'Save words to your vocabulary with one tap' },
    ],
    gradient: 'from-red-600/15 to-orange-600/15',
    dotColor: 'bg-red-500',
  },
  {
    emoji: '🃏',
    title: 'Master Words with Flashcards',
    subtitle: 'Our SM-2 algorithm shows you words exactly when you need to review them.',
    features: [
      { icon: '🔁', text: 'Spaced repetition — never forget what you learned' },
      { icon: '❓', text: 'Quiz mode: definition, fill-in-the-blank, word match' },
      { icon: '⭐', text: 'Earn XP for every review — level up your English' },
      { icon: '🔥', text: 'Daily streaks keep you consistent and motivated' },
    ],
    gradient: 'from-green-600/15 to-emerald-600/15',
    dotColor: 'bg-green-500',
  },
  {
    emoji: '📊',
    title: 'Track Every Step',
    subtitle: 'See your progress with beautiful charts and real statistics.',
    features: [
      { icon: '📈', text: 'Activity heatmap — 30 days of your learning history' },
      { icon: '🗂️', text: 'CEFR levels — from A1 beginner to C2 mastery' },
      { icon: '⚡', text: 'Hardest words — focus on what needs work' },
      { icon: '🔔', text: 'Smart reminders — never miss a review session' },
    ],
    gradient: 'from-purple-600/15 to-violet-600/15',
    dotColor: 'bg-purple-500',
  },
];

export default function OnboardingView() {
  const { setPage, setHasCompletedOnboarding, user } = useStore();
  const [current, setCurrent] = useState(0);
  const [animDir, setAnimDir] = useState<'next' | 'prev'>('next');
  const [visible, setVisible] = useState(true);

  const isLast = current === SLIDES.length - 1;
  const slide  = SLIDES[current];

  const finish = useCallback(() => {
    setHasCompletedOnboarding(true);
    setPage('player');
  }, [setHasCompletedOnboarding, setPage]);

  const goTo = useCallback((idx: number, dir: 'next' | 'prev' = 'next') => {
    setVisible(false);
    setAnimDir(dir);
    setTimeout(() => {
      setCurrent(idx);
      setVisible(true);
    }, 200);
  }, []);

  const next = useCallback(() => {
    if (isLast) finish();
    else goTo(current + 1, 'next');
  }, [current, isLast, finish, goTo]);

  const prev = useCallback(() => {
    if (current > 0) goTo(current - 1, 'prev');
  }, [current, goTo]);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') next();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'Escape') finish();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, finish]);

  // Touch swipe support
  let touchStart = 0;
  const onTouchStart = (e: React.TouchEvent) => { touchStart = e.touches[0].clientX; };
  const onTouchEnd   = (e: React.TouchEvent) => {
    const delta = touchStart - e.changedTouches[0].clientX;
    if (Math.abs(delta) > 50) { if (delta > 0) next(); else prev(); }
  };

  return (
    <div
      className="min-h-screen bg-base flex flex-col"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Background gradient */}
      <div className={`fixed inset-0 bg-gradient-to-br ${slide.gradient} transition-all duration-500 pointer-events-none`} />

      {/* Skip button */}
      <div className="relative flex justify-end px-5 pt-5">
        <button
          onClick={finish}
          className="text-sm text-muted hover:text-body px-3 py-1.5 rounded-lg hover:bg-card transition-colors"
        >
          Skip →
        </button>
      </div>

      {/* Slide content */}
      <div className="relative flex-1 flex flex-col items-center justify-center px-6 pb-6">
        <div
          className={`w-full max-w-sm transition-all duration-200 ${
            visible
              ? 'opacity-100 translate-y-0'
              : animDir === 'next'
              ? 'opacity-0 translate-y-4'
              : 'opacity-0 -translate-y-4'
          }`}
        >
          {/* Emoji icon */}
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 rounded-3xl bg-card border border-default flex items-center justify-center text-5xl shadow-xl animate-pop-in">
              {slide.emoji}
            </div>
          </div>

          {/* Title + subtitle */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-heading tracking-tight mb-2">
              {slide.title}
            </h1>
            <p className="text-sm text-muted leading-relaxed">
              {slide.subtitle}
            </p>
          </div>

          {/* Feature list */}
          <div className="space-y-3">
            {slide.features.map((f, i) => (
              <div
                key={i}
                className="flex items-center gap-3 bg-card border border-default rounded-2xl px-4 py-3 animate-fade-in"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <span className="text-xl shrink-0">{f.icon}</span>
                <span className="text-sm text-body">{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom controls */}
      <div className="relative px-5 pb-10 pt-4 space-y-5">

        {/* Dot indicators */}
        <div className="flex items-center justify-center gap-2">
          {SLIDES.map((s, i) => (
            <button
              key={i}
              onClick={() => goTo(i, i > current ? 'next' : 'prev')}
              className={`rounded-full transition-all duration-300 ${
                i === current
                  ? `w-6 h-2 ${s.dotColor}`
                  : 'w-2 h-2 bg-elevated hover:bg-muted'
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>

        {/* Nav buttons */}
        <div className="flex items-center gap-3 max-w-sm mx-auto w-full">
          {current > 0 && (
            <button
              onClick={prev}
              className="w-12 h-12 rounded-2xl border border-default text-muted hover:text-body hover:bg-card flex items-center justify-center transition-all shrink-0"
              aria-label="Previous"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="w-5 h-5">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
          )}

          <button
            onClick={next}
            className="flex-1 h-12 rounded-2xl font-semibold text-sm text-white bg-blue-600
                       hover:bg-blue-500 active:scale-[0.97] transition-all shadow-lg shadow-blue-600/25
                       flex items-center justify-center gap-2"
          >
            {isLast ? (
              <>
                🚀 Get Started
              </>
            ) : (
              <>
                Next
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="w-4 h-4">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </>
            )}
          </button>
        </div>

        {/* Slide counter */}
        <p className="text-center text-[11px] text-faint">
          {current + 1} of {SLIDES.length}
          {user?.display_name && current === 0 && (
            <span className="ml-1">· Hi, {user.display_name.split(' ')[0]}! 👋</span>
          )}
        </p>
      </div>
    </div>
  );
}
