// Real AuthAdapter backed by Firebase Auth (Google only).
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth';
import { getAuthInstance } from '../../firebase';
import type { AuthAdapter } from './auth';

const POPUP_FALLBACK = new Set([
  'auth/popup-blocked',
  'auth/operation-not-supported-in-this-environment',
  'auth/web-storage-unsupported',
]);

export function createFirebaseAuthAdapter(): AuthAdapter {
  const auth = getAuthInstance();
  return {
    onChange(cb) {
      return onAuthStateChanged(auth, (u) => cb(u));
    },
    async signIn() {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      try {
        await signInWithPopup(auth, provider);
      } catch (e) {
        const code = (e as { code?: string }).code ?? '';
        if (POPUP_FALLBACK.has(code)) {
          await signInWithRedirect(auth, provider);
          return;
        }
        if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return;
        throw e;
      }
    },
    async signOut() {
      await signOut(auth);
    },
  };
}
