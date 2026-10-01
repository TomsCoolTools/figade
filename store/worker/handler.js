// The store's only server code: confirms payments and issues unlock tokens.
// Runs as a Cloudflare Pages Function (functions/api/[[path]].js) with a D1
// database. Stores no customer emails or files.
//
//   POST /api/webhook       Lemon Squeezy webhooks (signature checked)
//   GET  /api/claim/:id     licence key for a checkout this browser started
//   POST /api/unlock        licence key -> signed unlock token
//
// env: DB (D1), LS_WEBHOOK_SECRET, UNLOCK_PRIVATE_KEY (JWK JSON),
//      LS_API_BASE (optional, for tests), STORE_ID (optional override)

import config from '../store.config.js';

const TOKEN_DAYS = 30;
const CLAIM_TTL = 24 * 3600;
const LIMITS = { claim: 60, unlock: 20 }; // requests per minute per IP

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

const now = () => Math.floor(Date.now() / 1000);
const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS claims (claim TEXT PRIMARY KEY, order_id INTEGER, license_key TEXT, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS orders (order_id INTEGER PRIMARY KEY, variant_id INTEGER, refunded INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS rate (bucket TEXT PRIMARY KEY, count INTEGER NOT NULL, reset_at INTEGER NOT NULL);
`;

// ---------------------------------------------------------------- helpers

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function hmacHex(secret, body) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(body)));
}

async function sha256Hex(s) {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
}

export async function signToken(privateJwk, payload) {
  const key = await crypto.subtle.importKey('jwk', privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const body = enc.encode(JSON.stringify(payload));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, body);
  return `${b64url(body)}.${b64url(sig)}`;
}

// What a product unlocks. Packs are listed by id and expanded in the browser,
// so designs added to a pack later unlock for existing buyers.
export function entitlementFor(variantId) {
  const p = config.products.find((x) => Number(x.variantId) === Number(variantId));
  if (!p) return null;
  return p.kind === 'pack' ? { packs: [p.id], designs: [] } : { packs: [], designs: [p.id] };
}

async function rateLimited(env, request, name) {
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'local';
  const bucket = `${name}:${ip}`;
  const t = now();
  const row = await env.DB.prepare('SELECT count, reset_at FROM rate WHERE bucket = ?').bind(bucket).first();
  if (!row || row.reset_at <= t) {
    await env.DB.prepare('INSERT OR REPLACE INTO rate (bucket, count, reset_at) VALUES (?, 1, ?)').bind(bucket, t + 60).run();
    return false;
  }
  if (row.count >= LIMITS[name]) return true;
  await env.DB.prepare('UPDATE rate SET count = count + 1 WHERE bucket = ?').bind(bucket).run();
  return false;
}

const storeId = (env) => Number(env.STORE_ID ?? config.lemonSqueezy.storeId);

// ---------------------------------------------------------------- routes

async function webhook(request, env) {
  const raw = await request.text();
  const sig = request.headers.get('x-signature') || '';
  if (!env.LS_WEBHOOK_SECRET || !timingSafeEqual(await hmacHex(env.LS_WEBHOOK_SECRET, raw), sig)) {
    return json({ error: 'Bad signature' }, 401);
  }
  let evt;
  try {
    evt = JSON.parse(raw);
  } catch {
    return json({ error: 'Bad JSON' }, 400);
  }
  const name = evt?.meta?.event_name;
  const claim = evt?.meta?.custom_data?.claim;
  const a = evt?.data?.attributes || {};
  const t = now();
  if (Number(a.store_id) !== storeId(env)) return json({ ok: true, ignored: 'other store' });

  if (name === 'order_created') {
    const orderId = Number(evt.data.id);
    const variantId = a.first_order_item?.variant_id;
    await env.DB.prepare('INSERT OR REPLACE INTO orders (order_id, variant_id, refunded, created_at) VALUES (?, ?, ?, ?)')
      .bind(orderId, variantId, a.refunded ? 1 : 0, t).run();
    if (claim) {
      await env.DB.prepare('INSERT INTO claims (claim, order_id, created_at) VALUES (?, ?, ?) ON CONFLICT(claim) DO UPDATE SET order_id = excluded.order_id')
        .bind(String(claim), orderId, t).run();
    }
  } else if (name === 'license_key_created') {
    if (claim) {
      await env.DB.prepare('INSERT INTO claims (claim, order_id, license_key, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(claim) DO UPDATE SET license_key = excluded.license_key')
        .bind(String(claim), Number(a.order_id), String(a.key), t).run();
    }
  } else if (name === 'order_refunded') {
    await env.DB.prepare('UPDATE orders SET refunded = 1 WHERE order_id = ?').bind(Number(evt.data.id)).run();
  }
  // Claims are only needed for the few seconds after checkout.
  await env.DB.prepare('DELETE FROM claims WHERE created_at < ?').bind(t - CLAIM_TTL).run();
  await env.DB.prepare('DELETE FROM rate WHERE reset_at < ?').bind(t).run();
  return json({ ok: true });
}

async function claimKey(request, env, claim) {
  if (await rateLimited(env, request, 'claim')) return json({ error: 'Too many requests. Wait a minute and try again.' }, 429);
  if (!/^[0-9a-f-]{36}$/i.test(claim)) return json({ error: 'Unknown checkout' }, 404);
  const row = await env.DB.prepare('SELECT license_key FROM claims WHERE claim = ? AND created_at > ?').bind(claim, now() - CLAIM_TTL).first();
  if (!row?.license_key) return json({ pending: true }, 202);
  return json({ licenseKey: row.license_key });
}

async function lemon(env, path, params) {
  const base = env.LS_API_BASE || 'https://api.lemonsqueezy.com';
  const res = await fetch(`${base}/v1/licenses/${path}`, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function unlock(request, env) {
  if (await rateLimited(env, request, 'unlock')) return json({ error: 'Too many attempts. Wait a minute and try again.' }, 429);
  const { licenseKey, instanceId } = await request.json().catch(() => ({}));
  const key = String(licenseKey || '').trim();
  if (!key || key.length > 100) return json({ error: "That doesn't look like a licence key. Copy it from your receipt email." }, 400);

  // Each browser is one activation; later visits validate the same instance.
  let res;
  if (instanceId) {
    res = await lemon(env, 'validate', { license_key: key, instance_id: instanceId });
    if (!res.body.valid && /instance/i.test(res.body.error || '')) res = null; // instance gone: activate again
  }
  if (!res) {
    res = await lemon(env, 'activate', { license_key: key, instance_name: `browser-${crypto.randomUUID().slice(0, 8)}` });
  }
  const b = res.body;
  const ok = b.valid ?? b.activated;
  if (!ok) {
    const msg = String(b.error || '');
    if (/limit/i.test(msg)) {
      return json({ error: `This key has already unlocked ${config.activationLimit} browsers. Email ${config.supportEmail} and we'll reset it.` }, 403);
    }
    if (b.license_key?.status === 'disabled') return json({ error: 'This key has been disabled, usually because the order was refunded.' }, 403);
    return json({ error: "That key wasn't recognised. Copy it exactly from your receipt email." }, 400);
  }
  if (Number(b.meta?.store_id) !== storeId(env)) return json({ error: "That key is for a different store." }, 400);
  if (['disabled', 'expired'].includes(b.license_key?.status)) return json({ error: 'This key is no longer active.' }, 403);
  const order = await env.DB.prepare('SELECT refunded FROM orders WHERE order_id = ?').bind(Number(b.meta.order_id)).first();
  if (order?.refunded) return json({ error: 'This order was refunded, so the key no longer unlocks downloads.' }, 403);

  const ent = entitlementFor(b.meta.variant_id);
  if (!ent) return json({ error: "That key is for a product this store doesn't sell any more." }, 400);
  const t = now();
  const token = await signToken(JSON.parse(env.UNLOCK_PRIVATE_KEY), {
    ...ent,
    kh: (await sha256Hex(key)).slice(0, 16),
    iat: t,
    exp: t + TOKEN_DAYS * 24 * 3600,
  });
  return json({ token, instanceId: b.instance?.id ?? instanceId });
}

export async function handle(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '');
  try {
    if (path === '/api/webhook' && request.method === 'POST') return await webhook(request, env);
    if (path === '/api/unlock' && request.method === 'POST') return await unlock(request, env);
    const m = path.match(/^\/api\/claim\/([^/]+)$/);
    if (m && request.method === 'GET') return await claimKey(request, env, decodeURIComponent(m[1]));
    return json({ error: 'Not found' }, 404);
  } catch (err) {
    console.error(err);
    return json({ error: 'The store hit a problem. Try again in a minute.' }, 500);
  }
}

export default { fetch: handle };
