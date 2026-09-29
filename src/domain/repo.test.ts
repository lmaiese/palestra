import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { seedSessions } from './seed';
import type { WorkoutSession, WorkoutSessionInput } from './types';

// Minimal fake of the modular Firestore API used by repo.ts.
const fs = vi.hoisted(() => {
  const state = {
    onSnapshotCalls: 0,
    unsubscribed: 0,
    next: null as null | ((snap: unknown) => void),
    error: null as null | ((e: Error) => void),
    writes: [] as { id: string; data: Record<string, unknown>; opts?: unknown }[],
    deletes: [] as string[],
    batches: [] as string[][],
    failWrites: false,
  };
  return {
    state,
    collection: vi.fn((_db: unknown, name: string) => ({ name })),
    doc: vi.fn((_col: unknown, id: string) => ({ id })),
    query: vi.fn((c: unknown, ...c2: unknown[]) => ({ c, c2 })),
    orderBy: vi.fn((f: string, d: string) => ({ f, d })),
    serverTimestamp: vi.fn(() => 'SERVER_TS'),
    onSnapshot: vi.fn((_q: unknown, next: (s: unknown) => void, error: (e: Error) => void) => {
      state.onSnapshotCalls++;
      state.next = next;
      state.error = error;
      return () => {
        state.unsubscribed++;
      };
    }),
    setDoc: vi.fn(async (ref: { id: string }, data: Record<string, unknown>, opts?: unknown) => {
      if (state.failWrites) throw new Error('permission-denied');
      state.writes.push({ id: ref.id, data, opts });
    }),
    deleteDoc: vi.fn(async (ref: { id: string }) => {
      state.deletes.push(ref.id);
    }),
    writeBatch: vi.fn(() => {
      const ops: string[] = [];
      return {
        set: (ref: { id: string }, data: Record<string, unknown>) => {
          ops.push(`set:${ref.id}`);
          state.writes.push({ id: ref.id, data });
        },
        delete: (ref: { id: string }) => {
          ops.push(`delete:${ref.id}`);
          state.deletes.push(ref.id);
        },
        commit: async () => {
          state.batches.push(ops);
        },
      };
    }),
  };
});

vi.mock('firebase/firestore', () => fs);

const { createFirestoreRepo, createMemoryRepo, sortSessions, toWorkoutSession, ValidationError, SESSIONS } = await import('./repo');

const input = (over: Partial<WorkoutSessionInput> = {}): WorkoutSessionInput => ({
  date: '2026-09-29',
  week: 1,
  day: 'B',
  exercises: [{ exerciseId: 'bench-press', name: 'Bench Press', sets: [{ weightKg: 60, reps: 5, rpe: 7 }], notes: '' }],
  conditioning: '',
  notes: '',
  ...over,
});

const tick = () => new Promise((r) => setTimeout(r, 0));

function snap(sessions: WorkoutSession[]) {
  return { docs: sessions.map(({ id, ...data }) => ({ id, data: () => data })) };
}

describe('toWorkoutSession', () => {
  it('tolerates missing and malformed fields', () => {
    expect(toWorkoutSession('x', undefined)).toEqual({
      id: 'x', date: '', week: null, day: null, exercises: [], conditioning: '', notes: '', schemaVersion: 1,
    });
    const s = toWorkoutSession('y', {
      date: '2026-09-28', week: 1, day: 'Z', createdAt: {},
      exercises: [{ name: 'A', sets: [{ weightKg: 'x', reps: 5 }, null] }, 'bad'],
    });
    expect(s.day).toBeNull();
    expect(s.exercises[0]).toEqual({
      exerciseId: '', name: 'A', notes: '',
      sets: [{ weightKg: 0, reps: 5, rpe: null }, { weightKg: 0, reps: null, rpe: null }],
    });
    expect(s.exercises[1]).toEqual({ exerciseId: '', name: '', sets: [], notes: '' });
    expect(s).not.toHaveProperty('createdAt');
  });
});

describe('sortSessions', () => {
  it('sorts by date desc then id desc', () => {
    const mk = (id: string, date: string) => ({ ...seedSessions[0], id, date });
    expect(sortSessions([mk('a', '2026-01-01'), mk('b', '2026-01-02'), mk('c', '2026-01-01'), mk('c', '2026-01-01')]).map((s) => s.id)).toEqual(['b', 'c', 'c', 'a']);
  });
});

