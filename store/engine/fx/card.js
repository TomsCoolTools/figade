import { roundRect } from '../colour.js';

// The pack's card: a rounded rectangle with a wide ambient shadow, a tight
// contact shadow and a hairline border. Drawn at the current origin.
export function drawCard(ctx, w, h, radius, { fill, border }) {
  ctx.save();
  roundRect(ctx, 0, 0, w, h, radius);
  ctx.fillStyle = fill;
  ctx.shadowColor = 'rgba(0,0,0,0.30)';
  ctx.shadowBlur = 64;
  ctx.shadowOffsetY = 24;
  ctx.fill();
  ctx.shadowColor = 'rgba(0,0,0,0.20)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 3;
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = border;
  ctx.lineWidth = 1.5;
  roundRect(ctx, 0.75, 0.75, w - 1.5, h - 1.5, radius - 0.75);
  ctx.stroke();
}
