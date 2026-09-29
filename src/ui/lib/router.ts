// Tiny hash router: #/piano/3/B → { path: ['piano', '3', 'B'] }.
import { useSyncExternalStore } from 'react';

type Blocker = () => boolean; // returns true when navigation may proceed

let blocker: Blocker | null = null;
let lastHash = typeof window === 'undefined' ? '' : window.location.hash;
let suppressNext = false;
const listeners = new Set<() => void>();

function currentHash(): string {
  return window.location.hash || '#/';
}

function onHashChange() {
  if (suppressNext) {
    suppressNext = false;
    return;
  }
  const next = window.location.hash;
  if (blocker && next !== lastHash && !blocker()) {
    // Undo the navigation (back button, manual link) without re-triggering the guard.
    suppressNext = true;
    window.location.hash = lastHash;
    return;
  }
  lastHash = next;
  listeners.forEach((l) => l());
}

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', onHashChange);
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useHash(): string {
  return useSyncExternalStore(subscribe, currentHash, () => '#/');
}

export function parseHash(hash: string): string[] {
  const clean = hash.replace(/^#\/?/, '').split('?')[0];
  return clean.split('/').filter(Boolean).map(decodeURIComponent);
}

export function parseQuery(hash: string): URLSearchParams {
  const i = hash.indexOf('?');
  return new URLSearchParams(i >= 0 ? hash.slice(i + 1) : '');
}

export function useQuery(): URLSearchParams {
  return parseQuery(useHash());
}

export function useRoute(): string[] {
  return parseHash(useHash());
}

/** Navigate to "/piano/3". Respects the unsaved-changes guard unless `force`. */
export function navigate(to: string, opts: { force?: boolean; replace?: boolean } = {}): boolean {
  const target = `#${to.startsWith('/') ? to : `/${to}`}`;
  if (target === window.location.hash) return true;
  if (!opts.force && blocker && !blocker()) return false;
  if (opts.force) blocker = null;
  lastHash = target;
  if (opts.replace) {
    window.history.replaceState(null, '', target);
  } else {
    window.history.pushState(null, '', target);
  }
  listeners.forEach((l) => l());
  document.documentElement.scrollTop = 0;
  return true;
}

export function setNavigationBlocker(b: Blocker | null) {
  blocker = b;
}

export function href(to: string): string {
  return `#${to.startsWith('/') ? to : `/${to}`}`;
}
