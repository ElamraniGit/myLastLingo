/**
 * SelectionToolbar — appears at the BOTTOM of the screen when text is selected.
 *
 * Positioned at the bottom (like a bottom action sheet) so it never
 * conflicts with the browser's own selection toolbar (Copy/Share/etc.)
 * which appears at the TOP. The user can use both independently.
 *
 * Shows: phrase preview + 🔍 Look up · ➕ Save · 🔊 Hear · ✕ Dismiss
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useStore } from '@/store/appStore';
import { useDictionary } from '@/hooks/useDictionary';
import { speak } from '@/lib/tts';
import * as sfx from '@/lib/sfx';

interface Props {
  phrase: string;
  sentence: string;
  position?: { x: number; y: number }; // ignored — always bottom
  onClose: () => void;
  videoId?: string;
}

export default function SelectionToolbar({ phrase, sentence, onClose, videoId }: Props) {
  const { lookupWord, saveWord } = useDictionary();
  const { setPage } = useStore();
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [visible, setVisible] = useState(false);

  // Animate in from bottom
  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const handleLookup = useCallback(async () => {
    onClose();
    window.getSelection()?.removeAllRanges();
    const words = phrase.trim().split(/\s+/);
    const mainWord = words.find(w => w.replace(/[^\w]/g, '').length > 2)
      || words[0].replace(/[^\w'-]/g, '');
    await lookupWord(mainWord, sentence || phrase);
  }, [phrase, sentence, lookupWord, onClose]);

  const handleSave = useCallback(async () => {
    if (saving || saved) return;
    setSaving(true);
    const ok = await saveWord(phrase.trim(), videoId, sentence || phrase, '');
    if (ok) { sfx.save(); setSaved(true); }
    setSaving(false);
    setTimeout(() => { onClose(); window.getSelection()?.removeAllRanges(); }, 800);
  }, [phrase, sentence, videoId, saveWord, saving, saved, onClose]);

  const handleSpeak = useCallback(() => {
    speak(phrase, { rate: 0.9 });
  }, [phrase]);

  const handleClose = useCallback(() => {
    setVisible(false);
    window.getSelection()?.removeAllRanges();
    setTimeout(onClose, 250);
  }, [onClose]);

  const wordCount = phrase.trim().split(/\s+/).filter(Boolean).length;

  return (
    /* Full-screen backdrop — transparent, closes on tap outside toolbar */
    <div
      className={`fixed inset-0 z-[80] transition-all duration-250 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      onPointerDown={handleClose}
    >
      {/* Bottom toolbar — stops propagation so tapping it doesn't close */}
      <div
        data-selection-toolbar="true"
        onPointerDown={e => e.stopPropagation()}
        className={`absolute bottom-0 left-0 right-0 bg-surface border-t border-default
                    shadow-2xl transition-all duration-250 ease-out
                    ${visible ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 12px)' }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-8 h-1 bg-elevated rounded-full" />
        </div>

        {/* Phrase preview */}
        <div className="px-4 py-2 border-b border-subtle">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-heading truncate">
                "{phrase.length > 40 ? phrase.slice(0, 40) + '…' : phrase}"
              </p>
              <p className="text-[11px] text-muted mt-0.5">
                {wordCount} word{wordCount !== 1 ? 's' : ''} selected
              </p>
            </div>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-full bg-elevated text-muted hover:text-heading
                         flex items-center justify-center text-sm ml-2 shrink-0"
            >✕</button>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center px-3 py-3 gap-2">

          {/* Look up */}
          <button
            onClick={handleLookup}
            className="flex-1 flex flex-col items-center gap-1 py-3 rounded-2xl
                       bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20
                       text-blue-500 transition-all active:scale-95"
          >
            <span className="text-xl">🔍</span>
            <span className="text-[11px] font-semibold">Look up</span>
          </button>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving || saved}
            className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-2xl
                        border transition-all active:scale-95 disabled:opacity-60 ${
              saved
                ? 'bg-green-500/10 border-green-500/20 text-green-500'
                : 'bg-green-500/10 hover:bg-green-500/20 border-green-500/20 text-green-500'
            }`}
          >
            <span className="text-xl">{saved ? '✅' : saving ? '⏳' : '➕'}</span>
            <span className="text-[11px] font-semibold">{saved ? 'Saved!' : 'Save'}</span>
          </button>

          {/* Pronounce */}
          <button
            onClick={handleSpeak}
            className="flex-1 flex flex-col items-center gap-1 py-3 rounded-2xl
                       bg-card border border-default text-muted hover:text-body
                       hover:bg-elevated transition-all active:scale-95"
          >
            <span className="text-xl">🔊</span>
            <span className="text-[11px] font-semibold">Hear</span>
          </button>

        </div>
      </div>
    </div>
  );
}
