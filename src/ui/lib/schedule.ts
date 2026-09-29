// Weekly schedule derived from the plan. Session days come from the domain
// (defaultDayForDate: Mon A, Tue B, Fri C); the rest is beach (Wed/Thu) or rest.
import { defaultDayForDate } from '../../domain/plan';
import { addDays, weekdayOf } from '../../domain/dates';
import type { DayId, PlanWeek } from '../../domain/types';

export type DayKind = { kind: 'session'; day: DayId } | { kind: 'beach' } | { kind: 'rest'; maybeBeach: boolean };

export function kindForDate(iso: string): DayKind {
  const day = defaultDayForDate(iso);
  if (day) return { kind: 'session', day };
  const wd = weekdayOf(iso);
  if (wd === 3 || wd === 4) return { kind: 'beach' };
  return { kind: 'rest', maybeBeach: wd === 6 };
}

export function weekDays(week: PlanWeek): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(week.startDate, i));
}

export const DAY_ORDER: DayId[] = ['A', 'B', 'C'];

export const DAY_WEEKDAY: Record<DayId, string> = { A: 'lunedì', B: 'martedì', C: 'venerdì' };
