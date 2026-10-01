import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const hasFfmpeg = (() => {
  try {
    execFileSync('ffprobe', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

export function probe(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-count_frames', '-show_entries',
    'stream=codec_type,codec_name,width,height,r_frame_rate,nb_read_frames,pix_fmt,color_range,color_space,color_transfer,color_primaries,sample_rate,channels:stream_tags=alpha_mode:format=duration',
    '-of', 'json', file]).toString();
  return JSON.parse(out);
}

// RGBA of one pixel of one frame, decoded by ffmpeg (libvpx for WebM so the
// alpha channel is honoured).
export function pixel(file, { t = 2.6, x = 5, y = 5, vp9 = false } = {}) {
  const args = ['-v', 'error', ...(vp9 ? ['-c:v', 'libvpx-vp9'] : []), '-ss', String(t), '-i', file,
    '-vf', `crop=2:2:${x}:${y}`, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'];
  // 2x2 because 4:2:0 video can't be cropped to a single pixel; use the top-left one.
  return [...execFileSync('ffmpeg', args)].slice(0, 4);
}

// Runs an export through the dev-only harness page and writes the files.
export async function harnessExport(page, design, opts, dir) {
  const res = await page.evaluate(([d, o]) => window.harness.export(d, o), [design, opts]);
  fs.mkdirSync(dir, { recursive: true });
  return res.files.map((f) => {
    const file = path.join(dir, f.name);
    fs.writeFileSync(file, Buffer.from(f.b64, 'base64'));
    return { name: f.name, file, size: f.size };
  });
}

export async function openHarness(page) {
  await page.goto('/__test/');
  await page.waitForFunction(() => window.harnessReady);
}

// Lists the entries of a zip by reading its central directory.
export function zipEntries(file) {
  const b = fs.readFileSync(file);
  const end = b.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = b.readUInt16LE(end + 10);
  let p = b.readUInt32LE(end + 16);
  const names = [];
  for (let i = 0; i < count; i++) {
    const n = b.readUInt16LE(p + 28), x = b.readUInt16LE(p + 30), c = b.readUInt16LE(p + 32);
    names.push(b.subarray(p + 46, p + 46 + n).toString());
    p += 46 + n + x + c;
  }
  return names;
}

// Extracts one stored (uncompressed) entry from our zips.
export function zipEntry(file, name) {
  const b = fs.readFileSync(file);
  let p = 0;
  while ((p = b.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]), p)) !== -1) {
    const size = b.readUInt32LE(p + 18), n = b.readUInt16LE(p + 26), x = b.readUInt16LE(p + 28);
    if (b.subarray(p + 30, p + 30 + n).toString() === name) return b.subarray(p + 30 + n + x, p + 30 + n + x + size);
    p += 30 + n + x + size;
  }
  return null;
}
