import { defineConfig, devices } from '@playwright/test';

const gameData = process.env.VANGERS_DATA_DIR;
// E2E_DIST=1 tests the production build served from a sub-path (as on GitHub Pages).
const dist = Boolean(process.env.E2E_DIST);
const baseURL = dist ? 'http://127.0.0.1:4173/vangers/' : 'http://127.0.0.1:5173/';

export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  timeout: 60_000,
  fullyParallel: true,
  use: { baseURL },
  webServer: dist
    ? { command: 'node scripts/serve-dist.mjs', url: baseURL, reuseExistingServer: false }
    : { command: 'npx vite --host 127.0.0.1 --port 5173 --strictPort', url: baseURL, reuseExistingServer: true },
  projects: [
    { name: 'desktop', testMatch: /launcher\.spec/, use: { ...devices['Desktop Chrome'] } },
    {
      name: 'tablet',
      testMatch: /launcher\.spec/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1133, height: 744 }, hasTouch: true, isMobile: true },
    },
    ...(gameData
      ? [
          { name: 'full', testMatch: /game\.spec/, timeout: 300_000, use: { ...devices['Desktop Chrome'] } },
          { name: 'full-safari', testMatch: /game\.spec/, timeout: 300_000, use: { ...devices['Desktop Safari'] } },
          { name: 'full-firefox', testMatch: /game\.spec/, timeout: 300_000, use: { ...devices['Desktop Firefox'] } },
        ]
      : []),
  ],
});
