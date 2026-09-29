import { describe, expect, it } from 'vitest';
import { canonicalExerciseId, exerciseDisplayName, slugify } from './exercises';

describe('canonicalExerciseId', () => {
  it.each([
    ['Back Squat', 'back-squat'],
    ['Back Squat TEST 3RM', 'back-squat'],
    ['Squat', 'back-squat'],
    ['  back   SQUAT ', 'back-squat'],
    ['**Deadlift**', 'deadlift'],
    ['Deadlift TEST 3RM', 'deadlift'],
    ['DL', 'deadlift'],
    ['dl', 'deadlift'],
    ['Stacco', 'deadlift'],
    ['HPC', 'hang-power-clean'],
    ['Hang Power Clean', 'hang-power-clean'],
    ['Hip trust', 'hip-thrust'],
    ['Hip Thrust bilanciere', 'hip-thrust'],
    ['Pallor press', 'pallof-press'],
    ['Pallof Press', 'pallof-press'],
    ['Bulgarian', 'bulgarian-split-squat'],
    ['Bulgarian Split Squat bilanciere', 'bulgarian-split-squat'],
    ['Bulgarian Split Squat', 'bulgarian-split-squat'],
    ['Pull-up TEST max strict', 'pull-up'],
    ['Pull up', 'pull-up'],
    ['Trazioni', 'pull-up'],
    ['Bench Press TEST 3RM', 'bench-press'],
    ['Panca piana', 'bench-press'],
    ['Overhead Press', 'overhead-press'],
    ['OHP', 'overhead-press'],
    ['RDL', 'romanian-deadlift'],
    ['Romanian Deadlift', 'romanian-deadlift'],
    ['RDL con fermo sotto ginocchia', 'paused-romanian-deadlift'],
    ['Snatch-grip RDL', 'snatch-grip-rdl'],
    ['Front Squat', 'front-squat'],
    ['Tempo Squat 3-1-1', 'tempo-squat'],
    ['Tempo Squat 4-2-1', 'tempo-squat'],
    ['Tempo Squat', 'tempo-squat'],
    ['Pause Squat (2" in buca)', 'pause-squat'],
    ['Box Squat', 'box-squat'],
    ['Deficit Deadlift (5cm)', 'deficit-deadlift'],
    ['Stacco con deficit', 'deficit-deadlift'],
    ['Pause Bench 1"', 'pause-bench'],
    ['Pause Bench 2"', 'pause-bench'],
    ['Floor Press bilanciere', 'floor-press'],
    ['Close-grip Bench', 'close-grip-bench'],
    ['Step-up box 60cm', 'step-up'],
    ['Step-up', 'step-up'],
    ['Affondo camminata bilanciere', 'walking-lunge'],
    ['Affondo camminata manubri', 'walking-lunge'],
    ['Goblet Squat DB', 'goblet-squat'],
    ['Box Jump (step down)', 'box-jump'],
    ['CMJ', 'cmj'],
    ['Row (cal o metri)', 'row'],
    ['Face Pull', 'face-pull'],
    ['Hang Power Clean + High Pull', 'hang-power-clean-high-pull'],
  ])('%s -> %s', (raw, id) => {
    expect(canonicalExerciseId(raw)).toBe(id);
  });

  it('is accent insensitive and slugs unknown names', () => {
    expect(canonicalExerciseId('Mobilità Spalla + torace')).toBe('mobilita-spalla-torace');
    expect(canonicalExerciseId('Curl  Martello')).toBe('curl-martello');
  });

  it('keeps variants distinct from the anchors', () => {
    const ids = ['Front Squat', 'Tempo Squat', 'Pause Squat', 'Box Squat', 'Deficit Deadlift', 'Pause Bench', 'Floor Press', 'Close-grip Bench'].map(canonicalExerciseId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const anchor of ['back-squat', 'deadlift', 'bench-press']) expect(ids).not.toContain(anchor);
  });

  it('returns a fallback id for empty input', () => {
    expect(canonicalExerciseId('   ')).toBe('esercizio');
  });
});

describe('slugify', () => {
  it('lowercases, strips accents and punctuation', () => {
    expect(slugify('  Àffondo  (5cm) + DB! ')).toBe('affondo-5cm-db');
  });
});

describe('exerciseDisplayName', () => {
  it('returns the known display name', () => {
    expect(exerciseDisplayName('back-squat')).toBe('Back Squat');
    expect(exerciseDisplayName('pallof-press')).toBe('Pallof Press');
    expect(exerciseDisplayName('pull-up')).toBe('Pull-up');
  });
  it('title-cases unknown slugs', () => {
    expect(exerciseDisplayName('curl-martello')).toBe('Curl Martello');
  });
});

describe('canonicalExerciseId on conditioning text', () => {
  it('does not treat a ladder as a tempo prescription', () => {
    expect(canonicalExerciseId('Ladder 2-4-6-8-10: DB swing')).toBe('ladder-2-4-6-8-10-db-swing');
  });
});
