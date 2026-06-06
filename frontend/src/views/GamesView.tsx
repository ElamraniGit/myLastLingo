/**
 * GamesView — Educational word games (UX v2).
 *
 * Improvements over v1:
 *  - Menu: difficulty badges, word count per game, best score display
 *  - Spelling Bee: Skip button, better hint, animated result
 *  - Word Scramble: colour-coded letter tiles, auto-submit prevention fixed
 *  - Matching Pairs: improved card reveal animation, pair counter
 *  - GameComplete: richer result screen with accuracy ring + encouragement
 *  - All: consistent back/replay UX, sound effects on every action
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useStore } from '@/store/appStore';
import { useDictionary } from '@/hooks/useDictionary';
import { speak as ttsSpeak } from '@/lib/tts';
import { awardXP } from '@/components/common/XPBar';
import * as sfx from '@/lib/sfx';
import type { SavedWord } from '@/types';
import { SpellingIcon, ScrambleIcon, MatchIcon, TrophyIcon } from '@/components/ui/Icons';

// ── Helpers ───────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function speak(text: string, rate = 0.85) { ttsSpeak(text, { rate }); }

function filterPlayable(words: SavedWord[]): SavedWord[] {
  return words.filter(w =>
    w.word &&
    w.word.length >= 4 &&
    w.word.length <= 20 &&
    w.meaning_en &&
    w.meaning_en.trim().length > 5 &&
    !w.word.includes(' ')
  );
}

// Difficulty label based on word ease_factor
function difficulty(w: SavedWord): 'easy' | 'medium' | 'hard' {
  const ef = w.ease_factor ?? 2.5;
  if (ef >= 2.7) return 'easy';
  if (ef >= 2.0) return 'medium';
  return 'hard';
}

type GameMode = 'menu' | 'spelling' | 'scramble' | 'matching';

// ─────────────────────────────────────────────────────────────────────────────
// MAIN MENU
// ─────────────────────────────────────────────────────────────────────────────

export default function GamesView() {
  const { savedWords, setPage } = useStore();
  const { loadVocabulary } = useDictionary();
  const [game,    setGame]    = useState<GameMode>('menu');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    loadVocabulary({ page: 1, limit: 200 }).finally(() => setLoading(false));
  }, []); // eslint-disable-line

  const playable = filterPlayable(savedWords);
  const hard     = playable.filter(w => difficulty(w) === 'hard').length;

  if (game === 'spelling')  return <SpellingBee  words={playable} onBack={() => setGame('menu')} />;
  if (game === 'scramble')  return <WordScramble  words={playable} onBack={() => setGame('menu')} />;
  if (game === 'matching')  return <MatchingPairs words={playable} onBack={() => setGame('menu')} />;

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-28 lg:pb-8 animate-fade-in">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => setPage('player')}
          className="w-9 h-9 rounded-xl hover:bg-card text-muted hover:text-body flex items-center justify-center transition-colors">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="w-4 h-4">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-heading">Word Games 🎮</h1>
          <p className="text-xs text-muted mt-0.5">
            {playable.length} words · {hard > 0 ? `${hard} need practice` : 'all going well!'}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-28 rounded-2xl"/>)}
        </div>

      ) : playable.length < 4 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-5xl mb-4">📚</div>
          <div className="text-base font-semibold text-heading mb-2">Not enough words yet</div>
          <p className="text-sm text-muted mb-6 max-w-xs">
            You need at least 4 saved words with English definitions to play.
          </p>
          <button onClick={() => setPage('library')} className="btn-primary px-6 py-2.5 text-sm rounded-xl">
            Go to Library
          </button>
        </div>

      ) : (
        <div className="space-y-3">

          {/* Spelling Bee */}
          <GameCard
            EmojiComponent={SpellingIcon}
            title="Spelling Bee"
            desc="Listen to the word, type it correctly"
            xp="+5 XP"
            skill="Spelling"
            color="blue"
            wordCount={Math.min(15, playable.length)}
            onClick={() => setGame('spelling')}
          />

          {/* Word Scramble */}
          <GameCard
            EmojiComponent={ScrambleIcon}
            title="Word Scramble"
            desc="Rearrange the shuffled letters"
            xp="+4 XP"
            skill="Recognition"
            color="green"
            wordCount={Math.min(12, playable.length)}
            onClick={() => setGame('scramble')}
          />

          {/* Matching Pairs */}
          <GameCard
            EmojiComponent={MatchIcon}
            title="Matching Pairs"
            desc="Match words to their definitions"
            xp="+3 XP"
            skill="Vocabulary"
            color="purple"
            wordCount={Math.min(6, Math.floor(playable.length / 2)) * 2}
            onClick={() => setGame('matching')}
          />

          <p className="text-center text-xs text-faint pt-1">
            🧠 All games use YOUR saved words · ⭐ XP counts toward your level
          </p>
        </div>
      )}
    </div>
  );
}

