import { describe, expect, it } from 'vitest';
import { seedSessions } from './seed';
import { exerciseHistory, lastLoad, personalBest, sessionFromPlan, weekCompletion } from './stats';
import type { WorkoutSession } from './types';

function s(id: string, date: string, loads: Record<string, number[]>, week: number | null = 1, day: WorkoutSession['day'] = null): WorkoutSession {
  return {
    id,
    date,
    week,
    day,
    exercises: Object.entries(loads).map(([exerciseId, kgs]) => ({
      exerciseId,
      name: exerciseId,
      sets: kgs.map((weightKg) => ({ weightKg, reps: null, rpe: null })),
      notes: '',
    })),
    conditioning: '',
    notes: '',
    schemaVersion: 1,
  };
}

const sessions = [
  s('c', '2026-10-05', { 'back-squat': [80, 75] }, 2, 'A'),
  s('a', '2026-09-28', { 'back-squat': [70] }, 1, 'A'),
  s('b', '2026-10-01', { 'back-squat': [], deadlift: [100] }, 1, 'C'),
  s('d', '2026-10-12', { 'back-squat': [80] }, 3, 'A'),
];

describe('exerciseHistory', () => {
  it('is chronological with top loads and skips empty entries', () => {
    expect(exerciseHistory(sessions, 'back-squat').map((p) => [p.date, p.sessionId, p.topKg])).toEqual([
      ['2026-09-28', 'a', 70],
      ['2026-10-05', 'c', 80],
      ['2026-10-12', 'd', 80],
    ]);
    expect(exerciseHistory(sessions, 'nope')).toEqual([]);
  });
  it('merges the same exercise listed twice in a session and orders same-day by id', () => {
    const twice = s('x', '2026-10-01', {});
    twice.exercises = [
      { exerciseId: 'deadlift', name: 'DL', sets: [{ weightKg: 90, reps: 3, rpe: null }], notes: '' },
      { exerciseId: 'deadlift', name: 'DL', sets: [{ weightKg: 110, reps: 1, rpe: null }], notes: '' },
    ];
    const hist = exerciseHistory([...sessions, twice], 'deadlift');
    expect(hist.map((p) => p.sessionId)).toEqual(['b', 'x']);
    expect(hist[1]).toMatchObject({ topKg: 110 });
    expect(hist[1].sets).toHaveLength(2);
    expect(exerciseHistory([twice, s('w', '2026-10-01', { deadlift: [1] })], 'deadlift').map((p) => p.sessionId)).toEqual(['w', 'x']);
  });
});

describe('personalBest / lastLoad', () => {
  it('finds the earliest heaviest load', () => {
    expect(personalBest(sessions, 'back-squat')).toEqual({ kg: 80, date: '2026-10-05' });
    expect(personalBest(sessions, 'nope')).toBeNull();
  });
  it('finds the last load, optionally before a date', () => {
    expect(lastLoad(sessions, 'back-squat')).toEqual({ kg: 80, date: '2026-10-12' });
    expect(lastLoad(sessions, 'back-squat', '2026-10-12')).toEqual({ kg: 80, date: '2026-10-05' });
    expect(lastLoad(sessions, 'back-squat', '2026-09-28')).toBeNull();
  });
  it('works on the seed (F6: "ultima volta 70 kg · 28/09")', () => {
    expect(lastLoad(seedSessions, 'back-squat')).toEqual({ kg: 70, date: '2026-09-28' });
    expect(lastLoad(seedSessions, 'deadlift')).toEqual({ kg: 70, date: '2026-09-25' });
  });
});

describe('weekCompletion', () => {
  it('maps each day to the latest session of that week', () => {
    const extra = s('e', '2026-10-02', {}, 1, 'C');
    const res = weekCompletion([...sessions, extra, s('f', '2026-09-30', {}, null, null)], 1);
    expect(res.A?.id).toBe('a');
    expect(res.B).toBeNull();
    expect(res.C?.id).toBe('e');
    expect(weekCompletion(seedSessions, 1)).toMatchObject({ A: { id: '2026-09-28-w1-A' }, B: null, C: { id: '2026-09-25-w1-C' } });
  });
});

describe('sessionFromPlan', () => {
  it('prefills planned exercises without sets, skipping conditioning', () => {
    const input = sessionFromPlan(1, 'A', '2026-09-28');
    expect(input).toMatchObject({ date: '2026-09-28', week: 1, day: 'A', conditioning: '', notes: '' });
    expect(input.exercises.map((e) => e.exerciseId)).toEqual(['cmj', 'back-squat', 'tempo-squat', 'hip-thrust', 'pallof-press']);
    expect(input.exercises.every((e) => e.sets.length === 0 && e.notes === '')).toBe(true);
  });
  it('returns an empty list for a session outside the plan', () => {
    expect(sessionFromPlan(9, 'A', '2026-12-01').exercises).toEqual([]);
  });
});
