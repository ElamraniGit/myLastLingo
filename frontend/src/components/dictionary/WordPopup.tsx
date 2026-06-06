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
import PronunciationTrainer from './PronunciationTrainer';
import { speak as ttsSpeak } from '@/lib/tts';
import { SpeakIcon, MicIcon, CloseIcon, BookIcon, BulbIcon, PencilIcon, LinkIcon, SwapIcon, RepeatIcon, SaveIcon } from '@/components/ui/Icons';
import * as sfx from '@/lib/sfx';

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
  return POS[key] ?? { color: 'bg-elevated/50 text-body border-line', label: pos || '' };
}

/* ── TTS helper (natural neural voice + browser fallback) ─────── */
function speak(text: string) {
  // Words are read slightly slower for clarity; sentences at natural pace.
  const rate = text.trim().split(/\s+/).length <= 2 ? 0.9 : 1.0;
  ttsSpeak(text, { rate });
}

/* ── Section wrapper ─────────────────────────────────────────── */
function Section({ title, icon, children, className = '' }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`mt-5 ${className}`}>
      <div className="flex items-center gap-1.5 mb-2.5">
        <span className="text-sm">{icon}</span>
        <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">{title}</h3>
      </div>
      {children}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════ */
export default function WordPopup() {
  const { wordPopupOpen, selectedWord, wordPopupSentence, currentVideo, setSelectedWord } = useStore();
  const { closeWordPopup, saveWord } = useDictionary();
  const [saved,    setSaved]    = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [showPronunciation, setShowPronunciation] = useState(false);
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
  useEffect(() => { setSaved(false); setShowPronunciation(false); }, [selectedWord?.word]);

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
    if (ok) { sfx.save(); setSaved(true); }
    setSaving(false);
  }, [selectedWord, saving, saved, saveWord, currentVideo, wordPopupSentence]);

  const handleEnrich = useCallback(async () => {
    if (!selectedWord || enriching) return;
    setEnriching(true);
    try {
      const { dictionaryApi } = await import('@/lib/api');
      const enriched = await (dictionaryApi as any).enrich(selectedWord.word);
      if (enriched?.word) {
        setSelectedWord({ ...selectedWord, ...enriched.word });
      }
    } catch {}
    setEnriching(false);
  }, [selectedWord, enriching, setSelectedWord]);

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
        className={`fixed inset-0 z-[60] transition-all duration-300 ${
          visible ? 'bg-black/60 backdrop-blur-sm' : 'bg-black/0'
        }`}
        onClick={handleClose}
      />

      {/* ── Sheet ─────────────────────────────────────────────── */}
      <div
        ref={sheetRef}
        className={`fixed z-[70] bg-surface shadow-2xl overflow-y-auto overscroll-contain transition-all duration-300 ease-out
          bottom-0 left-0 right-0 max-h-[92vh] rounded-t-3xl border-t border-line/50
          lg:left-auto lg:right-0 lg:top-0 lg:bottom-0 lg:max-h-full lg:w-[420px] lg:rounded-t-none lg:rounded-l-3xl lg:border-t-0 lg:border-l
          ${visible
            ? 'translate-y-0 lg:translate-y-0 lg:translate-x-0 opacity-100'
            : 'translate-y-full lg:translate-y-0 lg:translate-x-full opacity-0'
          }`}
      >
        {/* Handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 lg:hidden sticky top-0 bg-surface z-10">
          <div className="w-10 h-1 bg-elevated rounded-full" />
        </div>

        <div className="px-5 pb-8 pt-2">

          {/* ── Header: word, pronunciation, POS, level ──────── */}
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
                <h2 className="text-3xl font-extrabold text-heading tracking-tight">{w.word}</h2>
                <LevelBadge level={(w.level || 'B1') as CEFRLevel} />
                {w.ai_enriched && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/20 font-semibold">
                    AI
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {w.part_of_speech && w.part_of_speech !== 'unknown' && (
                  <span className={`text-xs px-2.5 py-0.5 rounded-lg font-semibold border ${ps.color}`}>
                    {ps.label}
                  </span>
                )}
                {w.pronunciation && (
                  <span className="text-sm text-body font-mono">{w.pronunciation}</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 ml-3 flex-shrink-0">
              <button
                onClick={() => speak(w.word)}
                className="w-11 h-11 flex items-center justify-center rounded-xl bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 transition-all active:scale-90"
                title="Pronounce"
              >
<SpeakIcon size={18} />
              </button>
              <button
                onClick={() => setShowPronunciation(true)}
                className="w-11 h-11 flex items-center justify-center rounded-xl bg-green-500/15 hover:bg-green-500/25 text-green-400 transition-all active:scale-90"
                title="Practice pronunciation"
              >
<MicIcon size={18} />
              </button>
              <button
                onClick={handleClose}
                className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-card text-muted hover:text-body transition-all"
              >
<CloseIcon size={16} />
              </button>
            </div>
          </div>

          {/* ── Arabic Translation ───────────────────────────── */}
          {w.meaning_ar && (
            <div className="mt-4 bg-gradient-to-r from-blue-500/8 to-purple-500/8 border border-blue-500/15 rounded-2xl px-4 py-3.5">
              <p className="text-xs text-blue-400/70 uppercase tracking-wider mb-1">Arabic Translation</p>
              <p className="text-xl font-bold text-heading"
                 style={{ direction: 'rtl', textAlign: 'right', unicodeBidi: 'isolate',
                          fontFamily: "'Segoe UI', 'Noto Sans Arabic', Arial, sans-serif" }}>
                {w.meaning_ar}
              </p>
            </div>
          )}

          {/* ── Main Definition ──────────────────────────────── */}
          {w.meaning_en && (
            <Section title="Definition" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>}>
              <p className="text-sm text-heading leading-relaxed">{w.meaning_en}</p>
            </Section>
          )}

          {/* ── Multiple Meanings ────────────────────────────── */}
          {definitions.length > 1 && (
            <Section title="Other Meanings" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="18" rx="1"/><path d="M17 3l4 2v14l-4 2V3z"/></svg>}>
              <div className="space-y-2.5">
                {definitions.slice(1, 5).map((d, i) => (
                  <div key={i} className="bg-card/50 rounded-xl px-3.5 py-3 border border-line/30">
                    {d.part_of_speech && (
                      <span className={`text-xs px-2 py-0.5 rounded font-semibold border mb-1.5 inline-block ${posStyle(d.part_of_speech).color}`}>
                        {d.part_of_speech}
                      </span>
                    )}
                    <p className="text-base text-body leading-relaxed">{d.definition}</p>
                    {d.example && (
                      <p className="text-xs text-muted mt-1.5 italic">"{d.example}"</p>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* ── How to Use ───────────────────────────────────── */}
          {howToUse.length > 0 && (
            <Section title="How to Use" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 1 7 7c0 2.87-1.7 5.27-4 6.46V17a1 1 0 0 1-1 1H10a1 1 0 0 1-1-1v-1.54C6.7 14.27 5 11.87 5 9a7 7 0 0 1 7-7z"/></svg>}>
              <div className="space-y-1.5">
                {howToUse.map((tip, i) => (
                  <p key={i} className="text-base text-body leading-relaxed">{tip}</p>
                ))}
              </div>
            </Section>
          )}

          {/* ── Context Sentence ─────────────────────────────── */}
          {wordPopupSentence && (
            <Section title="In Context" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="1" y="4" width="15" height="16" rx="2"/><polygon points="16 9 23 4 23 20 16 15 16 9"/></svg>}>
              <div className="bg-card/40 rounded-xl px-4 py-3 border border-line/30">
                <p className="text-base text-body leading-relaxed">
                  {/* FIX BUG-11: Safe regex — escapes special chars (c++, it's, etc.) */}
                  {(() => {
                    try {
                      const escaped = w.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                      const pattern = new RegExp(`((?<![\\w'])${escaped}(?![\\w']))`, 'gi');
                      return wordPopupSentence.split(pattern).map((part: string, i: number) =>
                        part.toLowerCase() === w.word.toLowerCase()
                          ? <mark key={i} className="bg-blue-500/30 text-blue-300 rounded px-0.5 font-semibold">{part}</mark>
                          : <span key={i}>{part}</span>
                      );
                    } catch {
                      return <span>{wordPopupSentence}</span>;
                    }
                  })()}
                </p>
              </div>
            </Section>
          )}

          {/* ── Examples ─────────────────────────────────────── */}
          {examples.length > 0 && (
            <Section title="Examples" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>}>
              <div className="space-y-2">
                {examples.slice(0, 3).map((ex, i) => (
                  <div key={i} className="flex items-start gap-2.5 group">
                    <span className="text-blue-500/70 mt-0.5 text-xs font-bold">{i + 1}</span>
                    <p className="text-sm text-body leading-relaxed flex-1">{ex}</p>
                    <button
                      onClick={() => speak(ex)}
                      className="flex-shrink-0 p-1.5 rounded-lg text-faint hover:text-blue-400 hover:bg-card transition-all opacity-0 group-hover:opacity-100"
                    >
<SpeakIcon size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* ── Synonyms ─────────────────────────────────────── */}
          {synonyms.length > 0 && (
            <Section title="Synonyms" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>}>
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
            <Section title="Antonyms" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>}>
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
            <Section title="Conjugations" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>}>
              <div className="grid grid-cols-2 gap-1.5">
                {Object.entries(conjugations).map(([k, v]) => (
                  <div key={k} className="flex justify-between items-center px-3 py-2 bg-card/50 rounded-xl border border-line/30">
                    <span className="text-xs text-muted capitalize">{k}</span>
                    <span className="text-xs text-heading font-medium">{v}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* ── AI Enrich button (for non-enriched words) ────── */}
          {!w.ai_enriched && (
            <div className="mt-4">
              <button
                onClick={handleEnrich}
                disabled={enriching}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl
                           border border-purple-500/30 bg-purple-500/8 text-purple-400
                           hover:bg-purple-500/15 active:scale-[0.98] transition-all
                           text-sm font-medium disabled:opacity-50"
              >
                {enriching ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin"/>
                    Enriching with AI…
                  </>
                ) : (
                  <><svg className="w-3.5 h-3.5 mr-1 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>Enhance with AI</>
                )}
              </button>
            </div>
          )}

          {/* ── Save Button ──────────────────────────────────── */}
          <div className="mt-3">
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
      {/* Pronunciation Trainer */}
      {showPronunciation && (
        <PronunciationTrainer
          word={w.word}
          pronunciation={w.pronunciation}
          onClose={() => setShowPronunciation(false)}
        />
      )}
    </>
  );
}
