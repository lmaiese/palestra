// DoD F8 (dashboard) and UI6 (loading / empty / error).
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { failingRepo, renderApp, renderStatic } from '../test-utils';

describe('Oggi', () => {
  it('shows cycle week, today session, A/B/C completion and anchor loads', async () => {
    renderApp({ today: '2026-09-29' });
    expect(screen.getByText('Settimana 1 di 8')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: /Upper \+ Pull/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Settimana 1\s*Fondamenta/ })).toBeInTheDocument();
    expect(screen.getByText(/trovare i carichi di riferimento/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Registra allenamento' })).toHaveAttribute('href', '#/registra');

    // Seeds: A of 28/09 and C of 25/09 belong to week 1.
    expect(await screen.findByText('2 di 3 sedute registrate')).toBeInTheDocument();
    const strip = screen.getByRole('list', { name: /Settimana 1, giorno per giorno/ });
    expect(within(strip).getByText(/28\/09: A, fatta/)).toBeInTheDocument();
    expect(within(strip).getByText(/29\/09: B, oggi/)).toBeInTheDocument();
    expect(within(strip).getByText(/30\/09: beach/)).toBeInTheDocument();

    const squat = screen.getByRole('link', { name: /Back Squat/ });
    expect(squat).toHaveAttribute('href', '#/esercizio/back-squat');
    expect(squat).toHaveTextContent('70');
    expect(squat).toHaveTextContent('ultima 28/09');
    expect(screen.getByRole('link', { name: /Deadlift/ })).toHaveTextContent('70');
    expect(screen.getByRole('link', { name: /Pull-up/ })).toHaveTextContent('mai registrato');
  });

  it('suggests beach on Wednesday and the next session', () => {
    renderApp({ today: '2026-09-30' });
    expect(screen.getByRole('heading', { level: 1, name: 'Beach' })).toBeInTheDocument();
    expect(screen.getByText(/Prossima: venerdì 2 ott/)).toBeInTheDocument();
  });

  it('shows a countdown before the cycle and the end-of-cycle check after it', () => {
    const { unmount } = renderApp({ today: '2026-09-21' });
    expect(screen.getByText('Ciclo non ancora iniziato')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
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
    expect(screen.getByText('Carico i tuoi carichi')).toBeInTheDocument();
    unmount();
    const r2 = renderApp({ sessions: [] });
    expect(await screen.findByText('Nessun carico sugli anchor')).toBeInTheDocument();
    r2.unmount();
    renderApp({ repo: failingRepo('permission-denied') });
    expect(await screen.findByText('Non riesco a leggere lo storico')).toBeInTheDocument();
    expect(screen.getByText('permission-denied')).toBeInTheDocument();
  });
});
