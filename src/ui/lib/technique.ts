import { plan } from '../../domain/plan';
import { canonicalExerciseId } from '../../domain/exercises';
import type { TechniqueEntry } from '../../domain/types';

let index: Map<string, TechniqueEntry> | null = null;

export function techniqueFor(exerciseId: string): TechniqueEntry | undefined {
  if (!index) {
    index = new Map();
    for (const t of plan.techniques) {
      const id = canonicalExerciseId(t.name);
      // First entry wins ("Step-up box" in Conditioning just says "Vedi sopra").
      if (!index.has(id)) index.set(id, t);
    }
  }
  return index.get(exerciseId);
}

/** Phase of the anchor progression for a week ("1-2" covers 1 and 2). */
export function phaseForWeek(week: number) {
  return plan.progression.find((r) => {
    const [a, b] = r.weeks.split('-').map(Number);
    return b ? week >= a && week <= b : week === a;
  });
}
