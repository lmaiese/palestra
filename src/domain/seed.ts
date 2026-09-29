// The two workouts logged before the app existed (see SPEC "Dati iniziali").
import type { LoggedSet, WorkoutSession } from './types';

const kg = (weightKg: number, rpe: number | null = null): LoggedSet => ({ weightKg, reps: null, rpe });

export const seedSessions: WorkoutSession[] = [
  {
    id: '2026-09-25-w1-C',
    date: '2026-09-25',
    week: 1,
    day: 'C',
    exercises: [
      { exerciseId: 'hang-power-clean', name: 'Hang Power Clean', sets: [kg(50)], notes: '' },
      { exerciseId: 'deadlift', name: 'Deadlift', sets: [kg(70)], notes: '' },
      { exerciseId: 'bulgarian-split-squat', name: 'Bulgarian Split Squat', sets: [kg(30), kg(30)], notes: '' },
    ],
    conditioning: '3 × (250 m row + swing 20 kg)',
    notes: 'Ridotto perché giocavo a beach',
    schemaVersion: 1,
  },
  {
    id: '2026-09-28-w1-A',
    date: '2026-09-28',
    week: 1,
    day: 'A',
    exercises: [
      { exerciseId: 'back-squat', name: 'Back Squat', sets: [kg(70, 7)], notes: '' },
      { exerciseId: 'hip-thrust', name: 'Hip Thrust', sets: [kg(70)], notes: '' },
      { exerciseId: 'pallof-press', name: 'Pallof Press', sets: [kg(20)], notes: '' },
    ],
    conditioning: '',
    notes: '',
    schemaVersion: 1,
  },
];
