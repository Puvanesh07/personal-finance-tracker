// src/components/auth/AuthWrapper.tsx

import { useEffect, useState } from 'react';

import AuthPage from '../../src/Auth/AuthPage';
import { Loader } from '../../src/components/loader/Loader';
import { auth } from '../../src/services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useAgriStore } from '../../src/store/agricultureStore';
import { usePortfolioStore } from '../../src/store/portfolioStore';

export default function AuthWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // These functions connect to your updated store below
  const hydrate = usePortfolioStore((s) => s.hydrate);
  const clearAllData = usePortfolioStore((s) => s.clearAllData);
  const hydrateAgri = useAgriStore((s) => s.hydrate);
  const clearAgri = useAgriStore((s) => s.clearAll);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Pass the user ID to the database!
        await hydrate(currentUser.uid);
        await hydrateAgri(currentUser.uid);
      } else {
        clearAllData();
        clearAgri();
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [hydrate, clearAllData]);

  if (loading) {
    return <Loader />;
  }

  // If not logged in, show the Google Sign In page
  if (!user) {
    return <AuthPage />;
  }

  // If logged in, show the actual Finance Tracker app
  return <>{children}</>;
}
