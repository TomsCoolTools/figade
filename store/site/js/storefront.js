// Storefront: the timeline plays each design in turn in the program monitor,
// with the visitor's own name and picture once they've typed them.

import { catalogue } from '../../catalogue.js';
import { resolveOptions } from '../../engine/define.js';
import { Player, timecode } from './lib/player.js';
import * as state from './lib/state.js';
import { buy } from './lib/checkout.js';
import { footageUrl } from './lib/footage.js';

const $ = (s, el = document) => el.querySelector(s);
const timeline = $('[data-timeline]');
const clips = [...document.querySelectorAll('[data-clip]')];
const CLIP = 5; // seconds per clip on the timeline
const total = catalogue.length * CLIP;
const coarse = matchMedia('(pointer: coarse)');

let active = 0;
let hovering = null;
let seqT = 0; // time along the whole timeline

const player = new Player($('[data-monitor]'), {
  motionBlur: false,
  loopGap: 0,
  onTime: (t) => {
    $('[data-tc]').textContent = timecode(active * CLIP + t);
  },
});
player.loopGap = 0.25;
// The storefront shows the designs zoomed in over stand-in footage. It isn't
// watermarked: a small marketing preview can't stand in for an export, while
// design pages (full frame, the visitor's own details) are watermarked.
$('.screen').style.backgroundImage = `url(${footageUrl()})`;
$('.screen').style.backgroundSize = 'cover';

function optionsFor(design) {
  return resolveOptions(design, state.getShared(), state.getOwn(design.id));
}

async function activate(i, { restart = true } = {}) {
  active = i;
  const { design } = catalogue[i];
  clips.forEach((c) => c.classList.toggle('is-active', Number(c.dataset.clip) === i));
  $('[data-active-name]').textContent = design.name;
  $('[data-zoom]').textContent = `Zoom ${Math.round((design.showcase.w ? 1920 / design.showcase.w : 1) * 100)}%`;
  player.setView(design.showcase);
  if (restart) player.seek(0);
  await player.show(design, optionsFor(design));
}

// Advance the playhead across the staircase of clips. Hovering a clip holds
// the playhead inside it so that design keeps looping.
let last = performance.now();
function tick(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (player.playing) {
    const d = catalogue[active].design.duration;
    if (hovering !== null) {
      seqT = active * CLIP + (player.t % d);
    } else {
      seqT = (seqT + dt * player.speed) % total;
      const i = Math.floor(seqT / CLIP);
      if (i !== active) activate(i);
      player.seek(seqT - i * CLIP);
    }
  }
  timeline.style.setProperty('--ph', String(seqT / total));
  clips.forEach((c) => c.style.setProperty('--p', Number(c.dataset.clip) === active ? String((seqT % CLIP) / CLIP) : '0'));
  requestAnimationFrame(tick);
}

for (const c of clips) {
  const i = Number(c.dataset.clip);
  c.addEventListener('mouseenter', () => {
    if (coarse.matches) return;
    hovering = i;
    seqT = i * CLIP;
    activate(i);
  });
  c.addEventListener('mouseleave', () => {
    hovering = null;
  });
  c.addEventListener('focus', () => {
    seqT = i * CLIP;
    activate(i);
  });
  // On touch screens the first tap plays the design, the second opens it.
  c.addEventListener('click', (e) => {
    if (coarse.matches && active !== i) {
      e.preventDefault();
      seqT = i * CLIP;
      activate(i);
    }
  });
}

// Quick details: name and picture, shared with every design page.
const form = $('[data-quick]');
form.name.value = state.getShared().name || '';
form.name.addEventListener('input', () => state.setShared({ name: form.name.value }));
const avatarInput = $('[data-avatar-input]');
const avatarLabel = $('[data-avatar-label]');
avatarInput.addEventListener('change', async () => {
  const f = avatarInput.files[0];
  if (!f) return;
  try {
    await state.setAvatarFile(f);
    avatarLabel.textContent = 'Change picture';
  } catch {
    avatarLabel.textContent = "That image couldn't be read";
  }
  avatarInput.value = '';
});
state.onChange(() => player.show(catalogue[active].design, optionsFor(catalogue[active].design)));

for (const b of document.querySelectorAll('[data-buy]')) {
  b.addEventListener('click', () => buy(b.dataset.buy, { status: $('[data-buy-status]'), button: b }));
}

await state.loadSavedAvatar();
if (state.hasAvatar()) avatarLabel.textContent = 'Change picture';
await activate(0);
requestAnimationFrame(tick);
