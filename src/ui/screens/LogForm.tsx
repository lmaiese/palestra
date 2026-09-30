import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { getSession, plan, weekForDate } from '../../domain/plan';
import { canonicalExerciseId, exerciseDisplayName } from '../../domain/exercises';
import { lastLoad, sessionFromPlan, suggestedRef } from '../../domain/stats';
import { validateSession } from '../../domain/validation';
import type { DayId, WorkoutSession, WorkoutSessionInput } from '../../domain/types';
import { useSessions, useToday } from '../app/data';
import { useToast } from '../app/toast';
import { href, navigate, setNavigationBlocker, useQuery } from '../lib/router';
import { kg, load, parseDecimal, shortDate } from '../lib/format';
import { italianError } from '../lib/errors';
import { setsInPrescription } from '../lib/prescription';
import { draftKey, readJson, removeKey, writeJson } from '../lib/storage';
import { Plate } from '../components/Plate';
import { StateBlock } from '../components/States';
import { IconBack, IconX } from '../components/Icons';

// ---------- draft model ----------

interface SetDraft {
  key: number;
  kg: string;
  reps: string;
  rpe: string;
}
interface ExDraft {
  key: number;
  exerciseId: string;
  name: string;
  notes: string;
  sets: SetDraft[];
}
interface Draft {
  date: string;
  week: number | null;
  day: DayId | null;
  exercises: ExDraft[];
  conditioning: string;
  notes: string;
}
interface StoredDraft {
  draft: Draft;
  autoRef: boolean;
}

let seq = 0;
const nextKey = () => ++seq;

const emptySet = (kgValue = ''): SetDraft => ({ key: nextKey(), kg: kgValue, reps: '', rpe: '' });

function numStr(n: number | null): string {
  return n == null ? '' : kg(n);
}

function exercisesFromPlan(week: number | null, day: DayId | null, date: string): ExDraft[] {
  if (week == null || day == null) return [];
  const planned = getSession(week, day);
  return sessionFromPlan(week, day, date).exercises.map((e) => {
    const rx = planned?.exercises.find((p) => p.exerciseId === e.exerciseId)?.prescription ?? '';
    return {
      key: nextKey(),
      exerciseId: e.exerciseId,
      name: e.name,
      notes: e.notes,
      sets: Array.from({ length: setsInPrescription(rx) }, () => emptySet()),
    };
  });
}

function draftFromSession(s: WorkoutSession): Draft {
  return {
    date: s.date,
    week: s.week,
    day: s.day,
    conditioning: s.conditioning,
    notes: s.notes,
    exercises: s.exercises.map((e) => ({
      key: nextKey(),
      exerciseId: e.exerciseId,
      name: e.name,
      notes: e.notes,
      sets: e.sets.map((st) => ({
        key: nextKey(),
        // Bodyweight sets are stored as 0 kg and edited as an empty kg field.
        kg: st.weightKg === 0 && st.reps != null ? '' : numStr(st.weightKg),
        reps: numStr(st.reps),
        rpe: numStr(st.rpe),
      })),
    })),
  };
}


function hasData(d: Draft): boolean {
  return (
    d.conditioning.trim() !== '' ||
    d.notes.trim() !== '' ||
    d.exercises.some((e) => e.sets.some((s) => s.kg.trim() || s.reps.trim() || s.rpe.trim()))
  );
}

type FieldErrors = Record<number, { kg?: string; reps?: string; rpe?: string }>;

