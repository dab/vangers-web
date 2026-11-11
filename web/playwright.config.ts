import { defineConfig, devices } from '@playwright/test';

const gameData = process.env.VANGERS_DATA_DIR;

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: true,
  use: { baseURL: 'http://127.0.0.1:5173' },
  webServer: {
    command: 'npx vite --host 127.0.0.1 --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
  },
  projects: [
    { name: 'desktop', testMatch: /launcher\.spec/, use: { ...devices['Desktop Chrome'] } },
    {
      name: 'tablet',
      testMatch: /launcher\.spec/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1133, height: 744 }, hasTouch: true, isMobile: true },
    },
    ...(gameData
      ? [{ name: 'full', testMatch: /game\.spec/, timeout: 300_000, use: { ...devices['Desktop Chrome'] } }]
      : []),
  ],
});
