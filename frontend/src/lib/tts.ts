/**
 * Centralized Text-to-Speech.
 *
 * Primary: natural NEURAL voices from the backend (/tts via Microsoft Edge,
 * free, human-like). Audio is fetched as a blob (so the auth header
 * can be sent) and played through an <audio> element.
 *
 * Fallback: the browser's built-in SpeechSynthesis (works offline, but more
 * robotic). Used automatically if the backend is unreachable, TTS
 * is offline, or edge-tts isn't installed.
 *
 * FIX BUG-12: neuralAvailable now has a retry mechanism.
 *             If backend was down on first try, it retries after 60 seconds
 *             instead of staying permanently failed for the whole session.
 */

import { API_BASE, tokenStore } from '@/lib/api';

export type SpeakOptions = {
  voice?: string;   // backend neural voice id, e.g. 'en-US-AriaNeural'
  rate?: number;    // 0.5 – 2.0 (1 = normal)
  onEnd?: () => void;  // called when playback finishes (or errors)
};

// Preferred natural voice (can be changed by the user later)
let preferredVoice = 'en-US-AriaNeural';
export function setPreferredVoice(v: string) { preferredVoice = v; }
export function getPreferredVoice() { return preferredVoice; }

// Single shared audio element + object URL so we never overlap playback
let audioEl: HTMLAudioElement | null = null;
let currentUrl: string | null = null;

// FIX BUG-12: Track neural availability with a timestamp for retry logic
let neuralAvailable: boolean | null = null; // null = unknown
let neuralFailedAt: number | null = null;   // timestamp when it last failed
const NEURAL_RETRY_AFTER_MS = 60_000;       // retry after 60 seconds

function ensureAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  if (!audioEl) audioEl = new Audio();
  return audioEl;
}

function revokeUrl() {
  if (currentUrl) {
    URL.revokeObjectURL(currentUrl);
    currentUrl = null;
  }
}

/** Stop any ongoing speech (both neural audio and browser synthesis). */
export function stopSpeaking() {
  try {
    if (audioEl) { audioEl.pause(); audioEl.currentTime = 0; }
  } catch {}
  revokeUrl();
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

/** Browser fallback (robotic but always available / offline). */
function browserSpeak(text: string, opts: SpeakOptions = {}): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      opts.onEnd?.(); resolve(); return;
    }
    const synth = window.speechSynthesis;
    synth.cancel();

    const start = () => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.rate = opts.rate ?? 0.95;
      u.pitch = 1.0;

      // Pick the least-robotic available voice
      const voices = synth.getVoices();
      const natural =
        voices.find(v => v.lang.startsWith('en') && /Natural|Neural|Enhanced|Google|Samantha|Aria|Jenny|Daniel/i.test(v.name)) ||
        voices.find(v => v.lang.startsWith('en-US')) ||
        voices.find(v => v.lang.startsWith('en')) ||
        voices[0];
      if (natural) u.voice = natural;

      u.onend = () => { opts.onEnd?.(); resolve(); };
      u.onerror = () => { opts.onEnd?.(); resolve(); };
      synth.speak(u);
    };

    // Voices may load async on first use (common on Android/Termux)
    if (synth.getVoices().length === 0) {
      const handler = () => { synth.onvoiceschanged = null; start(); };
      synth.onvoiceschanged = handler;
      // Safety: don't wait forever
      setTimeout(() => { if (synth.onvoiceschanged === handler) { synth.onvoiceschanged = null; start(); } }, 600);
    } else {
      start();
    }
  });
}

/** Try the natural neural backend voice; resolve true on success. */
async function neuralSpeak(text: string, opts: SpeakOptions = {}): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const el = ensureAudio();
  if (!el) return false;

  const token = tokenStore.get();
  const params = new URLSearchParams({
    text,
    voice: opts.voice || preferredVoice,
    rate: String(opts.rate ?? 1.0),
  });

  try {
    const res = await fetch(`${API_BASE}/tts?${params.toString()}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      // FIX BUG-12: Record failure time instead of permanently disabling
      neuralAvailable = false;
      neuralFailedAt = Date.now();
      return false;
    }

    const blob = await res.blob();
    if (!blob.size) { return false; }

    revokeUrl();
    currentUrl = URL.createObjectURL(blob);
    el.src = currentUrl;

    return await new Promise((resolve) => {
      const done = (ok: boolean) => {
        el.onended = null; el.onerror = null;
        opts.onEnd?.();
        resolve(ok);
      };
      el.onended = () => done(true);
      el.onerror = () => done(false);
      el.play().then(() => {
        // FIX BUG-12: Mark as available and clear failure timestamp
        neuralAvailable = true;
        neuralFailedAt = null;
      }).catch(() => done(false));
    });
  } catch {
    // FIX BUG-12: Record failure time
    neuralAvailable = false;
    neuralFailedAt = Date.now();
    return false;
  }
}

/**
 * FIX BUG-12: Check if we should retry neural TTS.
 * Returns true if neural is available OR if enough time has passed since failure.
 */
function shouldTryNeural(): boolean {
  if (neuralAvailable === true) return true;
  if (neuralAvailable === null) return true; // never tried
  // Was marked unavailable — retry after timeout
  if (neuralFailedAt !== null && Date.now() - neuralFailedAt > NEURAL_RETRY_AFTER_MS) {
    neuralAvailable = null; // reset to unknown — will try again
    neuralFailedAt = null;
    return true;
  }
  return false;
}

/**
 * Speak text with the most natural voice available.
 * Always resolves; uses the browser voice if the neural backend fails.
 */
export async function speak(text: string, opts: SpeakOptions = {}): Promise<void> {
  const clean = (text || '').trim();
  if (!clean) { opts.onEnd?.(); return; }

  stopSpeaking();

  // FIX BUG-12: Use shouldTryNeural() instead of checking neuralAvailable directly
  if (shouldTryNeural()) {
    const ok = await neuralSpeak(clean, opts);
    if (ok) return;
  }
  await browserSpeak(clean, opts);
}
