// Exports a design to video files in the browser. Frames come from the same
// Renderer as the preview, so files match what the visitor saw.
//
//   mp4  — H.264 on #00FF00 for chroma keying (AAC audio if the browser can
//          encode it, otherwise a WAV is downloaded alongside)
//   png  — transparent PNG sequence in a zip, with a README and a WAV
//   webm — VP9 with an alpha channel (Opus audio), plays transparent in OBS

import { Renderer } from '../render.js';
import { frameFor } from '../define.js';
import { ensureFonts } from '../text.js';
import { renderSounds, encodeWav } from '../sfx.js';
import { ZipWriter } from './zip.js';
import { rgbaToI420, BT709_LIMITED } from './yuv.js';

export const GREEN = '#00FF00';

export const FORMATS = {
  mp4: { label: 'Green screen MP4', short: 'MP4', ext: 'mp4', note: 'Premiere, Resolve, CapCut' },
  png: { label: 'Transparent PNG sequence', short: 'PNG', ext: 'zip', note: 'Premiere, After Effects' },
  webm: { label: 'Transparent WebM', short: 'WebM', ext: 'webm', note: 'OBS, Streamlabs, Resolve' },
};

const loadMediabunny = () => import('mediabunny');
const tick = () => new Promise((r) => setTimeout(r, 0));

function checkAbort(signal) {
  if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError');
}

const videoBitrate = (w, h, fps) => Math.round(30e6 * ((w * h) / (1920 * 1080)) * Math.sqrt(fps / 60));

// What this browser can make. Checked before showing export buttons, so a
// visitor is told up front instead of failing halfway through.
export async function capabilities({ width = 1920, height = 1080, fps = 60 } = {}) {
  const caps = { mp4: false, webm: false, png: false, aac: false, opus: false };
  caps.png = typeof OffscreenCanvas !== 'undefined' && 'convertToBlob' in OffscreenCanvas.prototype;
  if (typeof VideoEncoder === 'undefined') return caps;
  try {
    const MB = await loadMediabunny();
    const bitrate = videoBitrate(width, height, fps);
    caps.mp4 = await MB.canEncodeVideo('avc', { width, height, bitrate, frameRate: fps });
    caps.webm = await MB.canEncodeVideo('vp9', { width, height, bitrate, frameRate: fps });
    caps.aac = await MB.canEncodeAudio('aac', { numberOfChannels: 2, sampleRate: 48000, bitrate: 192e3 });
    caps.opus = await MB.canEncodeAudio('opus', { numberOfChannels: 2, sampleRate: 48000, bitrate: 160e3 });
  } catch (err) {
    console.warn('Capability check failed', err);
  }
  return caps;
}

// Fonts loaded, text measured, layout fixed. Shared by preview and export.
export async function prepareDesign(design, options, layout = 'landscape') {
  const frame = frameFor(layout);
  await ensureFonts(design.fonts(options));
  const measure = new OffscreenCanvas(8, 8).getContext('2d');
  return { design, frame, scene: design.prepare(options, measure, frame) };
}

/**
 * opts: { design, options, format, fps, layout, scale, sound, watermark,
 *         motionBlur, shadows, baseName, onProgress, signal }
 * Returns [{ name, blob }] — usually one file; MP4 with sound but no AAC
 * encoder returns the MP4 plus a WAV.
 */
export async function exportDesign(opts) {
  const { design, options, format, fps = 60, layout = 'landscape', scale = 1, sound = false, watermark = null,
    motionBlur = true, shadows = true, baseName = design.id, onProgress, signal } = opts;
  if (!FORMATS[format]) throw new Error(`Unknown format "${format}"`);
  const job = await prepareDesign(design, options, layout);
  const W = Math.round(job.frame.w * scale), H = Math.round(job.frame.h * scale);
  const frames = Math.round(design.duration * fps);
  const audio = sound ? await renderSounds(design.sounds(options), design.duration) : null;
  const name = `${baseName}-${fps}fps`;
  const ctx = { job: { ...job, fps, motionBlur, watermark, shadows }, W, H, frames, fps, audio, name, onProgress, signal };
  if (format === 'png') return exportPng(ctx);
  return exportVideo(ctx, format);
}

