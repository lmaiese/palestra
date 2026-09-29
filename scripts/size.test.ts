import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { measure, report } from './size';

describe('size', () => {
  it('measures only js files and reports the gzip total', () => {
    const dir = mkdtempSync(join(tmpdir(), 'size-'));
    writeFileSync(join(dir, 'a.js'), 'x'.repeat(10_000));
    writeFileSync(join(dir, 'b.css'), 'y');
    const rows = measure(dir);
    expect(rows.map((r) => r.file)).toEqual(['a.js']);
    expect(rows[0].gzipKb).toBeLessThan(rows[0].rawKb);
    const r = report(rows);
    expect(r.ok).toBe(true);
    expect(r.text).toMatch(/TOTAL/);
    expect(report(rows, 0.001).ok).toBe(false);
    expect(report([]).ok).toBe(false);
  });
});
