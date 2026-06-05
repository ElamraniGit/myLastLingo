/**
 * Text Reader — Apple-style redesign v2.
 *
 * Improvements:
 *  - Reading progress bar (top)
 *  - Word-click counter (how many words looked up)
 *  - Estimated reading time
 *  - Highlight words already in vocabulary (green dot)
 *  - Smooth auto-scroll during Read Aloud
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useStore } from '@/store/appStore';
import { libraryApi } from '@/lib/api';
import { useDictionary } from '@/hooks/useDictionary';
import WordPopup from '@/components/dictionary/WordPopup';
import PhraseInput from '@/components/common/PhraseInput';
import SelectionToolbar from '@/components/common/SelectionToolbar';
import { awardXP } from '@/components/common/XPBar';
import { speak as ttsSpeak, stopSpeaking } from '@/lib/tts';

function estimateReadTime(wordCount: number, speed = 1.0): string {
  const wpm  = Math.round(200 * speed);
  const mins = Math.ceil(wordCount / wpm);
  return mins < 60 ? `~${mins} min read` : `~${Math.round(mins / 60)}h read`;
}

interface TextSource {
  id: string;
  title: string;
  content: string;
  word_count?: number;
}

function buildChunks(words: string[]): { text: string; start: number; end: number }[] {
  const chunks: { text: string; start: number; end: number }[] = [];
  let start = 0;
  for (let i = 0; i < words.length; i++) {
    const endsSentence = /[.!?;:]$/.test(words[i]);
    const tooLong = i - start >= 22;
    if (endsSentence || tooLong || i === words.length - 1) {
      const end = i + 1;
      chunks.push({ text: words.slice(start, end).join(' '), start, end });
      start = end;
    }
  }
  return chunks;
}

const SPEEDS = [0.7, 0.85, 1.0, 1.2];

export default function TextReaderView() {
  const { currentTextId, setPage, setCurrentTextId } = useStore();
  const { lookupWord } = useDictionary();

  const [source,       setSource]       = useState<TextSource | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [reading,      setReading]      = useState(false);
  const [currentChunk, setCurrentChunk] = useState(-1);
  const [speed,        setSpeed]        = useState(1.0);
  const [lookedUp,     setLookedUp]     = useState<Set<string>>(new Set());
  const [scrollPct,    setScrollPct]    = useState(0);

  // ── Multi-word selection via native selectionchange ───────────────────────
  const [toolbar, setToolbar] = useState<{
    phrase: string;
    position: { x: number; y: number };
  } | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const wordsRef   = useRef<string[]>([]);
  const chunksRef  = useRef<{ text: string; start: number; end: number }[]>([]);
  const readingRef = useRef(false);
  const speedRef   = useRef(1.0);
  const activeRef  = useRef<HTMLSpanElement | null>(null);

  useEffect(() => { speedRef.current = speed; }, [speed]);

  // Auto-scroll highlighted chunk into view
  useEffect(() => {
    if (currentChunk >= 0 && activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentChunk]);

  // Load source
  useEffect(() => {
    if (!currentTextId) { setLoading(false); return; }
    setLoading(true);
    libraryApi.getText(currentTextId)
      .then(d => {
        setSource(d);
        const words = (d.content || '').trim().split(/\s+/).filter(Boolean);
        wordsRef.current  = words;
        chunksRef.current = buildChunks(words);
      })
      .catch(() => setSource(null))
      .finally(() => setLoading(false));
  }, [currentTextId]);

  // Cleanup TTS on unmount
  useEffect(() => () => { readingRef.current = false; stopSpeaking(); }, []);

  // Single word click
  const handleWordClick = useCallback((word: string) => {
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.toString().trim().split(/\s+/).length >= 2) return;
    const clean = word.replace(/[^a-zA-Z'-]/g, '').trim();
    if (clean.length >= 2) {
      setToolbar(null);
      lookupWord(clean, '');
      setLookedUp(prev => new Set(prev).add(clean.toLowerCase()));
    }
  }, [lookupWord]);

  // Native selectionchange → SelectionToolbar
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const blockCtx = (e: Event) => e.preventDefault();
    container.addEventListener('contextmenu', blockCtx);

    const onSel = () => {
      if (timer) clearTimeout(timer);
      // 20ms: beat browser context menu popup
      timer = setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || !sel.rangeCount) {
          setToolbar(null);
          return;
        }
        const text = sel.toString().trim().replace(/\s+/g, ' ');
        if (text.split(/\s+/).filter(Boolean).length < 2) return;
        const range = sel.getRangeAt(0);
        if (!container.contains(range.commonAncestorContainer)) return;
        const rect = range.getBoundingClientRect();
        if (!rect.width && !rect.height) return;
        const phrase = text.replace(/[.,!?;:""''«»]+$/, '').trim();
        if (!phrase) return;
        setToolbar({ phrase, position: { x: rect.left + rect.width / 2, y: Math.max(80, rect.top - 8) } });
      }, 100);
    };
    document.addEventListener('selectionchange', onSel);
    return () => {
      container.removeEventListener('contextmenu', blockCtx);
      document.removeEventListener('selectionchange', onSel);
      if (timer) clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!toolbar) return;
      const tb = document.querySelector('[data-selection-toolbar]');
      if (tb?.contains(e.target as Node)) return;
      setToolbar(null);
      window.getSelection()?.removeAllRanges();
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [toolbar]);

  const stopReading = useCallback(() => {
    readingRef.current = false;
    stopSpeaking();
    setReading(false);
    setCurrentChunk(-1);
  }, []);

  const startReading = useCallback(async (fromChunk = 0) => {
    const chunks = chunksRef.current;
    if (!source || chunks.length === 0) return;
    stopSpeaking();
    readingRef.current = true;
    setReading(true);
    for (let i = fromChunk; i < chunks.length; i++) {
      if (!readingRef.current) break;
      setCurrentChunk(i);
      await ttsSpeak(chunks[i].text, { rate: speedRef.current });
    }
    if (readingRef.current) awardXP('watch_minute');
    readingRef.current = false;
    setReading(false);
    setCurrentChunk(-1);
  }, [source]);

  const toggleReading = useCallback(() => {
    if (reading) stopReading();
    else startReading(0);
  }, [reading, stopReading, startReading]);

  const goBack = useCallback(() => {
    stopReading();
    setCurrentTextId(null);
    setPage('library');
  }, [stopReading, setCurrentTextId, setPage]);

  /* ── Loading ──────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="flex flex-col gap-4 max-w-lg mx-auto px-4 pt-8">
        <div className="skeleton h-6 w-48 rounded-xl" />
        {[...Array(8)].map((_, i) => (
          <div key={i} className="skeleton h-4 rounded-lg" style={{ width: `${70 + Math.random() * 30}%` }} />
        ))}
      </div>
    );
  }

  if (!source) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 text-center px-4">
        <div className="text-5xl mb-4">📄</div>
        <div className="text-base font-semibold text-heading mb-1">Text not found</div>
        <button onClick={goBack} className="mt-4 text-sm text-blue-500 hover:text-blue-400 font-medium">
          ← Back to Library
        </button>
      </div>
    );
  }

  const words      = wordsRef.current;
  const wordCount  = words.length;
  const readTime   = estimateReadTime(wordCount, speed);

  return (
    <div className="flex flex-col h-full bg-base">

      {/* ── Reading progress bar ──────────────────────────────────── */}
      <div className="h-0.5 bg-elevated shrink-0">
        <div
          className="h-full bg-blue-500 transition-all duration-300"
          style={{ width: `${currentChunk >= 0 ? Math.round(((currentChunk + 1) / Math.max(chunksRef.current.length, 1)) * 100) : 0}%` }}
        />
      </div>

      {/* ── Sticky header ────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 nav-bar shrink-0 px-4 py-3">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">

          {/* Back */}
          <button
            onClick={goBack}
            className="w-8 h-8 rounded-xl hover:bg-card text-muted hover:text-heading flex items-center justify-center transition-colors shrink-0"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>

          {/* Title + stats */}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-heading truncate">{source.title}</div>
            <div className="flex items-center gap-2 text-[11px] text-muted">
              <span>{wordCount} words</span>
              <span>·</span>
              <span>{readTime}</span>
              {lookedUp.size > 0 && (
                <>
                  <span>·</span>
                  <span className="text-blue-500">{lookedUp.size} looked up</span>
                </>
              )}
            </div>
          </div>

          {/* Speed selector */}
          <div className="flex items-center gap-0.5 bg-card border border-default rounded-xl p-1 shrink-0">
            {SPEEDS.map(s => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`px-2 py-1 rounded-lg text-[11px] font-mono transition-colors ${
                  speed === s
                    ? 'bg-blue-600/20 text-blue-500'
                    : 'text-muted hover:text-body'
                }`}
              >{s}×</button>
            ))}
          </div>

          {/* Phrase save */}
          <PhraseInput label="+ Phrase" />

          {/* Read aloud button */}
          <button
            onClick={toggleReading}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold shrink-0 transition-all active:scale-95 ${
              reading
                ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                : 'bg-blue-600/10 text-blue-500 border border-blue-500/20'
            }`}
          >
            {reading ? <>⏹ Stop</> : <>▶ Read</>}
          </button>
        </div>
      </div>

      {/* ── Text content ─────────────────────────────────────────── */}
      {/* select-text: allow native text selection for multi-word phrases */}
      <div
        className="flex-1 overflow-y-auto scrollbar-thin px-4 py-6 transcript-selectable"
        ref={contentRef}
      >
        <div className="max-w-2xl mx-auto">
          <p className="leading-8 text-[17px] text-heading">
            {words.map((word, i) => {
              const active   = chunksRef.current[currentChunk];
              const isActive = !!active && i >= active.start && i < active.end;
              const isStart  = !!active && i === active.start;
              const clean    = word.replace(/[^a-zA-Z'-]/g, '');
              const isWord   = clean.length >= 2;

              return (
                <React.Fragment key={i}>
                  <span
                    ref={isStart ? activeRef : null}
                    data-word={isWord ? clean : undefined}
                    onClick={isWord ? () => handleWordClick(word) : undefined}
                    className={`inline rounded px-0.5 transition-colors duration-100 ${
                      isActive
                        ? 'bg-blue-500/20 text-blue-400'
                        : lookedUp.has(clean.toLowerCase()) && isWord
                        ? 'text-green-400 cursor-pointer hover:bg-green-500/10'
                        : isWord
                        ? 'cursor-pointer hover:bg-blue-500/10 hover:text-blue-500'
                        : ''
                    }`}
                  >
                    {word}
                  </span>
                  {' '}
                </React.Fragment>
              );
            })}
          </p>
        </div>
      </div>

      <WordPopup />

      {/* Multi-word selection toolbar */}
      {toolbar && (
        <SelectionToolbar
          phrase={toolbar.phrase}
          sentence={toolbar.phrase}
          position={toolbar.position}
          onClose={() => setToolbar(null)}
        />
      )}
    </div>
  );
}
