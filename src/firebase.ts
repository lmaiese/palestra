// Firebase app + Auth. No Firestore import here: the database lives in
// firebase-db.ts so it can be loaded lazily after the owner check.
// The web config is public by design (security comes from firestore.rules).
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';

export const OWNER_EMAIL = 'maieseluigi@gmail.com';

/** True only in `npm run dev:emu` / e2e builds; Vite inlines it so prod strips the emulator code. */
export const USE_EMULATORS = import.meta.env.VITE_USE_EMULATORS === '1';

const firebaseConfig = {
  apiKey: 'AIzaSyCtuV2ZAUyj8Qlhz3KtR_NqpIFlauTlvqQ',
  // Same site as the app, so the sign-in redirect/popup is first-party (Hosting serves /__/auth/*).
  authDomain: 'palestra-luigi.web.app',
  projectId: USE_EMULATORS ? 'demo-palestra' : 'palestra-luigi',
  storageBucket: 'palestra-luigi.firebasestorage.app',
  messagingSenderId: '740747247742',
  appId: '1:740747247742:web:a7a1ce76056ba9741b982f',
};

export interface OwnerCandidate {
  email: string | null;
  emailVerified: boolean;
  providerData: { providerId: string }[];
}

/** Mirrors firestore.rules: owner email (case-insensitive), verified, signed in with Google. */
export function isOwner(user: OwnerCandidate | null): boolean {
  if (!user || !user.email || !user.emailVerified) return false;
  if (user.email.toLowerCase() !== OWNER_EMAIL) return false;
  return user.providerData.some((p) => p.providerId === 'google.com');
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

export function getFirebaseApp(): FirebaseApp {
  app ??= initializeApp(firebaseConfig);
  return app;
}

export function getAuthInstance(): Auth {
  if (!auth) {
    auth = getAuth(getFirebaseApp());
    if (import.meta.env.VITE_USE_EMULATORS === '1') {
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    }
  }
  return auth;
}
