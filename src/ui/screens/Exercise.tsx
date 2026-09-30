import { useMemo } from 'react';
import { exerciseDisplayName } from '../../domain/exercises';
import { exerciseHistory } from '../../domain/stats';
import { plan } from '../../domain/plan';
import { useSessions } from '../app/data';
import { href } from '../lib/router';
import { dayMonth, kg, shortDate } from '../lib/format';
import { isRecordOn, loadRecord, setLabel } from '../lib/summary';
import { techniqueFor } from '../lib/technique';
import { plateVar } from '../lib/plates';
import { Plate } from '../components/Plate';
import { Kg } from '../components/Kg';
import { LoadChart } from '../components/LoadChart';
import { StateBlock } from '../components/States';
import { IconBack } from '../components/Icons';

export function ExerciseScreen({ exerciseId }: { exerciseId: string }) {
  const { state, retry } = useSessions();
  const history = useMemo(() => exerciseHistory(state.sessions, exerciseId), [state.sessions, exerciseId]);
  const best = useMemo(() => loadRecord(state.sessions, exerciseId), [state.sessions, exerciseId]);
  const anchor = plan.anchors.includes(exerciseId);
  const tech = techniqueFor(exerciseId);
  const loggedName = state.sessions.flatMap((s) => s.exercises).find((e) => e.exerciseId === exerciseId)?.name;
  const name = exerciseDisplayName(exerciseId) || loggedName || exerciseId;
  const first = history[0];
  const last = history[history.length - 1];
  const delta = first && last && history.length > 1 && last.topKg > 0 && first.topKg > 0 ? last.topKg - first.topKg : null;
  const loaded = history.filter((h) => h.topKg > 0);

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
      </header>

      {state.status === 'loading' && history.length === 0 && <StateBlock kind="loading" title="Carico lo storico" />}
      {state.status === 'error' && (
        <StateBlock kind="error" title="Non riesco a leggere lo storico" detail={state.error} action={{ label: 'Riprova', onClick: retry }} />
      )}

      {state.status === 'ready' && history.length === 0 && (
        <StateBlock
          kind="empty"
          title="Nessun carico registrato"
          detail={`Quando registri ${name}, qui vedi l’andamento del carico massimo.`}
          action={{ label: 'Registra allenamento', href: href('/registra') }}
        />
      )}

      {history.length > 0 && (
        <div className="ex-grid">
          <dl className="stats3">
            <div className="stat stat-pr">
              <dt>Record</dt>
              <dd>
                <Kg value={best?.kg ?? (last.topKg === 0 ? 0 : null)} size="xl" />
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

          {loaded.length > 0 && (
            <section className="block ex-chart" aria-labelledby="h-chart">
              <h2 id="h-chart" className="block-title">
                Carico massimo per seduta
              </h2>
              <LoadChart
                points={loaded}
                color={anchor ? plateVar(exerciseId) : 'var(--chalk)'}
                prKg={best?.kg ?? null}
                label={`${name}, carico massimo`}
              />
            </section>
          )}

          <section className="block ex-table" aria-labelledby="h-table">
            <h2 id="h-table" className="block-title">
              Tutte le sedute
            </h2>
            <table className="table table-hist">
              <colgroup>
                <col className="col-date" />
                <col className="col-top" />
                <col />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">Data</th>
                  <th scope="col" className="num-col">
                    Top
                  </th>
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
                    <td className="num-col">
                      {h.topKg === 0 ? <span className="muted">c. libero</span> : <b>{kg(h.topKg)}</b>}
                      {isRecordOn(state.sessions, exerciseId, h.date) && <span className="badge-pr badge-sm">PR</span>}
                    </td>
                    <td className="sets-cell">{h.sets.map((s) => setLabel(s)).join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {tech && (
            <section className="block rule-card ex-tech-card" aria-labelledby="h-tech">
              <h2 id="h-tech" className="block-title">
                Tecnica
              </h2>
              <p>{tech.cue}</p>
            </section>
          )}
        </div>
      )}

      {history.length === 0 && tech && (
        <section className="block rule-card" aria-labelledby="h-tech0">
          <h2 id="h-tech0" className="block-title">
            Tecnica
          </h2>
          <p>{tech.cue}</p>
        </section>
      )}
    </div>
  );
}
