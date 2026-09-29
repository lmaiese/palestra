// Firestore rules (DoD S1, S2). Run with `npm run test:rules` (Firestore emulator, project demo-palestra).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, getDocs, collection, serverTimestamp, setDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

const OWNER = 'maieseluigi@gmail.com';
const ID = '2026-09-28-w1-A';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-palestra',
    firestore: {
      rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

type Ctx = RulesTestContext;

const owner = (): Ctx =>
  env.authenticatedContext('owner-uid', {
    email: OWNER,
    email_verified: true,
    firebase: { sign_in_provider: 'google.com' },
  });

function body(over: Record<string, unknown> = {}) {
  return {
    date: '2026-09-28',
    week: 1,
    day: 'A',
    exercises: [
      { exerciseId: 'back-squat', name: 'Back Squat', sets: [{ weightKg: 70, reps: null, rpe: 7 }], notes: '' },
      { exerciseId: 'hip-thrust', name: 'Hip Thrust', sets: [{ weightKg: 72.5, reps: 8, rpe: null }], notes: '' },
    ],
    conditioning: '',
    notes: '',
    schemaVersion: 1,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...over,
  };
}

const set = (weightKg: unknown, reps: unknown = null, rpe: unknown = null) => ({ weightKg, reps, rpe });
const withSet = (s: unknown) => body({ exercises: [{ exerciseId: 'deadlift', name: 'Deadlift', sets: [s], notes: '' }] });
const sessions = (c: Ctx) => doc(c.firestore(), 'sessions', ID);

async function seedDoc() {
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), 'sessions', ID), body({ createdAt: Timestamp.fromMillis(1), updatedAt: Timestamp.fromMillis(1) }));
    await setDoc(doc(c.firestore(), 'other', 'x'), { a: 1 });
  });
}

