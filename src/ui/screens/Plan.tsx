// Plan browser. Reads plan data from the bundle and sessions from context only:
// this module (and everything it imports) must never import Firebase (DoD C3).
import { useEffect, useId, useRef, useState } from 'react';
import { getWeek, plan, weekForDate, defaultDayForDate } from '../../domain/plan';
import { lastLoad } from '../../domain/stats';
import type { DayId, PlanExercise, PlanWeek, WorkoutSession } from '../../domain/types';
import { useSessions, useToday } from '../app/data';
import { href } from '../lib/router';
import { dayMonth, load, shortDate } from '../lib/format';
import { phaseForWeek, techniqueFor } from '../lib/technique';
import { DAY_WEEKDAY } from '../lib/schedule';
import { Plate } from '../components/Plate';
import { RichText } from '../components/RichText';
import { IconChevron, IconRules } from '../components/Icons';

interface Props {
  weekParam?: string;
  dayParam?: string;
}

export function PlanScreen({ weekParam, dayParam }: Props) {
  const today = useToday();
  const current = weekForDate(today);
  const fallbackWeek = current ?? (today < plan.startDate ? 1 : 8);
  const parsed = Number(weekParam);
  const weekNo = parsed >= 1 && parsed <= 8 ? parsed : fallbackWeek;
  const week = getWeek(weekNo)!;
  const todayDay = weekNo === current ? defaultDayForDate(today) : null;
  const day: DayId = isDay(dayParam) ? dayParam : (todayDay ?? 'A');

  return (
    <div className="page page-plan">
      <header className="page-head">
        <h1 className="page-title">Piano</h1>
        <a className="chip-link" href={href('/regole')}>
          <IconRules width={20} height={20} />
          Regole e tecnica
        </a>
      </header>

      <WeekPicker selected={weekNo} current={current} day={dayParam && isDay(dayParam) ? dayParam : undefined} />

      <WeekHeader week={week} isCurrent={weekNo === current} />

      <nav className="daytabs" aria-label="Sedute della settimana">
        {week.sessions.map((s) => (
          <a
            key={s.day}
            className="daytab"
            href={href(`/piano/${weekNo}/${s.day}`)}
            aria-current={s.day === day ? 'page' : undefined}
          >
            <span className="daytab-letter">{s.day}</span>
            <span className="daytab-body">
              <span className="daytab-title">{s.title}</span>
              <span className="daytab-when">
                {DAY_WEEKDAY[s.day]}
                {s.day === todayDay ? ', oggi' : ''}
              </span>
            </span>
          </a>
        ))}
      </nav>

      <SessionView week={week} day={day} />

      {week.extra.length > 0 && (
        <section className="block note-block" aria-label="Note della settimana">
          <RichText lines={week.extra} />
        </section>
      )}
    </div>
  );
}

function isDay(d: string | undefined): d is DayId {
  return d === 'A' || d === 'B' || d === 'C';
}

