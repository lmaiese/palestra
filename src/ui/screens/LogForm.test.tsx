// DoD F5 (register / edit), F6 (last load in the form), UI3 (numeric inputs and labels).
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderApp } from '../test-utils';

function exerciseCard(name: RegExp) {
  return screen.getByRole('listitem', { name });
}

describe('Registra', () => {
  it('defaults to today and derives week and session from the date, with plan exercises prefilled', async () => {
    renderApp({ path: '/registra', today: '2026-10-05' });
    expect(screen.getByLabelText('Data')).toHaveValue('2026-10-05');
    expect(screen.getByLabelText('Settimana')).toHaveValue('2');
    expect(screen.getByRole('radio', { name: 'A' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText(/A, Lower Power: dedotta dalla data/)).toBeInTheDocument();

    const squat = exerciseCard(/^Back Squat$/);
    expect(squat).toHaveTextContent('1x5 @RPE 7.5 + 4x5 @-10%');
    // F6: last load before this date.
    expect(await within(squat).findByText(/ultima volta/)).toHaveTextContent('ultima volta 70 kg · 28/09');
    // Conditioning rows are not exercises to load.
    expect(screen.queryByRole('listitem', { name: /200m row/ })).not.toBeInTheDocument();
  });

  it('UI3: every input is labelled and loads use a decimal keypad', () => {
    renderApp({ path: '/registra', today: '2026-10-05' });
    const inputs = document.querySelectorAll('input, select, textarea');
    expect(inputs.length).toBeGreaterThan(10);
    inputs.forEach((el) => expect(el).toHaveAccessibleName());
    const kgInputs = screen.getAllByRole('textbox', { name: /, kg$/ });
    expect(kgInputs.length).toBeGreaterThan(3);
    kgInputs.forEach((el) => expect(el).toHaveAttribute('inputmode', 'decimal'));
    screen.getAllByRole('textbox', { name: /RPE$/ }).forEach((el) => expect(el).toHaveAttribute('inputmode', 'decimal'));
  });

  it('changing the date re-derives the session; off-plan days become Extra', async () => {
    renderApp({ path: '/registra', today: '2026-10-05' });
    const date = screen.getByLabelText('Data');
    await userEvent.clear(date);
    await userEvent.type(date, '2026-10-07');
    expect(screen.getByLabelText('Settimana')).toHaveValue('');
    expect(screen.getByRole('radio', { name: 'Extra' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('Nessun esercizio')).toBeInTheDocument();
    await userEvent.clear(date);
    await userEvent.type(date, '2026-10-09');
    expect(screen.getByRole('radio', { name: 'C' })).toHaveAttribute('aria-checked', 'true');
    expect(exerciseCard(/^Deadlift$/)).toBeInTheDocument();
  });

  it('saves kg with optional reps and RPE, set copy, set/exercise removal, extra exercise, notes', async () => {
    const user = userEvent.setup();
    const { repo } = renderApp({ path: '/registra', today: '2026-10-05' });
    const save = vi.spyOn(repo, 'save');

    await user.type(screen.getByRole('textbox', { name: 'Back Squat, set 1, kg' }), '77,5');
    await user.type(screen.getByRole('textbox', { name: 'Back Squat, set 1, ripetizioni' }), '5');
    await user.type(screen.getByRole('textbox', { name: 'Back Squat, set 1, RPE' }), '7.5');
    const squat = exerciseCard(/^Back Squat$/);
    await user.click(within(squat).getByRole('button', { name: 'Aggiungi set' }));
    expect(screen.getByRole('textbox', { name: 'Back Squat, set 2, kg' })).toHaveValue('77,5');
    await user.click(within(squat).getByRole('button', { name: 'Aggiungi set' }));
    await user.click(screen.getByRole('button', { name: 'Rimuovi set 3 di Back Squat' }));
    expect(screen.queryByRole('textbox', { name: 'Back Squat, set 3, kg' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Rimuovi Approach Jump' }));
    expect(screen.queryByRole('listitem', { name: /^Approach Jump$/ })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Aggiungi esercizio'), 'Goblet Squat DB');
    await user.click(screen.getByRole('button', { name: 'Aggiungi' }));
    await user.type(screen.getByRole('textbox', { name: 'Goblet Squat DB, set 1, kg' }), '20');

    await user.type(screen.getByLabelText('Conditioning'), '5 × 200 m row');
    await user.type(screen.getByLabelText('Note'), 'Buone gambe');
    await user.click(screen.getByRole('button', { name: 'Salva seduta' }));

    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    const [input, id] = save.mock.calls[0];
    expect(id).toBeUndefined();
    expect(input).toMatchObject({ date: '2026-10-05', week: 2, day: 'A', conditioning: '5 × 200 m row', notes: 'Buone gambe' });
    // Exercises without loads are dropped; the extra one gets a canonical id.
    expect(input.exercises).toEqual([
      { exerciseId: 'back-squat', name: 'Back Squat', notes: '', sets: [{ weightKg: 77.5, reps: 5, rpe: 7.5 }, { weightKg: 77.5, reps: null, rpe: null }] },
      { exerciseId: 'goblet-squat', name: 'Goblet Squat DB', notes: '', sets: [{ weightKg: 20, reps: null, rpe: null }] },
    ]);
    expect(await screen.findByText('Seduta salvata')).toBeInTheDocument();
    expect(window.location.hash).toBe('#/storico/2026-10-05-w2-A');
    expect(await screen.findByRole('heading', { level: 1, name: 'Lower Power' })).toBeInTheDocument();
  });

  it('shows Italian errors inline and does not save invalid input', async () => {
    const user = userEvent.setup();
    const { repo } = renderApp({ path: '/registra', today: '2026-10-05' });
    const save = vi.spyOn(repo, 'save');
    await user.type(screen.getByRole('textbox', { name: 'Back Squat, set 1, ripetizioni' }), '5');
    await user.type(screen.getByRole('textbox', { name: 'Front Squat, set 1, kg' }), '900');
    await user.click(screen.getByRole('button', { name: 'Salva seduta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Correggi i campi segnati in rosso.');
    expect(screen.getByText('Inserisci i kg')).toBeInTheDocument();
    expect(screen.getByText('Kg tra 0 e 500')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Back Squat, set 1, kg' })).toHaveAttribute('aria-invalid', 'true');
    expect(save).not.toHaveBeenCalled();
  });

  it('requires at least one load or the conditioning', async () => {
    renderApp({ path: '/registra', today: '2026-10-05' });
    await userEvent.click(screen.getByRole('button', { name: 'Salva seduta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Inserisci almeno un carico, oppure il conditioning.');
  });

  it('edits an existing session in place', async () => {
    const user = userEvent.setup();
    const { repo } = renderApp({ path: '/registra/2026-09-28-w1-A', today: '2026-10-05' });
    const save = vi.spyOn(repo, 'save');
    const kgBox = await screen.findByRole('textbox', { name: 'Back Squat, set 1, kg' });
    expect(kgBox).toHaveValue('70');
    expect(screen.getByRole('textbox', { name: 'Back Squat, set 1, RPE' })).toHaveValue('7');
    expect(screen.getByLabelText('Data')).toHaveValue('2026-09-28');
    await user.clear(kgBox);
    await user.type(kgBox, '72.5');
    await user.click(screen.getByRole('button', { name: 'Salva modifiche' }));
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(save.mock.calls[0][1]).toBe('2026-09-28-w1-A');
    expect(save.mock.calls[0][0].exercises[0].sets[0].weightKg).toBe(72.5);
    expect(await screen.findByText('Modifiche salvate')).toBeInTheDocument();
  });

  it('guards unsaved changes when leaving', async () => {
    const user = userEvent.setup();
    renderApp({ path: '/registra', today: '2026-10-05' });
    await user.type(screen.getByRole('textbox', { name: 'Back Squat, set 1, kg' }), '80');
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    window.location.hash = '#/storico';
    await waitFor(() => expect(confirm).toHaveBeenCalled());
    await waitFor(() => expect(window.location.hash).toBe('#/registra'));
    expect(screen.getByRole('textbox', { name: 'Back Squat, set 1, kg' })).toHaveValue('80');
    confirm.mockReturnValue(true);
    window.location.hash = '#/storico';
    expect(await screen.findByRole('heading', { level: 1, name: 'Storico' })).toBeInTheDocument();
    confirm.mockRestore();
  });
});
