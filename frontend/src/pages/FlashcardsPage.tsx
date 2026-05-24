/**
 * Flashcards page for spaced repetition review.
 */

import React from 'react';
import FlashcardViewer from '@/components/flashcards/FlashcardViewer';

export default function FlashcardsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-surface-100">المراجعة الذكية</h1>
        <p className="text-surface-400 text-sm mt-1">
          راجع الكلمات بنظام التكرار المتباعد للحفظ الدائم
        </p>
      </div>

      <FlashcardViewer />
    </div>
  );
}