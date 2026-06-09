/**
 * DictationPanel — listening gap-fill practice from the current video.
 *
 * Flow:
 *  1. Build a queue of transcript segments that have enough words.
 *  2. For each segment, hide ~30% of the content words ("blanks").
 *  3. The user plays the segment audio (auto-pauses at the segment end) and
 *     types the missing words while listening.
 *  4. Check → normalised comparison, per-blank correct/incorrect, score + XP.
 *
 * Reuses the shared player (seekTo / play / pause) and the transcript already in
 * the store. Self-contained UI so PlayerView stays lean.
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useStore } from '@/store/appStore';
import { useVideoPlayer } from '@/hooks/useVideoPlayer';
import { awardXP } from '@/components/common/XPBar';
import * as sfx from '@/lib/sfx';
import type { TranscriptSegment } from '@/types';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Normalise a token for forgiving comparison (lowercase, strip punctuation). */
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9']/gi, '').trim();
}

/** Split a segment into display tokens (prefer word timings, else text split). */
function tokensOf(seg: TranscriptSegment): string[] {
  if (seg.words?.length) return seg.words.map(w => w.word);
  return seg.text.split(/\s+/).filter(Boolean);
}

// Very common words we avoid blanking (too easy / not useful to test).
const STOP = new Set([
  'the','a','an','to','of','in','on','at','is','are','am','be','was','were',
  'and','or','but','i','you','he','she','it','we','they','my','your','this',
  'that','for','as','so','do','does','did','not','no','yes','if','by','with',
]);

interface Blank {
  tokenIndex: number;  // index into tokens[]
  answer: string;      // normalised expected word
  display: string;     // original word (for reveal)
}

