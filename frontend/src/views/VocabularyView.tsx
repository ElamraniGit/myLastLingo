/**
 * Vocabulary list — stronger organization with tags, notes, filters, favorites,
 * source video grouping, and richer review-aware metadata.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useStore } from '@/store/appStore';
import { useDictionary } from '@/hooks/useDictionary';
import { LevelBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { ReviewHistoryItem, ReviewSummary, SavedWord, VocabularyFacetData, VocabularyListParams } from '@/types';

const FILTERS = [
  { id: undefined, label: 'All' },
  { id: 'learning', label: 'Learning' },
  { id: 'reviewing', label: 'Reviewing' },
  { id: 'learned', label: 'Learned' },
] as const;

const SORT_OPTIONS = [
  { value: 'next_review', label: 'Next review' },
  { value: 'difficulty', label: 'Most difficult' },
  { value: 'alphabetical', label: 'Alphabetical' },
  { value: 'newest', label: 'Newest saved' },
  { value: 'oldest', label: 'Oldest saved' },
  { value: 'level', label: 'Level' },
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
  return !!date && date.getTime() <= Date.now();
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
  const {
    loadVocabulary,
    loadVocabularyFilters,
    updateSavedWord,
    loadStats,
    deleteWord,
    loadReviewSummary,
  } = useDictionary();

  const [status, setStatus] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState('');
  const [videoId, setVideoId] = useState('');
  const [tag, setTag] = useState('');
  const [dueOnly, setDueOnly] = useState(false);
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [sort, setSort] = useState<VocabularyListParams['sort']>('next_review');
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [facets, setFacets] = useState<VocabularyFacetData>({ levels: [], videos: [], tags: [] });

  const activeFiltersCount = [status, search, level, videoId, tag, dueOnly ? 'due' : '', favoriteOnly ? 'fav' : '', sort !== 'next_review' ? sort : '']
    .filter(Boolean).length;

  const load = useCallback(async () => {
    setLoading(true);
    const params: VocabularyListParams = {
      status: status as any,
      page: 1,
      limit: 200,
      search,
      level: level || undefined,
      video_id: videoId || undefined,
      due_only: dueOnly,
      tag: tag || undefined,
      favorite_only: favoriteOnly,
      sort,
    };

    const [vocabData, statsData, summaryData, facetsData] = await Promise.all([
      loadVocabulary(params),
      loadStats(),
      loadReviewSummary().catch(() => null),
      loadVocabularyFilters().catch(() => ({ levels: [], videos: [], tags: [] })),
    ]);

    setFacets(facetsData || { levels: [], videos: [], tags: [] });

    if (summaryData) setSummary(summaryData);
    else if (statsData) {
      setSummary({
        total_saved: statsData.total || 0,
        learning: statsData.learning || 0,
        reviewing: statsData.reviewing || 0,
        learned: statsData.learned || 0,
        never_reviewed: statsData.never_reviewed || 0,
        due_now: statsData.due || 0,
      });
    }

    if (!vocabData?.words) {
      // keep existing state if request failed silently
    }

    setLoading(false);
  }, [status, search, level, videoId, tag, dueOnly, favoriteOnly, sort, loadVocabulary, loadStats, loadReviewSummary, loadVocabularyFilters]);

  useEffect(() => { load(); }, [load]);

  const cards = [
    { label: 'Total saved', value: progress?.total ?? savedWords.length, color: 'text-blue-400' },
    { label: 'Favorites', value: progress?.favorite_count ?? savedWords.filter((w) => w.favorite).length, color: 'text-amber-400' },
    { label: 'Due now', value: summary?.due_now ?? progress?.due ?? 0, color: 'text-yellow-400' },
    { label: 'Never reviewed', value: summary?.never_reviewed ?? progress?.never_reviewed ?? 0, color: 'text-purple-400' },
  ];

  const resetFilters = () => {
    setStatus(undefined);
    setSearch('');
    setLevel('');
    setVideoId('');
    setTag('');
    setDueOnly(false);
    setFavoriteOnly(false);
    setSort('next_review');
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5" dir="ltr">
      <div>
        <h1 className="text-2xl font-bold text-white">My Vocabulary</h1>
        <p className="text-slate-400 text-sm mt-0.5">Organize words with tags, favorites, notes, source videos, and smart review filters</p>
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

      <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm font-semibold text-white">Filter & organize</p>
            <p className="text-xs text-slate-500">Find words by review state, level, video source, tag, or note content</p>
          </div>
          <div className="flex items-center gap-2">
            {activeFiltersCount > 0 && <span className="text-xs text-blue-400">{activeFiltersCount} active filter{activeFiltersCount === 1 ? '' : 's'}</span>}
            <Button onClick={resetFilters} variant="outline" size="sm">Reset</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search words, meanings, sentence, notes, or video title..."
            dir="ltr"
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-sm transition-all"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as VocabularyListParams['sort'])}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-sm"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.label}
              onClick={() => setStatus(f.id)}
              className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-all ${status === f.id ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900 border border-transparent'}`}
            >
              {f.label}
            </button>
          ))}
          <button
            onClick={() => setDueOnly((v) => !v)}
            className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-all border ${dueOnly ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : 'text-slate-500 border-slate-700 hover:text-slate-300 hover:bg-slate-900'}`}
          >
            Due only
          </button>
          <button
            onClick={() => setFavoriteOnly((v) => !v)}
            className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-all border ${favoriteOnly ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'text-slate-500 border-slate-700 hover:text-slate-300 hover:bg-slate-900'}`}
          >
            Favorites
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <select value={level} onChange={(e) => setLevel(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50">
            <option value="">All levels</option>
            {facets.levels.map((item) => (
              <option key={item.level} value={item.level}>{item.level} ({item.count})</option>
            ))}
          </select>

          <select value={videoId} onChange={(e) => setVideoId(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50">
            <option value="">All source videos</option>
            {facets.videos.map((video) => (
              <option key={video.video_id} value={video.video_id}>{video.title || 'Unknown video'} ({video.count})</option>
            ))}
          </select>

          <select value={tag} onChange={(e) => setTag(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50">
            <option value="">All tags</option>
            {facets.tags.map((item) => (
              <option key={item.tag} value={item.tag}>#{item.tag} ({item.count})</option>
            ))}
          </select>
        </div>

        {facets.tags.length > 0 && (
          <div>
            <p className="text-xs text-slate-500 mb-2">Popular tags</p>
            <div className="flex flex-wrap gap-2">
              {facets.tags.slice(0, 10).map((item) => (
                <button
                  key={item.tag}
                  onClick={() => setTag(tag === item.tag ? '' : item.tag)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all ${tag === item.tag ? 'bg-blue-500/15 text-blue-300 border-blue-500/30' : 'bg-slate-900/60 text-slate-400 border-slate-700 hover:border-slate-600'}`}
                >
                  #{item.tag}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : savedWords.length === 0 ? (
        <div className="text-center py-16">
          <span className="text-5xl">📚</span>
          <p className="text-slate-400 font-medium mt-4">No matching words</p>
          <p className="text-slate-600 text-sm mt-1">Try another filter, or save words from videos to build your library.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {savedWords.map((word) => (
            <WordCard
              key={word.id}
              word={word}
              onDelete={async () => { await deleteWord(word.id); await load(); }}
              onReview={() => setPage('flashcards')}
              onUpdate={async (payload) => { await updateSavedWord(word.id, payload); await load(); }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function WordCard({
  word,
  onDelete,
  onReview,
  onUpdate,
}: {
  word: SavedWord;
  onDelete: () => void;
  onReview: () => void;
  onUpdate: (payload: { tags?: string[]; notes?: string; favorite?: boolean }) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [history, setHistory] = useState<ReviewHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [noteDraft, setNoteDraft] = useState(word.notes || '');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(word.tags || []);
  const [favorite, setFavorite] = useState(!!word.favorite);
  const { loadReviewHistory } = useDictionary();

  const examples = Array.isArray(word.examples) ? word.examples : [];
  const due = isDueNow(word.next_review);

  useEffect(() => {
    setNoteDraft(word.notes || '');
    setTags(word.tags || []);
    setFavorite(!!word.favorite);
  }, [word.id, word.notes, JSON.stringify(word.tags || []), word.favorite]);

  useEffect(() => {
    if (!expanded) return;
    setLoadingHistory(true);
    loadReviewHistory(word.id, 6)
      .then((data) => setHistory(data?.history || []))
      .catch(() => setHistory([]))
      .finally(() => setLoadingHistory(false));
  }, [expanded, word.id, loadReviewHistory]);

  const addTag = () => {
    const value = tagInput.trim().toLowerCase();
    if (!value) return;
    if (!tags.includes(value)) setTags((prev) => [...prev, value]);
    setTagInput('');
  };

  const saveMeta = async (override?: Partial<{ tags: string[]; notes: string; favorite: boolean }>) => {
    setSaving(true);
    try {
      await onUpdate({
        tags: override?.tags ?? tags,
        notes: override?.notes ?? noteDraft,
        favorite: override?.favorite ?? favorite,
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !favorite;
    setFavorite(next);
    await saveMeta({ favorite: next });
  };

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl overflow-hidden hover:border-slate-600 transition-all duration-200">
      <div className="flex items-start gap-4 p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-base font-semibold text-slate-100">{word.word}</span>
            {word.level && <LevelBadge level={word.level} />}
            <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_STYLES[word.status] || 'text-slate-500 border-slate-700'}`}>{word.status}</span>
            {due && <span className="text-xs px-2 py-0.5 rounded-full border border-yellow-500/20 bg-yellow-500/10 text-yellow-400">Due now</span>}
            {favorite && <span className="text-xs px-2 py-0.5 rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-400">★ Favorite</span>}
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

          {!!word.source_video_title && (
            <p className="text-xs text-slate-500 mt-2">From video: <span className="text-slate-400">{word.source_video_title}</span></p>
          )}

          {!!(word.tags && word.tags.length) && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {word.tags!.slice(0, 4).map((item) => (
                <span key={item} className="px-2 py-0.5 rounded-full bg-slate-900/70 border border-slate-700 text-[11px] text-slate-400">#{item}</span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={toggleFavorite} className={`p-2 rounded-xl transition-colors ${favorite ? 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/20' : 'text-slate-500 hover:text-amber-300 hover:bg-slate-700'}`}>★</button>
          <button onClick={(e) => { e.stopPropagation(); speak(word.word); }} className="p-2 rounded-xl hover:bg-slate-700 text-slate-500 hover:text-blue-400 transition-colors">🔊</button>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Tags</p>
              <div className="flex flex-wrap gap-2 mb-2">
                {tags.length === 0 ? <span className="text-sm text-slate-500">No tags yet</span> : tags.map((item) => (
                  <button key={item} onClick={() => setTags((prev) => prev.filter((tag) => tag !== item))} className="px-2.5 py-1 rounded-full bg-slate-900/70 border border-slate-700 text-xs text-slate-300 hover:border-red-500/30 hover:text-red-300">
                    #{item} ×
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                  placeholder="Add tag"
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
                <Button onClick={addTag} variant="outline" size="sm">Add</Button>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Notes</p>
              <textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="Write your own note, memory trick, or translation cue..."
                className="w-full min-h-[104px] bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-y"
              />
            </div>
          </div>

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

          <div className="flex items-center justify-between gap-3 pt-1 flex-wrap">
            <div className="text-xs text-slate-600">
              Ease {Number(word.ease_factor ?? 2.5).toFixed(2)} · Interval {word.interval ?? 0} day{(word.interval ?? 0) === 1 ? '' : 's'}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button onClick={() => saveMeta()} loading={saving} variant="outline" size="sm">Save metadata</Button>
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
