/**
 * CrosswordGame — vocabulary crossword built from the user's saved words.
 *
 * Flow:
 *  1. Player picks a difficulty (Easy / Medium / Hard) — controls grid size,
 *     word length range, and how many letters are revealed up-front.
 *  2. Auto-generate an interlocking grid (perpendicular intersections only),
 *     with some "given" letters pre-filled so the player has anchors to rely on.
 *  3. User fills cells via an on-screen keyboard (mobile) or physical keyboard.
 *  4. Game points: +SOLVE_POINTS per solved word, −HINT_COST per revealed letter.
 *  5. When every word is solved → result screen; XP awarded = final game score.
 *
 * Self-contained on purpose: own header + result screen so the Games tab stays lean.
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { SavedWord } from '@/types';
import { awardXP } from '@/components/common/XPBar';
import * as sfx from '@/lib/sfx';
import { speak as ttsSpeak } from '@/lib/tts';

// ── Scoring ──────────────────────────────────────────────────────────────────

const SOLVE_POINTS = 10;   // points earned per word solved
const HINT_COST    = 3;    // points deducted per revealed letter

// ── Difficulty ───────────────────────────────────────────────────────────────

type Difficulty = 'easy' | 'medium' | 'hard';

interface DiffConfig {
  label: string;
  desc: string;
  maxWords: number;
  minLen: number;
  maxLen: number;
  prefillRatio: number;   // fraction of cells revealed up-front
  color: 'green' | 'blue' | 'red';
}

const DIFFICULTY: Record<Difficulty, DiffConfig> = {
  easy:   { label: 'Easy',   desc: 'Short words · more letters given', maxWords: 5,  minLen: 3, maxLen: 6, prefillRatio: 0.30, color: 'green' },
  medium: { label: 'Medium', desc: 'A balanced challenge',             maxWords: 8,  minLen: 3, maxLen: 8, prefillRatio: 0.16, color: 'blue'  },
  hard:   { label: 'Hard',   desc: 'More & longer words · few hints',  maxWords: 12, minLen: 4, maxLen: 9, prefillRatio: 0.06, color: 'red'   },
};

// ── Types ──────────────────────────────────────────────────────────────────

type Dir = 'across' | 'down';

interface Entry {
  word: string;     // UPPERCASE answer
  clue: string;     // definition shown to the player
  meaningAr?: string;
}

interface Placement extends Entry {
  row: number;
  col: number;
  dir: Dir;
  number: number;   // assigned during numbering
}

interface Puzzle {
  placements: Placement[];
  rows: number;
  cols: number;
  given: Set<string>;   // cell keys revealed up-front
}

const key = (r: number, c: number) => `${r},${c}`;

// ── Generation ───────────────────────────────────────────────────────────────

function buildOnce(entries: Entry[], maxWords: number): Placement[] {
  const grid = new Map<string, string>();
  const placed: Placement[] = [];
  const get = (r: number, c: number) => grid.get(key(r, c));

  const write = (e: Entry, r: number, c: number, dir: Dir) => {
    for (let i = 0; i < e.word.length; i++) {
      const rr = dir === 'across' ? r : r + i;
      const cc = dir === 'across' ? c + i : c;
      grid.set(key(rr, cc), e.word[i]);
    }
    placed.push({ ...e, row: r, col: c, dir, number: 0 });
  };

  const canPlace = (e: Entry, r: number, c: number, dir: Dir): boolean => {
    const len = e.word.length;
    let crossings = 0;

    // The cells immediately before the start and after the end must be empty.
    const beforeR = dir === 'across' ? r : r - 1;
    const beforeC = dir === 'across' ? c - 1 : c;
    if (get(beforeR, beforeC)) return false;
    const afterR = dir === 'across' ? r : r + len;
    const afterC = dir === 'across' ? c + len : c;
    if (get(afterR, afterC)) return false;

    for (let i = 0; i < len; i++) {
      const rr = dir === 'across' ? r : r + i;
      const cc = dir === 'across' ? c + i : c;
      const existing = get(rr, cc);
      if (existing) {
        if (existing !== e.word[i]) return false; // letter mismatch
        crossings++;
      } else {
        // Non-crossing cell: perpendicular neighbours must be empty so we don't
        // accidentally glue two parallel words together.
        if (dir === 'across') {
          if (get(rr - 1, cc) || get(rr + 1, cc)) return false;
        } else {
          if (get(rr, cc - 1) || get(rr, cc + 1)) return false;
        }
      }
    }
    return crossings >= 1;
  };

  if (entries.length === 0) return [];
  write(entries[0], 0, 0, 'across');

  for (let idx = 1; idx < entries.length && placed.length < maxWords; idx++) {
    const e = entries[idx];
    let best: { r: number; c: number; dir: Dir } | null = null;

    search:
    for (let pi = 0; pi < e.word.length; pi++) {
      const ch = e.word[pi];
      for (const [k, letter] of grid) {
        if (letter !== ch) continue;
        const [pr, pc] = k.split(',').map(Number);
        for (const dir of ['down', 'across'] as Dir[]) {
          const r = dir === 'across' ? pr : pr - pi;
          const c = dir === 'across' ? pc - pi : pc;
          if (canPlace(e, r, c, dir)) {
            best = { r, c, dir };
            break search;
          }
        }
      }
    }

    if (best) write(e, best.r, best.c, best.dir);
  }

  return placed;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Choose cells to reveal up-front. Never reveals every letter of a word —
 * each word keeps at least one empty cell for the player to fill in.
 */
