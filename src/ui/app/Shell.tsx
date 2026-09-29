import { useEffect } from 'react';
import { href, useRoute } from '../lib/router';
import { useAccount } from './data';
import { Barbell } from '../components/Barbell';
import { IconHistory, IconLog, IconPlan, IconToday } from '../components/Icons';
import { StateBlock } from '../components/States';
import { Today } from '../screens/Today';
import { PlanScreen } from '../screens/Plan';
import { Rules } from '../screens/Rules';
import { LogForm } from '../screens/LogForm';
import { History } from '../screens/History';
import { SessionDetail } from '../screens/SessionDetail';
import { ExerciseScreen } from '../screens/Exercise';

const TABS = [
  { key: 'oggi', label: 'Oggi', to: '/', Icon: IconToday },
  { key: 'piano', label: 'Piano', to: '/piano', Icon: IconPlan },
  { key: 'registra', label: 'Registra', to: '/registra', Icon: IconLog },
  { key: 'storico', label: 'Storico', to: '/storico', Icon: IconHistory },
] as const;

function tabFor(route: string[]): string {
  const r = route[0] ?? 'oggi';
  if (r === 'regole') return 'piano';
  if (r === 'esercizio') return 'storico';
  return r;
}

const TITLES: Record<string, string> = {
  oggi: 'Oggi',
  piano: 'Piano',
  regole: 'Regole',
  registra: 'Registra',
  storico: 'Storico',
  esercizio: 'Esercizio',
};

export function Shell() {
  const route = useRoute();
  const active = tabFor(route);
  const account = useAccount();

  useEffect(() => {
    document.title = `${TITLES[route[0] ?? 'oggi'] ?? 'Palestra'} · Palestra`;
  }, [route]);

  return (
    <div className="shell">
      <a className="skip" href="#main">
        Vai al contenuto
      </a>
      <nav className="nav" aria-label="Sezioni">
        <a className="nav-brand" href={href('/')} aria-label="Palestra, vai a Oggi">
          <Barbell height={30} />
          <span>Palestra</span>
        </a>
        <ul className="nav-list">
          {TABS.map(({ key, label, to, Icon }) => (
            <li key={key}>
              <a
                href={href(to)}
                className={`nav-item${key === 'registra' ? ' nav-item-log' : ''}`}
                aria-current={active === key ? 'page' : undefined}
              >
                <span className="nav-icon">
                  <Icon />
                </span>
                <span className="nav-label">{label}</span>
              </a>
            </li>
          ))}
        </ul>
        {account && (
          <div className="nav-account">
            <span className="nav-email">{account.email}</span>
            <button type="button" className="btn btn-quiet btn-sm" onClick={account.signOut}>
              Esci
            </button>
          </div>
        )}
      </nav>
      <main id="main" className="main" tabIndex={-1}>
        <Route route={route} />
      </main>
    </div>
  );
}

function Route({ route }: { route: string[] }) {
  const [head, a, b] = route;
  switch (head) {
    case undefined:
    case 'oggi':
      return <Today />;
    case 'piano':
      return <PlanScreen weekParam={a} dayParam={b} />;
    case 'regole':
      return <Rules />;
    case 'registra':
      return <LogForm key={a ?? 'new'} editId={a} />;
    case 'storico':
      return a ? <SessionDetail id={a} /> : <History />;
    case 'esercizio':
      return a ? <ExerciseScreen exerciseId={a} /> : <History />;
    default:
      return (
        <div className="page">
          <StateBlock
            kind="empty"
            title="Pagina inesistente"
            detail="Il link non corrisponde a nessuna sezione."
            action={{ label: 'Torna a Oggi', href: href('/') }}
          />
        </div>
      );
  }
}