describe('createMemoryRepo', () => {
  it('delivers the initial data asynchronously, sorted desc', async () => {
    const repo = createMemoryRepo(seedSessions);
    const onData = vi.fn();
    repo.subscribe(onData, vi.fn());
    expect(onData).not.toHaveBeenCalled();
    await tick();
    expect(onData.mock.calls[0][0].map((s: WorkoutSession) => s.id)).toEqual(['2026-09-28-w1-A', '2026-09-25-w1-C']);
  });

  it('saves, updates and removes, notifying subscribers', async () => {
    const repo = createMemoryRepo();
    const onData = vi.fn();
    const unsub = repo.subscribe(onData, vi.fn());
    const id = await repo.save(input());
    expect(id).toBe('2026-09-29-w1-B');
    const id2 = await repo.save(input());
    expect(id2).toBe('2026-09-29-w1-B-2');
    await repo.save(input({ notes: 'aggiornato' }), id);
    await tick();
    const last = onData.mock.calls.at(-1)?.[0] as WorkoutSession[];
    expect(last).toHaveLength(2);
    expect(last.find((s) => s.id === id)?.notes).toBe('aggiornato');
    await repo.remove(id2);
    await tick();
    expect(onData.mock.calls.at(-1)?.[0]).toHaveLength(1);
    unsub();
    await repo.remove(id);
    await tick();
    expect(onData.mock.calls.at(-1)?.[0]).toHaveLength(1);
  });

  it('moves a session to a new id when date/week/day change on edit', async () => {
    const repo = createMemoryRepo(seedSessions);
    const onData = vi.fn();
    repo.subscribe(onData, vi.fn());
    const { id: oldId, schemaVersion: _v, ...edit } = seedSessions[1];
    void _v;
    const newId = await repo.save({ ...edit, date: '2026-09-29', day: 'B' }, oldId);
    expect(newId).toBe('2026-09-29-w1-B');
    await tick();
    const ids = (onData.mock.calls.at(-1)?.[0] as WorkoutSession[]).map((s) => s.id);
    expect(ids).toEqual(['2026-09-29-w1-B', '2026-09-25-w1-C']);
    expect(await repo.save({ ...edit, date: '2026-09-29', day: 'B', notes: 'x' }, newId)).toBe(newId);
  });

  it('rejects invalid input with Italian messages', async () => {
    const repo = createMemoryRepo();
    await expect(repo.save(input({ date: 'ieri' }))).rejects.toBeInstanceOf(ValidationError);
    await expect(repo.save(input({ week: 9 }))).rejects.toThrow(/settimana/i);
  });

  it('does not deliver to a listener that unsubscribed before the microtask', async () => {
    const repo = createMemoryRepo(seedSessions);
    const onData = vi.fn();
    repo.subscribe(onData, vi.fn())();
    await tick();
    expect(onData).not.toHaveBeenCalled();
  });
});

