// Auth abstraction so the shell can be tested without Firebase.

export interface AuthUser {
  email: string | null;
  emailVerified: boolean;
  displayName?: string | null;
  providerData: { providerId: string }[];
}

export interface AuthAdapter {
  /** Calls back with the current user (null = signed out). Returns unsubscribe. */
  onChange(cb: (user: AuthUser | null) => void): () => void;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  /** Owner sign-out: also wipes the local Firestore cache. */
  signOutAndClear(): Promise<void>;
}
