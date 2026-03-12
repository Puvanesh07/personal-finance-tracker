// src/hooks/useAutoLogout.ts

import { useEffect, useRef } from 'react';

import { auth } from '../services/firebase';
import { signOut } from 'firebase/auth';
import toast from 'react-hot-toast';

const INACTIVITY_TIME = 10 * 60 * 1000; // 10 minutes
const WARNING_TIME = 9 * 60 * 1000; // warn at 9 minutes

export function useAutoLogout() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastIdRef = useRef<string | null>(null);

  useEffect(() => {
    const clearTimers = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (warningRef.current) clearTimeout(warningRef.current);
      if (toastIdRef.current) toast.dismiss(toastIdRef.current);
    };

    const resetTimer = () => {
      clearTimers();

      // Warning toast at 9 minutes
      warningRef.current = setTimeout(() => {
        toastIdRef.current = toast(
          'You will be logged out in 1 minute due to inactivity.',
          { duration: 60000, icon: '⏱️' },
        ) as string;
      }, WARNING_TIME);

      // Auto logout at 10 minutes
      timerRef.current = setTimeout(async () => {
        clearTimers();
        toast.error('Session expired. You have been logged out.');
        await signOut(auth);
        window.location.href = '/';
      }, INACTIVITY_TIME);
    };

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach((e) =>
      window.addEventListener(e, resetTimer, { passive: true }),
    );
    resetTimer();

    return () => {
      clearTimers();
      events.forEach((e) => window.removeEventListener(e, resetTimer));
    };
  }, []);
}
