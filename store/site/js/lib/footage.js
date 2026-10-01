// A stand-in for "your video" behind previews: soft, out-of-focus shapes in
// muted colours, drawn once and used as the monitor's background image.

import { rng } from '../../../engine/motion.js';

let url;
export function footageUrl() {
  if (url) return url;
  const c = document.createElement('canvas');
  c.width = 960;
  c.height = 540;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#2b3036';
  ctx.fillRect(0, 0, 960, 540);
  const r = rng(77);
  const colours = ['#56606b', '#7b6a58', '#3f5a63', '#8a7a62', '#4b4f5c', '#a08a6a'];
  ctx.filter = 'blur(38px)';
  for (let i = 0; i < 14; i++) {
    ctx.globalAlpha = 0.5 + r() * 0.4;
    ctx.fillStyle = colours[i % colours.length];
    ctx.beginPath();
    ctx.ellipse(r() * 960, r() * 420, 60 + r() * 170, 50 + r() * 140, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.filter = 'none';
  ctx.globalAlpha = 1;
  // Out-of-focus highlights, like practical lights in the background.
  for (let i = 0; i < 9; i++) {
    const x = r() * 960, y = r() * 300, rad = 10 + r() * 22;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, 'rgba(255,226,180,0.35)');
    g.addColorStop(1, 'rgba(255,226,180,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  const v = ctx.createRadialGradient(480, 270, 200, 480, 270, 620);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, 960, 540);
  url = c.toDataURL('image/jpeg', 0.85);
  return url;
}