describe('createFirestoreRepo', () => {
  const db = {} as never;
  beforeEach(() => {
    Object.assign(fs.state, { onSnapshotCalls: 0, unsubscribed: 0, next: null, error: null, writes: [], deletes: [], batches: [], failWrites: false });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shares a single ordered listener between subscribers (C4)', async () => {
    const repo = createFirestoreRepo(db);
    expect(fs.collection).toHaveBeenCalledWith(db, SESSIONS);
    const a = vi.fn();
    const b = vi.fn();
    const unA = repo.subscribe(a, vi.fn());
    fs.state.next?.(snap(seedSessions));
    const unB = repo.subscribe(b, vi.fn());
    expect(fs.state.onSnapshotCalls).toBe(1);
    expect(fs.orderBy).toHaveBeenCalledWith('date', 'desc');
    await tick();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    expect(b.mock.calls[0][0][0].id).toBe('2026-09-28-w1-A');
    unA();
    expect(fs.state.unsubscribed).toBe(0);
    unB();
    expect(fs.state.unsubscribed).toBe(1);
    repo.subscribe(vi.fn(), vi.fn());
    expect(fs.state.onSnapshotCalls).toBe(2);
  });

  it('skips the replay for a subscriber that left before the microtask', async () => {
    const repo = createFirestoreRepo(db);
    repo.subscribe(vi.fn(), vi.fn());
    fs.state.next?.(snap(seedSessions));
    const late = vi.fn();
    repo.subscribe(late, vi.fn())();
    await tick();
    expect(late).not.toHaveBeenCalled();
  });

  it('propagates listener errors and restarts on next subscribe', () => {
    const repo = createFirestoreRepo(db);
    const onError = vi.fn();
    const unsub = repo.subscribe(vi.fn(), onError);
    fs.state.error?.(new Error('permission-denied'));
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'permission-denied' }));
    unsub();
    expect(fs.state.unsubscribed).toBe(0);
    repo.subscribe(vi.fn(), vi.fn());
    expect(fs.state.onSnapshotCalls).toBe(2);
  });

  it('creates new documents with both timestamps and a derived id', async () => {
    const repo = createFirestoreRepo(db);
    const id = await repo.save(input());
    expect(id).toBe('2026-09-29-w1-B');
    const w = fs.state.writes[0];
    expect(w.opts).toBeUndefined();
    expect(Object.keys(w.data)).toEqual([
      'date', 'week', 'day', 'exercises', 'conditioning', 'notes', 'schemaVersion', 'createdAt', 'updatedAt',
    ]);
    expect(w.data).toMatchObject({ schemaVersion: 1, createdAt: 'SERVER_TS', updatedAt: 'SERVER_TS' });
    expect(w.data).not.toHaveProperty('id');
  });

  it('avoids id collisions with known documents and updates known ids with merge', async () => {
    const repo = createFirestoreRepo(db);
    repo.subscribe(vi.fn(), vi.fn());
    fs.state.next?.(snap([{ ...seedSessions[1], id: '2026-09-29-w1-B', date: '2026-09-29', day: 'B' }]));
    expect(await repo.save(input())).toBe('2026-09-29-w1-B-2');
    expect(await repo.save(input({ notes: 'x' }), '2026-09-29-w1-B')).toBe('2026-09-29-w1-B');
    const upd = fs.state.writes[1];
    expect(upd.opts).toEqual({ merge: true });
    expect(upd.data).not.toHaveProperty('createdAt');
    expect(upd.data.updatedAt).toBe('SERVER_TS');
  });

  it('moves an edited session to its new id with one atomic batch', async () => {
    const repo = createFirestoreRepo(db);
    repo.subscribe(vi.fn(), vi.fn());
    fs.state.next?.(snap(seedSessions));
    const { id: oldId, schemaVersion: _v, ...edit } = seedSessions[1];
    void _v;
    const newId = await repo.save({ ...edit, date: '2026-09-29', day: 'B' }, oldId);
    expect(newId).toBe('2026-09-29-w1-B');
    expect(fs.state.batches).toEqual([['set:2026-09-29-w1-B', 'delete:2026-09-28-w1-A']]);
    expect(fs.state.writes[0].data).toMatchObject({ date: '2026-09-29', day: 'B', createdAt: 'SERVER_TS' });
  });

  it('validates before writing', async () => {
    const repo = createFirestoreRepo(db);
    await expect(repo.save(input({ exercises: 'x' as never }))).rejects.toBeInstanceOf(ValidationError);
    expect(fs.state.writes).toHaveLength(0);
  });

  it('awaits the server when online and reports failures', async () => {
    const repo = createFirestoreRepo(db);
    fs.state.failWrites = true;
    await expect(repo.save(input())).rejects.toThrow('permission-denied');
    await repo.remove('abc');
    expect(fs.state.deletes).toEqual(['abc']);
  });

  it('resolves after the ack timeout when the server is slow, reporting late failures', async () => {
    const repo = createFirestoreRepo(db, { ackTimeoutMs: 20 });
    const onError = vi.fn();
    repo.subscribe(vi.fn(), onError);
    let fail: (e: Error) => void = () => {};
    fs.setDoc.mockImplementationOnce(() => new Promise<void>((_res, rej) => { fail = rej; }));
    await expect(repo.save(input())).resolves.toBe('2026-09-29-w1-B');
    fail(new Error('permission-denied'));
    await tick();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'permission-denied' }));
  });

  it('uses a 3 s default ack timeout', async () => {
    vi.useFakeTimers();
    try {
      const repo = createFirestoreRepo(db);
      fs.setDoc.mockImplementationOnce(() => new Promise<void>(() => {}));
      let done = false;
      const p = repo.save(input()).then(() => { done = true; });
      await vi.advanceTimersByTimeAsync(2999);
      expect(done).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await p;
      expect(done).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('resolves immediately when offline and routes late failures to onError', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    const repo = createFirestoreRepo(db);
    const onError = vi.fn();
    repo.subscribe(vi.fn(), onError);
    fs.state.failWrites = true;
    await expect(repo.save(input())).resolves.toBe('2026-09-29-w1-B');
    await tick();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'permission-denied' }));
    fs.deleteDoc.mockImplementationOnce(async () => {
      throw 'boom';
    });
    await repo.remove('x');
    await tick();
    expect(onError).toHaveBeenLastCalledWith(expect.objectContaining({ message: 'boom' }));
  });
});
