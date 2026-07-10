// src/Auth/AuthWrapper.tsx
//
// FIXES:
//  1. BrowserRouter is now in main.tsx (parent), so useNavigate works here
//  2. On login success → navigate to /dashboard instead of relying on
//     re-render, eliminating the 2-3 second flash of the auth page
//  3. Proper "initialising" guard prevents any flicker

import { useEffect, useRef, useState } from 'react';

import AuthPage from './AuthPage';
import { Loader } from '../components/loader/Loader';
import { auth } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { usePortfolioStore } from '../store/portfolioStore';
import { useAgriStore } from '../store/agricultureStore';
import { useAttendanceStore } from '../store/attendanceStore';

export default function AuthWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  // Three possible states:
  //  'init'       → Firebase hasn't replied yet → show full-screen loader
  //  'logged-out' → Firebase confirmed no session → show AuthPage
  //  'logged-in'  → Firebase confirmed session + stores hydrated → show app
  const [authState, setAuthState] = useState<
    'init' | 'logged-out' | 'logged-in'
  >('init');

  const hydrate = usePortfolioStore((s) => s.hydrate);
  const clearAllData = usePortfolioStore((s) => s.clearAllData);
  const clearAgri = useAgriStore((s) => s.clearAll);
  const clearAttendance = useAttendanceStore((s) => s.clearAll);

  const navigate = useNavigate();

  // Track if we already navigated on this session to avoid double-navigate
  const hasNavigated = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Show the app immediately; hydrate stores in the background.
        setAuthState('logged-in');

        if (!hasNavigated.current) {
          hasNavigated.current = true;
          const path = window.location.pathname;
          if (path === '/' || path === '') {
            navigate('/dashboard', { replace: true });
          }
        }

        try {
          await hydrate(user.uid);
        } catch {
          toast.error(
            'Some data failed to load. Check your connection and refresh.',
          );
        }
      } else {
        clearAllData();
        clearAgri();
        clearAttendance();
        hasNavigated.current = false;
        setAuthState('logged-out');
      }
    });

    return () => unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Waiting for Firebase to confirm auth state ─────────────────────────
  if (authState === 'init') return <Loader />;

  // ── Firebase confirmed: not logged in ─────────────────────────────────
  if (authState === 'logged-out') return <AuthPage />;

  // ── Firebase confirmed: logged in, data hydrated ───────────────────────
  return <>{children}</>;
}
