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
import { useAgriStore } from '../store/agricultureStore';
import { useAttendanceStore } from '../store/attendanceStore';
import { useNavigate } from 'react-router-dom';
import { usePortfolioStore } from '../store/portfolioStore';

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
  const hydrateAgri = useAgriStore((s) => s.hydrate);
  const clearAgri = useAgriStore((s) => s.clearAll);
  const hydrateAttendance = useAttendanceStore((s) => s.hydrate);
  const clearAttendance = useAttendanceStore((s) => s.clearAll);

  const navigate = useNavigate();

  // Track if we already navigated on this session to avoid double-navigate
  const hasNavigated = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Hydrate all stores in parallel for faster load
        await Promise.all([
          hydrate(user.uid),
          hydrateAgri(user.uid),
          hydrateAttendance(user.uid),
        ]);
        setAuthState('logged-in');

        // Navigate to dashboard on first login detection
        // (avoids the brief flash where auth page is visible)
        if (!hasNavigated.current) {
          hasNavigated.current = true;
          // Only redirect if we're at root or auth-looking path
          const path = window.location.pathname;
          if (path === '/' || path === '') {
            navigate('/dashboard', { replace: true });
          }
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
