import { clamp, ease, tween } from '../motion.js';
import { fillTextLeft } from '../text.js';

// A line of text sliding up out of an invisible mask, like an AE track matte.
export function revealLine(ctx, t, { start, text, font, colour, x, baseline, rise, maskWidth, dur = 0.7 }) {
  const p = tween(t, start, dur, ease.outExpo);
  if (p <= 0) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 6, baseline - rise - 14, maskWidth + 12, rise + 26);
  ctx.clip();
  ctx.globalAlpha *= clamp(p * 1.6);
  ctx.font = font;
  ctx.fillStyle = colour;
  ctx.textBaseline = 'alphabetic';
  fillTextLeft(ctx, text, x, baseline + (1 - p) * (rise + 12));
  ctx.restore();
}
