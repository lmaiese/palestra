// Each anchor lift is identified by a bumper-plate colour.

const PLATE_BY_KEY: [RegExp, string][] = [
  [/squat/, 'squat'],
  [/bench/, 'bench'],
  [/dead/, 'deadlift'],
  [/overhead|ohp|military/, 'ohp'],
  [/pull/, 'pullup'],
];

export function plateFor(exerciseId: string): string | null {
  for (const [re, key] of PLATE_BY_KEY) if (re.test(exerciseId)) return key;
  return null;
}

export function plateVar(exerciseId: string): string {
  const p = plateFor(exerciseId);
  return p ? `var(--plate-${p})` : 'var(--steel)';
}
