// Design page: live preview with the visitor's details, export settings, and
// the buy / unlock / download flow.

import { catalogue, packList } from '../../catalogue.js';
import { resolveOptions } from '../../engine/define.js';
import { exportDesign, capabilities, FORMATS } from '../../engine/export/index.js';
import config from '../../store.config.js';
import { Player, timecode } from './lib/player.js';
import * as state from './lib/state.js';
import { buildPanel, segmented } from './lib/panel.js';
import { unlockedDesigns, canExportClean } from './lib/unlock.js';
import { buy } from './lib/checkout.js';
import { footageUrl } from './lib/footage.js';

const $ = (s, el = document) => el.querySelector(s);
const root = $('[data-design]');
const item = catalogue.find((c) => c.design.id === root.dataset.design);
const { design } = item;

const PREFS = 'export-prefs:v1';
const prefs = (() => {
  try {
    return { format: 'mp4', fps: 60, sound: false, ...JSON.parse(localStorage.getItem(PREFS)) };
  } catch {
    return { format: 'mp4', fps: 60, sound: false };
  }
})();
const savePrefs = () => {
  try {
    localStorage.setItem(PREFS, JSON.stringify(prefs));
  } catch {}
};

let unlocked = false;
let caps = null;
let exporting = null;

// ---------------------------------------------------------------- preview

const screen = $('[data-screen]');
const player = new Player($('[data-monitor]'), {
  onTime: (t, f) => {
    $('[data-tc]').textContent = timecode(t);
    $('[data-frame]').textContent = `f ${f}`;
    $('[data-scrub]').value = f;
  },
});
player.setWatermark(config.domain);

const options = () => resolveOptions(design, state.getShared(), state.getOwn(design.id));
const refresh = () => player.show(design, options());

function setPlayingUi() {
  $('[data-icon-play]').hidden = player.playing;
  $('[data-icon-pause]').hidden = !player.playing;
  $('[data-play]').setAttribute('aria-label', player.playing ? 'Pause' : 'Play');
}
$('[data-play]').addEventListener('click', () => {
  player.playing ? player.pause() : player.play();
  setPlayingUi();
});
$('[data-scrub]').addEventListener('input', (e) => {
  player.pause();
  setPlayingUi();
  player.seek(Number(e.target.value) / player.fps);
});
document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea, select, [contenteditable]')) return;
  if (e.code === 'Space' && !e.target.closest('button')) {
    e.preventDefault();
    $('[data-play]').click();
  } else if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') {
    if (e.target.closest('.seg')) return;
    e.preventDefault();
    player.step(e.code === 'ArrowRight' ? 1 : -1);
    setPlayingUi();
  }
});

// Sound cues on the scrubber, drawn as keyframe diamonds.
for (const cue of design.sounds(options())) {
  const d = document.createElement('span');
  d.className = 'cue';
  d.style.left = `${(cue.at / design.duration) * 100}%`;
  d.title = cue.sfx;
  $('[data-cues]').append(d);
}

const footage = `url(${footageUrl()})`;
segmented($('[data-bg]'), 'footage', (v) => {
  screen.className = `screen ${v === 'footage' ? '' : `bg-${v}`}`;
  screen.style.backgroundImage = v === 'footage' ? footage : '';
});
screen.style.backgroundImage = footage;
screen.style.backgroundSize = 'cover';
// Phones start on the close-up: at full frame the graphic is too small to judge.
const startZoom = matchMedia('(max-width: 760px)').matches ? 'close' : 'fit';
segmented($('[data-zoom]'), startZoom, (v) => player.setView(v === 'close' ? design.showcase : null));
if (startZoom === 'close') player.setView(design.showcase);

buildPanel(design, { details: $('[data-group="details"]'), style: $('[data-group="style"]'), values: options(), onChange: refresh });
state.onChange(refresh);

// ---------------------------------------------------------------- export settings

const formatSeg = segmented($('[data-format]'), prefs.format, (v) => {
  prefs.format = v;
  savePrefs();
  updateExportUi();
});
segmented($('[data-fps]'), String(prefs.fps), (v) => {
  prefs.fps = Number(v);
  savePrefs();
});
segmented($('[data-sound]'), prefs.sound ? 'on' : 'off', (v) => {
  prefs.sound = v === 'on';
  savePrefs();
  updateExportUi();
});

function soundNote() {
  if (!prefs.sound) return '';
  if (prefs.format === 'mp4' && caps && !caps.aac) return ' The sound comes as a separate WAV file, because this browser can’t put it inside the MP4.';
  if (prefs.format === 'png') return ' The sound comes as a WAV file in the zip.';
  return '';
}

