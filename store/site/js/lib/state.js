// The visitor's details, saved in this browser only. Shared details (name,
// picture, colours...) fill every design; per-design settings stay with it.
// Nothing here is ever sent anywhere.

const KEY = 'details:v1';
const OWN = (id) => `design:${id}:v1`;
const listeners = new Set();

function read(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: details still work for this visit.
  }
}

let shared = read(KEY, {});
let avatarBitmap = null;

export function getShared() {
  return { ...shared, avatar: avatarBitmap };
}

export function setShared(patch) {
  shared = { ...shared, ...patch };
  delete shared.avatar;
  write(KEY, shared);
  listeners.forEach((fn) => fn());
}

export const getOwn = (id) => read(OWN(id), {});
export const setOwn = (id, patch) => {
  write(OWN(id), { ...getOwn(id), ...patch });
  listeners.forEach((fn) => fn());
};

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// The picture is cover-cropped to 512x512 so it is small enough to keep in
// this browser between visits (as a JPEG data URL, about 40-80 KB).
export async function setAvatarFile(file) {
  const src = await createImageBitmap(file);
  const size = 512;
  const c = new OffscreenCanvas(size, size);
  const ctx = c.getContext('2d');
  const k = size / Math.min(src.width, src.height);
  ctx.drawImage(src, (size - src.width * k) / 2, (size - src.height * k) / 2, src.width * k, src.height * k);
  src.close?.();
  avatarBitmap = await createImageBitmap(c);
  const blob = await c.convertToBlob({ type: 'image/jpeg', quality: 0.88 });
  const dataUrl = await new Promise((res) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.readAsDataURL(blob);
  });
  setShared({ avatarData: dataUrl });
}

export function clearAvatar() {
  avatarBitmap = null;
  setShared({ avatarData: null });
}

// Restores the saved picture on page load.
export async function loadSavedAvatar() {
  if (!shared.avatarData) return;
  try {
    const blob = await (await fetch(shared.avatarData)).blob();
    avatarBitmap = await createImageBitmap(blob);
  } catch {
    shared.avatarData = null;
  }
}

export const hasAvatar = () => !!avatarBitmap;
