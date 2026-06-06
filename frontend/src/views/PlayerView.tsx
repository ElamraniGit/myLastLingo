/**
 * Home / Player view — Apple-style redesign.
 * Dashboard when no video loaded · Player + Transcript when video active.
 *
 * UI improvements:
 *  - Personalised greeting (morning/afternoon/evening + streak)
 *  - Animated stat cards on Home (due, learned, streak)
 *  - Daily-goal progress ring on Home
 *  - Recent words show SM-2 status dot
 *  - Recent sources show word-count badge
 *  - Smooth page-enter animation with staggered sections
 *  - Player header: video thumbnail + back-chevron + overflow menu stub
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useStore } from '@/store/appStore';
import { useDictionary } from '@/hooks/useDictionary';
import { libraryApi, xpApi } from '@/lib/api';
import VideoInput from '@/components/player/VideoInput';
import VideoPlayer from '@/components/player/VideoPlayer';
import TranscriptViewer from '@/components/transcript/TranscriptViewer';
import WordPopup from '@/components/dictionary/WordPopup';
import type { SavedWord, ReviewSummary } from '@/types';
import { speak as ttsSpeak } from '@/lib/tts';
import { LibraryIcon, WordsIcon, ReviewIcon, GamesIcon } from '@/components/ui/Icons';

function fmtDuration(s: number) {
  if (!s) return '';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}
function speak(t: string) {
  ttsSpeak(t, { rate: (t || '').trim().split(/\s+/).length <= 2 ? 0.9 : 1.0 });
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

const STATUS_DOT: Record<string, string> = {
  learning:  'bg-amber-400',
  reviewing: 'bg-blue-400',
  learned:   'bg-green-400',
};

// ── Player Screen ─────────────────────────────────────────────────────────────
export default function PlayerView() {
  const { currentVideo, resetPlayer } = useStore();
  if (!currentVideo) return <HomeDashboard />;

  return (
    <div className="flex flex-col h-full bg-base">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 nav-bar shrink-0 border-b border-default">
        <button
          onClick={() => resetPlayer()}
          className="w-8 h-8 rounded-xl hover:bg-card text-muted hover:text-body flex items-center justify-center transition-colors"
          aria-label="Back"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
               strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>

        {/* Thumbnail + title */}
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          {currentVideo.thumbnail_url && (
            <img
              src={currentVideo.thumbnail_url}
              alt=""
              className="w-9 h-6 rounded-md object-cover shrink-0 bg-elevated"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-base font-bold text-heading truncate leading-tight">
              {currentVideo.title}
            </div>
            <div className="text-xs text-muted truncate">
              {currentVideo.channel}
              {currentVideo.duration > 0 && <> · {fmtDuration(currentVideo.duration)}</>}
            </div>
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

// ── Home Dashboard ────────────────────────────────────────────────────────────
function HomeDashboard() {
  const { savedWords, recentVideos, setPage, setCurrentVideo, addRecentVideo, user, progress } = useStore();
  const { loadVocabulary, loadReviewSummary, loadStats, lookupWord } = useDictionary();
  const [summary, setSummary]   = useState<ReviewSummary | null>(null);
  const [sources, setSources]   = useState<any[]>([]);
  const [xpData,  setXpData]    = useState<any>(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([
      loadVocabulary({ page: 1, limit: 8, sort: 'newest' }).catch(() => null),
      loadReviewSummary().then(setSummary).catch(() => null),
      loadStats().catch(() => null),
      libraryApi.listSources(1, 6).then(d => setSources(d?.sources || [])).catch(() => []),
      xpApi.getStatus().then(setXpData).catch(() => null),
    ]).finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const recentWords = savedWords.slice(0, 5);
  const dueCount    = summary?.due_now ?? 0;
  const streak      = user?.streak_days ?? 0;
  const dailyXP     = xpData?.daily_xp ?? 0;
  const dailyGoal   = xpData?.daily_goal ?? 50;
  const goalPct     = Math.min(100, Math.round((dailyXP / Math.max(dailyGoal, 1)) * 100));

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-28 lg:pb-8 space-y-6 animate-fade-in">

      {/* ── Greeting ──────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-heading tracking-tight">
            {greeting()}{user?.display_name ? `, ${user.display_name.split(' ')[0]}` : '!'}
          </h2>
          <p className="text-sm text-muted mt-0.5">
            {dueCount > 0
              ? `${dueCount} word${dueCount === 1 ? '' : 's'} waiting for review`
              : 'All caught up — great work!'}
          </p>
        </div>
        {/* Daily goal ring */}
        {dailyGoal > 0 && (
          <div className="relative w-14 h-14 shrink-0">
            <svg viewBox="0 0 48 48" className="w-full h-full -rotate-90">
              <circle cx="24" cy="24" r="20" fill="none" stroke="rgb(var(--bg-elevated))" strokeWidth="5"/>
              <circle
                cx="24" cy="24" r="20" fill="none"
                stroke="rgb(var(--accent))" strokeWidth="5"
                strokeDasharray={`${2 * Math.PI * 20}`}
                strokeDashoffset={`${2 * Math.PI * 20 * (1 - goalPct / 100)}`}
                strokeLinecap="round"
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xs font-bold text-heading">{goalPct}%</span>
              <span className="text-[8px] text-faint">daily</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Stat pills ────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { icon: (<svg className='w-4 h-4' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round'><rect x='2' y='4' width='20' height='16' rx='3'/><path d='M8 10h8M8 14h5'/><circle cx='18' cy='14' r='2' fill='currentColor' stroke='none'/></svg>), label: 'Due',     val: dueCount,              color: dueCount > 0 ? 'text-blue-500' : 'text-muted', onClick: () => dueCount > 0 && setPage('flashcards') },
          { icon: (<svg className='w-4 h-4' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round'><polyline points='20 6 9 17 4 12'/></svg>), label: 'Learned', val: summary?.learned ?? 0, color: 'text-green-500', onClick: () => setPage('vocabulary') },
          { icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22a7 7 0 0 1-7-7c0-4.5 3-7.5 4-10 1.5 2 2 4 2 6.5C12 9 14 7 15 4c2 3.5 3 5 3 7a7 7 0 0 1-6 6.93V22z"/></svg>, label: 'Streak',  val: streak,                color: streak > 0 ? 'text-orange-400' : 'text-muted', onClick: undefined },
        ].map(s => (
          <button
            key={s.label}
            onClick={s.onClick}
            disabled={!s.onClick}
            className={`flex flex-col items-center gap-1.5 bg-card border border-default rounded-2xl py-3.5 transition-all ${s.onClick ? 'card-hover cursor-pointer' : 'cursor-default'}`}
          >
            <span className="text-xl">{s.icon}</span>
            <span className={`text-lg font-bold ${s.color}`}>{loading ? '—' : s.val}</span>
            <span className="text-xs text-faint font-medium uppercase tracking-wide">{s.label}</span>
          </button>
        ))}
      </div>

      {/* ── Add video ─────────────────────────────────────────────── */}
      <VideoInput />

      {/* ── Review CTA ────────────────────────────────────────────── */}
      {dueCount > 0 && (
        <button
          onClick={() => setPage('flashcards')}
          className="w-full flex items-center gap-4 bg-gradient-to-r from-blue-600/10 to-indigo-600/10
                     border border-blue-500/25 rounded-2xl p-4 hover:border-blue-500/40 active:scale-[0.985]
                     transition-all text-left group"
        >
          <div className="w-11 h-11 rounded-xl bg-blue-600/15 group-hover:bg-blue-600/20 flex items-center justify-center text-xl shrink-0 transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="4" width="20" height="16" rx="3"/><path d="M8 10h8M8 14h5"/><circle cx="18" cy="14" r="2" fill="currentColor" stroke="none"/></svg>
          </div>
          <div className="flex-1">
            <div className="text-base font-bold text-heading">
              {dueCount} word{dueCount === 1 ? '' : 's'} ready to review
            </div>
            <div className="text-xs text-muted mt-0.5">Tap to start your session</div>
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
               strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-muted group-hover:translate-x-0.5 transition-transform">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      )}

      {/* ── Quick actions ─────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-2">
        {([
          { Icon: LibraryIcon, label: 'Library',  page: 'library'    },
          { Icon: WordsIcon,   label: 'Words',    page: 'vocabulary' },
          { Icon: ReviewIcon,  label: 'Review',   page: 'flashcards' },
          { Icon: GamesIcon,   label: 'Games',    page: 'games'      },
        ] as const).map(a => (
          <button
            key={a.page}
            onClick={() => setPage(a.page as any)}
            className="flex flex-col items-center gap-2 bg-card border border-default rounded-2xl py-3.5
                       hover:border-blue-500/20 hover:bg-blue-500/5 active:scale-95 transition-all"
          >
            <a.Icon className="w-5 h-5 text-muted" />
            <span className="text-sm font-medium text-body">{a.label}</span>
          </button>
        ))}
      </div>

      {/* ── Recent words ──────────────────────────────────────────── */}
      {recentWords.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <span className="section-title mb-3">Recent Words</span>
            <button onClick={() => setPage('vocabulary')} className="text-xs text-blue-500 font-medium hover:text-blue-400 transition-colors">
              See all →
            </button>
          </div>
          <div className="space-y-1.5">
            {recentWords.map(w => (
              <button
                key={w.id}
                onClick={() => lookupWord(w.word, w.sentence || '')}
                className="w-full flex items-center gap-3 bg-card border border-default rounded-2xl px-4 py-3 card-hover text-left group"
              >
                {/* Status dot */}
                <div className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[w.status] ?? 'bg-muted'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-heading">{w.word}</span>
                    {w.level && (
                      <span className="text-2xs px-1 py-0.5 rounded bg-blue-500/10 text-blue-500 font-bold uppercase">{w.level}</span>
                    )}
                  </div>
                  {w.meaning_en ? (
                    <div className="text-xs text-muted mt-0.5 truncate">{w.meaning_en}</div>
                  ) : w.meaning_ar ? (
                    <div className="text-xs text-muted mt-0.5 truncate" style={{ direction: 'rtl', fontFamily: "'Segoe UI', 'Noto Sans Arabic', sans-serif" }}>{w.meaning_ar}</div>
                  ) : null}
                </div>
                <button
                  onClick={e => { e.stopPropagation(); speak(w.word); }}
                  className="w-7 h-7 rounded-lg hover:bg-blue-500/10 text-faint hover:text-blue-500 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 text-sm"
                  aria-label={`Pronounce ${w.word}`}
                ><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" opacity="0.9"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg></button>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ── Recent sources ────────────────────────────────────────── */}
      {sources.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <span className="section-title mb-3">Recent Sources</span>
            <button onClick={() => setPage('library')} className="text-xs text-blue-500 font-medium hover:text-blue-400 transition-colors">
              See all →
            </button>
          </div>
          <div className="space-y-1.5">
            {sources.slice(0, 4).map((s: any) => (
              <button
                key={s.id}
                onClick={() => {
                  if (s.source_type === 'youtube') { setCurrentVideo(s); addRecentVideo(s); setPage('player'); }
                  else setPage('library');
                }}
                className="w-full flex items-center gap-3 bg-card border border-default rounded-2xl px-3.5 py-3 card-hover text-left group"
              >
                {s.thumbnail_url ? (
                  <img src={s.thumbnail_url} alt="" className="w-12 h-8 rounded-lg object-cover shrink-0 bg-elevated"/>
                ) : (
                  <div className="w-12 h-8 rounded-lg bg-elevated flex items-center justify-center text-lg shrink-0">
                    {s.source_type === 'youtube' ? (<svg className='w-4 h-4' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round'><rect x='1' y='4' width='15' height='16' rx='2'/><polygon points='16 9 23 4 23 20 16 15 16 9'/></svg>) : (<svg className='w-4 h-4' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round'><path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'/><polyline points='14 2 14 8 20 8'/></svg>)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-heading truncate">{s.title}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs text-muted truncate">
                      {s.channel || s.source_type}
                    </span>
                    {s.word_count > 0 && (
                      <span className="text-xs bg-elevated px-1.5 py-0.5 rounded text-faint font-medium shrink-0">
                        {s.word_count} words
                      </span>
                    )}
                  </div>
                </div>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                     strokeLinecap="round" strokeLinejoin="round"
                     className="w-4 h-4 text-faint shrink-0 group-hover:translate-x-0.5 transition-transform">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ── Empty state ───────────────────────────────────────────── */}
      {!loading && recentWords.length === 0 && sources.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-blue-500/10 flex items-center justify-center"><svg className="w-8 h-8 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="18" rx="1"/><path d="M17 3l4 2v14l-4 2V3z"/></svg></div>
          <div className="text-base font-semibold text-heading mb-1">Start learning!</div>
          <div className="text-sm text-muted">Paste a YouTube URL above to begin</div>
        </div>
      )}

      <WordPopup />
    </div>
  );
}
