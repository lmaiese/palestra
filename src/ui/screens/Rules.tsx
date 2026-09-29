// Plan rules and technique pool. Plan data only, no Firebase (DoD C3).
import { useEffect } from 'react';
import { plan } from '../../domain/plan';
import { slugify } from '../../domain/exercises';
import { href, useQuery } from '../lib/router';
import { RichText } from '../components/RichText';
import { Plate } from '../components/Plate';
import { plateFor } from '../lib/plates';
import { canonicalExerciseId, exerciseDisplayName } from '../../domain/exercises';
import { IconBack } from '../components/Icons';

const FATIGUE = ['Segnali che stai esagerando', 'Ordine di taglio quando sei cotto', 'Acqua, sonno, sabbia'];
const KEY_RULES = ['C-Lite', 'Beach > Pesi'];

export function Rules() {
  const query = useQuery();
  const target = query.get('s');

  useEffect(() => {
    if (!target) return;
    document.getElementById(target)?.scrollIntoView?.({ block: 'start' });
  }, [target]);

  const byTitle = new Map(plan.rules.map((r) => [r.title, r]));
  const keyRules = KEY_RULES.map((t) => byTitle.get(t)).filter(Boolean) as { title: string; text: string }[];
  const fatigue = FATIGUE.map((t) => byTitle.get(t)).filter(Boolean) as { title: string; text: string }[];
  const other = plan.rules.filter((r) => !KEY_RULES.includes(r.title) && !FATIGUE.includes(r.title) && r.title !== 'Progressione anchor');
  const progressionIntro = byTitle.get('Progressione anchor');
  const categories = [...new Set(plan.techniques.map((t) => t.category))];
  const weekNotes = plan.weeks.filter((w) => w.extra.length > 0);

  const toc = [
    ['settimana-tipo', 'Settimana tipo'],
    ['c-lite', 'C-Lite'],
    ['beach-pesi', 'Beach > Pesi'],
    ['progressione', 'Progressione'],
    ['warm-up', 'Warm-up'],
    ['fatica', 'Gestione fatica'],
    ['tecnica', 'Tecnica'],
    ['note', 'Note del ciclo'],
  ];

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
        {toc.map(([id, label]) => (
          <a key={id} className="toc-item" href={href(`/regole?s=${id}`)}>
            {label}
          </a>
        ))}
      </nav>

      <section id="settimana-tipo" className="block">
        <h2>Settimana tipo</h2>
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
        {byTitle.get('Perché questo ordine') && <RichText text={byTitle.get('Perché questo ordine')!.text} />}
      </section>

      {keyRules.map((r) => (
        <section key={r.title} id={r.title === 'C-Lite' ? 'c-lite' : 'beach-pesi'} className="block rule-card">
          <h2>{r.title === 'C-Lite' ? 'Regola C-Lite' : 'Regola Beach > Pesi'}</h2>
          <RichText text={r.text} />
        </section>
      ))}

      <section id="progressione" className="block">
        <h2>Progressione anchor</h2>
        {progressionIntro && <RichText text={progressionIntro.text} />}
        <div className="anchors-inline" aria-label="I 5 anchor">
          {plan.anchors.map((a) => (
            <a key={a} href={href(`/esercizio/${a}`)} className="anchor-chip">
              <Plate exerciseId={a} size={18} />
              {exerciseDisplayName(a)}
            </a>
          ))}
        </div>
        <div className="table-scroll">
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
        </div>
        <h3>Regole di progressione</h3>
        <ol className="rules-ol">
          {plan.progressionRules.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ol>
      </section>

      <section id="warm-up" className="block">
        <h2>Warm-up standard, 6 minuti</h2>
        <p className="muted">Uguale ogni seduta.</p>
        <ol className="rules-ol">
          {plan.warmup.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ol>
      </section>

      <section id="fatica" className="block">
        <h2>Gestione fatica</h2>
        {fatigue.map((r) => (
          <div key={r.title} className="sub">
            <h3>{r.title}</h3>
            <RichText text={r.text} />
          </div>
        ))}
      </section>

      <section id="tecnica" className="block">
        <h2>Pool di esercizi, tecnica</h2>
        {categories.map((c) => (
          <div key={c} className="sub">
            <h3 className="tech-cat">{c}</h3>
            <dl className="tech-list">
              {plan.techniques
                .filter((t) => t.category === c)
                .map((t) => {
                  const id = canonicalExerciseId(t.name);
                  return (
                    <div key={t.name} id={`t-${slugify(t.name)}`} className="tech-item">
                      <dt>
                        {plateFor(id) && plan.anchors.includes(id) && <Plate exerciseId={id} size={16} />}
                        {t.name}
                      </dt>
                      <dd>{t.cue}</dd>
                    </div>
                  );
                })}
            </dl>
          </div>
        ))}
      </section>

      <section id="note" className="block">
        <h2>Note del ciclo</h2>
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
      </section>
    </div>
  );
}
