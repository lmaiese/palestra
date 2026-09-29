/// <reference lib="dom" />
// F11 on a production build: the service worker precaches the shell, so after the
// first visit a cold reload with no network still opens the app with its data.
import { test, expect } from '@playwright/test';
import { resetEmulators, seed, signInOwner, SPEC_SEED } from './helpers';

test.beforeEach(async () => {
  await resetEmulators();
  await seed(SPEC_SEED);
});

test('cold reload offline opens the app from the service worker', async ({ page, context }) => {
  await signInOwner(page, '2026-10-05');
  await expect(page.getByRole('link', { name: /Back Squat/ }).first()).toContainText('70');

  // Wait until the service worker controls the page and has precached the shell.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((r) => navigator.serviceWorker.addEventListener('controllerchange', () => r(), { once: true }));
    }
  });
  const cached = await page.evaluate(async () => {
    const keys = await caches.keys();
    const c = await caches.open(keys.find((k) => k.startsWith('palestra-shell-'))!);
    return (await c.keys()).map((r) => new URL(r.url).pathname);
  });
  expect(cached).toContain('/');
  expect(cached.some((p) => /^\/assets\/index-.*\.js$/.test(p))).toBe(true);
  expect(cached.some((p) => /^\/assets\/firestoreRepo-.*\.js$/.test(p))).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('navigation', { name: 'Sezioni' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Back Squat/ }).first()).toContainText('70');
  await page.goto('/#/piano/2/A');
  await expect(page.getByRole('button', { name: /Back Squat/ })).toContainText('ultima volta 70 kg · 28/09');
  await context.setOffline(false);
});
