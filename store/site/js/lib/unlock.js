// Unlocks bought in this browser. A purchase gives a licence key; the Worker
// turns the key into a token signed with the store's private key. A clean
// export is only allowed when a token with a valid signature covers the
// design. The signature is checked every time, never cached as a flag.

import { designsUnlockedBy } from '../../../catalogue.js';

const STORE = 'unlocks:v1';
const REFRESH_BEFORE = 7 * 24 * 3600; // renew tokens in their last week

const b64urlToBytes = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

let keyPromise;
function publicKey() {
  // eslint-disable-next-line no-undef
  keyPromise ??= crypto.subtle.importKey('jwk', __UNLOCK_PUBLIC_KEY__, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  return keyPromise;
}

// Returns the token's payload if its signature is valid and it hasn't
// expired, otherwise null.
export async function verifyToken(token) {
  try {
    const [p, s] = String(token).split('.');
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, await publicKey(), b64urlToBytes(s), b64urlToBytes(p));
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(p)));
    if (!payload.exp || payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORE)) || [];
  } catch {
    return [];
  }
}
function save(list) {
  try {
    localStorage.setItem(STORE, JSON.stringify(list));
  } catch {
    // Unlock still works for this visit.
  }
}

export class UnlockError extends Error {}

// Exchanges a licence key for a token and remembers both.
export async function unlockWithKey(licenseKey) {
  const key = String(licenseKey || '').trim();
  if (!key) throw new UnlockError('Paste the licence key from your receipt email.');
  const list = load();
  const existing = list.find((u) => u.key === key);
  let res;
  try {
    res = await fetch('/api/unlock', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ licenseKey: key, instanceId: existing?.instanceId }),
    });
  } catch {
    throw new UnlockError("Couldn't reach the store. Check your connection and try again.");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new UnlockError(body.error || 'That key could not be checked. Try again in a minute.');
  const payload = await verifyToken(body.token);
  if (!payload) throw new UnlockError('The store sent an unlock this page could not check. Reload and try again.');
  const entry = { key, instanceId: body.instanceId, token: body.token };
  save([entry, ...list.filter((u) => u.key !== key)]);
  return { payload, designs: designsUnlockedBy(payload) };
}

// Every design unlocked in this browser. Renews tokens that are close to
// expiring (this is also how refunds take effect: a refunded key gets no new token).
export async function unlockedDesigns({ refresh = true } = {}) {
  const set = new Set();
  for (const u of load()) {
    let payload = await verifyToken(u.token);
    const due = !payload || payload.exp - Date.now() / 1000 < REFRESH_BEFORE;
    if (due && refresh) {
      try {
        payload = (await unlockWithKey(u.key)).payload;
      } catch (err) {
        if (!payload) console.warn('Unlock renewal failed', err);
      }
    }
    if (payload) for (const d of designsUnlockedBy(payload)) set.add(d);
  }
  return set;
}

// The check made right before a clean export.
export async function canExportClean(designId) {
  return (await unlockedDesigns({ refresh: false })).has(designId);
}

export const savedKeys = () => load().map((u) => u.key);
