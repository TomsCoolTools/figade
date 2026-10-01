// The mouse cursor: an arrow with a soft shadow that glides along keyframed
// curves, tilts slightly with its speed and squashes when it clicks.

import { clamp, tween, quad } from '../motion.js';

let path;
const cursorPath = () => (path ??= new Path2D('M0 0 L0 30.5 L7.2 23.6 L11.8 34.4 L16.6 32.3 L12.1 21.9 L21.9 21.9 Z'));

// moves: [{ start, end, from, ctrl, to, ease }] in time order. Before the first
// move the cursor is hidden; between moves it rests where the last one ended.
export function cursorTrack(moves) {
  return (t) => {
    if (!moves.length || t < moves[0].start) return null;
    let last = null;
    for (const m of moves) {
      if (t < m.start) return last;
      if (t < m.end) return quad(m.from, m.ctrl, m.to, tween(t, m.start, m.end - m.start, m.ease));
      last = m.to;
    }
    return last;
  };
}

// press: 0..1 click amount (see motion.press), alpha: overall opacity.
export function drawCursor(ctx, t, track, { alpha = 1, press = 0, size = 1.3 } = {}) {
  const p = track(t);
  if (!p || alpha <= 0) return;
  const prev = track(t - 1 / 120) || p;
  const vx = (p.x - prev.x) * 120;
  const tilt = clamp(vx * 0.00005, -0.1, 0.1);
  const scale = size * (1 - 0.14 * press);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(p.x, p.y);
  ctx.rotate(tilt);
  ctx.scale(scale, scale);
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 5;
  ctx.fillStyle = '#FFFFFF';
  ctx.fill(cursorPath());
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = '#111111';
  ctx.lineWidth = 1.6;
  ctx.stroke(cursorPath());
  ctx.restore();
}