function pickGivenCells(placements: Placement[], prefillRatio: number): Set<string> {
  const cellWords = new Map<string, string[]>();  // cellKey -> [wordId]
  const wordLen   = new Map<string, number>();    // wordId  -> length

  placements.forEach(p => {
    const id = `${p.number}-${p.dir}`;
    wordLen.set(id, p.word.length);
    for (let i = 0; i < p.word.length; i++) {
      const r = p.dir === 'across' ? p.row : p.row + i;
      const c = p.dir === 'across' ? p.col + i : p.col;
      const k = key(r, c);
      const arr = cellWords.get(k) || [];
      arr.push(id);
      cellWords.set(k, arr);
    }
  });

  const allCells = Array.from(cellWords.keys());
  const target   = Math.round(allCells.length * prefillRatio);
  const given    = new Set<string>();
  const perWord  = new Map<string, number>();

  for (const k of shuffle(allCells)) {
    if (given.size >= target) break;
    const ids = cellWords.get(k)!;
    // Reveal only if every word through this cell still keeps ≥1 empty cell.
    const ok = ids.every(id => (perWord.get(id) || 0) < wordLen.get(id)! - 1);
    if (!ok) continue;
    given.add(k);
    ids.forEach(id => perWord.set(id, (perWord.get(id) || 0) + 1));
  }
  return given;
}

