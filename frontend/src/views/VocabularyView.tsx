/**
 * Vocabulary — Apple-style redesign.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useStore } from '@/store/appStore';
import { useDictionary } from '@/hooks/useDictionary';
import type { SavedWord, VocabularyListParams, ReviewSummary } from '@/types';
import { speak as ttsSpeak } from '@/lib/tts';

const STATUS_COLOR: Record<string, string> = {
  learning:  'bg-amber-500/10 text-amber-500',
  reviewing: 'bg-blue-500/10 text-blue-500',
  learned:   'bg-green-500/10 text-green-500',
};

function speak(t: string) { ttsSpeak(t, { rate: 0.9 }); }

function fmtRelative(v?: string) {
  if (!v) return '—';
  const d = new Date(v.replace(' ', 'T'));
  if (isNaN(d.getTime())) return '—';
  const diff = d.getTime() - Date.now();
  const min = Math.round(diff / 60000);
  if (min <= 0) return 'Due';
  if (min < 60)  return `${min}m`;
  const h = Math.round(min / 60);
  if (h < 24)    return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

export default function VocabularyView() {
  const { savedWords, setPage, currentPage } = useStore();
  const { loadVocabulary, loadStats, loadReviewSummary, deleteWord, lookupWord } = useDictionary();
  const [status,  setStatus]  = useState<string | undefined>(undefined);
  const [search,  setSearch]  = useState('');
  const [sort,    setSort]    = useState('newest');
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [, s] = await Promise.all([
      loadVocabulary({ status: status as any, search, sort, page: 1, limit: 200 }),
      loadReviewSummary().catch(() => null),
    ]);
    setSummary(s);
    loadStats();
    setLoading(false);
  }, [status, search, sort, loadVocabulary, loadReviewSummary, loadStats]);

  useEffect(() => { if (currentPage === 'vocabulary') load(); }, [currentPage]); // eslint-disable-line

  const FILTERS = [
    { id: undefined,    label: 'All' },
    { id: 'learning',   label: 'Learning' },
    { id: 'reviewing',  label: 'Reviewing' },
    { id: 'learned',    label: 'Learned' },
  ];

  const STATS = [
    { label: 'Total',     val: savedWords.length,       color: 'text-heading' },
    { label: 'Learning',  val: summary?.learning  ?? 0, color: 'text-amber-500' },
    { label: 'Reviewing', val: summary?.reviewing ?? 0, color: 'text-blue-500' },
    { label: 'Learned',   val: summary?.learned   ?? 0, color: 'text-green-500' },
  ];

  return (
    <div className="max-w-lg mx-auto pb-28 lg:pb-8 animate-fade-in">

      {/* Header */}
      <div className="sticky top-0 z-20 bg-base/90 backdrop-blur-xl border-b border-default px-4 pt-5 pb-3">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-heading">My Words</h2>
            <p className="text-xs text-muted mt-0.5">{savedWords.length} saved · tap for details</p>
          </div>
          {(summary?.due_now ?? 0) > 0 && (
            <button
              onClick={() => setPage('flashcards')}
              className="flex items-center gap-1.5 bg-blue-600 text-white text-xs font-semibold px-3.5 py-2 rounded-xl shadow-sm shadow-blue-600/30 hover:bg-blue-700 active:scale-95 transition-all"
            >
              🃏 Review {summary!.due_now}
            </button>
          )}
        </div>

        {/* Stats pills */}
        <div className="flex gap-2 mb-3 overflow-x-auto scrollbar-none pb-0.5">
          {STATS.map(s => (
            <div key={s.label} className="shrink-0 bg-card border border-default rounded-xl px-3 py-2 text-center min-w-[64px]">
              <div className={`text-lg font-bold ${s.color}`}>{s.val}</div>
              <div className="text-[10px] text-muted">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative mb-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load()}
            placeholder="Search words…"
            className="input-field pl-9 text-sm py-2.5"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {FILTERS.map(f => (
            <button
              key={String(f.id)}
              onClick={() => { setStatus(f.id); }}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                status === f.id
                  ? 'bg-blue-600/15 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                  : 'text-muted hover:text-body bg-card border border-default'
              }`}
            >{f.label}</button>
          ))}
          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            className="ml-auto shrink-0 bg-card border border-default rounded-lg px-2 py-1.5 text-xs text-body outline-none"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="alphabetical">A–Z</option>
            <option value="next_review">Due</option>
            <option value="difficulty">Hardest</option>
          </select>
        </div>
      </div>

      {/* List */}
      <div className="px-4 pt-3">
        {loading ? (
          <div className="space-y-2 mt-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="skeleton h-16 rounded-2xl" />
            ))}
          </div>
        ) : savedWords.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-5xl mb-4">📚</div>
            <div className="text-base font-semibold text-heading mb-1">No words yet</div>
            <div className="text-sm text-muted">Start learning from a video in the Library</div>
          </div>
        ) : (
          <div className="space-y-2">
            {savedWords.map(w => (
              <div
                key={w.id}
                onClick={() => lookupWord(w.word, w.sentence || '')}
                className="flex items-center gap-3 bg-card border border-default rounded-2xl px-4 py-3.5 cursor-pointer card-hover group"
              >
                {/* Left */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-heading">{w.word}</span>
                    {w.level && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-500 font-semibold">{w.level}</span>
                    )}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${STATUS_COLOR[w.status] || 'text-muted'}`}>
                      {w.status}
                    </span>
                  </div>
                  {/* Always show English definition first */}
                  {w.meaning_en ? (
                    <div className="text-xs text-muted mt-0.5 truncate">{w.meaning_en}</div>
                  ) : w.meaning_ar ? (
                    <div className="text-xs text-muted mt-0.5 truncate" style={{ direction: 'rtl' }}>{w.meaning_ar}</div>
                  ) : null}
                </div>

                {/* Right */}
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[10px] text-faint mr-1">{fmtRelative(w.next_review)}</span>
                  <button
                    onClick={e => { e.stopPropagation(); speak(w.word); }}
                    className="w-8 h-8 rounded-xl hover:bg-blue-500/10 text-faint hover:text-blue-500 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 text-sm"
                  >🔊</button>
                  <button
                    onClick={e => { e.stopPropagation(); if (confirm(`Delete "${w.word}"?`)) deleteWord(w.id); }}
                    className="w-8 h-8 rounded-xl hover:bg-red-500/10 text-faint hover:text-red-500 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 text-sm"
                  >🗑</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
