import type { DayId } from './types';

/** Document id: "2026-09-28-w1-A" for planned sessions, "2026-09-30-extra" otherwise. */
export function sessionIdFor(date: string, week: number | null, day: DayId | null): string {
  return week !== null && day !== null ? `${date}-w${week}-${day}` : `${date}-extra`;
}

/** First id not in `taken`: base, then base-2, base-3, ... */
export function uniqueSessionId(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/** Shape accepted for ids (mirrored in firestore.rules). */
export const SESSION_ID_RE = /^\d{4}-\d{2}-\d{2}-(w[1-8]-[ABC]|extra)(-\d{1,3})?$/;
