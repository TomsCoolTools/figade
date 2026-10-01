// Browser tests. They need Google Chrome (Playwright's bundled Chromium has
// no H.264 encoder): `npx playwright install chrome` if it isn't installed.
// The test server builds into .test-dist/ so it can run alongside `npm run dev`.

import { defineConfig, devices } from '@playwright/test';

const PORT = 8790;
process.env.STORE_OUT = '.test-dist';

export default defineConfig({
  testDir: 'tests',
  timeout: 180_000,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: `http://localhost:${PORT}`, channel: 'chrome', trace: 'retain-on-failure' },
  webServer: {
    command: `node scripts/dev.js --port ${PORT} --no-watch --fresh --data .dev/test`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { STORE_OUT: '.test-dist' },
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'phone', use: { ...devices['Pixel 7'], channel: 'chrome' }, testMatch: /(site|purchase)\.spec\.js/ },
  ],
});
