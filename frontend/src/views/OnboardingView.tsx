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
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  features: { icon: React.ReactNode; text: string }[];
  gradient: string;
  dotColor: string;
}

const SLIDES: Slide[] = [
  {
    icon: (<svg className='w-12 h-12 text-blue-400' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round'><path d='M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8'/><path d='M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15'/></svg>),
    title: 'Welcome to LinguaLearn!',
    subtitle: 'Your personal English coach — powered by real content you enjoy.',
    features: [
      { icon: (<svg className='w-4 h-4 text-purple-400' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round'><rect x='1' y='4' width='15' height='16' rx='2'/><polygon points='16 9 23 4 23 20 16 15 16 9'/></svg>), text: 'Learn from YouTube videos with interactive subtitles' },
      { icon: (<svg className='w-4 h-4 text-blue-400' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round'><rect x='3' y='3' width='5' height='18' rx='1'/><rect x='10' y='3' width='5' height='18' rx='1'/><path d='M17 3l4 2v14l-4 2V3z'/></svg>), text: 'Build a personal vocabulary with spaced repetition' },
      { icon: (<svg className='w-4 h-4 text-green-400' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round'><path d='M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'/></svg>), text: 'Chat with an AI tutor that knows your words' },
      { icon: (<svg className='w-4 h-4 text-amber-400' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round'><line x1='1' y1='1' x2='23' y2='23'/><path d='M8.53 16.11a6 6 0 0 1 6.95 0'/><circle cx='12' cy='20' r='1' fill='currentColor' stroke='none'/></svg>), text: 'Works offline — your data stays on your device' },
    ],
    gradient: 'from-blue-600/20 to-indigo-600/20',
    dotColor: 'bg-blue-500',
  },
  {
    icon: (<svg className='w-12 h-12 text-purple-400' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round'><rect x='1' y='4' width='15' height='16' rx='2'/><polygon points='16 9 23 4 23 20 16 15 16 9'/></svg>),
    title: 'Learn from Real Videos',
    subtitle: 'Paste any YouTube URL. Tap any word to instantly look it up.',
    features: [
      { icon: (<svg className='w-4 h-4 text-blue-300' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round'><path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'/><polyline points='14 2 14 8 20 8'/><line x1='16' y1='13' x2='8' y2='13'/></svg>), text: 'Synchronized subtitles — follow along word by word' },
      { icon: (<svg className='w-4 h-4 text-purple-300' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round'><polygon points='11 5 6 9 2 9 2 15 6 15 11 19 11 5' fill='currentColor' stroke='none' opacity='0.9'/><path d='M15.54 8.46a5 5 0 0 1 0 7.07'/></svg>), text: 'Neural TTS — hear any word or sentence pronounced' },
      { icon: (<svg className='w-4 h-4 text-amber-300' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round'><path d='M9 18h6M10 22h4'/><path d='M12 2a7 7 0 0 1 7 7c0 2.87-1.7 5.27-4 6.46V17a1 1 0 0 1-1 1H10a1 1 0 0 1-1-1v-1.54C6.7 14.27 5 11.87 5 9a7 7 0 0 1 7-7z'/></svg>), text: 'Tap a word → definition, translation, examples' },
      { icon: (<svg className='w-4 h-4 text-green-300' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round'><line x1='12' y1='5' x2='12' y2='19'/><line x1='5' y1='12' x2='19' y2='12'/></svg>), text: 'Save words to your vocabulary with one tap' },
    ],
    gradient: 'from-red-600/15 to-orange-600/15',
    dotColor: 'bg-red-500',
  },
  {
    icon: (<svg className='w-12 h-12 text-green-400' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round'><rect x='2' y='4' width='20' height='16' rx='3'/><path d='M8 10h8M8 14h5'/><circle cx='18' cy='14' r='2' fill='currentColor' stroke='none'/></svg>),
    title: 'Master Words with Flashcards',
    subtitle: 'Our SM-2 algorithm shows you words exactly when you need to review them.',
    features: [
      { icon: (<svg className='w-4 h-4 text-blue-300' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round'><polyline points='17 1 21 5 17 9'/><path d='M3 11V9a4 4 0 0 1 4-4h14'/><polyline points='7 23 3 19 7 15'/><path d='M21 13v2a4 4 0 0 1-4 4H3'/></svg>), text: 'Spaced repetition — never forget what you learned' },
      { icon: (<svg className='w-4 h-4 text-purple-300' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round'><circle cx='12' cy='12' r='10'/><path d='M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3'/><line x1='12' y1='17' x2='12.01' y2='17' strokeWidth='2.5'/></svg>), text: 'Quiz mode: definition, fill-in-the-blank, word match' },
      { icon: '⭐', text: 'Earn XP for every review — level up your English' },
      { icon: (<svg className='w-4 h-4 text-orange-400' viewBox='0 0 24 24' fill='currentColor'><path d='M12 22a7 7 0 0 1-7-7c0-4.5 3-7.5 4-10 1.5 2 2 4 2 6.5C12 9 14 7 15 4c2 3.5 3 5 3 7a7 7 0 0 1-6 6.93V22z'/></svg>), text: 'Daily streaks keep you consistent and motivated' },
    ],
    gradient: 'from-green-600/15 to-emerald-600/15',
    dotColor: 'bg-green-500',
  },
  {
    icon: (<svg className='w-12 h-12 text-amber-400' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round'><line x1='18' y1='20' x2='18' y2='10'/><line x1='12' y1='20' x2='12' y2='4'/><line x1='6' y1='20' x2='6' y2='14'/><line x1='2' y1='20' x2='22' y2='20'/></svg>),
    title: 'Track Every Step',
    subtitle: 'See your progress with beautiful charts and real statistics.',
    features: [
      { icon: (<svg className='w-4 h-4 text-green-400' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round'><polyline points='23 6 13.5 15.5 8.5 10.5 1 18'/><polyline points='17 6 23 6 23 12'/></svg>), text: 'Activity heatmap — 30 days of your learning history' },
      { icon: (<svg className='w-4 h-4 text-blue-300' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round'><path d='M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z'/><line x1='7' y1='7' x2='7.01' y2='7' strokeWidth='3'/></svg>), text: 'CEFR levels — from A1 beginner to C2 mastery' },
      { icon: (<svg className='w-4 h-4 text-yellow-400' viewBox='0 0 24 24' fill='currentColor'><polygon points='13 2 3 14 12 14 11 22 21 10 12 10 13 2'/></svg>), text: 'Hardest words — focus on what needs work' },
      { icon: (<svg className='w-4 h-4 text-purple-300' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round'><path d='M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9'/><path d='M13.73 21a2 2 0 0 1-3.46 0'/></svg>), text: 'Smart reminders — never miss a review session' },
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
              {slide.icon}
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
                Get Started
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
            <span className="ml-1">· Hi, {user.display_name.split(' ')[0]}!</span>
          )}
        </p>
      </div>
    </div>
  );
}
