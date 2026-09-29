import { useCallback, useState } from 'react';
import { getSession, plan } from '../../domain/plan';
import { useSessions } from '../app/data';
import { useToast } from '../app/toast';
import { italianError } from '../lib/errors';
import { href, navigate } from '../lib/router';
import { capitalize, longDate } from '../lib/format';
import { isRecordOn, sessionRef, sessionTitle, setLabel, topKg } from '../lib/summary';
import { Plate } from '../components/Plate';
import { Kg } from '../components/Kg';
import { StateBlock } from '../components/States';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { IconBack, IconEdit, IconTrash } from '../components/Icons';

export function SessionDetail({ id }: { id: string }) {
  const { state, remove, retry } = useSessions();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancel = useCallback(() => setConfirming(false), []);

  const s = state.sessions.find((x) => x.id === id);

  const back = (
    <a className="back" href={href('/storico')}>
      <IconBack width={20} height={20} />
      Storico
    </a>
  );

  if (!s) {
    return (
      <div className="page">
        <header className="page-head">{back}</header>
        {state.status === 'loading' ? (
          <StateBlock kind="loading" title="Carico la seduta" />
        ) : state.status === 'error' ? (
          <StateBlock kind="error" title="Non riesco a leggere la seduta" detail={state.error} action={{ label: 'Riprova', onClick: retry }} />
        ) : (
          <StateBlock kind="empty" title="Seduta non trovata" detail="Forse è stata eliminata." action={{ label: 'Vai allo storico', href: href('/storico') }} />
        )}
      </div>
    );
  }

  const planned = s.week != null && s.day != null ? getSession(s.week, s.day) : undefined;

  const doDelete = async () => {
    setBusy(true);
    setError(null);
    try {
      await remove(s.id);
      setConfirming(false);
      toast('Seduta eliminata');
      navigate('/storico', { force: true, replace: true });
    } catch (e) {
      setError(`Eliminazione non riuscita. ${italianError(e)}`);
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page page-session">
      <header className="page-head">
        {back}
        <p className="detail-ref">
          {s.day ? <span className="tag-letter">{s.day}</span> : <span className="tag-letter tag-extra">+</span>}
          {sessionRef(s)}
        </p>
        <h1 className="page-title">{sessionTitle(s)}</h1>
        <p className="page-sub">{capitalize(longDate(s.date))}</p>
      </header>

      {error && (
        <p className="inline-warn" role="alert">
          {error}
        </p>
      )}

      <ol className="detail-list">
        {s.exercises.map((ex, i) => {
          const top = topKg(ex);
          const isPr = top != null && top > 0 && isRecordOn(state.sessions, ex.exerciseId, s.date);
          const anchor = plan.anchors.includes(ex.exerciseId);
          const rx = planned?.exercises.find((p) => p.exerciseId === ex.exerciseId)?.prescription;
          return (
            <li key={`${ex.exerciseId}-${i}`} className={`detail-ex${anchor ? ' is-anchor' : ''}`}>
              <div className="detail-ex-head">
                <a className="detail-ex-name" href={href(`/esercizio/${ex.exerciseId}`)}>
                  {anchor && <Plate exerciseId={ex.exerciseId} size={22} />}
                  {ex.name}
                </a>
                <span className="detail-ex-top">
                  {isPr && <span className="badge-pr">Record</span>}
                  <Kg value={top} size="lg" />
                </span>
              </div>
              {rx && <p className="detail-ex-rx">Piano: {rx}</p>}
              <ul className="setchips" aria-label={`Set di ${ex.name}`}>
                {ex.sets.map((st, j) => (
                  <li key={j} className="setchip">
                    {setLabel(st)}
                  </li>
                ))}
              </ul>
              {ex.notes && <p className="detail-ex-notes">{ex.notes}</p>}
            </li>
          );
        })}
      </ol>
      {s.exercises.length === 0 && <StateBlock kind="empty" title="Nessun carico in questa seduta" />}

      {(s.conditioning || s.notes) && (
        <dl className="detail-extra">
          {s.conditioning && (
            <div>
              <dt>Conditioning</dt>
              <dd>{s.conditioning}</dd>
            </div>
          )}
          {s.notes && (
            <div>
              <dt>Note</dt>
              <dd>{s.notes}</dd>
            </div>
          )}
        </dl>
      )}

      <div className="detail-actions">
        <a className="btn btn-primary" href={href(`/registra/${s.id}`)}>
          <IconEdit width={20} height={20} /> Modifica
        </a>
        <button type="button" className="btn-text btn-text-danger" onClick={() => setConfirming(true)}>
          <IconTrash width={18} height={18} /> Elimina seduta
        </button>
      </div>

      {confirming && (
        <ConfirmDialog
          title="Eliminare la seduta?"
          body={`${sessionTitle(s)} del ${longDate(s.date)}. L’operazione non si può annullare.`}
          confirmLabel="Elimina seduta"
          busy={busy}
          onConfirm={doDelete}
          onCancel={cancel}
        />
      )}
    </div>
  );
}