function WeekPicker({ selected, current, day }: { selected: number; current: number | null; day?: DayId }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('[aria-current="page"]');
    el?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [selected]);
  return (
    <nav className="weekpick" aria-label="Settimane del ciclo" ref={ref}>
      <ol>
        {plan.weeks.map((w) => (
          <li key={w.number}>
            <a
              className={`weekpick-item${w.number === current ? ' is-current' : ''}`}
              href={href(`/piano/${w.number}${day ? `/${day}` : ''}`)}
              aria-current={w.number === selected ? 'page' : undefined}
              aria-label={`Settimana ${w.number}, ${w.theme}${w.number === current ? ', in corso' : ''}`}
            >
              <span className="weekpick-n">{w.number}</span>
              <span className="weekpick-theme">{w.theme.split(/\s+\+?\s*/)[0]}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function WeekHeader({ week, isCurrent }: { week: PlanWeek; isCurrent: boolean }) {
  const phase = phaseForWeek(week.number);
  return (
    <section className="weekhead" aria-labelledby="h-weekhead">
      <p className="weekhead-dates">
        {dayMonth(week.startDate)} – {dayMonth(week.endDate)}
        {isCurrent && <span className="pill pill-now">in corso</span>}
      </p>
      <h2 id="h-weekhead" className="weekhead-title">
        <span className="weekhead-n">{week.number}</span>
        {week.theme}
      </h2>
      {phase && (
        <dl className="phase">
          <div>
            <dt>Fase anchor</dt>
            <dd>{phase.phase}</dd>
          </div>
          <div>
            <dt>Top set</dt>
            <dd>{phase.topSet}</dd>
          </div>
          <div>
            <dt>Back-off</dt>
            <dd>{phase.backOff || '—'}</dd>
          </div>
        </dl>
      )}
      <p className="weekhead-text">
        <strong>Obiettivo.</strong> {week.objective}
      </p>
      {week.novelty && (
        <p className="weekhead-text">
          <strong>Novità.</strong> {week.novelty}
        </p>
      )}
    </section>
  );
}

function SessionView({ week, day }: { week: PlanWeek; day: DayId }) {
  const session = week.sessions.find((s) => s.day === day)!;
  const { state } = useSessions();
  return (
    <section className="session" aria-labelledby="h-session">
      <div className="session-head">
        <h2 id="h-session" className="session-title">
          <span className="session-letter">{day}</span>
          {session.title}
        </h2>
        <a className="btn btn-primary btn-sm" href={href(`/registra?w=${week.number}&d=${day}`)}>
          Registra
        </a>
      </div>

      <details className="warmup">
        <summary>
          <IconChevron className="warmup-chev" width={20} height={20} />
          <span className="warmup-title">Warm-up standard</span>
          <span className="warmup-meta">6 minuti, {plan.warmup.length} passi</span>
        </summary>
        <ol>
          {plan.warmup.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ol>
      </details>

      {state.status === 'error' && (
        <p className="inline-warn" role="alert">
          Ultimi carichi non disponibili: {state.error}
        </p>
      )}

      <ol className="exlist">
        {session.exercises.map((ex, i) => (
          <ExerciseRow key={`${ex.exerciseId}-${i}`} ex={ex} sessions={state.sessions} loading={state.status === 'loading'} />
        ))}
      </ol>

      {day === 'C' && (
        <p className="callout">
          <strong>C-Lite.</strong> Se nel weekend giochi a beach: togli stacco pesante, clean e salti. Tieni Overhead Press, tirata, core e
          conditioning in zona 2.{' '}
          <a className="link" href={href('/regole?s=c-lite')}>
            Regola completa
          </a>
        </p>
      )}
    </section>
  );
}

function ExerciseRow({ ex, sessions, loading }: { ex: PlanExercise; sessions: WorkoutSession[]; loading: boolean }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const last = lastLoad(sessions, ex.exerciseId);
  const tech = techniqueFor(ex.exerciseId);
  const isConditioning = ex.block.toLowerCase() === 'conditioning';

  return (
    <li className={`ex${ex.isAnchor ? ' ex-anchor' : ''}${open ? ' is-open' : ''}`}>
      <button type="button" className="ex-btn" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)}>
        <span className="ex-top">
          <span className="ex-block">{ex.block}</span>
          {ex.rest && <span className="ex-rest">rec. {ex.rest}</span>}
        </span>
        <span className="ex-name">
          {ex.isAnchor && <Plate exerciseId={ex.exerciseId} size={22} />}
          {ex.name}
        </span>
        {ex.prescription && <span className="ex-rx">{ex.prescription}</span>}
        {ex.notes && ex.notes !== '—' && <span className="ex-notes">{ex.notes}</span>}
        {!isConditioning && (
          <span className="ex-last">
            {loading ? (
              'ultima volta: carico…'
            ) : last ? (
              <>
                ultima volta <b>{load(last.kg)}</b>
                {last.bodyweight && last.reps != null ? ` × ${last.reps}` : ''} · {shortDate(last.date)}
              </>
            ) : (
              'mai registrato'
            )}
          </span>
        )}
        <IconChevron className="ex-chev" />
      </button>
      <div id={panelId} className="ex-panel" hidden={!open}>
        {tech ? (
          <p className="ex-tech">
            <span className="ex-tech-cat">Tecnica, {tech.category.toLowerCase()}</span>
            {tech.cue}
          </p>
        ) : (
          <p className="ex-tech">
            <span className="ex-tech-cat">Tecnica</span>
            Nessuna scheda nel pool: segui le note della seduta.
          </p>
        )}
        {!isConditioning && (
          <a className="btn btn-quiet btn-block" href={href(`/esercizio/${ex.exerciseId}`)}>
            Storico di {ex.name}
          </a>
        )}
      </div>
    </li>
  );
}

