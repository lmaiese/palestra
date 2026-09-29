// Session persistence. One shared Firestore listener serves every subscriber
// (cost DoD C4: a single read query at startup, then cache + deltas).
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { idForSave } from './sessionId';
import { sortSessions, toDocData, toWorkoutSession } from './sessionData';
import type { WorkoutSession, WorkoutSessionInput } from './types';
import { validateSession } from './validation';

export { sortSessions, toDocData, toWorkoutSession } from './sessionData';

export const SESSIONS = 'sessions';

export interface SessionRepo {
  /** Calls onData with all sessions (date desc) now and on every change. Returns unsubscribe. */
  subscribe(onData: (s: WorkoutSession[]) => void, onError: (e: Error) => void): () => void;
  /**
   * Creates (no id) or updates (id) a session and resolves with the id it now lives under.
   * If an edit changes date/week/day so that `id` no longer matches, the session moves to a new
   * derived id (new doc written + old doc deleted atomically): always use the returned id.
   * Throws ValidationError before writing when the input is invalid.
   */
  save(input: WorkoutSessionInput, id?: string): Promise<string>;
  remove(id: string): Promise<void>;
}

/** Thrown by save() when validateSession fails; `errors` are Italian messages. */
export class ValidationError extends Error {
  readonly errors: string[];
  constructor(errors: string[]) {
    super(errors.join('\n'));
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

function assertValid(input: WorkoutSessionInput): void {
  const errors = validateSession(input);
  if (errors.length > 0) throw new ValidationError(errors);
}

function targetId(input: WorkoutSessionInput, id: string | undefined, known: ReadonlySet<string>): string {
  return idForSave(input.date, input.week, input.day, id, known);
}

export interface FirestoreRepoOptions {
  /** Online saves wait at most this long for the server ack, then resolve (default 3000 ms). */
  ackTimeoutMs?: number;
}

interface Listener {
  onData: (s: WorkoutSession[]) => void;
  onError: (e: Error) => void;
}

function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export function createFirestoreRepo(db: Firestore, options: FirestoreRepoOptions = {}): SessionRepo {
  const ackTimeoutMs = options.ackTimeoutMs ?? 3000;
  const col = collection(db, SESSIONS);
  const listeners = new Set<Listener>();
  let latest: WorkoutSession[] | null = null;
  let stop: (() => void) | null = null;

  const start = () => {
    stop = onSnapshot(
      query(col, orderBy('date', 'desc')),
      (snap) => {
        latest = sortSessions(snap.docs.map((d) => toWorkoutSession(d.id, d.data())));
        for (const l of [...listeners]) l.onData(latest);
      },
      (err) => {
        // Firestore ends a listener after an error: let the next subscribe restart it.
        stop = null;
        latest = null;
        for (const l of [...listeners]) l.onError(err);
      },
    );
  };

  const reportAsync = (p: Promise<unknown>) => {
    p.catch((e: unknown) => {
      const err = e instanceof Error ? e : new Error(String(e));
      for (const l of [...listeners]) l.onError(err);
    });
  };

  /**
   * The write is already in the local cache when `p` is created. Offline: resolve now.
   * Online: wait for the server ack up to ackTimeoutMs, then resolve anyway.
   * Failures after we resolved go to the subscribers' onError.
   */
  const commit = async (p: Promise<void>) => {
    if (isOffline()) {
      reportAsync(p);
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const acked = p.then(() => 'ack' as const);
    acked.catch(() => {}); // handled by the race or by reportAsync
    const timeout = new Promise<'timeout'>((resolve) => {
      timer = setTimeout(() => resolve('timeout'), ackTimeoutMs);
    });
    try {
      if ((await Promise.race([acked, timeout])) === 'timeout') reportAsync(p);
    } finally {
      clearTimeout(timer);
    }
  };

  return {
    subscribe(onData, onError) {
      const l: Listener = { onData, onError };
      listeners.add(l);
      if (!stop) start();
      else if (latest) {
        const snapshot = latest;
        queueMicrotask(() => {
          if (listeners.has(l)) onData(snapshot);
        });
      }
      return () => {
        listeners.delete(l);
        if (listeners.size === 0 && stop) {
          stop();
          stop = null;
          latest = null;
        }
      };
    },
    async save(input, id) {
      assertValid(input);
      const known = new Set((latest ?? []).map((s) => s.id));
      const docId = targetId(input, id, known);
      const ref = doc(col, docId);
      const data = toDocData(input);
      const fresh = { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
      let write: Promise<void>;
      if (id !== undefined && docId !== id) {
        // Date/week/day changed: move the session to its new id atomically.
        const batch = writeBatch(db);
        batch.set(ref, fresh);
        batch.delete(doc(col, id));
        write = batch.commit();
      } else if (id !== undefined && known.has(id)) {
        write = setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true });
      } else {
        write = setDoc(ref, fresh);
      }
      await commit(write);
      return docId;
    },
    async remove(id) {
      await commit(deleteDoc(doc(col, id)));
    },
  };
}

/** In-memory repo with the same semantics (async notifications via microtask). */
export function createMemoryRepo(initial: WorkoutSession[] = []): SessionRepo {
  const store = new Map<string, WorkoutSession>(initial.map((s) => [s.id, s]));
  const listeners = new Set<Listener>();
  const all = () => sortSessions([...store.values()]);
  const notify = () => {
    const snapshot = all();
    queueMicrotask(() => {
      for (const l of [...listeners]) l.onData(snapshot);
    });
  };
  return {
    subscribe(onData, onError) {
      const l: Listener = { onData, onError };
      listeners.add(l);
      const snapshot = all();
      queueMicrotask(() => {
        if (listeners.has(l)) onData(snapshot);
      });
      return () => {
        listeners.delete(l);
      };
    },
    async save(input, id) {
      assertValid(input);
      const docId = targetId(input, id, new Set(store.keys()));
      if (id !== undefined && id !== docId) store.delete(id);
      store.set(docId, { id: docId, ...toDocData(input) });
      notify();
      return docId;
    },
    async remove(id) {
      store.delete(id);
      notify();
    },
  };
}
