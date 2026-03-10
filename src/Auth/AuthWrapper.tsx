// src/components/auth/AuthWrapper.tsx
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../src/services/firebase';
import { usePortfolioStore } from '../../src/store/portfolioStore';
import AuthPage from '../../src/Auth/AuthPage';

export default function AuthWrapper({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // These functions connect to your updated store below
  const hydrate = usePortfolioStore((s) => s.hydrate);
  const clearAllData = usePortfolioStore((s) => s.clearAllData);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Pass the user ID to the database!
        await hydrate(currentUser.uid);
      } else {
        clearAllData();
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [hydrate, clearAllData]);

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>;
  }

  // If not logged in, show the Google Sign In page
  if (!user) {
    return <AuthPage />;
  }

  // If logged in, show the actual Finance Tracker app
  return <>{children}</>;
}