// Circular profile picture: the uploaded image cover-cropped into a circle, or
// initials on a coloured circle. Draws centred on the current origin.

import { font } from '../text.js';

export function drawAvatarCircle(ctx, r, { image, initials, bg, fontPx }) {
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  if (image) {
    ctx.save();
    ctx.clip();
    const iw = image.width, ih = image.height;
    const k = (2 * r) / Math.min(iw, ih);
    ctx.drawImage(image, (-iw * k) / 2, (-ih * k) / 2, iw * k, ih * k);
    ctx.restore();
  } else {
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = font(500, fontPx);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(initials, 0, fontPx * 0.355);
  }
}

// Initials size for a given radius: two letters slightly smaller than one.
export const initialsPx = (r, initials) => Math.round(r * (initials.length > 1 ? 0.78 : 0.89));
