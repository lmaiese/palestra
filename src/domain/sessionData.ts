// Pure mapping between WorkoutSession and the stored Firestore document.
// No Firebase import: usable from scripts (seed) and plan-only code.
import type { DayId, LoggedExercise, LoggedSet, WorkoutSession, WorkoutSessionInput } from './types';

/** Date desc, then id desc. */
export function sortSessions(list: WorkoutSession[]): WorkoutSession[] {
  return [...list].sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
}

function rec(v: unknown): Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function toSet(v: unknown): LoggedSet {
  const r = rec(v);
  return { weightKg: numOrNull(r.weightKg) ?? 0, reps: numOrNull(r.reps), rpe: numOrNull(r.rpe) };
}

function toExercise(v: unknown): LoggedExercise {
  const r = rec(v);
  return {
    exerciseId: str(r.exerciseId),
    name: str(r.name),
    sets: Array.isArray(r.sets) ? r.sets.map(toSet) : [],
    notes: str(r.notes),
  };
}

/** Maps a stored document back to a WorkoutSession, tolerating missing or odd fields. */
export function toWorkoutSession(id: string, data: unknown): WorkoutSession {
  const r = rec(data);
  const day = r.day === 'A' || r.day === 'B' || r.day === 'C' ? (r.day as DayId) : null;
  return {
    id,
    date: str(r.date),
    week: numOrNull(r.week),
    day,
    exercises: Array.isArray(r.exercises) ? r.exercises.map(toExercise) : [],
    conditioning: str(r.conditioning),
    notes: str(r.notes),
    schemaVersion: 1,
  };
}

/** Stored fields for a session (without id and timestamps), in a stable key order. */
export function toDocData(input: WorkoutSessionInput): Omit<WorkoutSession, 'id'> {
  return {
    date: input.date,
    week: input.week,
    day: input.day,
    exercises: input.exercises.map((e) => ({
      exerciseId: e.exerciseId,
      name: e.name,
      sets: e.sets.map((s) => ({ weightKg: s.weightKg, reps: s.reps, rpe: s.rpe })),
      notes: e.notes,
    })),
    conditioning: input.conditioning,
    notes: input.notes,
    schemaVersion: 1,
  };
}