function GameCard({ EmojiComponent, title, desc, xp, skill, color, wordCount, onClick }: {
  EmojiComponent?: React.ComponentType<{className?: string}>; title: string; desc: string; xp: string; skill: string;
  color: 'blue' | 'green' | 'purple'; wordCount: number; onClick: () => void;
}) {
  const colors = {
    blue:   { bg: 'bg-blue-600/15',   hover: 'hover:border-blue-500/30 hover:bg-blue-500/5',   badge: 'bg-blue-500/10 text-blue-500'   },
    green:  { bg: 'bg-green-600/15',  hover: 'hover:border-green-500/30 hover:bg-green-500/5',  badge: 'bg-green-500/10 text-green-500'  },
    purple: { bg: 'bg-purple-600/15', hover: 'hover:border-purple-500/30 hover:bg-purple-500/5', badge: 'bg-purple-500/10 text-purple-500' },
  }[color];

  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-4 bg-card border border-default rounded-2xl p-5 ${colors.hover} active:scale-[0.98] transition-all text-left group`}>
      <div className={`w-14 h-14 rounded-2xl ${colors.bg} group-hover:scale-105 flex items-center justify-center shrink-0 transition-transform`}>
        {EmojiComponent ? <EmojiComponent className="w-7 h-7" /> : null}
      </div>
      <div className="flex-1">
        <div className="text-base font-bold text-heading">{title}</div>
        <div className="text-sm text-muted mt-0.5">{desc}</div>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${colors.badge}`}>{xp} correct</span>
          <span className="text-[10px] text-faint">{skill}</span>
          <span className="text-[10px] text-faint ml-auto">{wordCount} words</span>
        </div>
      </div>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
        className="w-5 h-5 text-faint group-hover:translate-x-0.5 transition-transform shrink-0">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GAME 1 — SPELLING BEE
// ─────────────────────────────────────────────────────────────────────────────