async function exportVideo({ job, W, H, frames, fps, audio, name, onProgress, signal }, format) {
  const MB = await loadMediabunny();
  const files = [];
  const isMp4 = format === 'mp4';
  const codec = isMp4 ? 'avc' : 'vp9';
  const bitrate = Math.round(videoBitrate(W, H, fps) * (isMp4 ? 1 : 0.7));
  if (!(await MB.canEncodeVideo(codec, { width: W, height: H, bitrate, frameRate: fps }))) {
    throw new Error(isMp4
      ? "This browser can't make MP4 files. Open this page in Chrome or Edge on a computer, or Chrome on Android."
      : "This browser can't make WebM files. Open this page in Chrome or Edge on a computer.");
  }

  const frame = new OffscreenCanvas(W, H);
  const fctx = frame.getContext('2d');
  let source, sctx, yuv;
  if (isMp4) {
    const out = new OffscreenCanvas(W, H);
    sctx = out.getContext('2d', { alpha: false, willReadFrequently: true });
    yuv = new Uint8Array(W * H * 1.5);
    source = new MB.VideoSampleSource({ codec, bitrate, keyFrameInterval: 1 });
  } else {
    source = new MB.CanvasSource(frame, { codec, bitrate, keyFrameInterval: 1, alpha: 'keep' });
  }

  const output = new MB.Output({
    format: isMp4 ? new MB.Mp4OutputFormat({ fastStart: 'in-memory' }) : new MB.WebMOutputFormat(),
    target: new MB.BufferTarget(),
  });
  output.addVideoTrack(source, { frameRate: fps });

  let audioSource = null;
  if (audio) {
    const audioCodec = isMp4 ? 'aac' : 'opus';
    const ok = await MB.canEncodeAudio(audioCodec, { numberOfChannels: 2, sampleRate: audio.sampleRate, bitrate: 192e3 });
    if (ok) {
      audioSource = new MB.AudioBufferSource({ codec: audioCodec, bitrate: 192e3 });
      output.addAudioTrack(audioSource);
    } else {
      files.push({ name: `${name}-sound.wav`, blob: new Blob([encodeWav(audio)], { type: 'audio/wav' }) });
    }
  }

  await output.start();
  const renderer = new Renderer(W, H);
  try {
    if (audioSource) {
      await audioSource.add(audio);
      audioSource.close();
    }
    for (let f = 0; f < frames; f++) {
      checkAbort(signal);
      renderer.render(fctx, f / fps, job);
      if (isMp4) {
        sctx.fillStyle = GREEN;
        sctx.fillRect(0, 0, W, H);
        sctx.drawImage(frame, 0, 0);
        rgbaToI420(sctx.getImageData(0, 0, W, H).data, W, H, yuv);
        const sample = new MB.VideoSample(yuv, { format: 'I420', codedWidth: W, codedHeight: H, timestamp: f / fps, duration: 1 / fps, colorSpace: BT709_LIMITED });
        await source.add(sample);
        sample.close();
      } else {
        await source.add(f / fps, 1 / fps);
      }
      onProgress?.((f + 1) / frames);
      if (f % 4 === 0) await tick();
    }
    source.close();
    await output.finalize();
  } catch (err) {
    await output.cancel().catch(() => {});
    throw err;
  }
  const suffix = isMp4 ? 'greenscreen' : 'transparent';
  files.unshift({ name: `${name}-${suffix}.${format}`, blob: new Blob([output.target.buffer], { type: isMp4 ? 'video/mp4' : 'video/webm' }) });
  return files;
}

function pngReadme(fps, frames, W, H, hasSound) {
  return `Transparent PNG sequence, ${W}x${H}, ${fps} fps, ${frames} frames.

Importing into Premiere Pro:
1. Unzip this folder.
2. File > Import, select frame_0000.png and tick "Image Sequence".
3. Right-click the clip > Modify > Interpret Footage > "Assume this frame rate: ${fps}".
   (Premiere imports image sequences at its default rate, often 25 or 29.97 fps.)
4. Put it on a track above your footage. The background is already transparent.
${hasSound ? '5. sound.wav lines up with frame 0. Drop it on an audio track at the same start.\n' : ''}`;
}

async function exportPng({ job, W, H, frames, fps, audio, name, onProgress, signal }) {
  const frame = new OffscreenCanvas(W, H);
  const fctx = frame.getContext('2d');
  const renderer = new Renderer(W, H);
  const zip = new ZipWriter();
  const folder = `${name}-png/`;
  zip.add(folder + 'README.txt', new TextEncoder().encode(pngReadme(fps, frames, W, H, !!audio)));
  if (audio) zip.add(folder + 'sound.wav', encodeWav(audio));
  for (let f = 0; f < frames; f++) {
    checkAbort(signal);
    renderer.render(fctx, f / fps, job);
    const blob = await frame.convertToBlob({ type: 'image/png' });
    zip.add(`${folder}frame_${String(f).padStart(4, '0')}.png`, new Uint8Array(await blob.arrayBuffer()));
    onProgress?.((f + 1) / frames);
  }
  return [{ name: `${name}-transparent-png.zip`, blob: zip.finish() }];
}
