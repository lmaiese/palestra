import { plateVar } from '../lib/plates';

/** A small bumper plate seen face-on. Decorative: the lift name is always next to it. */
export function Plate({ exerciseId, size = 28 }: { exerciseId: string; size?: number }) {
  return (
    <svg
      className="plate"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      style={{ color: plateVar(exerciseId) }}
    >
      <circle cx="16" cy="16" r="15" fill="currentColor" stroke="var(--plate-edge)" strokeWidth="1.2" />
      <circle cx="16" cy="16" r="11.5" fill="none" stroke="var(--plate-ink)" strokeOpacity="0.28" strokeWidth="1" />
      <circle cx="16" cy="16" r="5" fill="var(--plate-ink)" fillOpacity="0.35" />
      <circle cx="16" cy="16" r="2.6" fill="var(--floor)" />
    </svg>
  );
}
