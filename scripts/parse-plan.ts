// Parses data/piano_8_settimane_v2.md into src/data/plan.json.
// Output is deterministic: fixed key order, 2-space indent, trailing newline.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { canonicalExerciseId } from '../src/domain/exercises';
import type {
  DayId,
  Plan,
  PlanExercise,
  PlanSession,
  PlanWeek,
  ProgressionRow,
  TechniqueEntry,
} from '../src/domain/types';

const MONTHS: Record<string, number> = {
  gen: 1, feb: 2, mar: 3, apr: 4, mag: 5, giu: 6, lug: 7, ago: 8, set: 9, ott: 10, nov: 11, dic: 12,
};

/** Removes markdown emphasis and trims. */
export function stripMd(s: string): string {
  return s.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*/g, '').trim();
}

/** "—" (empty cell in the plan) becomes "". */
function cell(s: string): string {
  const v = stripMd(s);
  return v === '—' || v === '-' ? '' : v;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function monthOf(abbr: string): number {
  const m = MONTHS[abbr.toLowerCase().slice(0, 3)];
  if (!m) throw new Error(`Mese sconosciuto: ${abbr}`);
  return m;
}

/** Parses "(28 set – 4 ott)" / "(5 – 11 ott)" into ISO start/end dates. */
export function parseDateRange(range: string, year: number): { startDate: string; endDate: string } {
  const m = range.match(/^\(?\s*(\d{1,2})(?:\s+([a-zà]+))?\s*[–-]\s*(\d{1,2})\s+([a-zà]+)\s*\)?$/i);
  if (!m) throw new Error(`Intervallo date non riconosciuto: ${range}`);
  const endMonth = monthOf(m[4]);
  const startMonth = m[2] ? monthOf(m[2]) : endMonth;
  const startYear = startMonth > endMonth ? year - 1 : year;
  return {
    startDate: `${startYear}-${pad(startMonth)}-${pad(Number(m[1]))}`,
    endDate: `${year}-${pad(endMonth)}-${pad(Number(m[3]))}`,
  };
}

function isTableLine(line: string): boolean {
  return line.trim().startsWith('|');
}

function splitRow(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
}

/** Reads a table starting at `start` (header line). Returns body rows and the index after it. */
function readTable(lines: string[], start: number): { rows: string[][]; next: number } {
  let i = start;
  const raw: string[] = [];
  while (i < lines.length && isTableLine(lines[i])) raw.push(lines[i++]);
  const rows = raw.slice(2).map(splitRow); // skip header and separator
  return { rows, next: i };
}

interface Section {
  heading: string;
  lines: string[];
}

/** Splits lines into sections at headings of exactly `level` hashes. */
function sections(lines: string[], level: number): Section[] {
  const prefix = '#'.repeat(level) + ' ';
  const out: Section[] = [];
  let cur: Section | null = null;
  for (const line of lines) {
    if (line.startsWith(prefix)) {
      cur = { heading: line.slice(prefix.length).trim(), lines: [] };
      out.push(cur);
    } else if (cur) {
      cur.lines.push(line);
    }
  }
  return out;
}

function find(list: Section[], pred: (h: string) => boolean): Section {
  const s = list.find((x) => pred(x.heading));
  if (!s) throw new Error('Sezione mancante nel piano');
  return s;
}

/** Lines before the first sub-heading of a section. */
function bodyUntilSubheading(lines: string[]): string[] {
  const idx = lines.findIndex((l) => /^#{3,} /.test(l));
  return idx === -1 ? lines : lines.slice(0, idx);
}

/**
 * Converts free markdown lines to plain text: paragraphs and list items kept one per line,
 * table body rows rendered as "- a: b", bold stripped, blockquote markers and wikilink lines dropped.
 */
export function toText(lines: string[]): string {
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line === '---' || line.includes('[[')) continue;
    if (isTableLine(line)) {
      const { rows, next } = readTable(lines, i);
      for (const r of rows) out.push(`- ${r.map(stripMd).join(': ')}`);
      i = next - 1;
      continue;
    }
    out.push(stripMd(line.replace(/^>\s?/, '')));
  }
  return out.join('\n');
}

