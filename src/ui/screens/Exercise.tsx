import { useMemo } from 'react';
import { exerciseDisplayName } from '../../domain/exercises';
import { exerciseHistory, personalBest } from '../../domain/stats';
import { plan } from '../../domain/plan';
import { useSessions } from '../app/data';
import { href } from '../lib/router';
import { dayMonth, kg, shortDate } from '../lib/format';
import { setLabel } from '../lib/summary';
import { techniqueFor } from '../lib/technique';
import { Plate } from '../components/Plate';
import { plateVar } from '../lib/plates';
import { Kg } from '../components/Kg';
import { LoadChart } from '../components/LoadChart';
import { StateBlock } from '../components/States';
import { IconBack } from '../components/Icons';

export function ExerciseScreen({ exerciseId }: { exerciseId: string }) {
  const { state, retry } = useSessions();
  const history = useMemo(() => exerciseHistory(state.sessions, exerciseId), [state.sessions, exerciseId]);
  const best = useMemo(() => personalBest(state.sessions, exerciseId), [state.sessions, exerciseId]);
  const anchor = plan.anchors.includes(exerciseId);
  const tech = techniqueFor(exerciseId);
  const loggedName = state.sessions.flatMap((s) => s.exercises).find((e) => e.exerciseId === exerciseId)?.name;
  const name = exerciseDisplayName(exerciseId) || loggedName || exerciseId;
  const first = history[0];
  const last = history[history.length - 1];
  const delta = first && last && history.length > 1 ? last.topKg - first.topKg : null;

  return (
    <div className="page page-exercise">
      <header className="page-head">
        <a className="back" href={href('/storico')}>
          <IconBack width={20} height={20} />
          Storico
        </a>
        <h1 className="page-title ex-title">
          {anchor && <Plate exerciseId={exerciseId} size={30} />}
          {name}
        </h1>
        {anchor && <p className="page-sub">Anchor del ciclo</p>}
      </header>

      {state.status === 'loading' && history.length === 0 && <StateBlock kind="loading" title="Carico lo storico" />}
      {state.status === 'error' && (
        <StateBlock kind="error" title="Non riesco a leggere lo storico" detail={state.error} action={{ label: 'Riprova', onClick: retry }} />
      )}

      {state.status !== 'loading' && history.length === 0 && state.status !== 'error' && (
        <StateBlock
          kind="empty"
          title="Nessun carico registrato"
          detail={`Quando registri ${name}, qui vedi l’andamento del carico massimo.`}
          action={{ label: 'Registra allenamento', href: href('/registra') }}
        />
      )}

      {history.length > 0 && (
        <>
          <dl className="stats3">
            <div className="stat stat-pr">
              <dt>Record</dt>
              <dd>
                <Kg value={best?.kg ?? null} size="xl" />
                {best && <span className="stat-sub">{dayMonth(best.date)}</span>}
              </dd>
            </div>
            <div className="stat">
              <dt>Ultima</dt>
              <dd>
                <Kg value={last.topKg} size="md" />
                <span className="stat-sub">{dayMonth(last.date)}</span>
              </dd>
            </div>
            <div className="stat">
              <dt>Sedute</dt>
              <dd>
                <span className="kg kg-md">
                  <span className="kg-n">{history.length}</span>
                </span>
                {delta != null && (
                  <span className="stat-sub">
                    {delta >= 0 ? '+' : '−'}
                    {kg(Math.abs(delta))} kg dal via
                  </span>
                )}
              </dd>
            </div>
          </dl>

          <section className="block" aria-labelledby="h-chart">
            <h2 id="h-chart" className="block-title">
              Carico massimo per seduta
            </h2>
            <LoadChart points={history} color={anchor ? plateVar(exerciseId) : 'var(--chalk)'} prKg={best?.kg ?? null} label={`${name}, carico massimo`} />
          </section>

          <section className="block" aria-labelledby="h-table">
            <h2 id="h-table" className="block-title">
              Tutte le sedute
            </h2>
            <table className="table table-hist">
              <thead>
                <tr>
                  <th scope="col">Data</th>
                  <th scope="col">Top</th>
                  <th scope="col">Set</th>
                </tr>
              </thead>
              <tbody>
                {[...history].reverse().map((h) => (
                  <tr key={h.sessionId}>
                    <th scope="row">
                      <a className="link" href={href(`/storico/${h.sessionId}`)}>
                        {shortDate(h.date)}
                      </a>
                    </th>
                    <td className="num">
                      <b>{kg(h.topKg)}</b>
                      {best && h.topKg === best.kg && h.date === best.date && <span className="badge-pr badge-sm">PR</span>}
                    </td>
                    <td className="sets-cell">{h.sets.map((s) => setLabel(s, kg)).join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}

      {tech && (
        <section className="block rule-card" aria-labelledby="h-tech">
          <h2 id="h-tech" className="block-title">
            Tecnica
          </h2>
          <p>{tech.cue}</p>
        </section>
      )}
    </div>
  );
}
