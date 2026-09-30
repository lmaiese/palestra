import { useMemo } from 'react';
import { getSession, getWeek, plan, weekForDate } from '../../domain/plan';
import { exerciseDisplayName } from '../../domain/exercises';
import { lastLoad, weekCompletion } from '../../domain/stats';
import { loadRecord } from '../lib/summary';
import type { DayId, PlanWeek, WorkoutSession } from '../../domain/types';
import { useAccount, useSessions, useToday } from '../app/data';
import { href } from '../lib/router';
import { capitalize, addDays, dayMonth, kg, dayOfMonth, daysBetween, longDate, shortDate, weekdayLetter } from '../lib/format';
import { DAY_ORDER, DAY_WEEKDAY, kindForDate, weekDays } from '../lib/schedule';
import { Plate } from '../components/Plate';
import { Kg } from '../components/Kg';
import { StateBlock } from '../components/States';
import { IconCheck, IconChevron, IconMoon, IconSand } from '../components/Icons';

export function Today() {
  const today = useToday();
  const { state } = useSessions();
  const sessions = state.sessions;
  const weekNo = weekForDate(today);
  const before = today < plan.startDate;
  const displayWeek = getWeek(weekNo ?? (before ? 1 : 8))!;

  const completion = useMemo(
    () => weekCompletion(sessions, displayWeek.number),
    [sessions, displayWeek.number],
  );

  return (
    <div className="page page-today">
      <header className="today-head">
        <p className="today-date">{capitalize(longDate(today))}</p>
        <CycleMeter current={weekNo} before={before} />
      </header>

      {weekNo === null ? (
        <OutOfCycle today={today} before={before} />
      ) : (
        <TodayHero today={today} week={displayWeek} completion={completion} />
      )}

      <section className="block" aria-labelledby="h-week">
        <div className="block-head">
          <h2 id="h-week">
            Settimana {displayWeek.number} <span className="muted">{displayWeek.theme}</span>
          </h2>
          <a className="link" href={href(`/piano/${displayWeek.number}`)}>
            Piano della settimana
          </a>
        </div>
        <WeekStrip week={displayWeek} today={today} completion={completion} loading={state.status === 'loading'} started={!before} />
      </section>

      <section className="block" aria-labelledby="h-anchors">
        <div className="block-head">
          <h2 id="h-anchors">Anchor</h2>
        </div>
        <Anchors sessions={sessions.filter((x) => x.date <= today)} status={state.status} error={state.status === 'error' ? state.error : ''} />
      </section>

      <AccountFooter />
    </div>
  );
}

function AccountFooter() {
  const account = useAccount();
  if (!account) return null;
  return (
    <section className="account-foot" aria-label="Account">
      <p>
        Connesso come <b>{account.email}</b>
      </p>
      <button type="button" className="btn btn-quiet btn-sm" onClick={() => void account.signOut()}>
        Esci
      </button>
    </section>
  );
}


function CycleMeter({ current, before }: { current: number | null; before: boolean }) {
  const label =
    current !== null ? `Settimana ${current} di 8` : before ? 'Ciclo non ancora iniziato' : 'Ciclo concluso';
  return (
    <div className="cycle">
      <p className="cycle-label">{label}</p>
      <ol className="cycle-bar" aria-hidden="true">
        {plan.weeks.map((w) => {
          const state =
            current === null ? (before ? 'todo' : 'done') : w.number < current ? 'done' : w.number === current ? 'now' : 'todo';
          return <li key={w.number} className={`cycle-seg cycle-${state}`} title={`${w.number} ${w.theme}`} />;
        })}
      </ol>
    </div>
  );
}

