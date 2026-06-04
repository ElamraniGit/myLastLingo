/**
 * sfx.ts — Sound Effects via Web Audio API.
 *
 * Generates all sounds programmatically — no audio files needed.
 * Works offline, instant playback, tiny bundle footprint.
 *
 * Sounds:
 *  correct()      — two ascending tones (success ✅)
 *  wrong()        — short descending buzz (error ❌)
 *  flip()         — soft whoosh (card flip 🃏)
 *  save()         — soft chime (word saved ➕)
 *  delete_()      — short pop (item removed 🗑️)
 *  complete()     — fanfare (session done 🎉)
 *  tap()          — subtle click (general tap)
 *  streak()       — ascending arpeggio (streak milestone 🔥)
 *
 * All sounds respect a global mute flag (ll-sfx-muted in localStorage).
 */

let _ctx: AudioContext | null = null;
let _muted = false;

// ── Init / mute ───────────────────────────────────────────────────────────────

function ctx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!_ctx) {
    try {
      _ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch { return null; }
  }
  // Resume on user interaction (required by autoplay policy)
  if (_ctx.state === 'suspended') _ctx.resume().catch(() => {});
  return _ctx;
}

export function isMuted(): boolean {
  if (typeof localStorage !== 'undefined') {
    _muted = localStorage.getItem('ll-sfx-muted') === 'true';
  }
  return _muted;
}

export function setMuted(v: boolean): void {
  _muted = v;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('ll-sfx-muted', String(v));
  }
}

export function toggleMuted(): boolean {
  setMuted(!isMuted());
  return _muted;
}

// ── Low-level helpers ────────────────────────────────────────────────────────

type WaveType = 'sine' | 'square' | 'sawtooth' | 'triangle';

interface ToneOpts {
  freq:    number;
  dur:     number;     // seconds
  vol?:    number;     // 0–1, default 0.18
  type?:   WaveType;
  attack?: number;     // seconds
  decay?:  number;     // seconds
  startAt?: number;    // AudioContext time offset
}

function tone(ac: AudioContext, opts: ToneOpts): void {
  const {
    freq, dur,
    vol    = 0.18,
    type   = 'sine',
    attack = 0.01,
    decay  = 0.04,
    startAt = 0,
  } = opts;

  const osc   = ac.createOscillator();
  const gain  = ac.createGain();
  const t0    = ac.currentTime + startAt;

  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);

  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(vol, t0 + attack);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);

  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + decay);
}

function noise(ac: AudioContext, dur: number, vol = 0.06, startAt = 0): void {
  const bufSize = ac.sampleRate * dur;
  const buf     = ac.createBuffer(1, bufSize, ac.sampleRate);
  const data    = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

  const src   = ac.createBufferSource();
  const gain  = ac.createGain();
  const filter = ac.createBiquadFilter();
  const t0 = ac.currentTime + startAt;

  src.buffer = buf;
  filter.type = 'bandpass';
  filter.frequency.value = 1200;
  filter.Q.value = 0.5;

  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);

  src.connect(filter);
  filter.connect(gain);
  gain.connect(ac.destination);
  src.start(t0);
  src.stop(t0 + dur);
}

// ── Sound effects ─────────────────────────────────────────────────────────────

/** ✅ Correct answer — two ascending chimes */
export function correct(): void {
  if (isMuted()) return;
  const ac = ctx(); if (!ac) return;
  tone(ac, { freq: 523.25, dur: 0.12, vol: 0.15, startAt: 0.0 });   // C5
  tone(ac, { freq: 659.25, dur: 0.18, vol: 0.18, startAt: 0.1 });   // E5
}

/** ❌ Wrong answer — descending buzz */
export function wrong(): void {
  if (isMuted()) return;
  const ac = ctx(); if (!ac) return;
  tone(ac, { freq: 220, dur: 0.08, vol: 0.14, type: 'square', startAt: 0.0 });
  tone(ac, { freq: 180, dur: 0.14, vol: 0.10, type: 'square', startAt: 0.07 });
}

/** 🃏 Card flip — soft whoosh */
export function flip(): void {
  if (isMuted()) return;
  const ac = ctx(); if (!ac) return;
  noise(ac, 0.07, 0.05);
  tone(ac, { freq: 880, dur: 0.06, vol: 0.06, type: 'sine', attack: 0.005, startAt: 0.01 });
}

/** ➕ Word saved — soft upward chime */
export function save(): void {
  if (isMuted()) return;
  const ac = ctx(); if (!ac) return;
  tone(ac, { freq: 698.46, dur: 0.10, vol: 0.12, startAt: 0.0 });   // F5
  tone(ac, { freq: 880.00, dur: 0.15, vol: 0.14, startAt: 0.08 });  // A5
}

/** 🗑️ Word deleted — short soft pop */
export function deleteSfx(): void {
  if (isMuted()) return;
  const ac = ctx(); if (!ac) return;
  tone(ac, { freq: 300, dur: 0.07, vol: 0.10, type: 'sine', attack: 0.005, decay: 0.05 });
  noise(ac, 0.04, 0.04, 0.02);
}

/** 🎉 Session complete — short fanfare */
export function complete(): void {
  if (isMuted()) return;
  const ac = ctx(); if (!ac) return;
  // C E G E C (ascending then down)
  const notes = [261.63, 329.63, 392.00, 329.63, 523.25];
  notes.forEach((freq, i) => {
    tone(ac, { freq, dur: 0.12, vol: 0.16, startAt: i * 0.09 });
  });
}

/** 🔥 Streak / milestone — ascending arpeggio */
export function streak(): void {
  if (isMuted()) return;
  const ac = ctx(); if (!ac) return;
  [261.63, 329.63, 392.00, 523.25, 659.25].forEach((freq, i) => {
    tone(ac, { freq, dur: 0.10, vol: 0.13, startAt: i * 0.07 });
  });
}

/** 👆 Generic tap — subtle click */
export function tap(): void {
  if (isMuted()) return;
  const ac = ctx(); if (!ac) return;
  noise(ac, 0.025, 0.03);
}

/** 🔔 Notification tone */
export function notification(): void {
  if (isMuted()) return;
  const ac = ctx(); if (!ac) return;
  tone(ac, { freq: 1047, dur: 0.08, vol: 0.12, startAt: 0.0 });
  tone(ac, { freq:  784, dur: 0.12, vol: 0.10, startAt: 0.07 });
}
