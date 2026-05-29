/**
 * Vocabulary list — unified with dictionary popup system.
 * Click any word → opens the same rich WordPopup.
 * Filter, search, tag, favorite, review — all integrated.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useStore } from '@/store/appStore';
import { useDictionary } from '@/hooks/useDictionary';
import { LevelBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { SavedWord, VocabularyListParams, ReviewSummary } from '@/types';

const STATUS_STYLES: Record<string, string> = {
  learning: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  reviewing: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  learned: 'bg-green-500/10 text-green-400 border-green-500/20',
};

function speak(t: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(t); u.lang = 'en-US'; u.rate = 0.85;
  window.speechSynthesis.speak(u);
}

function fmtRelative(v?: string) {
  if (!v) return '—';
  const d = new Date(v.replace(' ', 'T'));
  if (isNaN(d.getTime())) return '—';
  const diff = d.getTime() - Date.now();
  const min = Math.round(diff / 60000);
  if (min <= 0) return 'Due now';
  if (min < 60) return `${min}m`;
  const hrs = Math.round(min / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

export default function VocabularyView() {
  const { savedWords, setPage } = useStore();
  const { setSelectedWord, setWordPopupOpen, setWordPopupSentence } = useStore();
  const { loadVocabulary, loadStats, loadReviewSummary, deleteWord } = useDictionary();

  const [status, setStatus] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<VocabularyListParams['sort']>('newest');
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

  useEffect(() => { load(); }, [load]);

  const openWord = useCallback((w: SavedWord) => {
    setSelectedWord(w as any);
    setWordPopupSentence(w.sentence || '');
    setWordPopupOpen(true);
  }, [setSelectedWord, setWordPopupOpen, setWordPopupSentence]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">My Words</h1>
        <p className="text-slate-500 text-sm mt-0.5">{savedWords.length} saved · Tap any word for full details</p>
      </div>

      {/* Due banner */}
      {(summary?.due_now ?? 0) > 0 && (
        <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-white">{summary!.due_now} word{summary!.due_now === 1 ? '' : 's'} due</p>
            <p className="text-xs text-slate-400 mt-0.5">Review now to keep your memory fresh</p>
          </div>
          <Button onClick={() => setPage('flashcards')} variant="primary" size="sm">Review</Button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { l: 'Total', v: savedWords.length, c: 'text-blue-400' },
          { l: 'Learning', v: summary?.learning ?? 0, c: 'text-yellow-400' },
          { l: 'Reviewing', v: summary?.reviewing ?? 0, c: 'text-purple-400' },
          { l: 'Learned', v: summary?.learned ?? 0, c: 'text-green-400' },
        ].map(s => (
          <div key={s.l} className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-3 text-center">
            <p className={`text-lg font-bold ${s.c}`}>{s.v}</p>
            <p className="text-[10px] text-slate-500">{s.l}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <input
          type="text" value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search words..."
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        />
        <div className="flex gap-1.5 flex-wrap">
          {[
            { id: undefined, label: 'All' },
            { id: 'learning', label: 'Learning' },
            { id: 'reviewing', label: 'Reviewing' },
            { id: 'learned', label: 'Learned' },
          ].map(f => (
            <button key={f.label} onClick={() => setStatus(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${status === f.id ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-slate-500 hover:text-slate-300 bg-slate-800/50'}`}>
              {f.label}
            </button>
          ))}
          <select value={sort} onChange={e => setSort(e.target.value as any)}
            className="ml-auto bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-300">
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="alphabetical">A-Z</option>
            <option value="next_review">Next review</option>
            <option value="difficulty">Hardest</option>
          </select>
        </div>
      </div>

      {/* Word list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : savedWords.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-4xl mb-4">📚</p>
          <p className="text-slate-400">No words saved yet. Start learning from a video!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {savedWords.map(w => (
            <div key={w.id}
              onClick={() => openWord(w)}
              className="bg-slate-800/50 border border-slate-700/40 rounded-xl px-4 py-3 cursor-pointer hover:border-slate-600 transition-all active:scale-[0.99] group">
              <div className="flex items-center gap-3">
                {/* Word info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-base font-semibold text-white">{w.word}</span>
                    {w.level && <LevelBadge level={w.level as any} />}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${STATUS_STYLES[w.status] || ''}`}>{w.status}</span>
                  </div>
                  {w.meaning_ar && (
                    <p className="text-sm text-slate-400 truncate" style={{ direction: 'rtl', textAlign: 'right', fontFamily: "'Noto Sans Arabic', sans-serif" }}>
                      {w.meaning_ar}
                    </p>
                  )}
                  {!w.meaning_ar && w.meaning_en && (
                    <p className="text-xs text-slate-500 truncate">{w.meaning_en}</p>
                  )}
                </div>
                {/* Right side */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[10px] text-slate-600">{fmtRelative(w.next_review)}</span>
                  <button onClick={e => { e.stopPropagation(); speak(w.word); }}
                    className="p-1.5 rounded-lg text-slate-600 hover:text-blue-400 hover:bg-slate-700/50 transition-colors opacity-0 group-hover:opacity-100">
                    🔊
                  </button>
                  <button onClick={e => { e.stopPropagation(); deleteWord(w.id); }}
                    className="p-1.5 rounded-lg text-slate-700 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100">
                    🗑
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
