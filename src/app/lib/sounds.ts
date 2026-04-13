import { updateSetting } from './cloudSync';

let ctx: AudioContext | null = null;
let enabled = true;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function setSoundEnabled(val: boolean) {
  enabled = val;
  localStorage.setItem('stride_sound', val ? '1' : '0');
  updateSetting('sound', val);
}

export function isSoundEnabled(): boolean {
  const stored = localStorage.getItem('stride_sound');
  if (stored === null) return true; // default on
  return stored === '1';
}

function envelope(
  gain: GainNode,
  ac: AudioContext,
  attack: number,
  sustain: number,
  release: number,
  peakGain = 0.35,
) {
  const now = ac.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(peakGain, now + attack);
  gain.gain.setValueAtTime(peakGain, now + attack + sustain);
  gain.gain.exponentialRampToValueAtTime(0.001, now + attack + sustain + release);
  gain.gain.setValueAtTime(0, now + attack + sustain + release + 0.01);
}

// ── Click / button ──────────────────────────────────────────────────────────
export function playClick() {
  if (!isSoundEnabled()) return;
  try {
    const ac = getCtx();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(900, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, ac.currentTime + 0.05);
    envelope(gain, ac, 0.002, 0.01, 0.06, 0.15);
    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + 0.1);
  } catch (_) {}
}

// ── Task complete — ascending chime C→E→G ───────────────────────────────────
export function playComplete() {
  if (!isSoundEnabled()) return;
  try {
    const ac = getCtx();
    const notes = [523.25, 659.25, 783.99]; // C5 E5 G5
    notes.forEach((freq, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const t = ac.currentTime + i * 0.11;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.28, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  } catch (_) {}
}

// ── Success / plan generated ─────────────────────────────────────────────────
export function playSuccess() {
  if (!isSoundEnabled()) return;
  try {
    const ac = getCtx();
    // Chord: C + E + G played together with slow attack
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      envelope(gain, ac, 0.04, 0.2, 0.5, 0.18);
      osc.start(ac.currentTime);
      osc.stop(ac.currentTime + 0.85);
    });
  } catch (_) {}
}

// ── Error / warning ──────────────────────────────────────────────────────────
export function playError() {
  if (!isSoundEnabled()) return;
  try {
    const ac = getCtx();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(110, ac.currentTime + 0.25);
    envelope(gain, ac, 0.01, 0.1, 0.2, 0.12);
    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + 0.35);
  } catch (_) {}
}

// ── Notification ping ────────────────────────────────────────────────────────
export function playPing() {
  if (!isSoundEnabled()) return;
  try {
    const ac = getCtx();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ac.currentTime + 0.15);
    envelope(gain, ac, 0.003, 0.02, 0.18, 0.2);
    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + 0.25);
  } catch (_) {}
}

// ── Whoosh / navigation ──────────────────────────────────────────────────────
export function playWhoosh() {
  if (!isSoundEnabled()) return;
  try {
    const ac = getCtx();
    const bufSize = ac.sampleRate * 0.18;
    const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

    const src = ac.createBufferSource();
    src.buffer = buf;

    const filter = ac.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(4000, ac.currentTime);
    filter.frequency.exponentialRampToValueAtTime(400, ac.currentTime + 0.15);
    filter.Q.value = 0.5;

    const gain = ac.createGain();
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ac.destination);
    envelope(gain, ac, 0.005, 0.03, 0.14, 0.08);
    src.start(ac.currentTime);
  } catch (_) {}
}

// ── Phase complete — big celebration ────────────────────────────────────────
export function playPhaseComplete() {
  if (!isSoundEnabled()) return;
  try {
    const ac = getCtx();
    const melody = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    melody.forEach((freq, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.type = i === melody.length - 1 ? 'sine' : 'triangle';
      osc.frequency.value = freq;
      const t = ac.currentTime + i * 0.09;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.22, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      osc.start(t);
      osc.stop(t + 0.5);
    });
  } catch (_) {}
}

// ── Haptic feedback (mobile vibration) ──────────────────────────────────────
export function haptic(style: 'light' | 'medium' | 'heavy' | 'success' = 'light') {
  try {
    if (!navigator.vibrate) return;
    const patterns: Record<string, number | number[]> = {
      light: 10,
      medium: 20,
      heavy: 40,
      success: [15, 50, 30],
    };
    navigator.vibrate(patterns[style]);
  } catch (_) {}
}