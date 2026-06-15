/**
 * WordDetailView — Full word detail page.
 *
 * Opened from VocabularyView when the user taps a word card.
 * Shows everything about the saved word:
 *
 *  📖 Definition + part of speech + CEFR level
 *  🌍 Arabic translation
 *  💡 Rich AI explanation / usage notes
 *  🧠 Grammar analysis
 *  ✏️  Example sentences (with Arabic + level when available)
 *  🔗 Synonyms + antonyms
 *  🔄 Collocations / phrasal verbs / word family
 *  📊 SM-2 learning stats (ease, interval, lapses, streak)
 *  📅 Review history chart (last 20 reviews)
 *  🔊 TTS pronunciation
 *  🎤 Pronunciation trainer
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useStore } from '@/store/appStore';
import { useDictionary } from '@/hooks/useDictionary';
import { vocabularyApi } from '@/lib/api';
import { speak as ttsSpeak } from '@/lib/tts';
import * as sfx from '@/lib/sfx';
import type {
  AICommonMistakeItem,
  AICommonPhraseItem,
  AICollocationItem,
  AIEntryPayload,
  AIExampleItem,
  AIPhrasalVerbItem,
  AIRelationItem,
  AIWordFamilyItem,
  CEFRLevel,
  SavedWord,
  ReviewHistoryItem,
} from '@/types';
import { LevelBadge } from '@/components/ui/Badge';
import PronunciationTrainer from '@/components/dictionary/PronunciationTrainer';
import MnemonicSection from '@/components/dictionary/MnemonicSection';

function fmtDate(v?: string): string {
  if (!v) return '—';
  const d = new Date(v.replace(' ', 'T'));
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtRelative(v?: string): string {
  if (!v) return '—';
  const d = new Date(v.replace(' ', 'T'));
  if (isNaN(d.getTime())) return '—';
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function qualityLabel(q: number): { text: string; color: string } {
  const map: Record<number, { text: string; color: string }> = {
    0: { text: 'Again', color: 'text-red-400' },
    1: { text: 'Again', color: 'text-red-400' },
    2: { text: 'Hard', color: 'text-orange-400' },
    3: { text: 'Good', color: 'text-blue-400' },
    4: { text: 'Good', color: 'text-blue-400' },
    5: { text: 'Easy', color: 'text-green-400' },
  };
  return map[q] ?? { text: String(q), color: 'text-muted' };
}

function toneClass(value?: string) {
  const normalized = (value || '').toLowerCase();
  if (normalized === 'high' || normalized === 'very common') return 'bg-green-500/10 text-green-400 border-green-500/20';
  if (normalized === 'medium' || normalized === 'common') return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
  if (normalized === 'low' || normalized === 'uncommon' || normalized === 'rare') return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
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

const STATUS_COLOR: Record<string, string> = {
  learning: 'bg-amber-500/10 text-amber-500',
  reviewing: 'bg-blue-500/10 text-blue-500',
  learned: 'bg-green-500/10 text-green-500',
};

function Section({ title, icon, children, className = '' }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`mt-5 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <span>{icon}</span>
        <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function SM2Bar({ ef }: { ef?: number }) {
  const v = Math.max(0, Math.min(100, (((ef ?? 2.5) - 1.3) / (3.0 - 1.3)) * 100));
  const col = v >= 70 ? 'bg-green-500' : v >= 40 ? 'bg-blue-500' : 'bg-amber-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-elevated rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${col}`} style={{ width: `${v}%` }} />
      </div>
      <span className="text-xs text-faint tabular-nums">{Math.round(v)}%</span>
    </div>
  );
}

function ReviewHistoryChart({ items }: { items: ReviewHistoryItem[] }) {
  const last = items.slice(0, 10).reverse();
  const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#8b5cf6'];
  return (
    <div className="flex items-end gap-1.5 h-12">
      {last.map((r) => {
        const h = Math.max(20, (r.quality / 5) * 100);
        const col = COLORS[r.quality] ?? '#64748b';
        return (
          <div key={r.id} className="flex flex-col items-center gap-1 flex-1">
            <div className="w-full rounded-t-md transition-all" style={{ height: `${h}%`, backgroundColor: `${col}99` }} title={qualityLabel(r.quality).text} />
            <span className="text-[8px] text-faint">{r.quality}</span>
          </div>
        );
      })}
      {last.length === 0 && <p className="text-xs text-faint self-center w-full text-center">No reviews yet</p>}
    </div>
  );
}

function DetailExamples({ items, fallback }: { items: AIExampleItem[]; fallback: string[] }) {
  if (items.length > 0) {
    return (
      <div className="space-y-2.5">
        {items.slice(0, 8).map((item, index) => (
          <div key={`${item.english}-${index}`} className="bg-card border border-default rounded-xl px-3.5 py-3 space-y-2">
            <div className="flex items-start gap-2.5 group">
              <span className="text-blue-500/60 font-bold text-xs mt-1 shrink-0">{index + 1}.</span>
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
                onClick={() => ttsSpeak(item.english, { rate: 0.95 })}
                className="shrink-0 w-7 h-7 rounded-lg text-faint hover:text-blue-500 hover:bg-card flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all text-sm"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" opacity="0.9" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {fallback.slice(0, 4).map((ex, index) => (
        <div key={`${ex}-${index}`} className="flex items-start gap-2.5 group">
          <span className="text-blue-500/60 font-bold text-xs mt-1 shrink-0">{index + 1}.</span>
          <p className="text-sm text-body leading-relaxed flex-1">{ex}</p>
          <button onClick={() => ttsSpeak(ex, { rate: 0.95 })}
            className="shrink-0 w-7 h-7 rounded-lg text-faint hover:text-blue-500 hover:bg-card flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all text-sm">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" opacity="0.9" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>
          </button>
        </div>
      ))}
    </div>
  );
}

function RelationCards({ items, fallback, tone }: { items: AIRelationItem[]; fallback: string[]; tone: 'green' | 'red' }) {
  const toneClassName = tone === 'green'
    ? 'bg-green-500/10 text-green-500 border-green-500/15'
    : 'bg-red-500/10 text-red-400 border-red-500/15';

  if (items.length > 0) {
    return (
      <div className="space-y-2">
        {items.slice(0, 6).map((item, index) => (
          <div key={`${item.term}-${index}`} className="bg-card border border-default rounded-xl px-3.5 py-3 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-heading">{item.term}</span>
              {item.commonness && (
                <span className={`text-[11px] px-2 py-0.5 rounded-full border ${toneClass(item.commonness)}`}>
                  {item.commonness}
                </span>
              )}
            </div>
            {item.short_definition && <p className="text-xs text-muted leading-relaxed">{item.short_definition}</p>}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {fallback.slice(0, 8).map((item) => (
        <span key={item} className={`text-xs px-2 py-1 rounded-lg border ${toneClassName}`}>
          {item}
        </span>
      ))}
    </div>
  );
}

function CollocationCards({ items, fallback }: { items: AICollocationItem[]; fallback: string[] }) {
  if (items.length > 0) {
    return (
      <div className="space-y-2">
        {items.slice(0, 6).map((item, index) => (
          <div key={`${item.expression}-${index}`} className="bg-card border border-default rounded-xl px-3.5 py-3 space-y-1.5">
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
    <div className="flex flex-wrap gap-2">
      {fallback.slice(0, 8).map((item) => (
        <span key={item} className="text-xs px-3 py-1.5 bg-blue-500/8 text-blue-500 rounded-full border border-blue-500/15 font-medium">
          {item}
        </span>
      ))}
    </div>
  );
}

function PhraseCards({ items, type }: { items: AICommonPhraseItem[] | AIPhrasalVerbItem[]; type: 'phrase' | 'phrasal' }) {
  return (
    <div className="space-y-2">
      {items.slice(0, 6).map((item, index) => {
        const title = type === 'phrasal' ? (item as AIPhrasalVerbItem).phrasal_verb : (item as AICommonPhraseItem).expression;
        return (
          <div key={`${title}-${index}`} className="bg-card border border-default rounded-xl px-3.5 py-3 space-y-1.5">
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

function WordFamilyCards({ items, fallback }: { items: AIWordFamilyItem[]; fallback: string[] }) {
  if (items.length > 0) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {items.slice(0, 8).map((item, index) => (
          <div key={`${item.term}-${index}`} className="bg-card border border-default rounded-xl px-3 py-2.5 space-y-1">
            <div className="text-sm font-semibold text-heading">{item.term}</div>
            {item.part_of_speech && <div className="text-[11px] text-muted uppercase tracking-wider">{item.part_of_speech}</div>}
            {item.meaning && <div className="text-xs text-body leading-relaxed">{item.meaning}</div>}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {fallback.slice(0, 8).map((item) => (
        <span key={item} className="text-xs px-3 py-1.5 bg-blue-500/8 text-blue-500 rounded-full border border-blue-500/15 font-medium">
          {item}
        </span>
      ))}
    </div>
  );
}

function MistakeCards({ items }: { items: AICommonMistakeItem[] }) {
  return (
    <div className="space-y-2">
      {items.slice(0, 5).map((item, index) => (
        <div key={`${item.mistake}-${index}`} className="bg-red-500/5 border border-red-500/20 rounded-xl px-3.5 py-3 space-y-1.5">
          <p className="text-sm font-semibold text-red-400">{item.mistake}</p>
          {item.correction && <p className="text-sm text-heading">✓ {item.correction}</p>}
          {item.explanation && <p className="text-xs text-muted leading-relaxed">{item.explanation}</p>}
        </div>
      ))}
    </div>
  );
}

export default function WordDetailView() {
  const { currentSavedWordId, setCurrentSavedWordId, setPage, currentPage } = useStore();
  const { loadReviewHistory, updateSavedWord, deleteWord } = useDictionary();

  const [word, setWord] = useState<SavedWord | null>(null);
  const [history, setHistory] = useState<ReviewHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPronunciation, setShowPronunciation] = useState(false);
  const [favorite, setFavorite] = useState(false);

  const load = useCallback(async () => {
    if (!currentSavedWordId) return;
    setLoading(true);
    try {
      const [found, histData] = await Promise.all([
        vocabularyApi.getOne(currentSavedWordId),
        loadReviewHistory(currentSavedWordId, 20).catch(() => ({ history: [] })),
      ]);
      if (found) {
        setWord(found);
        setFavorite(found.favorite || false);
      }
      setHistory((histData as any)?.history || []);
    } catch {
      setWord(null);
    } finally {
      setLoading(false);
    }
  }, [currentSavedWordId, loadReviewHistory]);

  useEffect(() => {
    if (currentPage === 'worddetail' && currentSavedWordId) load();
  }, [currentPage, currentSavedWordId]); // eslint-disable-line

  const goBack = () => {
    setCurrentSavedWordId(null);
    setPage('vocabulary');
  };

  const toggleFavorite = async () => {
    if (!word) return;
    const next = !favorite;
    setFavorite(next);
    sfx.tap();
    await updateSavedWord(word.id, { favorite: next });
  };

  const handleDelete = async () => {
    if (!word || !confirm(`Delete "${word.word}" from vocabulary?`)) return;
    sfx.deleteSfx();
    await deleteWord(word.id);
    goBack();
  };

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-6 pb-28 space-y-4 animate-fade-in">
        <div className="skeleton h-10 w-40 rounded-2xl" />
        <div className="skeleton h-48 rounded-3xl" />
        <div className="skeleton h-32 rounded-2xl" />
        <div className="skeleton h-32 rounded-2xl" />
      </div>
    );
  }

  if (!word) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 text-center px-4">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-muted/10 flex items-center justify-center"><svg className="w-7 h-7 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="2.5" /></svg></div>
        <div className="text-base font-semibold text-heading mb-2">Word not found</div>
        <button onClick={goBack} className="text-sm text-blue-500 font-medium">← Back to vocabulary</button>
      </div>
    );
  }

  const w = word as SavedWord & { _ai_entry?: AIEntryPayload };
  const ai = w._ai_entry;
  const definitions = w.definitions || [];
  const examples = w.examples || [];
  const synonyms = w.synonyms || [];
  const antonyms = w.antonyms || [];
  const conjugations = w.conjugations || {};
  const relatedWords = w.related_words || [];

  const meanings = ai?.meanings || [];
  const grammar = ai?.grammar_analysis;
  const exampleDetails = ai?.example_details || [];
  const synonymDetails = ai?.synonym_details || [];
  const antonymDetails = ai?.antonym_details || [];
  const collocationDetails = ai?.collocation_details || [];
  const commonPhrases = ai?.common_phrases || [];
  const phrasalVerbs = ai?.phrasal_verbs || [];
  const wordFamily = ai?.word_family || [];
  const commonMistakes = ai?.common_mistakes || [];
  const teachingNotes = ai?.teaching_notes || [];

  const efPct = Math.round(Math.max(0, Math.min(100, ((w.ease_factor ?? 2.5) - 1.3) / (3.0 - 1.3) * 100)));
  const grammarStats = [
    { label: 'Base form', value: grammar?.base_form || w.root_form },
    { label: 'Form type', value: grammar?.form_type },
    { label: 'Tense', value: grammar?.tense },
    { label: 'Aspect', value: grammar?.aspect },
    { label: 'Voice', value: grammar?.voice },
    { label: 'Sentence type', value: grammar?.sentence_type },
    { label: 'Comparison', value: grammar?.comparison_type },
    { label: 'Number', value: grammar?.number },
  ].filter((item) => item.value);

  return (
    <div className="max-w-lg mx-auto px-4 pt-5 pb-28 lg:pb-8 animate-fade-in">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={goBack}
          className="w-9 h-9 rounded-xl hover:bg-card text-muted hover:text-body flex items-center justify-center transition-colors">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="w-4 h-4">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-sm text-muted">Word Detail</div>
          <div className="text-base font-semibold text-heading truncate">{word.word}</div>
        </div>
        <button onClick={toggleFavorite}
          className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-all active:scale-90 ${favorite ? 'text-yellow-400 bg-yellow-400/10' : 'text-faint hover:text-yellow-400 hover:bg-yellow-400/10'}`}
          title={favorite ? 'Remove from favorites' : 'Add to favorites'}>
          {favorite ? (<svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>) : (<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>)}
        </button>
        <button onClick={handleDelete}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-sm text-faint hover:text-red-400 hover:bg-red-400/10 transition-all"
          title="Delete word">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /></svg>
        </button>
      </div>

      <div className="bg-card border border-default rounded-3xl p-5">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap mb-1">
              <h1 className="text-4xl font-black text-heading tracking-tight">{word.word}</h1>
              {word.level && <LevelBadge level={word.level as CEFRLevel} />}
              {w.ai_enriched && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/20 font-semibold">✨ AI</span>
              )}
              {typeof ai?.frequency_score === 'number' && (
                <span className={`text-xs px-2 py-0.5 rounded-full border ${toneClass(ai.frequency_label || '')}`}>
                  {ai.frequency_label || 'Common'} · {ai.frequency_score}/100
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {word.part_of_speech && word.part_of_speech !== 'unknown' && (
                <span className="text-xs px-2 py-0.5 rounded-lg bg-elevated text-muted font-medium">
                  {word.part_of_speech}
                </span>
              )}
              {word.pronunciation && <span className="text-sm text-body font-mono">{word.pronunciation}</span>}
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[word.status] || 'text-muted'}`}>
                {word.status}
              </span>
              {typeof ai?.confidence === 'number' && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-elevated text-muted font-medium border border-line/30">
                  Confidence {Math.round(ai.confidence * 100)}%
                </span>
              )}
            </div>
            {ai?.part_of_speech_explanation && (
              <p className="text-xs text-muted mt-2 leading-relaxed">{ai.part_of_speech_explanation}</p>
            )}
          </div>

          <div className="flex flex-col gap-2 shrink-0">
            <button onClick={() => ttsSpeak(word.word, { rate: 0.85 })}
              className="w-10 h-10 rounded-2xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 flex items-center justify-center text-lg transition-all active:scale-90"
              title="Pronounce"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" opacity="0.9" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /></svg></button>
            <button onClick={() => setShowPronunciation(true)}
              className="w-10 h-10 rounded-2xl bg-green-500/10 hover:bg-green-500/20 text-green-500 flex items-center justify-center text-lg transition-all active:scale-90"
              title="Practice pronunciation"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0" /><path d="M12 19v3M8 22h8" /></svg></button>
          </div>
        </div>

        {word.meaning_ar && (
          <div className="mt-4 bg-blue-500/6 border border-blue-500/15 rounded-2xl px-4 py-3">
            <p className="text-xs text-blue-400/70 uppercase tracking-wider mb-1">Arabic Translation</p>
            <p className="text-xl font-bold text-heading"
               style={{ direction: 'rtl', textAlign: 'right', fontFamily: "'Segoe UI', 'Noto Sans Arabic', sans-serif" }}>
              {word.meaning_ar}
            </p>
          </div>
        )}

        {word.meaning_en && (
          <div className="mt-4">
            <p className="text-xs text-muted uppercase tracking-wider mb-1.5">Definition</p>
            <p className="text-base text-heading leading-relaxed">{word.meaning_en}</p>
          </div>
        )}
      </div>

      {ai?.word_explanation && (
        <Section title="How to Use" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M9 18h6M10 22h4" /><path d="M12 2a7 7 0 0 1 7 7c0 2.87-1.7 5.27-4 6.46V17a1 1 0 0 1-1 1H10a1 1 0 0 1-1-1v-1.54C6.7 14.27 5 11.87 5 9a7 7 0 0 1 7-7z" /></svg>}>
          <div className="bg-card border border-default rounded-xl px-3.5 py-3">
            <p className="text-base text-body leading-relaxed">{ai.word_explanation}</p>
          </div>
        </Section>
      )}

      {/* Memory hook (mnemonic) — helps the word stick */}
      <Section title="Remember It" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M9.5 2a5.5 5.5 0 0 1 5 7.8c-.4.9-.5 1.4-.5 2.2V14H10v-2c0-.8-.1-1.3-.5-2.2A5.5 5.5 0 0 1 9.5 2z"/><path d="M9 18h6M10 21h4"/></svg>}>
        <MnemonicSection word={word.word} meaningAr={word.meaning_ar} meaningEn={word.meaning_en} variant="page" />
      </Section>

      {meanings.length > 0 ? (
        <Section title="Meaning Breakdown" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="3" width="5" height="18" rx="1" /><rect x="10" y="3" width="5" height="18" rx="1" /><path d="M17 3l4 2v14l-4 2V3z" /></svg>}>
          <div className="space-y-2">
            {meanings.slice(0, 6).map((item) => (
              <div key={`${item.rank}-${item.english_simple}`} className="bg-card border border-default rounded-xl px-3.5 py-3 space-y-2">
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
      ) : definitions.length > 0 && (
        <Section title="All Meanings" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="3" width="5" height="18" rx="1" /><rect x="10" y="3" width="5" height="18" rx="1" /><path d="M17 3l4 2v14l-4 2V3z" /></svg>}>
          <div className="space-y-2">
            {definitions.slice(0, 5).map((d, index) => (
              <div key={`${d.definition}-${index}`} className="bg-card border border-default rounded-xl px-3.5 py-3">
                {d.part_of_speech && <span className="text-xs px-1.5 py-0.5 rounded bg-elevated text-muted font-semibold uppercase mr-2">{d.part_of_speech}</span>}
                <span className="text-sm text-body">{d.definition}</span>
                {d.example && <p className="text-xs text-muted italic mt-1.5">"{d.example}"</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {(grammar?.summary || grammarStats.length > 0 || grammar?.used_with?.length || grammar?.notes?.length || grammar?.breakdown?.length || Object.keys(conjugations).length > 0) && (
        <Section title="Grammar Analysis" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3 6h.01M3 12h.01M3 18h.01" strokeWidth="2.5" /></svg>}>
          <div className="bg-card border border-default rounded-2xl p-4 space-y-4">
            {grammar?.summary && <p className="text-sm text-body leading-relaxed">{grammar.summary}</p>}

            {grammarStats.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {grammarStats.map((item) => (
                  <div key={item.label} className="bg-elevated rounded-xl px-3 py-2.5">
                    <p className="text-[11px] uppercase tracking-wider text-faint mb-1">{item.label}</p>
                    <p className="text-sm font-semibold text-heading break-words">{item.value}</p>
                  </div>
                ))}
              </div>
            )}

            {grammar?.breakdown && grammar.breakdown.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {grammar.breakdown.map((item) => (
                  <span key={`${item.label}-${item.value}`} className="text-xs px-2.5 py-1 rounded-lg border bg-blue-500/10 text-blue-400 border-blue-500/20">
                    {item.label}: {item.value}
                  </span>
                ))}
              </div>
            )}

            {grammar?.used_with && grammar.used_with.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {grammar.used_with.map((item) => (
                  <span key={item} className="text-xs px-2.5 py-1 rounded-lg border bg-elevated/50 text-muted border-line">
                    {item}
                  </span>
                ))}
              </div>
            )}

            {grammar?.notes && grammar.notes.length > 0 && (
              <div className="space-y-1.5">
                {grammar.notes.map((note, index) => (
                  <p key={`${note}-${index}`} className="text-sm text-body leading-relaxed">• {note}</p>
                ))}
              </div>
            )}

            {Object.keys(conjugations).length > 0 && (
              <div className="grid grid-cols-2 gap-1.5">
                {Object.entries(conjugations).map(([key, value]) => (
                  <div key={key} className="flex justify-between items-center px-3 py-2 bg-elevated rounded-xl">
                    <span className="text-xs text-muted capitalize">{key}</span>
                    <span className="text-xs text-heading font-semibold">{String(value)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Section>
      )}

      {word.sentence && (
        <Section title="Saved Context" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="1" y="4" width="15" height="16" rx="2" /><polygon points="16 9 23 4 23 20 16 15 16 9" /></svg>}>
          <div className="bg-card border border-default rounded-xl px-4 py-3">
            <p className="text-sm text-body leading-relaxed italic">"{word.sentence}"</p>
            {word.source_video_title && <p className="text-xs text-faint mt-1.5">— {word.source_video_title}</p>}
          </div>
        </Section>
      )}

      {(exampleDetails.length > 0 || examples.length > 0) && (
        <Section title="Examples" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z" /></svg>}>
          <DetailExamples items={exampleDetails} fallback={examples} />
        </Section>
      )}

      {(synonymDetails.length > 0 || antonymDetails.length > 0 || synonyms.length > 0 || antonyms.length > 0) && (
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(synonymDetails.length > 0 || synonyms.length > 0) && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
                <span className="text-xs font-semibold text-muted uppercase tracking-wider">Synonyms</span>
              </div>
              <RelationCards items={synonymDetails} fallback={synonyms} tone="green" />
            </div>
          )}
          {(antonymDetails.length > 0 || antonyms.length > 0) && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>
                <span className="text-xs font-semibold text-muted uppercase tracking-wider">Antonyms</span>
              </div>
              <RelationCards items={antonymDetails} fallback={antonyms} tone="red" />
            </div>
          )}
        </div>
      )}

      {(collocationDetails.length > 0 || (w.collocations || []).length > 0) && (
        <Section title="Collocations" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M8 12h8" /><path d="M12 8v8" /><circle cx="12" cy="12" r="9" /></svg>}>
          <CollocationCards items={collocationDetails} fallback={w.collocations || []} />
        </Section>
      )}

      {commonPhrases.length > 0 && (
        <Section title="Common Phrases" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>}>
          <PhraseCards items={commonPhrases} type="phrase" />
        </Section>
      )}

      {phrasalVerbs.length > 0 && (
        <Section title="Phrasal Verbs" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>}>
          <PhraseCards items={phrasalVerbs} type="phrasal" />
        </Section>
      )}

      {(wordFamily.length > 0 || relatedWords.length > 0) && (
        <Section title="Word Family" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>}>
          <WordFamilyCards items={wordFamily} fallback={relatedWords} />
        </Section>
      )}

      {commonMistakes.length > 0 && (
        <Section title="Common Mistakes" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="2.5" /></svg>}>
          <MistakeCards items={commonMistakes} />
        </Section>
      )}

      {teachingNotes.length > 0 && (
        <Section title="Learning Tips" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M9 18h6M10 22h4" /><path d="M12 2a7 7 0 0 1 7 7c0 2.87-1.7 5.27-4 6.46V17a1 1 0 0 1-1 1H10a1 1 0 0 1-1-1v-1.54C6.7 14.27 5 11.87 5 9a7 7 0 0 1 7-7z" /></svg>}>
          <div className="space-y-2">
            {teachingNotes.map((item, index) => (
              <div key={`${item}-${index}`} className="bg-card border border-default rounded-xl px-3.5 py-3">
                <p className="text-sm text-body leading-relaxed">{item}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Learning Stats" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /><line x1="2" y1="20" x2="22" y2="20" /></svg>}>
        <div className="bg-card border border-default rounded-2xl p-4 space-y-4">
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-muted">Memory strength</span>
              <span className="text-heading font-semibold">{efPct}%</span>
            </div>
            <SM2Bar ef={w.ease_factor} />
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Reviews', val: w.reviewed_count ?? 0, color: 'text-cyan-400' },
              { label: 'Interval', val: `${w.interval ?? 0}d`, color: 'text-blue-400' },
              { label: 'Lapses', val: w.lapses ?? 0, color: (w.lapses ?? 0) > 0 ? 'text-red-400' : 'text-green-400' },
            ].map((item) => (
              <div key={item.label} className="text-center bg-elevated rounded-xl py-2">
                <div className={`text-lg font-bold ${item.color}`}>{String(item.val)}</div>
                <div className="text-xs text-faint">{item.label}</div>
              </div>
            ))}
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted">Last reviewed</span>
              <span className="text-body">{fmtRelative(w.last_reviewed)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Next review</span>
              <span className="text-body">{fmtRelative(w.next_review)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Saved on</span>
              <span className="text-body">{fmtDate(w.created_at)}</span>
            </div>
          </div>
        </div>
      </Section>

      {history.length > 0 && (
        <Section title="Review History" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>}>
          <div className="bg-card border border-default rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted">Last {Math.min(history.length, 10)} reviews</span>
              <div className="flex items-center gap-3 text-xs text-faint">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />Again</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />Good</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" />Easy</span>
              </div>
            </div>
            <ReviewHistoryChart items={history} />
            <div className="mt-3 space-y-1">
              {history.slice(0, 5).map((item) => {
                const q = qualityLabel(item.quality);
                return (
                  <div key={item.id} className="flex items-center justify-between text-xs py-1 border-b border-subtle last:border-0">
                    <span className={`font-medium ${q.color}`}>{q.text}</span>
                    <span className="text-faint">{fmtRelative(item.reviewed_at)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </Section>
      )}

      {showPronunciation && (
        <PronunciationTrainer
          word={word.word}
          pronunciation={word.pronunciation}
          onClose={() => setShowPronunciation(false)}
        />
      )}
    </div>
  );
}
