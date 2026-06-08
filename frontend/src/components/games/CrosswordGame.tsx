/**
 * CrosswordGame — vocabulary crossword built from the user's saved words.
 *
 * Flow:
 *  1. Pick playable words (3–9 letters, with an English definition).
 *  2. Auto-generate an interlocking grid (perpendicular intersections only).
 *  3. User fills cells via an on-screen keyboard (mobile) or physical keyboard.
 *  4. Each word that becomes fully correct is "solved" (sfx + XP).
 *  5. When every word is solved → result screen.
 *
 * Self-contained on purpose: own header + result screen so the Games tab stays lean.
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { SavedWord } from '@/types';
import { awardXP } from '@/components/common/XPBar';
import * as sfx from '@/lib/sfx';

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

function buildPuzzle(words: SavedWord[], maxWords = 9): Puzzle {
  const candidates: Entry[] = words
    .filter(w => /^[a-zA-Z]+$/.test(w.word) && w.word.length >= 3 && w.word.length <= 9)
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
  for (let attempt = 0; attempt < 12; attempt++) {
    const pool = shuffle(unique)
      .slice(0, 16)
      .sort((a, b) => b.word.length - a.word.length);
    const result = buildOnce(pool, maxWords);
    if (result.length > best.length) best = result;
    if (best.length >= maxWords) break;
  }

  // Normalise coordinates to start at (0,0).
  let minR = Infinity, minC = Infinity, maxR = -Infinity, maxC = -Infinity;
  best.forEach(p => {
    const endR = p.dir === 'across' ? p.row : p.row + p.word.length - 1;
    const endC = p.dir === 'across' ? p.col + p.word.length - 1 : p.col;
    minR = Math.min(minR, p.row); minC = Math.min(minC, p.col);
    maxR = Math.max(maxR, endR); maxC = Math.max(maxC, endC);
  });
  if (!isFinite(minR)) return { placements: [], rows: 0, cols: 0 };

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

  return { placements: best, rows, cols };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CrosswordGame({ words, onBack }: { words: SavedWord[]; onBack: () => void }) {
  const [seed, setSeed] = useState(0);
  const puzzle = useMemo(() => buildPuzzle(words), [words, seed]); // eslint-disable-line react-hooks/exhaustive-deps
  const { placements, rows, cols } = puzzle;

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
  const [done, setDone] = useState(false);
  const solvedRef = useRef<Set<string>>(new Set());
  const [solvedCount, setSolvedCount] = useState(0);

  // Reset all play state + select the first cell whenever a new puzzle is built.
  useEffect(() => {
    setUser({});
    setHints(0);
    setDone(false);
    solvedRef.current = new Set();
    setSolvedCount(0);
    if (placements.length > 0) {
      const first = placements.find(p => p.dir === 'across') || placements[0];
      setSel({ r: first.row, c: first.col });
      setDir(first.dir);
    }
  }, [placements]);

  const newPuzzle = useCallback(() => setSeed(s => s + 1), []);

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

  const advance = useCallback((from: { r: number; c: number }, back = false) => {
    if (!activeWord) return from;
    const step = back ? -1 : 1;
    let r = from.r + (activeWord.dir === 'down' ? step : 0);
    let c = from.c + (activeWord.dir === 'across' ? step : 0);
    if (isCell(r, c)) return { r, c };
    return from;
  }, [activeWord, isCell]);

  const typeLetter = useCallback((letter: string) => {
    if (!sel || done) return;
    const k = key(sel.r, sel.c);
    setUser(prev => ({ ...prev, [k]: letter.toUpperCase() }));
    setSel(prev => (prev ? advance(prev) : prev));
  }, [sel, done, advance]);

  const backspace = useCallback(() => {
    if (!sel || done) return;
    const k = key(sel.r, sel.c);
    if (user[k]) {
      setUser(prev => { const n = { ...prev }; delete n[k]; return n; });
    } else {
      const prevCell = advance(sel, true);
      const pk = key(prevCell.r, prevCell.c);
      setUser(prev => { const n = { ...prev }; delete n[pk]; return n; });
      setSel(prevCell);
    }
  }, [sel, done, user, advance]);

  const revealCell = useCallback(() => {
    if (!sel || done) return;
    const k = key(sel.r, sel.c);
    const correct = solution.get(k);
    if (!correct) return;
    setUser(prev => ({ ...prev, [k]: correct }));
    setHints(h => h + 1);
    sfx.tap();
    setSel(prev => (prev ? advance(prev) : prev));
  }, [sel, done, solution, advance]);

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
    let newlySolved = false;
    placements.forEach(p => {
      const id = `${p.number}-${p.dir}`;
      if (solvedRef.current.has(id)) return;
      let ok = true;
      for (let i = 0; i < p.word.length; i++) {
        const r = p.dir === 'across' ? p.row : p.row + i;
        const c = p.dir === 'across' ? p.col + i : p.col;
        if (user[key(r, c)] !== p.word[i]) { ok = false; break; }
      }
      if (ok) { solvedRef.current.add(id); newlySolved = true; }
    });
    if (newlySolved) {
      const count = solvedRef.current.size;
      setSolvedCount(count);
      sfx.correct();
      awardXP('game_correct');
      if (count >= placements.length) {
        setDone(true);
        sfx.complete();
        awardXP('game_complete');
      }
    }
  }, [user, placements]);

  if (placements.length < 2) {
    return (
      <div className="max-w-md mx-auto px-4 pt-5 pb-28 animate-fade-in">
        <CwHeader title="Crossword" onBack={onBack} solved={0} total={0} />
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-base font-semibold text-heading mb-2">Couldn&apos;t build a puzzle</div>
          <p className="text-sm text-muted mb-6 max-w-xs">
            Save a few more short words (3–9 letters) with English definitions so they can interlock.
          </p>
          <button onClick={onBack} className="btn-primary px-6 py-2.5 text-sm rounded-xl">← Back to games</button>
        </div>
      </div>
    );
  }

  if (done) {
    const total = placements.length;
    const pct = Math.max(0, Math.round(((total - hints) / total) * 100));
    return (
      <div className="max-w-md mx-auto px-4 pt-10 pb-28 text-center animate-fade-in">
        <div className="text-7xl mb-3 animate-pop-in">{hints === 0 ? '★' : '✓'}</div>
        <h2 className="text-2xl font-black text-heading mb-1">{hints === 0 ? 'Flawless!' : 'Puzzle solved!'}</h2>
        <p className="text-sm text-muted mb-6">Crossword</p>
        <div className="bg-card border border-default rounded-3xl p-6 mb-5 grid grid-cols-3 gap-2">
          {[
            { label: 'Words', val: total, color: 'text-green-400' },
            { label: 'Hints used', val: hints, color: 'text-muted' },
            { label: 'No-hint', val: `${pct}%`, color: 'text-blue-400' },
          ].map(s => (
            <div key={s.label} className="bg-elevated rounded-2xl py-3">
              <div className={`text-xl font-black ${s.color}`}>{s.val}</div>
              <div className="text-xs text-faint">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={onBack}
            className="flex-1 py-3.5 rounded-2xl border border-default text-sm font-medium text-body hover:bg-card transition-colors">
            ← Menu
          </button>
          <button onClick={newPuzzle}
            className="flex-1 btn-primary py-3.5 rounded-2xl text-sm">New puzzle</button>
        </div>
      </div>
    );
  }

  const cellSize = cols <= 7 ? 38 : cols <= 9 ? 33 : cols <= 11 ? 29 : 25;

  const acrossClues = placements.filter(p => p.dir === 'across').sort((a, b) => a.number - b.number);
  const downClues   = placements.filter(p => p.dir === 'down').sort((a, b) => a.number - b.number);
  const isWordSolved = (p: Placement) => solvedRef.current.has(`${p.number}-${p.dir}`);

  return (
    <div className="max-w-md mx-auto px-4 pt-5 pb-28 animate-fade-in">
      <CwHeader title="Crossword" onBack={onBack} solved={solvedCount} total={placements.length} />

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
            const wrong = val && val !== solution.get(k);

            return (
              <button
                key={k}
                onClick={() => selectCell(r, c)}
                style={{ width: cellSize, height: cellSize }}
                className={`relative flex items-center justify-center rounded-[3px] font-bold transition-colors
                  ${isSel ? 'bg-blue-500 text-white ring-2 ring-blue-300'
                    : isActive ? 'bg-blue-500/20 text-heading'
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
        <div className="flex items-center gap-2 bg-card border border-default rounded-xl px-3 py-2.5 mb-3">
          <span className="text-xs font-bold text-blue-500 shrink-0">
            {activeWord.number} {activeWord.dir === 'across' ? '→' : '↓'}
          </span>
          <span className="text-sm text-body flex-1 leading-snug">{activeWord.clue}</span>
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
          💡 Reveal letter
        </button>
        <button onClick={newPuzzle}
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

function CwHeader({ title, onBack, solved, total }: { title: string; onBack: () => void; solved: number; total: number }) {
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
        <div className="flex-1">
          <div className="text-base font-bold text-heading">{title}</div>
          <div className="text-sm text-muted">{solved} / {total} words solved</div>
        </div>
        <div className="flex items-center gap-1.5 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-3 py-1.5">
          <span className="text-sm">⭐</span>
          <span className="text-sm font-bold text-yellow-500">{solved}</span>
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
