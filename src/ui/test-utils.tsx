import './test-cleanup';
// Test helpers: render the shell on a route with an in-memory repo (never Firebase).
import { render } from '@testing-library/react';
import { createMemoryRepo, type SessionRepo } from '../domain/repo';
import { seedSessions } from '../domain/seed';
import type { WorkoutSession } from '../domain/types';
import { AccountProvider, SessionsProvider, StaticSessions, TodayProvider, type SessionsApi } from './app/data';
import { ToastProvider } from './app/toast';
import { Shell } from './app/Shell';
import { setNavigationBlocker } from './lib/router';

export function go(path: string) {
  setNavigationBlocker(null);
  window.history.replaceState(null, '', `#${path}`);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export function renderApp(opts: { path?: string; today?: string; sessions?: WorkoutSession[]; repo?: SessionRepo } = {}) {
  const repo = opts.repo ?? createMemoryRepo(opts.sessions ?? seedSessions);
  go(opts.path ?? '/');
  const utils = render(
    <ToastProvider>
      <TodayProvider today={opts.today ?? '2026-09-29'}>
        <AccountProvider value={{ email: 'maieseluigi@gmail.com', signOut: () => {} }}>
          <SessionsProvider repo={repo}>
            <Shell />
          </SessionsProvider>
        </AccountProvider>
      </TodayProvider>
    </ToastProvider>,
  );
  return { ...utils, repo };
}

/** Renders with a fixed sessions state (loading / error / ready) and no repo at all. */
export function renderStatic(state: SessionsApi['state'], opts: { path?: string; today?: string } = {}) {
  go(opts.path ?? '/');
  const api: SessionsApi = {
    state,
    save: async () => 'x',
    remove: async () => {},
    retry: () => {},
  };
  return render(
    <ToastProvider>
      <TodayProvider today={opts.today ?? '2026-09-29'}>
        <StaticSessions value={api}>
          <Shell />
        </StaticSessions>
      </TodayProvider>
    </ToastProvider>,
  );
}

/** A repo whose listener always fails. */
export function failingRepo(message = 'permission-denied'): SessionRepo {
  return {
    subscribe(_onData, onError) {
      queueMicrotask(() => onError(new Error(message)));
      return () => {};
    },
    save: async () => {
      throw new Error(message);
    },
    remove: async () => {
      throw new Error(message);
    },
  };
}