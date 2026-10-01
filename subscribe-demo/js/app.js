import { W, H, FPS, FRAMES, DURATION, Renderer, prepareScene, formatSubscribers } from './scene.js';
import { exportGreenMp4, exportPngZip, GREEN } from './export.js';

const $ = (id) => document.getElementById(id);
const canvas = $('preview');
const ctx = canvas.getContext('2d');
const renderer = new Renderer();

const settings = {
  name: $('name').value,
  subs: $('subs').value,
  avatar: null,
  theme: 'dark',
  button: 'classic',
  position: 'center',
  accent: $('accent').value,
};

let scene = null;
let t = 0;
let playing = true;
let dirty = true;
let last = performance.now();
let exporting = null;

const view = { speed: 1, loop: true, motionBlur: true, bg: 'checker' };

function rebuild() {
  scene = prepareScene(settings, ctx);
  $('subs-out').textContent = formatSubscribers(settings.subs) || '—';
  dirty = true;
}

// ---- inputs
$('name').addEventListener('input', (e) => { settings.name = e.target.value; rebuild(); });
$('subs').addEventListener('input', (e) => { settings.subs = e.target.value; rebuild(); });
$('accent').addEventListener('input', (e) => {
  settings.accent = e.target.value;
  $('accent-hex').textContent = e.target.value.toUpperCase();
  rebuild();
});

$('avatar').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    settings.avatar = await createImageBitmap(file);
    $('avatar-clear').hidden = false;
    rebuild();
  } catch {
    showError("That image couldn't be read. Try a JPG or PNG.");
  }
  e.target.value = '';
});
$('avatar-clear').addEventListener('click', () => {
  settings.avatar = null;
  $('avatar-clear').hidden = true;
  rebuild();
});

for (const seg of document.querySelectorAll('.seg')) {
  seg.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    for (const x of seg.querySelectorAll('button')) x.classList.toggle('on', x === b);
    settings[seg.dataset.name] = b.dataset.value;
    rebuild();
  });
}

// ---- transport
function setPlaying(p) {
  playing = p;
  $('icon-play').hidden = p;
  $('icon-pause').hidden = !p;
  last = performance.now();
}
function seekFrame(f) {
  t = Math.min(FRAMES - 1, Math.max(0, f)) / FPS;
  dirty = true;
}
$('play').addEventListener('click', () => {
  if (!playing && t >= (FRAMES - 1) / FPS) t = 0;
  setPlaying(!playing);
});
$('scrub').addEventListener('input', (e) => { setPlaying(false); seekFrame(+e.target.value); });
$('speed').addEventListener('change', (e) => { view.speed = +e.target.value; });
$('loop').addEventListener('change', (e) => { view.loop = e.target.checked; });
$('blur').addEventListener('change', (e) => { view.motionBlur = e.target.checked; dirty = true; });
$('bg').addEventListener('change', (e) => {
  $('stage').className = `stage bg-${e.target.value}`;
});

document.addEventListener('keydown', (e) => {
  if (e.target.matches('input[type=text], select')) return;
  const f = Math.round(t * FPS);
  if (e.code === 'Space') { e.preventDefault(); $('play').click(); }
  else if (e.code === 'ArrowRight') { e.preventDefault(); setPlaying(false); seekFrame(f + 1); }
  else if (e.code === 'ArrowLeft') { e.preventDefault(); setPlaying(false); seekFrame(f - 1); }
});

// Holds the empty frame at the end for a moment before looping.
const LOOP_GAP = 0.6;

function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (playing && !exporting) {
    t += dt * view.speed;
    if (t >= DURATION + (view.loop ? LOOP_GAP : 0)) {
      if (view.loop) t = 0;
      else { t = (FRAMES - 1) / FPS; setPlaying(false); }
    }
    dirty = true;
  }
  if (dirty && scene) {
    // Snap to the 60 fps frame grid so the preview shows exactly the exported frames.
    const f = Math.min(FRAMES - 1, Math.floor(t * FPS + 1e-6));
    renderer.render(ctx, f / FPS, scene, { motionBlur: view.motionBlur });
    $('scrub').value = f;
    $('time').textContent = `${(f / FPS).toFixed(2)} s · f ${f}`;
    dirty = false;
  }
  requestAnimationFrame(loop);
}

// ---- export
function showError(msg) {
  $('error').textContent = msg;
  $('error').hidden = !msg;
}

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
}

function slug(s) {
  return (s || 'channel').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'channel';
}

async function runExport(kind) {
  if (exporting) return;
  showError('');
  const ctrl = new AbortController();
  exporting = ctrl;
  const buttons = [$('export-mp4'), $('export-png')];
  buttons.forEach((b) => (b.disabled = true));
  $('progress').hidden = false;
  const label = kind === 'mp4' ? 'Encoding MP4' : 'Rendering PNG frames';
  const onProgress = (p) => {
    $('bar-fill').style.width = `${(p * 100).toFixed(1)}%`;
    $('progress-label').textContent = `${label}… ${Math.round(p * 100)}%`;
  };
  onProgress(0);
  const started = performance.now();
  try {
    const opts = { motionBlur: view.motionBlur };
    const base = `subscribe-${slug(settings.name)}`;
    if (kind === 'mp4') download(await exportGreenMp4(scene, opts, onProgress, ctrl.signal), `${base}-greenscreen.mp4`);
    else download(await exportPngZip(scene, opts, onProgress, ctrl.signal), `${base}-transparent-png.zip`);
    console.log(`Export ${kind} took ${((performance.now() - started) / 1000).toFixed(1)} s`);
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error(err);
      showError(err.message || String(err));
    }
  } finally {
    exporting = null;
    buttons.forEach((b) => (b.disabled = false));
    $('progress').hidden = true;
    dirty = true;
  }
}
$('export-mp4').addEventListener('click', () => runExport('mp4'));
$('export-png').addEventListener('click', () => runExport('png'));
$('cancel').addEventListener('click', () => exporting?.abort());

// ---- start (fonts must be ready before measuring text)
await Promise.all(['400', '500', '700'].map((w) => document.fonts.load(`${w} 30px Roboto`)));
rebuild();
setPlaying(true);
requestAnimationFrame(loop);

// Handy for testing from the console.
window.subscribeDemo = { seekFrame, setPlaying, settings, rebuild, W, H, GREEN };
