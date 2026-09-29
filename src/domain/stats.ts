// Pure statistics over logged sessions. Must not import Firebase (cost DoD C3).
import { getSession } from './plan';
import type { DayId, LoggedSet, WorkoutSession, WorkoutSessionInput } from './types';

export interface HistoryPoint {
  date: string;
  sessionId: string;
  topKg: number;
  sets: LoggedSet[];
}

function byDateAsc(a: WorkoutSession, b: WorkoutSession): number {
  return a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Chronological loads for an exercise; sessions without sets for it are skipped. */
export function exerciseHistory(sessions: WorkoutSession[], exerciseId: string): HistoryPoint[] {
  const out: HistoryPoint[] = [];
  for (const s of [...sessions].sort(byDateAsc)) {
    const sets = s.exercises.filter((e) => e.exerciseId === exerciseId).flatMap((e) => e.sets);
    if (sets.length === 0) continue;
    out.push({ date: s.date, sessionId: s.id, topKg: Math.max(...sets.map((x) => x.weightKg)), sets });
  }
  return out;
}

/** Heaviest load ever logged (earliest date on ties). */
export function personalBest(sessions: WorkoutSession[], exerciseId: string): { kg: number; date: string } | null {
  let best: { kg: number; date: string } | null = null;
  for (const p of exerciseHistory(sessions, exerciseId)) {
    if (!best || p.topKg > best.kg) best = { kg: p.topKg, date: p.date };
  }
  return best;
}

/** Top load of the most recent session with this exercise, strictly before `beforeDate` if given. */
export function lastLoad(
  sessions: WorkoutSession[],
  exerciseId: string,
  beforeDate?: string,
): { kg: number; date: string } | null {
  const hist = exerciseHistory(sessions, exerciseId).filter((p) => beforeDate === undefined || p.date < beforeDate);
  const last = hist[hist.length - 1];
  return last ? { kg: last.topKg, date: last.date } : null;
}

/** For a cycle week, the logged session for each day (latest one if several). */
export function weekCompletion(sessions: WorkoutSession[], week: number): Record<DayId, WorkoutSession | null> {
  const out: Record<DayId, WorkoutSession | null> = { A: null, B: null, C: null };
  for (const s of [...sessions].sort(byDateAsc)) {
    if (s.week === week && s.day !== null) out[s.day] = s;
  }
  return out;
}

/** New session prefilled with the planned exercises (no sets; conditioning rows skipped). */
export function sessionFromPlan(week: number, day: DayId, date: string): WorkoutSessionInput {
  const planned = getSession(week, day);
  return {
    date,
    week,
    day,
    exercises: (planned?.exercises ?? [])
      .filter((e) => e.block !== 'Conditioning')
      .map((e) => ({ exerciseId: e.exerciseId, name: e.name, sets: [], notes: '' })),
    conditioning: '',
    notes: '',
  };
}