function buildPuzzle(words: SavedWord[], cfg: DiffConfig): Puzzle {
  const empty: Puzzle = { placements: [], rows: 0, cols: 0, given: new Set() };

  const candidates: Entry[] = words
    .filter(w => /^[a-zA-Z]+$/.test(w.word) && w.word.length >= cfg.minLen && w.word.length <= cfg.maxLen)
    .filter(w => (w.meaning_en || '').trim().length > 4)
    .map(w => ({
      word: w.word.toUpperCase(),
      clue: (w.meaning_en || '').trim(),
      meaningAr: (w.meaning_ar || '').trim() || undefined,
    }));

  // De-duplicate answers.
  const seen = new Set<string>();
  const unique = candidates.filter(e => (seen.has(e.word) ? false : (seen.add(e.word), true)));

  // Try several layouts, keep the one that places the most words.
  let best: Placement[] = [];
  for (let attempt = 0; attempt < 14; attempt++) {
    const pool = shuffle(unique)
      .slice(0, cfg.maxWords + 8)
      .sort((a, b) => b.word.length - a.word.length);
    const result = buildOnce(pool, cfg.maxWords);
    if (result.length > best.length) best = result;
    if (best.length >= cfg.maxWords) break;
  }

  // Normalise coordinates to start at (0,0).
  let minR = Infinity, minC = Infinity, maxR = -Infinity, maxC = -Infinity;
  best.forEach(p => {
    const endR = p.dir === 'across' ? p.row : p.row + p.word.length - 1;
    const endC = p.dir === 'across' ? p.col + p.word.length - 1 : p.col;
    minR = Math.min(minR, p.row); minC = Math.min(minC, p.col);
    maxR = Math.max(maxR, endR); maxC = Math.max(maxC, endC);
  });
  if (!isFinite(minR)) return empty;

  best.forEach(p => { p.row -= minR; p.col -= minC; });
  const rows = maxR - minR + 1;
  const cols = maxC - minC + 1;

  // Assign clue numbers by reading order over start cells.
  const startKeys = Array.from(new Set(best.map(p => key(p.row, p.col))));
  startKeys.sort((a, b) => {
    const [ar, ac] = a.split(',').map(Number);
    const [br, bc] = b.split(',').map(Number);
    return ar - br || ac - bc;
  });
  const numberFor = new Map<string, number>();
  startKeys.forEach((k, i) => numberFor.set(k, i + 1));
  best.forEach(p => { p.number = numberFor.get(key(p.row, p.col)) || 0; });

  const given = pickGivenCells(best, cfg.prefillRatio);

  return { placements: best, rows, cols, given };
}

