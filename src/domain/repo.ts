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
  type Firestore,
} from 'firebase/firestore';
import { sessionIdFor, uniqueSessionId } from './sessionId';
import { sortSessions, toDocData, toWorkoutSession } from './sessionData';
import type { WorkoutSession, WorkoutSessionInput } from './types';
import { validateSession } from './validation';

export { sortSessions, toDocData, toWorkoutSession } from './sessionData';

export const SESSIONS = 'sessions';

export interface SessionRepo {
  /** Calls onData with all sessions (date desc) now and on every change. Returns unsubscribe. */
  subscribe(onData: (s: WorkoutSession[]) => void, onError: (e: Error) => void): () => void;
  /** Creates (no id / unknown id) or replaces (known id) a session. Resolves with the document id. */
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

function newId(input: WorkoutSessionInput, known: ReadonlySet<string>): string {
  return uniqueSessionId(sessionIdFor(input.date, input.week, input.day), known);
}

interface Listener {
  onData: (s: WorkoutSession[]) => void;
  onError: (e: Error) => void;
}

function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export function createFirestoreRepo(db: Firestore): SessionRepo {
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

  /** Online: wait for the server ack. Offline: the write is in the local cache, resolve now. */
  const commit = async (p: Promise<void>) => {
    if (isOffline()) reportAsync(p);
    else await p;
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
      const docId = id ?? newId(input, known);
      const ref = doc(col, docId);
      const data = toDocData(input);
      const write =
        id !== undefined && known.has(id)
          ? setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true })
          : setDoc(ref, { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
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
      const docId = id ?? newId(input, new Set(store.keys()));
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
