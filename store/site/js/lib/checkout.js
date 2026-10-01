// Checkout without accounts. The page makes a random claim id, opens the
// payment overlay (Lemon Squeezy in production, a local test checkout in
// dev), then asks the Worker for the licence key that the payment webhook
// filed under that claim id. The page never reloads, so the visitor's
// picture and settings are still there afterwards.

import config from '../../../store.config.js';
import { unlockWithKey, UnlockError } from './unlock.js';

const product = (id) => config.products.find((p) => p.id === id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function lemonUrl(p, claim) {
  const u = new URL(`https://${config.lemonSqueezy.storeSlug}.lemonsqueezy.com/buy/${p.checkoutId}`);
  u.searchParams.set('embed', '1');
  u.searchParams.set('media', '0');
  u.searchParams.set('checkout[custom][claim]', claim);
  return u.toString();
}

let lemonReady;
function loadLemon() {
  lemonReady ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://app.lemonsqueezy.com/js/lemon.js';
    s.defer = true;
    s.onload = () => {
      window.createLemonSqueezy?.();
      resolve(window.LemonSqueezy);
    };
    s.onerror = () => reject(new Error("The payment window couldn't load. Check your connection or ad blocker and try again."));
    document.head.append(s);
  });
  return lemonReady;
}

// Resolves when payment succeeds. Lemon.js doesn't report the overlay being
// closed, so in production an abandoned checkout simply never resolves.
async function openPayment(p, claim) {
  // eslint-disable-next-line no-undef
  if (__DEV__) return openTestCheckout(p, claim);
  const LS = await loadLemon();
  return new Promise((resolve, reject) => {
    LS.Setup({
      eventHandler: (e) => {
        if (e.event === 'Checkout.Success') resolve();
      },
    });
    LS.Url.Open(lemonUrl(p, claim));
  });
}

// Dev-only stand-in for the Lemon Squeezy overlay (served by scripts/dev.js).
function openTestCheckout(p, claim) {
  return new Promise((resolve, reject) => {
    const sheet = document.createElement('div');
    sheet.className = 'sheet';
    sheet.innerHTML = `<iframe title="Test checkout" src="/mock-ls/checkout?product=${encodeURIComponent(p.id)}&claim=${encodeURIComponent(claim)}"></iframe>`;
    const done = (ok) => {
      removeEventListener('message', onMsg);
      sheet.remove();
      ok ? resolve() : reject(null);
    };
    const onMsg = (e) => {
      if (e.origin !== location.origin) return;
      if (e.data?.type === 'mock-checkout-success') done(true);
      if (e.data?.type === 'mock-checkout-closed') done(false);
    };
    addEventListener('message', onMsg);
    sheet.addEventListener('click', (e) => e.target === sheet && done(false));
    document.body.append(sheet);
  });
}

// Polls for the licence key the webhook stored, for up to 90 seconds.
async function waitForKey(claim) {
  const until = Date.now() + 90_000;
  while (Date.now() < until) {
    try {
      const res = await fetch(`/api/claim/${encodeURIComponent(claim)}`);
      if (res.ok) {
        const body = await res.json();
        if (body.licenseKey) return body.licenseKey;
      }
    } catch {
      // keep trying
    }
    await sleep(2000);
  }
  return null;
}

function say(status, text, kind) {
  if (!status) return;
  status.textContent = text;
  status.classList.toggle('is-error', kind === 'error');
  status.classList.toggle('is-good', kind === 'good');
}

// Runs the whole purchase. Returns the set of designs now unlocked, or null.
export async function buy(productId, { status, button, onUnlocked } = {}) {
  const p = product(productId);
  if (!p) throw new Error(`Unknown product ${productId}`);
  const claim = crypto.randomUUID();
  try {
    say(status, 'Checkout is open. This page unlocks by itself once you have paid.');
    try {
      await openPayment(p, claim);
    } catch (err) {
      say(status, err ? err.message : '', err ? 'error' : undefined);
      return null;
    }
    if (button) button.disabled = true;
    say(status, 'Confirming payment…');
    const key = await waitForKey(claim);
    if (!key) {
      say(status, 'Payment received. Your licence key is on its way to your email. Paste it into "Already bought?" to unlock.', 'error');
      return null;
    }
    const { designs } = await unlockWithKey(key);
    say(status, 'Unlocked. Your downloads are clean now.', 'good');
    onUnlocked?.(designs);
    return designs;
  } catch (err) {
    say(status, err instanceof UnlockError ? err.message : 'Something went wrong while unlocking. Your key is in your receipt email.', 'error');
    return null;
  } finally {
    if (button) button.disabled = false;
  }
}
