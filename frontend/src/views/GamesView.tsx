/**
 * GamesView — Educational word games using the user's saved vocabulary.
 *
 * 3 games:
 *  🔤 Spelling Bee  — Listen to the word, type it letter by letter
 *  🔀 Word Scramble — Unscramble shuffled letters to form the word
 *  🎴 Matching Pairs — Match words to their English definitions
 *
 * All games use the user's own saved vocabulary words.
 * XP awarded on correct answers. Sound effects on correct/wrong.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useStore } from '@/store/appStore';
import { useDictionary } from '@/hooks/useDictionary';
import { speak as ttsSpeak } from '@/lib/tts';
import { awardXP } from '@/components/common/XPBar';
import * as sfx from '@/lib/sfx';
import type { SavedWord } from '@/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function speak(text: string, rate = 0.85) {
  ttsSpeak(text, { rate });
}

// Filter words that have enough data for games
function filterPlayable(words: SavedWord[]): SavedWord[] {
  return words.filter(w =>
    w.word &&
    w.word.length >= 4 &&           // min 4 chars so scramble is meaningful
    w.word.length <= 20 &&          // max 20 chars so it fits on screen
    w.meaning_en &&
    w.meaning_en.trim().length > 5 &&
    !w.word.includes(' ')           // no spaces — single word only
  );
}

// ── Game type ─────────────────────────────────────────────────────────────────

type GameMode = 'menu' | 'spelling' | 'scramble' | 'matching';

// ═════════════════════════════════════════════════════════════════════════════
// MAIN VIEW
// ═════════════════════════════════════════════════════════════════════════════

export default function GamesView() {
  const { savedWords, setPage } = useStore();
  const { loadVocabulary } = useDictionary();
  const [game, setGame] = useState<GameMode>('menu');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Always load fresh vocabulary when entering games
    setLoading(true);
    loadVocabulary({ page: 1, limit: 200 }).finally(() => setLoading(false));
  }, []); // eslint-disable-line

  const playable = filterPlayable(savedWords);

  if (game === 'spelling')  return <SpellingBee words={playable} onBack={() => setGame('menu')} />;
  if (game === 'scramble')  return <WordScramble words={playable} onBack={() => setGame('menu')} />;
  if (game === 'matching')  return <MatchingPairs words={playable} onBack={() => setGame('menu')} />;

  // ── Menu ──────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-28 lg:pb-8 animate-fade-in">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => setPage('player')}
          className="w-9 h-9 rounded-xl hover:bg-card text-muted hover:text-body flex items-center justify-center transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="w-4 h-4">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-heading">Word Games 🎮</h1>
          <p className="text-xs text-muted mt-0.5">
            {playable.length} words available · earn XP on every correct answer
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
            Save at least 4 words from videos or texts to start playing games.
          </p>
          <button onClick={() => setPage('library')} className="btn-primary px-6 py-2.5 text-sm rounded-xl">
            Go to Library
          </button>
        </div>
      ) : (
        <div className="space-y-3">

          {/* Spelling Bee */}
          <button
            onClick={() => setGame('spelling')}
            className="w-full flex items-center gap-4 bg-card border border-default rounded-2xl p-5
                       hover:border-blue-500/30 hover:bg-blue-500/5 active:scale-[0.98] transition-all text-left group"
          >
            <div className="w-14 h-14 rounded-2xl bg-blue-600/15 group-hover:bg-blue-600/20 flex items-center justify-center text-3xl shrink-0 transition-colors">
              🔤
            </div>
            <div className="flex-1">
              <div className="text-base font-bold text-heading">Spelling Bee</div>
              <div className="text-sm text-muted mt-0.5">Listen to the word, type it correctly</div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded-full font-medium">+5 XP correct</span>
                <span className="text-[10px] text-faint">Tests spelling</span>
              </div>
            </div>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-5 h-5 text-faint group-hover:translate-x-0.5 transition-transform shrink-0">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>

          {/* Word Scramble */}
          <button
            onClick={() => setGame('scramble')}
            className="w-full flex items-center gap-4 bg-card border border-default rounded-2xl p-5
                       hover:border-green-500/30 hover:bg-green-500/5 active:scale-[0.98] transition-all text-left group"
          >
            <div className="w-14 h-14 rounded-2xl bg-green-600/15 group-hover:bg-green-600/20 flex items-center justify-center text-3xl shrink-0 transition-colors">
              🔀
            </div>
            <div className="flex-1">
              <div className="text-base font-bold text-heading">Word Scramble</div>
              <div className="text-sm text-muted mt-0.5">Unscramble the shuffled letters</div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full font-medium">+4 XP correct</span>
                <span className="text-[10px] text-faint">Tests recognition</span>
              </div>
            </div>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-5 h-5 text-faint group-hover:translate-x-0.5 transition-transform shrink-0">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>

          {/* Matching Pairs */}
          <button
            onClick={() => setGame('matching')}
            className="w-full flex items-center gap-4 bg-card border border-default rounded-2xl p-5
                       hover:border-purple-500/30 hover:bg-purple-500/5 active:scale-[0.98] transition-all text-left group"
          >
            <div className="w-14 h-14 rounded-2xl bg-purple-600/15 group-hover:bg-purple-600/20 flex items-center justify-center text-3xl shrink-0 transition-colors">
              🎴
            </div>
            <div className="flex-1">
              <div className="text-base font-bold text-heading">Matching Pairs</div>
              <div className="text-sm text-muted mt-0.5">Match words to their definitions</div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] bg-purple-500/10 text-purple-500 px-2 py-0.5 rounded-full font-medium">+3 XP per match</span>
                <span className="text-[10px] text-faint">Tests vocabulary</span>
              </div>
            </div>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-5 h-5 text-faint group-hover:translate-x-0.5 transition-transform shrink-0">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>

          {/* Stats pill */}
          <div className="flex items-center justify-center gap-6 py-3 text-xs text-faint">
            <span>🧠 All games use YOUR saved words</span>
            <span>·</span>
            <span>⭐ XP counts toward your level</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// GAME 1 — SPELLING BEE
