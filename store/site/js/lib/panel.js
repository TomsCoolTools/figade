// Builds the "Effect controls" rows from a design's option schema. Text,
// subscriber, picture and colour options go under "Your details" or "Style";
// shared options write to the visitor's shared details so every design fills in.

import * as state from './state.js';
import { formatSubscribers } from '../../../engine/text.js';

let uid = 0;
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  e.append(...kids.filter((k) => k != null));
  return e;
};

export function buildPanel(design, { details, style, values, onChange }) {
  const write = (key, o, value) => {
    if (o.shared) state.setShared({ [o.shared]: value });
    else state.setOwn(design.id, { [key]: value });
    onChange?.();
  };

  for (const [key, o] of Object.entries(design.options)) {
    const v = values[key];
    if (o.type === 'text' || o.type === 'subscribers') {
      const input = el('input', {
        class: 'input', type: 'text', value: v ?? '', maxlength: o.type === 'text' ? o.max : 20,
        autocomplete: 'off', spellcheck: 'false', 'data-opt': key,
      });
      let note = null;
      if (o.type === 'subscribers') note = el('span', { class: 'field-note' }, formatSubscribers(v) || 'Hidden');
      input.addEventListener('input', () => {
        if (note) note.textContent = formatSubscribers(input.value) || 'Hidden';
        write(key, o, input.value);
      });
      input.id = `opt-${++uid}`;
      const cell = note ? el('div', { style: 'display: grid; gap: 4px' }, input, note) : input;
      details.append(el('div', { class: 'row' }, el('label', { class: 'field-label', for: input.id }, o.label), cell));
    } else if (o.type === 'image') {
      const thumb = el('img', { class: 'avatar-thumb', alt: '', hidden: !state.getShared().avatarData });
      if (state.getShared().avatarData) thumb.src = state.getShared().avatarData;
      const file = el('input', { type: 'file', accept: 'image/*', 'aria-label': 'Upload a profile picture' });
      const label = el('span', {}, state.hasAvatar() ? 'Change' : 'Upload');
      const pick = el('span', { class: 'btn btn-quiet file-btn', style: 'min-height: 40px; padding: 0 14px' }, label, file);
      const remove = el('button', { type: 'button', class: 'link-btn', hidden: !state.hasAvatar() }, 'Remove');
      const msg = el('p', { class: 'field-note', role: 'status' });
      file.addEventListener('change', async () => {
        const f = file.files[0];
        if (!f) return;
        try {
          await state.setAvatarFile(f);
          thumb.src = state.getShared().avatarData;
          thumb.hidden = false;
          remove.hidden = false;
          label.textContent = 'Change';
          msg.textContent = '';
        } catch {
          msg.textContent = "That image couldn't be read. Try a JPG or PNG.";
        }
        file.value = '';
        onChange?.();
      });
      remove.addEventListener('click', () => {
        state.clearAvatar();
        thumb.hidden = true;
        remove.hidden = true;
        label.textContent = 'Upload';
        onChange?.();
      });
      const box = el('div', { class: 'avatar-row', id: `opt-${++uid}` }, thumb, pick, remove);
      const r = el('div', { class: 'row' }, el('span', { class: 'field-label' }, o.label), box);
      details.append(r, msg);
      if (!state.hasAvatar()) details.append(el('p', { class: 'field-note', style: 'margin: -6px 0 12px' }, 'No picture? Your initials are used on a coloured circle.'));
    } else if (o.type === 'choice') {
      const seg = el('div', { class: 'seg', role: 'group', 'aria-label': o.label, id: `opt-${++uid}` });
      for (const c of o.choices) {
        const b = el('button', { type: 'button', 'aria-pressed': String(c.value === v), 'data-value': c.value }, c.label);
        b.addEventListener('click', () => {
          for (const x of seg.children) x.setAttribute('aria-pressed', String(x === b));
          write(key, o, c.value);
        });
        seg.append(b);
      }
      style.append(el('div', { class: 'row' }, el('span', { class: 'field-label' }, o.label), seg));
    } else if (o.type === 'colour') {
      const input = el('input', { type: 'color', value: (v || '#FF0033').toLowerCase(), 'aria-label': o.label, 'data-opt': key });
      const hex = el('span', { class: 'tc' }, (v || '').toUpperCase());
      input.addEventListener('input', () => {
        hex.textContent = input.value.toUpperCase();
        write(key, o, input.value.toUpperCase());
      });
      input.id = `opt-${++uid}`;
      style.append(el('div', { class: 'row' }, el('label', { class: 'field-label', for: input.id }, o.label), el('span', { class: 'colour-row' }, input, hex)));
    }
  }
}

// A segmented control in the page's markup: wires aria-pressed and returns
// a getter/setter.
export function segmented(root, initial, onPick) {
  const buttons = [...root.querySelectorAll('button')];
  const set = (value) => buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === String(value))));
  set(initial);
  buttons.forEach((b) => b.addEventListener('click', () => {
    if (b.disabled) return;
    set(b.dataset.value);
    onPick(b.dataset.value);
  }));
  return { set, buttons };
}
