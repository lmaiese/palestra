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
        <button type="button" className="btn btn-google" onClick={onSignIn} disabled={busy}>
          <IconGoogle />
          {busy ? 'Accesso in corso' : 'Accedi con Google'}
        </button>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
