import { describe, expect, it } from 'vitest';
import { defaultDayForDate, getSession, getWeek, isAnchor, plan, weekForDate } from './plan';

describe('plan', () => {
  it('exposes the bundled plan', () => {
    expect(plan.weeks).toHaveLength(8);
    expect(getWeek(1)?.theme).toBe('Fondamenta');
    expect(getWeek(9)).toBeUndefined();
    expect(getSession(1, 'C')?.title).toBe('Hinge + Power');
    expect(getSession(9, 'A')).toBeUndefined();
  });
  it('maps dates to cycle weeks', () => {
    expect(weekForDate('2026-09-27')).toBeNull();
    expect(weekForDate('2026-09-28')).toBe(1);
    expect(weekForDate('2026-10-04')).toBe(1);
    expect(weekForDate('2026-10-05')).toBe(2);
    expect(weekForDate('2026-11-22')).toBe(8);
    expect(weekForDate('2026-11-23')).toBeNull();
  });
  it('maps weekdays to default sessions', () => {
    expect(defaultDayForDate('2026-09-28')).toBe('A');
    expect(defaultDayForDate('2026-09-29')).toBe('B');
    expect(defaultDayForDate('2026-09-30')).toBeNull();
    expect(defaultDayForDate('2026-09-25')).toBe('C');
    expect(defaultDayForDate('2026-10-04')).toBeNull();
  });
  it('knows the anchors', () => {
    expect(isAnchor('deadlift')).toBe(true);
    expect(isAnchor('front-squat')).toBe(false);
  });
});
