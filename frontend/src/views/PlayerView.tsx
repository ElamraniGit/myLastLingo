/**
 * Home / Player view.
 * - When no video is loaded: shows Home dashboard (recent words, sources, review CTA)
 * - When a video is loaded: shows player + transcript
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useStore } from '@/store/appStore';
import { useDictionary } from '@/hooks/useDictionary';
import { libraryApi } from '@/lib/api';
import VideoInput from '@/components/player/VideoInput';
import VideoPlayer from '@/components/player/VideoPlayer';
import TranscriptViewer from '@/components/transcript/TranscriptViewer';
import WordPopup from '@/components/dictionary/WordPopup';
import { Button } from '@/components/ui/Button';
import type { SavedWord, ReviewSummary } from '@/types';

function fmtDuration(s: number) {
  if (!s) return '';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

function speak(t: string) {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(t); u.lang = 'en-US'; u.rate = 0.85;
    window.speechSynthesis.speak(u);
  }
}

/* ════════════════════════════════════════════════════════════════ */

export default function PlayerView() {
  const { currentVideo, resetPlayer } = useStore();

  if (!currentVideo) return <HomeDashboard />;

  return (
    <div className="flex flex-col lg:flex-row h-full overflow-hidden">
      <div className="flex-shrink-0 bg-base lg:w-[55%] lg:h-full lg:overflow-hidden">
        <div className="flex items-center gap-3 px-4 pt-3 pb-1">
          <button onClick={() => resetPlayer()} className="p-2 rounded-xl hover:bg-card text-muted hover:text-body flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-heading line-clamp-1">{currentVideo.title}</p>
            <p className="text-xs text-muted mt-0.5">
              {currentVideo.channel}{currentVideo.duration > 0 && <> · {fmtDuration(currentVideo.duration)}</>}
            </p>
          </div>
        </div>
        <div className="px-4 pb-2"><VideoPlayer /></div>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden border-t lg:border-t-0 lg:border-l border-line-s">
        <TranscriptViewer />
      </div>
      <WordPopup />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   HOME DASHBOARD — shown when no video is loaded
   ════════════════════════════════════════════════════════════════ */
function HomeDashboard() {
  const { savedWords, recentVideos, setPage, setCurrentVideo, addRecentVideo } = useStore();
  const { loadVocabulary, loadReviewSummary, lookupWord } = useDictionary();
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [sources, setSources] = useState<any[]>([]);
  // Reload data every time we return to home
  useEffect(() => {
    loadVocabulary({ page: 1, limit: 5, sort: 'newest' }).catch(() => {});
    loadReviewSummary().then(setSummary).catch(() => null);
    libraryApi.listSources(1, 5).then(d => setSources(d?.sources || [])).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const recentWords = savedWords.slice(0, 5);
  const dueCount = summary?.due_now ?? 0;

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6 overflow-y-auto h-full">

      {/* Welcome */}
      <div className="text-center pt-2">
        <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mx-auto mb-3 flex items-center justify-center shadow-xl">
          <span className="text-heading text-2xl font-black">L</span>
        </div>
        <h1 className="text-2xl font-bold text-heading">Welcome back!</h1>
        <p className="text-muted text-sm mt-1">Continue learning English</p>
      </div>

      {/* Review CTA */}
      {dueCount > 0 && (
        <button onClick={() => setPage('flashcards')}
          className="w-full bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/25 rounded-2xl p-4 flex items-center gap-4 hover:border-blue-500/40 transition-colors text-left">
          <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M10 9l5 3-5 3V9z"/></svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-heading">{dueCount} word{dueCount === 1 ? '' : 's'} ready to review</p>
            <p className="text-xs text-body mt-0.5">Tap to start a quick session</p>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-faint"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      )}

      {/* Quick add */}
      <div className="flex gap-2">
        <button onClick={() => setPage('library')}
          className="flex-1 bg-card/60 border border-line/40 rounded-xl p-3 text-center hover:border-line transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400 mx-auto mb-1"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>
          <p className="text-xs text-body">Add Source</p>
        </button>
        <button onClick={() => setPage('vocabulary')}
          className="flex-1 bg-card/60 border border-line/40 rounded-xl p-3 text-center hover:border-line transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-400 mx-auto mb-1"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          <p className="text-xs text-body">My Words</p>
        </button>
        <button onClick={() => setPage('flashcards')}
          className="flex-1 bg-card/60 border border-line/40 rounded-xl p-3 text-center hover:border-line transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-400 mx-auto mb-1"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M10 9l5 3-5 3V9z"/></svg>
          <p className="text-xs text-body">Review</p>
        </button>
      </div>

      {/* Recent Words */}
      {recentWords.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-sm font-semibold text-heading">Recent Words</h2>
            <button onClick={() => setPage('vocabulary')} className="text-xs text-blue-400 hover:text-blue-300">See all →</button>
          </div>
          <div className="space-y-1.5">
            {recentWords.map(w => (
              <button key={w.id} onClick={() => lookupWord(w.word, w.sentence || '')}
                className="w-full flex items-center gap-3 px-3 py-2.5 bg-card/40 border border-line/30 rounded-xl hover:border-line transition-colors text-left">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-heading">{w.word}</span>
                    {w.level && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400">{w.level}</span>}
                  </div>
                  {w.meaning_ar && (
                    <p className="text-xs text-muted mt-0.5 truncate" style={{ direction: 'rtl', textAlign: 'right' }}>{w.meaning_ar}</p>
                  )}
                </div>
                <button onClick={e => { e.stopPropagation(); speak(w.word); }}
                  className="p-1.5 rounded-lg text-faint hover:text-blue-400">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                </button>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recent Sources */}
      {sources.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-sm font-semibold text-heading">Recent Sources</h2>
            <button onClick={() => setPage('library')} className="text-xs text-blue-400 hover:text-blue-300">See all →</button>
          </div>
          <div className="space-y-1.5">
            {sources.slice(0, 4).map((s: any) => (
              <button key={s.id}
                onClick={() => {
                  if (s.source_type === 'youtube' && s.youtube_id) {
                    setCurrentVideo(s); addRecentVideo(s); setPage('player');
                  } else {
                    setPage('library');
                  }
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 bg-card/40 border border-line/30 rounded-xl hover:border-line transition-colors text-left">
                {s.thumbnail_url ? (
                  <img src={s.thumbnail_url} alt="" className="w-14 h-9 rounded-lg object-cover bg-elevated flex-shrink-0" />
                ) : (
                  <div className="w-14 h-9 rounded-lg bg-elevated/50 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm">{s.source_type === 'youtube' ? '🎬' : '📄'}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-heading truncate">{s.title}</p>
                  <p className="text-[11px] text-muted">{s.channel || (s.word_count ? `${s.word_count} words` : s.source_type)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {recentWords.length === 0 && sources.length === 0 && (
        <div className="text-center py-8">
          <p className="text-3xl mb-3">📚</p>
          <p className="text-heading font-semibold mb-1">Start learning!</p>
          <p className="text-muted text-sm">Add a video or word from the Library</p>
        </div>
      )}

      <WordPopup />
    </div>
  );
}
