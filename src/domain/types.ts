// Shared contract between domain (plan parser, data layer, rules) and UI.
// Changing a type here is a cross-team change: update SPEC.md and both sides.

export type DayId = 'A' | 'B' | 'C';

/** One row of a plan table (e.g. "Anchor | Back Squat | 1x5 @RPE 7 + 3x5 @-10% | 2-3' | ..."). */
export interface PlanExercise {
  /** Canonical exercise id shared with logged sessions, e.g. "back-squat". */
  exerciseId: string;
  /** Name as written in the plan, without markdown, e.g. "Back Squat TEST 3RM". */
  name: string;
  /** Block label, e.g. "Anchor", "Potenza", "Conditioning". */
  block: string;
  isAnchor: boolean;
  /** Prescription as written, e.g. "1x5 @RPE 7 + 3x5 @-10%" ("" when the plan says "—"). */
  prescription: string;
  rest: string;
  notes: string;
}

export interface PlanSession {
  day: DayId;
  /** e.g. "Lower Power". */
  title: string;
  exercises: PlanExercise[];
}

export interface PlanWeek {
  number: number; // 1..8
  /** e.g. "Fondamenta". */
  theme: string;
  /** ISO dates, inclusive. */
  startDate: string;
  endDate: string;
  objective: string;
  novelty: string;
  sessions: PlanSession[]; // always A, B, C in this order
  /** Free text that follows the sessions (e.g. week 4 note, week 8 end-of-cycle check). */
  extra: string[];
}

export interface TechniqueEntry {
  category: string; // "Potenza", "Lower", ...
  name: string;
  cue: string;
}

export interface ProgressionRow {
  weeks: string;
  phase: string;
  topSet: string;
  backOff: string;
}

export interface Plan {
  title: string;
  startDate: string;
  endDate: string;
  anchors: string[]; // canonical exercise ids of the 5 anchors
  weekTemplate: { day: string; activity: string }[];
  progression: ProgressionRow[];
  progressionRules: string[];
  rules: { title: string; text: string }[]; // C-Lite, Beach > Pesi, ...
  warmup: string[];
  weeks: PlanWeek[];
  techniques: TechniqueEntry[];
}

/** A logged set. Only weightKg is mandatory: Luigi often logs just the load. */
export interface LoggedSet {
  weightKg: number;
  reps: number | null;
  rpe: number | null;
}

export interface LoggedExercise {
  exerciseId: string;
  name: string;
  sets: LoggedSet[];
  notes: string;
}

/** Firestore document in collection `sessions`. */
export interface WorkoutSession {
  id: string;
  /** ISO date YYYY-MM-DD (local day of the workout). */
  date: string;
  /** Plan reference; null for off-plan workouts. */
  week: number | null;
  day: DayId | null;
  exercises: LoggedExercise[];
  conditioning: string;
  notes: string;
  schemaVersion: 1;
}

export type WorkoutSessionInput = Omit<WorkoutSession, 'id' | 'schemaVersion'>;
