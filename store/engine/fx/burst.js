// Particle burst in the accent colour: a shockwave ring plus dots and streaks
// with drag and a touch of gravity. Seeded, so it is identical on every render.

import { clamp, lerp, ease, rng } from '../motion.js';
import { hexToRgb } from '../colour.js';

export function makeParticles(seed = 20241, n = 28) {
  const r = rng(seed);
  const list = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (r() - 0.5) * 0.35;
    list.push({
      a,
      speed: 620 + r() * 680,
      life: 0.42 + r() * 0.38,
      size: 2.8 + r() * 4,
      streak: i % 3 === 0,
      light: r() < 0.3,
      delay: r() * 0.04,
    });
  }
  return list;
}

// scale shrinks or grows the whole burst (1 = the subscribe button's burst).
export function drawBurst(ctx, t, at, origin, accent, particles, { scale = 1 } = {}) {
  const d0 = t - at;
  if (d0 <= 0 || d0 > 1.0) return;
  const o = origin;
  const [r, g, b] = hexToRgb(accent);
  const light = `rgb(${Math.round(lerp(r, 255, 0.45))},${Math.round(lerp(g, 255, 0.45))},${Math.round(lerp(b, 255, 0.45))})`;
  ctx.save();

  const rp = clamp(d0 / 0.5);
  if (rp < 1) {
    const e = ease.outExpo(rp);
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 1 - ease.easy(rp);
    ctx.lineWidth = lerp(7, 0.5, e) * scale;
    ctx.beginPath();
    ctx.arc(o.x, o.y, lerp(20, 112, e) * scale, 0, Math.PI * 2);
    ctx.stroke();
  }

  const drag = 6.5;
  ctx.lineCap = 'round';
  for (const p of particles) {
    const d = d0 - p.delay;
    if (d <= 0 || d >= p.life) continue;
    const life = d / p.life;
    const travel = (26 + (p.speed * (1 - Math.exp(-drag * d))) / drag) * scale;
    const dx = Math.cos(p.a), dy = Math.sin(p.a) * 0.8;
    const x = o.x + dx * travel;
    const y = o.y + dy * travel + 240 * d * d * scale;
    const size = p.size * Math.pow(1 - life, 0.7) * scale;
    ctx.globalAlpha = 1 - ease.inCubic(life);
    const col = p.light ? light : accent;
    if (p.streak) {
      const v = p.speed * Math.exp(-drag * d);
      const len = clamp(v * 0.03, 0, 34) * scale;
      ctx.strokeStyle = col;
      ctx.lineWidth = size * 0.8;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - dx * len, y - dy * len);
      ctx.stroke();
    } else {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}
