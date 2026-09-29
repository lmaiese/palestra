// DoD F4 (plan browsing), F6 (last load in the plan), C3 (no Firebase in plan screens).
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { go, renderApp, renderStatic } from '../test-utils';

describe('Piano', () => {
  it('navigates all 8 weeks with themes and preselects the current one', async () => {
    renderApp({ path: '/piano', today: '2026-09-29' });
    const weeks = screen.getByRole('navigation', { name: 'Settimane del ciclo' });
    const links = within(weeks).getAllByRole('link');
    expect(links).toHaveLength(8);
    expect(links[0]).toHaveAttribute('aria-current', 'page');
    expect(links[0]).toHaveAccessibleName(/Settimana 1, Fondamenta, in corso/);
    expect(links[7]).toHaveAccessibleName(/Settimana 8, Deload/);

    for (let n = 1; n <= 8; n++) {
      go(`/piano/${n}`);
      expect(await screen.findByRole('heading', { level: 2, name: new RegExp(`^${n}`) })).toBeInTheDocument();
    }
    go('/piano/4/A');
    expect(await screen.findByRole('button', { name: /Back Squat TEST 3RM/ })).toBeInTheDocument();
    go('/piano/4/C');
    expect(await screen.findByText(/registra il numero e riprovalo in settimana 7/)).toBeInTheDocument();
  });

  it('shows every column of a session row, emphasises anchors, and opens the technique', async () => {
    renderApp({ path: '/piano/1/A', today: '2026-09-29' });
    const squat = await screen.findByRole('button', { name: /Back Squat/ });
    expect(squat).toHaveTextContent('Anchor');
    expect(squat).toHaveTextContent('1x5 @RPE 7 + 3x5 @-10%');
    expect(squat).toHaveTextContent("rec. 2-3'");
    expect(squat).toHaveTextContent('Parallelo o sotto');
    expect(squat.closest('li')).toHaveClass('ex-anchor');
    const tempo = screen.getByRole('button', { name: /Tempo Squat 3-1-1/ });
    expect(tempo.closest('li')).not.toHaveClass('ex-anchor');

    // F6: last load from logged data.
    expect(await within(squat).findByText(/ultima volta/)).toHaveTextContent('ultima volta 70 kg · 28/09');

    expect(squat).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(squat);
    expect(squat).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/ginocchia che seguono i piedi/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Storico di Back Squat' })).toHaveAttribute('href', '#/esercizio/back-squat');
  });

  it('renders with zero sessions and without any repo', () => {
    renderStatic({ status: 'ready', sessions: [] }, { path: '/piano/2/B' });
    expect(screen.getByRole('heading', { level: 2, name: /Upper \+ Pull/ })).toBeInTheDocument();
    expect(screen.getAllByText('mai registrato').length).toBeGreaterThan(0);
  });

  it('exposes the rules: settimana tipo, C-Lite, Beach > Pesi, progressione, warm-up, fatica, tecnica', () => {
    renderStatic({ status: 'ready', sessions: [] }, { path: '/regole' });
    for (const h of [
      'Settimana tipo',
      'Regola C-Lite',
      'Regola Beach > Pesi',
      'Progressione anchor',
      'Regole di progressione',
      'Warm-up standard, 6 minuti',
      'Gestione fatica',
      'Pool di esercizi, tecnica',
      'Note del ciclo',
    ]) {
      expect(screen.getByRole('heading', { name: h })).toBeInTheDocument();
    }
    expect(screen.getByText(/togli stacco pesante, clean e salti/)).toBeInTheDocument();
    expect(screen.getByText('Intensificazione')).toBeInTheDocument();
    expect(screen.getByText(/Mai cedimento/)).toBeInTheDocument();
    expect(screen.getByText(/mini-deload/)).toBeInTheDocument();
    expect(screen.getByText(/Verifica di fine ciclo/)).toBeInTheDocument();
  });
});

// ---- C3: the plan screens' import graph never reaches Firebase ----

const UI = resolve(process.cwd(), 'src/ui');

function importsOf(file: string): string[] {
  const src = readFileSync(file, 'utf8');
  // Type-only imports are erased at build time and cost nothing.
  return [...src.matchAll(/^\s*import\s+(?!type\b)[^'"]*?from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/gm)].map(
    (m) => m[1] ?? m[2],
  );
}

function externalClosure(entry: string): string[] {
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

describe('C3: plan screens do not import Firebase', () => {
  it.each(['screens/Plan.tsx', 'screens/Rules.tsx'])('%s', (file) => {
    const ext = externalClosure(resolve(UI, file));
    expect(ext).toContain('react');
    expect(ext.filter((s) => /^@?firebase/.test(s))).toEqual([]);
  });
  it('the checker detects Firebase where it is used', () => {
    expect(externalClosure(resolve(UI, 'app/firestoreRepo.ts'))).toContain('firebase/firestore');
  });
});
