const MUTE_KEY = 'hidden-catch:muted';

let audioCtx: AudioContext | null = null;
let muted = readMuted();

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext;
  if (!Ctor) return null;
  if (!audioCtx) audioCtx = new Ctor();
  if (audioCtx.state === 'suspended') void audioCtx.resume();
  return audioCtx;
}

/** A single short synthesized beep — no audio assets needed, fits the retro-arcade tone. */
function tone(ctx: AudioContext, freq: number, startOffset: number, duration: number, type: OscillatorType, gain = 0.15) {
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const startTime = ctx.currentTime + startOffset;
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);
}

export function isMuted() {
  return muted;
}

export function setMuted(next: boolean) {
  muted = next;
  try {
    localStorage.setItem(MUTE_KEY, next ? '1' : '0');
  } catch {
    // best-effort only
  }
}

export function playFound() {
  if (muted) return;
  const ctx = getCtx();
  if (!ctx) return;
  tone(ctx, 880, 0, 0.12, 'triangle');
  tone(ctx, 1320, 0.08, 0.16, 'triangle');
}

export function playMiss() {
  if (muted) return;
  const ctx = getCtx();
  if (!ctx) return;
  tone(ctx, 180, 0, 0.18, 'sawtooth', 0.12);
}

export function playClear() {
  if (muted) return;
  const ctx = getCtx();
  if (!ctx) return;
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => tone(ctx, freq, i * 0.11, 0.22, 'triangle'));
}

export function playHurry() {
  if (muted) return;
  const ctx = getCtx();
  if (!ctx) return;
  tone(ctx, 660, 0, 0.09, 'square', 0.1);
  tone(ctx, 660, 0.15, 0.09, 'square', 0.1);
}
