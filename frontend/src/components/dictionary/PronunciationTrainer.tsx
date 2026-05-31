/**
 * Pronunciation Trainer — uses Web Speech Recognition to listen
 * to user's pronunciation and compare with the correct word.
 *
 * Features:
 * - Listen to correct pronunciation (TTS)
 * - Record user's attempt (Speech Recognition)
 * - Compare and show accuracy score
 * - Visual feedback (correct/wrong/partial)
 * - Multiple attempts with history
 * - Works on Chrome, Edge, Samsung Browser (Android)
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { awardXP } from '@/components/common/XPBar';
import { speak as ttsSpeak } from '@/lib/tts';

interface Props {
  word: string;
  pronunciation?: string;
  onClose: () => void;
}

type AttemptResult = {
  heard: string;
  score: number;
  correct: boolean;
};

// Check browser support
function getSpeechRecognition(): any {
  if (typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

function normalizeWord(w: string): string {
  return w.toLowerCase().replace(/[^a-z']/g, '').trim();
}

function calculateScore(target: string, heard: string): number {
  const t = normalizeWord(target);
  const h = normalizeWord(heard);
  if (t === h) return 100;
  if (!t || !h) return 0;

  // Check if the heard text contains the target word
  const words = heard.toLowerCase().split(/\s+/).map(w => normalizeWord(w));
  if (words.includes(t)) return 100;

  // Levenshtein distance for partial matches
  const len = Math.max(t.length, h.length);
  if (len === 0) return 100;

  const dp: number[][] = Array.from({ length: t.length + 1 }, () => Array(h.length + 1).fill(0));
  for (let i = 0; i <= t.length; i++) dp[i][0] = i;
  for (let j = 0; j <= h.length; j++) dp[0][j] = j;
  for (let i = 1; i <= t.length; i++) {
    for (let j = 1; j <= h.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (t[i - 1] === h[j - 1] ? 0 : 1)
      );
    }
  }
  const distance = dp[t.length][h.length];
  return Math.max(0, Math.round((1 - distance / len) * 100));
}

function speak(text: string, rate = 0.85): Promise<void> {
  // Natural neural voice (model pronunciation), with browser fallback offline.
  return ttsSpeak(text, { rate });
}

export default function PronunciationTrainer({ word, pronunciation, onClose }: Props) {
  const [listening, setListening] = useState(false);
  const [attempts, setAttempts] = useState<AttemptResult[]>([]);
  const [currentHeard, setCurrentHeard] = useState('');
  const [supported, setSupported] = useState(true);
  const [playing, setPlaying] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    setSupported(!!getSpeechRecognition());
    return () => { recognitionRef.current?.abort(); };
  }, []);

  // Listen to correct pronunciation
  const listenCorrect = useCallback(async () => {
    setPlaying(true);
    await speak(word, 0.7);
    setPlaying(false);
  }, [word]);

  // Start recording user's voice
  const startListening = useCallback(() => {
    const SpeechRec = getSpeechRecognition();
    if (!SpeechRec) return;

    const recognition = new SpeechRec();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;
    recognitionRef.current = recognition;

    setListening(true);
    setCurrentHeard('');

    recognition.onresult = (event: any) => {
      let heard = '';
      for (let i = 0; i < event.results.length; i++) {
        heard += event.results[i][0].transcript;
      }
      setCurrentHeard(heard);

      // Final result
      if (event.results[event.results.length - 1].isFinal) {
        const score = calculateScore(word, heard);
        const result = { heard: heard.trim(), score, correct: score >= 80 };
        setAttempts(prev => [result, ...prev].slice(0, 10));
        if (score >= 80) awardXP('pronunciation');
        setListening(false);
      }
    };

    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognition.start();
  }, [word]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const bestScore = attempts.length > 0 ? Math.max(...attempts.map(a => a.score)) : null;

  if (!supported) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
        <div className="fixed inset-0 bg-black/60" onClick={onClose} />
        <div className="relative bg-card border border-line rounded-t-3xl sm:rounded-2xl p-6 w-full max-w-sm z-10">
          <h3 className="text-lg font-bold text-heading mb-2">Not Supported</h3>
          <p className="text-sm text-body mb-4">
            Speech recognition is not available in this browser. Please use Chrome or Edge.
          </p>
          <Button onClick={onClose} variant="primary" className="w-full">Close</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-line rounded-t-3xl sm:rounded-2xl w-full max-w-sm z-10 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-2">
          <h3 className="text-lg font-bold text-heading">Pronunciation</h3>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-elevated text-muted hover:text-heading">✕</button>
        </div>

        <div className="px-5 pb-6 space-y-5">

          {/* Word display */}
          <div className="text-center py-4">
            <h2 className="text-3xl font-extrabold text-heading">{word}</h2>
            {pronunciation && <p className="text-muted font-mono text-sm mt-1">{pronunciation}</p>}
            {bestScore !== null && (
              <div className={`mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${
                bestScore >= 80 ? 'bg-green-500/15 text-green-400' :
                bestScore >= 50 ? 'bg-yellow-500/15 text-yellow-400' :
                'bg-red-500/15 text-red-400'
              }`}>
                Best: {bestScore}%
              </div>
            )}
          </div>

          {/* Step 1: Listen */}
          <div className="bg-surface rounded-xl p-4">
            <p className="text-xs text-muted uppercase tracking-wider mb-3">Step 1 — Listen</p>
            <button onClick={listenCorrect} disabled={playing || listening}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all ${
                playing ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-600 text-white hover:bg-blue-500'
              } disabled:opacity-50`}>
              {playing ? (
                <><span className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /> Playing...</>
              ) : (
                <>🔊 Listen to correct pronunciation</>
              )}
            </button>
          </div>

          {/* Step 2: Speak */}
          <div className="bg-surface rounded-xl p-4">
            <p className="text-xs text-muted uppercase tracking-wider mb-3">Step 2 — Your turn</p>
            <button
              onClick={listening ? stopListening : startListening}
              disabled={playing}
              className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl text-sm font-medium transition-all ${
                listening
                  ? 'bg-red-500/20 text-red-400 border-2 border-red-500/40 animate-pulse'
                  : 'bg-green-600 text-white hover:bg-green-500'
              } disabled:opacity-50`}>
              {listening ? (
                <>
                  <span className="w-3 h-3 bg-red-500 rounded-full animate-ping" />
                  Listening... Tap to stop
                </>
              ) : (
                <>🎤 Tap and say "{word}"</>
              )}
            </button>

            {/* Live transcription */}
            {listening && currentHeard && (
              <p className="text-center text-sm text-body mt-3 italic">"{currentHeard}"</p>
            )}
          </div>

          {/* Results */}
          {attempts.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted uppercase tracking-wider">Results</p>
              {attempts.slice(0, 5).map((a, i) => (
                <div key={i} className={`flex items-center justify-between p-3 rounded-xl border ${
                  a.correct
                    ? 'bg-green-500/8 border-green-500/20'
                    : a.score >= 50
                    ? 'bg-yellow-500/8 border-yellow-500/20'
                    : 'bg-red-500/8 border-red-500/20'
                }`}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{a.correct ? '✅' : a.score >= 50 ? '🟡' : '❌'}</span>
                    <span className="text-sm text-body">"{a.heard}"</span>
                  </div>
                  <span className={`text-sm font-bold ${
                    a.correct ? 'text-green-400' : a.score >= 50 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {a.score}%
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Tips */}
          {attempts.length > 0 && attempts[0].score < 80 && (
            <div className="bg-blue-500/8 border border-blue-500/15 rounded-xl p-3">
              <p className="text-xs text-blue-400">
                💡 Tip: Listen again slowly, then try speaking clearly. Focus on each syllable.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
