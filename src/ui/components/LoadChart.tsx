// Hand-made line chart of top kg per session. Single series: no legend, the
// page title names it. Tap or hover a point to read it; a table sits below.
import { useLayoutEffect, useRef, useState } from 'react';
import { kg, shortDate } from '../lib/format';

export interface Point {
  date: string;
  topKg: number;
  sessionId: string;
}

interface Props {
  points: Point[];
  color: string;
  prKg: number | null;
  label: string;
}

const H = 220;
const PAD = { t: 28, r: 18, b: 30, l: 40 };

function niceTicks(min: number, max: number): number[] {
  if (min === max) {
    const step = min === 0 ? 5 : Math.max(2.5, Math.round(min * 0.1 / 2.5) * 2.5);
    return [Math.max(0, min - step), min, min + step];
  }
  const span = max - min;
  const raw = span / 3;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

export function LoadChart({ points, color, prKg, label }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(340);
  const [picked, setSel] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => el.clientWidth && setW(el.clientWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (points.length === 0) return null;
  const sel = picked != null && picked < points.length ? picked : points.length - 1;

  const values = points.map((p) => p.topKg);
  const ticks = niceTicks(Math.min(...values), Math.max(...values));
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const innerW = Math.max(40, w - PAD.l - PAD.r);
  const innerH = H - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => PAD.t + innerH - ((v - yMin) / (yMax - yMin || 1)) * innerH;
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.topKg).toFixed(1)}`).join('');

  // Label at most ~5 dates to avoid collisions.
  const every = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(innerW / 64))));
  const current = points[sel];
  const summary = `${label}: ${points.length} sedute, da ${kg(points[0].topKg)} kg il ${shortDate(points[0].date)} a ${kg(
    points[points.length - 1].topKg,
  )} kg il ${shortDate(points[points.length - 1].date)}${prKg != null ? `, record ${kg(prKg)} kg` : ''}.`;

  return (
    <figure className="chart">
      <div className="chart-readout" aria-live="polite">
        <span className="chart-readout-kg">
          {kg(current.topKg)}
          <small>kg</small>
        </span>
        <span className="chart-readout-date">
          {shortDate(current.date)}
          {prKg != null && current.topKg === prKg && <span className="badge-pr">Record</span>}
        </span>
      </div>
      <div ref={wrap} className="chart-wrap">
        <svg width={w} height={H} role="img" aria-label={summary} className="chart-svg">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={w - PAD.r} y1={y(t)} y2={y(t)} className="chart-grid" />
              <text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" className="chart-tick">
                {kg(t)}
              </text>
            </g>
          ))}
          {prKg != null && (
            <line x1={PAD.l} x2={w - PAD.r} y1={y(prKg)} y2={y(prKg)} className="chart-pr" />
          )}
          <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          {points.map((p, i) => {
            const active = i === sel;
            return (
              <g key={p.sessionId + i}>
                {i % every === 0 || i === points.length - 1 ? (
                  <text x={x(i)} y={H - 8} textAnchor="middle" className="chart-tick">
                    {shortDate(p.date)}
                  </text>
                ) : null}
                <circle
                  cx={x(i)}
                  cy={y(p.topKg)}
                  r={active ? 7 : 5}
                  fill={active ? color : 'var(--mat)'}
                  stroke={color}
                  strokeWidth="2.5"
                />
                {/* Generous hit target, bigger than the mark. */}
                <rect
                  x={x(i) - 22}
                  y={PAD.t - 10}
                  width={44}
                  height={innerH + 20}
                  fill="transparent"
                  onPointerEnter={() => setSel(i)}
                  onClick={() => setSel(i)}
                />
              </g>
            );
          })}
        </svg>
      </div>
      <figcaption className="sr-only">{summary}</figcaption>
    </figure>
  );
}