describe('S1: only the verified Google owner', () => {
  const intruders: [string, () => Ctx][] = [
    ['anonymous', () => env.unauthenticatedContext()],
    ['another Google account', () => env.authenticatedContext('x', { email: 'altro@gmail.com', email_verified: true, firebase: { sign_in_provider: 'google.com' } })],
    ['owner email not verified', () => env.authenticatedContext('x', { email: OWNER, email_verified: false, firebase: { sign_in_provider: 'google.com' } })],
    ['owner email via password provider', () => env.authenticatedContext('x', { email: OWNER, email_verified: true, firebase: { sign_in_provider: 'password' } })],
    ['anonymous auth provider', () => env.authenticatedContext('x', { firebase: { sign_in_provider: 'anonymous' } })],
  ];

  it.each(intruders)('%s cannot read, list, create, update or delete', async (_name, ctx) => {
    await seedDoc();
    const c = ctx();
    await assertFails(getDoc(sessions(c)));
    await assertFails(getDocs(collection(c.firestore(), 'sessions')));
    await assertFails(setDoc(doc(c.firestore(), 'sessions', '2026-09-29-w1-B'), body({ date: '2026-09-29', day: 'B' })));
    await assertFails(updateDoc(sessions(c), { notes: 'x', updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(sessions(c)));
  });

  it('owner can create, read, list, update and delete', async () => {
    const c = owner();
    await assertSucceeds(setDoc(sessions(c), body()));
    await assertSucceeds(getDoc(sessions(c)));
    await assertSucceeds(getDocs(collection(c.firestore(), 'sessions')));
    // Same write the repo does for an edit: full fields + updatedAt, merged (createdAt kept).
    const { createdAt: _omit, ...edit } = body({ notes: 'aggiornato' });
    void _omit;
    await assertSucceeds(setDoc(sessions(c), edit, { merge: true }));
    await assertSucceeds(updateDoc(sessions(c), { week: null, day: null, updatedAt: serverTimestamp() }));
    await assertSucceeds(deleteDoc(sessions(c)));
  });

  it('owner email is matched on the token as stored (lowercase)', async () => {
    const c = env.authenticatedContext('x', { email: 'MAIESELUIGI@gmail.com', email_verified: true, firebase: { sign_in_provider: 'google.com' } });
    await assertFails(getDoc(sessions(c)));
  });

  it('other collections are denied, even to the owner', async () => {
    await seedDoc();
    const c = owner();
    await assertFails(getDoc(doc(c.firestore(), 'other', 'x')));
    await assertFails(setDoc(doc(c.firestore(), 'other', 'y'), { a: 1 }));
    await assertFails(setDoc(doc(c.firestore(), 'sessions', ID, 'sub', 'z'), { a: 1 }));
  });
});

describe('S2: document shape', () => {
  const create = (data: unknown, id = ID) => setDoc(doc(owner().firestore(), 'sessions', id), data as Record<string, unknown>);

  it('accepts off-plan sessions and bare loads', async () => {
    await assertSucceeds(create(body({ week: null, day: null, exercises: [] }), '2026-09-30-extra'));
    await assertSucceeds(create(withSet(set(0, 8)), '2026-09-30-extra-2'));
    await assertSucceeds(create(withSet(set(500, 100, 10))));
  });

  it.each([
    ['extra key', body({ hacked: true })],
    ['missing key', (() => { const b: Record<string, unknown> = body(); delete b.notes; return b; })()],
    ['bad date format', body({ date: '28/09/2026' })],
    ['bad month', body({ date: '2026-13-01' })],
    ['week 9', body({ week: 9 })],
    ['week 0', body({ week: 0 })],
    ['week as string', body({ week: '1' })],
    ['day D', body({ day: 'D' })],
    ['schemaVersion 2', body({ schemaVersion: 2 })],
    ['notes too long', body({ notes: 'x'.repeat(2001) })],
    ['conditioning not a string', body({ conditioning: 3 })],
    ['exercises not a list', body({ exercises: {} })],
    ['31 exercises', body({ exercises: Array.from({ length: 31 }, () => ({ exerciseId: 'a', name: 'A', sets: [], notes: '' })) })],
    ['exercise extra key', body({ exercises: [{ exerciseId: 'a', name: 'A', sets: [], notes: '', x: 1 }] })],
    ['exercise empty id', body({ exercises: [{ exerciseId: '', name: 'A', sets: [], notes: '' }] })],
    ['exercise empty name', body({ exercises: [{ exerciseId: 'a', name: '', sets: [], notes: '' }] })],
    ['21 sets', body({ exercises: [{ exerciseId: 'a', name: 'A', sets: Array.from({ length: 21 }, () => set(1)), notes: '' }] })],
    ['negative kg', withSet(set(-1))],
    ['kg over 500', withSet(set(500.5))],
    ['kg as string', withSet(set('70'))],
    ['reps 101', withSet(set(70, 101))],
    ['reps decimal', withSet(set(70, 2.5))],
    ['rpe 11', withSet(set(70, null, 11))],
    ['rpe 0', withSet(set(70, null, 0))],
    ['bodyweight without reps', withSet(set(0))],
    ['bodyweight with 0 reps', withSet(set(0, 0))],
    ['set extra key', withSet({ ...set(70), x: 1 })],
    ['set missing reps', withSet({ weightKg: 70, rpe: null })],
    ['client createdAt', body({ createdAt: Timestamp.fromMillis(1) })],
  ])('rejects %s', async (_name, data) => {
    await assertFails(create(data));
  });

  const maxExercises = () =>
    Array.from({ length: 30 }, (_, i) => ({
      exerciseId: `e${i}`,
      name: `Esercizio ${i}`,
      sets: Array.from({ length: 20 }, () => set(100, 5, 8)),
      notes: 'n'.repeat(2000),
    }));

  it('accepts a maximal legal document within the expression budget', async () => {
    await assertSucceeds(create(body({ exercises: maxExercises(), notes: 'x'.repeat(2000), conditioning: 'y'.repeat(2000) })));
  });

  it('rejects a bad set among the validated ones (first 2 sets of the first 2 exercises)', async () => {
    const ex = maxExercises();
    ex[1].sets[1] = set(900);
    await assertFails(create(body({ exercises: ex })));
  });

  it('documents the gap: later exercises/sets are validated only client-side', async () => {
    const ex = maxExercises();
    ex[29].sets[19] = set(900);
    await assertSucceeds(create(body({ exercises: ex })));
  });

  it('rejects malformed document ids', async () => {
    await assertFails(create(body(), 'random-id'));
    await assertFails(create(body(), '2026-09-28-w9-A'));
  });

  it('lets legacy documents without createdAt be edited', async () => {
    await env.withSecurityRulesDisabled(async (c) => {
      const { createdAt: _c, ...legacy } = body({ updatedAt: Timestamp.fromMillis(1) });
      void _c;
      await setDoc(doc(c.firestore(), 'sessions', ID), legacy);
    });
    const c = owner();
    await assertSucceeds(updateDoc(sessions(c), { notes: 'x', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(sessions(c), { createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  });

  it('keeps createdAt immutable and requires a fresh updatedAt', async () => {
    await seedDoc();
    const c = owner();
    await assertFails(updateDoc(sessions(c), { createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(sessions(c), { notes: 'x' }));
    await assertFails(updateDoc(sessions(c), { notes: 'x', updatedAt: Timestamp.fromMillis(5) }));
    await assertFails(updateDoc(sessions(c), { week: 9, updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(sessions(c), { notes: 'x', updatedAt: serverTimestamp() }));
  });
});
