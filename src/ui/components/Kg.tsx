import { BODYWEIGHT, kg } from '../lib/format';

/** A load shown as a big condensed number with a small unit; 0 kg reads "corpo libero". */
export function Kg({ value, size = 'md', className = '' }: { value: number | null | undefined; size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  if (value == null) {
    return (
      <span className={`kg kg-${size} kg-none ${className}`} aria-label="nessun carico">
        —
      </span>
    );
  }
  if (value === 0) {
    return <span className={`kg kg-${size} kg-bw ${className}`}>{BODYWEIGHT}</span>;
  }
  return (
    <span className={`kg kg-${size} ${className}`}>
      <span className="kg-n">{kg(value)}</span>
      <span className="kg-u">kg</span>
    </span>
  );
}
