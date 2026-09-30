import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PLAN_JSON, PLAN_MD, parseDateRange, parsePlan, serializePlan, stripMd, toText } from './parse-plan';

const md = readFileSync(PLAN_MD, 'utf8');
const plan = parsePlan(md);

describe('parseDateRange', () => {
  it('parses ranges within and across months', () => {
    expect(parseDateRange('(28 set – 4 ott)', 2026)).toEqual({ startDate: '2026-09-28', endDate: '2026-10-04' });
    expect(parseDateRange('(5 – 11 ott)', 2026)).toEqual({ startDate: '2026-10-05', endDate: '2026-10-11' });
    expect(parseDateRange('(26 ott – 1 nov)', 2026)).toEqual({ startDate: '2026-10-26', endDate: '2026-11-01' });
  });
  it('handles a range across the new year', () => {
    expect(parseDateRange('(29 dic – 4 gen)', 2027)).toEqual({ startDate: '2026-12-29', endDate: '2027-01-04' });
  });
  it('rejects garbage', () => {
    expect(() => parseDateRange('(domani)', 2026)).toThrow();
    expect(() => parseDateRange('(1 – 7 xyz)', 2026)).toThrow(/Mese/);
  });
});

describe('stripMd / toText', () => {
  it('removes bold markers', () => {
    expect(stripMd('**Anchor** e *x*')).toBe('Anchor e x');
  });
  it('renders tables, blockquotes and skips wikilinks', () => {
    const text = toText(['> citazione', '', '| A | B |', '|---|---|', '| **x** | y |', '> link [[a|b]]', '---']);
    expect(text).toBe('citazione\n- x: y');
  });
});