function numberedItems(lines: string[]): string[] {
  return lines.filter((l) => /^\d+\.\s/.test(l.trim())).map((l) => stripMd(l.trim().replace(/^\d+\.\s+/, '')));
}

function parseSessionHeading(line: string): { day: DayId; title: string } | null {
  const m = line.trim().match(/^\*\*([ABC]) — (.+)\*\*$/);
  return m ? { day: m[1] as DayId, title: m[2].trim() } : null;
}

function parseExerciseRow(r: string[]): PlanExercise {
  const [block, name, prescription, rest, notes] = r.map(cell);
  return {
    exerciseId: canonicalExerciseId(name),
    name,
    block,
    isAnchor: block === 'Anchor',
    prescription: prescription ?? '',
    rest: rest ?? '',
    notes: notes ?? '',
  };
}

function parseWeek(sec: Section, year: number): PlanWeek {
  const hm = sec.heading.match(/^Settimana (\d+) — (.+?) (\(.+\))$/);
  if (!hm) throw new Error(`Titolo settimana non riconosciuto: ${sec.heading}`);
  const { startDate, endDate } = parseDateRange(hm[3], year);
  let objective = '';
  let novelty = '';
  const sessions: PlanSession[] = [];
  const extra: string[] = [];
  const lines = sec.lines;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line === '---') continue;
    const obj = line.match(/^\*\*Obiettivo\*\*:\s*(.*)$/);
    const nov = line.match(/^\*\*Novità\*\*:\s*(.*)$/);
    const head = parseSessionHeading(line);
    if (obj) objective = stripMd(obj[1]);
    else if (nov) novelty = stripMd(nov[1]);
    else if (head) {
      let j = i + 1;
      while (j < lines.length && !isTableLine(lines[j])) j++;
      const { rows, next } = readTable(lines, j);
      sessions.push({ day: head.day, title: head.title, exercises: rows.map(parseExerciseRow) });
      i = next - 1;
    } else {
      extra.push(stripMd(line.replace(/^>\s?/, '')));
    }
  }
  const days = sessions.map((s) => s.day).join('');
  if (days !== 'ABC') throw new Error(`Settimana ${hm[1]}: sedute attese A, B, C, trovate ${days}`);
  return { number: Number(hm[1]), theme: stripMd(hm[2]), startDate, endDate, objective, novelty, sessions, extra };
}