/** Draft → input. Blank set rows and exercises without sets are dropped; empty kg + reps = bodyweight. */
function toInput(d: Draft): { input: WorkoutSessionInput; fieldErrors: FieldErrors } {
  const fieldErrors: FieldErrors = {};
  const exercises = d.exercises
    .map((e) => {
      const sets = e.sets
        .filter((s) => s.kg.trim() || s.reps.trim() || s.rpe.trim())
        .map((s) => {
          const w = parseDecimal(s.kg);
          const r = parseDecimal(s.reps);
          const p = parseDecimal(s.rpe);
          const errs: FieldErrors[number] = {};
          if (w === null && r === null) errs.kg = 'Inserisci i kg, o le ripetizioni se è a corpo libero';
          else if (w !== null && (Number.isNaN(w) || w < 0 || w > 500)) errs.kg = 'Kg tra 0 e 500';
          if (r !== null && (Number.isNaN(r) || !Number.isInteger(r) || r < 0 || r > 100)) errs.reps = 'Ripetizioni intere 0–100';
          else if (w === 0 && r === 0) errs.reps = 'A corpo libero servono almeno 1 ripetizione';
          if (p !== null && (Number.isNaN(p) || p < 1 || p > 10)) errs.rpe = 'RPE tra 1 e 10';
          if (errs.kg || errs.reps || errs.rpe) fieldErrors[s.key] = errs;
          return { weightKg: w ?? 0, reps: r, rpe: p };
        });
      return { exerciseId: e.exerciseId, name: e.name.trim(), notes: e.notes.trim(), sets };
    })
    .filter((e) => e.sets.length > 0);
  return {
    input: {
      date: d.date,
      week: d.week,
      day: d.day,
      exercises,
      conditioning: d.conditioning.trim(),
      notes: d.notes.trim(),
    },
    fieldErrors,
  };
}

function stripKeys(d: Draft) {
  return {
    ...d,
    exercises: d.exercises.map((e) => ({ ...e, key: 0, sets: e.sets.map((s) => ({ ...s, key: 0 })) })),
  };
}

/** Restored keys must not collide with new ones. */
function adoptKeys(d: Draft) {
  for (const e of d.exercises) {
    seq = Math.max(seq, e.key);
    for (const s of e.sets) seq = Math.max(seq, s.key);
  }
}

// ---------- screen ----------

export function LogForm({ editId }: { editId?: string }) {
  const { state } = useSessions();
  const today = useToday();
  const query = useQuery();

  if (editId) {
    const existing = state.sessions.find((s) => s.id === editId);
    if (!existing && state.status === 'loading') {
      return (
        <FormFrame title="Modifica seduta">
          <StateBlock kind="loading" title="Carico la seduta" />
        </FormFrame>
      );
    }
    if (!existing) {
      return (
        <FormFrame title="Modifica seduta">
          <StateBlock
            kind={state.status === 'error' ? 'error' : 'empty'}
            title="Seduta non trovata"
            detail={state.status === 'error' ? state.error : 'Forse è stata eliminata.'}
            action={{ label: 'Vai allo storico', href: href('/storico') }}
          />
        </FormFrame>
      );
    }
    return <FormBody key={editId} editId={editId} fresh={draftFromSession(existing)} autoRef={false} />;
  }

  const qw = Number(query.get('w'));
  const qd = query.get('d');
  const fromQuery = qw >= 1 && qw <= 8 && (qd === 'A' || qd === 'B' || qd === 'C');
  // Off days (weekend included) propose the first session still missing this week: wait for the data.
  if (!fromQuery && state.status === 'loading') {
    return (
      <FormFrame title="Registra">
        <StateBlock kind="loading" title="Carico gli allenamenti" />
      </FormFrame>
    );
  }
  const ref = fromQuery ? { week: qw, day: qd as DayId } : suggestedRef(state.sessions, today);
  const fresh: Draft = {
    date: today,
    ...ref,
    exercises: exercisesFromPlan(ref.week, ref.day, today),
    conditioning: '',
    notes: '',
  };
  return <FormBody key={`new-${ref.week}-${ref.day}`} fresh={fresh} autoRef={!fromQuery} />;
}

function FormFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="page page-log">
      <header className="page-head">
        <h1 className="page-title">{title}</h1>
      </header>
      {children}
    </div>
  );
}

