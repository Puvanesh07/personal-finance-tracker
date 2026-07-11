import { auth, googleProvider } from '../services/firebase';
import { signInWithPopup, signInWithRedirect } from 'firebase/auth';
import { ensureAuthPersistence } from './authBootstrap';

function isPopupFallbackError(code?: string) {
  return (
    code === 'auth/popup-blocked' ||
    code === 'auth/operation-not-supported-in-this-environment'
  );
}

function isUserCancelled(code?: string) {
  return (
    code === 'auth/popup-closed-by-user' ||
    code === 'auth/cancelled-popup-request'
  );
}

/** Popup first; redirect only when the browser blocks the popup. */
export async function signInWithGoogle(): Promise<'popup' | 'redirect'> {
  await ensureAuthPersistence();

  try {
    await signInWithPopup(auth, googleProvider);
    return 'popup';
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code;
    if (isUserCancelled(code)) throw error;
    if (isPopupFallbackError(code)) {
      await signInWithRedirect(auth, googleProvider);
      return 'redirect';
    }
    throw error;
  }
}

export function googleSignInErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code;
  if (code === 'auth/network-request-failed') {
    return 'Network error. Check your connection and try again.';
  }
  if (code === 'auth/app-check-token-fetch-failed') {
    return 'Security check failed. Disable strict tracking blockers or try another browser.';
  }
  if (code === 'auth/unauthorized-domain') {
    return 'This site is not authorized for sign-in. Contact support.';
  }
  if (code === 'auth/account-exists-with-different-credential') {
    return 'An account already exists with this email using a different sign-in method.';
  }
  if (isUserCancelled(code)) {
    return '';
  }
  return 'Sign-in failed. Please try again.';
}