/** Pure parser: markdown of the plan -> Plan. */
export function parsePlan(md: string): Plan {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const titleLine = lines.find((l) => l.startsWith('# '));
  const title = titleLine ? stripMd(titleLine.slice(2)) : '';
  const h2 = sections(lines, 2);

  // Parametri: year from "Periodo | Lun 28 set → Dom 22 nov 2026".
  const params = find(h2, (h) => h === 'Parametri');
  const periodMatch = params.lines.join('\n').match(/Periodo\s*\|[^\n]*?(\d{4})/);
  const year = periodMatch ? Number(periodMatch[1]) : 2026;

  // Anchors: "**5 anchor fissi** ...: Back Squat, Bench Press, ...".
  const how = find(h2, (h) => h.startsWith('Come Funziona'));
  const anchorLine = how.lines.find((l) => /anchor fissi/i.test(l));
  if (!anchorLine) throw new Error('Riga anchor mancante');
  const anchors = stripMd(anchorLine)
    .split(':')
    .slice(1)
    .join(':')
    .replace(/\.$/, '')
    .split(',')
    .map((n) => canonicalExerciseId(n));

  // Settimana tipo + rules.
  const tipo = find(h2, (h) => h === 'Settimana Tipo');
  const tipoBody = bodyUntilSubheading(tipo.lines);
  const tStart = tipoBody.findIndex(isTableLine);
  const weekTemplate = readTable(tipoBody, tStart).rows.map(([day, activity]) => ({
    day: stripMd(day),
    activity: stripMd(activity),
  }));
  const whyLine = tipoBody.find((l) => l.startsWith('**Perché'));
  const tipoSubs = sections(tipo.lines, 3);

  // Progressione.
  const prog = find(h2, (h) => h === 'Progressione Anchor');
  const progBody = bodyUntilSubheading(prog.lines);
  const pStart = progBody.findIndex(isTableLine);
  const progression: ProgressionRow[] = readTable(progBody, pStart).rows.map(([weeks, phase, topSet, backOff]) => ({
    weeks: cell(weeks),
    phase: cell(phase),
    topSet: cell(topSet),
    backOff: cell(backOff),
  }));
  const progressionRules = numberedItems(progBody);
  const progIntro = progBody.slice(0, pStart).filter((l) => l.trim());
  const warmSec = find(sections(prog.lines, 3), (h) => h.startsWith('Warm-up'));
  const warmup = numberedItems(warmSec.lines);

  // Weeks.
  const weeksSec = find(h2, (h) => h === 'Le 8 Settimane');
  const weeks = sections(weeksSec.lines, 3).map((s) => parseWeek(s, year));

  // Techniques.
  const techSec = find(h2, (h) => h.startsWith('Pool di Esercizi'));
  const techniques: TechniqueEntry[] = [];
  for (const cat of sections(techSec.lines, 3)) {
    const start = cat.lines.findIndex(isTableLine);
    for (const [name, cue] of readTable(cat.lines, start).rows) {
      techniques.push({ category: cat.heading, name: stripMd(name), cue: stripMd(cue) });
    }
  }

  // Rules: plan explanation, C-Lite, Beach > Pesi, progression, fatigue management, logging.
  const rules: { title: string; text: string }[] = [];
  rules.push({ title: 'Parametri', text: toText(params.lines) });
  rules.push({ title: 'Come funziona questo piano', text: toText(how.lines) });
  if (whyLine) {
    const why = stripMd(whyLine).replace(/^Perché questo ordine:\s*/, '');
    rules.push({ title: 'Perché questo ordine', text: why.charAt(0).toUpperCase() + why.slice(1) });
  }
  for (const s of tipoSubs) rules.push({ title: s.heading.replace(/^Regola\s+/, ''), text: toText(s.lines) });
  rules.push({ title: 'Progressione anchor', text: toText(progIntro) });
  const fatigue = find(h2, (h) => h === 'Gestione Fatica');
  for (const s of sections(fatigue.lines, 3)) rules.push({ title: s.heading, text: toText(s.lines) });
  const log = h2.find((s) => s.heading === 'Log e Tracking');
  if (log) rules.push({ title: 'Log e tracking', text: toText(log.lines) });

  return {
    title,
    startDate: weeks[0].startDate,
    endDate: weeks[weeks.length - 1].endDate,
    anchors,
    weekTemplate,
    progression,
    progressionRules,
    rules,
    warmup,
    weeks,
    techniques,
  };
}

/** Stable serialization used for src/data/plan.json. */
export function serializePlan(plan: Plan): string {
  return JSON.stringify(plan, null, 2) + '\n';
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const PLAN_MD = resolve(ROOT, 'data/piano_8_settimane_v2.md');
export const PLAN_JSON = resolve(ROOT, 'src/data/plan.json');

function main(): void {
  const plan = parsePlan(readFileSync(PLAN_MD, 'utf8'));
  writeFileSync(PLAN_JSON, serializePlan(plan));
  const n = plan.weeks.reduce((acc, w) => acc + w.sessions.length, 0);
  console.log(`plan.json: ${plan.weeks.length} settimane, ${n} sedute, ${plan.techniques.length} tecniche`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
