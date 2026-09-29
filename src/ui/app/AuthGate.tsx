import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { SessionRepo } from '../../domain/repo';
import type { AuthAdapter, AuthUser } from './auth';
import { AccountProvider, SessionsProvider } from './data';
import { Login } from '../screens/Login';
import { Denied } from '../screens/Denied';
import { FullPageState } from '../components/States';
import { italianError } from '../lib/errors';

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
    // Bumped on every sign-out: a createRepo() that resolves late belongs to an
    // old sign-in and must not install its repo (it may even be terminated).
    let generation = 0;
    let started = false;
    const unsub = auth.onChange((user) => {
      const owner = !!user && isOwner(user);
      if (!owner) {
        generation += 1;
        started = false;
        setRepo(null);
      }
      if (!user) {
        // Keep the denial visible after the forced sign-out.
        setGate(deniedRef.current ? { kind: 'denied', email: deniedRef.current } : { kind: 'signedOut' });
        return;
      }
      if (!owner) {
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
      const mine = generation;
      setRepoError(null);
      createRepo().then(
        (r) => {
          if (alive && mine === generation) setRepo(r);
        },
        (e: unknown) => {
          if (alive && mine === generation) setRepoError(italianError(e, 'Impossibile aprire l’archivio.'));
        },
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
      setSignInError(italianError(e, 'Accesso non riuscito. Riprova.'));
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
      if (!repo) return <FullPageState kind="loading" title="Carico gli allenamenti" />;
      return (
        <AccountProvider value={{ email: gate.email, signOut: () => auth.signOutAndClear() }}>
          <SessionsProvider repo={repo}>{children}</SessionsProvider>
        </AccountProvider>
      );
  }
}
