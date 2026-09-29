import { describe, expect, it } from 'vitest';
import type { LoggedExercise, WorkoutSessionInput } from './types';
import { LIMITS, validateSession } from './validation';

function ex(over: Partial<LoggedExercise> = {}): LoggedExercise {
  return { exerciseId: 'back-squat', name: 'Back Squat', sets: [{ weightKg: 70, reps: 5, rpe: 7 }], notes: '', ...over };
}

function session(over: Partial<WorkoutSessionInput> = {}): WorkoutSessionInput {
  return { date: '2026-09-28', week: 1, day: 'A', exercises: [ex()], conditioning: '', notes: '', ...over };
}

const bad = (over: Partial<WorkoutSessionInput>) => validateSession(session(over));
const badSet = (set: Record<string, unknown>) =>
  validateSession(session({ exercises: [ex({ sets: [set as never] })] }));

describe('validateSession (F9)', () => {
  it('accepts a valid session, an off-plan one and bare loads', () => {
    expect(validateSession(session())).toEqual([]);
    expect(bad({ week: null, day: null, exercises: [] })).toEqual([]);
    expect(badSet({ weightKg: 0, reps: null, rpe: null })).toEqual([]);
    expect(badSet({ weightKg: 500, reps: 100, rpe: 10 })).toEqual([]);
    expect(badSet({ weightKg: 72.5, reps: 0, rpe: 7.5 })).toEqual([]);
  });

  it('rejects bad dates', () => {
    expect(bad({ date: '28/09/2026' })).toEqual(['Data non valida: usa il formato AAAA-MM-GG']);
    expect(bad({ date: '2026-02-30' })).toHaveLength(1);
  });

  it('rejects week and day out of range', () => {
    expect(bad({ week: 9 })[0]).toMatch(/settimana/i);
    expect(bad({ week: 0 })).toHaveLength(1);
    expect(bad({ week: 1.5 })).toHaveLength(1);
    expect(bad({ day: 'D' as never })[0]).toMatch(/giorno/i);
  });

  it('rejects out-of-range kg, reps and rpe', () => {
    expect(badSet({ weightKg: -1, reps: null, rpe: null })[0]).toMatch(/kg/);
    expect(badSet({ weightKg: 500.5, reps: null, rpe: null })).toHaveLength(1);
    expect(badSet({ weightKg: Number.NaN, reps: null, rpe: null })).toHaveLength(1);
    expect(badSet({ weightKg: '70', reps: null, rpe: null })).toHaveLength(1);
    expect(badSet({ weightKg: 70, reps: 101, rpe: null })[0]).toMatch(/ripetizioni/);
    expect(badSet({ weightKg: 70, reps: 2.5, rpe: null })).toHaveLength(1);
    expect(badSet({ weightKg: 70, reps: null, rpe: 0 })[0]).toMatch(/RPE/);
    expect(badSet({ weightKg: 70, reps: null, rpe: 11 })).toHaveLength(1);
  });

  it('labels errors with the exercise name and set number', () => {
    expect(badSet({ weightKg: 900, reps: null, rpe: null })[0]).toBe(
      'Esercizio 1 (Back Squat), set 1: i kg devono essere un numero tra 0 e 500',
    );
  });

  it('enforces list sizes', () => {
    expect(bad({ exercises: Array.from({ length: 31 }, () => ex()) })).toContain('Massimo 30 esercizi');
    expect(bad({ exercises: Array.from({ length: 30 }, () => ex()) })).toEqual([]);
    const sets = Array.from({ length: LIMITS.maxSets + 1 }, () => ({ weightKg: 1, reps: null, rpe: null }));
    expect(bad({ exercises: [ex({ sets })] })[0]).toMatch(/massimo 20 set/);
  });

  it('enforces text lengths and required names', () => {
    const long = 'x'.repeat(2001);
    expect(bad({ notes: long })[0]).toMatch(/Note: massimo 2000/);
    expect(bad({ conditioning: long })[0]).toMatch(/Conditioning/);
    expect(bad({ notes: 'x'.repeat(2000) })).toEqual([]);
    expect(bad({ exercises: [ex({ name: '  ' })] })[0]).toMatch(/nome: obbligatorio/);
    expect(bad({ exercises: [ex({ notes: long })] })[0]).toMatch(/note: massimo/);
    expect(bad({ exercises: [ex({ exerciseId: '' })] })[0]).toMatch(/identificativo/);
    expect(bad({ notes: 3 as never })[0]).toMatch(/testo/);
  });

  it('rejects unknown keys and malformed structures', () => {
    expect(validateSession({ ...session(), extra: 1 } as never)).toEqual(['Allenamento: campo non ammesso "extra"']);
    expect(bad({ exercises: [{ ...ex(), foo: 1 } as never] })[0]).toMatch(/campo non ammesso "foo"/);
    expect(badSet({ weightKg: 1, reps: null, rpe: null, x: 1 })[0]).toMatch(/"x"/);
    expect(bad({ exercises: 'no' as never })).toEqual(['Elenco esercizi non valido']);
    expect(bad({ exercises: [null as never] })).toEqual(['Esercizio 1: non valido']);
    expect(bad({ exercises: [ex({ sets: 'x' as never })] })[0]).toMatch(/set non valido|elenco dei set/);
    expect(bad({ exercises: [ex({ sets: [null as never] })] })[0]).toMatch(/set non valido/);
    expect(validateSession(null as never)).toEqual(['Allenamento non valido']);
  });
});