/** Pick which token indices to blank out for a segment (deterministic per seg). */
function pickBlanks(tokens: string[], ratio = 0.3): Blank[] {
  const candidates: number[] = [];
  tokens.forEach((t, i) => {
    const n = norm(t);
    if (n.length >= 3 && !STOP.has(n)) candidates.push(i);
  });
  if (candidates.length === 0) return [];

  const count = Math.max(1, Math.min(6, Math.round(candidates.length * ratio)));
  // Evenly spread the blanks across the candidates for a nicer distribution.
  const step = candidates.length / count;
  const chosen = new Set<number>();
  for (let k = 0; k < count; k++) {
    chosen.add(candidates[Math.floor(k * step)]);
  }
  return Array.from(chosen).sort((a, b) => a - b).map(i => ({
    tokenIndex: i,
    answer: norm(tokens[i]),
    display: tokens[i],
  }));
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DictationPanel() {
  const { transcript } = useStore();
  const { seekTo, play, pause, currentTime } = useVideoPlayer();

  // Segments long enough to be worth practising.
  const segments = useMemo(() => {
    const segs = transcript?.segments ?? [];
    return segs.filter(s => tokensOf(s).filter(t => norm(t).length >= 3 && !STOP.has(norm(t))).length >= 2);
  }, [transcript?.segments]);

  const [idx, setIdx]         = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [checked, setChecked] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore]     = useState(0);
  const [doneSegs, setDoneSegs] = useState(0);
  const playGuard = useRef<ReturnType<typeof setInterval> | null>(null);

  const seg = segments[idx];
  const tokens = useMemo(() => (seg ? tokensOf(seg) : []), [seg]);
  const blanks = useMemo(() => (seg ? pickBlanks(tokens) : []), [seg, tokens]);

  const reset = useCallback(() => {
    setAnswers({});
    setChecked(false);
    setRevealed(false);
  }, []);

  // Reset when segment changes.
  useEffect(() => { reset(); }, [idx, reset]);

  // Clean up the auto-pause watcher on unmount.
  useEffect(() => () => { if (playGuard.current) clearInterval(playGuard.current); }, []);

  // Play just this segment, auto-pausing at its end.
  const playSegment = useCallback(() => {
    if (!seg) return;
    if (playGuard.current) clearInterval(playGuard.current);
    seekTo(seg.start);
    play();
    sfx.tap();
    playGuard.current = setInterval(() => {
      const t = useStore.getState().currentTime;
      if (t >= seg.end - 0.05) {
        pause();
        if (playGuard.current) { clearInterval(playGuard.current); playGuard.current = null; }
      }
    }, 120);
  }, [seg, seekTo, play, pause]);

  const stop = useCallback(() => {
    pause();
    if (playGuard.current) { clearInterval(playGuard.current); playGuard.current = null; }
  }, [pause]);

  const isCorrect = useCallback((b: Blank) => norm(answers[b.tokenIndex] || '') === b.answer, [answers]);

  const check = useCallback(() => {
    if (checked) return;
    const right = blanks.filter(isCorrect).length;
    setChecked(true);
    setRevealed(true);
    if (right === blanks.length) {
      sfx.correct();
      setScore(s => s + 1);
      awardXP('game_correct');
    } else if (right > 0) {
      sfx.tap();
    } else {
      sfx.wrong();
    }
    setDoneSegs(d => d + 1);
  }, [checked, blanks, isCorrect]);

  const next = useCallback(() => {
    stop();
    if (idx + 1 < segments.length) setIdx(i => i + 1);
    else setIdx(0); // loop back to start
  }, [idx, segments.length, stop]);

  if (!transcript || segments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-3">
          <svg className="w-7 h-7 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
          </svg>
        </div>
        <div className="text-base font-semibold text-heading mb-1">No subtitles to dictate</div>
        <p className="text-sm text-muted max-w-xs">
          Extract subtitles for this video first, then come back to practise listening.
        </p>
      </div>
    );
  }

  const allCorrect = checked && blanks.every(isCorrect);

  return (
    <div className="max-w-lg mx-auto px-4 py-4 h-full overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm font-bold text-heading">Dictation</div>
          <div className="text-xs text-muted">Sentence {idx + 1} / {segments.length}</div>
        </div>
        <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-1.5">
          <span className="text-sm">⭐</span>
          <span className="text-sm font-bold text-amber-500">{score}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-elevated rounded-full overflow-hidden mb-4">
        <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-300"
          style={{ width: `${((idx) / segments.length) * 100}%` }} />
      </div>

      {/* Audio controls */}
      <div className="flex gap-2 mb-4">
        <button onClick={playSegment}
          className="flex-1 btn-primary py-3 rounded-xl text-sm flex items-center justify-center gap-2">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          Play sentence
        </button>
        <button onClick={stop}
          className="px-4 py-3 rounded-xl border border-default text-sm text-body hover:bg-card transition-colors">
          Stop
        </button>
      </div>

      {/* Gap-fill sentence */}
      <div className="bg-card border border-default rounded-2xl p-4 mb-4 leading-loose text-base">
        {tokens.map((tok, i) => {
          const blank = blanks.find(b => b.tokenIndex === i);
          if (!blank) {
            return <span key={i} className="text-body">{tok} </span>;
          }
          const val = answers[i] || '';
          const ok  = checked && norm(val) === blank.answer;
          const bad = checked && !ok;
          const width = Math.max(60, blank.display.length * 12);
          return (
            <span key={i} className="inline-flex items-center align-baseline">
              <input
                value={revealed && bad ? blank.display : val}
                onChange={e => setAnswers(a => ({ ...a, [i]: e.target.value }))}
                disabled={checked}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                style={{ width }}
                className={`mx-1 px-1.5 py-0.5 text-center text-sm rounded-md border outline-none transition-colors
                  ${ok ? 'border-green-500/50 bg-green-500/10 text-green-400'
                    : bad ? 'border-red-500/50 bg-red-500/10 text-red-400'
                    : 'border-blue-500/40 bg-elevated text-heading focus:border-blue-500'}`}
              />{' '}
            </span>
          );
        })}
      </div>

      {/* Reveal hint after checking (full correct sentence) */}
      {checked && !allCorrect && (
        <div className="bg-elevated rounded-xl p-3 mb-4">
          <div className="text-xs font-semibold text-muted mb-1">Correct sentence</div>
          <p className="text-sm text-green-400">{seg.text}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {!checked ? (
          <button onClick={check}
            className="flex-1 btn-primary py-3 rounded-xl text-sm">
            Check answers
          </button>
        ) : (
          <>
            <button onClick={() => setRevealed(r => !r)}
              className="px-4 py-3 rounded-xl border border-default text-sm text-body hover:bg-card transition-colors">
              {revealed ? 'Hide' : 'Show'}
            </button>
            <button onClick={next} className="flex-1 btn-primary py-3 rounded-xl text-sm">
              {allCorrect ? '✅ Next sentence →' : 'Next sentence →'}
            </button>
          </>
        )}
      </div>

      <p className="text-center text-xs text-faint mt-4">
        {doneSegs} sentence{doneSegs === 1 ? '' : 's'} practised · listening builds real comprehension
      </p>
    </div>
  );
}
