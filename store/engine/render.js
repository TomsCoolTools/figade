// Draws a design onto an output canvas: scales design units to the output size,
// adds motion blur and, unless the export is unlocked, the watermark.

import { font } from './text.js';

// Averages several sub-frames across a 180-degree shutter, like After Effects'
// motion blur, by adding them at 1/N strength (exact in premultiplied alpha).
export class Renderer {
  constructor(width = 1920, height = 1080) {
    this.resize(width, height);
  }

  resize(width, height) {
    if (this.scratch && this.scratch.width === width && this.scratch.height === height) return;
    this.scratch = new OffscreenCanvas(width, height);
    this.sctx = this.scratch.getContext('2d');
  }

  drawOnce(ctx, t, job) {
    const { design, scene, frame } = job;
    const W = ctx.canvas.width, H = ctx.canvas.height;
    ctx.save();
    if (W !== frame.w || H !== frame.h) ctx.scale(W / frame.w, H / frame.h);
    design.render(ctx, t, scene, frame);
    ctx.restore();
  }

  // job: { design, scene, frame, fps, motionBlur, samples, watermark }
  render(ctx, t, job) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const { fps = 60, motionBlur = true, samples = 6, watermark = null } = job;
    ctx.clearRect(0, 0, W, H);
    if (!motionBlur) {
      this.drawOnce(ctx, t, job);
    } else {
      this.resize(W, H);
      const shutter = 0.5 / fps;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1 / samples;
      for (let i = 0; i < samples; i++) {
        const st = t + ((i + 0.5) / samples - 0.5) * shutter;
        this.sctx.clearRect(0, 0, W, H);
        this.drawOnce(this.sctx, st, job);
        ctx.drawImage(this.scratch, 0, 0);
      }
      ctx.restore();
    }
    if (watermark) drawWatermark(ctx, watermark);
  }
}

// Diagonal rows of the site address across the whole frame, so cropping or
// keying can't remove it. Light text with a dark edge reads on any background.
export function drawWatermark(ctx, text) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const k = W / 1920;
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(-0.32);
  ctx.font = font(700, Math.round(46 * k), 'Anybody');
  ctx.fontStretch = 'expanded';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  const stepX = 560 * k, stepY = 150 * k;
  const reach = Math.hypot(W, H) / 2 + stepX;
  let row = 0;
  for (let y = -reach; y <= reach; y += stepY, row++) {
    const offset = (row % 2) * (stepX / 2);
    for (let x = -reach - offset; x <= reach; x += stepX) {
      ctx.lineWidth = 5 * k;
      ctx.strokeStyle = 'rgba(0,0,0,0.22)';
      ctx.strokeText(text, x, y);
      ctx.fillStyle = 'rgba(255,255,255,0.42)';
      ctx.fillText(text, x, y);
    }
  }
  ctx.restore();
}
