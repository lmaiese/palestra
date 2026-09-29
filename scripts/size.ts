// Gzip size of the production JS bundle (DoD C6: total <= 350 KB).
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

export const LIMIT_KB = 350;

export interface SizeRow {
  file: string;
  rawKb: number;
  gzipKb: number;
}

export function measure(dir: string): SizeRow[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.js'))
    .sort()
    .map((file) => {
      const buf = readFileSync(join(dir, file));
      return { file, rawKb: buf.length / 1024, gzipKb: gzipSync(buf, { level: 9 }).length / 1024 };
    });
}

export function report(rows: SizeRow[], limitKb = LIMIT_KB): { text: string; ok: boolean; totalKb: number } {
  const totalKb = rows.reduce((a, r) => a + r.gzipKb, 0);
  const width = Math.max(4, ...rows.map((r) => r.file.length));
  const line = (a: string, b: string, c: string) => `${a.padEnd(width)}  ${b.padStart(10)}  ${c.padStart(10)}`;
  const text = [
    line('file', 'raw KB', 'gzip KB'),
    ...rows.map((r) => line(r.file, r.rawKb.toFixed(1), r.gzipKb.toFixed(1))),
    line('TOTAL', rows.reduce((a, r) => a + r.rawKb, 0).toFixed(1), totalKb.toFixed(1)),
    `limite ${limitKb} KB gzip: ${totalKb <= limitKb ? 'OK' : 'SUPERATO'}`,
  ].join('\n');
  return { text, ok: rows.length > 0 && totalKb <= limitKb, totalKb };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dir = resolve(process.cwd(), 'dist/assets');
  let rows: SizeRow[] = [];
  try {
    rows = measure(dir);
  } catch {
    console.error(`${dir} non trovato: esegui prima npm run build`);
    process.exit(1);
  }
  const { text, ok } = report(rows);
  console.log(text);
  if (!ok) process.exit(1);
}
