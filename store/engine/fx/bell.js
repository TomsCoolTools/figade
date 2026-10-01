// Notification bell icon (Material Symbols paths, 24-unit box). Before `ringAt`
// it is an outline; from `ringAt` it turns filled, pops, grows ring arcs and
// swings with a damped wiggle around its top.

import { clamp, lerp, spring, wiggle } from '../motion.js';

const D = {
  outline:
    'M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z',
  filled:
    'M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z',
  arcs:
    'M7.58 4.08L6.15 2.65C3.75 4.48 2.17 7.3 2.03 10.5h2c.15-2.65 1.51-4.97 3.55-6.42zm12.39 6.42h2c-.15-3.2-1.73-6.02-4.12-7.85l-1.42 1.43c2.02 1.45 3.39 3.77 3.54 6.42z',
};
// Path2D only exists in browsers, so paths are built on first use. That keeps
// design modules importable from Node (the site build reads their metadata).
const cache = {};
export const bellPath = (name) => (cache[name] ??= new Path2D(D[name]));

// Draws centred on the current origin. size is the icon size in px.
export function drawBellIcon(ctx, t, { ringAt = Infinity, colour, size = 34 }) {
  const k = size / 24;
  const filled = t >= ringAt;
  const pop = filled ? 1 + 0.14 * Math.sin(Math.PI * clamp((t - ringAt) / 0.22)) : 1;
  const angle = wiggle(t, ringAt, 0.42, 4.4, 3.4);
  ctx.save();
  ctx.scale(k * pop, k * pop);
  ctx.translate(-12, -12);
  ctx.fillStyle = colour;
  if (filled) {
    const ap = spring(t - ringAt - 0.04, 2.6, 0.55);
    if (ap > 0) {
      ctx.save();
      ctx.globalAlpha *= clamp(ap * 2);
      ctx.translate(12, 9);
      ctx.scale(lerp(0.6, 1, ap), lerp(0.6, 1, ap));
      ctx.translate(-12, -9);
      ctx.fill(bellPath('arcs'));
      ctx.restore();
    }
  }
  ctx.translate(12, 3);
  ctx.rotate(angle);
  ctx.translate(-12, -3);
  ctx.fill(bellPath(filled ? 'filled' : 'outline'));
  ctx.restore();
}
