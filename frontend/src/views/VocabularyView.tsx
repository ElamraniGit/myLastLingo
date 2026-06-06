/**
 * Vocabulary — Apple-style redesign.
 * Improvements:
 *  - auto-reload on filter/sort change (no manual Enter required)
 *  - debounced search input (300ms)
 *  - SM-2 progress bar visible per word
 *  - total count from server (not just current page length)
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useStore } from '@/store/appStore';
import { useDictionary } from '@/hooks/useDictionary';
import type { SavedWord, VocabularyListParams, ReviewSummary } from '@/types';

type SortOption = 'next_review' | 'newest' | 'oldest' | 'alphabetical' | 'level' | 'difficulty';
import { speak as ttsSpeak } from '@/lib/tts';
import { vocabularyApi, downloadVocabularyExport } from '@/lib/api';
import * as sfx from '@/lib/sfx';

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

/** SM-2 progress: ease_factor from 1.3→3.0 mapped to 0→100% */
function sm2Progress(w: SavedWord): number {
  const ef = w.ease_factor ?? 2.5;
  return Math.round(Math.max(0, Math.min(100, ((ef - 1.3) / (3.0 - 1.3)) * 100)));
}

/** Colour for SM-2 progress bar */
function sm2Color(w: SavedWord): string {
  const pct = sm2Progress(w);
  if (pct >= 70) return 'bg-green-500';
  if (pct >= 40) return 'bg-blue-500';
  return 'bg-amber-500';
}

