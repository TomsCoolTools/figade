// Worker tests: run with `npm run test:worker`. Uses the real handler, an
// in-memory SQLite database and the mock Lemon Squeezy on a local port.

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import config from '../../store.config.js';
import { handle, SCHEMA } from '../handler.js';
import { createD1 } from '../d1-node.js';
import { createMockLemon } from '../mock-lemonsqueezy.js';
import { makeKeyPair } from '../../scripts/keys.js';

const SECRET = 'test-secret';

async function setup() {
  const DB = createD1();
  await DB.exec(SCHEMA);
  const keys = await makeKeyPair();
  const env = { DB, LS_WEBHOOK_SECRET: SECRET, UNLOCK_PRIVATE_KEY: JSON.stringify(keys.privateJwk) };
  const deliverWebhook = async (body, sig) => {
    const r = await handle(new Request('http://x/api/webhook', { method: 'POST', headers: { 'x-signature': sig }, body }), env);
    assert.equal(r.status, 200, 'webhook accepted');
  };
  const mock = createMockLemon({ config, secret: SECRET, deliverWebhook });
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    mock.handle(req, res, new URL(req.url, 'http://x'), Buffer.concat(chunks).toString());
  });
  await new Promise((r) => server.listen(0, r));
  env.LS_API_BASE = `http://localhost:${server.address().port}/mock-ls`;
  const call = (path, init = {}, ip = '1.1.1.1') =>
    handle(new Request(`http://x${path}`, { ...init, headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip, ...init.headers } }), env);
  const unlock = (licenseKey, instanceId, ip) => call('/api/unlock', { method: 'POST', body: JSON.stringify({ licenseKey, instanceId }) }, ip);
  return { env, mock, call, unlock, keys, close: () => server.close() };
}

async function verify(publicJwk, token) {
  const b = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
  const [p, s] = token.split('.');
  const key = await crypto.subtle.importKey('jwk', publicJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, b(s), b(p));
  return ok ? JSON.parse(new TextDecoder().decode(b(p))) : null;
}

test('webhooks with a bad signature are rejected', async () => {
  const t = await setup();
  const r = await t.call('/api/webhook', { method: 'POST', headers: { 'x-signature': 'nope' }, body: '{"meta":{}}' });
  assert.equal(r.status, 401);
  t.close();
});

test('a paid checkout can be claimed, and the key unlocks the right design', async () => {
  const t = await setup();
  const claim = crypto.randomUUID();
  const pending = await t.call(`/api/claim/${claim}`);
  assert.equal(pending.status, 202, 'nothing to claim before payment');
  const key = await t.mock.pay('follow-card', claim);
  const claimed = await (await t.call(`/api/claim/${claim}`)).json();
  assert.equal(claimed.licenseKey, key);
  const res = await t.unlock(key);
  assert.equal(res.status, 200);
  const { token, instanceId } = await res.json();
  assert.ok(instanceId);
  const payload = await verify(t.keys.publicJwk, token);
  assert.deepEqual(payload.designs, ['follow-card']);
  assert.deepEqual(payload.packs, []);
  assert.ok(payload.exp - payload.iat === 30 * 24 * 3600);
  t.close();
});

test('a pack key unlocks the pack by id', async () => {
  const t = await setup();
  const key = await t.mock.pay('studio');
  const { token } = await (await t.unlock(key)).json();
  assert.deepEqual((await verify(t.keys.publicJwk, token)).packs, ['studio']);
  t.close();
});

test('a token signed with another key fails verification', async () => {
  const t = await setup();
  const key = await t.mock.pay('like-bell');
  const { token } = await (await t.unlock(key)).json();
  const other = await makeKeyPair();
  assert.equal(await verify(other.publicJwk, token), null);
  t.close();
});

test('the same browser revalidates without using another activation', async () => {
  const t = await setup();
  const key = await t.mock.pay('subscribe-pop');
  const first = await (await t.unlock(key)).json();
  const again = await t.unlock(key, first.instanceId);
  assert.equal(again.status, 200);
  assert.equal(t.mock.state().keys[key].instances.length, 1);
  t.close();
});

test('the activation limit stops a key being shared widely', async () => {
  const t = await setup();
  const key = await t.mock.pay('subscribe-pop');
  for (let i = 0; i < config.activationLimit; i++) assert.equal((await t.unlock(key, undefined, `9.9.9.${i}`)).status, 200);
  const r = await t.unlock(key, undefined, '8.8.8.8');
  assert.equal(r.status, 403);
  assert.match((await r.json()).error, /already unlocked/);
  t.close();
});

test('a refunded order gets no new token', async () => {
  const t = await setup();
  const key = await t.mock.pay('lower-third');
  const { instanceId } = await (await t.unlock(key)).json();
  await t.mock.refund(key);
  const r = await t.unlock(key, instanceId);
  assert.equal(r.status, 403);
  t.close();
});

test('unknown keys and junk are rejected with a helpful message', async () => {
  const t = await setup();
  const r = await t.unlock('NOT-A-REAL-KEY');
  assert.equal(r.status, 400);
  assert.match((await r.json()).error, /wasn't recognised/);
  assert.equal((await t.unlock('')).status, 400);
  t.close();
});

test('webhooks from another store are ignored', async () => {
  const t = await setup();
  const body = JSON.stringify({ meta: { event_name: 'license_key_created', custom_data: { claim: crypto.randomUUID() } }, data: { attributes: { store_id: 999, key: 'X', order_id: 1 } } });
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey('raw', enc.encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = [...new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(body)))].map((b) => b.toString(16).padStart(2, '0')).join('');
  const r = await (await t.call('/api/webhook', { method: 'POST', headers: { 'x-signature': sig }, body })).json();
  assert.equal(r.ignored, 'other store');
  t.close();
});

test('unlock attempts are rate limited per IP', async () => {
  const t = await setup();
  let last;
  for (let i = 0; i < 21; i++) last = await t.unlock('NOPE', undefined, '5.5.5.5');
  assert.equal(last.status, 429);
  assert.notEqual((await t.unlock('NOPE', undefined, '5.5.5.6')).status, 429, 'other IPs unaffected');
  t.close();
});
