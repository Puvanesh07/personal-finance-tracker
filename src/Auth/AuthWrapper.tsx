// src/Auth/AuthWrapper.tsx

import { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import AuthPage from './AuthPage';
import { Loader } from '../components/loader/Loader';
import { SubscriptionProvider } from '../context/SubscriptionContext';
import { auth } from '../services/firebase';
import {
  consumeRedirectResultOnce,
  ensureAuthPersistence,
  peekCurrentUser,
} from './authBootstrap';
import { googleSignInErrorMessage } from './googleSignIn';
import { usePortfolioStore } from '../store/portfolioStore';
import { useAgriStore } from '../store/agricultureStore';
import { useAttendanceStore } from '../store/attendanceStore';
import { useNotificationStore } from '../store/notificationStore';

export default function AuthWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const [authState, setAuthState] = useState<
    'init' | 'logged-out' | 'logged-in'
  >('init');

  const hydrate = usePortfolioStore((s) => s.hydrate);
  const resetSession = usePortfolioStore((s) => s.resetSession);
  const clearAgri = useAgriStore((s) => s.clearAll);
  const clearAttendance = useAttendanceStore((s) => s.clearAll);
  const setNotifScope = useNotificationStore((s) => s.setScope);
  const clearNotifScope = useNotificationStore((s) => s.clearScope);

  const navigate = useNavigate();
  const hasNavigated = useRef(false);
  const activeUid = useRef<string | null>(null);
  const authReady = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    const handleLoggedIn = (user: User) => {
      if (cancelled) return;
      const isSameUser = activeUid.current === user.uid;
      activeUid.current = user.uid;
      // Set notification scope FIRST — before adding any notifications,
      // so addNotification() isn't rejected by the uid guard, and the
      // persisted bucket for this user is loaded correctly.
      setNotifScope(user.uid);
      setAuthState('logged-in');

      if (isSameUser) return;

      if (!hasNavigated.current) {
        hasNavigated.current = true;
        navigate('/dashboard', { replace: true });
      }

      void hydrate(user.uid).catch(() => {
        toast.error(
          'Some data failed to load. Check your connection and refresh.',
        );
      });
      void useAgriStore.getState().hydrate(user.uid);
      void useAttendanceStore.getState().hydrate(user.uid);
    };

    const handleLoggedOut = () => {
      if (cancelled || !authReady.current) return;
      activeUid.current = null;
      resetSession();
      clearAgri();
      clearAttendance();
      clearNotifScope();
      hasNavigated.current = false;
      setAuthState('logged-out');
    };

    (async () => {
      await ensureAuthPersistence();
      if (cancelled) return;

      try {
        const redirectResult = await consumeRedirectResultOnce();
        if (cancelled) return;

        if (redirectResult?.user) {
          handleLoggedIn(redirectResult.user);
          toast.success('Welcome to FinTrackly! 🎉', {
            duration: 3000,
            style: {
              background: '#0f172a',
              color: '#f8fafc',
              border: '1px solid rgba(16,185,129,0.4)',
            },
            iconTheme: { primary: '#10b981', secondary: '#f8fafc' },
          });
        } else {
          const existing = peekCurrentUser();
          if (existing) handleLoggedIn(existing);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('[Auth] redirect result failed:', error);
          const message = googleSignInErrorMessage(error);
          if (message) toast.error(message);
        }
      }

      if (cancelled) return;

      authReady.current = true;

      unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) handleLoggedIn(user);
        else handleLoggedOut();
      });
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (authState === 'init') return <Loader />;
  if (authState === 'logged-out') return <AuthPage />;
  return <SubscriptionProvider>{children}</SubscriptionProvider>;
}
