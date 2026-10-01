import { lerp } from './motion.js';

export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  const v = m ? parseInt(m[1], 16) : 0xff0033;
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

export function mixHex(a, b, p) {
  const A = hexToRgb(a), B = hexToRgb(b);
  const c = A.map((v, i) => Math.round(lerp(v, B[i], p)));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

// Mixes a colour towards white (p > 0) or black (p < 0).
export function shade(hex, p) {
  const [r, g, b] = hexToRgb(hex);
  const t = p > 0 ? 255 : 0;
  const k = Math.abs(p);
  return `rgb(${Math.round(lerp(r, t, k))},${Math.round(lerp(g, t, k))},${Math.round(lerp(b, t, k))})`;
}

// Relative luminance, used to pick readable text on a user-chosen accent.
export function luminance(hex) {
  const c = hexToRgb(hex).map((v) => {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

export const readableOn = (hex) => (luminance(hex) > 0.45 ? '#0F0F0F' : '#FFFFFF');

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(r, h / 2, w / 2));
}
