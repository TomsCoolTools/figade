// Every export format opens and has the right codec, size, frame rate,
// frame count, duration, colour range and transparency.

import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { hasFfmpeg, probe, pixel, harnessExport, openHarness, zipEntries, zipEntry } from './helpers.js';

test.skip(!hasFfmpeg, 'ffmpeg/ffprobe are needed to inspect exported files');

const out = (info) => path.join(info.outputDir, 'files');
const video = (p) => p.streams.find((s) => s.codec_type === 'video');
const audio = (p) => p.streams.find((s) => s.codec_type === 'audio');

test.beforeEach(async ({ page }) => openHarness(page));

test('green screen MP4, 60 fps, with sound', async ({ page }, info) => {
  const files = await harnessExport(page, 'subscribe-pop', { format: 'mp4', fps: 60, sound: true }, out(info));
  const mp4 = files.find((f) => f.name.endsWith('.mp4'));
  const v = video(probe(mp4.file));
  expect(v).toMatchObject({ codec_name: 'h264', width: 1920, height: 1080, r_frame_rate: '60/1', nb_read_frames: '300' });
  expect(v).toMatchObject({ pix_fmt: 'yuv420p', color_range: 'tv', color_space: 'bt709', color_transfer: 'bt709', color_primaries: 'bt709' });
  expect(Number(probe(mp4.file).format.duration)).toBeCloseTo(5, 2);
  const [r, g, b] = pixel(mp4.file);
  expect(r).toBeLessThan(8);
  expect(g).toBeGreaterThan(245);
  expect(b).toBeLessThan(8);
  // Sound: inside the MP4 when the browser can encode AAC, otherwise a WAV beside it.
  const a = audio(probe(mp4.file));
  const wav = files.find((f) => f.name.endsWith('.wav'));
  if (a) expect(a.codec_name).toBe('aac');
  else {
    expect(wav, 'WAV sidecar when there is no AAC encoder').toBeTruthy();
    const w = probe(wav.file);
    expect(audio(w)).toMatchObject({ codec_name: 'pcm_s16le', sample_rate: '48000', channels: 2 });
    expect(Number(w.format.duration)).toBeCloseTo(5, 2);
  }
  info.annotations.push({ type: 'sound', description: a ? 'AAC inside the MP4' : 'WAV sidecar (no AAC encoder in this browser)' });
});

test('green screen MP4, 30 fps, every design', async ({ page }, info) => {
  for (const design of ['subscribe-pop', 'like-bell', 'follow-card', 'lower-third']) {
    const [mp4] = await harnessExport(page, design, { format: 'mp4', fps: 30 }, out(info));
    const v = video(probe(mp4.file));
    expect(v, design).toMatchObject({ codec_name: 'h264', width: 1920, height: 1080, r_frame_rate: '30/1', nb_read_frames: '150' });
  }
});

test('transparent WebM with alpha and Opus sound', async ({ page }, info) => {
  const [webm] = await harnessExport(page, 'subscribe-pop', { format: 'webm', fps: 60, sound: true }, out(info));
  const p = probe(webm.file);
  expect(video(p)).toMatchObject({ codec_name: 'vp9', width: 1920, height: 1080, r_frame_rate: '60/1', nb_read_frames: '300' });
  expect(video(p).tags?.alpha_mode).toBe('1');
  expect(audio(p)).toMatchObject({ codec_name: 'opus' });
  expect(pixel(webm.file, { vp9: true })[3], 'empty corner is transparent').toBe(0);
  expect(pixel(webm.file, { vp9: true, x: 960, y: 900 })[3], 'the card is opaque').toBe(255);
});

test('transparent PNG sequence zip with README and sound', async ({ page }, info) => {
  const [zip] = await harnessExport(page, 'lower-third', { format: 'png', fps: 30, sound: true }, out(info));
  const names = zipEntries(zip.file);
  const frames = names.filter((n) => /frame_\d{4}\.png$/.test(n));
  expect(frames).toHaveLength(150);
  expect(names.some((n) => n.endsWith('README.txt'))).toBe(true);
  expect(names.some((n) => n.endsWith('sound.wav'))).toBe(true);
  const png = path.join(out(info), 'frame.png');
  fs.writeFileSync(png, zipEntry(zip.file, frames[75]));
  const v = video(probe(png));
  expect(v).toMatchObject({ codec_name: 'png', width: 1920, height: 1080, pix_fmt: 'rgba' });
  expect(pixel(png, { t: 0, x: 1800, y: 20 })[3], 'background is transparent').toBe(0);
  expect(pixel(png, { t: 0, x: 125, y: 880 })[3], 'the accent bar is opaque').toBe(255);
});
