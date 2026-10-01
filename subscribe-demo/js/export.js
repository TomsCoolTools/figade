// Exports: green-screen MP4 (H.264 via WebCodecs + Mediabunny) and a
// transparent PNG sequence in a zip. Both render frame-by-frame with the same
// Renderer as the preview, so the files match what you saw.

import { W, H, FPS, FRAMES, Renderer } from './scene.js';
import { ZipWriter } from './zip.js';

export const GREEN = '#00FF00';

const tick = () => new Promise((r) => setTimeout(r, 0));

function checkAbort(signal) {
  if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError');
}

export async function exportGreenMp4(sc, { motionBlur, codec = 'avc' }, onProgress, signal) {
  const MB = await import('../vendor/mediabunny.min.mjs');
  const bitrate = 30e6; // generous, so keyed edges stay clean
  if (!(await MB.canEncodeVideo(codec, { width: W, height: H, bitrate }))) {
    throw new Error("This browser can't encode H.264 at 1920x1080. Please use a current version of Chrome.");
  }

  const frame = new OffscreenCanvas(W, H);
  const fctx = frame.getContext('2d');
  const out = new OffscreenCanvas(W, H);
  const octx = out.getContext('2d', { alpha: false });
  const renderer = new Renderer();

  const output = new MB.Output({
    format: new MB.Mp4OutputFormat({ fastStart: 'in-memory' }),
    target: new MB.BufferTarget(),
  });
  const source = new MB.CanvasSource(out, { codec, bitrate, keyFrameInterval: 1 });
  output.addVideoTrack(source, { frameRate: FPS });
  await output.start();

  try {
    for (let f = 0; f < FRAMES; f++) {
      checkAbort(signal);
      renderer.render(fctx, f / FPS, sc, { motionBlur });
      octx.fillStyle = GREEN;
      octx.fillRect(0, 0, W, H);
      octx.drawImage(frame, 0, 0);
      await source.add(f / FPS, 1 / FPS);
      onProgress?.((f + 1) / FRAMES);
      if (f % 4 === 0) await tick();
    }
    await output.finalize();
  } catch (err) {
    await output.cancel().catch(() => {});
    throw err;
  }
  return new Blob([output.target.buffer], { type: 'video/mp4' });
}

const PREMIERE_NOTE = `Transparent PNG sequence, 1920x1080, ${FPS} fps, ${FRAMES} frames.

Importing into Premiere Pro:
1. Unzip this folder.
2. File > Import, select subscribe_0000.png and tick "Image Sequence".
3. Right-click the clip > Modify > Interpret Footage > "Assume this frame rate: ${FPS}".
   (Premiere imports image sequences at its default rate, often 25 or 29.97 fps.)
4. Put it on a track above your footage. The background is already transparent.
`;

export async function exportPngZip(sc, { motionBlur }, onProgress, signal) {
  const frame = new OffscreenCanvas(W, H);
  const fctx = frame.getContext('2d');
  const renderer = new Renderer();
  const zip = new ZipWriter();
  const folder = 'subscribe_png/';
  zip.add(folder + 'README.txt', new TextEncoder().encode(PREMIERE_NOTE));

  for (let f = 0; f < FRAMES; f++) {
    checkAbort(signal);
    renderer.render(fctx, f / FPS, sc, { motionBlur });
    const blob = await frame.convertToBlob({ type: 'image/png' });
    zip.add(`${folder}subscribe_${String(f).padStart(4, '0')}.png`, new Uint8Array(await blob.arrayBuffer()));
    onProgress?.((f + 1) / FRAMES);
  }
  return zip.finish();
}
