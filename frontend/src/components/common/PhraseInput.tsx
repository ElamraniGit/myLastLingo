/**
 * PhraseInput — floating button + modal to save a multi-word phrase.
 *
 * Instead of complex drag-selection (which doesn't work reliably on
 * Android Chrome), the user simply types or pastes the phrase they
 * want to save. Opens as a bottom sheet on mobile.
 *
 * Usage:
 *   <PhraseInput videoId={currentVideo?.id} sentence={currentSentence} />
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useDictionary } from '@/hooks/useDictionary';
import { speak } from '@/lib/tts';
import * as sfx from '@/lib/sfx';

interface Props {
  /** Optional: pre-fill the sentence context */
  sentence?: string;
  /** Optional: video ID for vocabulary context */
  videoId?: string;
  /** Custom trigger label */
  label?: string;
}

export default function PhraseInput({ sentence, videoId, label = '+ Save phrase' }: Props) {
  const [open,    setOpen]    = useState(false);
  const [phrase,  setPhrase]  = useState('');
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [visible, setVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { saveWord } = useDictionary();

  // Animate in
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => setVisible(true));
      setTimeout(() => inputRef.current?.focus(), 300);
    } else {
      setVisible(false);
    }
  }, [open]);

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(() => { setOpen(false); setPhrase(''); setSaved(false); }, 250);
  }, []);

  const handleSave = useCallback(async () => {
    const p = phrase.trim();
    if (!p || p.length < 2 || saving || saved) return;
    setSaving(true);
    // Save each word in the phrase, using the full phrase as context
    const words = p.split(/\s+/).filter(w => w.length >= 2);
    if (words.length === 1) {
      // Single word — normal save
      await saveWord(words[0], videoId, sentence || p, '');
    } else {
      // Multi-word — save the full phrase as the "word" (first meaningful word as key)
      const mainWord = words.find(w => w.length > 2) || words[0];
      await saveWord(p.toLowerCase(), videoId, sentence || p, `Phrase: ${p}`);
    }
    sfx.save();
    setSaved(true);
    setSaving(false);
    setTimeout(handleClose, 1000);
  }, [phrase, saving, saved, saveWord, videoId, sentence, handleClose]);

  const handleSpeak = useCallback(() => {
    if (phrase.trim()) speak(phrase.trim(), { rate: 0.9 });
  }, [phrase]);

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs font-medium text-blue-500 hover:text-blue-400
                   bg-blue-500/10 hover:bg-blue-500/15 border border-blue-500/20 rounded-xl
                   px-3 py-1.5 transition-all active:scale-95"
      >
        ✏️ {label}
      </button>

      {/* Modal */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className={`fixed inset-0 z-[60] transition-all duration-250 ${
              visible ? 'bg-black/50 backdrop-blur-sm' : 'bg-black/0'
            }`}
            onClick={handleClose}
          />

          {/* Sheet */}
          <div
            className={`fixed z-[70] left-0 right-0 bottom-0 bg-surface rounded-t-3xl
                        border-t border-default shadow-2xl transition-all duration-250 ease-out
                        lg:left-1/2 lg:-translate-x-1/2 lg:w-full lg:max-w-md
                        ${visible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-elevated rounded-full" />
            </div>

            <div className="px-5 pb-8 pt-2 space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-heading">Save a phrase</h3>
                  <p className="text-xs text-muted mt-0.5">Type or paste any word or phrase</p>
                </div>
                <button
                  onClick={handleClose}
                  className="w-8 h-8 rounded-full bg-elevated text-muted hover:text-heading
                             flex items-center justify-center text-sm transition-colors"
                >✕</button>
              </div>

              {/* Input */}
              <div className="relative">
                <input
                  ref={inputRef}
                  value={phrase}
                  onChange={e => { setPhrase(e.target.value); setSaved(false); }}
                  onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleClose(); }}
                  placeholder="e.g. look forward to, by the way…"
                  className="input-field pr-12 text-sm"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={100}
                />
                {phrase.trim() && (
                  <button
                    onClick={handleSpeak}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-blue-500 transition-colors"
                    title="Listen"
                  >🔊</button>
                )}
              </div>

              {/* Context preview */}
              {sentence && (
                <div className="bg-elevated/50 rounded-xl px-3 py-2 text-xs text-muted leading-relaxed line-clamp-2">
                  Context: {sentence}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  onClick={handleClose}
                  className="flex-1 py-3 rounded-2xl border border-default text-sm text-muted
                             hover:bg-card transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!phrase.trim() || saving || saved}
                  className={`flex-1 py-3 rounded-2xl text-sm font-semibold transition-all
                              active:scale-[0.97] disabled:opacity-50 ${
                    saved
                      ? 'bg-green-600 text-white'
                      : 'btn-primary'
                  }`}
                >
                  {saved ? '✅ Saved!' : saving ? 'Saving…' : 'Save'}
                </button>
              </div>

              <p className="text-center text-[10px] text-faint">
                Tip: paste any text from other apps here
              </p>
            </div>
          </div>
        </>
      )}
    </>
  );
}
