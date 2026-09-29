// Weekly schedule derived from the plan (Mon A, Tue B, Wed/Thu beach, Fri C, weekend rest).
import type { DayId, PlanWeek } from '../../domain/types';
import { addDays, parseISO } from './format';

export type DayKind = { kind: 'session'; day: DayId } | { kind: 'beach' } | { kind: 'rest'; maybeBeach: boolean };

export function kindForDate(iso: string): DayKind {
  switch (parseISO(iso).getDay()) {
    case 1:
      return { kind: 'session', day: 'A' };
    case 2:
      return { kind: 'session', day: 'B' };
    case 3:
    case 4:
      return { kind: 'beach' };
    case 5:
      return { kind: 'session', day: 'C' };
    case 6:
      return { kind: 'rest', maybeBeach: true };
    default:
      return { kind: 'rest', maybeBeach: false };
  }
}

export function weekDays(week: PlanWeek): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(week.startDate, i));
}

export const DAY_ORDER: DayId[] = ['A', 'B', 'C'];

export const DAY_WEEKDAY: Record<DayId, string> = { A: 'lunedì', B: 'martedì', C: 'venerdì' };
