// Firestore with persistent IndexedDB cache (offline + cheap reopenings).
// Import this module lazily (dynamic import) after the owner check.
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { getFirebaseApp } from './firebase';

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
