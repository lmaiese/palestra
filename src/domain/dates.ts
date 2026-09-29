// Calendar-date helpers on ISO strings (YYYY-MM-DD). No timezone conversions:
// components are parsed explicitly and weekday math runs in UTC.

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True when `s` is a real calendar date in YYYY-MM-DD form. */
export function isValidIsoDate(s: unknown): s is string {
  if (typeof s !== 'string') return false;
  const m = ISO_RE.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

function utcDay(iso: string): Date {
  if (!isValidIsoDate(iso)) throw new Error(`Data non valida: ${iso}`);
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** 0 = Sunday ... 6 = Saturday. */
export function weekdayOf(iso: string): number {
  return utcDay(iso).getUTCDay();
}

/** Whole days from `a` to `b` (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((utcDay(b).getTime() - utcDay(a).getTime()) / 86_400_000);
}

/** ISO date `n` days after `iso`. */
export function addDays(iso: string, n: number): string {
  const d = utcDay(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Local calendar day of `now` (the user's today), as ISO. */
export function todayIso(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** "2026-09-28" -> "28/09". */
export function formatShortDate(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}
