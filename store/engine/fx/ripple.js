import { clamp, lerp, ease, tween } from '../motion.js';

// A material-style ripple spreading from a click. Call it inside a clip of the
// shape being pressed. rgb is "r,g,b".
export function ripple(ctx, t, { at, x, y, r0, r1, grow, fadeDelay, fadeDur, rgb, alpha }) {
  const rd = t - at;
  if (rd <= 0 || rd >= 0.9) return;
  const rp = ease.outCubic(clamp(rd / grow));
  const fade = 1 - tween(t, at + fadeDelay, fadeDur, ease.easy);
  ctx.fillStyle = `rgba(${rgb},${alpha * fade})`;
  ctx.beginPath();
  ctx.arc(x, y, lerp(r0, r1, rp), 0, Math.PI * 2);
  ctx.fill();
}
