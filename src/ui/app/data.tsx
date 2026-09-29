// App-wide data contexts. Screens read sessions from here and never touch Firebase.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { SessionRepo } from '../../domain/repo';
import type { WorkoutSession, WorkoutSessionInput } from '../../domain/types';
import { todayISO } from '../lib/format';

export type SessionsState =
  | { status: 'loading'; sessions: WorkoutSession[] }
  | { status: 'ready'; sessions: WorkoutSession[] }
  | { status: 'error'; sessions: WorkoutSession[]; error: string };

export interface SessionsApi {
  state: SessionsState;
  save(input: WorkoutSessionInput, id?: string): Promise<string>;
  remove(id: string): Promise<void>;
  retry(): void;
}

const noRepo = async () => {
  throw new Error('Archivio non disponibile');
};

const SessionsContext = createContext<SessionsApi>({
  state: { status: 'ready', sessions: [] },
  save: noRepo,
  remove: noRepo,
  retry: () => {},
});

export function SessionsProvider({ repo, children }: { repo: SessionRepo; children: ReactNode }) {
  const [state, setState] = useState<SessionsState>({ status: 'loading', sessions: [] });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // One shared listener for the whole app (DoD C4).
    const unsub = repo.subscribe(
      (sessions) => setState({ status: 'ready', sessions }),
      (e) =>
        setState((prev) => ({
          status: 'error',
          sessions: prev.sessions,
          error: e.message || 'Errore sconosciuto',
        })),
    );
    return unsub;
  }, [repo, attempt]);

  const api = useMemo<SessionsApi>(
    () => ({
      state,
      save: (input, id) => repo.save(input, id),
      remove: (id) => repo.remove(id),
      retry: () => {
        setState((prev) => ({ status: 'loading', sessions: prev.sessions }));
        setAttempt((a) => a + 1);
      },
    }),
    [repo, state],
  );

  return <SessionsContext.Provider value={api}>{children}</SessionsContext.Provider>;
}

/** Static provider for tests and for rendering plan screens without a repo. */
export function StaticSessions({ value, children }: { value: SessionsApi; children: ReactNode }) {
  return <SessionsContext.Provider value={value}>{children}</SessionsContext.Provider>;
}

export function useSessions(): SessionsApi {
  return useContext(SessionsContext);
}

/** Sessions sorted newest first. */
export function useSessionList(): WorkoutSession[] {
  const { state } = useSessions();
  return useMemo(
    () => [...state.sessions].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id.localeCompare(a.id))),
    [state.sessions],
  );
}

// "Today" is injectable so tests and screenshots are deterministic.
const TodayContext = createContext<() => string>(todayISO);

export function TodayProvider({ today, children }: { today: string; children: ReactNode }) {
  const fn = useMemo(() => () => today, [today]);
  return <TodayContext.Provider value={fn}>{children}</TodayContext.Provider>;
}

export function useToday(): string {
  return useContext(TodayContext)();
}

// Account info for the shell (sign-out button, email).
export interface Account {
  email: string;
  signOut(): void;
}
const AccountContext = createContext<Account | null>(null);
export const AccountProvider = AccountContext.Provider;
export function useAccount(): Account | null {
  return useContext(AccountContext);
}