function updateExportUi() {
  const f = FORMATS[prefs.format];
  $('[data-format-note]').textContent = `${f.label}. Works in ${f.note}.${soundNote()}`;
  $('[data-clean-label]').textContent = `Download clean ${f.short}`;
  if (!caps) return;
  for (const b of formatSeg.buttons) b.disabled = !caps[b.dataset.value];
  const missing = Object.keys(FORMATS).filter((k) => !caps[k]);
  const note = $('[data-unavailable]');
  note.hidden = !missing.length;
  note.textContent = missing.length === Object.keys(FORMATS).length
    ? 'This browser can’t make video files. You can still personalise and buy here, then download in Chrome or Edge on a computer.'
    : `This browser can’t make ${missing.map((k) => FORMATS[k].short).join(' or ')} files. Use Chrome or Edge on a computer for those.`;
  if (!caps[prefs.format]) {
    const first = Object.keys(FORMATS).find((k) => caps[k]);
    if (first) {
      prefs.format = first;
      formatSeg.set(first);
      updateExportUi();
    }
  }
  const can = caps[prefs.format];
  for (const b of document.querySelectorAll('[data-export]')) b.disabled = !can;
}

// ---------------------------------------------------------------- unlock + export

function setUnlocked(set) {
  unlocked = set.has(design.id);
  $('[data-locked]').hidden = unlocked;
  $('[data-unlocked]').hidden = !unlocked;
  player.setWatermark(unlocked ? null : config.domain);
  if (unlocked) {
    const pack = packList.find((p) => p.designs.includes(design.id));
    $('[data-unlocked-note]').textContent = pack && [...pack.designs].every((d) => set.has(d))
      ? `Unlocked in this browser with the ${pack.name}.`
      : 'Unlocked in this browser.';
  }
}

function say(text, kind) {
  const s = $('[data-status]');
  s.textContent = text;
  s.classList.toggle('is-error', kind === 'error');
  s.classList.toggle('is-good', kind === 'good');
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

const slug = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

async function runExport(kind) {
  if (exporting) return;
  say('');
  // The clean path re-checks the signed unlock right before rendering.
  const clean = kind === 'clean' && (await canExportClean(design.id));
  if (kind === 'clean' && !clean) {
    setUnlocked(await unlockedDesigns());
    say('This design isn’t unlocked in this browser any more. Paste your licence key under “Already bought?”.', 'error');
    return;
  }
  const ctrl = new AbortController();
  exporting = ctrl;
  const buttons = [...document.querySelectorAll('[data-export], [data-buy]')];
  buttons.forEach((b) => (b.disabled = true));
  $('[data-progress]').hidden = false;
  const label = `${clean ? 'Rendering' : 'Rendering watermarked'} ${FORMATS[prefs.format].short}`;
  const onProgress = (p) => {
    $('[data-progress-fill]').style.width = `${(p * 100).toFixed(1)}%`;
    $('[data-progress-label]').textContent = `${label}… ${Math.round(p * 100)}%`;
  };
  onProgress(0);
  const wasPlaying = player.playing;
  player.pause();
  try {
    const o = options();
    const files = await exportDesign({
      design,
      options: o,
      format: prefs.format,
      fps: prefs.fps,
      sound: prefs.sound,
      watermark: clean ? null : config.domain,
      baseName: `${design.id}-${slug(o.name) || 'channel'}${clean ? '' : '-watermarked'}`,
      onProgress,
      signal: ctrl.signal,
    });
    files.forEach((f, i) => setTimeout(() => download(f.blob, f.name), i * 400));
    say(files.length > 1 ? `Downloaded ${files.map((f) => f.name).join(' and ')}.` : `Downloaded ${files[0].name}.`, 'good');
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error(err);
      say(err.message || 'The export failed. Try again, or try a different file type.', 'error');
    } else say('Export cancelled.');
  } finally {
    exporting = null;
    $('[data-progress]').hidden = true;
    buttons.forEach((b) => (b.disabled = false));
    updateExportUi();
    if (wasPlaying) player.play();
  }
}
for (const b of document.querySelectorAll('[data-export]')) b.addEventListener('click', () => runExport(b.dataset.export));
$('[data-cancel]').addEventListener('click', () => exporting?.abort());

for (const b of document.querySelectorAll('[data-buy]')) {
  b.addEventListener('click', () =>
    buy(b.dataset.buy, {
      status: $('[data-status]'),
      button: b,
      onUnlocked: async () => setUnlocked(await unlockedDesigns({ refresh: false })),
    }),
  );
}

// ---------------------------------------------------------------- start

await state.loadSavedAvatar();
updateExportUi();
setPlayingUi();
await refresh();
setUnlocked(await unlockedDesigns());
caps = await capabilities({ fps: 60 });
updateExportUi();
// Lets tests and curious visitors see what this browser can do.
root.dataset.ready = 'true';
