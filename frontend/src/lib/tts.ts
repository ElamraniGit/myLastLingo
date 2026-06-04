/**
 * Centralized Text-to-Speech — v2.
 *
 * PRIMARY (always tried first):
 *   Backend /tts endpoint → edge-tts (Microsoft neural voices, free, human-like).
 *   Audio is fetched as an MP3 blob and played via <audio>.
 *
 * FALLBACK (only when backend unreachable / offline):
 *   Browser SpeechSynthesis — prefers the best available English voice.
 *
 * Fixes over v1:
 *  - Longer fetch timeout (15s instead of browser default ~30s, but avoids
 *    hanging forever on slow networks)
 *  - neuralAvailable resets after 30s (was 60s) for faster recovery
 *  - Cache-bust: if backend returns 502/503 we mark unavailable temporarily
 *    but retry on the NEXT speak() call (not next page load)
 *  - Voice selector: user can call setPreferredVoice() from Settings
 *  - warmUp(): pre-fetches a silent clip so the first real word is instant
 */

import { API_BASE, tokenStore } from '@/lib/api';

export type SpeakOptions = {
  voice?: string;   // edge-tts voice id, e.g. 'en-US-AriaNeural'
  rate?: number;    // 0.5 – 2.0 (1 = normal speed)
  onEnd?: () => void;
};

// ── Voice preference ──────────────────────────────────────────────────────────
const VOICE_KEY = 'll-tts-voice';
let _preferredVoice = 'en-US-AriaNeural';

export function setPreferredVoice(v: string) {
  _preferredVoice = v;
  if (typeof localStorage !== 'undefined') localStorage.setItem(VOICE_KEY, v);
}
export function getPreferredVoice(): string {
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem(VOICE_KEY);
    if (stored) _preferredVoice = stored;
  }
  return _preferredVoice;
}

// ── Audio element ─────────────────────────────────────────────────────────────
let audioEl: HTMLAudioElement | null = null;
let currentUrl: string | null = null;

function ensureAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  if (!audioEl) {
    audioEl = new Audio();
    // Preload metadata so playback starts immediately
    audioEl.preload = 'auto';
  }
  return audioEl;
}

function revokeUrl() {
  if (currentUrl) { URL.revokeObjectURL(currentUrl); currentUrl = null; }
}

// ── Neural availability tracking ──────────────────────────────────────────────
// null  = never tried (will attempt)
// true  = last call succeeded
// false = last call failed (will retry after RETRY_MS)
let neuralAvailable: boolean | null = null;
let neuralFailedAt: number  | null  = null;
const RETRY_MS = 30_000; // retry neural after 30s (was 60s)

function shouldTryNeural(): boolean {
  if (neuralAvailable !== false) return true; // null or true → try
  if (neuralFailedAt !== null && Date.now() - neuralFailedAt > RETRY_MS) {
    neuralAvailable = null;
    neuralFailedAt  = null;
    return true;
  }
  return false;
}

