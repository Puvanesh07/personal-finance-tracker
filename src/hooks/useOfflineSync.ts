import { useEffect, useRef } from 'react';

import { auth } from '../services/firebase';
import toast from 'react-hot-toast';
import { useAgriStore } from '../store/agricultureStore';
import { useAttendanceStore } from '../store/attendanceStore';
import { usePortfolioStore } from '../store/portfolioStore';

export function useOfflineSync() {
  const wasOffline = useRef(false);
  const toastId = useRef<string | null>(null);

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
      const hydrate = usePortfolioStore.getState().hydrate;
      const promises: Promise<void>[] = [hydrate(user.uid)];

      const agriUid = useAgriStore.getState().uid;
      const attUid = useAttendanceStore.getState().uid;
      if (agriUid) {
        promises.push(useAgriStore.getState().hydrate(user.uid));
      }
      if (attUid) {
        promises.push(useAttendanceStore.getState().hydrate(user.uid));
      }

      const results = await Promise.allSettled(promises);
      return { ok: !results.some((r) => r.status === 'rejected') };
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

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      dismissToast();
    };
  }, []);
}
