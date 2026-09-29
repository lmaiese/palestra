// Firestore with persistent IndexedDB cache (offline + cheap reopenings).
// Import this module lazily (dynamic import) after the owner check.
import { signOut } from 'firebase/auth';
import {
  clearIndexedDbPersistence,
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  terminate,
  type Firestore,
} from 'firebase/firestore';
import { getAuthInstance, getFirebaseApp } from './firebase';

let db: Firestore | null = null;

export function getDb(): Firestore {
  if (!db) {
    db = initializeFirestore(getFirebaseApp(), {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
    if (import.meta.env.VITE_USE_EMULATORS === '1') {
      connectFirestoreEmulator(db, '127.0.0.1', 8080);
    }
  }
  return db;
}

/**
 * Owner sign-out: stops Firestore, wipes the IndexedDB cache (no workout data left on the
 * device), then signs out. Any repo built on the previous db is dead afterwards: create a new
 * one with getDb() on the next sign-in (or reload the page).
 */
export async function signOutAndClear(): Promise<void> {
  const instance = getDb();
  db = null;
  try {
    await terminate(instance);
    await clearIndexedDbPersistence(instance);
  } finally {
    await signOut(getAuthInstance());
  }
}
