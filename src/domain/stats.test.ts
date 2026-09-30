import { describe, expect, it } from 'vitest';
import { seedSessions } from './seed';
import { exerciseHistory, lastLoad, pendingDay, personalBest, sessionFromPlan, suggestedRef, weekCompletion } from './stats';
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
    expect(personalBest(sessions, 'back-squat')).toEqual({ kg: 80, date: '2026-10-05', reps: null, bodyweight: false });
    expect(personalBest(sessions, 'nope')).toBeNull();
  });
  it('finds the last load, optionally before a date', () => {
    expect(lastLoad(sessions, 'back-squat')).toMatchObject({ kg: 80, date: '2026-10-12' });
    expect(lastLoad(sessions, 'back-squat', '2026-10-12')).toMatchObject({ kg: 80, date: '2026-10-05' });
    expect(lastLoad(sessions, 'back-squat', '2026-09-28')).toBeNull();
  });
  it('works on the seed (F6: "ultima volta 70 kg · 28/09")', () => {
    expect(lastLoad(seedSessions, 'back-squat')).toEqual({ kg: 70, date: '2026-09-28', reps: null, bodyweight: false });
    expect(lastLoad(seedSessions, 'deadlift')).toMatchObject({ kg: 70, date: '2026-09-25' });
  });
});

describe('weekCompletion', () => {
  it('maps each day to the latest session dated inside the plan week', () => {
    const extra = s('e', '2026-10-02', {}, 1, 'C');
    const res = weekCompletion([...sessions, extra, s('f', '2026-09-30', {}, null, null)], 1);
    expect(res.A?.id).toBe('a');
    expect(res.B).toBeNull();
    expect(res.C?.id).toBe('e');
  });
  it('ignores sessions dated outside the week even if labelled with it (seed 25/09 w1-C)', () => {
    // Today 2026-09-29 or 2026-10-02: only A (28/09) is done, 1 of 3.
    const res = weekCompletion(seedSessions, 1);
    expect(res).toMatchObject({ A: { id: '2026-09-28-w1-A' }, B: null, C: null });
    expect(Object.values(res).filter(Boolean)).toHaveLength(1);
  });
  it('counts by date, not by label, and returns empty for unknown weeks', () => {
    const mislabelled = s('m', '2026-10-06', {}, 1, 'B');
    expect(weekCompletion([mislabelled], 2).B?.id).toBe('m');
    expect(weekCompletion([mislabelled], 1).B).toBeNull();
    expect(weekCompletion(seedSessions, 9)).toEqual({ A: null, B: null, C: null });
  });
});

describe('bodyweight (weightKg 0)', () => {
  const bw = (id: string, date: string, reps: (number | null)[]): WorkoutSession => ({
    ...s(id, date, {}),
    exercises: [{ exerciseId: 'pull-up', name: 'Pull-up', notes: '', sets: reps.map((r) => ({ weightKg: 0, reps: r, rpe: null })) }],
  });
  const hist = [bw('p1', '2026-09-29', [6, 8]), bw('p2', '2026-10-06', [7]), bw('p3', '2026-10-13', [8])];
  it('reports kg 0 with the reps and the bodyweight flag', () => {
    expect(lastLoad(hist, 'pull-up')).toEqual({ kg: 0, date: '2026-10-13', reps: 8, bodyweight: true });
    expect(personalBest(hist, 'pull-up')).toEqual({ kg: 0, date: '2026-09-29', reps: 8, bodyweight: true });
    expect(exerciseHistory(hist, 'pull-up')[0]).toMatchObject({ topKg: 0, topReps: 8 });
  });
  it('prefers load over reps once weight is added', () => {
    const weighted: WorkoutSession = {
      ...s('p4', '2026-10-20', {}),
      exercises: [{ exerciseId: 'pull-up', name: 'Pull-up', notes: '', sets: [{ weightKg: 5, reps: 3, rpe: null }] }],
    };
    expect(personalBest([...hist, weighted], 'pull-up')).toEqual({ kg: 5, date: '2026-10-20', reps: 3, bodyweight: false });
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

describe('pendingDay / suggestedRef (weekend and off-day logging)', () => {
  const w1 = [...seedSessions]; // 25/09 C (before the week) + 28/09 A
  it('pendingDay skips days already logged in the week date range', () => {
    expect(pendingDay(w1, 1)).toBe('B');
    expect(pendingDay([...w1, s('b1', '2026-09-29', {}, 1, 'B')], 1)).toBe('C');
    expect(pendingDay([...w1, s('b1', '2026-09-29', {}, 1, 'B'), s('c1', '2026-10-02', {}, 1, 'C')], 1)).toBeNull();
    expect(pendingDay(w1, 9)).toBeNull();
  });
  it('scheduled days keep their session', () => {
    expect(suggestedRef(w1, '2026-10-02')).toEqual({ week: 1, day: 'C' });
    expect(suggestedRef(w1, '2026-09-28')).toEqual({ week: 1, day: 'A' });
  });
  it('Saturday and Sunday suggest the first missing session of the week', () => {
    const withB = [...w1, s('b1', '2026-09-29', {}, 1, 'B')];
    expect(suggestedRef(withB, '2026-10-03')).toEqual({ week: 1, day: 'C' });
    expect(suggestedRef(withB, '2026-10-04')).toEqual({ week: 1, day: 'C' });
    expect(suggestedRef(w1, '2026-10-03')).toEqual({ week: 1, day: 'B' });
  });
  it('off day with the whole week done, or outside the cycle, is off-plan', () => {
    const all = [...w1, s('b1', '2026-09-29', {}, 1, 'B'), s('c1', '2026-10-02', {}, 1, 'C')];
    expect(suggestedRef(all, '2026-10-03')).toEqual({ week: null, day: null });
    expect(suggestedRef(w1, '2026-09-26')).toEqual({ week: null, day: null });
    expect(suggestedRef(w1, '2026-11-28')).toEqual({ week: null, day: null });
  });
});
