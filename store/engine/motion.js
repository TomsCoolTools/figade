// Motion helpers: easing curves, springs and timing. Everything here is a pure
// function of time, so any frame can be rendered on its own (preview, scrubbing
// and export all draw the exact same pixels for the same t).

export const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const lerp = (a, b, p) => a + (b - a) * p;

// CSS / After Effects style cubic-bezier(x1, y1, x2, y2). Solves x for t with
// Newton's method, falling back to bisection, then returns y.
export function cubicBezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t) => ((ax * t + bx) * t + cx) * t;
  const sy = (t) => ((ay * t + by) * t + cy) * t;
  const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const e = sx(t) - x;
      if (Math.abs(e) < 1e-6) return sy(t);
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    let lo = 0, hi = 1;
    t = x;
    for (let i = 0; i < 30; i++) {
      const v = sx(t);
      if (Math.abs(v - x) < 1e-6) break;
      if (v < x) lo = t; else hi = t;
      t = (lo + hi) / 2;
    }
    return sy(t);
  };
}

export const ease = {
  linear: (x) => x,
  // AE "Easy Ease" (33% influence both sides)
  easy: cubicBezier(0.33, 0, 0.67, 1),
  // Strong deceleration, used for reveals
  outExpo: cubicBezier(0.16, 1, 0.3, 1),
  outQuint: cubicBezier(0.22, 1, 0.36, 1),
  outCubic: cubicBezier(0.33, 1, 0.68, 1),
  inOutCubic: cubicBezier(0.65, 0, 0.35, 1),
  // Asymmetric in-out for cursor travel: gentle start, long soft landing
  glide: cubicBezier(0.45, 0, 0.15, 1),
  inCubic: cubicBezier(0.32, 0, 0.67, 0),
  // Slight anticipation before accelerating away
  inBack: cubicBezier(0.6, -0.22, 0.74, 0.05),
};

// Progress 0..1 of a tween that starts at `start` and lasts `dur` seconds.
export function tween(t, start, dur, fn = ease.linear) {
  return fn(clamp((t - start) / dur));
}

// Damped harmonic oscillator going from 0 to 1, started at time 0.
// freq is the natural frequency in Hz, zeta the damping ratio (<1 overshoots).
function rawSpring(t, w, zeta) {
  if (zeta >= 1) return 1 - Math.exp(-w * t) * (1 + w * t);
  const wd = w * Math.sqrt(1 - zeta * zeta);
  return 1 - Math.exp(-zeta * w * t) * (Math.cos(wd * t) + ((zeta * w) / wd) * Math.sin(wd * t));
}

// settlePx: roughly how many pixels the spring moves something. After the
// overshoot a spring dips slightly below its target and creeps back for a long
// time. When that dip is under 2px it can't be seen as motion, only as a late
// one-pixel jump of text (Chrome snaps text to whole pixels). So once the
// spring swings back through its target, the dip is eased out over 0.1s while
// things are still visibly moving, and it rests exactly on 1 from then on.
export function spring(t, freq = 2, zeta = 0.6, settlePx = 0) {
  if (t <= 0) return 0;
  const w = 2 * Math.PI * freq;
  const x = rawSpring(t, w, zeta);
  if (!settlePx || zeta >= 1) return x;
  const wd = w * Math.sqrt(1 - zeta * zeta);
  const t1 = (Math.PI - Math.atan2(wd, zeta * w)) / wd; // first pass through 1
  const t2 = t1 + Math.PI / wd; // back through 1 after the overshoot
  const dipPx = Math.abs(1 - rawSpring(t2 + Math.PI / (2 * wd), w, zeta)) * settlePx;
  if (dipPx >= 2) return x; // a real, visible bounce: leave it alone
  if (t <= t2) return x;
  const k = Math.min(1, (t - t2) / 0.1);
  return x + (1 - x) * k * k * (3 - 2 * k);
}

// A quick press-and-release curve, used for clicks. Returns 0 at rest and 1
// fully pressed, springing back with a tiny overshoot past rest (negative).
export function press(t, at, down = 0.075) {
  const d = t - at;
  if (d <= 0) return 0;
  if (d < down) return ease.outCubic(d / down);
  return 1 - spring(d - down, 3.2, 0.42);
}

// Damped sine wiggle, starting at 0 with full velocity (no jump).
export function wiggle(t, at, amp, freq, decay) {
  const d = t - at;
  if (d <= 0) return 0;
  return amp * Math.exp(-decay * d) * Math.sin(2 * Math.PI * freq * d);
}

// Small deterministic PRNG so particle bursts look identical every render.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Point on a quadratic bezier.
export function quad(p0, c, p1, s) {
  const u = 1 - s;
  return {
    x: u * u * p0.x + 2 * u * s * c.x + s * s * p1.x,
    y: u * u * p0.y + 2 * u * s * c.y + s * s * p1.y,
  };
}
