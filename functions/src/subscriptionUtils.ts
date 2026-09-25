import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';

let _db: Firestore | null = null;

export function getDb(): Firestore {
  if (!_db) {
    if (getApps().length === 0) {
      initializeApp();
    }
    _db = getFirestore();
  }
  return _db;
}

export type Plan = 'trial' | 'monthly' | 'yearly' | 'lifetime';

export const PLAN_AMOUNTS_INR: Record<Exclude<Plan, 'trial'>, number> = {
  monthly: 99,
  yearly: 599,
  lifetime: 899,
};

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function buildTrialFields(now = new Date()) {
  const trialStart = now;
  const trialEnd = addDays(now, 7);
  const gracePeriodEnd = addDays(trialEnd, 30);
  return {
    plan: 'trial' as const,
    subscriptionStatus: 'active' as const,
    trialStart: Timestamp.fromDate(trialStart),
    trialEnd: Timestamp.fromDate(trialEnd),
    expiresAt: Timestamp.fromDate(trialEnd),
    gracePeriodEnd: Timestamp.fromDate(gracePeriodEnd),
    paymentId: null,
    premiumGranted: false,
  };
}

export function getExpiresAtForPlan(plan: Exclude<Plan, 'trial'>, now = new Date()): Timestamp | null {
  switch (plan) {
    case 'monthly':
      return Timestamp.fromDate(addDays(now, 30));
    case 'yearly':
      return Timestamp.fromDate(addDays(now, 365));
    case 'lifetime':
      return null;
  }
}

/**
 * Mirror the entitlement into the Firebase Auth token so security rules can
 * enforce it without reading the users document. Called from every place that
 * changes a plan, so claims can never drift from Firestore state.
 */
export async function syncAuthClaims(uid: string, plan: Plan, active: boolean): Promise<void> {
  try {
    if (getApps().length === 0) initializeApp();
    await getAuth().setCustomUserClaims(uid, {
      plan,
      premium: active && plan !== 'trial',
    });
  } catch (err) {
    // Claims are defence-in-depth on top of the users doc — never fail a
    // payment because the Auth API hiccuped. The next token refresh retries.
    console.warn('[syncAuthClaims] failed', uid, (err as Error)?.message);
  }
}

export async function createSubscriptionNotification(
  uid: string,
  payload: { title: string; message: string; type: string },
) {
  await getDb().collection('notifications').doc(uid).collection('items').add({
    ...payload,
    read: false,
    createdAt: Timestamp.now(),
  });
}

export async function deleteCollection(path: string, batchSize = 200): Promise<void> {
  const collectionRef = getDb().collection(path);
  const query = collectionRef.limit(batchSize);
  const snapshot = await query.get();
  if (snapshot.empty) return;

  const batch = getDb().batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();

  if (snapshot.size >= batchSize) {
    await deleteCollection(path, batchSize);
  }
}

export const USER_SUBCOLLECTIONS = [
  'investments',
  'snapshots',
  'liabilities',
  'cashflows',
  'goals',
  'goalContributions',
  'accounts',
  'soldTrades',
  'pendingPayments',
  'trackedPayments',
  'credentials',
  'insurancePolicies',
  'insurancePayments',
  'sipPlans',
  'networthSnapshots',
  'insights',
  'settings',
  // Payment receipts and the legacy push-registration docs. Left out of this
  // list they survived every deletion, which is a GDPR hole: a customer who
  // asked to be forgotten kept a paid-receipt trail and a FCM device token.
  'orders',
  'notificationDevices',
  'pushSent',
];

/** Collections wiped during the soft-delete phase, before the hard purge. */
export const SENSITIVE_SUBCOLLECTIONS = ['credentials', 'notificationDevices', 'pushSent'];

export async function deleteAllUserData(uid: string): Promise<void> {
  for (const collection of USER_SUBCOLLECTIONS) {
    await deleteCollection(`users/${uid}/${collection}`);
  }
  await deleteCollection(`notifications/${uid}/items`);
  await getDb().collection('users').doc(uid).delete();
}

