/// <reference lib="dom" />
import { expect, type Page } from '@playwright/test';

export const PROJECT = 'demo-palestra';
export const OWNER = 'maieseluigi@gmail.com';
const FS = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;

export async function resetEmulators() {
  await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
}

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

function toValue(v: Json): Record<string, unknown> {
  if (v === null) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toValue(x)])) } };
}

export interface SeedSession {
  id: string;
  date: string;
  week: number | null;
  day: 'A' | 'B' | 'C' | null;
  exercises: { exerciseId: string; name: string; sets: { weightKg: number; reps: number | null; rpe: number | null }[]; notes: string }[];
  conditioning: string;
  notes: string;
}

/** Writes sessions straight into the emulator (admin bypass, rules skipped). */
export async function seed(sessions: SeedSession[]) {
  for (const s of sessions) {
    const { id, ...data } = s;
    const body = { fields: (toValue({ ...data, schemaVersion: 1 } as unknown as Json) as { mapValue: { fields: unknown } }).mapValue.fields };
    const res = await fetch(`${FS}/sessions?documentId=${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`seed ${id}: ${res.status} ${await res.text()}`);
  }
}

export const set = (weightKg: number, reps: number | null = null, rpe: number | null = null) => ({ weightKg, reps, rpe });

/** The two real workouts from SPEC "Dati iniziali". */
export const SPEC_SEED: SeedSession[] = [
  {
    id: '2026-09-25-w1-C',
    date: '2026-09-25',
    week: 1,
    day: 'C',
    exercises: [
      { exerciseId: 'hang-power-clean', name: 'Hang Power Clean', sets: [set(50)], notes: '' },
      { exerciseId: 'deadlift', name: 'Deadlift', sets: [set(70)], notes: '' },
      { exerciseId: 'bulgarian-split-squat', name: 'Bulgarian Split Squat', sets: [set(30), set(30)], notes: '' },
    ],
    conditioning: '3 × (250 m row + swing 20 kg)',
    notes: 'Ridotto perché giocavo a beach',
  },
  {
    id: '2026-09-28-w1-A',
    date: '2026-09-28',
    week: 1,
    day: 'A',
    exercises: [
      { exerciseId: 'back-squat', name: 'Back Squat', sets: [set(70, null, 7)], notes: '' },
      { exerciseId: 'hip-thrust', name: 'Hip Thrust', sets: [set(70)], notes: '' },
      { exerciseId: 'pallof-press', name: 'Pallof Press', sets: [set(20)], notes: '' },
    ],
    conditioning: '',
    notes: '',
  },
];

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