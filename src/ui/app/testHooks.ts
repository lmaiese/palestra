// Emulator-only helpers for Playwright. Imported only when VITE_USE_EMULATORS === '1'.
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { getAuthInstance } from '../../firebase';

declare global {
  interface Window {
    __palestraSignIn?: (email: string) => Promise<void>;
  }
}

export function install() {
  window.__palestraSignIn = async (email: string) => {
    // The Auth emulator accepts an unsigned Google id token.
    const token = JSON.stringify({ sub: `e2e-${email}`, email, email_verified: true });
    await signInWithCredential(getAuthInstance(), GoogleAuthProvider.credential(token));
  };
}
