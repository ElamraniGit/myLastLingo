/**
 * speech.ts — thin wrapper around the browser Web Speech Recognition API
 * for pronunciation scoring. No external services; runs fully in the browser
 * (Chrome / Edge / Samsung Internet on Android).
 */

export function getSpeechRecognition(): any {
  if (typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

export function isSpeechSupported(): boolean {
  return !!getSpeechRecognition();
}

/** Normalise a word/phrase for forgiving comparison. */
export function normalizeSpeech(w: string): string {
  return w.toLowerCase().replace(/[^a-z0-9']/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Levenshtein-based similarity score (0–100) between target and heard text. */
export function pronunciationScore(target: string, heard: string): number {
  const t = normalizeSpeech(target);
  const h = normalizeSpeech(heard);
  if (!t) return 0;
  if (t === h) return 100;
  if (!h) return 0;

  // If any heard token exactly matches a single-word target, perfect.
  const heardWords = h.split(' ');
  if (!t.includes(' ') && heardWords.includes(t)) return 100;

  const len = Math.max(t.length, h.length);
  const dp: number[][] = Array.from({ length: t.length + 1 }, () => Array(h.length + 1).fill(0));
  for (let i = 0; i <= t.length; i++) dp[i][0] = i;
  for (let j = 0; j <= h.length; j++) dp[0][j] = j;
  for (let i = 1; i <= t.length; i++) {
    for (let j = 1; j <= h.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (t[i - 1] === h[j - 1] ? 0 : 1),
      );
    }
  }
  return Math.max(0, Math.round((1 - dp[t.length][h.length] / len) * 100));
}

export interface RecognitionHandle {
  stop: () => void;
  abort: () => void;
}

export interface ListenCallbacks {
  onInterim?: (text: string) => void;
  onResult: (text: string) => void;
  onError?: (err: string) => void;
  onEnd?: () => void;
  lang?: string;
}

/**
 * Start a one-shot recognition session. Returns a handle to stop/abort, or null
 * if speech recognition is unavailable.
 */
export function listenOnce(cb: ListenCallbacks): RecognitionHandle | null {
  const SR = getSpeechRecognition();
  if (!SR) { cb.onError?.('unsupported'); return null; }

  const recognition = new SR();
  recognition.lang = cb.lang || 'en-US';
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 3;

  recognition.onresult = (event: any) => {
    let heard = '';
    for (let i = 0; i < event.results.length; i++) {
      heard += event.results[i][0].transcript;
    }
    cb.onInterim?.(heard);
    const last = event.results[event.results.length - 1];
    if (last.isFinal) cb.onResult(heard.trim());
  };
  recognition.onerror = (e: any) => cb.onError?.(e?.error || 'error');
  recognition.onend = () => cb.onEnd?.();

  try {
    recognition.start();
  } catch {
    cb.onError?.('start-failed');
    return null;
  }

  return {
    stop: () => { try { recognition.stop(); } catch {} },
    abort: () => { try { recognition.abort(); } catch {} },
  };
}