export default function VocabularyView() {
  const { savedWords, setPage, currentPage, setCurrentSavedWordId } = useStore();
  const { loadVocabulary, loadStats, loadReviewSummary, deleteWord, lookupWord } = useDictionary();
  const [status,  setStatus]  = useState<string | undefined>(undefined);
  const [search,  setSearch]  = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sort,    setSort]    = useState<SortOption>('newest');
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [ioMsg,   setIoMsg]   = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input — fire load 300ms after user stops typing
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [vocabResult, s] = await Promise.all([
        loadVocabulary({ status: status as any, search: debouncedSearch, sort, page: 1, limit: 200 }),
        loadReviewSummary().catch(() => null),
      ]);
      // Capture total from server response if available
      if (vocabResult && typeof (vocabResult as any).total === 'number') {
        setTotalCount((vocabResult as any).total);
      }
      setSummary(s);
      loadStats();
    } finally {
      setLoading(false);
    }
  }, [status, debouncedSearch, sort, loadVocabulary, loadReviewSummary, loadStats]);

  // Reload when page becomes active
  useEffect(() => { if (currentPage === 'vocabulary') load(); }, [currentPage]); // eslint-disable-line

  // Auto-reload when status or sort changes (instant)
  useEffect(() => {
    if (currentPage === 'vocabulary') load();
  }, [status, sort]); // eslint-disable-line

  // Auto-reload when debounced search changes
  useEffect(() => {
    if (currentPage === 'vocabulary') load();
  }, [debouncedSearch]); // eslint-disable-line

  // Phase 5: export / import vocabulary
  const handleExport = useCallback(async (format: 'csv' | 'json') => {
    try {
      setIoMsg('Exporting…');
      await downloadVocabularyExport(format);
      setIoMsg(`Exported ${format.toUpperCase()} ✓`);
    } catch {
      setIoMsg('Export failed');
    }
    setTimeout(() => setIoMsg(null), 3000);
  }, []);

  const parseWordsFromFile = useCallback((text: string, name: string): { word: string }[] => {
    const trimmed = text.trim();
    // JSON export (our own format) → {words:[{word}]}
    if (name.endsWith('.json') || trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const data = JSON.parse(trimmed);
        const arr = Array.isArray(data) ? data : data.words || [];
        return arr
          .map((w: any) => ({ word: String(typeof w === 'string' ? w : w.word || '').trim() }))
          .filter((w: any) => w.word);
      } catch { /* fall through to line/CSV parsing */ }
    }
    // CSV or plain text: take the first column / whole line as the word.
    return trimmed
      .split(/\r?\n/)
      .map((line, i) => {
        const first = line.split(',')[0].trim().replace(/^"|"$/g, '');
        return { line: first, i };
      })
      .filter(({ line, i }) => line && !(i === 0 && line.toLowerCase() === 'word'))
      .map(({ line }) => ({ word: line }));
  }, []);

  const handleImportFile = useCallback(async (file: File) => {
    try {
      setIoMsg('Importing…');
      const text = await file.text();
      const words = parseWordsFromFile(text, file.name.toLowerCase()).slice(0, 500);
      if (!words.length) { setIoMsg('No words found in file'); setTimeout(() => setIoMsg(null), 3000); return; }
      const res = await vocabularyApi.import(words);
      setIoMsg(`Imported ${res.added} · skipped ${res.skipped}${res.failed ? ` · failed ${res.failed}` : ''}`);
      await load();
    } catch {
      setIoMsg('Import failed');
    }
    setTimeout(() => setIoMsg(null), 4000);
  }, [parseWordsFromFile, load]);

  const FILTERS = [
    { id: undefined,    label: 'All' },
    { id: 'learning',   label: 'Learning' },
    { id: 'reviewing',  label: 'Reviewing' },
    { id: 'learned',    label: 'Learned' },
  ];

  // Use server total when available, fall back to local count
  const displayTotal = totalCount > 0 ? totalCount : savedWords.length;

  const STATS = [
    { label: 'Total',     val: displayTotal,             color: 'text-heading' },
    { label: 'Learning',  val: summary?.learning  ?? 0,  color: 'text-amber-500' },
    { label: 'Reviewing', val: summary?.reviewing ?? 0,  color: 'text-blue-500' },
    { label: 'Learned',   val: summary?.learned   ?? 0,  color: 'text-green-500' },
  ];

  return (
    <div className="max-w-lg mx-auto pb-28 lg:pb-8 animate-fade-in">

      {/* Header */}
      <div className="sticky top-0 z-20 bg-base/90 backdrop-blur-xl border-b border-default px-4 pt-5 pb-3">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-heading">My Words</h2>
            <p className="text-xs text-muted mt-0.5">{displayTotal} saved · tap for details</p>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Phase 5: export / import */}
            <button
              onClick={() => handleExport('csv')}
              title="Export vocabulary (CSV)"
              aria-label="Export vocabulary as CSV"
              className="flex items-center justify-center w-9 h-9 rounded-xl bg-card border border-default text-body hover:text-heading active:scale-95 transition-all"
            >⬇️</button>
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Import words (CSV / JSON / text)"
              aria-label="Import words from file"
              className="flex items-center justify-center w-9 h-9 rounded-xl bg-card border border-default text-body hover:text-heading active:scale-95 transition-all"
            >⬆️</button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.json,.txt,text/csv,application/json,text/plain"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImportFile(f);
                e.target.value = '';
              }}
            />
            {(summary?.due_now ?? 0) > 0 && (
              <button
                onClick={() => setPage('flashcards')}
                className="flex items-center gap-1.5 bg-blue-600 text-white text-xs font-semibold px-3.5 py-2 rounded-xl shadow-sm shadow-blue-600/30 hover:bg-blue-700 active:scale-95 transition-all"
              >
                Review {summary!.due_now}
              </button>
            )}
          </div>
        </div>

        {ioMsg && (
          <div className="mb-3 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2">
            {ioMsg}
          </div>
        )}

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
            placeholder="Search words… (auto-updates)"
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
            onChange={e => setSort(e.target.value as SortOption)}
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
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-blue-500/10 flex items-center justify-center"><svg className="w-8 h-8 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="18" rx="1"/><path d="M17 3l4 2v14l-4 2V3z"/></svg></div>
            <div className="text-base font-semibold text-heading mb-1">No words yet</div>
            <div className="text-sm text-muted">Start learning from a video in the Library</div>
          </div>
        ) : (
          <div className="space-y-2">
            {savedWords.map(w => (
              <div
                key={w.id}
                onClick={() => { setCurrentSavedWordId(w.id); setPage('worddetail'); }}
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
                    <div className="text-xs text-muted mt-0.5 truncate" style={{ direction: 'rtl', fontFamily: "'Segoe UI', 'Noto Sans Arabic', Arial, sans-serif" }}>{w.meaning_ar}</div>
                  ) : null}
                  {/* SM-2 progress bar */}
                  {w.reviewed_count != null && w.reviewed_count > 0 && (
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <div className="flex-1 h-1 bg-elevated rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${sm2Color(w)}`}
                          style={{ width: `${sm2Progress(w)}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-faint tabular-nums">{sm2Progress(w)}%</span>
                    </div>
                  )}
                </div>

                {/* Right */}
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[10px] text-faint mr-1">{fmtRelative(w.next_review)}</span>
                  <button
                    onClick={e => { e.stopPropagation(); speak(w.word); }}
                    className="w-8 h-8 rounded-xl hover:bg-blue-500/10 text-faint hover:text-blue-500 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 text-sm"
                  ><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" opacity="0.9"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg></button>
                  <button
                    onClick={e => { e.stopPropagation(); if (confirm(`Delete "${w.word}"?`)) { sfx.deleteSfx(); deleteWord(w.id); } }}
                    className="w-8 h-8 rounded-xl hover:bg-red-500/10 text-faint hover:text-red-500 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 text-sm"
                  ><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
