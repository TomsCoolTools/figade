// Golden frames: each design renders exactly as approved. subscribe-pop's
// references were rendered by the original subscribe-demo, so this also
// proves the engine port still matches the prototype.
//
// After an intentional design change, update the references with:
//   UPDATE_GOLDEN=1 npx playwright test golden --project=desktop
// (subscribe-pop's demo-* references are never overwritten).

import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const dir = path.join(path.dirname(new URL(import.meta.url).pathname), 'golden');
const UPDATE = process.env.UPDATE_GOLDEN === '1';

const LIGHT = { theme: 'light', accent: '#2F7CF6', name: 'Ada Lovelace' };
export const CASES = {
  'subscribe-pop': { times: [0.4, 0.6, 1.0, 1.5, 1.95, 2.05, 2.2, 2.6, 3.4, 3.7, 4.5, 4.75], prefix: 'demo', variants: { default: {}, alt: { ...LIGHT, button: 'modern', position: 'left', subs: '1234567' } } },
  'like-bell': { times: [0.5, 1.95, 2.3, 3.2, 4.5], variants: { default: {}, alt: { ...LIGHT, position: 'left' } } },
  'follow-card': { times: [0.6, 2.05, 2.3, 3.0, 4.5], variants: { default: {}, alt: { ...LIGHT, handle: 'ada' } } },
  'lower-third': { times: [0.3, 0.8, 2.4, 4.1], variants: { default: {}, alt: { ...LIGHT, picture: 'hide', title: 'Mathematician' } } },
};

test.beforeEach(async ({ page }) => {
  await page.goto('/__test/');
  await page.waitForFunction(() => window.harnessReady);
});

for (const [design, c] of Object.entries(CASES)) {
  test(`${design} matches its golden frames`, async ({ page }) => {
    for (const [variant, options] of Object.entries(c.variants)) {
      for (const t of c.times) {
        const file = path.join(dir, design, `${c.prefix ?? 'ref'}-${variant}-${t}.png`);
        const url = await page.evaluate(([d, t, o]) => window.harness.frame(d, t, { options: o }), [design, t, options]);
        if (UPDATE && !c.prefix) {
          fs.mkdirSync(path.dirname(file), { recursive: true });
          fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
          continue;
        }
        expect(fs.existsSync(file), `missing ${path.relative(dir, file)}`).toBe(true);
        const golden = `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;
        const diff = await page.evaluate(async ([a, b]) => {
          const load = async (src) => {
            const img = new Image();
            img.src = src;
            await img.decode();
            const c = new OffscreenCanvas(img.width, img.height);
            const ctx = c.getContext('2d');
            ctx.drawImage(img, 0, 0);
            return ctx.getImageData(0, 0, img.width, img.height).data;
          };
          const A = await load(a), B = await load(b);
          if (A.length !== B.length) return { size: true };
          let px = 0, max = 0;
          for (let i = 0; i < A.length; i += 4) {
            const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2]), Math.abs(A[i + 3] - B[i + 3]));
            if (d > 2) px++;
            if (d > max) max = d;
          }
          return { px, max };
        }, [url, golden]);
        // Identical on the machine that made the references; a tiny allowance
        // covers anti-aliasing differences between GPUs and Chrome versions.
        expect(diff.size, `${design} ${variant} t=${t} size`).toBeFalsy();
        expect(diff.px, `${design} ${variant} t=${t}: ${diff.px} pixels differ (max ${diff.max})`).toBeLessThanOrEqual(1920 * 1080 * 0.001);
      }
    }
  });
}
