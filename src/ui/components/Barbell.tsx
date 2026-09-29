// Brand mark: one sleeve of a loaded bar, plates in competition loading order
// (25 red, 20 blue, 15 yellow, 10 green, 5 white) = the five anchor colours.
const PLATES = [
  { c: 'var(--plate-squat)', h: 100, w: 20 },
  { c: 'var(--plate-bench)', h: 88, w: 18 },
  { c: 'var(--plate-deadlift)', h: 76, w: 16 },
  { c: 'var(--plate-ohp)', h: 60, w: 13 },
  { c: 'var(--plate-pullup)', h: 42, w: 10 },
];

export function Barbell({ className, height = 56 }: { className?: string; height?: number }) {
  const gap = 5;
  const rects = PLATES.map((p, i) => ({
    ...p,
    x: 26 + PLATES.slice(0, i).reduce((sum, q) => sum + q.w + gap, 0),
  }));
  const x = 26 + PLATES.reduce((sum, q) => sum + q.w + gap, 0);
  const total = x + 4 + 34;
  return (
    <svg
      className={className}
      viewBox={`0 0 ${total} 104`}
      height={height}
      width={(height * total) / 104}
      aria-hidden="true"
    >
      {/* bar and collar */}
      <rect x="0" y="48" width={total} height="8" rx="2" fill="var(--steel)" />
      <rect x="16" y="40" width="8" height="24" rx="2" fill="var(--chalk-2)" />
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={52 - r.h / 2} width={r.w} height={r.h} rx={r.w / 2.6} fill={r.c} />
      ))}
      <rect x={x + 1} y="42" width="7" height="20" rx="2" fill="var(--chalk-2)" />
    </svg>
  );
}
