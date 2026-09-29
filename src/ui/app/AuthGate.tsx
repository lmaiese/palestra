import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { SessionRepo } from '../../domain/repo';
import type { AuthAdapter, AuthUser } from './auth';
import { AccountProvider, SessionsProvider } from './data';
import { Login } from '../screens/Login';
import { Denied } from '../screens/Denied';
import { FullPageState } from '../components/States';

type Gate =
  | { kind: 'init' }
  | { kind: 'signedOut' }
  | { kind: 'denied'; email: string }
  | { kind: 'owner'; email: string };

interface Props {
  auth: AuthAdapter;
  isOwner: (u: AuthUser | null) => boolean;
  /** Creates the data repo. Called only for the owner, after sign-in. */
  createRepo: () => Promise<SessionRepo>;
  children: ReactNode;
}

export function AuthGate({ auth, isOwner, createRepo, children }: Props) {
  const [gate, setGate] = useState<Gate>({ kind: 'init' });
  const [repo, setRepo] = useState<SessionRepo | null>(null);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const deniedRef = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    let started = false;
    const unsub = auth.onChange((user) => {
      if (!user || !isOwner(user)) {
        started = false;
        setRepo(null);
      }
      if (!user) {
        // Keep the denial visible after the forced sign-out.
        setGate(deniedRef.current ? { kind: 'denied', email: deniedRef.current } : { kind: 'signedOut' });
        return;
      }
      if (!isOwner(user)) {
        deniedRef.current = user.email ?? 'account sconosciuto';
        setGate({ kind: 'denied', email: deniedRef.current });
        void auth.signOut();
        return;
      }
      deniedRef.current = null;
      setGate({ kind: 'owner', email: user.email ?? '' });
      if (started) return;
      // Only now, for the verified owner, is the data layer created (DoD S3).
      started = true;
      setRepoError(null);
      createRepo().then(
        (r) => alive && setRepo(r),
        (e: Error) => alive && setRepoError(e.message || 'Impossibile aprire l’archivio'),
      );
    });
    return () => {
      alive = false;
      unsub();
    };
  }, [auth, isOwner, createRepo]);

  const signIn = async () => {
    setBusy(true);
    setSignInError(null);
    try {
      await auth.signIn();
    } catch (e) {
      setSignInError(messageFor(e));
    } finally {
      setBusy(false);
    }
  };

  switch (gate.kind) {
    case 'init':
      return <FullPageState kind="loading" title="Apro Palestra" />;
    case 'signedOut':
      return <Login onSignIn={signIn} busy={busy} error={signInError} />;
    case 'denied':
      return (
        <Denied
          email={gate.email}
          onRetry={() => {
            deniedRef.current = null;
            setGate({ kind: 'signedOut' });
          }}
        />
      );
    case 'owner':
      if (repoError) {
        return (
          <FullPageState
            kind="error"
            title="Archivio non raggiungibile"
            detail={repoError}
            action={{ label: 'Riprova', onClick: () => window.location.reload() }}
          />
        );
      }
      if (!repo) return <FullPageState kind="loading" title="Carico i tuoi allenamenti" />;
      return (
        <AccountProvider value={{ email: gate.email, signOut: () => void auth.signOut() }}>
          <SessionsProvider repo={repo}>{children}</SessionsProvider>
        </AccountProvider>
      );
  }
}

function messageFor(e: unknown): string {
  const code = (e as { code?: string }).code ?? '';
  if (code === 'auth/network-request-failed') return 'Nessuna connessione. Riprova quando sei online.';
  if (code === 'auth/unauthorized-domain') return 'Dominio non autorizzato per l’accesso.';
  return 'Accesso non riuscito. Riprova.';
}
