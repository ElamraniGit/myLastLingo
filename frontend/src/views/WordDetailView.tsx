/**
 * WordDetailView — Full word detail page.
 *
 * Opened from VocabularyView when the user taps a word card.
 * Shows everything about the saved word:
 *
 *  📖 Definition + part of speech + CEFR level
 *  🌍 Arabic translation
 *  💡 How to use / usage tips
 *  ✏️  Example sentences (from dictionary + saved context)
 *  🔗 Synonyms + antonyms
 *  🔄 Verb conjugations
 *  📊 SM-2 learning stats (ease, interval, lapses, streak)
 *  📅 Review history chart (last 20 reviews)
 *  📝 Personal notes (editable inline)
 *  🏷️  Tags (editable inline)
 *  🔊 TTS pronunciation
 *  🎤 Pronunciation trainer
 *  ➕ / ✅ Save / already saved status
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useStore } from '@/store/appStore';
import { useDictionary } from '@/hooks/useDictionary';
import { vocabularyApi } from '@/lib/api';
import { speak as ttsSpeak } from '@/lib/tts';
import * as sfx from '@/lib/sfx';
import type { SavedWord, ReviewHistoryItem, CEFRLevel } from '@/types';
import { LevelBadge } from '@/components/ui/Badge';
import PronunciationTrainer from '@/components/dictionary/PronunciationTrainer';

// ── Helpers ───────────────────────────────────────────────────────────────────

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
  const min  = Math.floor(diff / 60000);
  if (min < 1)   return 'just now';
  if (min < 60)  return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24)    return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function qualityLabel(q: number): { text: string; color: string } {
  const map: Record<number, { text: string; color: string }> = {
    0: { text: 'Again', color: 'text-red-400' },
    1: { text: 'Again', color: 'text-red-400' },
    2: { text: 'Hard',  color: 'text-orange-400' },
    3: { text: 'Good',  color: 'text-blue-400' },
    4: { text: 'Good',  color: 'text-blue-400' },
    5: { text: 'Easy',  color: 'text-green-400' },
  };
  return map[q] ?? { text: String(q), color: 'text-muted' };
}

const STATUS_COLOR: Record<string, string> = {
  learning:  'bg-amber-500/10 text-amber-500',
  reviewing: 'bg-blue-500/10 text-blue-500',
  learned:   'bg-green-500/10 text-green-500',
};

// ── Section wrapper ───────────────────────────────────────────────────────────

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

// ── SM-2 progress bar ─────────────────────────────────────────────────────────

function SM2Bar({ ef }: { ef?: number }) {
  const v   = Math.max(0, Math.min(100, ((( ef ?? 2.5) - 1.3) / (3.0 - 1.3)) * 100));
  const col = v >= 70 ? 'bg-green-500' : v >= 40 ? 'bg-blue-500' : 'bg-amber-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-elevated rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${col}`} style={{ width: `${v}%` }}/>
      </div>
      <span className="text-xs text-faint tabular-nums">{Math.round(v)}%</span>
    </div>
  );
}

// ── Review history mini chart ─────────────────────────────────────────────────

function ReviewHistoryChart({ items }: { items: ReviewHistoryItem[] }) {
  const last = items.slice(0, 10).reverse();
  const COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#8b5cf6'];
  return (
    <div className="flex items-end gap-1.5 h-12">
      {last.map((r, i) => {
        const h   = Math.max(20, (r.quality / 5) * 100);
        const col = COLORS[r.quality] ?? '#64748b';
        return (
          <div key={r.id} className="flex flex-col items-center gap-1 flex-1">
            <div className="w-full rounded-t-md transition-all" style={{ height: `${h}%`, backgroundColor: col + '99' }} title={qualityLabel(r.quality).text} />
            <span className="text-[8px] text-faint">{r.quality}</span>
          </div>
        );
      })}
      {last.length === 0 && (
        <p className="text-xs text-faint self-center w-full text-center">No reviews yet</p>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════

export default function WordDetailView() {
  const { currentSavedWordId, setCurrentSavedWordId, setPage, currentPage } = useStore();
  const { loadReviewHistory, updateSavedWord, deleteWord, reviewWord } = useDictionary();

  const [word,    setWord]    = useState<SavedWord | null>(null);
  const [history, setHistory] = useState<ReviewHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes,   setNotes]   = useState('');
  const [tags,    setTags]    = useState('');
  const [editingNotes, setEditingNotes] = useState(false);
  const [editingTags,  setEditingTags]  = useState(false);
  const [savingMeta,   setSavingMeta]   = useState(false);
  const [showPronunciation, setShowPronunciation] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const tagsRef  = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!currentSavedWordId) return;
    setLoading(true);
    try {
      // Fetch word directly by ID (fast, no need to list all words)
      const [found, histData] = await Promise.all([
        vocabularyApi.getOne(currentSavedWordId),
        loadReviewHistory(currentSavedWordId, 20).catch(() => ({ history: [] })),
      ]);
      if (found) {
        setWord(found);
        setNotes(found.notes || '');
        setTags((found.tags || []).join(', '));
        setFavorite(found.favorite || false);
      }
      setHistory((histData as any)?.history || []);
    } catch (e) {
      // Word not found or network error
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

  const saveMeta = async () => {
    if (!word) return;
    setSavingMeta(true);
    const tagArr = tags.split(',').map(t => t.trim()).filter(Boolean);
    await updateSavedWord(word.id, { notes, tags: tagArr, favorite });
    setSavingMeta(false);
    setEditingNotes(false);
    setEditingTags(false);
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

  if (loading) return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-28 space-y-4 animate-fade-in">
      <div className="skeleton h-10 w-40 rounded-2xl"/>
      <div className="skeleton h-48 rounded-3xl"/>
      <div className="skeleton h-32 rounded-2xl"/>
      <div className="skeleton h-32 rounded-2xl"/>
    </div>
  );

  if (!word) return (
    <div className="flex flex-col items-center justify-center h-full py-20 text-center px-4">
      <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-muted/10 flex items-center justify-center"><svg className="w-7 h-7 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="2.5"/></svg></div>
      <div className="text-base font-semibold text-heading mb-2">Word not found</div>
      <button onClick={goBack} className="text-sm text-blue-500 font-medium">← Back to vocabulary</button>
    </div>
  );

  const w = word as any;
  const definitions  = w.definitions  || [];
  const howToUse     = w.how_to_use   || [];
  const examples     = w.examples     || [];
  const synonyms     = w.synonyms     || [];
  const antonyms     = w.antonyms     || [];
  const conjugations = w.conjugations || {};
  const relatedWords = w.related_words || [];

  const efPct = Math.round(Math.max(0, Math.min(100, ((w.ease_factor ?? 2.5) - 1.3) / (3.0 - 1.3) * 100)));

  return (
    <div className="max-w-lg mx-auto px-4 pt-5 pb-28 lg:pb-8 animate-fade-in">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={goBack}
          className="w-9 h-9 rounded-xl hover:bg-card text-muted hover:text-body flex items-center justify-center transition-colors">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="w-4 h-4">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-sm text-muted">Word Detail</div>
          <div className="text-base font-semibold text-heading truncate">{word.word}</div>
        </div>
        {/* Favorite + Delete */}
        <button onClick={toggleFavorite}
          className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-all active:scale-90 ${favorite ? 'text-yellow-400 bg-yellow-400/10' : 'text-faint hover:text-yellow-400 hover:bg-yellow-400/10'}`}
          title={favorite ? 'Remove from favorites' : 'Add to favorites'}>
          {favorite ? (<svg className='w-5 h-5' viewBox='0 0 24 24' fill='currentColor' stroke='none'><polygon points='12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2'/></svg>) : (<svg className='w-5 h-5' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round'><polygon points='12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2'/></svg>)}
        </button>
        <button onClick={handleDelete}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-sm text-faint hover:text-red-400 hover:bg-red-400/10 transition-all"
          title="Delete word">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
        </button>
      </div>

      {/* ── Word card ────────────────────────────────────────────────────────── */}
      <div className="bg-card border border-default rounded-3xl p-5">

        {/* Word + badges */}
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap mb-1">
              <h1 className="text-4xl font-black text-heading tracking-tight">{word.word}</h1>
              {word.level && <LevelBadge level={word.level as CEFRLevel}/>}
              {w.ai_enriched && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/20 font-semibold">✨ AI</span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {word.part_of_speech && word.part_of_speech !== 'unknown' && (
                <span className="text-xs px-2 py-0.5 rounded-lg bg-elevated text-muted font-medium">
                  {word.part_of_speech}
                </span>
              )}
              {word.pronunciation && (
                <span className="text-sm text-body font-mono">{word.pronunciation}</span>
              )}
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[word.status] || 'text-muted'}`}>
                {word.status}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2 shrink-0">
            <button onClick={() => ttsSpeak(word.word, { rate: 0.85 })}
              className="w-10 h-10 rounded-2xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 flex items-center justify-center text-lg transition-all active:scale-90"
              title="Pronounce"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" opacity="0.9"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg></button>
            <button onClick={() => setShowPronunciation(true)}
              className="w-10 h-10 rounded-2xl bg-green-500/10 hover:bg-green-500/20 text-green-500 flex items-center justify-center text-lg transition-all active:scale-90"
              title="Practice pronunciation"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><path d="M12 19v3M8 22h8"/></svg></button>
          </div>
        </div>

        {/* Arabic */}
        {word.meaning_ar && (
          <div className="mt-4 bg-blue-500/6 border border-blue-500/15 rounded-2xl px-4 py-3">
            <p className="text-xs text-blue-400/70 uppercase tracking-wider mb-1">Arabic Translation</p>
            <p className="text-xl font-bold text-heading"
               style={{ direction: 'rtl', textAlign: 'right', fontFamily: "'Segoe UI', 'Noto Sans Arabic', sans-serif" }}>
              {word.meaning_ar}
            </p>
          </div>
        )}

        {/* Main definition */}
        {word.meaning_en && (
          <div className="mt-4">
            <p className="text-xs text-muted uppercase tracking-wider mb-1.5">Definition</p>
            <p className="text-base text-heading leading-relaxed">{word.meaning_en}</p>
          </div>
        )}
      </div>

      {/* ── How to use ───────────────────────────────────────────────────────── */}
      {howToUse.length > 0 && (
        <Section title="How to Use" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 1 7 7c0 2.87-1.7 5.27-4 6.46V17a1 1 0 0 1-1 1H10a1 1 0 0 1-1-1v-1.54C6.7 14.27 5 11.87 5 9a7 7 0 0 1 7-7z"/></svg>}>
          <div className="space-y-2">
            {howToUse.map((tip: string, i: number) => (
              <div key={i} className="flex items-start gap-2.5 bg-card border border-default rounded-xl px-3.5 py-3">
                <svg className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 1 7 7c0 2.87-1.7 5.27-4 6.46V17a1 1 0 0 1-1 1H10a1 1 0 0 1-1-1v-1.54C6.7 14.27 5 11.87 5 9a7 7 0 0 1 7-7z"/></svg>
                <p className="text-base text-body leading-relaxed">{tip}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Other definitions ────────────────────────────────────────────────── */}
      {definitions.length > 0 && (
        <Section title="All Meanings" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="18" rx="1"/><path d="M17 3l4 2v14l-4 2V3z"/></svg>}>
          <div className="space-y-2">
            {definitions.slice(0, 5).map((d: any, i: number) => (
              <div key={i} className="bg-card border border-default rounded-xl px-3.5 py-3">
                {d.part_of_speech && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-elevated text-muted font-semibold uppercase mr-2">
                    {d.part_of_speech}
                  </span>
                )}
                <span className="text-sm text-body">{d.definition}</span>
                {d.example && (
                  <p className="text-xs text-muted italic mt-1.5">"{d.example}"</p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Context sentence ─────────────────────────────────────────────────── */}
      {word.sentence && (
        <Section title="Saved Context" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="1" y="4" width="15" height="16" rx="2"/><polygon points="16 9 23 4 23 20 16 15 16 9"/></svg>}>
          <div className="bg-card border border-default rounded-xl px-4 py-3">
            <p className="text-sm text-body leading-relaxed italic">"{word.sentence}"</p>
            {word.source_video_title && (
              <p className="text-xs text-faint mt-1.5">— {word.source_video_title}</p>
            )}
          </div>
        </Section>
      )}

      {/* ── Examples ─────────────────────────────────────────────────────────── */}
      {examples.length > 0 && (
        <Section title="Examples" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>}>
          <div className="space-y-2">
            {examples.slice(0, 4).map((ex: string, i: number) => (
              <div key={i} className="flex items-start gap-2.5 group">
                <span className="text-blue-500/60 font-bold text-xs mt-1 shrink-0">{i + 1}.</span>
                <p className="text-sm text-body leading-relaxed flex-1">{ex}</p>
                <button onClick={() => ttsSpeak(ex, { rate: 0.95 })}
                  className="shrink-0 w-7 h-7 rounded-lg text-faint hover:text-blue-500 hover:bg-card flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all text-sm">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" opacity="0.9"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                </button>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Synonyms & Antonyms ───────────────────────────────────────────────── */}
      {(synonyms.length > 0 || antonyms.length > 0) && (
        <div className="mt-5 grid grid-cols-2 gap-3">
          {synonyms.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                <span className="text-xs font-semibold text-muted uppercase tracking-wider">Synonyms</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {synonyms.slice(0, 6).map((s: string) => (
                  <span key={s} className="text-xs px-2 py-1 bg-green-500/10 text-green-500 rounded-lg border border-green-500/15">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
          {antonyms.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
                <span className="text-xs font-semibold text-muted uppercase tracking-wider">Antonyms</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {antonyms.slice(0, 6).map((a: string) => (
                  <span key={a} className="text-xs px-2 py-1 bg-red-500/10 text-red-400 rounded-lg border border-red-500/15">
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Collocations / Related words ─────────────────────────────────────── */}
      {relatedWords.length > 0 && (
        <Section title="Common Phrases" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>}>
          <div className="flex flex-wrap gap-2">
            {relatedWords.slice(0, 6).map((r: string) => (
              <span key={r} className="text-xs px-3 py-1.5 bg-blue-500/8 text-blue-500 rounded-full border border-blue-500/15 font-medium">
                {r}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* ── Conjugations ─────────────────────────────────────────────────────── */}
      {Object.keys(conjugations).length > 0 && (
        <Section title="Conjugations" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>}>
          <div className="grid grid-cols-2 gap-1.5">
            {Object.entries(conjugations).map(([k, v]) => (
              <div key={k} className="flex justify-between items-center px-3 py-2 bg-card border border-default rounded-xl">
                <span className="text-xs text-muted capitalize">{k}</span>
                <span className="text-xs text-heading font-semibold">{String(v)}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── SM-2 Learning Stats ───────────────────────────────────────────────── */}
      <Section title="Learning Stats" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>}>
        <div className="bg-card border border-default rounded-2xl p-4 space-y-4">

          {/* Progress bar */}
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-muted">Memory strength</span>
              <span className="text-heading font-semibold">{efPct}%</span>
            </div>
            <SM2Bar ef={w.ease_factor}/>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Reviews',   val: w.reviewed_count ?? 0,   color: 'text-cyan-400'   },
              { label: 'Interval',  val: `${w.interval ?? 0}d`,   color: 'text-blue-400'   },
              { label: 'Lapses',    val: w.lapses ?? 0,            color: w.lapses > 0 ? 'text-red-400' : 'text-green-400' },
            ].map(s => (
              <div key={s.label} className="text-center bg-elevated rounded-xl py-2">
                <div className={`text-lg font-bold ${s.color}`}>{String(s.val)}</div>
                <div className="text-xs text-faint">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Dates */}
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

      {/* ── Review history chart ──────────────────────────────────────────────── */}
      {history.length > 0 && (
        <Section title="Review History" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}>
          <div className="bg-card border border-default rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted">Last {Math.min(history.length, 10)} reviews</span>
              <div className="flex items-center gap-3 text-xs text-faint">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block"/>Again</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block"/>Good</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block"/>Easy</span>
              </div>
            </div>
            <ReviewHistoryChart items={history}/>
            <div className="mt-3 space-y-1">
              {history.slice(0, 5).map(r => {
                const q = qualityLabel(r.quality);
                return (
                  <div key={r.id} className="flex items-center justify-between text-xs py-1 border-b border-subtle last:border-0">
                    <span className={`font-medium ${q.color}`}>{q.text}</span>
                    <span className="text-faint">{fmtRelative(r.reviewed_at)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </Section>
      )}

      {/* ── Tags ─────────────────────────────────────────────────────────────── */}
      <Section title="Tags" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7" strokeWidth="3"/></svg>}>
        <div className="bg-card border border-default rounded-2xl p-4">
          {!editingTags ? (
            <div className="flex items-center gap-2 flex-wrap">
              {(word.tags || []).length > 0
                ? (word.tags || []).map(tag => (
                    <span key={tag} className="text-xs px-2.5 py-1 bg-blue-500/10 text-blue-500 rounded-full border border-blue-500/20 font-medium">
                      {tag}
                    </span>
                  ))
                : <span className="text-xs text-faint">No tags yet</span>
              }
              <button onClick={() => { setEditingTags(true); setTimeout(() => tagsRef.current?.focus(), 100); }}
                className="text-xs text-blue-500 hover:text-blue-400 ml-auto">Edit</button>
            </div>
          ) : (
            <div className="space-y-2">
              <input
                ref={tagsRef}
                value={tags}
                onChange={e => setTags(e.target.value)}
                placeholder="grammar, idiom, business… (comma separated)"
                className="input-field text-sm py-2"
              />
              <div className="flex gap-2">
                <button onClick={() => setEditingTags(false)} className="flex-1 py-1.5 rounded-xl border border-default text-xs text-muted hover:bg-elevated transition-colors">Cancel</button>
                <button onClick={saveMeta} disabled={savingMeta} className="flex-1 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-medium disabled:opacity-50">
                  {savingMeta ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* ── Notes ────────────────────────────────────────────────────────────── */}
      <Section title="Personal Notes" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>}>
        <div className="bg-card border border-default rounded-2xl p-4">
          {!editingNotes ? (
            <div>
              <p className="text-sm text-body leading-relaxed whitespace-pre-wrap min-h-[2rem]">
                {notes || <span className="text-faint">No notes yet. Tap to add…</span>}
              </p>
              <button onClick={() => { setEditingNotes(true); setTimeout(() => notesRef.current?.focus(), 100); }}
                className="text-xs text-blue-500 hover:text-blue-400 mt-2">
                {notes ? 'Edit' : '+ Add note'}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <textarea
                ref={notesRef}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Write your personal notes, memory tricks, context…"
                rows={4}
                className="input-field text-sm resize-none"
                maxLength={2000}
              />
              <div className="flex justify-between items-center">
                <span className="text-xs text-faint">{notes.length}/2000</span>
                <div className="flex gap-2">
                  <button onClick={() => setEditingNotes(false)} className="px-3 py-1.5 rounded-xl border border-default text-xs text-muted hover:bg-elevated transition-colors">Cancel</button>
                  <button onClick={saveMeta} disabled={savingMeta} className="px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-medium disabled:opacity-50">
                    {savingMeta ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* ── Pronunciation Trainer ─────────────────────────────────────────────── */}
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
