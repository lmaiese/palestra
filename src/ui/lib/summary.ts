import type { LoggedExercise, WorkoutSession } from '../../domain/types';
import { getSession } from '../../domain/plan';

export function topKg(ex: LoggedExercise): number | null {
  if (!ex.sets.length) return null;
  return Math.max(...ex.sets.map((s) => s.weightKg));
}

export function sessionTitle(s: WorkoutSession): string {
  if (s.week == null || s.day == null) return 'Fuori piano';
  const ps = getSession(s.week, s.day);
  return ps ? ps.title : `Seduta ${s.day}`;
}

export function sessionRef(s: WorkoutSession): string {
  if (s.week == null || s.day == null) return 'Extra';
  return `Sett. ${s.week}, ${s.day}`;
}

/** "70×5" / "70" / "70×5 @7" */
export function setLabel(set: { weightKg: number; reps: number | null; rpe: number | null }, fmt: (n: number) => string): string {
  let out = fmt(set.weightKg);
  if (set.reps != null) out += `×${set.reps}`;
  if (set.rpe != null) out += ` @${fmt(set.rpe)}`;
  return out;
}
