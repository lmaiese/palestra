// Exercise name canonicalization: the same movement gets the same id in the
// plan and in logged sessions, whatever abbreviation or typo was used.

/** Canonical id -> human display name. */
const DISPLAY_NAMES: Record<string, string> = {
  'back-squat': 'Back Squat',
  'bench-press': 'Bench Press',
  deadlift: 'Deadlift',
  'overhead-press': 'Overhead Press',
  'pull-up': 'Pull-up',
  'hang-power-clean': 'Hang Power Clean',
  'hip-thrust': 'Hip Thrust',
  'pallof-press': 'Pallof Press',
  'bulgarian-split-squat': 'Bulgarian Split Squat',
  'romanian-deadlift': 'Romanian Deadlift',
  'paused-romanian-deadlift': 'RDL con fermo',
  'snatch-grip-rdl': 'Snatch-grip RDL',
  'front-squat': 'Front Squat',
  'tempo-squat': 'Tempo Squat',
  'pause-squat': 'Pause Squat',
  'box-squat': 'Box Squat',
  'deficit-deadlift': 'Deficit Deadlift',
  'pause-bench': 'Pause Bench',
  'floor-press': 'Floor Press',
  'close-grip-bench': 'Close-grip Bench',
  'step-up': 'Step-up',
  'walking-lunge': 'Affondo camminata',
  'goblet-squat': 'Goblet Squat',
  'box-jump': 'Box Jump',
  cmj: 'CMJ',
  'approach-jump': 'Approach Jump',
  'clean-pull': 'Clean Pull',
  'high-pull': 'High Pull',
  'push-press': 'Push Press',
  'pendlay-row': 'Pendlay Row',
  'bent-over-row': 'Bent Over Row',
  'inverted-row': 'Inverted Row',
  'face-pull': 'Face Pull',
  'dead-bug': 'Dead Bug',
  'side-plank': 'Side Plank',
  'hanging-knee-raise': 'Hanging Knee Raise',
  'barbell-roll-out': 'Barbell Roll-out',
  'db-swing': 'DB Swing',
  row: 'Row',
};

/** Normalized key (see normalize) -> canonical id. */
const ALIASES: Record<string, string> = {
  squat: 'back-squat',
  'back squat': 'back-squat',
  'bench': 'bench-press',
  'bench press': 'bench-press',
  panca: 'bench-press',
  'panca piana': 'bench-press',
  dl: 'deadlift',
  stacco: 'deadlift',
  'stacco da terra': 'deadlift',
  deadlift: 'deadlift',
  ohp: 'overhead-press',
  'overhead press': 'overhead-press',
  'military press': 'overhead-press',
  'pull-up': 'pull-up',
  'pull up': 'pull-up',
  pullup: 'pull-up',
  trazioni: 'pull-up',
  hpc: 'hang-power-clean',
  'hang power clean': 'hang-power-clean',
  'hip trust': 'hip-thrust',
  'hip thrust': 'hip-thrust',
  'pallor press': 'pallof-press',
  'pallof press': 'pallof-press',
  pallof: 'pallof-press',
  bulgarian: 'bulgarian-split-squat',
  'bulgarian split squat': 'bulgarian-split-squat',
  bss: 'bulgarian-split-squat',
  rdl: 'romanian-deadlift',
  'romanian deadlift': 'romanian-deadlift',
  'stacco rumeno': 'romanian-deadlift',
  'rdl con fermo sotto ginocchia': 'paused-romanian-deadlift',
  'rdl con fermo': 'paused-romanian-deadlift',
  'deficit deadlift': 'deficit-deadlift',
  'deficit dl': 'deficit-deadlift',
  'stacco con deficit': 'deficit-deadlift',
  'close-grip bench': 'close-grip-bench',
  'close grip bench': 'close-grip-bench',
  'step-up box': 'step-up',
  'step-up': 'step-up',
  'step up': 'step-up',
  'affondo camminata': 'walking-lunge',
  'goblet squat db': 'goblet-squat',
  'goblet squat': 'goblet-squat',
};

/** Words that qualify the implement or setup but not the movement. */
const IMPLEMENT_SUFFIX = /\s+(bilanciere|manubri|\d+\s*cm)$/;

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Lowercase ASCII slug with dashes, e.g. "Àffondo (5cm)" -> "affondo-5cm". */
export function slugify(s: string): string {
  return stripAccents(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalize(raw: string): string {
  let s = stripAccents(raw.replace(/\*/g, ''))
    .toLowerCase()
    .replace(/[“”″]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
  s = s.replace(/\(.*?\)/g, ' '); // parenthetical details: "(5cm)", "(step down)"
  s = s.replace(/\btest\b.*$/, ' '); // "TEST 3RM", "TEST max strict"
  s = s.replace(/(?<![\d-])\d+-\d+-\d+(?![\d-])/g, ' '); // tempo "3-1-1"
  s = s.replace(/\b\d+"/g, ' '); // pause length "2\""
  s = s.replace(/\s+/g, ' ').trim();
  let prev = '';
  while (prev !== s) {
    prev = s;
    s = s.replace(IMPLEMENT_SUFFIX, '').trim();
  }
  return s;
}

/** Canonical id for an exercise name as written in the plan or typed by the user. */
export function canonicalExerciseId(rawName: string): string {
  const key = normalize(rawName);
  const id = ALIASES[key] ?? slugify(key);
  return id || 'esercizio';
}

/** Human name for a canonical id; unknown ids are title-cased from the slug. */
export function exerciseDisplayName(exerciseId: string): string {
  const known = DISPLAY_NAMES[exerciseId];
  if (known) return known;
  return exerciseId
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