// Count how many playable words exist for a given difficulty (for the menu).
function countPlayable(words: SavedWord[], cfg: DiffConfig): number {
  const seen = new Set<string>();
  return words.filter(w =>
    /^[a-zA-Z]+$/.test(w.word) &&
    w.word.length >= cfg.minLen && w.word.length <= cfg.maxLen &&
    (w.meaning_en || '').trim().length > 4 &&
    (seen.has(w.word.toUpperCase()) ? false : (seen.add(w.word.toUpperCase()), true))
  ).length;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CrosswordGame({ words, onBack }: { words: SavedWord[]; onBack: () => void }) {
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [seed, setSeed] = useState(0);

  // Difficulty selection screen (also shown as the in-game "Menu" target).
  if (!difficulty) {
    return <DifficultySelect words={words} onBack={onBack} onPick={(d) => { setDifficulty(d); setSeed(s => s + 1); }} />;
  }

  return (
    <CrosswordPlay
      key={`${difficulty}-${seed}`}
      words={words}
      cfg={DIFFICULTY[difficulty]}
      onBack={onBack}
      onNewPuzzle={() => setSeed(s => s + 1)}
      onChangeDifficulty={() => setDifficulty(null)}
    />
  );
}

// ── Difficulty selection screen ───────────────────────────────────────────────

function DifficultySelect({ words, onBack, onPick }: {
  words: SavedWord[]; onBack: () => void; onPick: (d: Difficulty) => void;
}) {
  const swatch = {
    green: { bg: 'bg-green-600/12', border: 'hover:border-green-500/40', badge: 'bg-green-500/10 text-green-500' },
    blue:  { bg: 'bg-blue-600/12',  border: 'hover:border-blue-500/40',  badge: 'bg-blue-500/10 text-blue-500'  },
    red:   { bg: 'bg-red-600/12',   border: 'hover:border-red-500/40',   badge: 'bg-red-500/10 text-red-500'    },
  };

  return (
    <div className="max-w-md mx-auto px-4 pt-5 pb-28 animate-fade-in">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack}
          className="w-9 h-9 rounded-xl hover:bg-card text-muted hover:text-body flex items-center justify-center transition-colors">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="w-4 h-4">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <div className="text-base font-bold text-heading">Crossword</div>
          <div className="text-sm text-muted">Choose a difficulty</div>
        </div>
      </div>

      <div className="space-y-3">
        {(Object.keys(DIFFICULTY) as Difficulty[]).map(d => {
          const cfg = DIFFICULTY[d];
          const avail = countPlayable(words, cfg);
          const enough = avail >= 2;
          const s = swatch[cfg.color];
          return (
            <button key={d} disabled={!enough} onClick={() => onPick(d)}
              className={`w-full flex items-center gap-4 bg-card border border-default rounded-2xl p-5 text-left transition-all
                ${enough ? `${s.border} active:scale-[0.98]` : 'opacity-50 cursor-not-allowed'}`}>
              <div className={`w-12 h-12 rounded-2xl ${s.bg} flex items-center justify-center shrink-0`}>
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M3 9h18M15 9v12M3 15h12"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-base font-bold text-heading">{cfg.label}</div>
                <div className="text-sm text-muted mt-0.5">{cfg.desc}</div>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${s.badge}`}>
                    up to {cfg.maxWords} words
                  </span>
                  <span className="text-xs text-faint">
                    {enough ? `${avail} words available` : 'need more words'}
                  </span>
                </div>
              </div>
              <svg className="w-5 h-5 text-faint shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          );
        })}
      </div>

      <p className="text-center text-xs text-faint pt-4">
        +{SOLVE_POINTS} points per word · −{HINT_COST} per hint · points become XP
      </p>
    </div>
  );
}

// ── Playable puzzle ───────────────────────────────────────────────────────────

function CrosswordPlay({ words, cfg, onBack, onNewPuzzle, onChangeDifficulty }: {
  words: SavedWord[]; cfg: DiffConfig;
  onBack: () => void; onNewPuzzle: () => void; onChangeDifficulty: () => void;
}) {
  const puzzle = useMemo(() => buildPuzzle(words, cfg), [words, cfg]);
  const { placements, rows, cols, given } = puzzle;

  // Solution + metadata maps.
  const { solution, cellMeta } = useMemo(() => {
    const sol = new Map<string, string>();
    const meta = new Map<string, { across?: number; down?: number; num?: number }>();
    placements.forEach(p => {
      for (let i = 0; i < p.word.length; i++) {
        const r = p.dir === 'across' ? p.row : p.row + i;
        const c = p.dir === 'across' ? p.col + i : p.col;
        const k = key(r, c);
        sol.set(k, p.word[i]);
        const m = meta.get(k) || {};
        if (p.dir === 'across') m.across = p.number; else m.down = p.number;
        if (i === 0) m.num = p.number;
        meta.set(k, m);
      }
    });
    return { solution: sol, cellMeta: meta };
  }, [placements]);

  const [user, setUser] = useState<Record<string, string>>({});
  const [sel, setSel] = useState<{ r: number; c: number } | null>(null);
  const [dir, setDir] = useState<Dir>('across');
  const [hints, setHints] = useState(0);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [showAr, setShowAr] = useState(false);   // reveal Arabic meaning for active clue
  const solvedRef = useRef<Set<string>>(new Set());
  const [solvedCount, setSolvedCount] = useState(0);
  const scoreRef = useRef(0);
  useEffect(() => { scoreRef.current = score; }, [score]);

  const isGiven = useCallback((k: string) => given.has(k), [given]);

  // Reset all play state + pre-fill the given letters whenever a puzzle is built.
  useEffect(() => {
    const init: Record<string, string> = {};
    given.forEach(k => { const ch = solution.get(k); if (ch) init[k] = ch; });
    setUser(init);
    setHints(0);
    setScore(0);
    setDone(false);
    solvedRef.current = new Set();
    setSolvedCount(0);
    if (placements.length > 0) {
      // Select the first non-given cell of the first across word.
      const first = placements.find(p => p.dir === 'across') || placements[0];
      let target = { r: first.row, c: first.col };
      for (let i = 0; i < first.word.length; i++) {
        const r = first.dir === 'across' ? first.row : first.row + i;
        const c = first.dir === 'across' ? first.col + i : first.col;
        if (!given.has(key(r, c))) { target = { r, c }; break; }
      }
      setSel(target);
      setDir(first.dir);
    }
  }, [placements, given, solution]);

  const isCell = useCallback((r: number, c: number) => solution.has(key(r, c)), [solution]);

  const cellInPlacement = (p: Placement, r: number, c: number) =>
    p.dir === 'across'
      ? r === p.row && c >= p.col && c < p.col + p.word.length
      : c === p.col && r >= p.row && r < p.row + p.word.length;

  const activeWord = useMemo<Placement | undefined>(() => {
    if (!sel) return undefined;
    return (
      placements.find(p => p.dir === dir && cellInPlacement(p, sel.r, sel.c)) ||
      placements.find(p => cellInPlacement(p, sel.r, sel.c))
    );
  }, [sel, dir, placements]);

  const activeCells = useMemo(() => {
    const set = new Set<string>();
    if (!activeWord) return set;
    for (let i = 0; i < activeWord.word.length; i++) {
      const r = activeWord.dir === 'across' ? activeWord.row : activeWord.row + i;
      const c = activeWord.dir === 'across' ? activeWord.col + i : activeWord.col;
      set.add(key(r, c));
    }
    return set;
  }, [activeWord]);

  // Speak the active answer word (listening practice — clearly pronounced).
  const speakClue = useCallback(() => {
    if (activeWord) ttsSpeak(activeWord.word.toLowerCase(), { rate: 0.8 });
  }, [activeWord]);

  // Hide the Arabic hint whenever the active clue changes.
  useEffect(() => { setShowAr(false); }, [activeWord?.number, activeWord?.dir]);

  const selectCell = useCallback((r: number, c: number) => {
    if (!isCell(r, c)) return;
    sfx.tap();
    const m = cellMeta.get(key(r, c))!;
    setSel(prev => {
      if (prev && prev.r === r && prev.c === c && m.across != null && m.down != null) {
        setDir(d => (d === 'across' ? 'down' : 'across'));
      } else {
        setDir(d => (m[d] != null ? d : m.across != null ? 'across' : 'down'));
      }
      return { r, c };
    });
  }, [isCell, cellMeta]);

  // Advance to the next editable (non-given) cell in the active word.
  const advance = useCallback((from: { r: number; c: number }, back = false) => {
    if (!activeWord) return from;
    const step = back ? -1 : 1;
    let r = from.r, c = from.c;
    for (let n = 0; n < activeWord.word.length; n++) {
      r += activeWord.dir === 'down' ? step : 0;
      c += activeWord.dir === 'across' ? step : 0;
      if (!isCell(r, c)) return from;          // hit edge → stay
      if (!isGiven(key(r, c))) return { r, c }; // first editable cell
    }
    return from;
  }, [activeWord, isCell, isGiven]);

  const typeLetter = useCallback((letter: string) => {
    if (!sel || done) return;
    const k = key(sel.r, sel.c);
    if (isGiven(k)) { setSel(prev => (prev ? advance(prev) : prev)); return; }
    setUser(prev => ({ ...prev, [k]: letter.toUpperCase() }));
    setSel(prev => (prev ? advance(prev) : prev));
  }, [sel, done, advance, isGiven]);

  const backspace = useCallback(() => {
    if (!sel || done) return;
    const k = key(sel.r, sel.c);
    if (user[k] && !isGiven(k)) {
      setUser(prev => { const n = { ...prev }; delete n[k]; return n; });
    } else {
      const prevCell = advance(sel, true);
      const pk = key(prevCell.r, prevCell.c);
      if (!isGiven(pk)) {
        setUser(prev => { const n = { ...prev }; delete n[pk]; return n; });
      }
      setSel(prevCell);
    }
  }, [sel, done, user, advance, isGiven]);

  const revealCell = useCallback(() => {
    if (!sel || done) return;
    const k = key(sel.r, sel.c);
    const correct = solution.get(k);
    if (!correct) return;
    if (isGiven(k) || user[k] === correct) return; // nothing to reveal here
    setUser(prev => ({ ...prev, [k]: correct }));
    setHints(h => h + 1);
    setScore(s => Math.max(0, s - HINT_COST));   // deduct points for the hint
    sfx.tap();
    setSel(prev => (prev ? advance(prev) : prev));
  }, [sel, done, solution, advance, isGiven, user]);

  // Physical keyboard support.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (done) return;
      if (/^[a-zA-Z]$/.test(e.key)) { e.preventDefault(); typeLetter(e.key); }
      else if (e.key === 'Backspace') { e.preventDefault(); backspace(); }
      else if (e.key === ' ') { e.preventDefault(); setDir(d => (d === 'across' ? 'down' : 'across')); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [typeLetter, backspace, done]);

  // Detect newly solved words + completion.
  useEffect(() => {
    if (placements.length === 0) return;
    let added = 0;
    placements.forEach(p => {
      const id = `${p.number}-${p.dir}`;
      if (solvedRef.current.has(id)) return;
      let ok = true;
      for (let i = 0; i < p.word.length; i++) {
        const r = p.dir === 'across' ? p.row : p.row + i;
        const c = p.dir === 'across' ? p.col + i : p.col;
        if (user[key(r, c)] !== p.word[i]) { ok = false; break; }
      }
      if (ok) { solvedRef.current.add(id); added++; }
    });
    if (added > 0) {
      const count = solvedRef.current.size;
      setSolvedCount(count);
      setScore(s => s + added * SOLVE_POINTS);   // earn points per solved word
      sfx.correct();
      if (count >= placements.length) {
        setDone(true);
        sfx.complete();
      }
    }
  }, [user, placements]);

  // Award XP once when finished. Capped at 50 to match the backend anti-cheat
  // cap (the offline batch endpoint clamps a single action to 50 XP), so online
  // and offline play stay consistent. The displayed game score is uncapped.
  useEffect(() => {
    if (done) awardXP('game_complete', Math.min(50, Math.max(1, scoreRef.current)));
  }, [done]);

  if (placements.length < 2) {
    return (
      <div className="max-w-md mx-auto px-4 pt-5 pb-28 animate-fade-in">
        <CwHeader title="Crossword" onBack={onChangeDifficulty} score={0} solved={0} total={0} />
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-base font-semibold text-heading mb-2">Couldn&apos;t build a puzzle</div>
          <p className="text-sm text-muted mb-6 max-w-xs">
            Not enough interlocking words for this difficulty. Try an easier level or save more words.
          </p>
          <button onClick={onChangeDifficulty} className="btn-primary px-6 py-2.5 text-sm rounded-xl">← Change difficulty</button>
        </div>
      </div>
    );
  }

  if (done) {
    const total = placements.length;
    const pct = Math.max(0, Math.round(((total - hints) / total) * 100));
    const xp  = Math.max(1, score);
    return (
      <div className="max-w-md mx-auto px-4 pt-10 pb-28 text-center animate-fade-in">
        <div className="text-7xl mb-3 animate-pop-in">{hints === 0 ? '★' : '✓'}</div>
        <h2 className="text-2xl font-black text-heading mb-1">{hints === 0 ? 'Flawless!' : 'Puzzle solved!'}</h2>
        <p className="text-sm text-muted mb-6">Crossword · {cfg.label}</p>
        <div className="bg-card border border-default rounded-3xl p-6 mb-5 grid grid-cols-3 gap-2">
          {[
            { label: 'Score',      val: score,      color: 'text-amber-400' },
            { label: 'Hints used', val: hints,      color: 'text-muted' },
            { label: 'No-hint',    val: `${pct}%`,  color: 'text-blue-400' },
          ].map(s => (
            <div key={s.label} className="bg-elevated rounded-2xl py-3">
              <div className={`text-xl font-black ${s.color}`}>{s.val}</div>
              <div className="text-xs text-faint">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-2 text-sm mb-5">
          <span className="text-yellow-400">⭐</span>
          <span className="font-semibold text-heading">+{xp} XP earned</span>
        </div>
        <div className="flex gap-3">
          <button onClick={onChangeDifficulty}
            className="flex-1 py-3.5 rounded-2xl border border-default text-sm font-medium text-body hover:bg-card transition-colors">
            ← Menu
          </button>
          <button onClick={onNewPuzzle}
            className="flex-1 btn-primary py-3.5 rounded-2xl text-sm">New puzzle</button>
        </div>
      </div>
    );
  }

  const cellSize = cols <= 7 ? 38 : cols <= 9 ? 33 : cols <= 11 ? 29 : cols <= 13 ? 25 : 22;

  const acrossClues = placements.filter(p => p.dir === 'across').sort((a, b) => a.number - b.number);
  const downClues   = placements.filter(p => p.dir === 'down').sort((a, b) => a.number - b.number);
  const isWordSolved = (p: Placement) => solvedRef.current.has(`${p.number}-${p.dir}`);

  return (
    <div className="max-w-md mx-auto px-4 pt-5 pb-28 animate-fade-in">
      <CwHeader title={`Crossword · ${cfg.label}`} onBack={onChangeDifficulty}
        score={score} solved={solvedCount} total={placements.length} />

      {/* Grid */}
      <div className="flex justify-center mt-3 mb-3 overflow-auto">
        <div
          className="grid gap-[2px] bg-elevated p-[3px] rounded-lg"
          style={{ gridTemplateColumns: `repeat(${cols}, ${cellSize}px)` }}
        >
          {Array.from({ length: rows * cols }).map((_, i) => {
            const r = Math.floor(i / cols);
            const c = i % cols;
            const k = key(r, c);
            if (!isCell(r, c)) return <div key={k} style={{ width: cellSize, height: cellSize }} />;

            const m = cellMeta.get(k)!;
            const val = user[k] || '';
            const isSel = sel?.r === r && sel?.c === c;
            const isActive = activeCells.has(k);
            const givenCell = isGiven(k);
            const wrong = val && !givenCell && val !== solution.get(k);

            return (
              <button
                key={k}
                onClick={() => selectCell(r, c)}
                style={{ width: cellSize, height: cellSize }}
                className={`relative flex items-center justify-center rounded-[3px] font-bold transition-colors
                  ${isSel ? 'bg-blue-500 text-white ring-2 ring-blue-300'
                    : isActive ? 'bg-blue-500/20 text-heading'
                    : givenCell ? 'bg-amber-500/15 text-amber-600'
                    : 'bg-card text-heading'}
                  ${wrong && !isSel ? '!text-red-400' : ''}`}
              >
                {m.num != null && (
                  <span className="absolute top-[1px] left-[2px] text-[8px] leading-none text-faint font-medium">
                    {m.num}
                  </span>
                )}
                <span style={{ fontSize: cellSize * 0.5 }}>{val}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active clue bar */}
      {activeWord && (
        <div className="bg-card border border-default rounded-xl px-3 py-2.5 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-blue-500 shrink-0">
              {activeWord.number} {activeWord.dir === 'across' ? '→' : '↓'}
            </span>
            <span className="text-sm text-body flex-1 leading-snug">{activeWord.clue}</span>

            {/* Listen to the answer word (pronunciation practice) */}
            <button onClick={speakClue} aria-label="Listen to the word"
              className="shrink-0 w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 active:scale-95 flex items-center justify-center transition-all">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <path d="M11 5L6 9H2v6h4l5 4V5z" />
                <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" />
              </svg>
            </button>

            {/* Toggle Arabic meaning (only if available) */}
            {activeWord.meaningAr && (
              <button onClick={() => setShowAr(s => !s)} aria-label="Show Arabic meaning"
                className={`shrink-0 w-8 h-8 rounded-lg text-xs font-bold active:scale-95 flex items-center justify-center transition-all ${
                  showAr ? 'bg-emerald-500/20 text-emerald-500' : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'
                }`}>
                ع
              </button>
            )}
          </div>

          {/* Arabic meaning (revealed on demand) */}
          {showAr && activeWord.meaningAr && (
            <div dir="rtl" className="mt-2 pt-2 border-t border-subtle text-sm text-emerald-500/90 leading-relaxed">
              {activeWord.meaningAr}
            </div>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-2 mb-3">
        <button onClick={() => setDir(d => (d === 'across' ? 'down' : 'across'))}
          className="flex-1 py-2 rounded-xl border border-default text-xs font-medium text-body hover:bg-card transition-colors">
          Toggle {dir === 'across' ? '→ Across' : '↓ Down'}
        </button>
        <button onClick={revealCell}
          className="flex-1 py-2 rounded-xl border border-default text-xs font-medium text-amber-500 hover:bg-card transition-colors">
          💡 Reveal (−{HINT_COST})
        </button>
        <button onClick={onNewPuzzle}
          className="flex-1 py-2 rounded-xl border border-default text-xs font-medium text-body hover:bg-card transition-colors">
          ↻ New
        </button>
      </div>

      {/* On-screen keyboard */}
      <Keyboard onLetter={typeLetter} onBackspace={backspace} />

      {/* Clue lists */}
      <div className="grid sm:grid-cols-2 gap-4 mt-5">
        <ClueColumn title="Across" arrow="→" clues={acrossClues} active={activeWord} solvedFn={isWordSolved}
          onPick={(p) => { setSel({ r: p.row, c: p.col }); setDir('across'); }} />
        <ClueColumn title="Down" arrow="↓" clues={downClues} active={activeWord} solvedFn={isWordSolved}
          onPick={(p) => { setSel({ r: p.row, c: p.col }); setDir('down'); }} />
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CwHeader({ title, onBack, score, solved, total }: {
  title: string; onBack: () => void; score: number; solved: number; total: number;
}) {
  const pct = total > 0 ? Math.round((solved / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <button onClick={onBack}
          className="w-9 h-9 rounded-xl hover:bg-card text-muted hover:text-body flex items-center justify-center transition-colors">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="w-4 h-4">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-base font-bold text-heading truncate">{title}</div>
          <div className="text-sm text-muted">{solved} / {total} words solved</div>
        </div>
        <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-1.5">
          <span className="text-sm">⭐</span>
          <span className="text-sm font-bold text-amber-500">{score}</span>
        </div>
      </div>
      <div className="h-2 bg-elevated rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const KEYS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

function Keyboard({ onLetter, onBackspace }: { onLetter: (l: string) => void; onBackspace: () => void }) {
  return (
    <div className="space-y-1.5 select-none">
      {KEYS.map((row, ri) => (
        <div key={ri} className="flex justify-center gap-1">
          {row.split('').map(letter => (
            <button key={letter} onClick={() => onLetter(letter)}
              className="flex-1 max-w-[34px] h-11 rounded-lg bg-card border border-default text-sm font-semibold text-heading
                         hover:bg-elevated active:scale-95 transition-all">
              {letter}
            </button>
          ))}
          {ri === 2 && (
            <button onClick={onBackspace}
              className="flex-[1.5] max-w-[52px] h-11 rounded-lg bg-card border border-default text-heading
                         hover:bg-elevated active:scale-95 transition-all flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-5 h-5">
                <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM18 9l-6 6M12 9l6 6" />
              </svg>
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function ClueColumn({ title, arrow, clues, active, solvedFn, onPick }: {
  title: string; arrow: string; clues: Placement[]; active: Placement | undefined;
  solvedFn: (p: Placement) => boolean; onPick: (p: Placement) => void;
}) {
  if (clues.length === 0) return null;
  return (
    <div>
      <div className="text-xs font-bold text-muted uppercase tracking-wide mb-2">{title} {arrow}</div>
      <div className="space-y-1">
        {clues.map(p => {
          const isActive = active?.number === p.number && active?.dir === p.dir;
          const solved = solvedFn(p);
          return (
            <button key={`${p.number}-${p.dir}`} onClick={() => onPick(p)}
              className={`w-full text-left flex gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors
                ${isActive ? 'bg-blue-500/15 text-heading' : 'hover:bg-card text-body'}`}>
              <span className={`font-bold shrink-0 ${solved ? 'text-green-400' : 'text-blue-500'}`}>{p.number}.</span>
              <span className={`leading-snug ${solved ? 'line-through text-faint' : ''}`}>{p.clue}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
