/**
 * SelectionToolbar — bottom sheet shown when text is selected.
 *
 * Look up behaviour:
 *  - Single word  → WordPopup (definition, examples, synonyms…)
 *  - Multi-word phrase → fetches Arabic translation via MyMemory +
 *    tries to find definition from Free Dictionary API,
 *    then shows a phrase-info sheet inline in this toolbar
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useStore } from '@/store/appStore';
import { useDictionary } from '@/hooks/useDictionary';
import { speak } from '@/lib/tts';
import * as sfx from '@/lib/sfx';

interface Props {
  phrase: string;
  sentence: string;
  position?: { x: number; y: number };
  onClose: () => void;
  videoId?: string;
}

// Fetch Arabic translation for any text (word or phrase)
async function fetchTranslation(text: string): Promise<string> {
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|ar`;
    const ctrl1 = new AbortController();
    const t1 = setTimeout(() => ctrl1.abort(), 6000);
    const res  = await fetch(url, { signal: ctrl1.signal });
    clearTimeout(t1);
    if (!res.ok) return '';
    const data = await res.json();
    const tr   = data?.responseData?.translatedText || '';
    // MyMemory returns the query itself when it fails
    if (tr && tr.toLowerCase() !== text.toLowerCase()) return tr;
  } catch {}
  return '';
}

// Try to get a definition from Free Dictionary API (works for some phrases)
async function fetchDefinition(text: string): Promise<string> {
  // Only try if 1-2 words (phrasal verbs, compound words)
  const words = text.trim().split(/\s+/);
  if (words.length > 3) return '';
  try {
    const query = words.join('%20');
    const res   = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${query}`,
      (() => {
        const ctrl = new AbortController();
        setTimeout(() => ctrl.abort(), 6000);
        return { signal: ctrl.signal };
      })()
    );
    if (!res.ok) return '';
    const data = await res.json();
    const def  = data?.[0]?.meanings?.[0]?.definitions?.[0]?.definition || '';
    return def;
  } catch {}
  return '';
}

interface PhraseInfo {
  translation: string;
  definition:  string;
  loading: boolean;
}

export default function SelectionToolbar({ phrase, sentence, onClose, videoId }: Props) {
  const { lookupWord, saveWord } = useDictionary();
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [visible,   setVisible]   = useState(false);
  const [phraseInfo, setPhraseInfo] = useState<PhraseInfo | null>(null);

  const wordCount  = phrase.trim().split(/\s+/).filter(Boolean).length;
  const isMultiWord = wordCount > 1;

  // Animate in
  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  // Auto-fetch phrase info when toolbar opens for multi-word selection
  useEffect(() => {
    if (!isMultiWord) return;
    setPhraseInfo({ translation: '', definition: '', loading: true });
    Promise.all([
      fetchTranslation(phrase),
      fetchDefinition(phrase),
    ]).then(([translation, definition]) => {
      setPhraseInfo({ translation, definition, loading: false });
    });
  }, [phrase, isMultiWord]);

  // ── Look up ───────────────────────────────────────────────────────────────
  const handleLookup = useCallback(async () => {
    if (wordCount === 1) {
      // Single word → normal WordPopup
      onClose();
      const clean = phrase.replace(/[^\w'-]/g, '').trim();
      if (clean.length >= 2) await lookupWord(clean, sentence || phrase);
    } else {
      // Multi-word: fetch and show info inline (already done in useEffect above)
      // If already loaded, just expand the info section (it's always shown)
      // If still loading, nothing extra to do — it shows the loading state
    }
  }, [phrase, sentence, wordCount, lookupWord, onClose]);

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (saving || saved) return;
    setSaving(true);
    const ok = await saveWord(phrase.trim(), videoId, sentence || phrase, '');
    if (ok) { sfx.save(); setSaved(true); }
    setSaving(false);
    setTimeout(onClose, 800);
  }, [phrase, sentence, videoId, saveWord, saving, saved, onClose]);

  const handleSpeak = useCallback(() => speak(phrase, { rate: 0.9 }), [phrase]);

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 250);
  }, [onClose]);

  return (
    <div
      className={`fixed inset-0 z-[80] transition-all duration-250 ${visible ? 'opacity-100' : 'opacity-0'}`}
      onPointerDown={handleClose}
    >
      <div
        data-selection-toolbar="true"
        onPointerDown={e => e.stopPropagation()}
        className={`absolute bottom-0 left-0 right-0 bg-surface border-t border-default shadow-2xl transition-all duration-250 ease-out ${visible ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 12px)', maxHeight: '70vh', overflowY: 'auto' }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-2 pb-1 sticky top-0 bg-surface">
          <div className="w-8 h-1 bg-elevated rounded-full" />
        </div>

        {/* Phrase preview */}
        <div className="px-4 py-2 border-b border-subtle">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-heading truncate">
                "{phrase.length > 45 ? phrase.slice(0, 45) + '…' : phrase}"
              </p>
              <p className="text-xs text-muted mt-0.5">
                {wordCount} word{wordCount !== 1 ? 's' : ''} selected
              </p>
            </div>
            <button onClick={handleClose}
              className="w-8 h-8 rounded-full bg-elevated text-muted flex items-center justify-center text-sm ml-2 shrink-0">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>

        {/* ── Phrase info (multi-word) ─────────────────────────────────────── */}
        {isMultiWord && (
          <div className="px-4 py-3 border-b border-subtle space-y-2.5">
            {phraseInfo?.loading ? (
              <div className="flex items-center gap-2 text-xs text-muted">
                <div className="w-3.5 h-3.5 border-2 border-muted border-t-blue-500 rounded-full animate-spin" />
                Fetching translation…
              </div>
            ) : (
              <>
                {/* Arabic translation */}
                {phraseInfo?.translation && (
                  <div className="bg-blue-500/8 border border-blue-500/15 rounded-xl px-3 py-2.5">
                    <p className="text-xs text-blue-400/70 uppercase tracking-wider mb-1">Arabic Translation</p>
                    <p className="text-base font-semibold text-heading leading-relaxed"
                       style={{ direction: 'rtl', textAlign: 'right', fontFamily: "'Segoe UI', 'Noto Sans Arabic', sans-serif" }}>
                      {phraseInfo.translation}
                    </p>
                  </div>
                )}

                {/* Definition (phrasal verbs etc.) */}
                {phraseInfo?.definition && (
                  <div className="bg-card border border-default rounded-xl px-3 py-2.5">
                    <p className="text-xs text-muted uppercase tracking-wider mb-1">Definition</p>
                    <p className="text-sm text-heading leading-relaxed">{phraseInfo.definition}</p>
                  </div>
                )}

                {/* Sentence context */}
                {sentence && sentence !== phrase && (
                  <div className="bg-elevated/50 rounded-xl px-3 py-2">
                    <p className="text-xs text-muted uppercase tracking-wider mb-1">Context</p>
                    <p className="text-xs text-body leading-relaxed italic">"{sentence}"</p>
                  </div>
                )}

                {!phraseInfo?.translation && !phraseInfo?.definition && (
                  <p className="text-xs text-faint">No translation found — check internet connection</p>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Action buttons ───────────────────────────────────────────────── */}
        <div className="flex items-center px-3 py-3 gap-2">

          {/* Look up (single word only — multi-word shows info above) */}
          {!isMultiWord && (
            <button onClick={handleLookup}
              className="flex-1 flex flex-col items-center gap-1 py-3 rounded-2xl
                         bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20
                         text-blue-500 transition-all active:scale-95">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <span className="text-xs font-semibold">Look up</span>
            </button>
          )}

          {/* Save */}
          <button onClick={handleSave} disabled={saving || saved}
            className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-2xl
                        border transition-all active:scale-95 disabled:opacity-60 ${
              saved ? 'bg-green-500/10 border-green-500/20 text-green-500'
                    : 'bg-green-500/10 hover:bg-green-500/20 border-green-500/20 text-green-500'
            }`}>
            <span className="flex items-center justify-center w-5 h-5">
              {saved ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              ) : saving ? (
                <svg className="animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              )}
            </span>
            <span className="text-xs font-semibold">{saved ? 'Saved!' : 'Save'}</span>
          </button>

          {/* Pronounce */}
          <button onClick={handleSpeak}
            className="flex-1 flex flex-col items-center gap-1 py-3 rounded-2xl
                       bg-card border border-default text-muted hover:text-body
                       hover:bg-elevated transition-all active:scale-95">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" opacity="0.9"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
            <span className="text-xs font-semibold">Hear</span>
          </button>

        </div>
      </div>
    </div>
  );
}
