/**
 * Word Popup — comprehensive word info sheet.
 * Bottom sheet (mobile) / side modal (desktop).
 * Animated entry/exit, dark mode, auto-pause video.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useStore } from '@/store/appStore';
import { useDictionary } from '@/hooks/useDictionary';
import { LevelBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { CEFRLevel } from '@/types';

/* ── Part-of-speech colors ───────────────────────────────────── */
const POS: Record<string, { color: string; label: string }> = {
  noun:        { color: 'bg-sky-500/15 text-sky-400 border-sky-500/25', label: 'Noun' },
  verb:        { color: 'bg-green-500/15 text-green-400 border-green-500/25', label: 'Verb' },
  adjective:   { color: 'bg-purple-500/15 text-purple-400 border-purple-500/25', label: 'Adjective' },
  adverb:      { color: 'bg-orange-500/15 text-orange-400 border-orange-500/25', label: 'Adverb' },
  preposition: { color: 'bg-pink-500/15 text-pink-400 border-pink-500/25', label: 'Preposition' },
  pronoun:     { color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25', label: 'Pronoun' },
  conjunction: { color: 'bg-teal-500/15 text-teal-400 border-teal-500/25', label: 'Conjunction' },
  article:     { color: 'bg-rose-500/15 text-rose-400 border-rose-500/25', label: 'Article' },
  interjection:{ color: 'bg-amber-500/15 text-amber-400 border-amber-500/25', label: 'Interjection' },
};

function posStyle(pos?: string) {
  const key = (pos || '').toLowerCase();
  return POS[key] ?? { color: 'bg-slate-700/50 text-slate-400 border-slate-600', label: pos || '' };
}

/* ── TTS helper ──────────────────────────────────────────────── */
function speak(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  u.rate = 0.85;
  window.speechSynthesis.speak(u);
}

/* ── Section wrapper ─────────────────────────────────────────── */
function Section({ title, icon, children, className = '' }: {
  title: string; icon: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`mt-5 ${className}`}>
      <div className="flex items-center gap-1.5 mb-2.5">
        <span className="text-sm">{icon}</span>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</h3>
      </div>
      {children}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════ */
export default function WordPopup() {
  const { wordPopupOpen, selectedWord, wordPopupSentence, currentVideo } = useStore();
  const { closeWordPopup, saveWord } = useDictionary();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [visible, setVisible] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Animate in
  useEffect(() => {
    if (wordPopupOpen && selectedWord) {
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [wordPopupOpen, selectedWord]);

  // Reset saved state on new word
  useEffect(() => { setSaved(false); }, [selectedWord?.word]);

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(closeWordPopup, 250);
  }, [closeWordPopup]);

  const handleSave = useCallback(async () => {
    if (!selectedWord || saving || saved) return;
    setSaving(true);
    const ok = await saveWord(
      selectedWord.word,
      currentVideo?.id,
      wordPopupSentence,
      `Learned from: ${currentVideo?.title || 'video'}`
    );
    if (ok) setSaved(true);
    setSaving(false);
  }, [selectedWord, saving, saved, saveWord, currentVideo, wordPopupSentence]);

  if (!wordPopupOpen || !selectedWord) return null;

  const w = selectedWord as any; // allow extra fields like definitions, how_to_use
  const ps = posStyle(w.part_of_speech);
  const definitions: Array<{ part_of_speech: string; definition: string; example: string }> = w.definitions || [];
  const howToUse: string[] = w.how_to_use || [];
  const examples: string[] = w.examples || [];
  const synonyms: string[] = w.synonyms || [];
  const antonyms: string[] = w.antonyms || [];
  const conjugations: Record<string, string> = w.conjugations || {};
  const hasConjugations = Object.keys(conjugations).length > 0;

  return (
    <>
      {/* ── Backdrop ──────────────────────────────────────────── */}
      <div
        className={`fixed inset-0 z-40 transition-all duration-300 ${
          visible ? 'bg-black/60 backdrop-blur-sm' : 'bg-black/0'
        }`}
        onClick={handleClose}
      />

      {/* ── Sheet ─────────────────────────────────────────────── */}
      <div
        ref={sheetRef}
        className={`fixed z-50 bg-slate-900 shadow-2xl overflow-y-auto overscroll-contain transition-all duration-300 ease-out
          bottom-0 left-0 right-0 max-h-[88vh] rounded-t-3xl border-t border-slate-700/50
          lg:left-auto lg:right-0 lg:top-0 lg:bottom-0 lg:max-h-full lg:w-[420px] lg:rounded-t-none lg:rounded-l-3xl lg:border-t-0 lg:border-l
          ${visible
            ? 'translate-y-0 lg:translate-y-0 lg:translate-x-0 opacity-100'
            : 'translate-y-full lg:translate-y-0 lg:translate-x-full opacity-0'
          }`}
      >
        {/* Handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 lg:hidden sticky top-0 bg-slate-900 z-10">
          <div className="w-10 h-1 bg-slate-700 rounded-full" />
        </div>

        <div className="px-5 pb-8 pt-2">

          {/* ── Header: word, pronunciation, POS, level ──────── */}
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
                <h2 className="text-3xl font-extrabold text-white tracking-tight">{w.word}</h2>
                <LevelBadge level={(w.level || 'B1') as CEFRLevel} />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {w.part_of_speech && w.part_of_speech !== 'unknown' && (
                  <span className={`text-xs px-2.5 py-0.5 rounded-lg font-semibold border ${ps.color}`}>
                    {ps.label}
                  </span>
                )}
                {w.pronunciation && (
                  <span className="text-sm text-slate-400 font-mono">{w.pronunciation}</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 ml-3 flex-shrink-0">
              <button
                onClick={() => speak(w.word)}
                className="w-11 h-11 flex items-center justify-center rounded-xl bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 transition-all active:scale-90"
                title="Pronounce"
              >
                <span className="text-lg">🔊</span>
              </button>
              <button
                onClick={handleClose}
                className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-all"
              >
                ✕
              </button>
            </div>
          </div>

          {/* ── Arabic Translation ───────────────────────────── */}
          {w.meaning_ar && (
            <div className="mt-4 bg-gradient-to-r from-blue-500/8 to-purple-500/8 border border-blue-500/15 rounded-2xl px-4 py-3.5">
              <p className="text-[11px] text-blue-400/70 uppercase tracking-wider mb-1">الترجمة العربية</p>
              <p className="text-xl font-bold text-slate-100"
                 style={{ direction: 'rtl', textAlign: 'right', unicodeBidi: 'isolate',
                          fontFamily: "'Segoe UI', 'Noto Sans Arabic', Arial, sans-serif" }}>
                {w.meaning_ar}
              </p>
            </div>
          )}

          {/* ── Main Definition ──────────────────────────────── */}
          {w.meaning_en && (
            <Section title="Definition" icon="📖">
              <p className="text-[15px] text-slate-200 leading-relaxed">{w.meaning_en}</p>
            </Section>
          )}

          {/* ── Multiple Meanings ────────────────────────────── */}
          {definitions.length > 1 && (
            <Section title="Other Meanings" icon="📚">
              <div className="space-y-2.5">
                {definitions.slice(1, 5).map((d, i) => (
                  <div key={i} className="bg-slate-800/50 rounded-xl px-3.5 py-3 border border-slate-700/30">
                    {d.part_of_speech && (
                      <span className={`text-[10px] px-2 py-0.5 rounded font-semibold border mb-1.5 inline-block ${posStyle(d.part_of_speech).color}`}>
                        {d.part_of_speech}
                      </span>
                    )}
                    <p className="text-sm text-slate-300 leading-relaxed">{d.definition}</p>
                    {d.example && (
                      <p className="text-xs text-slate-500 mt-1.5 italic">"{d.example}"</p>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* ── How to Use ───────────────────────────────────── */}
          {howToUse.length > 0 && (
            <Section title="How to Use" icon="💡">
              <div className="space-y-1.5">
                {howToUse.map((tip, i) => (
                  <p key={i} className="text-sm text-slate-300 leading-relaxed">{tip}</p>
                ))}
              </div>
            </Section>
          )}

          {/* ── Context Sentence ─────────────────────────────── */}
          {wordPopupSentence && (
            <Section title="In Context" icon="🎬">
              <div className="bg-slate-800/40 rounded-xl px-4 py-3 border border-slate-700/30">
                <p className="text-sm text-slate-300 leading-relaxed">
                  {wordPopupSentence.split(new RegExp(`(\\b${w.word}\\b)`, 'i')).map((part: string, i: number) =>
                    part.toLowerCase() === w.word.toLowerCase()
                      ? <mark key={i} className="bg-blue-500/30 text-blue-300 rounded px-0.5 font-semibold">{part}</mark>
                      : <span key={i}>{part}</span>
                  )}
                </p>
              </div>
            </Section>
          )}

          {/* ── Examples ─────────────────────────────────────── */}
          {examples.length > 0 && (
            <Section title="Examples" icon="✏️">
              <div className="space-y-2">
                {examples.slice(0, 3).map((ex, i) => (
                  <div key={i} className="flex items-start gap-2.5 group">
                    <span className="text-blue-500/70 mt-0.5 text-xs font-bold">{i + 1}</span>
                    <p className="text-sm text-slate-400 leading-relaxed flex-1">{ex}</p>
                    <button
                      onClick={() => speak(ex)}
                      className="flex-shrink-0 p-1.5 rounded-lg text-slate-600 hover:text-blue-400 hover:bg-slate-800 transition-all opacity-0 group-hover:opacity-100"
                    >
                      🔊
                    </button>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* ── Synonyms ─────────────────────────────────────── */}
          {synonyms.length > 0 && (
            <Section title="Synonyms" icon="🔗">
              <div className="flex flex-wrap gap-1.5">
                {synonyms.slice(0, 8).map((s) => (
                  <span key={s} className="text-xs px-2.5 py-1 bg-green-500/10 text-green-400 rounded-lg border border-green-500/15 hover:bg-green-500/20 transition-colors cursor-default">
                    {s}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* ── Antonyms ─────────────────────────────────────── */}
          {antonyms.length > 0 && (
            <Section title="Antonyms" icon="↔️">
              <div className="flex flex-wrap gap-1.5">
                {antonyms.slice(0, 6).map((a) => (
                  <span key={a} className="text-xs px-2.5 py-1 bg-red-500/10 text-red-400 rounded-lg border border-red-500/15">
                    {a}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* ── Conjugations (verbs only) ────────────────────── */}
          {hasConjugations && (
            <Section title="Conjugations" icon="🔄">
              <div className="grid grid-cols-2 gap-1.5">
                {Object.entries(conjugations).map(([k, v]) => (
                  <div key={k} className="flex justify-between items-center px-3 py-2 bg-slate-800/50 rounded-xl border border-slate-700/30">
                    <span className="text-[11px] text-slate-500 capitalize">{k}</span>
                    <span className="text-xs text-slate-200 font-medium">{v}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* ── Save Button ──────────────────────────────────── */}
          <div className="mt-7">
            <Button
              onClick={handleSave}
              loading={saving}
              variant={saved ? 'secondary' : 'primary'}
              className="w-full py-3"
            >
              {saved ? '✓ Saved to vocabulary' : '+ Save word'}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