describe('parsePlan on the real plan (F1)', () => {
  it('has 8 weeks with sessions A, B, C', () => {
    expect(plan.weeks).toHaveLength(8);
    for (const w of plan.weeks) expect(w.sessions.map((s) => s.day)).toEqual(['A', 'B', 'C']);
    expect(plan.weeks.map((w) => w.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('has ISO week dates, Monday to Sunday', () => {
    expect(plan.weeks[0]).toMatchObject({ startDate: '2026-09-28', endDate: '2026-10-04' });
    expect(plan.weeks[7]).toMatchObject({ startDate: '2026-11-16', endDate: '2026-11-22' });
    expect(plan.startDate).toBe('2026-09-28');
    expect(plan.endDate).toBe('2026-11-22');
    for (const w of plan.weeks) {
      const [y, m, d] = w.startDate.split('-').map(Number);
      expect(new Date(Date.UTC(y, m - 1, d)).getUTCDay()).toBe(1);
    }
  });

  it('has themes, objectives and novelties', () => {
    expect(plan.weeks.map((w) => w.theme)).toEqual([
      'Fondamenta', 'Volume', 'Tempo', 'Test', 'Intensificazione', 'Intensità', 'Qualità', 'Deload + Verifica',
    ]);
    for (const w of plan.weeks) {
      expect(w.objective).not.toBe('');
      expect(w.novelty).not.toBe('');
    }
  });

  it('has the 5 anchors', () => {
    expect(plan.anchors).toEqual(['back-squat', 'bench-press', 'deadlift', 'overhead-press', 'pull-up']);
  });

  it('parses exercise rows, stripping bold and em-dashes', () => {
    const a1 = plan.weeks[0].sessions[0];
    expect(a1.title).toBe('Lower Power');
    expect(a1.exercises[1]).toEqual({
      exerciseId: 'back-squat',
      name: 'Back Squat',
      block: 'Anchor',
      isAnchor: true,
      prescription: '1x5 @RPE 7 + 3x5 @-10%',
      rest: "2-3'",
      notes: 'Parallelo o sotto',
    });
    const cond = a1.exercises[5];
    expect(cond.block).toBe('Conditioning');
    expect(cond.prescription).toBe('');
    expect(plan.weeks[1].sessions[0].exercises[1].notes).toBe('');
    const allNames = plan.weeks.flatMap((w) => w.sessions.flatMap((s) => s.exercises.map((e) => e.name + e.block)));
    for (const n of allNames) expect(n).not.toContain('*');
  });

  it('maps test-week names to anchor ids', () => {
    const w4 = plan.weeks[3];
    expect(w4.sessions[0].exercises[1]).toMatchObject({ name: 'Back Squat TEST 3RM', exerciseId: 'back-squat', isAnchor: true });
    expect(w4.sessions[2].exercises[0]).toMatchObject({ name: 'Deadlift TEST 3RM', exerciseId: 'deadlift' });
    expect(w4.sessions[1].exercises[1]).toMatchObject({ exerciseId: 'pull-up' });
  });

  it('every anchor session contains its anchors each week', () => {
    for (const w of plan.weeks) {
      const ids = w.sessions.flatMap((s) => s.exercises.filter((e) => e.isAnchor).map((e) => e.exerciseId));
      expect(ids).toContain('back-squat');
      expect(ids).toContain('bench-press');
      expect(ids).toContain('deadlift');
      expect(ids).toContain('pull-up');
    }
  });

  it('keeps week trailing notes in extra', () => {
    expect(plan.weeks[3].extra).toEqual([
      'Se un test va male per stanchezza accumulata, registra il numero e riprovalo in settimana 7. Non è un problema, è un dato.',
    ]);
    expect(plan.weeks[7].extra[0]).toBe('Verifica di fine ciclo');
    expect(plan.weeks[7].extra).toHaveLength(5);
    expect(plan.weeks[0].extra).toEqual([]);
  });

  it('has week template, progression table (7 rows) and rules', () => {
    expect(plan.weekTemplate).toHaveLength(7);
    expect(plan.weekTemplate[0]).toEqual({ day: 'Lunedì', activity: 'A — Lower Power (squat)' });
    expect(plan.weekTemplate[4].activity).toMatch(/^B — /);
    expect(plan.weekTemplate[5].activity).toMatch(/^C — /);
    expect(plan.progression).toHaveLength(7);
    expect(plan.progression[0]).toEqual({ weeks: '1-2', phase: 'Base', topSet: '1x5 @RPE 7-7.5', backOff: '3-4x5 @-10%' });
    expect(plan.progression[6].backOff).toBe('');
    expect(plan.progressionRules).toHaveLength(4);
    expect(plan.progressionRules[3]).toBe('Mai cedimento. Mai RIR 0.');
    const titles = plan.rules.map((r) => r.title);
    for (const t of ['C-Lite', 'Beach > Pesi', 'Progressione anchor', 'Segnali che stai esagerando', 'Ordine di taglio quando sei cotto', 'Acqua, sonno, sabbia']) {
      expect(titles).toContain(t);
    }
    const cLite = plan.rules.find((r) => r.title === 'C-Lite');
    expect(cLite?.text).toMatch(/^Se nel weekend giochi a beach/);
    expect(cLite?.text).not.toContain('**');
  });

  it('has the warm-up list', () => {
    expect(plan.warmup).toHaveLength(6);
    expect(plan.warmup[0]).toBe("1' cyclette o camminata");
  });

  it('has the technique pool with categories', () => {
    const cats = [...new Set(plan.techniques.map((t) => t.category))];
    expect(cats).toEqual(['Potenza', 'Lower', 'Upper', 'Core', 'Conditioning']);
    expect(plan.techniques.find((t) => t.name === 'Back Squat')?.cue).toMatch(/Parallelo/);
    expect(plan.techniques.length).toBeGreaterThan(30);
  });
});

describe('parsePlan errors', () => {
  it('throws when a section is missing', () => {
    expect(() => parsePlan('# Titolo\n')).toThrow();
  });
  it('throws when a week misses a session', () => {
    const broken = md.replace('\n**B — Upper + Pull**\n', '\n**X — nope**\n');
    expect(() => parsePlan(broken)).toThrow(/Settimana 1/);
  });
});

describe('plan.json (F2)', () => {
  it('is the deterministic serialization of the markdown', () => {
    expect(readFileSync(PLAN_JSON, 'utf8')).toBe(serializePlan(plan));
    expect(serializePlan(parsePlan(md))).toBe(serializePlan(plan));
    expect(serializePlan(plan).endsWith('}\n')).toBe(true);
  });
});
