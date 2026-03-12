import {
  GoogleAuthProvider,
  getAuth,
  inMemoryPersistence,
  setPersistence,
} from 'firebase/auth';

import { getAnalytics } from 'firebase/analytics';
import { getFirestore } from 'firebase/firestore';
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

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// inMemoryPersistence = session lives only in RAM.
// Closing the browser/tab clears it → user must log in again every time.
setPersistence(auth, inMemoryPersistence).catch((err) =>
  console.error('Failed to set auth persistence:', err),
);

if (typeof window !== 'undefined') {
  getAnalytics(app);
}
