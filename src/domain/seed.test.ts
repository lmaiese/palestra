import { describe, expect, it } from 'vitest';
import { canonicalExerciseId } from './exercises';
import { seedSessions } from './seed';
import { sessionIdFor } from './sessionId';
import { validateSession } from './validation';

describe('seedSessions', () => {
  it('matches the SPEC table', () => {
    expect(seedSessions.map((s) => s.id)).toEqual(['2026-09-25-w1-C', '2026-09-28-w1-A']);
    const [c, a] = seedSessions;
    expect(c.exercises.map((e) => [e.exerciseId, e.sets.map((x) => x.weightKg)])).toEqual([
      ['hang-power-clean', [50]],
      ['deadlift', [70]],
      ['bulgarian-split-squat', [30, 30]],
    ]);
    expect(c.conditioning).toBe('3 × (250 m row + swing 20 kg)');
    expect(c.notes).toBe('Ridotto perché giocavo a beach');
    expect(a.exercises[0].sets).toEqual([{ weightKg: 70, reps: null, rpe: 7 }]);
    expect(a.exercises.map((e) => e.exerciseId)).toEqual(['back-squat', 'hip-thrust', 'pallof-press']);
  });
  it('is valid, canonical and consistent with sessionIdFor', () => {
    for (const { id, schemaVersion, ...input } of seedSessions) {
      expect(schemaVersion).toBe(1);
      expect(validateSession(input)).toEqual([]);
      expect(id).toBe(sessionIdFor(input.date, input.week, input.day));
      for (const e of input.exercises) expect(canonicalExerciseId(e.name)).toBe(e.exerciseId);
    }
  });
});
