// DoD F7 (history, exercise chart + PR), F5 (delete with confirmation), UI6 (states).
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { seedSessions } from '../../domain/seed';
import type { WorkoutSession } from '../../domain/types';
import { failingRepo, renderApp, renderStatic } from '../test-utils';

const later: WorkoutSession = {
  id: '2026-10-05-w2-A',
  date: '2026-10-05',
  week: 2,
  day: 'A',
  exercises: [{ exerciseId: 'back-squat', name: 'Back Squat', sets: [{ weightKg: 77.5, reps: 5, rpe: 7.5 }, { weightKg: 70, reps: 5, rpe: null }], notes: '' }],
  conditioning: '',
  notes: '',
  schemaVersion: 1,
};

describe('Storico', () => {
  it('lists sessions newest first with top loads', async () => {
    renderApp({ path: '/storico', sessions: [...seedSessions, later] });
    const rows = await screen.findAllByRole('link', { name: /Sett\. \d, [ABC]\./ });
    expect(rows.map((r) => r.getAttribute('href'))).toEqual([
      '#/storico/2026-10-05-w2-A',
      '#/storico/2026-09-28-w1-A',
      '#/storico/2026-09-25-w1-C',
    ]);
    expect(rows[1]).toHaveTextContent('Back Squat 70');
    expect(rows[2]).toHaveTextContent('Hinge + Power');
    expect(rows[2]).toHaveTextContent('Ridotto perché giocavo a beach');
    expect(screen.getByText('3 sedute registrate')).toBeInTheDocument();
  });

  it('shows a session in detail and deletes it only after confirmation', async () => {
    const user = userEvent.setup();
    const { repo } = renderApp({ path: '/storico/2026-09-25-w1-C' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Hinge + Power' })).toBeInTheDocument();
    expect(screen.getByText('Ridotto perché giocavo a beach')).toBeInTheDocument();
    expect(screen.getByText('3 × (250 m row + swing 20 kg)')).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Set di Bulgarian Split Squat' })).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByRole('link', { name: /Modifica/ })).toHaveAttribute('href', '#/registra/2026-09-25-w1-C');
    // First time an exercise is logged: no Record badge.
    expect(screen.queryByText('Record')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Elimina/ }));
    const dialog = screen.getByRole('alertdialog', { name: 'Eliminare la seduta?' });
    await user.click(within(dialog).getByRole('button', { name: 'Annulla' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Elimina/ }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Elimina seduta' }));
    expect(await screen.findByText('Seduta eliminata')).toBeInTheDocument();
    await waitFor(() => expect(window.location.hash).toBe('#/storico'));
    let remaining: WorkoutSession[] = [];
    repo.subscribe((s) => (remaining = s), () => {});
    await waitFor(() => expect(remaining.map((s) => s.id)).toEqual(['2026-09-28-w1-A']));
  });

  it('exercise page: chart of top kg over time, table fallback and PR badge', async () => {
    renderApp({ path: '/esercizio/back-squat', sessions: [...seedSessions, later] });
    expect(await screen.findByRole('heading', { level: 1, name: 'Back Squat' })).toBeInTheDocument();
    const chart = screen.getByRole('img', { name: /Back Squat, carico massimo: 2 sedute, da 70 kg il 28\/09 a 77,5 kg il 05\/10, record 77,5 kg/ });
    expect(chart.querySelectorAll('circle')).toHaveLength(2);
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('05/10');
    expect(rows[0]).toHaveTextContent('77,5');
    expect(within(rows[0]).getByText('PR')).toBeInTheDocument();
    expect(rows[1]).toHaveTextContent('70 @7');
    expect(screen.getByText('Record', { selector: 'dt' })).toBeInTheDocument();
  });

  it('a later heavier lift is a Record in the session detail', async () => {
    renderApp({ path: '/storico/2026-10-05-w2-A', sessions: [...seedSessions, later] });
    expect(await screen.findByText('Record')).toBeInTheDocument();
  });

  it('bodyweight history reads "corpo libero", with no 0 kg record', async () => {
    const bw: WorkoutSession = {
      ...later,
      id: '2026-10-06-w2-B',
      date: '2026-10-06',
      day: 'B',
      exercises: [{ exerciseId: 'pull-up', name: 'Pull-up', sets: [{ weightKg: 0, reps: 8, rpe: null }], notes: '' }],
    };
    renderApp({ path: '/esercizio/pull-up', sessions: [bw] });
    expect(await screen.findByRole('heading', { level: 1, name: 'Pull-up' })).toBeInTheDocument();
    expect(screen.getAllByText('corpo libero').length).toBeGreaterThan(0);
    expect(screen.getByText('corpo libero ×8')).toBeInTheDocument();
    expect(screen.queryByText('PR')).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /carico massimo/ })).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/\b0 kg/);
  });

  it('exercise page: loading and error states', async () => {
    const a = renderStatic({ status: 'loading', sessions: [] }, { path: '/esercizio/back-squat' });
    expect(screen.getByText('Carico lo storico')).toBeInTheDocument();
    a.unmount();
    renderApp({ path: '/esercizio/back-squat', repo: failingRepo('unavailable') });
    expect(await screen.findByRole('alert')).toHaveTextContent('Server non raggiungibile');
  });

  it('has loading, empty and error states', async () => {
    const a = renderStatic({ status: 'loading', sessions: [] }, { path: '/storico' });
    expect(screen.getByText('Carico le sedute')).toBeInTheDocument();
    a.unmount();
    const b = renderApp({ path: '/storico', sessions: [] });
    expect(await screen.findByText('Ancora nessuna seduta')).toBeInTheDocument();
    b.unmount();
    const c = renderApp({ path: '/esercizio/front-squat', sessions: [] });
    expect(await screen.findByText('Nessun carico registrato')).toBeInTheDocument();
    c.unmount();
    const d = renderApp({ path: '/storico', repo: failingRepo('unavailable') });
    expect(await screen.findByRole('alert')).toHaveTextContent('Non riesco a leggere lo storico');
    d.unmount();
    renderApp({ path: '/storico/nope', sessions: [] });
    expect(await screen.findByText('Seduta non trovata')).toBeInTheDocument();
  });
});
