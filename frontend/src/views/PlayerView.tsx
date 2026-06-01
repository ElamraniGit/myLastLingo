/**
 * Home / Player view — Apple-style redesign.
 * Dashboard when no video loaded · Player + Transcript when video active.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useStore } from '@/store/appStore';
import { useDictionary } from '@/hooks/useDictionary';
import { libraryApi } from '@/lib/api';
import VideoInput from '@/components/player/VideoInput';
import VideoPlayer from '@/components/player/VideoPlayer';
import TranscriptViewer from '@/components/transcript/TranscriptViewer';
import WordPopup from '@/components/dictionary/WordPopup';
import type { SavedWord, ReviewSummary } from '@/types';
import { speak as ttsSpeak } from '@/lib/tts';

function fmtDuration(s: number) {
  if (!s) return '';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}
function speak(t: string) {
  ttsSpeak(t, { rate: (t || '').trim().split(/\s+/).length <= 2 ? 0.9 : 1.0 });
}

export default function PlayerView() {
  const { currentVideo, resetPlayer } = useStore();
  if (!currentVideo) return <HomeDashboard />;

  return (
    <div className="flex flex-col h-full bg-base">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-default shrink-0">
        <button onClick={() => resetPlayer()} className="w-8 h-8 rounded-xl hover:bg-card text-muted hover:text-body flex items-center justify-center transition-colors">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-heading truncate">{currentVideo.title}</div>
          <div className="text-xs text-muted truncate">
            {currentVideo.channel}{currentVideo.duration > 0 && <> · {fmtDuration(currentVideo.duration)}</>}
          </div>
        </div>
      </div>

      {/* Player */}
      <div className="shrink-0"><VideoPlayer /></div>

      {/* Transcript */}
      <div className="flex-1 overflow-hidden"><TranscriptViewer /></div>

      <WordPopup />
    </div>
  );
}

/* ── Home Dashboard ──────────────────────────────────────────────── */
function HomeDashboard() {
  const { savedWords, recentVideos, setPage, setCurrentVideo, addRecentVideo } = useStore();
  const { loadVocabulary, loadReviewSummary, lookupWord } = useDictionary();
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [sources, setSources]   = useState<any[]>([]);

  useEffect(() => {
    loadVocabulary({ page: 1, limit: 5, sort: 'newest' }).catch(() => {});
    loadReviewSummary().then(setSummary).catch(() => null);
    libraryApi.listSources(1, 6).then(d => setSources(d?.sources || [])).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const recentWords = savedWords.slice(0, 5);
  const dueCount    = summary?.due_now ?? 0;

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-28 lg:pb-8 space-y-6 animate-fade-in">

      {/* Greeting */}
      <div>
        <h2 className="text-2xl font-bold text-heading tracking-tight">Good day! 👋</h2>
        <p className="text-sm text-muted mt-0.5">Continue your English journey</p>
      </div>

      {/* Add video */}
      <VideoInput />

      {/* Review CTA */}
      {dueCount > 0 && (
        <button
          onClick={() => setPage('flashcards')}
          className="w-full flex items-center gap-4 bg-gradient-to-r from-blue-600/10 to-indigo-600/10 border border-blue-500/20 rounded-2xl p-4 hover:border-blue-500/35 active:scale-[0.985] transition-all text-left"
        >
          <div className="w-11 h-11 rounded-xl bg-blue-600/15 flex items-center justify-center text-xl shrink-0">🃏</div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-heading">{dueCount} word{dueCount === 1 ? '' : 's'} ready to review</div>
            <div className="text-xs text-muted mt-0.5">Tap to start a quick session</div>
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-muted">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { icon: '📚', label: 'Library',   page: 'library'    },
          { icon: '✏️', label: 'My Words',  page: 'vocabulary' },
          { icon: '🃏', label: 'Review',    page: 'flashcards' },
        ].map(a => (
          <button
            key={a.page}
            onClick={() => setPage(a.page as any)}
            className="flex flex-col items-center gap-2 bg-card border border-default rounded-2xl py-4 hover:border-border-default active:scale-95 transition-all"
          >
            <span className="text-2xl">{a.icon}</span>
            <span className="text-xs font-medium text-body">{a.label}</span>
          </button>
        ))}
      </div>

      {/* Recent words */}
      {recentWords.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <span className="section-title">Recent Words</span>
            <button onClick={() => setPage('vocabulary')} className="text-xs text-blue-500 font-medium hover:text-blue-400">See all</button>
          </div>
          <div className="space-y-2">
            {recentWords.map(w => (
              <button
                key={w.id}
                onClick={() => lookupWord(w.word, w.sentence || '')}
                className="w-full flex items-center gap-3 bg-card border border-default rounded-2xl px-4 py-3 card-hover text-left"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-heading">{w.word}</span>
                    {w.level && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-500 font-semibold">{w.level}</span>}
                  </div>
                  {w.meaning_ar && (
                    <div className="text-xs text-muted mt-0.5 truncate" style={{ direction: 'rtl', textAlign: 'right' }}>{w.meaning_ar}</div>
                  )}
                </div>
                <button
                  onClick={e => { e.stopPropagation(); speak(w.word); }}
                  className="w-8 h-8 rounded-xl bg-transparent hover:bg-blue-500/10 text-muted hover:text-blue-500 flex items-center justify-center transition-colors text-sm"
                >🔊</button>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Recent sources */}
      {sources.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <span className="section-title">Recent Sources</span>
            <button onClick={() => setPage('library')} className="text-xs text-blue-500 font-medium hover:text-blue-400">See all</button>
          </div>
          <div className="space-y-2">
            {sources.slice(0, 4).map((s: any) => (
              <button
                key={s.id}
                onClick={() => {
                  if (s.source_type === 'youtube') { setCurrentVideo(s); addRecentVideo(s); setPage('player'); }
                  else setPage('library');
                }}
                className="w-full flex items-center gap-3 bg-card border border-default rounded-2xl px-3.5 py-3 card-hover text-left"
              >
                {s.thumbnail_url ? (
                  <img src={s.thumbnail_url} alt="" className="w-12 h-8 rounded-lg object-cover shrink-0 bg-elevated" />
                ) : (
                  <div className="w-12 h-8 rounded-lg bg-elevated flex items-center justify-center text-lg shrink-0">
                    {s.source_type === 'youtube' ? '🎬' : '📄'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-heading truncate">{s.title}</div>
                  <div className="text-xs text-muted mt-0.5 truncate">{s.channel || (s.word_count ? `${s.word_count} words` : s.source_type)}</div>
                </div>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-faint shrink-0">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {recentWords.length === 0 && sources.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="text-5xl mb-4">📚</div>
          <div className="text-base font-semibold text-heading mb-1">Start learning!</div>
          <div className="text-sm text-muted">Paste a YouTube URL above to begin</div>
        </div>
      )}

      <WordPopup />
    </div>
  );
}
