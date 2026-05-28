/**
 * Vocabulary list — richer review-aware vocabulary management.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useStore } from '@/store/appStore';
import { useDictionary } from '@/hooks/useDictionary';
import { LevelBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { ReviewHistoryItem, ReviewSummary, SavedWord } from '@/types';

const FILTERS = [
  { id: undefined, label: 'All' },
  { id: 'learning', label: 'Learning' },
  { id: 'reviewing', label: 'Reviewing' },
  { id: 'learned', label: 'Learned' },
] as const;

const STATUS_STYLES: Record<string, string> = {
  learning: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  reviewing: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  learned: 'bg-green-500/10 text-green-400 border-green-500/20',
};

function speak(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  u.rate = 0.85;
  window.speechSynthesis.speak(u);
}

function parseDate(value?: string) {
  if (!value) return null;
  const date = new Date(value.replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? null : date;
}

function isDueNow(value?: string) {
  const date = parseDate(value);
  if (!date) return false;
  return date.getTime() <= Date.now();
}

function fmtRelative(value?: string) {
  const date = parseDate(value);
  if (!date) return 'No review scheduled';
  const diff = date.getTime() - Date.now();
  const minutes = Math.round(diff / 60000);
  if (minutes <= 0) return 'Due now';
  if (minutes < 60) return `In ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `In ${hours}h`;
  const days = Math.round(hours / 24);
  return `In ${days} day${days === 1 ? '' : 's'}`;
}

function qualityLabel(q?: number | null) {
  switch (q) {
    case 0: return 'Again';
    case 1: return 'Poor';
    case 2: return 'Hard';
    case 3: return 'Good';
    case 4: return 'Easy';
    case 5: return 'Perfect';
    default: return '—';
  }
}

export default function VocabularyView() {
  const { savedWords, progress, setPage } = useStore();
  const { loadVocabulary, loadStats, deleteWord, loadReviewSummary } = useDictionary();

  const [filter, setFilter] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [, statsData, summaryData] = await Promise.all([
      loadVocabulary(filter, 1, 200),
      loadStats(),
      loadReviewSummary().catch(() => null),
    ]);
    if (summaryData) setSummary(summaryData);
    if (!summaryData && statsData) {
      setSummary({
        total_saved: statsData.total || 0,
        learning: statsData.learning || 0,
        reviewing: statsData.reviewing || 0,
        learned: statsData.learned || 0,
        never_reviewed: statsData.never_reviewed || 0,
        due_now: statsData.due || 0,
      });
    }
    setLoading(false);
  }, [filter, loadVocabulary, loadStats, loadReviewSummary]);

  useEffect(() => { load(); }, [load]);

  const filtered = savedWords.filter((w) => {
    if (search) {
      const q = search.toLowerCase();
      const haystack = [w.word, w.meaning_en, w.meaning_ar, w.sentence].filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const cards = [
    { label: 'Total saved', value: progress?.total ?? savedWords.length, color: 'text-blue-400' },
    { label: 'Due now', value: summary?.due_now ?? progress?.due ?? 0, color: 'text-yellow-400' },
    { label: 'Never reviewed', value: summary?.never_reviewed ?? progress?.never_reviewed ?? 0, color: 'text-purple-400' },
    { label: 'Learned', value: progress?.learned ?? 0, color: 'text-green-400' },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5" dir="ltr">
      <div>
        <h1 className="text-2xl font-bold text-white">My Vocabulary</h1>
        <p className="text-slate-400 text-sm mt-0.5">Track saved words, review timing, and memory strength</p>
      </div>

      {(summary?.due_now ?? 0) > 0 && (
        <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white">{summary?.due_now} word{summary?.due_now === 1 ? '' : 's'} ready for review</p>
            <p className="text-xs text-slate-400 mt-1">Open the review screen now to keep your memory fresh.</p>
          </div>
          <Button onClick={() => setPage('flashcards')} variant="primary">Start Review</Button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((s) => (
          <div key={s.label} className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search words, meanings, or saved sentence..."
          dir="ltr"
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-sm transition-all"
        />

        <div className="flex gap-2 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.label}
              onClick={() => setFilter(f.id)}
              className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-all ${filter === f.id ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <span className="text-5xl">📚</span>
          <p className="text-slate-400 font-medium mt-4">No matching words</p>
          <p className="text-slate-600 text-sm mt-1">Save words from videos or try another filter</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((word) => (
            <WordCard key={word.id} word={word} onDelete={async () => { await deleteWord(word.id); await load(); }} onReview={() => setPage('flashcards')} />
          ))}
        </div>
      )}
    </div>
  );
}

function WordCard({ word, onDelete, onReview }: { word: SavedWord; onDelete: () => void; onReview: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [history, setHistory] = useState<ReviewHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const { loadReviewHistory } = useDictionary();

  const examples = Array.isArray(word.examples) ? word.examples : [];
  const due = isDueNow(word.next_review);

  useEffect(() => {
    if (!expanded) return;
    setLoadingHistory(true);
    loadReviewHistory(word.id, 6)
      .then((data) => setHistory(data?.history || []))
      .catch(() => setHistory([]))
      .finally(() => setLoadingHistory(false));
  }, [expanded, word.id, loadReviewHistory]);

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl overflow-hidden hover:border-slate-600 transition-all duration-200">
      <div className="flex items-start gap-4 p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-base font-semibold text-slate-100">{word.word}</span>
            {word.level && <LevelBadge level={word.level} />}
            <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_STYLES[word.status] || 'text-slate-500 border-slate-700'}`}>{word.status}</span>
            {due && <span className="text-xs px-2 py-0.5 rounded-full border border-yellow-500/20 bg-yellow-500/10 text-yellow-400">Due now</span>}
          </div>

          {word.meaning_en && <p className="text-xs text-slate-500 line-clamp-1">{word.meaning_en}</p>}
          {word.meaning_ar && (
            <p className="text-sm text-slate-400 mt-0.5" style={{ direction: 'rtl', textAlign: 'right', unicodeBidi: 'isolate', fontFamily: "'Segoe UI', 'Noto Sans Arabic', Arial, sans-serif" }}>
              {word.meaning_ar}
            </p>
          )}

          <div className="flex flex-wrap gap-2 mt-2">
            <MetaChip label="Next" value={fmtRelative(word.next_review)} />
            <MetaChip label="Reviews" value={word.reviewed_count ?? 0} />
            <MetaChip label="Lapses" value={word.lapses ?? 0} />
            <MetaChip label="Last" value={qualityLabel(word.last_quality)} />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); speak(word.word); }}
            className="p-2 rounded-xl hover:bg-slate-700 text-slate-500 hover:text-blue-400 transition-colors"
          >
            🔊
          </button>
          <span className="text-slate-600 text-xs pt-2">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-700/50 px-4 pb-4 pt-3 space-y-4" dir="ltr">
          {word.sentence && (
            <div className="px-3 py-2.5 bg-blue-500/6 border border-blue-500/15 rounded-xl">
              <p className="text-xs text-blue-400/70 uppercase tracking-widest mb-1">Saved from sentence</p>
              <p className="text-sm text-slate-300 leading-relaxed">{word.sentence}</p>
            </div>
          )}

          {examples.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Examples</p>
              {examples.slice(0, 2).map((ex, i) => (
                <div key={i} className="flex items-start gap-2 pl-3 border-l-2 border-slate-700 mb-1.5">
                  <p className="flex-1 text-sm text-slate-400 leading-relaxed">{ex}</p>
                  <button onClick={() => speak(ex)} className="flex-shrink-0 text-slate-600 hover:text-blue-400 transition-colors text-xs">🔊</button>
                </div>
              ))}
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Review history</p>
            {loadingHistory ? (
              <div className="text-sm text-slate-500">Loading history…</div>
            ) : history.length === 0 ? (
              <div className="text-sm text-slate-500">No reviews yet</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {history.map((item) => (
                  <span key={item.id} className="px-2.5 py-1 rounded-full bg-slate-900/60 border border-slate-700 text-xs text-slate-300">
                    {qualityLabel(item.quality)}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="text-xs text-slate-600">
              Ease {Number(word.ease_factor ?? 2.5).toFixed(2)} · Interval {word.interval ?? 0} day{(word.interval ?? 0) === 1 ? '' : 's'}
            </div>
            <div className="flex items-center gap-2">
              {due && <Button onClick={onReview} variant="primary" size="sm">Review now</Button>}
              <button onClick={onDelete} className="text-xs text-red-500/50 hover:text-red-400 transition-colors">Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetaChip({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="px-2.5 py-1 rounded-full bg-slate-900/60 border border-slate-700 text-xs text-slate-300">
      <span className="text-slate-500 mr-1">{label}:</span>
      {value}
    </span>
  );
}
