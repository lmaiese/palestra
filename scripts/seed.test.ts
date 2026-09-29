import { describe, expect, it, vi } from 'vitest';
import { seedSessions } from '../src/domain/seed';
import { buildCommitBody, docName, runSeed, toFirestoreValue } from './seed';

describe('toFirestoreValue', () => {
  it('encodes scalars, lists and maps like the web SDK', () => {
    expect(toFirestoreValue(null)).toEqual({ nullValue: null });
    expect(toFirestoreValue(70)).toEqual({ integerValue: '70' });
    expect(toFirestoreValue(72.5)).toEqual({ doubleValue: 72.5 });
    expect(toFirestoreValue(true)).toEqual({ booleanValue: true });
    expect(toFirestoreValue('A')).toEqual({ stringValue: 'A' });
    expect(toFirestoreValue([1, { a: null }])).toEqual({
      arrayValue: { values: [{ integerValue: '1' }, { mapValue: { fields: { a: { nullValue: null } } } }] },
    });
    expect(() => toFirestoreValue(Number.NaN)).toThrow();
    expect(() => toFirestoreValue(() => 1)).toThrow();
  });
});

describe('buildCommitBody', () => {
  it('creates only if missing, with server timestamps and the rule-allowed keys', () => {
    const body = buildCommitBody(seedSessions[1]);
    const w = body.writes[0];
    expect(w.update.name).toBe(docName('palestra-luigi', '2026-09-28-w1-A'));
    expect(w.currentDocument).toEqual({ exists: false });
    expect(w.updateTransforms.map((t) => t.fieldPath)).toEqual(['createdAt', 'updatedAt']);
    expect(Object.keys(w.update.fields)).toEqual(['date', 'week', 'day', 'exercises', 'conditioning', 'notes', 'schemaVersion']);
    expect(w.update.fields.week).toEqual({ integerValue: '1' });
    expect(JSON.stringify(w.update.fields.exercises)).toContain('"rpe":{"integerValue":"7"}');
  });
});

describe('runSeed', () => {
  it('dry-run prints and does not call the network', async () => {
    const fetch = vi.fn();
    const lines: string[] = [];
    const out = await runSeed({ dryRun: true, fetch, log: (l) => lines.push(l), getToken: () => 'x' });
    expect(fetch).not.toHaveBeenCalled();
    expect(out).toEqual({ '2026-09-25-w1-C': 'dry-run', '2026-09-28-w1-A': 'dry-run' });
    expect(lines[0]).toMatch(/\[dry-run\] creerei sessions\/2026-09-25-w1-C/);
  });

  it('is idempotent: existing documents are reported as già presente', async () => {
    const existing = new Set<string>();
    const fetch = vi.fn(async (_url: string, init: { headers: Record<string, string>; body?: string }) => {
      expect(init.headers.Authorization).toBe('Bearer tok');
      expect(init.headers['x-goog-user-project']).toBe('palestra-luigi');
      const name = JSON.parse(init.body ?? '{}').writes[0].update.name as string;
      if (existing.has(name)) return { ok: false, status: 409, text: async () => '{"error":{"status":"ALREADY_EXISTS"}}' };
      existing.add(name);
      return { ok: true, status: 200, text: async () => '{}' };
    });
    const opts = { dryRun: false, fetch, getToken: () => 'tok', log: () => {} };
    expect(Object.values(await runSeed(opts))).toEqual(['creato', 'creato']);
    expect(Object.values(await runSeed(opts))).toEqual(['già presente', 'già presente']);
    expect(fetch.mock.calls[0][0]).toBe('https://firestore.googleapis.com/v1/projects/palestra-luigi/databases/(default)/documents:commit');
  });

  it('fails loudly on other errors', async () => {
    const fetch = vi.fn(async () => ({ ok: false, status: 403, text: async () => 'PERMISSION_DENIED' }));
    await expect(runSeed({ dryRun: false, fetch, getToken: () => 't', log: () => {} })).rejects.toThrow(/HTTP 403/);
  });
});