function SpellingBee({ words, onBack }: { words: SavedWord[]; onBack: () => void }) {
  const pool     = React.useMemo(() => shuffle(words).slice(0, 15), []); // eslint-disable-line
  const [idx,       setIdx]       = useState(0);
  const [input,     setInput]     = useState('');
  const [result,    setResult]    = useState<'correct' | 'wrong' | null>(null);
  const [score,     setScore]     = useState(0);
  const [done,      setDone]      = useState(false);
  const [showHint,  setShowHint]  = useState(false);
  const [skipped,   setSkipped]   = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const current = pool[idx];
  const total   = pool.length;

  const playWord = useCallback(() => { if (current) speak(current.word, 0.75); }, [current]);
  useEffect(() => { if (current) { setShowHint(false); setTimeout(playWord, 300); } }, [idx]); // eslint-disable-line

  const submit = useCallback(() => {
    if (!input.trim() || result) return;
    const ok = input.trim().toLowerCase() === current.word.toLowerCase();
    setResult(ok ? 'correct' : 'wrong');
    if (ok) { sfx.correct(); setScore(s => s + 1); awardXP('review_perfect'); }
    else    { sfx.wrong(); }
  }, [input, result, current]);

  const next = useCallback((skipping = false) => {
    if (skipping) { sfx.tap(); setSkipped(s => s + 1); }
    setInput(''); setResult(null); setShowHint(false);
    if (idx + 1 >= total) { sfx.complete(); setDone(true); return; }
    setIdx(i => i + 1);
    setTimeout(() => inputRef.current?.focus(), 300);
  }, [idx, total]);

  if (done) return <GameComplete score={score} total={total} skipped={skipped}
    game="Spelling Bee 🔤" onBack={onBack}
    onReplay={() => { setIdx(0); setScore(0); setDone(false); setSkipped(0); setInput(''); setResult(null); }} />;

  return (
    <div className="max-w-md mx-auto px-4 pt-5 pb-28 animate-fade-in">
      <GameHeader title="Spelling Bee 🔤" onBack={onBack} score={score} idx={idx} total={total} />

      <div className="bg-card border border-default rounded-3xl p-6 mt-4 text-center space-y-4">

        {/* Definition */}
        {current.meaning_en && (
          <div className="bg-elevated/60 rounded-2xl px-4 py-3 text-sm text-body italic leading-relaxed">
            "{current.meaning_en}"
          </div>
        )}

        {/* Listen button */}
        <button onClick={playWord}
          className="w-20 h-20 rounded-full bg-blue-600/15 hover:bg-blue-600/25 text-blue-500
                     flex items-center justify-center text-4xl mx-auto transition-all active:scale-95">
          🔊
        </button>
        <p className="text-xs text-faint">Tap to hear the word</p>

        {/* Hint */}
        {!showHint ? (
          <button onClick={() => setShowHint(true)} className="text-xs text-muted hover:text-body underline">
            Show first letter
          </button>
        ) : (
          <div className="flex items-center justify-center gap-1.5">
            {current.word.split('').map((ch, i) => (
              <div key={i} className={`w-8 h-8 rounded-lg border text-sm font-bold flex items-center justify-center ${
                i === 0 ? 'border-blue-500 bg-blue-500/15 text-blue-400' : 'border-default text-faint'
              }`}>
                {i === 0 ? ch.toUpperCase() : '·'}
              </div>
            ))}
          </div>
        )}

        {/* Input */}
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') result ? next() : submit(); }}
          placeholder="Type the word…"
          disabled={!!result}
          autoCapitalize="none"
          spellCheck={false}
          className={`input-field text-center text-lg font-semibold tracking-wider transition-all ${
            result === 'correct' ? 'border-green-500/50 bg-green-500/5 text-green-400' :
            result === 'wrong'   ? 'border-red-500/50 bg-red-500/5 text-red-400' : ''
          }`}
        />

        {/* Result */}
        {result && (
          <div className={`rounded-2xl px-4 py-3 animate-fade-in ${
            result === 'correct' ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'
          }`}>
            <p className={`font-semibold text-sm ${result === 'correct' ? 'text-green-400' : 'text-red-400'}`}>
              {result === 'correct' ? '✅ Correct! +5 XP' : `❌ The word was: "${current.word}"`}
            </p>
          </div>
        )}

        {/* Buttons */}
        {!result ? (
          <div className="flex gap-2">
            <button onClick={() => next(true)} className="py-3 px-4 rounded-2xl border border-default text-sm text-muted hover:bg-card transition-colors">
              Skip →
            </button>
            <button onClick={submit} disabled={!input.trim()} className="btn-primary flex-1 py-3 rounded-2xl text-sm">
              Check ✓
            </button>
          </div>
        ) : (
          <button onClick={() => next()} className="btn-primary w-full py-3 rounded-2xl text-sm">
            {idx + 1 >= total ? '🎉 See Results' : 'Next →'}
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GAME 2 — WORD SCRAMBLE
// ─────────────────────────────────────────────────────────────────────────────

const LETTER_COLORS = [
  'border-blue-500/60 bg-blue-500/15 text-blue-300',
  'border-green-500/60 bg-green-500/15 text-green-300',
  'border-purple-500/60 bg-purple-500/15 text-purple-300',
  'border-orange-500/60 bg-orange-500/15 text-orange-300',
  'border-pink-500/60 bg-pink-500/15 text-pink-300',
  'border-cyan-500/60 bg-cyan-500/15 text-cyan-300',
];

function WordScramble({ words, onBack }: { words: SavedWord[]; onBack: () => void }) {
  const pool     = React.useMemo(() => shuffle(words).slice(0, 12), []); // eslint-disable-line
  const [idx,     setIdx]     = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [result,  setResult]  = useState<'correct' | 'wrong' | null>(null);
  const [score,   setScore]   = useState(0);
  const [done,    setDone]    = useState(false);
  const [letters, setLetters] = useState<string[]>([]);
  const [skipped, setSkipped] = useState(0);

  const current = pool[idx];
  const total   = pool.length;

  const initLetters = useCallback((word: string) => {
    let s = shuffle(word.split(''));
    let t = 0;
    while (s.join('') === word && t++ < 20) s = shuffle(s);
    setLetters(s);
    setSelected([]);
    setResult(null);
  }, []);

  useEffect(() => { if (current) initLetters(current.word); }, [idx, current]); // eslint-disable-line

  const tapLetter = (i: number) => {
    if (result || selected.includes(i)) return;
    const next = [...selected, i];
    setSelected(next);
    sfx.tap();
    if (next.length === current.word.length && current.word.length >= 2) {
      const formed = next.map(j => letters[j]).join('');
      const ok = formed.toLowerCase() === current.word.toLowerCase();
      setTimeout(() => {
        setResult(ok ? 'correct' : 'wrong');
        if (ok) { sfx.correct(); setScore(s => s + 1); awardXP('review_word'); }
        else    { sfx.wrong(); }
      }, 150);
    }
  };

  const removeLast = () => { if (!result && selected.length > 0) setSelected(s => s.slice(0, -1)); };

  const next = useCallback((skipping = false) => {
    if (skipping) { sfx.tap(); setSkipped(s => s + 1); }
    if (idx + 1 >= total) { sfx.complete(); setDone(true); return; }
    setIdx(i => i + 1);
  }, [idx, total]);

  if (done) return <GameComplete score={score} total={total} skipped={skipped}
    game="Word Scramble 🔀" onBack={onBack}
    onReplay={() => { setIdx(0); setScore(0); setDone(false); setSkipped(0); initLetters(pool[0]?.word || 'test'); }} />;

  const formed = selected.map(i => letters[i]).join('');

  return (
    <div className="max-w-md mx-auto px-4 pt-5 pb-28 animate-fade-in">
      <GameHeader title="Word Scramble 🔀" onBack={onBack} score={score} idx={idx} total={total} />

      <div className="bg-card border border-default rounded-3xl p-6 mt-4 space-y-4">

        {/* Definition */}
        {current.meaning_en && (
          <div className="text-center">
            <p className="text-[10px] text-muted uppercase tracking-wider mb-1.5">What word means…</p>
            <p className="text-sm text-heading font-medium leading-relaxed">"{current.meaning_en}"</p>
            {current.meaning_ar && (
              <p className="text-xs text-muted mt-1" style={{ direction: 'rtl', fontFamily: "'Segoe UI','Noto Sans Arabic',sans-serif" }}>
                {current.meaning_ar}
              </p>
            )}
          </div>
        )}

        {/* Formed word slots */}
        <div className="flex justify-center gap-2 flex-wrap min-h-[44px]">
          {current.word.split('').map((_, i) => {
            const letter = selected[i] !== undefined ? letters[selected[i]] : '';
            const colorIdx = selected[i] !== undefined ? selected[i] % LETTER_COLORS.length : 0;
            return (
              <div key={i} className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center text-base font-black uppercase transition-all ${
                letter
                  ? result === 'correct' ? 'border-green-500 bg-green-500/15 text-green-300'
                  : result === 'wrong'   ? 'border-red-500 bg-red-500/15 text-red-300'
                  : LETTER_COLORS[colorIdx]
                  : 'border-default/50 text-faint'
              }`}>
                {letter.toUpperCase()}
              </div>
            );
          })}
        </div>

        {/* Result */}
        {result && (
          <div className={`rounded-2xl px-4 py-3 text-center animate-fade-in ${
            result === 'correct' ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'
          }`}>
            <p className={`font-semibold text-sm ${result === 'correct' ? 'text-green-400' : 'text-red-400'}`}>
              {result === 'correct' ? `✅ "${current.word}" — Correct! +4 XP` : `❌ The answer was: "${current.word}"`}
            </p>
          </div>
        )}

        {/* Scrambled letters */}
        {!result && (
          <div className="flex flex-wrap justify-center gap-2">
            {letters.map((ch, i) => {
              const used = selected.includes(i);
              const colorIdx = i % LETTER_COLORS.length;
              return (
                <button key={i} onClick={() => tapLetter(i)} disabled={used}
                  className={`w-12 h-12 rounded-xl border-2 text-base font-black uppercase transition-all active:scale-90 ${
                    used ? 'border-default/20 bg-elevated/20 text-faint/30 cursor-not-allowed'
                         : `${LETTER_COLORS[colorIdx]} hover:scale-105`
                  }`}>
                  {ch.toUpperCase()}
                </button>
              );
            })}
          </div>
        )}

        {/* Controls */}
        {!result ? (
          <div className="flex gap-2">
            <button onClick={removeLast} disabled={!selected.length}
              className="flex-1 py-2.5 rounded-2xl border border-default text-sm text-body hover:bg-card transition-colors disabled:opacity-30">
              ⌫ Remove
            </button>
            <button onClick={() => initLetters(current.word)}
              className="flex-1 py-2.5 rounded-2xl border border-default text-sm text-body hover:bg-card transition-colors">
              🔄 Shuffle
            </button>
            <button onClick={() => next(true)}
              className="py-2.5 px-3 rounded-2xl border border-default text-sm text-muted hover:bg-card transition-colors">
              Skip
            </button>
          </div>
        ) : (
          <button onClick={() => next()} className="btn-primary w-full py-3 rounded-2xl text-sm">
            {idx + 1 >= total ? '🎉 See Results' : 'Next →'}
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GAME 3 — MATCHING PAIRS
// ─────────────────────────────────────────────────────────────────────────────

interface MatchCard { id: string; type: 'word' | 'def'; text: string; pairId: string; }

function MatchingPairs({ words, onBack }: { words: SavedWord[]; onBack: () => void }) {
  const COUNT = 6;
  const [roundWords, setRoundWords] = useState<SavedWord[]>([]);
  const [cards,   setCards]   = useState<MatchCard[]>([]);
  const [flipped, setFlipped] = useState<string[]>([]);
  const [matched, setMatched] = useState<string[]>([]);
  const [wrong,   setWrong]   = useState<string[]>([]);
  const [score,   setScore]   = useState(0);
  const [moves,   setMoves]   = useState(0);
  const [done,    setDone]    = useState(false);
  const busy = useRef(false);

  const init = useCallback((wordList: SavedWord[]) => {
    const chosen = shuffle(wordList.filter(w => w.meaning_en)).slice(0, COUNT);
    setRoundWords(chosen);
    const deck: MatchCard[] = [];
    chosen.forEach(w => {
      deck.push({ id: `w_${w.id}`, type: 'word', text: w.word,       pairId: w.id });
      deck.push({ id: `d_${w.id}`, type: 'def',  text: w.meaning_en!, pairId: w.id });
    });
    setCards(shuffle(deck));
    setFlipped([]); setMatched([]); setWrong([]);
    setScore(0); setMoves(0); setDone(false);
    busy.current = false;
  }, []);

  useEffect(() => { init(words); }, []); // eslint-disable-line

  const tap = useCallback((id: string) => {
    if (busy.current || matched.includes(id) || flipped.includes(id)) return;
    const next = [...flipped, id];
    setFlipped(next);
    sfx.tap();

    if (next.length === 2) {
      busy.current = true;
      setMoves(m => m + 1);
      const [a, b] = next.map(i => cards.find(c => c.id === i)!);
      if (a.pairId === b.pairId) {
        sfx.correct();
        const newMatched = [...matched, a.id, b.id];
        setMatched(newMatched);
        setScore(s => s + 1);
        awardXP('review_word');
        setFlipped([]);
        busy.current = false;
        if (newMatched.length === cards.length) { sfx.complete(); setDone(true); }
      } else {
        sfx.wrong();
        setWrong([a.id, b.id]);
        setTimeout(() => { setFlipped([]); setWrong([]); busy.current = false; }, 800);
      }
    }
  }, [flipped, matched, cards]);

  if (done) return (
    <GameComplete score={score} total={roundWords.length}
      game="Matching Pairs 🎴" subtitle={`${moves} move${moves !== 1 ? 's' : ''}`}
      onBack={onBack} onReplay={() => init(words)} />
  );

  const pairsLeft = roundWords.length - matched.length / 2;

  return (
    <div className="max-w-md mx-auto px-4 pt-5 pb-28 animate-fade-in">
      <GameHeader title="Matching Pairs 🎴" onBack={onBack} score={score} idx={matched.length / 2} total={roundWords.length} />

      {/* Status row */}
      <div className="flex items-center justify-between mt-2 mb-4 text-xs text-muted px-1">
        <span>Tap word → then its definition</span>
        <span className="font-semibold text-heading">{pairsLeft} pair{pairsLeft !== 1 ? 's' : ''} left</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {cards.map(card => {
          const isFlipped  = flipped.includes(card.id);
          const isMatched  = matched.includes(card.id);
          const isWrong    = wrong.includes(card.id);
          const isHidden   = !isFlipped && !isMatched && !isWrong;

          return (
            <button key={card.id} onClick={() => tap(card.id)} disabled={isMatched}
              className={`rounded-2xl p-3.5 text-left min-h-[76px] flex items-center justify-center border-2 transition-all active:scale-95 ${
                isMatched ? 'border-green-500/40 bg-green-500/10 cursor-default scale-95 opacity-75'
                : isWrong  ? 'border-red-500/40 bg-red-500/10'
                : isFlipped ? 'border-blue-500/60 bg-blue-600/15'
                : card.type === 'word'
                  ? 'border-blue-500/30 bg-blue-500/8 hover:border-blue-500/50 hover:bg-blue-500/12'
                  : 'border-purple-500/30 bg-purple-500/8 hover:border-purple-500/50 hover:bg-purple-500/12'
              }`}>
              {isHidden ? (
                <span className="text-3xl opacity-40 mx-auto">
                  {card.type === 'word' ? '?' : '···'}
                </span>
              ) : (
                <span className={`${card.type === 'word' ? 'text-sm font-bold text-center w-full' : 'text-xs leading-relaxed line-clamp-4'} ${
                  isMatched ? 'text-green-400' : isWrong ? 'text-red-400' : isFlipped ? 'text-blue-300' : 'text-heading'
                }`}>
                  {card.text}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="text-center mt-4 text-xs text-faint">
        {matched.length / 2} / {roundWords.length} matched · {moves} moves
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function GameHeader({ title, onBack, score, idx, total }: {
  title: string; onBack: () => void; score: number; idx: number; total: number;
}) {
  const pct = total > 0 ? Math.round((idx / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <button onClick={onBack}
          className="w-9 h-9 rounded-xl hover:bg-card text-muted hover:text-body flex items-center justify-center transition-colors">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="w-4 h-4">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <div className="flex-1">
          <div className="text-base font-bold text-heading">{title}</div>
          <div className="text-xs text-muted">{idx} / {total} words</div>
        </div>
        <div className="flex items-center gap-1.5 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-3 py-1.5">
          <span className="text-sm">⭐</span>
          <span className="text-sm font-bold text-yellow-500">{score}</span>
        </div>
      </div>
      <div className="h-2 bg-elevated rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function GameComplete({ score, total, game, subtitle, skipped = 0, onBack, onReplay }: {
  score: number; total: number; game: string; subtitle?: string;
  skipped?: number; onBack: () => void; onReplay: () => void;
}) {
  const attempted = total - skipped;
  const pct = attempted > 0 ? Math.round((score / attempted) * 100) : 0;
  const emoji  = pct === 100 ? '🏆' : pct >= 80 ? '🎉' : pct >= 60 ? '👍' : pct >= 40 ? '💪' : '📚';
  const msg    = pct === 100 ? 'Perfect score!' : pct >= 80 ? 'Great job!' : pct >= 60 ? 'Well done!' : pct >= 40 ? 'Keep it up!' : 'Keep practising!';
  const xpEarned = score * 4;
  const ringColor = pct === 100 ? '#facc15' : pct >= 70 ? '#22c55e' : pct >= 40 ? '#3b82f6' : '#ef4444';

  useEffect(() => { sfx.complete(); }, []);

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-28 text-center animate-fade-in">

      {/* Result emoji */}
      <div className="text-7xl mb-3 animate-pop-in">{emoji}</div>
      <h2 className="text-2xl font-black text-heading mb-1">{msg}</h2>
      <p className="text-sm text-muted mb-1">{game}</p>
      {subtitle && <p className="text-xs text-faint mb-5">{subtitle}</p>}

      {/* Score card */}
      <div className="bg-card border border-default rounded-3xl p-6 mb-5 space-y-4">

        {/* Accuracy ring */}
        <div className="flex items-center justify-center">
          <div className="relative w-28 h-28">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r="40" fill="none" stroke="rgb(var(--bg-elevated))" strokeWidth="10"/>
              <circle cx="50" cy="50" r="40" fill="none" stroke={ringColor} strokeWidth="10"
                strokeDasharray={`${2 * Math.PI * 40}`}
                strokeDashoffset={`${2 * Math.PI * 40 * (1 - pct / 100)}`}
                strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease' }}/>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-black text-heading">{pct}%</span>
              <span className="text-[10px] text-faint">accuracy</span>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Correct',  val: score,    color: 'text-green-400' },
            { label: 'Wrong',    val: attempted - score, color: 'text-red-400' },
            { label: 'Skipped',  val: skipped,  color: 'text-muted' },
          ].map(s => (
            <div key={s.label} className="bg-elevated rounded-2xl py-3 text-center">
              <div className={`text-xl font-black ${s.color}`}>{s.val}</div>
              <div className="text-[10px] text-faint">{s.label}</div>
            </div>
          ))}
        </div>

        {/* XP earned */}
        <div className="flex items-center justify-center gap-2 text-sm">
          <span className="text-yellow-400">⭐</span>
          <span className="font-semibold text-heading">{xpEarned}+ XP earned this session</span>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-3">
        <button onClick={onBack}
          className="flex-1 py-3.5 rounded-2xl border border-default text-sm font-medium text-body hover:bg-card transition-colors">
          ← Menu
        </button>
        <button onClick={onReplay}
          className="flex-1 btn-primary py-3.5 rounded-2xl text-sm">
          🔄 Play Again
        </button>
      </div>
    </div>
  );
}
