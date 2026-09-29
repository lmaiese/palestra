// DoD F5 (register / edit), F6 (last load in the form), UI3 (numeric inputs and labels), UI6.
import { screen, within, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { seedSessions } from '../../domain/seed';
import { renderApp, renderStatic } from '../test-utils';
import { setsInPrescription } from '../lib/prescription';

function exerciseCard(name: RegExp) {
  return screen.getByRole('listitem', { name });
}

beforeEach(() => window.localStorage.clear());
afterEach(() => window.localStorage.clear());

describe('setsInPrescription', () => {
  it.each([
    ['3x6', 3],
    ['1x5 @RPE 7 + 3x5 @-10%', 4],
    ['1x5 @RPE 7.5 + 4x5 @-10%', 5],
    ['3-4x5 @-10%', 3],
    ['3x12 + 3x20', 6],
    ['3 singole progressive → 1x3 max', 4],
    ['1 serie a esaurimento pulito', 1],
    ['3x30"/lato', 3],
    ['', 1],
  ])('%s → %i', (rx, n) => expect(setsInPrescription(rx)).toBe(n));
});

describe('Registra', () => {
  it('defaults to today, derives week and session, prefills plan exercises with one row per prescribed set', async () => {
    renderApp({ path: '/registra', today: '2026-10-05' });
    expect(screen.getByLabelText('Data')).toHaveValue('2026-10-05');
    expect(screen.getByLabelText('Settimana')).toHaveValue('2');
    expect(screen.getByRole('radio', { name: 'A' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText(/A, Lower Power: dedotta dalla data/)).toBeInTheDocument();

    const squat = exerciseCard(/^Back Squat$/);
    expect(squat).toHaveTextContent('1x5 @RPE 7.5 + 4x5 @-10%');
    expect(within(squat).getAllByRole('textbox', { name: /, kg$/ })).toHaveLength(5);
    expect(within(exerciseCard(/^Front Squat$/)).getAllByRole('textbox', { name: /, kg$/ })).toHaveLength(3);
    // F6: last load before this date.
    expect(await within(squat).findByText(/ultima volta/)).toHaveTextContent('ultima volta 70 kg · 28/09');
    // Conditioning rows are not exercises to load.
    expect(screen.queryByRole('listitem', { name: /200m row/ })).not.toBeInTheDocument();
  });

  it('the last load is a tappable chip, never a ghost value in the field', async () => {
    const user = userEvent.setup();
    renderApp({ path: '/registra', today: '2026-10-05' });
    const squat = exerciseCard(/^Back Squat$/);
    const first = within(squat).getByRole('textbox', { name: 'Back Squat, set 1, kg' });
    expect(first).toHaveAttribute('placeholder', 'kg');
    const chip = await within(squat).findByRole('button', { name: 'Usa 70 kg nel set 1 di Back Squat' });
    expect(chip).toHaveTextContent('= 70 kg');
    await user.click(chip);
    expect(first).toHaveValue('70');
    await user.click(within(squat).getByRole('button', { name: 'Usa 70 kg nel set 2 di Back Squat' }));
    expect(within(squat).getByRole('textbox', { name: 'Back Squat, set 2, kg' })).toHaveValue('70');
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

  it('saves kg, bodyweight sets, set copy, removal with undo, extra exercise and notes', async () => {
    const user = userEvent.setup();
    const { repo } = renderApp({ path: '/registra', today: '2026-10-05' });
    const save = vi.spyOn(repo, 'save');

    await user.type(screen.getByRole('textbox', { name: 'Back Squat, set 1, kg' }), '77,5');
    await user.type(screen.getByRole('textbox', { name: 'Back Squat, set 1, ripetizioni' }), '5');
    await user.type(screen.getByRole('textbox', { name: 'Back Squat, set 1, RPE' }), '7.5');
    const squat = exerciseCard(/^Back Squat$/);
    // Remove the 4 prefilled back-off rows, then add one: it copies the previous kg.
    for (let n = 5; n >= 2; n--) await user.click(screen.getByRole('button', { name: `Rimuovi set ${n} di Back Squat` }));
    await user.click(within(squat).getByRole('button', { name: '+ Aggiungi set' }));
    expect(screen.getByRole('textbox', { name: 'Back Squat, set 2, kg' })).toHaveValue('77,5');

    // Remove an exercise, undo from the toast, remove it again.
    await user.click(screen.getByRole('button', { name: 'Rimuovi Approach Jump' }));
    expect(screen.queryByRole('listitem', { name: /^Approach Jump$/ })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Annulla' }));
    expect(exerciseCard(/^Approach Jump$/)).toBeInTheDocument();
    // Bodyweight: reps without kg.
    await user.type(screen.getByRole('textbox', { name: 'Approach Jump, set 1, ripetizioni' }), '2');

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
      { exerciseId: 'approach-jump', name: 'Approach Jump', notes: '', sets: [{ weightKg: 0, reps: 2, rpe: null }] },
      { exerciseId: 'back-squat', name: 'Back Squat', notes: '', sets: [{ weightKg: 77.5, reps: 5, rpe: 7.5 }, { weightKg: 77.5, reps: null, rpe: null }] },
      { exerciseId: 'goblet-squat', name: 'Goblet Squat DB', notes: '', sets: [{ weightKg: 20, reps: null, rpe: null }] },
    ]);
    expect(await screen.findByText('Seduta salvata')).toBeInTheDocument();
    expect(window.location.hash).toBe('#/storico/2026-10-05-w2-A');
    expect(await screen.findByRole('heading', { level: 1, name: 'Lower Power' })).toBeInTheDocument();
    expect(screen.getByText('corpo libero ×2')).toBeInTheDocument();
  });

  it('shows Italian errors inline and does not save invalid input', async () => {
    const user = userEvent.setup();
    const { repo } = renderApp({ path: '/registra', today: '2026-10-05' });
    const save = vi.spyOn(repo, 'save');
    await user.type(screen.getByRole('textbox', { name: 'Back Squat, set 1, RPE' }), '8');
    await user.type(screen.getByRole('textbox', { name: 'Front Squat, set 1, kg' }), '900');
    await user.click(screen.getByRole('button', { name: 'Salva seduta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Correggi i campi segnati in rosso.');
    expect(screen.getByText('Inserisci i kg, o le ripetizioni se è a corpo libero')).toBeInTheDocument();
    expect(screen.getByText('Kg tra 0 e 500')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Back Squat, set 1, kg' })).toHaveAttribute('aria-invalid', 'true');
    expect(save).not.toHaveBeenCalled();
  });

  it('maps a Firebase failure to Italian, never the raw message', async () => {
    const user = userEvent.setup();
    const { repo } = renderApp({ path: '/registra', today: '2026-10-05' });
    vi.spyOn(repo, 'save').mockRejectedValue(Object.assign(new Error('FirebaseError: [code=permission-denied] trace…'), { code: 'permission-denied' }));
    await user.type(screen.getByRole('textbox', { name: 'Back Squat, set 1, kg' }), '80');
    await user.click(screen.getByRole('button', { name: 'Salva seduta' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Salvataggio non riuscito. Permesso negato');
    expect(alert).not.toHaveTextContent('FirebaseError');
  });

  it('requires at least one load or the conditioning', async () => {
    renderApp({ path: '/registra', today: '2026-10-05' });
    await userEvent.click(screen.getByRole('button', { name: 'Salva seduta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Inserisci almeno un carico, oppure il conditioning.');
  });

  it('warns when the same session is already logged for that date', async () => {
    renderApp({ path: '/registra', today: '2026-09-28' });
    const warn = await screen.findByRole('note');
    expect(warn).toHaveTextContent('Hai già registrato A oggi');
    expect(within(warn).getByRole('link', { name: 'Modifica quella seduta' })).toHaveAttribute('href', '#/registra/2026-09-28-w1-A');
  });

  it('keeps a draft across remounts, restores it with a notice, clears it after save', async () => {
    const user = userEvent.setup();
    const first = renderApp({ path: '/registra', today: '2026-10-05' });
    await user.type(screen.getByRole('textbox', { name: 'Back Squat, set 1, kg' }), '82,5');
    await waitFor(() => expect(window.localStorage.getItem('palestra.draft.new')).toContain('82,5'));
    first.unmount();

    const { repo } = renderApp({ path: '/registra', today: '2026-10-05' });
    expect(screen.getByText(/Bozza ripristinata/)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Back Squat, set 1, kg' })).toHaveValue('82,5');
    const save = vi.spyOn(repo, 'save');
    await user.click(screen.getByRole('button', { name: 'Salva seduta' }));
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    await screen.findByText('Seduta salvata');
    await act(() => new Promise((r) => setTimeout(r, 500)));
    expect(window.localStorage.getItem('palestra.draft.new')).toBeNull();
  });

  it('the draft can be discarded, and broken storage never breaks the form', async () => {
    window.localStorage.setItem('palestra.draft.new', '{not json');
    renderApp({ path: '/registra', today: '2026-10-05' });
    expect(screen.queryByText(/Bozza ripristinata/)).not.toBeInTheDocument();
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded');
    });
    await userEvent.type(screen.getByRole('textbox', { name: 'Back Squat, set 1, kg' }), '1');
    await act(() => new Promise((r) => setTimeout(r, 500)));
    expect(screen.getByRole('textbox', { name: 'Back Squat, set 1, kg' })).toHaveValue('1');
    spy.mockRestore();
  });

  it('edits an existing session in place and follows an id change', async () => {
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
    const returned = await save.mock.results[0].value;
    expect(window.location.hash).toBe(`#/storico/${returned}`);
  });

  it('edit: loading and not-found states', async () => {
    const a = renderStatic({ status: 'loading', sessions: [] }, { path: '/registra/2026-09-28-w1-A' });
    expect(screen.getByText('Carico la seduta')).toBeInTheDocument();
    a.unmount();
    const b = renderApp({ path: '/registra/nope', sessions: seedSessions });
    expect(await screen.findByText('Seduta non trovata')).toBeInTheDocument();
    b.unmount();
    renderStatic({ status: 'error', sessions: [], error: 'Server non raggiungibile.' }, { path: '/registra/x' });
    expect(screen.getByRole('alert')).toHaveTextContent('Server non raggiungibile.');
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
