// Draws a design onto an output canvas: scales design units to the output size,
// adds motion blur and, unless the export is unlocked, the watermark.

import { font } from './text.js';

// Averages several sub-frames across a 180-degree shutter, like After Effects'
// motion blur, by adding them at 1/N strength (exact in premultiplied alpha).
//
// The adding happens on a float16 canvas where the browser supports it. On
// an ordinary 8-bit canvas each 1/N contribution is rounded, which turns soft
// shadows into visible bands (alpha snaps to steps of N).
const supportsFloat16 = (() => {
  try {
    const ctx = new OffscreenCanvas(1, 1).getContext('2d', { colorType: 'float16' });
    return ctx.getContextAttributes?.().colorType === 'float16';
  } catch {
    return false;
  }
})();

export class Renderer {
  constructor(width = 1920, height = 1080) {
    this.resize(width, height);
  }

  resize(width, height) {
    if (this.scratch && this.scratch.width === width && this.scratch.height === height) return;
    this.scratch = new OffscreenCanvas(width, height);
    this.sctx = this.scratch.getContext('2d');
    this.acc = supportsFloat16 ? new OffscreenCanvas(width, height) : null;
    this.actx = this.acc?.getContext('2d', { colorType: 'float16' }) ?? null;
  }

  drawOnce(ctx, t, job) {
    const { design, scene, view } = job;
    // Export-wide switches the design reads from its frame.
    const frame = job.shadows === false ? { ...job.frame, shadows: false } : job.frame;
    const W = ctx.canvas.width, H = ctx.canvas.height;
    ctx.save();
    if (view) {
      // A zoomed-in region of the frame (design units), as in a monitor zoom.
      ctx.scale(W / view.w, H / view.h);
      ctx.translate(-view.x, -view.y);
    } else if (W !== frame.w || H !== frame.h) ctx.scale(W / frame.w, H / frame.h);
    design.render(ctx, t, scene, frame);
    ctx.restore();
  }

  // job: { design, scene, frame, fps, motionBlur, samples, watermark, shadows, view }
  render(ctx, t, job) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const { fps = 60, motionBlur = true, samples = 6, watermark = null } = job;
    ctx.clearRect(0, 0, W, H);
    if (!motionBlur) {
      this.drawOnce(ctx, t, job);
    } else {
      this.resize(W, H);
      const shutter = 0.5 / fps;
      const target = this.actx ?? ctx;
      target.save();
      if (this.actx) target.clearRect(0, 0, W, H);
      target.globalCompositeOperation = 'lighter';
      target.globalAlpha = 1 / samples;
      for (let i = 0; i < samples; i++) {
        const st = t + ((i + 0.5) / samples - 0.5) * shutter;
        this.sctx.clearRect(0, 0, W, H);
        this.drawOnce(this.sctx, st, job);
        target.drawImage(this.scratch, 0, 0);
      }
      target.restore();
      if (this.actx) ctx.drawImage(this.acc, 0, 0);
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
  ctx.font = font(700, Math.round(40 * k), 'Anybody');
  ctx.fontStretch = 'expanded';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  const stepX = 620 * k, stepY = 210 * k;
  const reach = Math.hypot(W, H) / 2 + stepX;
  let row = 0;
  for (let y = -reach; y <= reach; y += stepY, row++) {
    const offset = (row % 2) * (stepX / 2);
    for (let x = -reach - offset; x <= reach; x += stepX) {
      ctx.lineWidth = 4 * k;
      ctx.strokeStyle = 'rgba(0,0,0,0.16)';
      ctx.strokeText(text, x, y);
      ctx.fillStyle = 'rgba(255,255,255,0.34)';
      ctx.fillText(text, x, y);
    }
  }
  ctx.restore();
}
