import { Barbell } from '../components/Barbell';
import { IconGoogle } from '../components/Icons';

interface Props {
  onSignIn: () => void;
  busy: boolean;
  error: string | null;
}

export function Login({ onSignIn, busy, error }: Props) {
  return (
    <main className="gate">
      <div className="gate-inner">
        <Barbell className="gate-mark" height={104} />
        <h1 className="gate-title">Palestra</h1>
        <p className="gate-lede">
          Piano forza e potenza per il beach volley. Otto settimane, cinque anchor, ogni carico segnato.
        </p>
        <dl className="gate-facts">
          <div>
            <dt>Ciclo</dt>
            <dd>28 set – 22 nov</dd>
          </div>
          <div>
            <dt>Sedute</dt>
            <dd>24</dd>
          </div>
          <div>
            <dt>Anchor</dt>
            <dd>5</dd>
          </div>
        </dl>
        <button type="button" className="btn btn-google" onClick={onSignIn} disabled={busy}>
          <IconGoogle />
          {busy ? 'Accesso in corso' : 'Accedi con Google'}
        </button>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <p className="gate-note">App personale: entra solo l’account del proprietario.</p>
      </div>
    </main>
  );
}
