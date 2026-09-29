// Plan rules and technique pool. Plan data only, no Firebase (DoD C3).
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { plan } from '../../domain/plan';
import { canonicalExerciseId, exerciseDisplayName, slugify } from '../../domain/exercises';
import { href, useQuery } from '../lib/router';
import { RichText } from '../components/RichText';
import { Plate } from '../components/Plate';
import { IconBack, IconChevron } from '../components/Icons';

type Rule = { title: string; text: string };

const FATIGUE = ['Segnali che stai esagerando', 'Ordine di taglio quando sei cotto', 'Acqua, sonno, sabbia'];
const KEY_RULES = ['C-Lite', 'Beach > Pesi'];

const TOC: [string, string][] = [
  ['settimana-tipo', 'Settimana tipo'],
  ['c-lite', 'C-Lite'],
  ['beach-pesi', 'Beach > Pesi'],
  ['progressione', 'Progressione'],
  ['warm-up', 'Warm-up'],
  ['fatica', 'Fatica'],
  ['tecnica', 'Tecnica'],
  ['note', 'Note del ciclo'],
];
const OPEN_BY_DEFAULT = ['settimana-tipo', 'c-lite', 'beach-pesi', 'progressione'];

export function Rules() {
  const query = useQuery();
  const target = query.get('s');
  const [open, setOpen] = useState<Set<string>>(() => new Set(target ? [...OPEN_BY_DEFAULT, target] : OPEN_BY_DEFAULT));

  // Jumping to a section opens it (derived during render, no effect needed).
  const [lastTarget, setLastTarget] = useState(target);
  if (target !== lastTarget) {
    setLastTarget(target);
    if (target && !open.has(target)) setOpen(new Set([...open, target]));
  }

  useEffect(() => {
    if (!target) return;
    document.getElementById(target)?.scrollIntoView?.({ block: 'start' });
  }, [target]);

  const toggle = (id: string, isOpen: boolean) =>
    setOpen((prev) => {
      if (prev.has(id) === isOpen) return prev;
      const next = new Set(prev);
      if (isOpen) next.add(id);
      else next.delete(id);
      return next;
    });

  const byTitle = new Map(plan.rules.map((r) => [r.title, r]));
  const pick = (titles: string[]) => titles.map((t) => byTitle.get(t)).filter(Boolean) as Rule[];
  const [cLite, beach] = pick(KEY_RULES);
  const fatigue = pick(FATIGUE);
  const why = byTitle.get('Perché questo ordine');
  const progressionIntro = byTitle.get('Progressione anchor');
  const other = plan.rules.filter(
    (r) => !KEY_RULES.includes(r.title) && !FATIGUE.includes(r.title) && r.title !== 'Progressione anchor' && r.title !== 'Perché questo ordine',
  );
  const weekNotes = plan.weeks.filter((w) => w.extra.length > 0);

  const section = (id: string, title: string, children: ReactNode, className = '') => (
    <Section id={id} title={title} open={open.has(id)} onToggle={(o) => toggle(id, o)} className={className}>
      {children}
    </Section>
  );

  return (
    <div className="page page-rules">
      <header className="page-head">
        <a className="back" href={href('/piano')}>
          <IconBack width={20} height={20} />
          Piano
        </a>
        <h1 className="page-title">Regole e tecnica</h1>
      </header>

      <nav className="toc" aria-label="Sezioni delle regole">
        <ul>
          {TOC.map(([id, label]) => (
            <li key={id}>
              <a className="toc-item" href={href(`/regole?s=${id}`)} aria-current={target === id ? 'location' : undefined}>
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="rules">
        {section(
          'settimana-tipo',
          'Settimana tipo',
          <>
            <table className="table table-week">
              <caption className="sr-only">Settimana tipo</caption>
              <tbody>
                {plan.weekTemplate.map((d) => {
                  const letter = /^([ABC])\s—/.exec(d.activity)?.[1];
                  return (
                    <tr key={d.day} className={letter ? 'is-session' : /beach/i.test(d.activity) ? 'is-beach' : undefined}>
                      <th scope="row">{d.day}</th>
                      <td>
                        {letter && <span className="tag-letter">{letter}</span>}
                        {letter ? d.activity.replace(/^[ABC]\s—\s*/, '') : d.activity}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {why && <RichText text={why.text} />}
          </>,
        )}

        {cLite && section('c-lite', 'Regola C-Lite', <RichText text={cLite.text} />, 'is-key')}
        {beach && section('beach-pesi', 'Regola Beach > Pesi', <RichText text={beach.text} />, 'is-key')}

        {section(
          'progressione',
          'Progressione anchor',
          <>
            {progressionIntro && <RichText text={progressionIntro.text} />}
            <div className="anchors-inline" aria-label="I 5 anchor">
              {plan.anchors.map((a) => (
                <a key={a} href={href(`/esercizio/${a}`)} className="anchor-chip">
                  <Plate exerciseId={a} size={18} />
                  {exerciseDisplayName(a)}
                </a>
              ))}
            </div>
            <table className="table table-prog">
              <caption className="sr-only">Top set e back-off per settimana</caption>
              <thead>
                <tr>
                  <th scope="col">Sett.</th>
                  <th scope="col">Fase</th>
                  <th scope="col">Top set</th>
                  <th scope="col">Back-off</th>
                </tr>
              </thead>
              <tbody>
                {plan.progression.map((r) => (
                  <tr key={r.weeks}>
                    <th scope="row" className="num">
                      {r.weeks}
                    </th>
                    <td>{r.phase}</td>
                    <td className="rx">{r.topSet}</td>
                    <td className="rx">{r.backOff || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h3>Regole di progressione</h3>
            <ol className="rules-ol">
              {plan.progressionRules.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ol>
          </>,
        )}

        {section(
          'warm-up',
          'Warm-up standard, 6 minuti',
          <>
            <p className="muted">Uguale ogni seduta.</p>
            <ol className="rules-ol">
              {plan.warmup.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ol>
          </>,
        )}

        {section(
          'fatica',
          'Gestione fatica',
          fatigue.map((r) => (
            <div key={r.title} className="sub">
              <h3>{r.title}</h3>
              <RichText text={r.text} />
            </div>
          )),
        )}

        {section('tecnica', 'Pool di esercizi, tecnica', <TechniquePool />)}

        {section(
          'note',
          'Note del ciclo',
          <>
            {weekNotes.map((w) => (
              <div key={w.number} className="sub">
                <h3>
                  Settimana {w.number}, {w.theme}
                </h3>
                <RichText lines={w.extra} />
              </div>
            ))}
            {other.map((r) => (
              <div key={r.title} className="sub">
                <h3>{r.title}</h3>
                <RichText text={r.text} />
              </div>
            ))}
          </>,
        )}
      </div>
    </div>
  );
}

function Section({
  id,
  title,
  open,
  onToggle,
  className,
  children,
}: {
  id: string;
  title: string;
  open: boolean;
  onToggle: (open: boolean) => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <details id={id} className={`rule ${className ?? ''}`} open={open} onToggle={(e) => onToggle(e.currentTarget.open)}>
      <summary>
        <h2>{title}</h2>
        <IconChevron className="rule-chev" />
      </summary>
      <div className="rule-body">{children}</div>
    </details>
  );
}

function TechniquePool() {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string>('Tutte');
  const uid = useId();
  const categories = useMemo(() => ['Tutte', ...new Set(plan.techniques.map((t) => t.category))], []);
  const needle = q.trim().toLowerCase();
  const items = plan.techniques.filter(
    (t) =>
      (cat === 'Tutte' || t.category === cat) &&
      (!needle || t.name.toLowerCase().includes(needle) || t.cue.toLowerCase().includes(needle)),
  );

  return (
    <div className="pool">
      <div className="field">
        <label htmlFor={`${uid}-q`}>Cerca esercizio o parola chiave</label>
        <input
          id={`${uid}-q`}
          className="input"
          type="search"
          value={q}
          placeholder="Es. squat, scapole, anche"
          autoComplete="off"
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="pool-cats" role="radiogroup" aria-label="Categoria">
        {categories.map((c) => (
          <button key={c} type="button" role="radio" aria-checked={cat === c} className="pool-cat" onClick={() => setCat(c)}>
            {c}
          </button>
        ))}
      </div>
      <p className="pool-count" aria-live="polite">
        {items.length} {items.length === 1 ? 'esercizio' : 'esercizi'}
      </p>
      {items.length === 0 ? (
        <p className="state-detail">Nessun esercizio corrisponde. Prova un’altra parola.</p>
      ) : (
        <ul className="tech-list">
          {items.map((t) => {
            const id = canonicalExerciseId(t.name);
            const isAnchor = plan.anchors.includes(id);
            return (
              <li key={`${t.category}-${t.name}`} id={`t-${slugify(t.name)}`} className="tech-item">
                <p className="tech-name">
                  {isAnchor && <Plate exerciseId={id} size={16} />}
                  {t.name}
                  <span className="tech-cat">{t.category}</span>
                </p>
                <p className="tech-cue">{t.cue}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
