// Regression checks for things found in hands-on testing.

import { test, expect } from '@playwright/test';

async function harness(page) {
  await page.goto('/__test/');
  await page.waitForFunction(() => window.harnessReady);
}

// Pixels of a region of a rendered frame, for comparing frames.
const region = (page, id, t, [x, y, w, h], options = {}) =>
  page.evaluate(async ([id, t, x, y, w, h, o]) => {
    const url = await window.harness.frame(id, t, o);
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = new OffscreenCanvas(1920, 1080);
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    return Array.from(ctx.getImageData(x, y, w, h).data);
  }, [id, t, x, y, w, h, options]);

// Once both text lines have landed they must not move by even a pixel until the card
// leaves (a spring's tail used to nudge it 1px after it looked still).
const HOLDS = {
  'subscribe-pop': { from: 1.0, to: 1.75, box: [745, 855, 265, 55] }, // the channel name, right of the avatar
  'like-bell': { from: 1.05, to: 1.7, box: [620, 880, 380, 80] },
  'follow-card': { from: 1.15, to: 1.75, box: [775, 855, 240, 55] }, // the name, right of the avatar ring
  'lower-third': { from: 1.3, to: 3.8, box: [230, 830, 620, 110] },
};
for (const [id, h] of Object.entries(HOLDS)) {
  test(`${id}: text holds perfectly still after it lands`, async ({ page }) => {
    await harness(page);
    const first = await region(page, id, h.from, h.box);
    for (let t = h.from + 0.05; t <= h.to; t += 0.05) {
      const now = await region(page, id, Number(t.toFixed(3)), h.box);
      const moved = now.filter((v, i) => v !== first[i]).length;
      expect(moved, `pixels changed at t=${t.toFixed(2)}s`).toBe(0);
    }
  });
}

test('soft shadows are smooth, not banded', async ({ page }) => {
  await harness(page);
  // A column through the lower third's shadow.
  const px = await region(page, 'lower-third', 2.4, [400, 950, 1, 90]); // just below the plate
  const alphas = px.filter((_, i) => i % 4 === 3).filter((a) => a > 0);
  expect(alphas.length).toBeGreaterThan(40);
  // Banding showed as every alpha being a multiple of 6 (the motion-blur sample count).
  expect(alphas.some((a) => a % 6 !== 0)).toBe(true);
  // And it fades in small steps.
  for (let i = 1; i < alphas.length; i++) expect(Math.abs(alphas[i] - alphas[i - 1])).toBeLessThanOrEqual(16);
});

test('shadow off leaves the background untouched around the card', async ({ page }) => {
  await harness(page);
  // Under the card before the cursor arrives, where only the card's shadow reaches.
  const below = [700, 995, 300, 40];
  const alpha = (px) => px.filter((_, i) => i % 4 === 3);
  const on = alpha(await region(page, 'subscribe-pop', 1.5, below));
  const off = alpha(await region(page, 'subscribe-pop', 1.5, below, { shadows: false }));
  expect(on.some((a) => a > 0)).toBe(true);
  expect(off.every((a) => a === 0)).toBe(true);
});

test('design page: the play button shows play when paused and pause when playing', async ({ page }) => {
  await page.goto('/designs/subscribe-pop/');
  await page.waitForSelector('[data-design][data-ready]');
  const icons = () => page.evaluate(() => [
    getComputedStyle(document.querySelector('[data-icon-play]')).display,
    getComputedStyle(document.querySelector('[data-icon-pause]')).display,
  ]);
  expect(await icons()).toEqual(['none', 'block']);
  await page.click('[data-play]');
  expect(await icons()).toEqual(['block', 'none']);
  await page.click('[data-play]');
  expect(await icons()).toEqual(['none', 'block']);
});

test('storefront: pause holds the playhead, dragging the ruler scrubs', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the ruler is hidden on phones');
  await page.goto('/');
  await page.waitForTimeout(800);
  const ph = () => page.evaluate(() => Number(getComputedStyle(document.querySelector('[data-timeline]')).getPropertyValue('--ph')));
  await page.click('[data-play]');
  await expect(page.locator('[data-play]')).toHaveAttribute('aria-label', 'Play');
  const held = await ph();
  await page.waitForTimeout(700);
  expect(await ph()).toBe(held);
  const r = await page.locator('[data-ruler]').boundingBox();
  await page.mouse.move(r.x + r.width * 0.1, r.y + 10);
  await page.mouse.down();
  await page.mouse.move(r.x + r.width * 0.8, r.y + 10, { steps: 6 });
  await page.mouse.up();
  expect(await ph()).toBeCloseTo(0.8, 2);
  await expect(page.locator('[data-active-name]')).toHaveText('Lower third');
});
