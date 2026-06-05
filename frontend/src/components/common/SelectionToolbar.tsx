/**
 * SelectionToolbar — floating toolbar shown when user selects multiple words.
 *
 * Usage:
 *   <SelectionToolbar
 *     phrase="look up"
 *     sentence="I need to look up this word in the dictionary."
 *     position={{ x, y }}   // screen coords (px)
 *     onClose={() => {}}
 *     videoId={currentVideo?.id}
 *   />
 *
 * Appears above the selection with 3 actions:
 *   🔍 Look up    → opens WordPopup for the phrase
 *   ➕ Save       → saves the phrase directly to vocabulary
 *   🔊 Pronounce  → TTS of the phrase
 *   ✕  Dismiss
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useDictionary } from '@/hooks/useDictionary';
import { speak } from '@/lib/tts';
import * as sfx from '@/lib/sfx';

interface Props {
  phrase: string;
  sentence: string;
  position: { x: number; y: number };
  onClose: () => void;
  videoId?: string;
}

export default function SelectionToolbar({ phrase, sentence, position, onClose, videoId }: Props) {
  const { lookupWord, saveWord } = useDictionary();
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Animate in
  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  // Dismiss on outside click
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('pointerdown', onDown, { capture: true });
    return () => window.removeEventListener('pointerdown', onDown, { capture: true });
  }, [onClose]);

  // Dismiss on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleLookup = useCallback(async () => {
    onClose();
    // For multi-word phrases, we look up the first significant word
    // and pass the full phrase as the sentence context
    const words = phrase.trim().split(/\s+/);
    const mainWord = words.find(w => w.length > 2) || words[0];
    await lookupWord(mainWord, sentence || phrase);
  }, [phrase, sentence, lookupWord, onClose]);

  const handleSave = useCallback(async () => {
    if (saving || saved) return;
    setSaving(true);
    const ok = await saveWord(phrase.trim(), videoId, sentence || phrase, '');
    if (ok) { sfx.save(); setSaved(true); }
    setSaving(false);
    setTimeout(onClose, 800);
  }, [phrase, sentence, videoId, saveWord, saving, saved, onClose]);

  const handleSpeak = useCallback(() => {
    speak(phrase, { rate: 0.9 });
  }, [phrase]);

  // Clamp position to viewport
  const toolbarW = 260;
  const toolbarH = 56;
  const margin   = 8;
  const vw = typeof window !== 'undefined' ? window.innerWidth  : 400;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 700;

  let x = Math.min(Math.max(position.x - toolbarW / 2, margin), vw - toolbarW - margin);
  let y = position.y - toolbarH - 12;
  if (y < margin) y = position.y + 24; // flip below if too close to top

  return (
    <div
      ref={ref}
      data-selection-toolbar="true"
      className={`fixed z-[70] transition-all duration-200 ${
        visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
      }`}
      style={{ left: x, top: y, transformOrigin: 'center bottom' }}
    >
      {/* Arrow */}
      <div
        className="absolute left-1/2 -translate-x-1/2 w-3 h-2 overflow-hidden"
        style={{ bottom: -8, display: y < position.y ? 'block' : 'none' }}
      >
        <div className="w-3 h-3 bg-elevated border border-default rotate-45 translate-y-1.5 mx-auto" />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1 bg-elevated border border-default rounded-2xl shadow-2xl px-2 py-1.5">
        {/* Phrase label */}
        <div className="px-2 py-1 max-w-[100px]">
          <span className="text-[11px] font-semibold text-heading truncate block">
            "{phrase.length > 18 ? phrase.slice(0, 18) + '…' : phrase}"
          </span>
          <span className="text-[10px] text-faint">
            {phrase.trim().split(/\s+/).length} word{phrase.trim().split(/\s+/).length > 1 ? 's' : ''}
          </span>
        </div>

        <div className="w-px h-7 bg-default mx-0.5" />

        {/* Look up */}
        <button
          onClick={handleLookup}
          title="Look up"
          className="flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl hover:bg-blue-500/15
                     text-blue-500 transition-all active:scale-90"
        >
          <span className="text-sm">🔍</span>
          <span className="text-[9px] font-medium">Look up</span>
        </button>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving || saved}
          title="Save to vocabulary"
          className={`flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl transition-all active:scale-90 ${
            saved
              ? 'text-green-400 bg-green-500/10'
              : 'text-green-500 hover:bg-green-500/15'
          } disabled:opacity-60`}
        >
          <span className="text-sm">{saved ? '✅' : saving ? '⏳' : '➕'}</span>
          <span className="text-[9px] font-medium">{saved ? 'Saved!' : 'Save'}</span>
        </button>

        {/* Pronounce */}
        <button
          onClick={handleSpeak}
          title="Pronounce"
          className="flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl hover:bg-elevated
                     text-muted hover:text-body transition-all active:scale-90"
        >
          <span className="text-sm">🔊</span>
          <span className="text-[9px] font-medium">Hear</span>
        </button>

        <div className="w-px h-7 bg-default mx-0.5" />

        {/* Close */}
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-xl flex items-center justify-center text-faint hover:text-body
                     hover:bg-card transition-all text-xs"
          aria-label="Close"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
