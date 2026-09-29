/// <reference lib="dom" />
// DoD UI7: screenshots of every route at 375×812 and 1280×800 into docs/screenshots/.
// Data = the two real SPEC workouts (src/domain/seed.ts) plus two plausible week 1–2 sessions so the
// history and chart screens show a realistic state. "Today" is pinned to 2026-10-06.
import { test, expect, type Page } from '@playwright/test';
import { resetEmulators, seed, set, signIn, signInOwner, SPEC_SEED } from './helpers';
import type { WorkoutSession } from '../src/domain/types';

const EXTRA: Omit<WorkoutSession, 'schemaVersion'>[] = [
  {
    id: '2026-09-29-w1-B',
    date: '2026-09-29',
    week: 1,
    day: 'B',
    exercises: [
      { exerciseId: 'bench-press', name: 'Bench Press', sets: [set(55, 5, 7), set(50, 5), set(50, 5), set(50, 5)], notes: '' },
      { exerciseId: 'overhead-press', name: 'Overhead Press', sets: [set(35, 6, 7), set(35, 6), set(35, 6)], notes: '' },
      { exerciseId: 'pull-up', name: 'Pull-up', sets: [set(0, 8), set(0, 7), set(0, 6)], notes: '' },
      { exerciseId: 'pendlay-row', name: 'Pendlay Row', sets: [set(50, 6), set(50, 6), set(50, 6)], notes: '' },
    ],
    conditioning: '',
    notes: '',
  },
  {
    id: '2026-10-05-w2-A',
    date: '2026-10-05',
    week: 2,
    day: 'A',
    exercises: [
      { exerciseId: 'back-squat', name: 'Back Squat', sets: [set(77.5, 5, 7.5), set(70, 5), set(70, 5), set(70, 5), set(70, 5)], notes: '' },
      { exerciseId: 'front-squat', name: 'Front Squat', sets: [set(50, 5, 7), set(50, 5), set(50, 5)], notes: '' },
      { exerciseId: 'bulgarian-split-squat', name: 'Bulgarian Split Squat', sets: [set(32.5, 6), set(32.5, 6), set(32.5, 6)], notes: '' },
    ],
    conditioning: '5 × 200 m row @90%',
    notes: '',
  },
];
const DEMO: WorkoutSession[] = [...SPEC_SEED, ...EXTRA.map((s) => ({ ...s, schemaVersion: 1 as const }))];

const TODAY = '2026-10-06';
const SIZES = [
  { w: 375, h: 812, tag: '375' },
  { w: 1280, h: 800, tag: '1280' },
];

const ROUTES: [string, string][] = [
  ['oggi', '/'],
  ['piano', '/piano'],
  ['piano-settimana-4-A', '/piano/4/A'],
  ['regole', '/regole'],
  ['registra', '/registra'],
  ['storico', '/storico'],
  ['seduta', '/storico/2026-10-05-w2-A'],
  ['esercizio-back-squat', '/esercizio/back-squat'],
];

/** Grows the viewport to the page height so fixed/sticky bars sit where a user sees them. */
async function shot(page: Page, name: string, tag: string) {
  // No hover or focus rings in the pictures.
  await page.mouse.move(0, 0);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.evaluate(() => document.fonts.ready);
  const vp = page.viewportSize()!;
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width: vp.width, height: Math.max(vp.height, h) });
  await page.screenshot({ path: `docs/screenshots/${name}-${tag}.png`, animations: 'disabled' });
  await page.setViewportSize(vp);
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  await resetEmulators();
  await seed(DEMO);
});

for (const size of SIZES) {
  test(`screens at ${size.tag}`, async ({ page }) => {
    await page.setViewportSize({ width: size.w, height: size.h });
    await signInOwner(page, TODAY);
    for (const [name, path] of ROUTES) {
      await page.goto(`/#${path}`);
      await expect(page.locator('.state-loading')).toHaveCount(0);
      await expect(page.locator('#main h1').first()).toBeVisible();
      if (name === 'piano') {
        await page.getByRole('button', { name: /Bench Press/ }).first().click();
      }
      await shot(page, name, size.tag);
    }
  });

  test(`Oggi on Friday 02/10 at ${size.tag}: C still to do`, async ({ page }) => {
    await page.setViewportSize({ width: size.w, height: size.h });
    await signInOwner(page, '2026-10-02');
    await expect(page.getByRole('heading', { level: 1, name: /Hinge \+ Power/ })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Registra allenamento' })).toBeVisible();
    await expect(page.getByText('2 di 3 sedute registrate')).toBeVisible();
    await expect(page.locator('.state-loading')).toHaveCount(0);
    await shot(page, 'oggi-venerdi-02-10', size.tag);
  });

  test(`light theme at ${size.tag}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.setViewportSize({ width: size.w, height: size.h });
    await signInOwner(page, TODAY);
    for (const [name, path] of [['oggi', '/'], ['registra', '/registra'], ['esercizio-back-squat', '/esercizio/back-squat']]) {
      await page.goto(`/#${path}`);
      await expect(page.locator('.state-loading')).toHaveCount(0);
      await shot(page, `${name}-light`, size.tag);
    }
  });

  test(`login and denied at ${size.tag}`, async ({ page }) => {
    await page.setViewportSize({ width: size.w, height: size.h });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Accedi con Google' })).toBeVisible();
    await shot(page, 'login', size.tag);
    await signIn(page, 'other@gmail.com', TODAY);
    await expect(page.getByRole('heading', { name: 'Accesso negato' })).toBeVisible();
    await shot(page, 'accesso-negato', size.tag);
  });
}