/**
 * Vocabulary list view — saved words with filter, search, stats.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useStore } from '@/store/appStore';
import { useDictionary } from '@/hooks/useDictionary';
import { LevelBadge, Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { SavedWord } from '@/types';

const FILTERS = [
  { id: undefined, label: 'All' },
  { id: 'learning', label: 'Learning' },
  { id: 'reviewing', label: 'Reviewing' },
  { id: 'learned', label: 'Learned' },
] as const;

function speak(text: string) {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = 0.85;
    window.speechSynthesis.speak(u);
  }
}

export default function VocabularyView() {
  const { savedWords, progress } = useStore();
  const { loadVocabulary, loadStats, deleteWord } = useDictionary();

  const [filter, setFilter] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    await loadVocabulary(filter);
    await loadStats();
    setLoading(false);
  }, [filter, loadVocabulary, loadStats]);

  useEffect(() => { load(); }, [load]);

  const filtered = savedWords.filter((w) =>
    !search || w.word?.toLowerCase().includes(search.toLowerCase())
  );

  const stats = [
    { label: 'Total saved', value: progress?.total ?? savedWords.length, color: 'text-blue-400' },
    { label: 'Learned', value: progress?.learned ?? 0, color: 'text-green-400' },
    { label: 'Due today', value: progress?.due ?? 0, color: 'text-yellow-400' },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">My Vocabulary</h1>
        <p className="text-slate-400 text-sm mt-0.5">Words you've saved from videos</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Level distribution */}
      {progress?.level_distribution && Object.keys(progress.level_distribution).length > 0 && (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl px-5 py-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Level Distribution</p>
          <div className="flex gap-2 items-end h-10">
            {Object.entries(progress.level_distribution).map(([lvl, count]) => {
              const max = Math.max(...Object.values(progress.level_distribution!));
              const pct = max > 0 ? (count / max) * 100 : 0;
              const colors: Record<string, string> = {
                A1: 'bg-green-500', A2: 'bg-emerald-500', B1: 'bg-blue-500',
                B2: 'bg-violet-500', C1: 'bg-orange-500', C2: 'bg-red-500',
              };
              return (
                <div key={lvl} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full bg-slate-700 rounded-full overflow-hidden" style={{ height: 32 }}>
                    <div className={`${colors[lvl] ?? 'bg-slate-500'} rounded-full transition-all duration-700`}
                      style={{ height: `${pct}%`, marginTop: `${100 - pct}%` }} />
                  </div>
                  <span className="text-xs text-slate-500">{lvl}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Search + filter */}
      <div className="space-y-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍  Search words..."
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-sm"
        />
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.label}
              onClick={() => setFilter(f.id)}
              className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-all ${
                filter === f.id
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Word list */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-8 h-8 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <span className="text-5xl">📚</span>
          <p className="text-slate-400 font-medium mt-4">No words here yet</p>
          <p className="text-slate-600 text-sm mt-1">Click on words in videos to save them</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((word) => (
            <WordCard key={word.id} word={word} onDelete={() => deleteWord(word.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function WordCard({ word, onDelete }: { word: SavedWord; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);

  const statusColors: Record<string, string> = {
    learning:  'bg-yellow-500/15 text-yellow-400',
    reviewing: 'bg-blue-500/15 text-blue-400',
    learned:   'bg-green-500/15 text-green-400',
  };

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl overflow-hidden hover:border-slate-600 transition-all duration-200">
      <div className="flex items-center gap-4 p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-semibold text-slate-100">{word.word}</span>
            {word.level && <LevelBadge level={word.level} />}
            {word.part_of_speech && word.part_of_speech !== 'unknown' && (
              <span className="text-xs text-slate-500">{word.part_of_speech}</span>
            )}
          </div>
          {word.meaning_ar && (
            <p className="text-sm text-slate-400 mt-0.5" style={{ direction: 'rtl', textAlign: 'right', unicodeBidi: 'isolate' }}>{word.meaning_ar}</p>
          )}
          {word.meaning_en && (
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{word.meaning_en}</p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[word.status] ?? 'text-slate-500'}`}>
            {word.status}
          </span>
          <button onClick={(e) => { e.stopPropagation(); speak(word.word); }}
            className="p-2 rounded-xl hover:bg-slate-700 text-slate-500 hover:text-blue-400 transition-colors">
            🔊
          </button>
          <span className="text-slate-600">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-700/50 px-4 pb-4 pt-3 space-y-3">
          {(word.examples?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-1.5">Examples</p>
              {(word.examples ?? []).slice(0, 2).map((ex, i) => (
                <p key={i} className="text-sm text-slate-400 leading-relaxed pl-3 border-l-2 border-slate-700 mb-1.5">{ex}</p>
              ))}
            </div>
          )}
          {word.sentence && (
            <div className="px-3 py-2 bg-blue-500/8 border border-blue-500/20 rounded-xl">
              <p className="text-xs text-blue-400/70 mb-1">From video</p>
              <p className="text-sm text-slate-300">{word.sentence}</p>
            </div>
          )}
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-600">
              Reviewed {word.repetitions ?? 0} times · Interval {word.interval ?? 0}d
            </p>
            <button onClick={onDelete} className="text-xs text-red-500/60 hover:text-red-400 transition-colors">
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
