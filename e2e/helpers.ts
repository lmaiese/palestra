/// <reference lib="dom" />
import { expect, type Page } from '@playwright/test';
import { buildCommitBody } from '../scripts/seed';
import { seedSessions } from '../src/domain/seed';
import type { WorkoutSession } from '../src/domain/types';

export const PROJECT = 'demo-palestra';
export const OWNER = 'maieseluigi@gmail.com';

export async function resetEmulators() {
  await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
}

/**
 * Writes sessions into the emulator exactly like `npm run seed` does in production
 * (same commit body, createdAt/updatedAt server timestamps), with the emulator's
 * admin bypass so rules are skipped.
 */
export async function seed(sessions: WorkoutSession[]) {
  for (const s of sessions) {
    const res = await fetch(`http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents:commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
      body: JSON.stringify(buildCommitBody(s, PROJECT)),
    });
    if (!res.ok) throw new Error(`seed ${s.id}: ${res.status} ${await res.text()}`);
  }
}

export const set = (weightKg: number, reps: number | null = null, rpe: number | null = null) => ({ weightKg, reps, rpe });

/** The two real workouts from SPEC "Dati iniziali" (src/domain/seed.ts). */
export const SPEC_SEED: WorkoutSession[] = seedSessions;

/** Opens the app with a pinned "today" and signs in through the emulator-only hook. */
export async function signIn(page: Page, email = OWNER, today = '2026-09-29') {
  await page.addInitScript((d) => {
    try {
      window.localStorage.setItem('palestra.today', d);
    } catch {
      /* ignore */
    }
  }, today);
  await page.goto('/');
  await page.waitForFunction(() => typeof window.__palestraSignIn === 'function');
  await page.evaluate((e) => window.__palestraSignIn!(e), email);
}

export async function signInOwner(page: Page, today?: string) {
  await signIn(page, OWNER, today);
  await expect(page.getByRole('navigation', { name: 'Sezioni' })).toBeVisible();
}

declare global {
  interface Window {
    __palestraSignIn?: (email: string) => Promise<void>;
  }
}