function TodayHero({
  today,
  week,
  completion,
}: {
  today: string;
  week: PlanWeek;
  completion: Record<DayId, WorkoutSession | null>;
}) {
  const kind = kindForDate(today);

  if (kind.kind !== 'session') {
    // Off day (weekend included): the first session still missing this week can be logged today.
    const pending = weekForDate(today) !== null ? DAY_ORDER.find((d) => completion[d] === null) : undefined;
    const next = pending ? null : nextSession(today, week);
    const lastDay = weekForDate(today) !== null && weekForDate(addDays(today, 1)) === null;
    return (
      <section className={`hero hero-off hero-${kind.kind}`} aria-labelledby="h-hero">
        <div className="hero-off-icon">{kind.kind === 'beach' ? <IconSand width={40} height={40} /> : <IconMoon width={40} height={40} />}</div>
        <h1 id="h-hero" className="hero-off-title">
          {kind.kind === 'beach' ? 'Beach' : 'Riposo'}
        </h1>
        {lastDay && <p className="hero-off-text">Ultimo giorno del ciclo: verifica di fine ciclo.</p>}
        {pending ? (
          <>
            <a className="next-up" href={href(`/piano/${week.number}/${pending}`)}>
              <span className="next-letter" aria-hidden="true">
                {pending}
              </span>
              <span className="next-body">
                <span className="next-when">Da recuperare</span>
                <span className="next-title">{getSession(week.number, pending)!.title}</span>
              </span>
              <IconChevron />
            </a>
            <a className="btn btn-primary btn-xl" href={href(`/registra?w=${week.number}&d=${pending}`)}>
              Registra {pending}
            </a>
          </>
        ) : (
          next && (
            <a className="next-up" href={href(`/piano/${next.week}/${next.day}`)}>
              <span className="next-letter" aria-hidden="true">
                {next.day}
              </span>
              <span className="next-body">
                <span className="next-when">Prossima: {next.when}</span>
                <span className="next-title">{next.title}</span>
              </span>
              <IconChevron />
            </a>
          )
        )}
        <a className="btn btn-quiet btn-block" href={href('/registra')}>
          {pending ? 'Altro allenamento' : 'Registra allenamento'}
        </a>
      </section>
    );
  }

  const session = getSession(week.number, kind.day)!;
  const done = completion[kind.day];

  return (
    <section className="hero" aria-labelledby="h-hero">
      <div className="hero-top">
        <span className="hero-letter" aria-hidden="true">
          {kind.day}
        </span>
        <div className="hero-title-wrap">
          <p className="hero-kicker">{done ? 'Seduta di oggi, registrata' : 'Seduta di oggi'}</p>
          <h1 id="h-hero" className="hero-title">
            <span className="sr-only">Seduta {kind.day}: </span>
            {session.title}
          </h1>
        </div>
      </div>
      <ul className="hero-list">
        {session.exercises.map((ex) => (
          <li key={ex.exerciseId + ex.block} className={ex.isAnchor ? 'is-anchor' : undefined}>
            <span className="hero-ex">
              {ex.isAnchor && <Plate exerciseId={ex.exerciseId} size={16} />}
              {ex.name}
            </span>
            <span className="hero-rx">{ex.prescription || ex.notes}</span>
          </li>
        ))}
      </ul>
      {kind.day === 'C' && !done && (
        <p className="callout">
          Beach nel weekend?{' '}
          <a className="link" href={href('/regole?s=c-lite')}>
            Fai C-Lite
          </a>
        </p>
      )}
      {done ? (
        <div className="hero-actions">
          <a className="btn btn-primary btn-xl" href={href(`/storico/${done.id}`)}>
            <IconCheck /> Vedi la seduta registrata
          </a>
          <a className="btn btn-quiet btn-block" href={href(`/piano/${week.number}/${kind.day}`)}>
            Apri nel piano
          </a>
        </div>
      ) : (
        <div className="hero-actions">
          <a className="btn btn-primary btn-xl" href={href('/registra')}>
            Registra allenamento
          </a>
          <a className="btn btn-quiet btn-block" href={href(`/piano/${week.number}/${kind.day}`)}>
            Tecnica e recuperi nel piano
          </a>
        </div>
      )}
    </section>
  );
}

function nextSession(today: string, week: PlanWeek) {
  for (let i = 1; i <= 7; i++) {
    const iso = addDays(today, i);
    const k = kindForDate(iso);
    if (k.kind === 'session') {
      const w = weekForDate(iso) ?? week.number;
      const s = getSession(w, k.day);
      if (!s) return null;
      return { day: k.day, week: w, title: s.title, when: `${DAY_WEEKDAY[k.day]} ${dayMonth(iso)}` };
    }
  }
  return null;
}

function OutOfCycle({ today, before }: { today: string; before: boolean }) {
  if (before) {
    const days = daysBetween(today, plan.startDate);
    return (
      <section className="hero hero-off" aria-labelledby="h-hero">
        <p className="hero-kicker">Si parte lunedì 28 settembre</p>
        <h1 id="h-hero" className="countdown">
          <span className="countdown-n">{days}</span>
          <span className="countdown-u">{days === 1 ? 'giorno' : 'giorni'} all’inizio</span>
        </h1>
        <p className="hero-off-text">Settimana 1, Fondamenta: trova i carichi di riferimento sui 5 anchor, RPE 7 massimo.</p>
        <a className="btn btn-primary btn-xl" href={href('/registra')}>
          Registra allenamento
        </a>
      </section>
    );
  }
  const verify = getWeek(8)?.extra ?? [];
  return (
    <section className="hero hero-off" aria-labelledby="h-hero">
      <p className="hero-kicker">Finito il {dayMonth(plan.endDate)}</p>
      <h1 id="h-hero" className="hero-off-title">
        Ciclo concluso
      </h1>
      <ul className="plain-list">
        {verify
          .filter((l) => /^\d+\./.test(l))
          .map((l) => (
            <li key={l}>{l.replace(/^\d+\.\s*/, '')}</li>
          ))}
      </ul>
      <a className="btn btn-primary btn-xl" href={href('/storico')}>
        Rivedi lo storico
      </a>
    </section>
  );
}

