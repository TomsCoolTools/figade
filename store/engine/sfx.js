// Sound effects made in code with OfflineAudioContext, so there is nothing to
// license and the result is identical every time (noise comes from a seeded RNG).

import { rng } from './motion.js';

export const SAMPLE_RATE = 48000;

function noiseBuffer(ctx, seconds, seed) {
  const r = rng(seed);
  const buf = ctx.createBuffer(1, Math.ceil(seconds * ctx.sampleRate), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1;
  return buf;
}

function env(gain, at, attack, peak, decay) {
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(peak, at + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
}

// Mouse click: a short bright tick plus a tiny body thump.
function click(ctx, out, at) {
  const n = ctx.createBufferSource();
  n.buffer = noiseBuffer(ctx, 0.05, 7);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 2400;
  const g = ctx.createGain();
  env(g, at, 0.001, 0.55, 0.025);
  n.connect(hp).connect(g).connect(out);
  n.start(at);
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(1800, at);
  o.frequency.exponentialRampToValueAtTime(600, at + 0.02);
  const og = ctx.createGain();
  env(og, at, 0.001, 0.25, 0.03);
  o.connect(og).connect(out);
  o.start(at);
  o.stop(at + 0.06);
}

// Pop: a sine that drops in pitch, like a bubble.
function pop(ctx, out, at) {
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(880, at);
  o.frequency.exponentialRampToValueAtTime(260, at + 0.09);
  const g = ctx.createGain();
  env(g, at, 0.004, 0.5, 0.12);
  o.connect(g).connect(out);
  o.start(at);
  o.stop(at + 0.2);
}

// Bell: inharmonic partials with long, staggered decays.
function bell(ctx, out, at) {
  const base = 1318.5; // E6
  const partials = [
    [1, 0.32, 1.4],
    [2.0, 0.12, 0.9],
    [2.76, 0.1, 0.7],
    [5.4, 0.05, 0.35],
    [8.93, 0.025, 0.2],
  ];
  for (const [ratio, amp, decay] of partials) {
    const o = ctx.createOscillator();
    o.frequency.value = base * ratio;
    const g = ctx.createGain();
    env(g, at, 0.002, amp, decay);
    o.connect(g).connect(out);
    o.start(at);
    o.stop(at + decay + 0.05);
  }
}

// Whoosh: band-passed noise sweeping up then down.
function whoosh(ctx, out, at) {
  const dur = 0.42;
  const n = ctx.createBufferSource();
  n.buffer = noiseBuffer(ctx, dur, 11);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 1.4;
  bp.frequency.setValueAtTime(400, at);
  bp.frequency.exponentialRampToValueAtTime(2200, at + dur * 0.45);
  bp.frequency.exponentialRampToValueAtTime(700, at + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(0.28, at + dur * 0.45);
  g.gain.linearRampToValueAtTime(0, at + dur);
  n.connect(bp).connect(g).connect(out);
  n.start(at);
}

const SOUNDS = { click, pop, bell, whoosh };

// cues: [{ at: seconds, sfx: 'click' | 'pop' | 'bell' | 'whoosh' }]
export async function renderSounds(cues, duration) {
  const ctx = new OfflineAudioContext(2, Math.ceil(duration * SAMPLE_RATE), SAMPLE_RATE);
  const master = ctx.createGain();
  master.gain.value = 0.9;
  const comp = ctx.createDynamicsCompressor();
  master.connect(comp).connect(ctx.destination);
  for (const c of cues) {
    if (!SOUNDS[c.sfx]) throw new Error(`Unknown sound "${c.sfx}"`);
    if (c.at < duration) SOUNDS[c.sfx](ctx, master, Math.max(0, c.at));
  }
  return ctx.startRendering();
}

// 16-bit PCM WAV, which every editor imports.
export function encodeWav(buffer) {
  const ch = buffer.numberOfChannels, len = buffer.length, rate = buffer.sampleRate;
  const out = new DataView(new ArrayBuffer(44 + len * ch * 2));
  const str = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  out.setUint32(4, 36 + len * ch * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  out.setUint32(16, 16, true);
  out.setUint16(20, 1, true);
  out.setUint16(22, ch, true);
  out.setUint32(24, rate, true);
  out.setUint32(28, rate * ch * 2, true);
  out.setUint16(32, ch * 2, true);
  out.setUint16(34, 16, true);
  str(36, 'data');
  out.setUint32(40, len * ch * 2, true);
  const data = [...Array(ch)].map((_, c) => buffer.getChannelData(c));
  let o = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < ch; c++) {
      const s = Math.max(-1, Math.min(1, data[c][i]));
      out.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      o += 2;
    }
  }
  return new Uint8Array(out.buffer);
}