// ── Stop ─────────────────────────────────────────────────────────────────────
export function stopSpeaking(): void {
  try { if (audioEl) { audioEl.pause(); audioEl.currentTime = 0; } } catch {}
  revokeUrl();
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

// ── Neural (backend edge-tts) ─────────────────────────────────────────────────
async function neuralSpeak(text: string, opts: SpeakOptions): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const el = ensureAudio();
  if (!el) return false;

  const token = tokenStore.get();
  if (!token) return false; // not logged in — skip backend call

  const voice = opts.voice || getPreferredVoice();
  const rate  = opts.rate ?? 1.0;

  const params = new URLSearchParams({
    text,
    voice,
    rate: String(rate),
  });

  const controller = new AbortController();
  // 15-second timeout — enough for long sentences on slow networks
  const tid = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(`${API_BASE}/tts?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    clearTimeout(tid);

    if (!res.ok) {
      // 502/503 = edge-tts unreachable (offline or service down)
      // 401 = token expired → don't mark neural as broken
      if (res.status !== 401) {
        neuralAvailable = false;
        neuralFailedAt  = Date.now();
      }
      return false;
    }

    const blob = await res.blob();
    if (!blob.size) {
      neuralAvailable = false;
      neuralFailedAt  = Date.now();
      return false;
    }

    revokeUrl();
    currentUrl = URL.createObjectURL(blob);
    el.src = currentUrl;

    return await new Promise<boolean>((resolve) => {
      const done = (ok: boolean) => {
        el.onended = null; el.onerror = null;
        opts.onEnd?.();
        resolve(ok);
      };
      el.onended = () => done(true);
      el.onerror = () => {
        neuralAvailable = false;
        neuralFailedAt  = Date.now();
        done(false);
      };
      el.play()
        .then(() => { neuralAvailable = true; neuralFailedAt = null; })
        .catch(() => {
          neuralAvailable = false;
          neuralFailedAt  = Date.now();
          done(false);
        });
    });

  } catch (err: any) {
    clearTimeout(tid);
    // AbortError = timeout → mark unavailable
    neuralAvailable = false;
    neuralFailedAt  = Date.now();
    return false;
  }
}

// ── Browser fallback ──────────────────────────────────────────────────────────
// Picks the best available English voice (prefers Neural/Natural/Google voices).
function browserSpeak(text: string, opts: SpeakOptions): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      opts.onEnd?.(); resolve(); return;
    }
    const synth = window.speechSynthesis;
    synth.cancel();

    const start = () => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang  = 'en-US';
      u.rate  = opts.rate ?? 0.9;
      u.pitch = 1.0;

      // Score voices: Neural/Natural/Google > en-US > en > anything
      const voices = synth.getVoices();
      const best = voices
        .filter(v => v.lang.startsWith('en'))
        .sort((a, b) => {
          const scoreA = /Neural|Natural|Enhanced|Premium|Google|Samantha|Aria|Jenny|Daniel/i.test(a.name) ? 3
                       : a.lang.startsWith('en-US') ? 2 : 1;
          const scoreB = /Neural|Natural|Enhanced|Premium|Google|Samantha|Aria|Jenny|Daniel/i.test(b.name) ? 3
                       : b.lang.startsWith('en-US') ? 2 : 1;
          return scoreB - scoreA;
        })[0] || voices[0];

      if (best) u.voice = best;

      u.onend  = () => { opts.onEnd?.(); resolve(); };
      u.onerror = () => { opts.onEnd?.(); resolve(); };
      synth.speak(u);
    };

    // Voices may load async (common on Android / Termux Chrome)
    if (synth.getVoices().length === 0) {
      const handler = () => { synth.onvoiceschanged = null; start(); };
      synth.onvoiceschanged = handler;
      setTimeout(() => {
        if (synth.onvoiceschanged === handler) {
          synth.onvoiceschanged = null; start();
        }
      }, 800);
    } else {
      start();
    }
  });
}

// ── Main export ───────────────────────────────────────────────────────────────
/**
 * Speak text using the best available voice.
 * Tries neural (backend edge-tts) first; falls back to browser SpeechSynthesis.
 * Always resolves — never throws.
 */
export async function speak(text: string, opts: SpeakOptions = {}): Promise<void> {
  const clean = (text || '').trim();
  if (!clean) { opts.onEnd?.(); return; }

  stopSpeaking();

  if (shouldTryNeural()) {
    const ok = await neuralSpeak(clean, opts);
    if (ok) return;
  }

  await browserSpeak(clean, opts);
}

// ── Warm-up (call once on app mount) ─────────────────────────────────────────
/**
 * Pre-warm the neural TTS connection by synthesizing a 1-char clip.
 * This way the first real speak() call plays instantly (no cold-start delay).
 * Call after login, not on page load (avoids wasting resources for guests).
 */
let warmedUp = false;
export async function warmUpTTS(): Promise<void> {
  if (warmedUp || typeof window === 'undefined') return;
  warmedUp = true;
  const token = tokenStore.get();
  if (!token) return;
  try {
    const params = new URLSearchParams({ text: 'hi', voice: getPreferredVoice(), rate: '1' });
    const res = await fetch(`${API_BASE}/tts?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) { neuralAvailable = true; neuralFailedAt = null; }
  } catch {}
}

// ── Voice list helper ─────────────────────────────────────────────────────────
export const NEURAL_VOICES = [
  { id: 'en-US-AriaNeural',    label: 'Aria (US, female) ⭐',  gender: 'female' },
  { id: 'en-US-JennyNeural',   label: 'Jenny (US, female)',   gender: 'female' },
  { id: 'en-US-GuyNeural',     label: 'Guy (US, male)',       gender: 'male'   },
  { id: 'en-GB-SoniaNeural',   label: 'Sonia (UK, female)',   gender: 'female' },
  { id: 'en-GB-RyanNeural',    label: 'Ryan (UK, male)',      gender: 'male'   },
  { id: 'en-AU-NatashaNeural', label: 'Natasha (AU, female)', gender: 'female' },
  { id: 'en-AU-WilliamNeural', label: 'William (AU, male)',   gender: 'male'   },
];
