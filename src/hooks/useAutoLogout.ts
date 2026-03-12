import { useEffect, useRef } from 'react';

import { auth } from '../services/firebase';
import { signOut } from 'firebase/auth';
import toast from 'react-hot-toast';

const INACTIVITY_MS = 10 * 60 * 1000; // 10 minutes
const WARNING_MS = 9 * 60 * 1000; // warn at 9 minutes
const LAST_ACTIVE_KEY = 'ft_last_active';

export function useAutoLogout() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastIdRef = useRef<string | null>(null);

  useEffect(() => {
    const clearTimers = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (warningRef.current) clearTimeout(warningRef.current);
      if (toastIdRef.current) {
        toast.dismiss(toastIdRef.current);
        toastIdRef.current = null;
      }
    };

    const scheduleLogout = () => {
      clearTimers();

      const lastActive = parseInt(
        localStorage.getItem(LAST_ACTIVE_KEY) || '0',
        10,
      );
      const now = Date.now();
      const elapsed = now - lastActive;
      const remainingTotal = INACTIVITY_MS - elapsed;

      if (remainingTotal <= 0) {
        handleLogout();
        return;
      }

      const remainingWarning = WARNING_MS - elapsed;
      if (remainingWarning > 0) {
        warningRef.current = setTimeout(() => {
          toastIdRef.current = toast(
            'You will be logged out in 1 minute due to inactivity.',
            { duration: 60000, icon: '⏱️' },
          ) as string;
        }, remainingWarning);
      }

      timerRef.current = setTimeout(handleLogout, remainingTotal);
    };

    const handleLogout = async () => {
      clearTimers();
      localStorage.removeItem(LAST_ACTIVE_KEY);
      toast.error('Session expired. You have been logged out.');
      await signOut(auth);
      window.location.href = '/';
    };

    const onActivity = () => {
      localStorage.setItem(LAST_ACTIVE_KEY, Date.now().toString());
      scheduleLogout();
    };

    if (!localStorage.getItem(LAST_ACTIVE_KEY)) {
      localStorage.setItem(LAST_ACTIVE_KEY, Date.now().toString());
    }

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach((e) =>
      window.addEventListener(e, onActivity, { passive: true }),
    );
    scheduleLogout();

    return () => {
      clearTimers();
      events.forEach((e) => window.removeEventListener(e, onActivity));
    };
  }, []);
}
