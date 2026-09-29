import { defineConfig, devices } from '@playwright/test';

// Run through `npm run e2e` (scripts/emu.sh → firebase emulators:exec, auth + firestore).
// Two servers, both in emulator mode:
//  - dev server (5199) for the functional and visual suites;
//  - `vite preview` of a production build (5198) for the service-worker offline test.
const DEV = 5199;
const PROD = 5198;
const PROD_DIR = 'node_modules/.e2e-dist';
const mobile = { ...devices['Desktop Chrome'], viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: false };

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    trace: 'retain-on-failure',
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
    colorScheme: 'dark',
  },
  projects: [
    { name: 'mobile', testIgnore: /offline-prod/, use: { ...mobile, baseURL: `http://127.0.0.1:${DEV}` } },
    { name: 'prod', testMatch: /offline-prod/, use: { ...mobile, baseURL: `http://127.0.0.1:${PROD}` } },
  ],
  webServer: [
    {
      command: `npx vite --mode e2e --host 127.0.0.1 --port ${DEV} --strictPort`,
      env: { VITE_USE_EMULATORS: '1' },
      url: `http://127.0.0.1:${DEV}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: `npx vite build --mode e2e --outDir ${PROD_DIR} --emptyOutDir && npx vite preview --outDir ${PROD_DIR} --host 127.0.0.1 --port ${PROD} --strictPort`,
      env: { VITE_USE_EMULATORS: '1' },
      url: `http://127.0.0.1:${PROD}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
