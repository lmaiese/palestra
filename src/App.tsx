import { useMemo, type ReactNode } from 'react';
import { isOwner } from './firebase';
import { AuthGate } from './ui/app/AuthGate';
import { createFirebaseAuthAdapter } from './ui/app/firebaseAuth';
import { Shell } from './ui/app/Shell';
import { TodayProvider } from './ui/app/data';
import { ToastProvider } from './ui/app/toast';

// Firestore is loaded only here, lazily, after the owner check.
const createRepo = () => import('./ui/app/firestoreRepo').then((m) => m.createRepo());

/** Emulator builds only: e2e can pin "today" for deterministic screens. */
function pinnedToday(): string | null {
  if (import.meta.env.VITE_USE_EMULATORS !== '1') return null;
  try {
    return window.localStorage.getItem('palestra.today');
  } catch {
    return null;
  }
}

function WithToday({ children }: { children: ReactNode }) {
  const today = pinnedToday();
  return today ? <TodayProvider today={today}>{children}</TodayProvider> : <>{children}</>;
}

export default function App() {
  const auth = useMemo(() => createFirebaseAuthAdapter(), []);
  return (
    <ToastProvider>
      <WithToday>
        <AuthGate auth={auth} isOwner={isOwner} createRepo={createRepo}>
          <Shell />
        </AuthGate>
      </WithToday>
    </ToastProvider>
  );
}
