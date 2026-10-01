// Without a valid signed unlock there is no way to get a clean export
// through the page: no flag, URL parameter or storage edit gives one.

import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const devKeys = () => JSON.parse(fs.readFileSync(new URL('../.dev/keys.json', import.meta.url)));

async function sign(privateJwk, payload) {
  const key = await crypto.subtle.importKey('jwk', privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const body = Buffer.from(JSON.stringify(payload));
  return `${b64url(body)}.${b64url(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, body))}`;
}

async function withStoredToken(page, token) {
  await page.addInitScript((t) => {
    localStorage.setItem('unlocks:v1', JSON.stringify([{ key: 'FAKE-KEY', token: t }]));
  }, token);
}

async function expectLocked(page, path = '/designs/subscribe-pop/') {
  await page.goto(path);
  await page.waitForSelector('[data-design][data-ready]');
  await expect(page.locator('[data-locked]')).toBeVisible();
  await expect(page.locator('[data-unlocked]')).toBeHidden();
}

test('no unlock: only the watermarked download is offered', async ({ page }) => {
  await expectLocked(page, '/designs/subscribe-pop/?unlocked=1&clean=true#unlocked');
});

test('a token signed with a different key is ignored', async ({ page }) => {
  const forger = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
  const jwk = await crypto.subtle.exportKey('jwk', forger.privateKey);
  const exp = Math.floor(Date.now() / 1000) + 86400;
  await withStoredToken(page, await sign(jwk, { packs: ['studio'], designs: [], iat: 0, exp }));
  await expectLocked(page);
});

test('an edited token is ignored', async ({ page }) => {
  const exp = Math.floor(Date.now() / 1000) + 86400;
  const real = await sign(devKeys().privateJwk, { packs: [], designs: ['like-bell'], iat: 0, exp });
  const [, sig] = real.split('.');
  const edited = `${b64url(JSON.stringify({ packs: ['studio'], designs: [], iat: 0, exp }))}.${sig}`;
  await withStoredToken(page, edited);
  await expectLocked(page);
});

test('an expired token is ignored (and a fake key cannot renew it)', async ({ page }) => {
  const token = await sign(devKeys().privateJwk, { packs: ['studio'], designs: [], iat: 0, exp: 1000 });
  await withStoredToken(page, token);
  await expectLocked(page);
});

test('a valid token for another design does not unlock this one', async ({ page }) => {
  const exp = Math.floor(Date.now() / 1000) + 20 * 86400;
  await withStoredToken(page, await sign(devKeys().privateJwk, { packs: [], designs: ['like-bell'], iat: 0, exp }));
  await expectLocked(page, '/designs/subscribe-pop/');
  await page.goto('/designs/like-bell/');
  await page.waitForSelector('[data-design][data-ready]');
  await expect(page.locator('[data-unlocked]')).toBeVisible();
});

test('un-hiding the clean button in the page does not give a clean file', async ({ page }) => {
  await page.goto('/designs/subscribe-pop/');
  await page.waitForSelector('[data-design][data-ready]');
  await page.evaluate(() => {
    document.querySelector('[data-unlocked]').hidden = false;
  });
  let downloaded = false;
  page.on('download', () => (downloaded = true));
  await page.locator('[data-export="clean"]').click();
  await expect(page.locator('[data-status]')).toContainText('isn’t unlocked');
  await page.waitForTimeout(1000);
  expect(downloaded).toBe(false);
});

test('watermarked frames really carry the watermark', async ({ page }) => {
  await page.goto('/__test/');
  await page.waitForFunction(() => window.harnessReady);
  // Share of non-transparent pixels in the top 400 rows, which the design
  // never touches: only the watermark can put anything there.
  const coverTop = (wm) =>
    page.evaluate(async (wm) => {
      const url = await window.harness.frame('subscribe-pop', 2.6, { watermark: wm });
      const img = new Image();
      img.src = url;
      await img.decode();
      const c = new OffscreenCanvas(1920, 1080);
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, 1920, 400).data;
      let covered = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 0) covered++;
      return covered / (1920 * 400);
    }, wm);
  expect(await coverTop(null)).toBe(0);
  expect(await coverTop('sitename.com')).toBeGreaterThan(0.03);
});
