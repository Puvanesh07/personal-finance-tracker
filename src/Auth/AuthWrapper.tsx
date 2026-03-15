// src/Auth/AuthWrapper.tsx

import { useEffect, useState } from 'react';

import AuthPage from './AuthPage';
import { Loader } from '../components/loader/Loader';
import { auth } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useAgriStore } from '../store/agricultureStore';
import { useAttendanceStore } from '../store/attendanceStore';
import { useAutoLogout } from '../hooks/useAutoLogout';
import { usePortfolioStore } from '../store/portfolioStore';

export default function AuthWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const hydrate = usePortfolioStore((s) => s.hydrate);
  const clearAllData = usePortfolioStore((s) => s.clearAllData);
  const hydrateAgri = useAgriStore((s) => s.hydrate);
  const clearAgri = useAgriStore((s) => s.clearAll);
  const hydrateAttendance = useAttendanceStore((s) => s.hydrate);
  const clearAttendance = useAttendanceStore((s) => s.clearAll);

  // ✅ Mounted here — above the router — so it NEVER resets on route changes
  useAutoLogout();

  useEffect(() => {
    // onAuthStateChanged fires once on load with the persisted session
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsLoggedIn(true);
        // Hydrate store — ready flag is set inside hydrate()
        await hydrate(user.uid);
        await hydrateAgri(user.uid);
        await hydrateAttendance(user.uid);
      } else {
        setIsLoggedIn(false);
        clearAllData();
        clearAgri();
        clearAttendance();
      }
      // Always mark auth as checked so we stop showing the loader
      setAuthChecked(true);
    });

    return () => unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Still waiting for Firebase to confirm auth state
  if (!authChecked) return <Loader />;

  // Firebase confirmed: not logged in
  if (!isLoggedIn) return <AuthPage />;

  // Firebase confirmed: logged in, data hydrated
  return <>{children}</>;
}
