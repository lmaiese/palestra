// DoD S3: no data access for non-owners; they see "Accesso negato" and are signed out.
import '../test-cleanup';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { isOwner } from '../../firebase';
import { createMemoryRepo } from '../../domain/repo';
import type { AuthAdapter, AuthUser } from './auth';
import { AuthGate } from './AuthGate';
import { useAccount, useSessions } from './data';

function fakeAuth() {
  let cb: ((u: AuthUser | null) => void) | null = null;
  const adapter: AuthAdapter & { emit(u: AuthUser | null): void } = {
    onChange(fn) {
      cb = fn;
      return () => {
        cb = null;
      };
    },
    signIn: vi.fn(async () => {}),
    signOut: vi.fn(async () => {
      cb?.(null);
    }),
    signOutAndClear: vi.fn(async () => {
      cb?.(null);
    }),
    emit(u) {
      act(() => cb?.(u));
    },
  };
  return adapter;
}

const google = [{ providerId: 'google.com' }];
const owner: AuthUser = { email: 'maieseluigi@gmail.com', emailVerified: true, providerData: google };

function Probe() {
  const { state } = useSessions();
  return <p>stato: {state.status}</p>;
}

describe('AuthGate', () => {
  it('shows a loading state until auth resolves, then the login', async () => {
    const auth = fakeAuth();
    render(
      <AuthGate auth={auth} isOwner={isOwner} createRepo={vi.fn()}>
        <Probe />
      </AuthGate>,
    );
    expect(screen.getByText('Apro Palestra')).toBeInTheDocument();
    auth.emit(null);
    const btn = screen.getByRole('button', { name: 'Accedi con Google' });
    await userEvent.click(btn);
    expect(auth.signIn).toHaveBeenCalledOnce();
  });

  it.each([
    ['another Google account', { email: 'other@gmail.com', emailVerified: true, providerData: google }],
    ['owner email, not verified', { email: 'maieseluigi@gmail.com', emailVerified: false, providerData: google }],
    ['owner email, password provider', { email: 'maieseluigi@gmail.com', emailVerified: true, providerData: [{ providerId: 'password' }] }],
  ])('denies %s: signs out and never creates a repo', async (_label, user) => {
    const auth = fakeAuth();
    const createRepo = vi.fn(async () => createMemoryRepo());
    render(
      <AuthGate auth={auth} isOwner={isOwner} createRepo={createRepo}>
        <Probe />
      </AuthGate>,
    );
    auth.emit(user);
    expect(await screen.findByRole('heading', { name: 'Accesso negato' })).toBeInTheDocument();
    expect(screen.getByText(user.email)).toBeInTheDocument();
    expect(auth.signOut).toHaveBeenCalledOnce();
    expect(createRepo).not.toHaveBeenCalled();
    expect(screen.queryByText(/stato:/)).not.toBeInTheDocument();
    // The denial stays visible after the forced sign-out, and offers a way back.
    await userEvent.click(screen.getByRole('button', { name: 'Usa un altro account' }));
    expect(screen.getByRole('button', { name: 'Accedi con Google' })).toBeInTheDocument();
    expect(createRepo).not.toHaveBeenCalled();
  });

  it('creates the repo for the owner and renders the app', async () => {
    const auth = fakeAuth();
    const createRepo = vi.fn(async () => createMemoryRepo());
    render(
      <AuthGate auth={auth} isOwner={isOwner} createRepo={createRepo}>
        <Probe />
      </AuthGate>,
    );
    auth.emit(owner);
    expect(await screen.findByText('stato: ready')).toBeInTheDocument();
    expect(createRepo).toHaveBeenCalledOnce();
  });

  it('ignores a repo that resolves after sign-out', async () => {
    const auth = fakeAuth();
    let resolve!: (r: ReturnType<typeof createMemoryRepo>) => void;
    const createRepo = vi.fn(() => new Promise<ReturnType<typeof createMemoryRepo>>((r) => (resolve = r)));
    render(
      <AuthGate auth={auth} isOwner={isOwner} createRepo={createRepo}>
        <Probe />
      </AuthGate>,
    );
    auth.emit(owner);
    expect(screen.getByText('Carico gli allenamenti')).toBeInTheDocument();
    auth.emit(null);
    await act(async () => resolve(createMemoryRepo()));
    expect(screen.getByRole('button', { name: 'Accedi con Google' })).toBeInTheDocument();
    expect(screen.queryByText(/stato:/)).not.toBeInTheDocument();
  });

  it('owner sign-out clears the local cache', async () => {
    const auth = fakeAuth();
    function Out() {
      const acc = useAccount();
      return <button onClick={() => void acc?.signOut()}>Esci</button>;
    }
    render(
      <AuthGate auth={auth} isOwner={isOwner} createRepo={async () => createMemoryRepo()}>
        <Out />
      </AuthGate>,
    );
    auth.emit(owner);
    await userEvent.click(await screen.findByRole('button', { name: 'Esci' }));
    expect(auth.signOutAndClear).toHaveBeenCalledOnce();
    expect(auth.signOut).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Accedi con Google' })).toBeInTheDocument();
  });

  it('shows an error when the repo cannot be created', async () => {
    const auth = fakeAuth();
    render(
      <AuthGate auth={auth} isOwner={isOwner} createRepo={() => Promise.reject(new Error('offline'))}>
        <Probe />
      </AuthGate>,
    );
    auth.emit(owner);
    expect(await screen.findByRole('alert')).toHaveTextContent('Archivio non raggiungibile');
    expect(screen.queryByText('offline')).not.toBeInTheDocument();
  });
});