export async function activatePaidPlan(
  uid: string,
  plan: Exclude<Plan, 'trial'>,
  paymentId: string,
): Promise<void> {
  const now = new Date();
  const expiresAt = getExpiresAtForPlan(plan, now);
  const gracePeriodEnd = expiresAt
    ? Timestamp.fromDate(new Date(expiresAt.toDate().getTime() + 30 * 24 * 60 * 60 * 1000))
    : null;

  await getDb().collection('users').doc(uid).set(
    {
      plan,
      subscriptionStatus: 'active',
      expiresAt: expiresAt ?? null,
      gracePeriodEnd,
      paymentId,
      premiumGranted: false,
      trialEnd: null,
      updatedAt: Timestamp.now(),
    },
    { merge: true },
  );

  await createSubscriptionNotification(uid, {
    title: 'Subscription activated',
    message: `Your ${plan} plan is now active. Enjoy premium features!`,
    type: 'success',
  });

  await syncAuthClaims(uid, plan, true);
}

export async function grantPremiumAccess(uid: string, email?: string | null): Promise<void> {
  const payload: Record<string, unknown> = {
    plan: 'lifetime',
    subscriptionStatus: 'active',
    premiumGranted: true,
    expiresAt: null,
    gracePeriodEnd: null,
    trialEnd: null,
    paymentId: null,
    updatedAt: Timestamp.now(),
  };
  if (email) {
    payload.email = email.trim().toLowerCase();
  }

  await getDb().collection('users').doc(uid).set(payload, { merge: true });

  await createSubscriptionNotification(uid, {
    title: 'Premium access activated',
    message: 'You have complimentary lifetime premium access.',
    type: 'success',
  });

  await syncAuthClaims(uid, 'lifetime', true);
}

export async function revokePremiumAccess(uid: string): Promise<void> {
  const trial = buildTrialFields();
  await getDb().collection('users').doc(uid).set(
    {
      ...trial,
      premiumGranted: false,
      updatedAt: Timestamp.now(),
    },
    { merge: true },
  );

  await createSubscriptionNotification(uid, {
    title: 'Premium access removed',
    message: 'Your complimentary access has ended. Subscribe to continue using premium features.',
    type: 'info',
  });

  await syncAuthClaims(uid, 'trial', true);
}

export async function resetUserToTrial(uid: string): Promise<void> {
  const trial = buildTrialFields();
  await getDb().collection('users').doc(uid).set(
    {
      ...trial,
      premiumGranted: false,
      updatedAt: Timestamp.now(),
    },
    { merge: true },
  );

  await createSubscriptionNotification(uid, {
    title: 'Subscription reset',
    message: 'Your account is back on the 7-day trial for testing.',
    type: 'info',
  });

  await syncAuthClaims(uid, 'trial', true);
}

export async function findUidByEmail(email: string): Promise<string> {
  const normalized = email.trim().toLowerCase();

  // Prefer Firebase Auth — works even if Firestore email field is missing/mismatched.
  try {
    if (getApps().length === 0) initializeApp();
    const authUser = await getAuth().getUserByEmail(normalized);
    return authUser.uid;
  } catch {
    // Fall through to Firestore lookup
  }

  const snap = await getDb()
    .collection('users')
    .where('email', '==', normalized)
    .limit(1)
    .get();

  if (!snap.empty) {
    return snap.docs[0].id;
  }

  // Case-insensitive scan (legacy docs may store mixed-case emails)
  const all = await getDb().collection('users').select('email').get();
  const match = all.docs.find((d) => {
    const e = d.data()?.email;
    return typeof e === 'string' && e.trim().toLowerCase() === normalized;
  });
  if (match) return match.id;

  throw new Error(`No user found for email: ${normalized}`);
}
