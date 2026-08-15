import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { auth } from '../services/firebase';
import {
  initializeTrialIfMissing,
  listenSubscriptionNotifications,
  listenUserSubscription,
} from '../services/subscriptionService';
import type { SubscriptionNotification, UserSubscriptionDoc } from '../types/subscription';
import {
  canCreateTransactions,
  getDaysRemaining,
  getGraceDaysRemaining,
  getTrialDaysRemaining,
  hasPremiumAccess,
  isExpiredStatus,
  isTrialPlan,
  setCreateTransactionsChecker,
  toDate,
} from '../utils/subscriptionUtils';

interface SubscriptionContextValue {
  userSubscription: UserSubscriptionDoc | null;
  loading: boolean;
  hasPremiumAccess: boolean;
  daysRemaining: number | null;
  isTrial: boolean;
  isExpired: boolean;
  graceDaysRemaining: number | null;
  trialDaysRemaining: number | null;
  canCreateTransactions: boolean;
  notifications: SubscriptionNotification[];
  refreshSubscription: () => Promise<void>;
  dismissUpgradeModalForSession: () => void;
  upgradeModalDismissed: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

function mapUserDoc(data: Record<string, unknown> | null): UserSubscriptionDoc | null {
  if (!data) return null;
  return data as unknown as UserSubscriptionDoc;
}

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [userSubscription, setUserSubscription] = useState<UserSubscriptionDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<SubscriptionNotification[]>([]);
  const [upgradeModalDismissed, setUpgradeModalDismissed] = useState(false);

  const refreshSubscription = useCallback(async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
      await initializeTrialIfMissing();
    } catch (err) {
      console.warn('[Subscription] initializeTrialIfMissing failed:', err);
    }
  }, []);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setUserSubscription(null);
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    let initialized = false;

    const unsubUser = listenUserSubscription(
      uid,
      async (data) => {
        const mapped = mapUserDoc(data);
        setUserSubscription(mapped);
        setLoading(false);

        if (!initialized && mapped) {
          initialized = true;
          if (!mapped.plan || mapped.premiumGranted === undefined) {
            await refreshSubscription();
          }
        }
      },
      () => setLoading(false),
    );

    const unsubNotifs = listenSubscriptionNotifications(uid, setNotifications);

    return () => {
      unsubUser();
      unsubNotifs();
    };
  }, [refreshSubscription]);

  const premium = hasPremiumAccess(userSubscription);
  const expired = isExpiredStatus(userSubscription);
  const trial = isTrialPlan(userSubscription);
  const daysRemaining = getDaysRemaining(userSubscription);
  const graceDaysRemaining = getGraceDaysRemaining(userSubscription);
  const trialDaysRemaining = getTrialDaysRemaining(userSubscription);
  const canCreate = canCreateTransactions(userSubscription);

  useEffect(() => {
    setCreateTransactionsChecker(() => canCreateTransactions(userSubscription));
  }, [userSubscription, canCreate]);

  const value = useMemo<SubscriptionContextValue>(
    () => ({
      userSubscription,
      loading,
      hasPremiumAccess: premium,
      daysRemaining,
      isTrial: trial,
      isExpired: expired,
      graceDaysRemaining,
      trialDaysRemaining,
      canCreateTransactions: canCreate,
      notifications,
      refreshSubscription,
      dismissUpgradeModalForSession: () => setUpgradeModalDismissed(true),
      upgradeModalDismissed,
    }),
    [
      userSubscription,
      loading,
      premium,
      daysRemaining,
      trial,
      expired,
      graceDaysRemaining,
      trialDaysRemaining,
      canCreate,
      notifications,
      refreshSubscription,
      upgradeModalDismissed,
    ],
  );

  return (
    <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }
  return ctx;
}

export function useSubscriptionOptional() {
  return useContext(SubscriptionContext);
}

export function formatSubscriptionDate(
  value: UserSubscriptionDoc['expiresAt'],
): string {
  const date = toDate(value);
  if (!date) return '—';
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
