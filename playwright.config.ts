import { defineConfig, devices } from '@playwright/test';

// Run through `npm run e2e`, which wraps this in
// `firebase emulators:exec --only auth,firestore --project demo-palestra`.
const PORT = 5199;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
    colorScheme: 'dark',
  },
  projects: [
    {
      name: 'mobile',
      use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: false },
    },
  ],
  webServer: {
    command: `npx vite --mode e2e --host 127.0.0.1 --port ${PORT} --strictPort`,
    env: { VITE_USE_EMULATORS: '1' },
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
