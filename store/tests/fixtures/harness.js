// Dev/test-only page script (never in production builds): exposes the engine
// so Playwright can render frames and run exports directly.

import { designs } from '../../catalogue.js';
import { exportDesign, capabilities, prepareDesign } from '../../engine/export/index.js';
import { Renderer, defaultsOf } from '../../engine/index.js';

const toB64 = async (blob) => {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
};

window.harness = {
  designs: designs.map((d) => d.id),
  capabilities,
  async export(id, opts = {}) {
    const design = designs.find((d) => d.id === id);
    const options = { ...defaultsOf(design), ...(opts.options || {}) };
    const t0 = performance.now();
    const files = await exportDesign({ design, options, ...opts });
    const ms = performance.now() - t0;
    return { ms, files: await Promise.all(files.map(async (f) => ({ name: f.name, size: f.blob.size, b64: await toB64(f.blob) }))) };
  },
  // Renders one frame and returns it as a PNG data URL.
  async frame(id, t, opts = {}) {
    const design = designs.find((d) => d.id === id);
    const options = { ...defaultsOf(design), ...(opts.options || {}) };
    const job = await prepareDesign(design, options, opts.layout);
    const c = new OffscreenCanvas(job.frame.w, job.frame.h);
    new Renderer(c.width, c.height).render(c.getContext('2d'), t, { ...job, fps: 60, motionBlur: opts.motionBlur ?? true, watermark: opts.watermark ?? null, shadows: opts.shadows ?? true });
    const blob = await c.convertToBlob({ type: 'image/png' });
    return 'data:image/png;base64,' + (await toB64(blob));
  },
};
window.harnessReady = true;
