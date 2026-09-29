import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, formatShortDate, isValidIsoDate, todayIso, weekdayOf } from './dates';

describe('dates', () => {
  it('validates ISO calendar dates', () => {
    expect(isValidIsoDate('2026-09-28')).toBe(true);
    expect(isValidIsoDate('2028-02-29')).toBe(true);
    expect(isValidIsoDate('2026-02-29')).toBe(false);
    expect(isValidIsoDate('2026-13-01')).toBe(false);
    expect(isValidIsoDate('2026-9-28')).toBe(false);
    expect(isValidIsoDate(20260928)).toBe(false);
  });
  it('computes weekdays without timezone drift', () => {
    expect(weekdayOf('2026-09-28')).toBe(1);
    expect(weekdayOf('2026-10-04')).toBe(0);
    expect(() => weekdayOf('nope')).toThrow();
  });
  it('does day arithmetic across DST changes', () => {
    expect(daysBetween('2026-09-28', '2026-11-22')).toBe(55);
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
  it('uses local components for today', () => {
    expect(todayIso(new Date(2026, 8, 28, 23, 59))).toBe('2026-09-28');
    expect(todayIso(new Date(2026, 0, 5, 0, 1))).toBe('2026-01-05');
  });
  it('formats short dates', () => {
    expect(formatShortDate('2026-09-28')).toBe('28/09');
  });
});
