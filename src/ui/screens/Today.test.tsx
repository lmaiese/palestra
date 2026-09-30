// DoD F8 (dashboard) and UI6 (loading / empty / error).
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { failingRepo, renderApp, renderStatic } from '../test-utils';

describe('Oggi', () => {
  it('shows cycle week, today session, A/B/C completion and anchor loads', async () => {
    renderApp({ today: '2026-10-02' });
    expect(screen.getByText('Settimana 1 di 8')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: /Upper \+ Pull/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Settimana 1\s*Fondamenta/ })).toBeInTheDocument();
    expect(screen.queryByText(/trovare i carichi di riferimento/)).not.toBeInTheDocument(); // objective lives in Piano only
    expect(screen.getByRole('link', { name: 'Registra allenamento' })).toHaveAttribute('href', '#/registra');

    // Completion is by date: the 25/09 C predates week 1 and does not count.
    expect(await screen.findByText('1 di 3 sedute registrate')).toBeInTheDocument();
    const strip = screen.getByRole('list', { name: /Settimana 1, giorno per giorno/ });
    expect(within(strip).getByText(/28\/09: A, fatta/)).toBeInTheDocument();
    expect(within(strip).getByText(/02\/10: B, oggi/)).toBeInTheDocument();
    expect(within(strip).getByText(/30\/09: beach/)).toBeInTheDocument();

    const squat = screen.getByRole('link', { name: /Back Squat/ });
    expect(squat).toHaveAttribute('href', '#/esercizio/back-squat');
    expect(squat).toHaveTextContent('70');
    expect(squat).toHaveTextContent('ultima 28/09');
    expect(screen.getByRole('link', { name: /Deadlift/ })).toHaveTextContent('70');
    expect(screen.getByRole('link', { name: /Pull-up/ })).toHaveTextContent('mai registrato');
  });

  it('on Saturday 03/10 the C of week 1 is still to do, with the C-Lite hint', async () => {
    renderApp({ today: '2026-10-03' });
    expect(screen.getByRole('heading', { level: 1, name: /Hinge \+ Power/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Registra allenamento' })).toBeInTheDocument();
    expect(screen.getByText(/Beach nel weekend\?/)).toBeInTheDocument();
    const strip = screen.getByRole('list', { name: /Settimana 1, giorno per giorno/ });
    expect(within(strip).getByText(/03\/10: C, oggi/)).toBeInTheDocument();
    expect(await screen.findByText('1 di 3 sedute registrate')).toBeInTheDocument();
  });

  it('weekend: the session still missing this week can be logged; last Sunday of the cycle does not promise a new A', async () => {
    const a = renderApp({ today: '2026-10-04' });
    expect(screen.getByRole('heading', { level: 1, name: 'Riposo' })).toBeInTheDocument();
    expect(await screen.findByText('Da recuperare')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Registra B' })).toHaveAttribute('href', '#/registra?w=1&d=B');
    expect(screen.queryByText(/C-Lite/)).not.toBeInTheDocument();
    a.unmount();
    renderApp({ today: '2026-11-22' });
    expect(screen.queryByText(/Domani si riparte/)).not.toBeInTheDocument();
    expect(screen.getByText(/Ultimo giorno del ciclo/)).toBeInTheDocument();
  });

  it('weekend with the whole week done: next session, plus a free log', async () => {
    const done = (id: string, date: string, day: 'A' | 'B' | 'C') => ({
      id, date, week: 1, day, exercises: [], conditioning: '', notes: '', schemaVersion: 1 as const,
    });
    renderApp({
      today: '2026-10-04',
      sessions: [done('a', '2026-09-28', 'A'), done('b', '2026-10-02', 'B'), done('c', '2026-10-03', 'C')],
    });
    expect(await screen.findByText(/Prossima: lunedì 5 ott/)).toBeInTheDocument();
    expect(screen.queryByText('Da recuperare')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Registra allenamento' })).toHaveAttribute('href', '#/registra');
  });

  it('shows bodyweight as "corpo libero", never a 0 kg record', async () => {
    renderApp({
      today: '2026-10-06',
      sessions: [
        {
          id: '2026-10-06-w2-B',
          date: '2026-10-06',
          week: 2,
          day: 'B',
          exercises: [{ exerciseId: 'pull-up', name: 'Pull-up', sets: [{ weightKg: 0, reps: 8, rpe: null }], notes: '' }],
          conditioning: '',
          notes: '',
          schemaVersion: 1,
        },
      ],
    });
    const pull = await screen.findByRole('link', { name: /Pull-up/ });
    expect(pull).toHaveTextContent('corpo libero');
    expect(pull).toHaveTextContent('8 rep');
    expect(pull).not.toHaveTextContent('record');
    expect(pull).not.toHaveTextContent('0 kg');
  });

  it('sign-out is reachable from Oggi', async () => {
    renderApp({ today: '2026-10-06' });
    const foot = screen.getByRole('region', { name: 'Account' });
    expect(foot).toHaveTextContent('Connesso come maieseluigi@gmail.com');
    expect(within(foot).getByRole('button', { name: 'Esci' })).toBeInTheDocument();
  });

  it('Wednesday is beach, with the missing session still loggable', async () => {
    renderApp({ today: '2026-09-30' });
    expect(screen.getByRole('heading', { level: 1, name: 'Beach' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Registra B' })).toBeInTheDocument();
  });

  it('shows a countdown before the cycle and the end-of-cycle check after it', () => {
    const { unmount } = renderApp({ today: '2026-09-21' });
    expect(screen.getByText('Ciclo non ancora iniziato')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.queryByText(/di 3/)).not.toBeInTheDocument();
    unmount();
    renderApp({ today: '2026-11-30' });
    expect(screen.getByRole('heading', { level: 1, name: 'Ciclo concluso' })).toBeInTheDocument();
    expect(screen.getByText(/altezza del CMJ/)).toBeInTheDocument();
  });

  it('marks today as registered when the session exists', async () => {
    renderApp({ today: '2026-09-28' });
    expect(await screen.findByRole('link', { name: /Vedi la seduta registrata/ })).toHaveAttribute('href', '#/storico/2026-09-28-w1-A');
  });

  it('has loading, empty and error states', async () => {
    const { unmount } = renderStatic({ status: 'loading', sessions: [] });
    expect(screen.getAllByText('Carico gli allenamenti').length).toBeGreaterThan(0);
    expect(document.querySelector('.state-loading')).toHaveTextContent('Carico gli allenamenti');
    unmount();
    const r2 = renderApp({ sessions: [] });
    expect(await screen.findByText('Nessun carico sugli anchor')).toBeInTheDocument();
    r2.unmount();
    renderApp({ repo: failingRepo('permission-denied') });
    expect(await screen.findByText('Non riesco a leggere lo storico')).toBeInTheDocument();
    expect(screen.getByText(/Permesso negato/)).toBeInTheDocument();
    expect(screen.queryByText(/FirebaseError/)).not.toBeInTheDocument();
  });
});