// ═════════════════════════════════════════════════════════════════════════════

function SpellingBee({ words, onBack }: { words: SavedWord[]; onBack: () => void }) {
  const pool = React.useMemo(() => shuffle(words).slice(0, 15), []); // eslint-disable-line
  const [idx,        setIdx]        = useState(0);
  const [input,      setInput]      = useState('');
  const [result,     setResult]     = useState<'correct' | 'wrong' | null>(null);
  const [score,      setScore]      = useState(0);
  const [done,       setDone]       = useState(false);
  const [attempts,   setAttempts]   = useState(0);
  const [showHint,   setShowHint]   = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const current = pool[idx];
  const total   = pool.length;

  const playWord = useCallback(() => {
    if (current) speak(current.word, 0.75);
  }, [current]);

  useEffect(() => {
    if (current) setTimeout(playWord, 400);
  }, [idx]); // eslint-disable-line

  const submit = useCallback(() => {
    if (!input.trim() || result) return;
    const isCorrect = input.trim().toLowerCase() === current.word.toLowerCase();
    setResult(isCorrect ? 'correct' : 'wrong');
    setAttempts(a => a + 1);
    if (isCorrect) {
      sfx.correct(); setScore(s => s + 1); awardXP('review_perfect');
    } else {
      sfx.wrong();
    }
  }, [input, result, current]);

  const next = useCallback(() => {
    setInput(''); setResult(null); setShowHint(false);
    if (idx + 1 >= total) { setDone(true); return; }
    setIdx(i => i + 1);
    setTimeout(() => inputRef.current?.focus(), 300);
  }, [idx, total]);

  if (done) return <GameComplete score={score} total={total} game="Spelling Bee 🔤" onBack={onBack} onReplay={() => { setIdx(0); setScore(0); setDone(false); setInput(''); setResult(null); }} />;

  return (
    <div className="max-w-md mx-auto px-4 pt-5 pb-28 animate-fade-in">
      <GameHeader title="Spelling Bee 🔤" onBack={onBack} score={score} idx={idx} total={total} />

      <div className="bg-card border border-default rounded-3xl p-6 mt-4 text-center space-y-5">

        {/* Instruction */}
        <p className="text-sm text-muted">Listen carefully and type the word</p>

        {/* Definition hint */}
        {current.meaning_en && (
          <div className="bg-elevated/50 rounded-2xl px-4 py-3 text-sm text-body italic">
            "{current.meaning_en}"
          </div>
        )}

        {/* Listen button */}
        <button
          onClick={playWord}
          className="w-20 h-20 rounded-full bg-blue-600/15 hover:bg-blue-600/25 text-blue-500
                     flex items-center justify-center text-4xl mx-auto transition-all active:scale-95"
        >
          🔊
        </button>
        <p className="text-xs text-faint">Tap to hear again</p>

        {/* Hint toggle */}
        {!showHint ? (
          <button onClick={() => setShowHint(true)} className="text-xs text-muted hover:text-body underline">
            Show first letter hint
          </button>
        ) : (
          <div className="flex items-center justify-center gap-1">
            {current.word.split('').map((ch, i) => (
              <div key={i} className={`w-8 h-8 rounded-lg border text-sm font-bold flex items-center justify-center
                ${i === 0 ? 'border-blue-500/50 bg-blue-500/10 text-blue-400' : 'border-default text-faint'}`}>
                {i === 0 ? ch.toUpperCase() : '_'}
              </div>
            ))}
          </div>
        )}

        {/* Input */}
        <div>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') result ? next() : submit(); }}
            placeholder="Type the word here…"
            disabled={!!result}
            autoCapitalize="none"
            spellCheck={false}
            className={`input-field text-center text-lg font-semibold tracking-widest transition-all ${
              result === 'correct' ? 'border-green-500/50 bg-green-500/5 text-green-400' :
              result === 'wrong'   ? 'border-red-500/50 bg-red-500/5 text-red-400' : ''
            }`}
          />
        </div>

        {/* Result */}
        {result && (
          <div className={`rounded-2xl px-4 py-3 animate-fade-in ${
            result === 'correct' ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'
          }`}>
            <p className={`font-semibold text-sm ${result === 'correct' ? 'text-green-400' : 'text-red-400'}`}>
              {result === 'correct' ? '✅ Correct! +5 XP' : `❌ The word was: "${current.word}"`}
            </p>
            {result === 'wrong' && current.meaning_en && (
              <p className="text-xs text-muted mt-1">{current.meaning_en}</p>
            )}
          </div>
        )}

        {/* Buttons */}
        {!result ? (
          <button onClick={submit} disabled={!input.trim()} className="btn-primary w-full py-3 rounded-2xl text-sm">
            Check Spelling
          </button>
        ) : (
          <button onClick={next} className="btn-primary w-full py-3 rounded-2xl text-sm">
            {idx + 1 >= total ? '🎉 See Results' : 'Next Word →'}
          </button>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// GAME 2 — WORD SCRAMBLE
// ═════════════════════════════════════════════════════════════════════════════

function WordScramble({ words, onBack }: { words: SavedWord[]; onBack: () => void }) {
  const pool = React.useMemo(() => shuffle(words).slice(0, 12), []); // eslint-disable-line
  const [idx,      setIdx]      = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [result,   setResult]   = useState<'correct' | 'wrong' | null>(null);
  const [score,    setScore]    = useState(0);
  const [done,     setDone]     = useState(false);
  const [letters,  setLetters]  = useState<string[]>([]);

  const current = pool[idx];
  const total   = pool.length;

  const initLetters = useCallback((word: string) => {
    let scrambled = shuffle(word.split(''));
    // Ensure it's actually scrambled
    let tries = 0;
    while (scrambled.join('') === word && tries < 10) {
      scrambled = shuffle(scrambled); tries++;
    }
    setLetters(scrambled);
    setSelected([]);
    setResult(null);
  }, []);

  useEffect(() => {
    if (current) initLetters(current.word);
  }, [idx, current]); // eslint-disable-line

  const formed = selected.map(i => letters[i]).join('');

  const tapLetter = (i: number) => {
    if (result || selected.includes(i)) return;
    const next = [...selected, i];
    setSelected(next);
    sfx.tap();
    // Only check answer when ALL letters are placed
    if (next.length === current.word.length && current.word.length >= 2) {
      const formed = next.map(j => letters[j]).join('');
      const ok = formed.toLowerCase() === current.word.toLowerCase();
      // Small delay so user sees the last letter placed before result shows
      setTimeout(() => {
        setResult(ok ? 'correct' : 'wrong');
        if (ok) { sfx.correct(); setScore(s => s + 1); awardXP('review_word'); }
        else    { sfx.wrong(); }
      }, 150);
    }
  };

  const removeLast = () => {
    if (!result && selected.length > 0) setSelected(s => s.slice(0, -1));
  };

  const next = useCallback(() => {
    if (idx + 1 >= total) { setDone(true); return; }
    setIdx(i => i + 1);
  }, [idx, total]);

  if (done) return <GameComplete score={score} total={total} game="Word Scramble 🔀" onBack={onBack} onReplay={() => { setIdx(0); setScore(0); setDone(false); }} />;

  return (
    <div className="max-w-md mx-auto px-4 pt-5 pb-28 animate-fade-in">
      <GameHeader title="Word Scramble 🔀" onBack={onBack} score={score} idx={idx} total={total} />

      <div className="bg-card border border-default rounded-3xl p-6 mt-4 space-y-5">

        {/* Definition */}
        {current.meaning_en && (
          <div className="text-center">
            <p className="text-xs text-muted uppercase tracking-wider mb-2">What word means…</p>
            <p className="text-base text-heading font-medium leading-relaxed">"{current.meaning_en}"</p>
            {current.meaning_ar && (
              <p className="text-sm text-muted mt-1" style={{ direction: 'rtl', fontFamily: "'Segoe UI', 'Noto Sans Arabic', sans-serif" }}>
                {current.meaning_ar}
              </p>
            )}
          </div>
        )}

        {/* Formed word slots */}
        <div className="flex justify-center gap-2 flex-wrap min-h-[48px]">
          {current.word.split('').map((_, i) => {
            const letter = selected[i] !== undefined ? letters[selected[i]] : '';
            return (
              <div key={i} className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center text-lg font-bold uppercase transition-all ${
                letter
                  ? result === 'correct' ? 'border-green-500 bg-green-500/10 text-green-400'
                  : result === 'wrong'   ? 'border-red-500 bg-red-500/10 text-red-400'
                  : 'border-blue-500 bg-blue-500/10 text-blue-400'
                  : 'border-default text-faint'
              }`}>
                {letter.toUpperCase()}
              </div>
            );
          })}
        </div>

        {/* Result message */}
        {result && (
          <div className={`rounded-2xl px-4 py-3 text-center animate-fade-in ${
            result === 'correct' ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'
          }`}>
            <p className={`font-semibold text-sm ${result === 'correct' ? 'text-green-400' : 'text-red-400'}`}>
              {result === 'correct' ? '✅ Correct! +4 XP' : `❌ The word was: "${current.word}"`}
            </p>
          </div>
        )}

        {/* Scrambled letters */}
        {!result && (
          <div className="flex flex-wrap justify-center gap-2">
            {letters.map((ch, i) => {
              const used = selected.includes(i);
              return (
                <button key={i} onClick={() => tapLetter(i)} disabled={used}
                  className={`w-11 h-11 rounded-xl border-2 text-lg font-bold uppercase transition-all active:scale-90 ${
                    used
                      ? 'border-default/30 bg-elevated/30 text-faint cursor-not-allowed'
                      : 'border-default bg-card text-heading hover:border-blue-500/50 hover:bg-blue-500/5'
                  }`}>
                  {ch.toUpperCase()}
                </button>
              );
            })}
          </div>
        )}

        {/* Controls */}
        <div className="flex gap-2">
          {!result ? (
            <>
              <button onClick={removeLast} disabled={!selected.length}
                className="flex-1 py-2.5 rounded-2xl border border-default text-sm text-body hover:bg-card transition-colors disabled:opacity-40">
                ⌫ Remove
              </button>
              <button onClick={() => initLetters(current.word)}
                className="flex-1 py-2.5 rounded-2xl border border-default text-sm text-body hover:bg-card transition-colors">
                🔄 Shuffle
              </button>
            </>
          ) : (
            <button onClick={next} className="btn-primary w-full py-3 rounded-2xl text-sm">
              {idx + 1 >= total ? '🎉 See Results' : 'Next Word →'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// GAME 3 — MATCHING PAIRS
// ═════════════════════════════════════════════════════════════════════════════

interface MatchCard {
  id:    string;
  type:  'word' | 'def';
  text:  string;
  pairId: string;   // same for word+def of the same entry
}

function MatchingPairs({ words, onBack }: { words: SavedWord[]; onBack: () => void }) {
  const COUNT = 6; // 6 pairs = 12 cards
  const [roundWords, setRoundWords] = useState<SavedWord[]>([]);
  const [cards,    setCards]    = useState<MatchCard[]>([]);
  const [flipped,  setFlipped]  = useState<string[]>([]);
  const [matched,  setMatched]  = useState<string[]>([]);
  const [wrong,    setWrong]    = useState<string[]>([]);
  const [score,    setScore]    = useState(0);
  const [moves,    setMoves]    = useState(0);
  const [done,     setDone]     = useState(false);
  const busy = useRef(false);

  const init = useCallback((wordList: SavedWord[]) => {
    const chosen = shuffle(wordList.filter(w => w.meaning_en)).slice(0, COUNT);
    setRoundWords(chosen);
    const deck: MatchCard[] = [];
    chosen.forEach(w => {
      deck.push({ id: `w_${w.id}`, type: 'word', text: w.word,          pairId: w.id });
      deck.push({ id: `d_${w.id}`, type: 'def',  text: w.meaning_en!,   pairId: w.id });
    });
    setCards(shuffle(deck));
    setFlipped([]); setMatched([]); setWrong([]); setScore(0); setMoves(0); setDone(false);
    busy.current = false;
  }, []);

  useEffect(() => { init(words); }, []); // eslint-disable-line

  const tap = useCallback((id: string) => {
    if (busy.current) return;
    if (matched.includes(id) || flipped.includes(id)) return;
    const next = [...flipped, id];
    setFlipped(next);
    sfx.tap();

    if (next.length === 2) {
      busy.current = true;
      setMoves(m => m + 1);
      const [a, b] = next.map(i => cards.find(c => c.id === i)!);
      if (a.pairId === b.pairId) {
        sfx.correct();
        setMatched(m => [...m, a.id, b.id]);
        setScore(s => s + 1);
        awardXP('review_word');
        setFlipped([]);
        busy.current = false;
        if (matched.length + 2 === cards.length) setDone(true);
      } else {
        sfx.wrong();
        setWrong([a.id, b.id]);
        setTimeout(() => { setFlipped([]); setWrong([]); busy.current = false; }, 900);
      }
    }
  }, [flipped, matched, cards]);

  if (done) return (
    <GameComplete
      score={score} total={roundWords.length}
      game="Matching Pairs 🎴"
      subtitle={`${moves} moves`}
      onBack={onBack}
      onReplay={() => init(words)}
    />
  );

  return (
    <div className="max-w-md mx-auto px-4 pt-5 pb-28 animate-fade-in">
      <GameHeader title="Matching Pairs 🎴" onBack={onBack} score={score} idx={matched.length / 2} total={roundWords.length} />
      <p className="text-xs text-center text-muted mt-2 mb-4">Tap a word then its definition to match them</p>

      <div className="grid grid-cols-2 gap-2">
        {cards.map(card => {
          const isFlipped  = flipped.includes(card.id);
          const isMatched  = matched.includes(card.id);
          const isWrong    = wrong.includes(card.id);

          return (
            <button
              key={card.id}
              onClick={() => tap(card.id)}
              disabled={isMatched}
              className={`rounded-2xl p-3 text-left min-h-[72px] flex items-center border-2 transition-all active:scale-95 ${
                isMatched ? 'border-green-500/40 bg-green-500/10 text-green-400 cursor-default' :
                isWrong   ? 'border-red-500/40 bg-red-500/10 text-red-400' :
                isFlipped ? 'border-blue-500/60 bg-blue-600/15 text-blue-300' :
                card.type === 'word'
                  ? 'border-blue-500/30 bg-blue-500/8 text-heading font-bold'
                  : 'border-purple-500/30 bg-purple-500/8 text-body text-xs'
              }`}
            >
              <span className={
                isMatched || isFlipped || isWrong
                  ? (card.type === 'word' ? 'text-sm font-bold' : 'text-xs leading-relaxed line-clamp-3')
                  : 'text-2xl text-muted/60 mx-auto'
              }>
                {isMatched || isFlipped || isWrong
                  ? card.text
                  : (card.type === 'word' ? '?' : '···')}
              </span>
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

// ═════════════════════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═════════════════════════════════════════════════════════════════════════════

function GameHeader({ title, onBack, score, idx, total }: {
  title: string; onBack: () => void; score: number; idx: number; total: number;
}) {
  const pct = total > 0 ? Math.round((idx / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <button onClick={onBack} className="w-9 h-9 rounded-xl hover:bg-card text-muted hover:text-body flex items-center justify-center transition-colors">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="w-4 h-4">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <div className="flex-1">
          <div className="text-base font-bold text-heading">{title}</div>
          <div className="text-xs text-muted">{idx} / {total} · Score: {score}</div>
        </div>
        <div className="text-sm font-bold text-blue-500">⭐ {score}</div>
      </div>
      <div className="h-1.5 bg-elevated rounded-full overflow-hidden">
        <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function GameComplete({ score, total, game, subtitle, onBack, onReplay }: {
  score: number; total: number; game: string; subtitle?: string; onBack: () => void; onReplay: () => void;
}) {
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const emoji = pct === 100 ? '🏆' : pct >= 70 ? '🎉' : pct >= 40 ? '👍' : '📚';

  useEffect(() => { sfx.complete(); }, []);

  return (
    <div className="max-w-md mx-auto px-4 pt-10 pb-28 text-center animate-fade-in">
      <div className="text-6xl mb-4 animate-pop-in">{emoji}</div>
      <h2 className="text-2xl font-bold text-heading mb-1">
        {pct === 100 ? 'Perfect!' : pct >= 70 ? 'Well done!' : pct >= 40 ? 'Good effort!' : 'Keep practising!'}
      </h2>
      <p className="text-sm text-muted mb-1">{game}</p>
      {subtitle && <p className="text-xs text-faint mb-5">{subtitle}</p>}

      <div className="bg-card border border-default rounded-3xl p-6 mb-6 space-y-4">
        <div className="text-4xl font-black text-heading">{score} / {total}</div>
        <div className="h-3 bg-elevated rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${
              pct === 100 ? 'bg-yellow-400' : pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-blue-500' : 'bg-red-400'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-sm text-muted">{pct}% correct · {score * 4}+ XP earned</p>
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-3 rounded-2xl border border-default text-sm text-body hover:bg-card transition-colors">
          ← Games Menu
        </button>
        <button onClick={onReplay} className="flex-1 btn-primary py-3 rounded-2xl text-sm">
          🔄 Play Again
        </button>
      </div>
    </div>
  );
}