function FormBody({ fresh, editId, autoRef: autoRefInit }: { fresh: Draft; editId?: string; autoRef: boolean }) {
  const { state, save } = useSessions();
  const today = useToday();
  const toast = useToast();
  const storageKey = draftKey(editId);
  const [restored] = useState<StoredDraft | null>(() => {
    const s = readJson<StoredDraft>(storageKey);
    if (!s || !s.draft || !Array.isArray(s.draft.exercises)) return null;
    adoptKeys(s.draft);
    return s;
  });
  const [draft, setDraft] = useState<Draft>(() => restored?.draft ?? fresh);
  const [autoRef, setAutoRef] = useState(restored?.autoRef ?? autoRefInit);
  const [showRestored, setShowRestored] = useState(!!restored);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [extraName, setExtraName] = useState('');
  const [freshJson] = useState(() => JSON.stringify(stripKeys(fresh)));
  const errorRef = useRef<HTMLDivElement>(null);
  const saved = useRef(false);
  const uid = useId();

  const dirty = JSON.stringify(stripKeys(draft)) !== freshJson;

  // Unsaved-changes guard.
  useEffect(() => {
    if (!dirty) {
      setNavigationBlocker(null);
      return;
    }
    setNavigationBlocker(() => window.confirm('Hai modifiche non salvate. Uscire senza salvare?'));
    const onUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onUnload);
    return () => {
      setNavigationBlocker(null);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [dirty]);

  // Draft persistence (debounced). A reload or a phone lock does not lose the sets.
  useEffect(() => {
    const t = setTimeout(() => {
      if (saved.current) return;
      if (dirty) writeJson(storageKey, { draft, autoRef } satisfies StoredDraft);
      else removeKey(storageKey);
    }, 400);
    return () => clearTimeout(t);
  }, [draft, autoRef, dirty, storageKey]);

  const planSession = draft.week != null && draft.day != null ? getSession(draft.week, draft.day) : undefined;
  const planConditioning = planSession?.exercises.find((e) => e.block === 'Conditioning');

  const duplicate = useMemo(
    () =>
      draft.day == null
        ? undefined
        : state.sessions.find((s) => s.id !== editId && s.date === draft.date && s.day === draft.day),
    [state.sessions, draft.date, draft.day, editId],
  );

  const update = (fn: (d: Draft) => Draft) => setDraft((d) => fn(d));

  const setRef = (week: number | null, day: DayId | null, manual: boolean) => {
    if (manual) setAutoRef(false);
    update((d) => {
      const next = { ...d, week, day };
      if (!hasData(d) && (week !== d.week || day !== d.day)) next.exercises = exercisesFromPlan(week, day, d.date);
      return next;
    });
  };

  const onDate = (date: string) => {
    update((d) => ({ ...d, date }));
    if (autoRef && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const r = suggestedRef(state.sessions, date);
      setRef(r.week, r.day, false);
    }
  };

  const setExercise = (key: number, fn: (e: ExDraft) => ExDraft) =>
    update((d) => ({ ...d, exercises: d.exercises.map((e) => (e.key === key ? fn(e) : e)) }));

  const removeExercise = (ex: ExDraft) => {
    let index = -1;
    update((d) => {
      index = d.exercises.findIndex((e) => e.key === ex.key);
      return { ...d, exercises: d.exercises.filter((e) => e.key !== ex.key) };
    });
    toast(`${ex.name} rimosso`, {
      label: 'Annulla',
      onClick: () =>
        update((d) => {
          if (d.exercises.some((e) => e.key === ex.key)) return d;
          const list = [...d.exercises];
          list.splice(index < 0 ? list.length : Math.min(index, list.length), 0, ex);
          return { ...d, exercises: list };
        }),
    });
  };

  const addExtra = () => {
    const name = extraName.trim();
    if (!name) return;
    const exerciseId = canonicalExerciseId(name);
    if (!exerciseId) return;
    update((d) => ({ ...d, exercises: [...d.exercises, { key: nextKey(), exerciseId, name, notes: '', sets: [emptySet()] }] }));
    setExtraName('');
  };

  const discardDraft = () => {
    removeKey(storageKey);
    setDraft(fresh);
    setAutoRef(autoRefInit);
    setShowRestored(false);
    setErrors([]);
    setFieldErrors({});
  };

  const counts = useMemo(() => {
    const { input } = toInput(draft);
    return { ex: input.exercises.length, sets: input.exercises.reduce((n, e) => n + e.sets.length, 0) };
  }, [draft]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const { input, fieldErrors: fe } = toInput(draft);
    setFieldErrors(fe);
    const errs = Object.keys(fe).length ? ['Correggi i campi segnati in rosso.'] : validateSession(input);
    if (input.exercises.length === 0 && !input.conditioning && errs.length === 0) {
      errs.push('Inserisci almeno un carico, oppure il conditioning.');
    }
    setErrors(errs);
    if (errs.length) {
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    setSaving(true);
    try {
      const id = await save(input, editId);
      saved.current = true;
      removeKey(storageKey);
      setNavigationBlocker(null);
      toast(editId ? 'Modifiche salvate' : 'Seduta salvata');
      navigate(`/storico/${id}`, { force: true });
    } catch (err) {
      const list = (err as { errors?: unknown }).errors;
      setErrors(
        Array.isArray(list) && list.length
          ? (list as string[])
          : [`Salvataggio non riuscito. ${italianError(err)}`],
      );
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      setSaving(false);
    }
  };

  const knownNames = useMemo(() => {
    const set = new Set<string>();
    plan.weeks.forEach((w) =>
      w.sessions.forEach((s) =>
        s.exercises.forEach((e) => e.block !== 'Conditioning' && set.add(exerciseDisplayName(e.exerciseId))),
      ),
    );
    return [...set].sort();
  }, []);

  return (
    <div className="page page-log">
      <header className="page-head">
        {editId && (
          <a className="back" href={href(`/storico/${editId}`)}>
            <IconBack width={20} height={20} />
            Seduta
          </a>
        )}
        <h1 className="page-title">{editId ? 'Modifica seduta' : 'Registra'}</h1>
      </header>

      {showRestored && (
        <div className="notice" role="status">
          <p>
            <b>Bozza ripristinata</b>
          </p>
          <button type="button" className="btn btn-quiet btn-sm" onClick={discardDraft}>
            Scarta bozza
          </button>
        </div>
      )}

      <form className="logform" onSubmit={onSubmit} noValidate aria-describedby={errors.length ? `${uid}-errors` : undefined}>
        <fieldset className="refbox">
          <legend className="sr-only">Data e riferimento al piano</legend>
          <div className="field">
            <label htmlFor={`${uid}-date`}>Data</label>
            <input
              id={`${uid}-date`}
              type="date"
              className="input"
              value={draft.date}
              required
              onChange={(e) => onDate(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor={`${uid}-week`}>Settimana</label>
            <select
              id={`${uid}-week`}
              className="input"
              value={draft.week ?? ''}
              onChange={(e) => {
                const w = e.target.value ? Number(e.target.value) : null;
                setRef(w, w == null ? null : (draft.day ?? 'A'), true);
              }}
            >
              <option value="">Fuori piano</option>
              {plan.weeks.map((w) => (
                <option key={w.number} value={w.number}>
                  {w.number}, {w.theme}
                </option>
              ))}
            </select>
          </div>
          <div className="field field-wide" role="radiogroup" aria-labelledby={`${uid}-daylabel`}>
            <span id={`${uid}-daylabel`} className="label">
              Seduta
            </span>
            <div className="seg">
              {(['A', 'B', 'C'] as DayId[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={draft.day === d}
                  className="seg-btn"
                  onClick={() => setRef(draft.week ?? weekForDate(draft.date) ?? 1, d, true)}
                >
                  {d}
                </button>
              ))}
              <button
                type="button"
                role="radio"
                aria-checked={draft.day == null}
                className="seg-btn seg-wide"
                onClick={() => setRef(null, null, true)}
              >
                Extra
              </button>
            </div>
          </div>
          <p className="refnote">
            {planSession
              ? `${draft.day}, ${planSession.title}`
              : 'Allenamento fuori piano: aggiungi gli esercizi a mano.'}
          </p>
          {duplicate && (
            <div className="dupwarn" role="note">
              <p>
                Hai già registrato {duplicate.day} {duplicate.date === today ? 'oggi' : `il ${shortDate(duplicate.date)}`}.
              </p>
              <a className="link" href={href(`/registra/${duplicate.id}`)}>
                Modifica quella seduta
              </a>
            </div>
          )}
        </fieldset>

        {draft.exercises.length === 0 && (
          <StateBlock kind="empty" title="Nessun esercizio" detail="Aggiungi un esercizio qui sotto, oppure scegli una seduta A, B o C." />
        )}

        <ol className="logex-list">
          {draft.exercises.map((ex) => (
            <ExerciseEditor
              key={ex.key}
              ex={ex}
              date={draft.date}
              sessions={state.sessions}
              prescription={planSession?.exercises.find((p) => p.exerciseId === ex.exerciseId)}
              fieldErrors={fieldErrors}
              onChange={(fn) => setExercise(ex.key, fn)}
              onRemove={() => removeExercise(ex)}
            />
          ))}
        </ol>

        <div className="addex">
          <label htmlFor={`${uid}-extra`}>Aggiungi esercizio</label>
          <div className="addex-row">
            <input
              id={`${uid}-extra`}
              className="input"
              list={`${uid}-names`}
              value={extraName}
              placeholder="Nome, es. Front Squat"
              autoComplete="off"
              onChange={(e) => setExtraName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addExtra();
                }
              }}
            />
            <button type="button" className="btn btn-quiet" onClick={addExtra} disabled={!extraName.trim()}>
              Aggiungi
            </button>
          </div>
          <datalist id={`${uid}-names`}>
            {knownNames.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </div>

        <div className="field">
          <label htmlFor={`${uid}-cond`}>Conditioning</label>
          <textarea
            id={`${uid}-cond`}
            className="input textarea"
            rows={2}
            value={draft.conditioning}
            placeholder={planConditioning ? `Da piano: ${planConditioning.name}` : 'Es. 5 × 250 m row'}
            onChange={(e) => update((d) => ({ ...d, conditioning: e.target.value }))}
          />
        </div>
        <div className="field">
          <label htmlFor={`${uid}-notes`}>Note</label>
          <textarea
            id={`${uid}-notes`}
            className="input textarea"
            rows={3}
            value={draft.notes}
            placeholder="Sensazioni, dolori, com’era la sabbia"
            onChange={(e) => update((d) => ({ ...d, notes: e.target.value }))}
          />
        </div>

        <div className="savebar">
          {errors.length > 0 && (
            <div id={`${uid}-errors`} className="errbox" role="alert" tabIndex={-1} ref={errorRef}>
              <p className="errbox-title">Non posso salvare</p>
              <ul>
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="savebar-row">
            <p className="savebar-count" aria-live="polite">
              <b>{counts.ex}</b> esercizi, <b>{counts.sets}</b> set
            </p>
            <button type="submit" className="btn btn-primary btn-xl savebar-btn" disabled={saving}>
              {saving ? 'Salvo…' : editId ? 'Salva modifiche' : 'Salva seduta'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

interface EditorProps {
  ex: ExDraft;
  date: string;
  sessions: WorkoutSession[];
  prescription?: { prescription: string; rest: string; isAnchor: boolean; notes: string };
  fieldErrors: FieldErrors;
  onChange: (fn: (e: ExDraft) => ExDraft) => void;
  onRemove: () => void;
}

function ExerciseEditor({ ex, date, sessions, prescription, fieldErrors, onChange, onRemove }: EditorProps) {
  const last = lastLoad(sessions, ex.exerciseId, date);
  const anchor = plan.anchors.includes(ex.exerciseId);
  const headId = useId();
  const emptyIndex = ex.sets.findIndex((s) => !s.kg.trim());

  const setField = (key: number, field: 'kg' | 'reps' | 'rpe', value: string) =>
    onChange((e) => ({ ...e, sets: e.sets.map((s) => (s.key === key ? { ...s, [field]: value } : s)) }));

  const useLast = () => {
    if (!last) return;
    onChange((e) => {
      const i = e.sets.findIndex((s) => !s.kg.trim());
      if (i < 0) return { ...e, sets: [...e.sets, emptySet(kg(last.kg))] };
      return { ...e, sets: e.sets.map((s, j) => (j === i ? { ...s, kg: kg(last.kg) } : s)) };
    });
  };

  return (
    <li className={`logex${anchor ? ' logex-anchor' : ''}`} aria-labelledby={headId}>
      <div className="logex-head">
        <h2 id={headId} className="logex-name">
          {anchor && <Plate exerciseId={ex.exerciseId} size={18} />}
          {ex.name}
        </h2>
        <button type="button" className="btn-text" onClick={onRemove} aria-label={`Rimuovi ${ex.name}`}>
          Rimuovi
        </button>
      </div>
      <p className="logex-meta">
        {prescription?.prescription ? <span className="logex-rx">{prescription.prescription}</span> : <span>extra</span>}
        {prescription?.rest && <span>rec. {prescription.rest}</span>}
        {!last && <span>prima volta</span>}
      </p>
      {last && (
      <div className="logex-last">
        {(
          <>
            <span>
              ultima volta <b>{load(last.kg)}</b>
              {last.bodyweight && last.reps != null ? ` × ${last.reps}` : ''} · {shortDate(last.date)}
            </span>
            {last.kg > 0 && emptyIndex >= 0 && (
              <button
                type="button"
                className="chip-fill"
                onClick={useLast}
                aria-label={`Usa ${kg(last.kg)} kg nel set ${emptyIndex + 1} di ${ex.name}`}
              >
                = {kg(last.kg)} kg
              </button>
            )}
          </>
        )}
      </div>
      )}

      <div className="sets" role="group" aria-label={`Set di ${ex.name}`}>
        {ex.sets.map((s, i) => {
          const fe = fieldErrors[s.key] ?? {};
          const n = i + 1;
          const errId = `${headId}-e${s.key}`;
          const hasErr = !!(fe.kg || fe.reps || fe.rpe);
          return (
            <div key={s.key} className="setrow">
              <span className="setrow-n" aria-hidden="true">
                {n}
              </span>
              <input
                className={`input input-kg${fe.kg ? ' is-invalid' : ''}`}
                inputMode="decimal"
                enterKeyHint="next"
                autoComplete="off"
                aria-label={`${ex.name}, set ${n}, kg`}
                aria-invalid={fe.kg ? true : undefined}
                aria-describedby={hasErr ? errId : undefined}
                value={s.kg}
                placeholder="kg"
                onChange={(e) => setField(s.key, 'kg', e.target.value)}
              />
              <input
                className={`input input-num${fe.reps ? ' is-invalid' : ''}`}
                inputMode="numeric"
                autoComplete="off"
                aria-label={`${ex.name}, set ${n}, ripetizioni`}
                aria-invalid={fe.reps ? true : undefined}
                value={s.reps}
                placeholder="rep"
                onChange={(e) => setField(s.key, 'reps', e.target.value)}
              />
              <input
                className={`input input-num${fe.rpe ? ' is-invalid' : ''}`}
                inputMode="decimal"
                autoComplete="off"
                aria-label={`${ex.name}, set ${n}, RPE`}
                aria-invalid={fe.rpe ? true : undefined}
                value={s.rpe}
                placeholder="rpe"
                onChange={(e) => setField(s.key, 'rpe', e.target.value)}
              />
              <button
                type="button"
                className="icon-btn icon-btn-sm"
                aria-label={`Rimuovi set ${n} di ${ex.name}`}
                onClick={() => onChange((e) => ({ ...e, sets: e.sets.filter((x) => x.key !== s.key) }))}
              >
                <IconX width={18} height={18} />
              </button>
              {hasErr && (
                <p id={errId} className="setrow-err">
                  {[fe.kg, fe.reps, fe.rpe].filter(Boolean).join('. ')}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <button
        type="button"
        className="btn-text addset"
        onClick={() => onChange((e) => ({ ...e, sets: [...e.sets, emptySet(e.sets[e.sets.length - 1]?.kg ?? '')] }))}
        disabled={ex.sets.length >= 20}
      >
        + Aggiungi set
      </button>
    </li>
  );
}
