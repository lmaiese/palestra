// Date and number formatting for the UI. Dates are ISO local days (YYYY-MM-DD).

const MONTHS = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
];
const MONTHS_SHORT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const WEEKDAYS = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const WEEKDAYS_SHORT = ['D', 'L', 'M', 'M', 'G', 'V', 'S'];

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return toISO(new Date());
}

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export function addDays(iso: string, n: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((parseISO(toIso).getTime() - parseISO(fromIso).getTime()) / 86_400_000);
}

/** "28/09" */
export function shortDate(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

/** "martedì 29 settembre" */
export function longDate(iso: string): string {
  const d = parseISO(iso);
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "29 set" */
export function dayMonth(iso: string): string {
  const d = parseISO(iso);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

export function monthShort(iso: string): string {
  return MONTHS_SHORT[parseISO(iso).getMonth()];
}

export function dayOfMonth(iso: string): number {
  return parseISO(iso).getDate();
}

export function weekdayName(iso: string): string {
  return WEEKDAYS[parseISO(iso).getDay()];
}

export function weekdayLetter(iso: string): string {
  return WEEKDAYS_SHORT[parseISO(iso).getDay()];
}

/** 72.5 → "72,5"; 70 → "70" */
export function kg(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toLocaleString('it-IT', { maximumFractionDigits: 2 });
}

/** "72,5" | "72.5" → 72.5; "" → null; garbage → NaN */
export function parseDecimal(raw: string): number | null {
  const t = raw.trim().replace(',', '.');
  if (t === '') return null;
  if (!/^-?\d*(\.\d*)?$/.test(t) || t === '.' || t === '-') return Number.NaN;
  return Number(t);
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
