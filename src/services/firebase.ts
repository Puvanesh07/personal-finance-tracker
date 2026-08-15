import {
  GoogleAuthProvider,
  getAuth,
} from 'firebase/auth';
import {
  ReCaptchaEnterpriseProvider,
  initializeAppCheck,
} from 'firebase/app-check';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

import { getAnalytics } from 'firebase/analytics';
import { initializeApp } from 'firebase/app';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// 1. Initialize Firebase App
export const app = initializeApp(firebaseConfig);

// 2. App Check — opt-in only (misconfigured App Check blocks all sign-in)
const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
const enableAppCheck =
  typeof window !== 'undefined' &&
  import.meta.env.VITE_ENABLE_APP_CHECK === 'true' &&
  recaptchaSiteKey &&
  recaptchaSiteKey !== 'YOUR_RECAPTCHA_SITE_KEY';

if (enableAppCheck) {
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(recaptchaSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (err) {
    console.warn('[Firebase] App Check disabled:', err);
  }
}

// 3. Initialize Firestore WITH Offline Persistence
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

// 4. Initialize Auth — persistence handled in authBootstrap before sign-in
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// 5. Initialize Analytics (Only in Production)
if (typeof window !== 'undefined' && import.meta.env.PROD) {
  getAnalytics(app);
}
