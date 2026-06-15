/**
 * Word Popup — comprehensive word info sheet.
 * Bottom sheet (mobile) / side modal (desktop).
 * Animated entry/exit, dark mode, auto-pause video.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useStore } from '@/store/appStore';
import { useDictionary } from '@/hooks/useDictionary';
import ModalShell from '@/components/common/ModalShell';
import { LevelBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type {
  AICommonMistakeItem,
  AICommonPhraseItem,
  AICollocationItem,
  AIEntryPayload,
  AIExampleItem,
  AIPhrasalVerbItem,
  AIRelationItem,
  CEFRLevel,
} from '@/types';
import PronunciationTrainer from './PronunciationTrainer';
import MnemonicSection from './MnemonicSection';
import WordImage from './WordImage';
import { speak as ttsSpeak } from '@/lib/tts';
import { SpeakIcon, MicIcon, CloseIcon } from '@/components/ui/Icons';
import * as sfx from '@/lib/sfx';

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

function speak(text: string) {
  const rate = text.trim().split(/\s+/).length <= 2 ? 0.9 : 1.0;
  ttsSpeak(text, { rate });
}

function toneClass(value?: string) {
  const normalized = (value || '').toLowerCase();
  if (normalized === 'high' || normalized === 'very common') return 'bg-green-500/10 text-green-400 border-green-500/20';
  if (normalized === 'medium' || normalized === 'common') return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
  if (normalized === 'low' || normalized === 'rare' || normalized === 'uncommon') return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
  return 'bg-elevated/50 text-muted border-line';
}

function difficultyClass(level?: string) {
  const key = (level || '').toUpperCase();
  const map: Record<string, string> = {
    A1: 'bg-green-500/10 text-green-400 border-green-500/20',
    A2: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    B1: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    B2: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    C1: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    C2: 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20',
  };
  return map[key] ?? 'bg-elevated/50 text-muted border-line';
}

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

function RelationList({ items, fallback }: { items: AIRelationItem[]; fallback: string[] }) {
  if (items.length > 0) {
    return (
      <div className="space-y-2">
        {items.slice(0, 5).map((item) => (
          <div key={item.term} className="bg-card/50 rounded-xl px-3.5 py-3 border border-line/30">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-sm font-semibold text-heading">{item.term}</span>
              {item.commonness && (
                <span className={`text-[11px] px-2 py-0.5 rounded-full border ${toneClass(item.commonness)}`}>
                  {item.commonness}
                </span>
              )}
            </div>
            {item.short_definition && (
              <p className="text-xs text-muted leading-relaxed">{item.short_definition}</p>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {fallback.slice(0, 8).map((item) => (
        <span key={item} className="text-xs px-2.5 py-1 bg-elevated rounded-lg border border-line/30 text-body">
          {item}
        </span>
      ))}
    </div>
  );
}

function ExampleCards({ items, fallback }: { items: AIExampleItem[]; fallback: string[] }) {
  if (items.length > 0) {
    return (
      <div className="space-y-2.5">
        {items.slice(0, 4).map((item, index) => (
          <div key={`${item.english}-${index}`} className="bg-card/50 rounded-xl px-3.5 py-3 border border-line/30">
            <div className="flex items-start gap-2.5">
              <span className="text-blue-500/70 mt-0.5 text-xs font-bold">{index + 1}</span>
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-sm text-body leading-relaxed">{item.english}</p>
                {item.arabic && (
                  <p className="text-sm text-heading leading-relaxed"
                     style={{ direction: 'rtl', textAlign: 'right', fontFamily: "'Segoe UI', 'Noto Sans Arabic', sans-serif" }}>
                    {item.arabic}
                  </p>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {item.difficulty && (
                    <span className={`text-[11px] px-2 py-0.5 rounded-full border ${difficultyClass(item.difficulty)}`}>
                      {item.difficulty}
                    </span>
                  )}
                  {item.register && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full border bg-elevated/50 text-muted border-line">
                      {item.register}
                    </span>
                  )}
                  {item.focus && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full border bg-blue-500/10 text-blue-400 border-blue-500/20">
                      {item.focus}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => speak(item.english)}
                className="flex-shrink-0 p-1.5 rounded-lg text-faint hover:text-blue-400 hover:bg-card transition-all"
              >
                <SpeakIcon size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {fallback.slice(0, 3).map((ex, index) => (
        <div key={`${ex}-${index}`} className="flex items-start gap-2.5 group">
          <span className="text-blue-500/70 mt-0.5 text-xs font-bold">{index + 1}</span>
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
  );
}

function PhraseCards({ items, type }: { items: AICommonPhraseItem[] | AIPhrasalVerbItem[]; type: 'phrase' | 'phrasal' }) {
  return (
    <div className="space-y-2">
      {items.slice(0, 4).map((item, index) => {
        const title = type === 'phrasal' ? (item as AIPhrasalVerbItem).phrasal_verb : (item as AICommonPhraseItem).expression;
        return (
          <div key={`${title}-${index}`} className="bg-card/50 rounded-xl px-3.5 py-3 border border-line/30 space-y-1.5">
            <div className="text-sm font-semibold text-heading">{title}</div>
            {item.meaning && <p className="text-xs text-body leading-relaxed">{item.meaning}</p>}
            {item.translation && (
              <p className="text-xs text-heading"
                 style={{ direction: 'rtl', textAlign: 'right', fontFamily: "'Segoe UI', 'Noto Sans Arabic', sans-serif" }}>
                {item.translation}
              </p>
            )}
            {item.example && <p className="text-[11px] text-muted italic leading-relaxed">"{item.example}"</p>}
          </div>
        );
      })}
    </div>
  );
}

function CollocationCards({ items, fallback }: { items: AICollocationItem[]; fallback: string[] }) {
  if (items.length > 0) {
    return (
      <div className="space-y-2">
        {items.slice(0, 4).map((item, index) => (
          <div key={`${item.expression}-${index}`} className="bg-card/50 rounded-xl px-3.5 py-3 border border-line/30 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-heading">{item.expression}</span>
              {item.pattern && (
                <span className="text-[11px] px-2 py-0.5 rounded-full border bg-elevated/50 text-muted border-line">
                  {item.pattern}
                </span>
              )}
            </div>
            {item.meaning && <p className="text-xs text-body leading-relaxed">{item.meaning}</p>}
            {item.translation && (
              <p className="text-xs text-heading"
                 style={{ direction: 'rtl', textAlign: 'right', fontFamily: "'Segoe UI', 'Noto Sans Arabic', sans-serif" }}>
                {item.translation}
              </p>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {fallback.slice(0, 8).map((item) => (
        <span key={item} className="text-xs px-2.5 py-1 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20">
          {item}
        </span>
      ))}
    </div>
  );
}

function MistakeCards({ items }: { items: AICommonMistakeItem[] }) {
  return (
    <div className="space-y-2">
      {items.slice(0, 3).map((item, index) => (
        <div key={`${item.mistake}-${index}`} className="bg-red-500/6 border border-red-500/15 rounded-xl px-3.5 py-3 space-y-1.5">
          <p className="text-xs text-red-300 font-semibold">{item.mistake}</p>
          {item.correction && <p className="text-xs text-heading font-medium">✓ {item.correction}</p>}
          {item.explanation && <p className="text-xs text-muted leading-relaxed">{item.explanation}</p>}
        </div>
      ))}
    </div>
  );
}

export default function WordPopup() {
  const { wordPopupOpen, selectedWord, wordPopupSentence, currentVideo, setSelectedWord, savedWords } = useStore();
  const { closeWordPopup, saveWord } = useDictionary();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [showPronunciation, setShowPronunciation] = useState(false);
  const [visible, setVisible] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (wordPopupOpen && selectedWord) {
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [wordPopupOpen, selectedWord]);

  useEffect(() => {
    if (!selectedWord?.word) return;
    const alreadySaved = savedWords.some((item) => item.word?.toLowerCase() === selectedWord.word.toLowerCase());
    setSaved(alreadySaved);
    setShowPronunciation(false);
  }, [selectedWord?.word, savedWords]);

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
    if (ok) {
      sfx.save();
      setSaved(true);
    }
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

  const w = selectedWord as typeof selectedWord & { _ai_entry?: AIEntryPayload };
  const ai = w._ai_entry;
  const ps = posStyle(w.part_of_speech);
  const definitions = w.definitions || [];
  const examples = w.examples || [];
  const synonyms = w.synonyms || [];
  const antonyms = w.antonyms || [];
  const collocations = w.collocations || [];
  const conjugations = w.conjugations || {};
  const hasConjugations = Object.keys(conjugations).length > 0;

  const meanings = ai?.meanings || [];
  const grammar = ai?.grammar_analysis;
  const exampleDetails = ai?.example_details || [];
  const synonymDetails = ai?.synonym_details || [];
  const antonymDetails = ai?.antonym_details || [];
  const collocationDetails = ai?.collocation_details || [];
  const commonPhrases = ai?.common_phrases || [];
  const phrasalVerbs = ai?.phrasal_verbs || [];
  const commonMistakes = ai?.common_mistakes || [];
  const teachingNotes = ai?.teaching_notes || [];

  const grammarStats = [
    { label: 'Base', value: grammar?.base_form || w.root_form },
    { label: 'Form', value: grammar?.form_type },
    { label: 'Tense', value: grammar?.tense },
    { label: 'Voice', value: grammar?.voice },
  ].filter((item) => item.value);

  return (
    <ModalShell visible={visible} onClose={handleClose} width="lg" panelRef={sheetRef} contentClassName="px-5 pb-8 pt-2">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
            <h2 className="text-3xl font-extrabold text-heading tracking-tight">{w.word}</h2>
            <LevelBadge level={(w.level || ai?.cefr_level || 'B1') as CEFRLevel} />
            {w.ai_enriched && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/20 font-semibold">
                AI
              </span>
            )}
            {typeof ai?.frequency_score === 'number' && (
              <span className={`text-xs px-2 py-0.5 rounded-full border ${toneClass(ai.frequency_label || '')}`}>
                {ai.frequency_label || 'Common'} · {ai.frequency_score}/100
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {w.part_of_speech && w.part_of_speech !== 'unknown' && (
              <span className={`text-xs px-2.5 py-0.5 rounded-lg font-semibold border ${ps.color}`}>
                {ps.label}
              </span>
            )}
            {w.pronunciation && <span className="text-sm text-body font-mono">{w.pronunciation}</span>}
          </div>
          {ai?.part_of_speech_explanation && (
            <p className="text-xs text-muted mt-2 leading-relaxed">{ai.part_of_speech_explanation}</p>
          )}
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

      {w.meaning_ar && (
        <div className="mt-4 bg-gradient-to-r from-blue-500/8 to-purple-500/8 border border-blue-500/15 rounded-2xl px-4 py-3.5">
          <p className="text-xs text-blue-400/70 uppercase tracking-wider mb-1">Arabic Translation</p>
          <p
            className="text-xl font-bold text-heading"
            style={{ direction: 'rtl', textAlign: 'right', unicodeBidi: 'isolate', fontFamily: "'Segoe UI', 'Noto Sans Arabic', Arial, sans-serif" }}
          >
            {w.meaning_ar}
          </p>
        </div>
      )}

      {ai?.word_explanation && (
        <Section title="Explanation" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 1 7 7c0 2.87-1.7 5.27-4 6.46V17a1 1 0 0 1-1 1H10a1 1 0 0 1-1-1v-1.54C6.7 14.27 5 11.87 5 9a7 7 0 0 1 7-7z"/></svg>}>
          <div className="bg-card/50 rounded-xl px-3.5 py-3 border border-line/30">
            <p className="text-sm text-body leading-relaxed">{ai.word_explanation}</p>
          </div>
        </Section>
      )}

      {/* Memory hook (mnemonic) + visual association */}
      <Section title="Remember It" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M9.5 2a5.5 5.5 0 0 1 5 7.8c-.4.9-.5 1.4-.5 2.2V14H10v-2c0-.8-.1-1.3-.5-2.2A5.5 5.5 0 0 1 9.5 2z"/><path d="M9 18h6M10 21h4"/></svg>}>
        <div className="space-y-3">
          <MnemonicSection word={w.word} meaningAr={w.meaning_ar} meaningEn={w.meaning_en} variant="sheet" />
          <WordImage word={w.word} variant="sheet" />
        </div>
      </Section>

      {meanings.length > 0 ? (
        <Section title="Meanings" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="18" rx="1"/><path d="M17 3l4 2v14l-4 2V3z"/></svg>}>
          <div className="space-y-2.5">
            {meanings.slice(0, 4).map((item) => (
              <div key={`${item.rank}-${item.english_simple}`} className="bg-card/50 rounded-xl px-3.5 py-3 border border-line/30 space-y-2">
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-500/15 text-blue-400 text-[11px] font-bold flex items-center justify-center mt-0.5 shrink-0">
                    {item.rank}
                  </span>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="text-sm text-body leading-relaxed">{item.english_simple}</p>
                    {item.english_advanced && item.english_advanced !== item.english_simple && (
                      <p className="text-xs text-muted leading-relaxed">{item.english_advanced}</p>
                    )}
                    {item.arabic && (
                      <p className="text-sm text-heading"
                         style={{ direction: 'rtl', textAlign: 'right', fontFamily: "'Segoe UI', 'Noto Sans Arabic', sans-serif" }}>
                        {item.arabic}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {item.context && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full border bg-elevated/50 text-muted border-line">
                          {item.context}
                        </span>
                      )}
                      {item.register && (
                        <span className={`text-[11px] px-2 py-0.5 rounded-full border ${toneClass(item.register)}`}>
                          {item.register}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      ) : w.meaning_en ? (
        <Section title="Definition" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>}>
          <p className="text-sm text-heading leading-relaxed">{w.meaning_en}</p>
        </Section>
      ) : null}

      {(grammarStats.length > 0 || grammar?.summary || grammar?.notes?.length || grammar?.used_with?.length || hasConjugations) && (
        <Section title="Grammar Insight" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01" strokeWidth="2.5"/></svg>}>
          <div className="space-y-3">
            {grammar?.summary && (
              <div className="bg-card/50 rounded-xl px-3.5 py-3 border border-line/30">
                <p className="text-sm text-body leading-relaxed">{grammar.summary}</p>
              </div>
            )}

            {grammarStats.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {grammarStats.map((item) => (
                  <div key={item.label} className="bg-card/50 rounded-xl px-3 py-2.5 border border-line/30">
                    <p className="text-[11px] uppercase tracking-wider text-faint mb-1">{item.label}</p>
                    <p className="text-sm font-semibold text-heading break-words">{item.value}</p>
                  </div>
                ))}
              </div>
            )}

            {grammar?.used_with && grammar.used_with.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {grammar.used_with.map((item) => (
                  <span key={item} className="text-xs px-2.5 py-1 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20">
                    {item}
                  </span>
                ))}
              </div>
            )}

            {grammar?.notes && grammar.notes.length > 0 && (
              <div className="space-y-1.5">
                {grammar.notes.slice(0, 3).map((item, index) => (
                  <p key={`${item}-${index}`} className="text-sm text-body leading-relaxed">• {item}</p>
                ))}
              </div>
            )}

            {hasConjugations && (
              <div className="grid grid-cols-2 gap-1.5">
                {Object.entries(conjugations).map(([key, value]) => (
                  <div key={key} className="flex justify-between items-center px-3 py-2 bg-card/50 rounded-xl border border-line/30">
                    <span className="text-xs text-muted capitalize">{key}</span>
                    <span className="text-xs text-heading font-medium">{value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Section>
      )}

      {wordPopupSentence && (
        <Section title="In Context" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="1" y="4" width="15" height="16" rx="2"/><polygon points="16 9 23 4 23 20 16 15 16 9"/></svg>}>
          <div className="bg-card/40 rounded-xl px-4 py-3 border border-line/30">
            <p className="text-base text-body leading-relaxed">
              {(() => {
                try {
                  const escaped = w.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                  const pattern = new RegExp(`((?<![\\w'])${escaped}(?![\\w']))`, 'gi');
                  return wordPopupSentence.split(pattern).map((part: string, index: number) =>
                    part.toLowerCase() === w.word.toLowerCase()
                      ? <mark key={index} className="bg-blue-500/30 text-blue-300 rounded px-0.5 font-semibold">{part}</mark>
                      : <span key={index}>{part}</span>
                  );
                } catch {
                  return <span>{wordPopupSentence}</span>;
                }
              })()}
            </p>
          </div>
        </Section>
      )}

      {(exampleDetails.length > 0 || examples.length > 0) && (
        <Section title="Examples" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>}>
          <ExampleCards items={exampleDetails} fallback={examples} />
        </Section>
      )}

      {(synonymDetails.length > 0 || synonyms.length > 0) && (
        <Section title="Synonyms" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>}>
          <RelationList items={synonymDetails} fallback={synonyms} />
        </Section>
      )}

      {(antonymDetails.length > 0 || antonyms.length > 0) && (
        <Section title="Antonyms" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>}>
          <RelationList items={antonymDetails} fallback={antonyms} />
        </Section>
      )}

      {(collocationDetails.length > 0 || collocations.length > 0) && (
        <Section title="Collocations" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M8 12h8"/><path d="M12 8v8"/><circle cx="12" cy="12" r="9"/></svg>}>
          <CollocationCards items={collocationDetails} fallback={collocations} />
        </Section>
      )}

      {commonPhrases.length > 0 && (
        <Section title="Common Phrases" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>}>
          <PhraseCards items={commonPhrases} type="phrase" />
        </Section>
      )}

      {phrasalVerbs.length > 0 && (
        <Section title="Phrasal Verbs" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>}>
          <PhraseCards items={phrasalVerbs} type="phrasal" />
        </Section>
      )}

      {commonMistakes.length > 0 && (
        <Section title="Common Mistakes" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="2.5"/></svg>}>
          <MistakeCards items={commonMistakes} />
        </Section>
      )}

      {teachingNotes.length > 0 && (
        <Section title="Learning Tips" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 1 7 7c0 2.87-1.7 5.27-4 6.46V17a1 1 0 0 1-1 1H10a1 1 0 0 1-1-1v-1.54C6.7 14.27 5 11.87 5 9a7 7 0 0 1 7-7z"/></svg>}>
          <div className="space-y-1.5">
            {teachingNotes.slice(0, 3).map((item, index) => (
              <p key={`${item}-${index}`} className="text-sm text-body leading-relaxed">• {item}</p>
            ))}
          </div>
        </Section>
      )}

      {!w.ai_enriched && (
        <div className="mt-4">
          <button
            onClick={handleEnrich}
            disabled={enriching}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border border-default bg-elevated text-muted hover:border-purple-500/30 hover:bg-purple-500/8 hover:text-purple-400 active:scale-[0.98] transition-all text-sm font-medium disabled:opacity-50"
          >
            {enriching ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-muted/30 border-t-muted rounded-full animate-spin" />
                Getting better data…
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
                Improve definition with AI
              </>
            )}
          </button>
        </div>
      )}

      <div className="mt-3">
        {saved ? (
          <div className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-green-500/10 border border-green-500/25 text-green-500 text-sm font-medium">
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Already in your vocabulary
          </div>
        ) : (
          <Button onClick={handleSave} loading={saving} variant="primary" className="w-full py-3">
            + Save word
          </Button>
        )}
      </div>

      {showPronunciation && (
        <PronunciationTrainer
          word={w.word}
          pronunciation={w.pronunciation}
          onClose={() => setShowPronunciation(false)}
        />
      )}
    </ModalShell>
  );
}
