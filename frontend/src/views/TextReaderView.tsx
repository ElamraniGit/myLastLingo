/**
 * Text Reader — interactive reading with word lookup.
 * Click any word → dictionary popup.
 * Read aloud with natural-sounding TTS.
 * Highlights the word being read.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useStore } from '@/store/appStore';
import { libraryApi } from '@/lib/api';
import { useDictionary } from '@/hooks/useDictionary';
import { Button } from '@/components/ui/Button';
import WordPopup from '@/components/dictionary/WordPopup';
import { awardXP } from '@/components/common/XPBar';

interface TextSource {
  id: string;
  title: string;
  content: string;
  word_count?: number;
}

export default function TextReaderView() {
  const { currentTextId, setPage } = useStore();
  const { lookupWord } = useDictionary();
  const [source, setSource] = useState<TextSource | null>(null);
  const [loading, setLoading] = useState(true);
  const [reading, setReading] = useState(false);
  const [currentWordIdx, setCurrentWordIdx] = useState(-1);
  const [speed, setSpeed] = useState(0.85);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const wordsRef = useRef<string[]>([]);

  // Load text content
  useEffect(() => {
    if (!currentTextId) { setLoading(false); return; }
    setLoading(true);
    libraryApi.getText(currentTextId)
      .then(d => { setSource(d); wordsRef.current = (d.content || '').split(/\s+/); })
      .catch(() => setSource(null))
      .finally(() => setLoading(false));
  }, [currentTextId]);

  // Cleanup TTS on unmount
  useEffect(() => {
    return () => { window.speechSynthesis?.cancel(); };
  }, []);

  const handleWordClick = useCallback((word: string) => {
    const clean = word.replace(/[^a-zA-Z'-]/g, '').trim();
    if (clean.length >= 2) {
      lookupWord(clean, '');
    }
  }, [lookupWord]);

  // ── Read Aloud ──────────────────────────────────────────────────
  const startReading = useCallback((fromIndex = 0) => {
    if (!source || typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();
    const words = wordsRef.current;
    const text = words.slice(fromIndex).join(' ');

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = speed;
    utterance.pitch = 1.0;

    // Try to find a natural-sounding voice
    const voices = window.speechSynthesis.getVoices();
    const natural = voices.find(v =>
      v.lang.startsWith('en') && (
        v.name.includes('Natural') ||
        v.name.includes('Enhanced') ||
        v.name.includes('Google') ||
        v.name.includes('Samantha') ||
        v.name.includes('Daniel')
      )
    ) || voices.find(v => v.lang.startsWith('en-US')) || voices[0];

    if (natural) utterance.voice = natural;

    // Track word boundaries for highlighting
    let wordIndex = fromIndex;
    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        // Estimate which word we're on based on char index
        const charIdx = event.charIndex;
        let chars = 0;
        for (let i = fromIndex; i < words.length; i++) {
          if (chars >= charIdx) { wordIndex = i; break; }
          chars += words[i].length + 1;
        }
        setCurrentWordIdx(wordIndex);
      }
    };

    utterance.onend = () => {
      setReading(false);
      setCurrentWordIdx(-1);
      awardXP('watch_minute');
    };

    utterance.onerror = () => {
      setReading(false);
      setCurrentWordIdx(-1);
    };

    utteranceRef.current = utterance;
    setReading(true);
    setCurrentWordIdx(fromIndex);
    window.speechSynthesis.speak(utterance);
  }, [source, speed]);

  const stopReading = useCallback(() => {
    window.speechSynthesis?.cancel();
    setReading(false);
    setCurrentWordIdx(-1);
  }, []);

  const toggleReading = useCallback(() => {
    if (reading) stopReading();
    else startReading(0);
  }, [reading, stopReading, startReading]);

  // Back to library
  const goBack = useCallback(() => {
    stopReading();
    useStore.setState({ currentTextId: null });
    setPage('library');
  }, [stopReading, setPage]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-line border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!source) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-4 text-center">
        <p className="text-3xl mb-3">📄</p>
        <p className="text-heading font-semibold mb-1">Text not found</p>
        <Button onClick={goBack} variant="outline" className="mt-3">← Back to Library</Button>
      </div>
    );
  }

  const words = wordsRef.current;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-line-s bg-surface/80 backdrop-blur-sm">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={goBack} className="p-2 rounded-xl hover:bg-card text-muted hover:text-heading flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-heading truncate">{source.title}</p>
            <p className="text-[11px] text-muted">{source.word_count || words.length} words</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 px-4 pb-3">
          <button onClick={toggleReading}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              reading
                ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                : 'bg-blue-600 text-white hover:bg-blue-500'
            }`}>
            {reading ? (
              <><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Stop</>
            ) : (
              <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg> Read Aloud</>
            )}
          </button>

          {/* Speed */}
          <div className="flex items-center gap-1 ml-auto">
            {[0.7, 0.85, 1, 1.2].map(s => (
              <button key={s} onClick={() => setSpeed(s)}
                className={`px-2 py-1 rounded-lg text-[11px] font-mono transition-colors ${
                  speed === s ? 'bg-blue-600/20 text-blue-400' : 'text-muted hover:text-body'
                }`}>
                {s}×
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Text content — clickable words */}
      <div className="flex-1 overflow-y-auto px-5 py-6">
        <div className="max-w-2xl mx-auto leading-[2] text-[17px]">
          {words.map((word, i) => {
            const isActive = currentWordIdx === i;
            const cleanWord = word.replace(/[^a-zA-Z'-]/g, '');
            const isClickable = cleanWord.length >= 2;

            return (
              <React.Fragment key={i}>
                <span
                  onClick={() => isClickable && handleWordClick(word)}
                  className={`inline-block px-0.5 py-px rounded cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-blue-500/25 text-blue-300 font-medium'
                      : isClickable
                      ? 'text-heading hover:bg-blue-500/10 hover:text-blue-400'
                      : 'text-heading'
                  }`}
                >
                  {word}
                </span>
                {' '}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <WordPopup />
    </div>
  );
}
