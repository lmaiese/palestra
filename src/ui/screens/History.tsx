import { useMemo } from 'react';
import { exerciseDisplayName } from '../../domain/exercises';
import { lastLoad } from '../../domain/stats';
import { plan } from '../../domain/plan';
import { useSessionList, useSessions } from '../app/data';
import { href } from '../lib/router';
import { dayOfMonth, kg, monthShort, shortDate, weekdayName } from '../lib/format';
import { loadRecord, sessionRef, sessionTitle, topKg } from '../lib/summary';
import { Plate } from '../components/Plate';
import { StateBlock } from '../components/States';
import { IconChevron } from '../components/Icons';

export function History() {
  const { state, retry } = useSessions();
  const list = useSessionList();

  const exercises = useMemo(() => {
    const ids = new Set<string>();
    list.forEach((s) => s.exercises.forEach((e) => e.sets.length && ids.add(e.exerciseId)));
    const arr = [...ids].map((id) => ({ id, best: loadRecord(list, id), bodyweight: !!lastLoad(list, id)?.bodyweight, anchor: plan.anchors.indexOf(id) }));
    return arr.sort((a, b) => {
      if ((a.anchor >= 0) !== (b.anchor >= 0)) return a.anchor >= 0 ? -1 : 1;
      if (a.anchor >= 0) return a.anchor - b.anchor;
      return exerciseDisplayName(a.id).localeCompare(exerciseDisplayName(b.id));
    });
  }, [list]);

  return (
    <div className="page page-history">
      <header className="page-head">
        <h1 className="page-title">Storico</h1>
        {state.status === 'ready' && list.length > 0 && (
          <p className="page-sub">
            {list.length} {list.length === 1 ? 'seduta' : 'sedute'} registrate
          </p>
        )}
      </header>

      {state.status === 'loading' && list.length === 0 && <StateBlock kind="loading" title="Carico le sedute" />}
      {state.status === 'error' && (
        <StateBlock kind="error" title="Non riesco a leggere lo storico" detail={state.error} action={{ label: 'Riprova', onClick: retry }} />
      )}
      {state.status === 'ready' && list.length === 0 && (
        <StateBlock
          kind="empty"
          title="Ancora nessuna seduta"
          detail="Ogni allenamento che registri finisce qui, dal più recente."
          action={{ label: 'Registra allenamento', href: href('/registra') }}
        />
      )}

      {list.length > 0 && (
        <section className="block" aria-labelledby="h-sessions">
          <h2 id="h-sessions" className="sr-only">
            Sedute
          </h2>
          <ol className="sesslist">
            {list.map((s) => {
              const tops = s.exercises
                .map((e) => ({ id: e.exerciseId, name: exerciseDisplayName(e.exerciseId) || e.name, top: topKg(e) }))
                .filter((e) => e.top != null);
              return (
                <li key={s.id}>
                  <a className="sessrow" href={href(`/storico/${s.id}`)}>
                    <span className="sessrow-date" aria-hidden="true">
                      <span className="sessrow-d">{dayOfMonth(s.date)}</span>
                      <span className="sessrow-m">{monthShort(s.date)}</span>
                    </span>
                    <span className="sessrow-body">
                      <span className="sessrow-title">
                        <span className={`tag-letter${s.day ? '' : ' tag-extra'}`}>{s.day ?? '+'}</span>
                        {sessionTitle(s)}
                      </span>
                      <span className="sr-only">
                        {weekdayName(s.date)} {shortDate(s.date)}, {sessionRef(s)}.
                      </span>
                      <span className="sessrow-ref" aria-hidden="true">
                        {weekdayName(s.date)} · {sessionRef(s)}
                      </span>
                      {tops.length > 0 && (
                        <span className="sessrow-tops">
                          {tops.slice(0, 4).map((t) => (
                            <span key={t.id} className="top">
                              {plan.anchors.includes(t.id) && <Plate exerciseId={t.id} size={12} />}
                              {t.name} {t.top === 0 ? <span className="muted">corpo libero</span> : <b>{kg(t.top!)}</b>}
                            </span>
                          ))}
                          {tops.length > 4 && <span className="top top-more">+{tops.length - 4}</span>}
                        </span>
                      )}
                      {s.notes && <span className="sessrow-note">{s.notes}</span>}
                    </span>
                    <IconChevron className="sessrow-chev" />
                  </a>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {exercises.length > 0 && (
        <section className="block" aria-labelledby="h-ex">
          <div className="block-head">
            <h2 id="h-ex">Esercizi</h2>
            <span className="muted small">record personale</span>
          </div>
          <ul className="exindex">
            {exercises.map((e) => (
              <li key={e.id}>
                <a className="exindex-row" href={href(`/esercizio/${e.id}`)}>
                  {e.anchor >= 0 ? <Plate exerciseId={e.id} size={20} /> : <span className="exindex-dot" aria-hidden="true" />}
                  <span className="exindex-name">{exerciseDisplayName(e.id)}</span>
                  <span className="exindex-kg">
                    {e.best ? (
                      <>
                        <b>{kg(e.best.kg)}</b> kg
                      </>
                    ) : e.bodyweight ? (
                      'corpo libero'
                    ) : (
                      '—'
                    )}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
