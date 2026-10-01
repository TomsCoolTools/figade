// A stand-in for Lemon Squeezy, used only by the dev server and tests. It
// mimics the parts the store relies on: a checkout that sends signed
// webhooks with the checkout's custom data, and the public licence API
// (activate / validate) with activation limits and refunds.
//
// Shapes follow https://docs.lemonsqueezy.com/api/license-api and the
// webhook docs; Phase 0 confirms them against a real test-mode store.

import fs from 'node:fs';

export function createMockLemon({ config, secret, deliverWebhook, stateFile }) {
  const storeId = Number(config.lemonSqueezy.storeId);
  let state = { nextOrder: 5000, keys: {} };
  if (stateFile && fs.existsSync(stateFile)) state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  const persist = () => stateFile && fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));

  async function sign(body) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return [...new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(body)))].map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  async function send(event_name, data, custom_data) {
    const body = JSON.stringify({ meta: { event_name, custom_data, test_mode: true }, data });
    return deliverWebhook(body, await sign(body));
  }

  // Simulates a successful payment for a product, sending the same webhooks
  // Lemon Squeezy sends. Returns the new licence key.
  async function pay(productId, claim) {
    const p = config.products.find((x) => x.id === productId);
    if (!p) throw new Error('Unknown product');
    const orderId = state.nextOrder++;
    const key = crypto.randomUUID().toUpperCase();
    state.keys[key] = { orderId, variantId: p.variantId, productId: p.id, status: 'active', instances: [] };
    persist();
    const custom = claim ? { claim } : undefined;
    await send('order_created', {
      type: 'orders', id: String(orderId),
      attributes: { store_id: storeId, status: 'paid', refunded: false, total: p.price * 100, first_order_item: { order_id: orderId, variant_id: p.variantId, product_name: p.id } },
    }, custom);
    await send('license_key_created', {
      type: 'license-keys', id: String(orderId * 10),
      attributes: { store_id: storeId, order_id: orderId, key, status: 'inactive', activation_limit: config.activationLimit },
    }, custom);
    return key;
  }

  async function refund(key) {
    const k = state.keys[key];
    if (!k) throw new Error('Unknown key');
    k.status = 'disabled';
    persist();
    await send('order_refunded', { type: 'orders', id: String(k.orderId), attributes: { store_id: storeId, refunded: true, status: 'refunded' } });
  }

  function licenceBody(key, k, extra) {
    return {
      ...extra,
      license_key: { id: k.orderId * 10, status: k.status, key, activation_limit: config.activationLimit, activation_usage: k.instances.length },
      meta: { store_id: storeId, order_id: k.orderId, variant_id: k.variantId, product_name: k.productId },
    };
  }

  function activate(params) {
    const key = params.get('license_key');
    const k = state.keys[key];
    if (!k) return [404, { activated: false, error: 'license_key not found.' }];
    if (k.status === 'disabled') return [400, licenceBody(key, k, { activated: false, error: 'This license key is disabled.' })];
    if (k.instances.length >= config.activationLimit) return [400, licenceBody(key, k, { activated: false, error: 'This license key has reached the activation limit.' })];
    const instance = { id: crypto.randomUUID(), name: params.get('instance_name') };
    k.instances.push(instance);
    k.status = 'active';
    persist();
    return [200, licenceBody(key, k, { activated: true, error: null, instance })];
  }

  function validate(params) {
    const key = params.get('license_key');
    const k = state.keys[key];
    if (!k) return [404, { valid: false, error: 'license_key not found.' }];
    const inst = k.instances.find((i) => i.id === params.get('instance_id'));
    if (!inst) return [404, licenceBody(key, k, { valid: false, error: 'license_key instance not found.' })];
    if (k.status === 'disabled') return [400, licenceBody(key, k, { valid: false, error: 'This license key is disabled.' })];
    return [200, licenceBody(key, k, { valid: true, error: null, instance: inst })];
  }

  const checkoutPage = (product, claim) => {
    const p = config.products.find((x) => x.id === product);
    return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Test checkout</title>
<style>body{margin:0;font:16px/1.45 system-ui,sans-serif;color:#1d1c1a;padding:28px}h1{font-size:20px;margin:0 0 4px}
.note{background:#fff4dc;border:1px solid #f0c36b;padding:10px 12px;border-radius:6px;margin:16px 0}
button{font:inherit;font-weight:600;padding:12px 16px;border-radius:6px;border:0;background:#5423e7;color:#fff;width:100%;cursor:pointer;margin-top:8px}
.quiet{background:#eee;color:#1d1c1a}</style>
<h1>${p ? p.id : 'Unknown product'}</h1><p>$${p ? p.price : '?'}.00</p>
<p class="note">Test checkout from the dev server. No real payment is taken. In production this is the Lemon Squeezy overlay.</p>
<button id="pay">Pay $${p ? p.price : '?'} (test)</button><button class="quiet" id="close">Close</button>
<script>
document.getElementById('pay').onclick = async (e) => {
  e.target.disabled = true; e.target.textContent = 'Paying…';
  const r = await fetch('/mock-ls/pay', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ product: ${JSON.stringify(product)}, claim: ${JSON.stringify(claim)} }) });
  if (r.ok) parent.postMessage({ type: 'mock-checkout-success' }, location.origin);
  else e.target.textContent = 'Payment failed';
};
document.getElementById('close').onclick = () => parent.postMessage({ type: 'mock-checkout-closed' }, location.origin);
</script>`;
  };

  // Node http handler for /mock-ls/*
  async function handle(req, res, url, rawBody) {
    const send = (status, body, type = 'application/json') => {
      res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
      res.end(type === 'application/json' ? JSON.stringify(body) : body);
    };
    const path = url.pathname.replace('/mock-ls', '');
    if (path === '/checkout') return send(200, checkoutPage(url.searchParams.get('product'), url.searchParams.get('claim')), 'text/html; charset=utf-8');
    if (path === '/pay' && req.method === 'POST') {
      const { product, claim } = JSON.parse(rawBody || '{}');
      try {
        return send(200, { key: await pay(product, claim) });
      } catch (e) {
        return send(400, { error: e.message });
      }
    }
    if (path === '/refund' && req.method === 'POST') {
      await refund(JSON.parse(rawBody || '{}').key);
      return send(200, { ok: true });
    }
    if (path === '/v1/licenses/activate' && req.method === 'POST') return send(...activate(new URLSearchParams(rawBody)));
    if (path === '/v1/licenses/validate' && req.method === 'POST') return send(...validate(new URLSearchParams(rawBody)));
    return send(404, { error: 'not found' });
  }

  return { handle, pay, refund, state: () => state };
}
