import type { LoggedExercise, LoggedSet, WorkoutSession } from '../../domain/types';
import { getSession } from '../../domain/plan';
import { exerciseHistory, personalBest } from '../../domain/stats';
import { BODYWEIGHT, kg } from './format';

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

/** "70×5", "70", "70×5 @7,5", "corpo libero ×8". */
export function setLabel(set: LoggedSet): string {
  let out = set.weightKg === 0 ? BODYWEIGHT : kg(set.weightKg);
  if (set.reps != null) out += set.weightKg === 0 ? ` ×${set.reps}` : `×${set.reps}`;
  if (set.rpe != null) out += ` @${kg(set.rpe)}`;
  return out;
}

/** Personal best with a real load; bodyweight-only history has no record. */
export function loadRecord(sessions: WorkoutSession[], exerciseId: string): { kg: number; date: string } | null {
  const best = personalBest(sessions, exerciseId);
  return best && best.kg > 0 ? best : null;
}

/**
 * True when `date` set the record for the exercise and beat an earlier load:
 * the first time an exercise is logged is not a record.
 */
export function isRecordOn(sessions: WorkoutSession[], exerciseId: string, date: string): boolean {
  const best = loadRecord(sessions, exerciseId);
  if (!best || best.date !== date) return false;
  return exerciseHistory(sessions, exerciseId).some((p) => p.date < date);
}
