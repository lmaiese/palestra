// Cost DoD C3: plan browsing must not pull Firebase/Firestore into the bundle.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const DOMAIN = resolve(process.cwd(), 'src/domain');

function importsOf(file: string): string[] {
  const src = readFileSync(file, 'utf8');
  return [...src.matchAll(/(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g)].map(
    (m) => m[1] ?? m[2],
  );
}

/** All module specifiers reachable from `entry` through relative imports. */
function closure(entry: string): string[] {
  const seen = new Set<string>();
  const external: string[] = [];
  const visit = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    for (const spec of importsOf(file)) {
      if (!spec.startsWith('.')) {
        external.push(spec);
        continue;
      }
      const base = resolve(dirname(file), spec);
      const target = [base, `${base}.ts`, `${base}.tsx`].find((p) => /\.tsx?$/.test(p) && existsSync(p));
      if (target) visit(target);
    }
  };
  visit(entry);
  return external;
}

describe('plan-only modules (C3)', () => {
  it.each(['plan.ts', 'exercises.ts', 'stats.ts', 'dates.ts', 'validation.ts', 'sessionId.ts', 'seed.ts'])(
    '%s does not import firebase',
    (file) => {
      const ext = closure(resolve(DOMAIN, file));
      expect(ext.filter((s) => s.startsWith('firebase') || s.startsWith('@firebase'))).toEqual([]);
    },
  );
  it('the checker does detect firebase imports', () => {
    expect(closure(resolve(DOMAIN, 'repo.ts'))).toContain('firebase/firestore');
  });
});
