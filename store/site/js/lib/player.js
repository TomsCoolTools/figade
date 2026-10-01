// A preview monitor: renders a design onto a canvas at the size it's shown,
// loops it, and supports play/pause, scrubbing and frame stepping. Uses the
// same Renderer as the exports.

import { Renderer } from '../../../engine/render.js';
import { prepareDesign } from '../../../engine/export/index.js';

export class Player {
  constructor(canvas, { fps = 60, motionBlur = true, loopGap = 0.6, onTime } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.renderer = new Renderer(1, 1);
    this.fps = fps;
    this.motionBlur = motionBlur;
    this.samples = 6;
    this.loopGap = loopGap;
    this.onTime = onTime;
    this.t = 0;
    this.playing = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.speed = 1;
    this.job = null;
    this.watermark = null;
    this.view = null;
    this.shadows = true;
    this.dirty = true;
    this.last = performance.now();
    this.slowFrames = 0;
    new ResizeObserver(() => this.fit()).observe(canvas);
    this.fit();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  fit() {
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.max(16, Math.round(r.width * dpr));
    const h = Math.max(9, Math.round(r.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.dirty = true;
    }
  }

  async show(design, options) {
    const token = (this.loading = {});
    const job = await prepareDesign(design, options);
    if (this.loading !== token) return; // a newer request won
    if (!this.job || this.job.design !== design) this.t = Math.min(this.t, design.duration);
    this.job = job;
    this.dirty = true;
  }

  get duration() {
    return this.job ? this.job.design.duration : 5;
  }

  play() {
    if (this.t >= this.duration - 1 / this.fps) this.t = 0;
    this.playing = true;
    this.last = performance.now();
  }
  pause() {
    this.playing = false;
  }
  seek(t) {
    this.t = Math.max(0, Math.min(this.duration, t));
    this.dirty = true;
  }
  step(frames) {
    this.pause();
    this.seek(Math.round(this.t * this.fps + frames) / this.fps);
  }
  setShadows(on) {
    this.shadows = on;
    this.dirty = true;
  }
  setView(view) {
    this.view = view;
    this.dirty = true;
  }
  setWatermark(text) {
    if (text !== this.watermark) {
      this.watermark = text;
      this.dirty = true;
    }
  }

  loop(now) {
    const dt = Math.max(0, Math.min(0.1, (now - this.last) / 1000));
    this.last = now;
    if (this.playing && this.job) {
      this.t += dt * this.speed;
      if (this.t >= this.duration + this.loopGap) this.t = 0;
      this.dirty = true;
    }
    if (this.dirty && this.job) {
      // Snap to the frame grid so the preview shows exactly the exported frames.
      const f = Math.min(Math.round(this.duration * this.fps) - 1, Math.floor(this.t * this.fps + 1e-6));
      const start = performance.now();
      this.renderer.render(this.ctx, f / this.fps, {
        ...this.job,
        fps: this.fps,
        motionBlur: this.motionBlur && this.samples > 1,
        samples: this.samples,
        watermark: this.watermark,
        view: this.view,
        shadows: this.shadows,
      });
      // On slow devices, trade motion-blur samples for a smooth preview.
      if (performance.now() - start > 24 && this.playing) {
        if (++this.slowFrames > 20 && this.samples > 1) {
          this.samples = this.samples > 3 ? 3 : 1;
          this.slowFrames = 0;
        }
      } else this.slowFrames = 0;
      this.dirty = false;
      this.onTime?.(this.t, f);
    }
    requestAnimationFrame(this.loop);
  }
}

export function timecode(t, fps = 60) {
  const f = Math.floor(t * fps + 1e-6);
  const s = Math.floor(f / fps);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}:${pad(f % fps)}`;
}
