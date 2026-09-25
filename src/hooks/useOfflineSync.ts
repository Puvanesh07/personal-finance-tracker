import { useEffect, useRef } from 'react';

import { auth } from '../services/firebase';
import toast from 'react-hot-toast';
import { usePortfolioStore } from '../store/portfolioStore';

export function useOfflineSync() {
  const wasOffline = useRef(false);
  const toastId = useRef<string | null>(null);
  const lastFocusSync = useRef(0);

  useEffect(() => {
    const dismissToast = () => {
      if (toastId.current) {
        toast.dismiss(toastId.current);
        toastId.current = null;
      }
    };

    const syncStores = async () => {
      const user = auth.currentUser;
      if (!user) return { ok: true };
      // Cheap path: one settings read tells us which collections actually moved
      // while we were away, and only those are refetched. hydrate() without
      // `force` is now a no-op for the signed-in user, so calling it here would
      // silently re-read nothing (before) or every collection (wasteful).
      const { refreshIfStale, hydrate } = usePortfolioStore.getState();
      try {
        await refreshIfStale();
      } catch {
        // Stamps unreadable (offline again, rules change, …): fall back to the
        // full force reload so a reconnect is never a silent no-sync.
        await hydrate(user.uid, { force: true });
      }
      return { ok: true };
    };

    const handleOnline = async () => {
      if (!wasOffline.current) return;
      wasOffline.current = false;
      dismissToast();
      toast.success('Back online — syncing your data…', { duration: 3000 });
      try {
        const { ok } = await syncStores();
        if (ok) {
          toast.success('Data synchronized', { duration: 2500 });
        } else {
          toast.error('Some data failed to sync — try refreshing');
        }
      } catch {
        toast.error('Sync failed — will retry when connection is stable');
      }
    };

    const handleOffline = () => {
      wasOffline.current = true;
      dismissToast();
      toastId.current = toast(
        'You are in Offline Mode. Viewing cached data.',
        {
          duration: Infinity,
          icon: '📡',
          style: {
            background: '#1e293b',
            color: '#f8fafc',
            border: '1px solid #334155',
          },
        },
      ) as string;
    };

    if (!navigator.onLine) handleOffline();

    // Coming back to a tab that has been open for a while is the other moment
    // data can be out of date (edited on the phone, or in another tab). Same
    // cheap stamp check, throttled so rapid tab switching costs nothing.
    const handleFocus = async () => {
      if (!navigator.onLine || !auth.currentUser) return;
      if (Date.now() - lastFocusSync.current < 45_000) return;
      lastFocusSync.current = Date.now();
      try {
        await syncStores();
      } catch {
        /* background refresh must never surface an error */
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('focus', handleFocus);
      dismissToast();
    };
  }, []);
}
