// Client-side mirror of the Firestore rules. Messages are user-facing (Italian).
// Contract: weightKg 0 means bodyweight (corpo libero) and then reps >= 1 is required.
import { isValidIsoDate } from './dates';
import type { WorkoutSessionInput } from './types';

export const LIMITS = {
  maxKg: 500,
  maxReps: 100,
  minRpe: 1,
  maxRpe: 10,
  maxExercises: 30,
  maxSets: 20,
  maxText: 2000,
  maxIdLength: 100,
  maxWeek: 8,
} as const;

const SESSION_KEYS = ['date', 'week', 'day', 'exercises', 'conditioning', 'notes'];
const EXERCISE_KEYS = ['exerciseId', 'name', 'sets', 'notes'];
const SET_KEYS = ['weightKg', 'reps', 'rpe'];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function textError(v: unknown, label: string, required = false): string | null {
  if (typeof v !== 'string') return `${label}: deve essere un testo`;
  if (required && v.trim() === '') return `${label}: obbligatorio`;
  if (v.length > LIMITS.maxText) return `${label}: massimo ${LIMITS.maxText} caratteri`;
  return null;
}

function extraKeys(obj: Record<string, unknown>, allowed: string[], label: string): string[] {
  return Object.keys(obj)
    .filter((k) => !allowed.includes(k))
    .map((k) => `${label}: campo non ammesso "${k}"`);
}

function validateSet(set: unknown, label: string): string[] {
  if (!isRecord(set)) return [`${label}: set non valido`];
  const errors = extraKeys(set, SET_KEYS, label);
  if (!isNum(set.weightKg) || set.weightKg < 0 || set.weightKg > LIMITS.maxKg) {
    errors.push(`${label}: i kg devono essere un numero tra 0 e ${LIMITS.maxKg}`);
  }
  if (set.reps !== null && (!Number.isInteger(set.reps) || (set.reps as number) < 0 || (set.reps as number) > LIMITS.maxReps)) {
    errors.push(`${label}: le ripetizioni devono essere un intero tra 0 e ${LIMITS.maxReps} (o vuote)`);
  }
  if (set.weightKg === 0 && (set.reps === null || set.reps === 0)) {
    errors.push(`${label}: set a corpo libero (0 kg): indica le ripetizioni`);
  }
  if (set.rpe !== null && (!isNum(set.rpe) || set.rpe < LIMITS.minRpe || set.rpe > LIMITS.maxRpe)) {
    errors.push(`${label}: l'RPE deve essere tra ${LIMITS.minRpe} e ${LIMITS.maxRpe} (o vuoto)`);
  }
  return errors;
}

function validateExercise(ex: unknown, index: number): string[] {
  const base = `Esercizio ${index + 1}`;
  if (!isRecord(ex)) return [`${base}: non valido`];
  const label = typeof ex.name === 'string' && ex.name.trim() ? `${base} (${ex.name.trim()})` : base;
  const errors = extraKeys(ex, EXERCISE_KEYS, label);
  if (typeof ex.exerciseId !== 'string' || ex.exerciseId === '' || ex.exerciseId.length > LIMITS.maxIdLength) {
    errors.push(`${label}: identificativo esercizio non valido`);
  }
  const nameErr = textError(ex.name, `${base}: nome`, true);
  if (nameErr) errors.push(nameErr);
  const notesErr = textError(ex.notes, `${label}: note`);
  if (notesErr) errors.push(notesErr);
  if (!Array.isArray(ex.sets)) {
    errors.push(`${label}: elenco dei set non valido`);
  } else {
    if (ex.sets.length > LIMITS.maxSets) errors.push(`${label}: massimo ${LIMITS.maxSets} set`);
    ex.sets.forEach((s, i) => errors.push(...validateSet(s, `${label}, set ${i + 1}`)));
  }
  return errors;
}

/** [] when valid, otherwise Italian messages. Mirrors firestore.rules. */
export function validateSession(input: WorkoutSessionInput): string[] {
  const raw: unknown = input;
  if (!isRecord(raw)) return ['Allenamento non valido'];
  const errors = extraKeys(raw, SESSION_KEYS, 'Allenamento');
  if (!isValidIsoDate(raw.date)) errors.push('Data non valida: usa il formato AAAA-MM-GG');
  if (raw.week !== null && (!Number.isInteger(raw.week) || (raw.week as number) < 1 || (raw.week as number) > LIMITS.maxWeek)) {
    errors.push(`La settimana deve essere tra 1 e ${LIMITS.maxWeek} (o nessuna)`);
  }
  if (raw.day !== null && raw.day !== 'A' && raw.day !== 'B' && raw.day !== 'C') {
    errors.push('Il giorno deve essere A, B o C (o nessuno)');
  }
  if (!Array.isArray(raw.exercises)) {
    errors.push('Elenco esercizi non valido');
  } else {
    if (raw.exercises.length > LIMITS.maxExercises) errors.push(`Massimo ${LIMITS.maxExercises} esercizi`);
    raw.exercises.forEach((ex, i) => errors.push(...validateExercise(ex, i)));
  }
  const condErr = textError(raw.conditioning, 'Conditioning');
  if (condErr) errors.push(condErr);
  const notesErr = textError(raw.notes, 'Note');
  if (notesErr) errors.push(notesErr);
  return errors;
}
