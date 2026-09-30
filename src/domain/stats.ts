// Pure statistics over logged sessions. Must not import Firebase (cost DoD C3).
import { defaultDayForDate, getSession, getWeek, weekForDate } from './plan';
import type { DayId, LoggedSet, WorkoutSession, WorkoutSessionInput } from './types';

export interface HistoryPoint {
  date: string;
  sessionId: string;
  /** Heaviest load of the day; 0 = bodyweight only. */
  topKg: number;
  /** Most reps done at topKg (null when not logged). */
  topReps: number | null;
  sets: LoggedSet[];
}

/** A reference load. `bodyweight` is true when kg === 0 (corpo libero): show reps, not "0 kg". */
export interface LoadRef {
  kg: number;
  date: string;
  reps: number | null;
  bodyweight: boolean;
}

function topRepsAt(sets: LoggedSet[], kg: number): number | null {
  const reps = sets.filter((s) => s.weightKg === kg && s.reps !== null).map((s) => s.reps as number);
  return reps.length ? Math.max(...reps) : null;
}

function toRef(p: HistoryPoint): LoadRef {
  return { kg: p.topKg, date: p.date, reps: p.topReps, bodyweight: p.topKg === 0 };
}

/** True when `a` beats `b`: more kg, or same kg and more reps. */
function better(a: HistoryPoint, b: HistoryPoint): boolean {
  if (a.topKg !== b.topKg) return a.topKg > b.topKg;
  return (a.topReps ?? -1) > (b.topReps ?? -1);
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
    const topKg = Math.max(...sets.map((x) => x.weightKg));
    out.push({ date: s.date, sessionId: s.id, topKg, topReps: topRepsAt(sets, topKg), sets });
  }
  return out;
}

/** Best load ever logged: most kg, then most reps; earliest date on ties. */
export function personalBest(sessions: WorkoutSession[], exerciseId: string): LoadRef | null {
  let best: HistoryPoint | null = null;
  for (const p of exerciseHistory(sessions, exerciseId)) {
    if (!best || better(p, best)) best = p;
  }
  return best ? toRef(best) : null;
}

/** Top load of the most recent session with this exercise, strictly before `beforeDate` if given. */
export function lastLoad(sessions: WorkoutSession[], exerciseId: string, beforeDate?: string): LoadRef | null {
  const hist = exerciseHistory(sessions, exerciseId).filter((p) => beforeDate === undefined || p.date < beforeDate);
  const last = hist[hist.length - 1];
  return last ? toRef(last) : null;
}

/**
 * For a cycle week, the logged session for each day. A session counts only if its date falls
 * inside the plan week [startDate, endDate] (the week label is ignored); the latest one wins.
 */
export function weekCompletion(sessions: WorkoutSession[], week: number): Record<DayId, WorkoutSession | null> {
  const out: Record<DayId, WorkoutSession | null> = { A: null, B: null, C: null };
  const w = getWeek(week);
  if (!w) return out;
  for (const s of [...sessions].sort(byDateAsc)) {
    if (s.day !== null && s.date >= w.startDate && s.date <= w.endDate) out[s.day] = s;
  }
  return out;
}

/** First session of the week (A→B→C) with nothing logged in the week's date range; null if all done or week unknown. */
export function pendingDay(sessions: WorkoutSession[], week: number): DayId | null {
  if (!getWeek(week)) return null;
  const done = weekCompletion(sessions, week);
  return (['A', 'B', 'C'] as const).find((d) => done[d] === null) ?? null;
}

/**
 * Plan reference for a workout logged on `date`: the scheduled day (Mon A, Fri B, Sat C per the plan),
 * otherwise the first session still missing that week, so off days (weekend included) log the pending one.
 */
export function suggestedRef(sessions: WorkoutSession[], date: string): { week: number | null; day: DayId | null } {
  const week = weekForDate(date);
  if (week === null) return { week: null, day: null };
  const day = defaultDayForDate(date) ?? pendingDay(sessions, week);
  return day === null ? { week: null, day: null } : { week, day };
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
