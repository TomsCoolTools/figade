// Restore page: paste a licence key to unlock in this browser. Also accepts
// /restore/#key=... (the key stays in the # part, so it never reaches a server log).

import { catalogue } from '../../catalogue.js';
import { unlockWithKey, unlockedDesigns, UnlockError } from './lib/unlock.js';

const $ = (s) => document.querySelector(s);
const form = $('[data-restore]');
const status = $('[data-status]');

function show(set) {
  const list = $('[data-list]');
  list.replaceChildren();
  for (const { design, colour } of catalogue) {
    if (!set.has(design.id)) continue;
    const li = document.createElement('li');
    li.innerHTML = `<a href="/designs/${design.id}/" style="--clip: ${colour}"><span></span><span>Personalise and download</span></a>`;
    li.querySelector('span').textContent = design.name;
    list.append(li);
  }
  $('[data-result]').hidden = !set.size;
}

async function unlock(key) {
  status.className = 'status';
  status.textContent = 'Checking your key…';
  try {
    await unlockWithKey(key);
    status.textContent = 'Unlocked. Pick a design below to download it clean.';
    status.classList.add('is-good');
    show(await unlockedDesigns({ refresh: false }));
  } catch (err) {
    status.textContent = err instanceof UnlockError ? err.message : 'Something went wrong. Try again in a minute.';
    status.classList.add('is-error');
  }
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  unlock(form.key.value);
});

const fromLink = new URLSearchParams(location.hash.slice(1)).get('key');
if (fromLink) {
  form.key.value = fromLink;
  history.replaceState(null, '', location.pathname);
  unlock(fromLink);
} else {
  show(await unlockedDesigns());
}
