// The purchase flow end to end, against the dev server's test checkout:
// buy -> webhook -> claim -> signed unlock -> clean download, plus restoring
// on another browser, packs, and refunds.

import { test, expect } from '@playwright/test';

async function payInSheet(page) {
  const frame = await (await page.waitForSelector('.sheet iframe')).contentFrame();
  await frame.click('#pay');
}

test('buying one design unlocks it, and only it', async ({ page }) => {
  await page.goto('/designs/follow-card/');
  await page.waitForSelector('[data-design][data-ready]');
  await expect(page.locator('[data-locked]')).toBeVisible();
  await page.locator('[data-buy="follow-card"]').click();
  await payInSheet(page);
  await expect(page.locator('[data-unlocked]')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-status]')).toHaveText('Unlocked. Your downloads are clean now.');

  const download = page.waitForEvent('download');
  await page.locator('[data-export="clean"]').click();
  const d = await download;
  expect(d.suggestedFilename()).toMatch(/^follow-card-.*-60fps-greenscreen\.mp4$/);
  expect(d.suggestedFilename()).not.toContain('watermarked');

  await page.goto('/designs/lower-third/');
  await page.waitForSelector('[data-design][data-ready]');
  await expect(page.locator('[data-locked]')).toBeVisible();
});

test('a pack key restores every design in another browser', async ({ page, browser, request }) => {
  const { key } = await (await request.post('/mock-ls/pay', { data: { product: 'studio' } })).json();
  const other = await browser.newContext();
  const p2 = await other.newPage();
  await p2.goto('/restore/');
  await p2.fill('input[name="key"]', key);
  await p2.click('button[type="submit"]');
  await expect(p2.locator('[data-status]')).toHaveText(/Unlocked/);
  await expect(p2.locator('[data-list] li')).toHaveCount(4);
  await p2.goto('/designs/like-bell/');
  await p2.waitForSelector('[data-design][data-ready]');
  await expect(p2.locator('[data-unlocked]')).toBeVisible();
  await expect(p2.locator('[data-unlocked-note]')).toContainText('Studio pack');
  await other.close();
});

test('a restore link unlocks without typing the key', async ({ page, request }) => {
  const { key } = await (await request.post('/mock-ls/pay', { data: { product: 'subscribe-pop' } })).json();
  await page.goto(`/restore/#key=${key}`);
  await expect(page.locator('[data-status]')).toHaveText(/Unlocked/);
  expect(page.url()).not.toContain(key);
});

test('a refunded key no longer unlocks', async ({ page, request }) => {
  const { key } = await (await request.post('/mock-ls/pay', { data: { product: 'lower-third' } })).json();
  await request.post('/mock-ls/refund', { data: { key } });
  await page.goto('/restore/');
  await page.fill('input[name="key"]', key);
  await page.click('button[type="submit"]');
  await expect(page.locator('[data-status]')).toHaveText(/disabled|refunded/);
});

test('a wrong key gets a clear message', async ({ page }) => {
  await page.goto('/restore/');
  await page.fill('input[name="key"]', 'ABCD-NOT-A-KEY');
  await page.click('button[type="submit"]');
  await expect(page.locator('[data-status]')).toHaveText("That key wasn't recognised. Copy it exactly from your receipt email.");
});

test('the storefront pack button runs the same checkout', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-buy="studio"]').click();
  await payInSheet(page);
  await expect(page.locator('[data-buy-status]')).toHaveText('Unlocked. Your downloads are clean now.', { timeout: 30_000 });
});
