// Read-only access to the bundled plan. Must not import Firebase (cost DoD C3).
import planJson from '../data/plan.json';
import { weekdayOf } from './dates';
import type { DayId, Plan, PlanSession, PlanWeek } from './types';

export const plan: Plan = planJson as Plan;

export function getWeek(n: number): PlanWeek | undefined {
  return plan.weeks.find((w) => w.number === n);
}

export function getSession(week: number, day: DayId): PlanSession | undefined {
  return getWeek(week)?.sessions.find((s) => s.day === day);
}

/** Cycle week (1..8) containing `isoDate`, null outside the cycle. */
export function weekForDate(isoDate: string): number | null {
  const w = plan.weeks.find((x) => x.startDate <= isoDate && isoDate <= x.endDate);
  return w ? w.number : null;
}

const DAY_BY_WEEKDAY: Record<number, DayId> = { 1: 'A', 2: 'B', 5: 'C' };

/** Planned session for a weekday: Monday A, Tuesday B, Friday C, otherwise null. */
export function defaultDayForDate(isoDate: string): DayId | null {
  return DAY_BY_WEEKDAY[weekdayOf(isoDate)] ?? null;
}

/** Whether `exerciseId` is one of the 5 anchors. */
export function isAnchor(exerciseId: string): boolean {
  return plan.anchors.includes(exerciseId);
}
