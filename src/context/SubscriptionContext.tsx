import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../services/firebase';
import {
  initializeTrialIfMissing,
  listenSubscriptionNotifications,
  listenUserSubscription,
} from '../services/subscriptionService';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { SubscriptionNotification, UserSubscriptionDoc } from '../types/subscription';
import {
  OWNER_EMAIL,
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

async function ensureOwnerPremiumInFirestore(uid: string, email: string) {
  await setDoc(
    doc(db, 'users', uid),
    {
      email: email.trim().toLowerCase(),
      plan: 'lifetime',
      subscriptionStatus: 'active',
      premiumGranted: true,
      expiresAt: null,
      gracePeriodEnd: null,
      trialEnd: null,
      paymentId: null,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

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
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null);
  const [authEmail, setAuthEmail] = useState<string | null>(
    auth.currentUser?.email ?? null,
  );
  const [userSubscription, setUserSubscription] = useState<UserSubscriptionDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<SubscriptionNotification[]>([]);
  const [upgradeModalDismissed, setUpgradeModalDismissed] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? null);
      setAuthEmail(user?.email ?? null);
      if (!user) {
        setUserSubscription(null);
        setNotifications([]);
        setLoading(false);
      }
    });
  }, []);

  const refreshSubscription = useCallback(async () => {
    const user = auth.currentUser;
    if (!user?.uid) return;
    const email = user.email?.trim().toLowerCase() ?? '';
    const isOwner = email === OWNER_EMAIL;
    try {
      await initializeTrialIfMissing();
      if (isOwner) {
        await ensureOwnerPremiumInFirestore(user.uid, email);
      }
    } catch (err) {
      console.warn('[Subscription] refresh failed:', err);
      if (isOwner) {
        try {
          await ensureOwnerPremiumInFirestore(user.uid, email);
        } catch (inner) {
          console.warn('[Subscription] owner self-grant failed:', inner);
        }
      }
    }
  }, []);

  useEffect(() => {
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

        if (!initialized) {
          initialized = true;
          const email =
            mapped?.email?.toString().trim().toLowerCase() ||
            auth.currentUser?.email?.trim().toLowerCase() ||
            '';
          const needsOwnerGrant =
            email === OWNER_EMAIL &&
            (!mapped ||
              mapped.premiumGranted !== true ||
              mapped.plan !== 'lifetime' ||
              mapped.subscriptionStatus === 'expired');
          const needsTrialInit = !mapped || !mapped.plan || mapped.premiumGranted === undefined;
          if (needsTrialInit || needsOwnerGrant) {
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
  }, [uid, refreshSubscription]);

  const premium = hasPremiumAccess(userSubscription, authEmail);
  const expired = isExpiredStatus(userSubscription, authEmail);
  const trial = isTrialPlan(userSubscription);
  const daysRemaining = getDaysRemaining(userSubscription);
  const graceDaysRemaining = getGraceDaysRemaining(userSubscription);
  const trialDaysRemaining = getTrialDaysRemaining(userSubscription);
  const canCreate = canCreateTransactions(userSubscription, authEmail);

  useEffect(() => {
    setCreateTransactionsChecker(() =>
      canCreateTransactions(userSubscription, auth.currentUser?.email),
    );
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
