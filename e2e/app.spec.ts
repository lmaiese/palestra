/// <reference lib="dom" />
// End-to-end on the Auth + Firestore emulators (DoD F4, F5, F6, F7, F8, F11, S3, UI1, UI2, UI4).
import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';
import { resetEmulators, seed, signIn, signInOwner, SPEC_SEED } from './helpers';

const TODAY = '2026-10-05'; // Monday of week 2: session A

test.beforeEach(async () => {
  await resetEmulators();
  await seed(SPEC_SEED);
});

const nav = (page: Page) => page.getByRole('navigation', { name: 'Sezioni' });

test('owner logs in, lands on the dashboard and reaches every route', async ({ page }) => {
  await signInOwner(page, TODAY);
  await expect(page.getByText('Settimana 2 di 8')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: /Lower Power/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Back Squat/ }).first()).toContainText('70');

  await nav(page).getByRole('link', { name: 'Piano' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Piano' })).toBeVisible();
  await page.getByRole('link', { name: 'Regole e tecnica' }).click();
  await expect(page.getByRole('heading', { name: 'Regola C-Lite' })).toBeVisible();
  await nav(page).getByRole('link', { name: 'Registra' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Registra' })).toBeVisible();
  await nav(page).getByRole('link', { name: 'Storico' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Storico' })).toBeVisible();
  await page.getByRole('link', { name: /Sett\. 1, A/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Lower Power' })).toBeVisible();
  await page.getByRole('link', { name: 'Back Squat' }).click();
  await expect(page.getByRole('img', { name: /Back Squat, carico massimo/ })).toBeVisible();
  await nav(page).getByRole('link', { name: 'Oggi' }).click();
  await expect(page.getByText('Settimana 2 di 8')).toBeVisible();

  // Signing out from the phone (Oggi footer) returns to the login and wipes the cache.
  await page.getByRole('region', { name: 'Account' }).getByRole('button', { name: 'Esci' }).click();
  await expect(page.getByRole('button', { name: 'Accedi con Google' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Accedi con Google' })).toBeVisible();
});

test('register, see it in Storico and in Piano, edit, delete', async ({ page }) => {
  await signInOwner(page, TODAY);
  await nav(page).getByRole('link', { name: 'Registra' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Registra' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Settimana' })).toHaveValue('2');
  await expect(page.getByRole('listitem', { name: 'Back Squat' })).toContainText('ultima volta 70 kg · 28/09');

  await page.getByRole('textbox', { name: 'Back Squat, set 1, kg' }).fill('80');
  await page.getByRole('textbox', { name: 'Back Squat, set 1, ripetizioni' }).fill('5');
  await page.getByRole('textbox', { name: 'Back Squat, set 1, RPE' }).fill('7,5');
  // Back-off rows are prefilled from "1x5 + 4x5": fill one from the last-load chip.
  await expect(page.getByRole('textbox', { name: 'Back Squat, set 5, kg' })).toBeVisible();
  await page.getByRole('button', { name: 'Usa 70 kg nel set 2 di Back Squat' }).click();
  await expect(page.getByRole('textbox', { name: 'Back Squat, set 2, kg' })).toHaveValue('70');
  await page.getByRole('textbox', { name: 'Back Squat, set 2, kg' }).fill('72,5');
  await page.getByRole('textbox', { name: 'Front Squat, set 1, kg' }).fill('50');
  await page.getByLabel('Note').fill('Gambe fresche');
  await page.getByRole('button', { name: 'Salva seduta' }).click();

  await expect(page.getByRole('status')).toContainText('Seduta salvata');
  await expect(page).toHaveURL(/#\/storico\/2026-10-05-w2-A$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Lower Power' })).toBeVisible();
  await expect(page.getByText('80×5 @7,5')).toBeVisible();
  await expect(page.getByText('Record').first()).toBeVisible();

  await nav(page).getByRole('link', { name: 'Storico' }).click();
  const first = page.getByRole('link', { name: /Sett\. \d, [ABC]\./ }).first();
  await expect(first).toHaveAttribute('href', '#/storico/2026-10-05-w2-A');
  await expect(first).toContainText('Back Squat 80');

  await page.goto('/#/piano/2/A');
  await expect(page.getByRole('button', { name: /Back Squat/ })).toContainText('ultima volta 80 kg · 05/10');

  // Edit
  await page.goto('/#/storico/2026-10-05-w2-A');
  await page.getByRole('link', { name: /Modifica/ }).click();
  const kg = page.getByRole('textbox', { name: 'Back Squat, set 1, kg' });
  await expect(kg).toHaveValue('80');
  await kg.fill('82,5');
  await page.getByRole('button', { name: 'Salva modifiche' }).click();
  await expect(page.getByRole('status')).toContainText('Modifiche salvate');
  await expect(page.getByText('82,5×5 @7,5')).toBeVisible();

  // Delete
  await page.getByRole('button', { name: /Elimina/ }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Elimina seduta' }).click();
  await expect(page.getByRole('status')).toContainText('Seduta eliminata');
  await expect(page).toHaveURL(/#\/storico$/);
  await expect(page.locator('a[href="#/storico/2026-10-05-w2-A"]')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Sett\. 1, A/ })).toBeVisible();
});

test('intruder account sees "Accesso negato" and no Firestore request is made', async ({ page }) => {
  const firestoreCalls: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes(':8080/') || r.url().includes('firestore.googleapis.com')) firestoreCalls.push(r.url());
  });
  await signIn(page, 'other@gmail.com', TODAY);
  await expect(page.getByRole('heading', { name: 'Accesso negato' })).toBeVisible();
  await expect(page.getByText('other@gmail.com')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Sezioni' })).toHaveCount(0);
  await page.waitForTimeout(500);
  expect(firestoreCalls).toEqual([]);
  // Signed out: a reload shows the login, not the app.
  await page.reload();
  await expect(page.getByRole('button', { name: 'Accedi con Google' })).toBeVisible();
});

test('F11: works offline after the first load and is installable', async ({ page, context }) => {
  await signInOwner(page, TODAY);
  await expect(page.getByRole('link', { name: /Back Squat/ }).first()).toContainText('70');
  const manifest = await page.request.get('/manifest.webmanifest');
  const m = await manifest.json();
  expect(m.display).toBe('standalone');
  expect(m.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));

  await context.setOffline(true);
  await nav(page).getByRole('link', { name: 'Piano' }).click();
  await expect(page.getByRole('button', { name: /Back Squat/ })).toContainText('ultima volta 70 kg · 28/09');
  await nav(page).getByRole('link', { name: 'Registra' }).click();
  await page.getByRole('textbox', { name: 'Back Squat, set 1, kg' }).fill('75');
  await page.getByRole('button', { name: 'Salva seduta' }).click();
  await expect(page.getByRole('status')).toContainText('Seduta salvata');
  await nav(page).getByRole('link', { name: 'Storico' }).click();
  await expect(page.getByRole('link', { name: /Sett\. 2, A/ })).toContainText('Back Squat 75');
  await context.setOffline(false);
});

const ROUTES = [
  '/',
  '/piano',
  '/piano/4/C',
  '/regole',
  '/registra',
  '/storico',
  '/storico/2026-09-25-w1-C',
  '/esercizio/back-squat',
  '/esercizio/front-squat',
];

test('UI1, UI2, UI4 on every route at 375×812', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await signInOwner(page, TODAY);
  const report: string[] = [];
  for (const route of ROUTES) {
    await page.goto(`/#${route}`);
    await expect(page.locator('#main h1').first()).toBeVisible();
    await expect(page.locator('.state-loading')).toHaveCount(0);
    if (route === '/piano') await page.getByRole('button', { name: /Back Squat/ }).click();

    // UI1: no horizontal scroll
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${route} scrolls horizontally`).toBeLessThanOrEqual(0);

    // UI2: touch targets
    const small = await page.evaluate(() => {
      const sel = 'a[href], button, input, select, textarea, summary, [role="radio"]';
      return [...document.querySelectorAll<HTMLElement>(sel)]
        .filter((el) => {
          const s = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          return s.visibility !== 'hidden' && s.display !== 'none' && r.width > 0 && r.height > 0 && !el.classList.contains('skip');
        })
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.height < 44 || r.width < 44;
        })
        .map((el) => `${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30)}" ${Math.round(el.getBoundingClientRect().width)}×${Math.round(el.getBoundingClientRect().height)}`);
    });
    expect(small, `${route} small targets`).toEqual([]);

    // UI4: axe
    const axe = await new AxeBuilder({ page }).analyze();
    const bad = axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    for (const v of bad) report.push(`${route}: ${v.id} ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`);
  }
  expect(report).toEqual([]);
});

test('UI1, UI2, UI4 on login and denied at 375×812', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Accedi con Google' })).toBeVisible();
  let axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await signIn(page, 'other@gmail.com', TODAY);
  await expect(page.getByRole('heading', { name: 'Accesso negato' })).toBeVisible();
  axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([]);
  const btn = await page.getByRole('button', { name: 'Usa un altro account' }).boundingBox();
  expect(btn!.height).toBeGreaterThanOrEqual(44);
});

test('UI4 and UI5: light theme passes axe on every route', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.setViewportSize({ width: 375, height: 812 });
  await signInOwner(page, TODAY);
  const report: string[] = [];
  for (const route of ROUTES) {
    await page.goto(`/#${route}`);
    await expect(page.locator('#main h1').first()).toBeVisible();
    await expect(page.locator('.state-loading')).toHaveCount(0);
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe('rgb(233, 236, 239)');
    const axe = await new AxeBuilder({ page }).analyze();
    for (const v of axe.violations.filter((x) => x.impact === 'serious' || x.impact === 'critical')) {
      report.push(`${route}: ${v.id} ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`);
    }
  }
  expect(report).toEqual([]);
});
