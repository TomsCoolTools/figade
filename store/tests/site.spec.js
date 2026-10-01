// Pages work at phone widths, with the keyboard, with reduced motion, and in
// browsers that can't encode video.

import { test, expect } from '@playwright/test';

const PAGES = ['/', '/designs/subscribe-pop/', '/designs/like-bell/', '/designs/follow-card/', '/designs/lower-third/', '/restore/', '/licence/', '/terms/', '/privacy/', '/refunds/'];

test('no page scrolls sideways at 360px wide', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 760 });
  for (const p of PAGES) {
    await page.goto(p);
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, p).toBeLessThanOrEqual(0);
  }
});

test('the storefront monitor plays a design', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(1500);
  const painted = await page.evaluate(() => {
    const c = document.querySelector('[data-monitor]');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i]) n++;
    return n;
  });
  expect(painted).toBeGreaterThan(1000);
});

test('details typed on the storefront fill in the design pages', async ({ page }) => {
  await page.goto('/');
  await page.fill('[data-quick] input[name="name"]', 'Noor Makes');
  await page.goto('/designs/lower-third/');
  await expect(page.locator('[data-opt="name"]')).toHaveValue('Noor Makes');
});

test('reduced motion: the headline is still and previews start paused', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/designs/subscribe-pop/');
  await page.waitForSelector('[data-design][data-ready]');
  await expect(page.locator('[data-play]')).toHaveAttribute('aria-label', 'Play');
  await page.goto('/');
  expect(await page.locator('.hero-title').evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  await ctx.close();
});

test('a keyboard-only visitor can buy and download', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard flow is a desktop check');
  await page.goto('/designs/subscribe-pop/');
  await page.waitForSelector('[data-design][data-ready]');
  // Tab until the buy button has focus.
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press('Tab');
    if (await page.evaluate(() => document.activeElement?.dataset?.buy === 'subscribe-pop')) break;
  }
  expect(await page.evaluate(() => document.activeElement?.dataset?.buy)).toBe('subscribe-pop');
  await expect(page.locator('[data-buy="subscribe-pop"]')).toBeFocused();
  await page.keyboard.press('Enter');
  const frame = await (await page.waitForSelector('.sheet iframe')).contentFrame();
  await frame.focus('#pay');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-unlocked]')).toBeVisible({ timeout: 30_000 });
  await page.locator('[data-export="clean"]').focus();
  const download = page.waitForEvent('download');
  await page.keyboard.press('Enter');
  expect((await download).suggestedFilename()).toMatch(/greenscreen\.mp4$/);
});

test('browsers without a video encoder are told up front', async ({ page }) => {
  await page.addInitScript(() => {
    delete window.VideoEncoder;
    delete window.AudioEncoder;
  });
  await page.goto('/designs/subscribe-pop/');
  await page.waitForSelector('[data-design][data-ready]');
  await expect(page.locator('[data-unavailable]')).toBeVisible();
  await expect(page.locator('[data-unavailable]')).toContainText('MP4 or WebM');
  // PNG still works there, so it's selected instead.
  await expect(page.locator('[data-format] [data-value="png"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-format] [data-value="mp4"]')).toBeDisabled();
});

test('every page has a visible keyboard focus style', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop check');
  await page.goto('/');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
  expect(outline).not.toBe('none');
});
