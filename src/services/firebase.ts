import { GoogleAuthProvider, browserLocalPersistence, getAuth, setPersistence } from 'firebase/auth';
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
const app = initializeApp(firebaseConfig);

// 2. Initialize App Check (reCAPTCHA Enterprise)
if (typeof window !== 'undefined') {
  // Allow localhost testing by flagging the debug token
  if (import.meta.env.DEV) {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    (window as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }

  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(
      import.meta.env.VITE_RECAPTCHA_SITE_KEY || 'YOUR_RECAPTCHA_SITE_KEY',
    ),
    isTokenAutoRefreshEnabled: true,
  });
}

// 3. Initialize Firestore WITH Offline Persistence
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

// 4. Initialize Auth (explicit local persistence for session restore)
export const auth = getAuth(app);
if (typeof window !== 'undefined') {
  void setPersistence(auth, browserLocalPersistence).catch((err) =>
    console.warn('[Firebase] auth persistence:', err),
  );
}
export const googleProvider = new GoogleAuthProvider();

// 5. Initialize Analytics (Only in Production)
if (typeof window !== 'undefined' && import.meta.env.PROD) {
  getAnalytics(app);
}