function WeekStrip({
  week,
  today,
  completion,
  loading,
  started,
}: {
  week: PlanWeek;
  today: string;
  completion: Record<DayId, WorkoutSession | null>;
  loading: boolean;
  started: boolean;
}) {
  const days = weekDays(week);
  const doneCount = DAY_ORDER.filter((d) => completion[d]).length;
  return (
    <>
      {started && (
        <p className="sr-only">Sedute completate questa settimana: {loading ? 'in caricamento' : `${doneCount} di 3`}</p>
      )}
      <ol className="strip" aria-label={`Settimana ${week.number}, giorno per giorno`}>
        {days.map((iso) => {
          const k = kindForDate(iso);
          const isToday = iso === today;
          const sess = k.kind === 'session' ? completion[k.day] : null;
          const status = k.kind === 'session' ? (sess ? 'done' : started && iso < today ? 'missed' : 'todo') : k.kind;
          const label =
            k.kind === 'session'
              ? `${k.day}${sess ? ', fatta' : iso < today ? ', non registrata' : ''}`
              : k.kind === 'beach'
                ? 'beach'
                : 'riposo';
          const content = (
            <>
              <span className="strip-wd" aria-hidden="true">
                {weekdayLetter(iso)}
              </span>
              <span className="strip-dn" aria-hidden="true">
                {dayOfMonth(iso)}
              </span>
              <span className="strip-mark" aria-hidden="true">
                {k.kind === 'session' ? (
                  sess ? (
                    <IconCheck width={16} height={16} />
                  ) : (
                    k.day
                  )
                ) : k.kind === 'beach' ? (
                  <IconSand width={24} height={24} />
                ) : (
                  <span className="strip-dot" />
                )}
              </span>
              <span className="sr-only">
                {shortDate(iso)}: {label}
                {isToday ? ', oggi' : ''}
              </span>
            </>
          );
          return (
            <li key={iso} className={`strip-day strip-${status}${isToday ? ' is-today' : ''}`}>
              {sess ? (
                <a href={href(`/storico/${sess.id}`)} className="strip-link">
                  {content}
                </a>
              ) : k.kind === 'session' ? (
                <a href={href(`/piano/${week.number}/${k.day}`)} className="strip-link">
                  {content}
                </a>
              ) : (
                <div className="strip-link">{content}</div>
              )}
            </li>
          );
        })}
      </ol>
      <p className="strip-summary" aria-hidden="true">
        {!started ? 'Il ciclo parte lunedì 28 settembre.' : loading ? 'Carico gli allenamenti' : `${doneCount} di 3 sedute registrate`}
      </p>
    </>
  );
}

function Anchors({ sessions, status, error }: { sessions: WorkoutSession[]; status: string; error: string }) {
  const { retry } = useSessions();
  if (status === 'loading') return <StateBlock kind="loading" title="Carico gli allenamenti" />;
  if (status === 'error' && sessions.length === 0)
    return <StateBlock kind="error" title="Non riesco a leggere lo storico" detail={error} action={{ label: 'Riprova', onClick: retry }} />;
  const any = plan.anchors.some((a) => lastLoad(sessions, a));
  return (
    <>
      <ul className="anchor-list">
        {plan.anchors.map((id) => {
          const last = lastLoad(sessions, id);
          const best = loadRecord(sessions, id);
          return (
            <li key={id}>
              <a className="anchor-row" href={href(`/esercizio/${id}`)}>
                <Plate exerciseId={id} size={34} />
                <span className="anchor-name">
                  <span className="anchor-title">{exerciseDisplayName(id)}</span>
                  <span className="anchor-meta">
                    {last ? `ultima ${shortDate(last.date)}` : 'mai registrato'}
                    {last?.bodyweight && last.reps != null && ` · ${last.reps} rep`}
                    {best && ` · record ${kg(best.kg)} kg`}
                  </span>
                </span>
                <Kg value={last?.kg ?? null} size="lg" />
              </a>
            </li>
          );
        })}
      </ul>
      {!any && (
        <StateBlock
          kind="empty"
          title="Nessun carico sugli anchor"
          detail="Registra la prima seduta: qui compariranno ultimo carico e record di ogni anchor."
        />
      )}
    </>
  );
}
