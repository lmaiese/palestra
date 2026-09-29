// Writes the seed sessions to PRODUCTION Firestore via REST, create-if-missing.
// Auth: `gcloud auth print-access-token` (IAM credentials; security rules do not apply).
// Usage: npm run seed [-- --dry-run]
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { seedSessions } from '../src/domain/seed';
import { toDocData } from '../src/domain/sessionData';
import type { WorkoutSession } from '../src/domain/types';

export const PROJECT_ID = 'palestra-luigi';
const BASE = 'https://firestore.googleapis.com/v1';

export type FirestoreValue =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { stringValue: string }
  | { arrayValue: { values: FirestoreValue[] } }
  | { mapValue: { fields: Record<string, FirestoreValue> } };

/** JS value -> Firestore REST value (integers as integerValue, like the web SDK). */
export function toFirestoreValue(v: unknown): FirestoreValue {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new Error(`Numero non valido: ${v}`);
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFirestoreValue) } };
  if (typeof v === 'object') return { mapValue: { fields: toFields(v as Record<string, unknown>) } };
  throw new Error(`Tipo non supportato: ${typeof v}`);
}

export function toFields(obj: Record<string, unknown>): Record<string, FirestoreValue> {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, toFirestoreValue(v)]));
}

export function docName(projectId: string, id: string): string {
  return `projects/${projectId}/databases/(default)/documents/sessions/${id}`;
}

/** Commit body creating the document only if missing, with server timestamps. */
export function buildCommitBody(session: WorkoutSession, projectId = PROJECT_ID) {
  const { id, ...input } = session;
  return {
    writes: [
      {
        update: { name: docName(projectId, id), fields: toFields({ ...toDocData(input) }) },
        currentDocument: { exists: false },
        updateTransforms: [
          { fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' },
          { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
        ],
      },
    ],
  };
}

type Fetch = (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
}>;

export interface SeedOptions {
  dryRun: boolean;
  projectId?: string;
  sessions?: WorkoutSession[];
  getToken?: () => string;
  fetch?: Fetch;
  log?: (line: string) => void;
}

export type SeedOutcome = 'creato' | 'già presente' | 'dry-run';

function isAlreadyExists(status: number, body: string): boolean {
  return status === 409 || /ALREADY_EXISTS|FAILED_PRECONDITION/.test(body);
}

export async function runSeed(opts: SeedOptions): Promise<Record<string, SeedOutcome>> {
  const projectId = opts.projectId ?? PROJECT_ID;
  const sessions = opts.sessions ?? seedSessions;
  const log = opts.log ?? console.log;
  const out: Record<string, SeedOutcome> = {};
  if (opts.dryRun) {
    for (const s of sessions) {
      log(`[dry-run] creerei sessions/${s.id} (${s.date}, ${s.exercises.length} esercizi) se assente`);
      log(JSON.stringify(buildCommitBody(s, projectId)));
      out[s.id] = 'dry-run';
    }
    return out;
  }
  const token = (opts.getToken ?? gcloudToken)();
  const doFetch = opts.fetch ?? (globalThis.fetch as unknown as Fetch);
  const headers = {
    Authorization: `Bearer ${token}`,
    'x-goog-user-project': projectId,
    'Content-Type': 'application/json',
  };
  for (const s of sessions) {
    const res = await doFetch(`${BASE}/projects/${projectId}/databases/(default)/documents:commit`, {
      method: 'POST',
      headers,
      body: JSON.stringify(buildCommitBody(s, projectId)),
    });
    const body = await res.text();
    if (res.ok) {
      out[s.id] = 'creato';
    } else if (isAlreadyExists(res.status, body)) {
      out[s.id] = 'già presente';
    } else {
      throw new Error(`sessions/${s.id}: HTTP ${res.status} ${body}`);
    }
    log(`sessions/${s.id}: ${out[s.id]}`);
  }
  return out;
}

function gcloudToken(): string {
  return execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8' }).trim();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSeed({ dryRun: process.argv.includes('--dry-run') }).catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
