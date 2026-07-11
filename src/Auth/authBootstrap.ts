import {
  browserLocalPersistence,
  getRedirectResult,
  setPersistence,
  type UserCredential,
} from 'firebase/auth';
import { auth } from '../services/firebase';

let persistenceReady: Promise<void> | null = null;
let redirectResultOnce: Promise<UserCredential | null> | null = null;

/** Ensure local persistence is configured before any sign-in / redirect handling. */
export function ensureAuthPersistence(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (!persistenceReady) {
    persistenceReady = setPersistence(auth, browserLocalPersistence)
      .then(() => undefined)
      .catch((err) => {
        console.warn('[Auth] persistence setup failed:', err);
      });
  }
  return persistenceReady;
}

/**
 * getRedirectResult can only succeed once per redirect.
 * Guard with a module singleton so React StrictMode double-mount does not break it.
 */
export function consumeRedirectResultOnce(): Promise<UserCredential | null> {
  if (!redirectResultOnce) {
    redirectResultOnce = (async () => {
      await ensureAuthPersistence();
      return getRedirectResult(auth);
    })();
  }
  return redirectResultOnce;
}

export function peekCurrentUser() {
  return auth.currentUser;
}
