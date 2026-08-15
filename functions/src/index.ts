import * as logger from 'firebase-functions/logger';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { Timestamp } from 'firebase-admin/firestore';
import {
  buildTrialFields,
  createSubscriptionNotification,
  getDb,
  deleteAllUserData,
  getExpiresAtForPlan,
  activatePaidPlan,
  resetUserToTrial,
  grantPremiumAccess,
  revokePremiumAccess,
  findUidByEmail,
  type Plan,
} from './subscriptionUtils';
import {
  createOrder,
  fetchPayment,
  verifyPaymentSignature,
  razorpaySecrets,
  ownerSecrets,
  getOwnerEmail,
  isRazorpayTestMode,
  initiateUpiCollectPayment,
} from './razorpay';

// Load root .env when running in the Functions emulator
if (process.env.FUNCTIONS_EMULATOR === 'true') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('dotenv').config({
    path: require('path').resolve(__dirname, '../../.env'),
  });
}

const region = 'asia-south1';
const callableOptions = {
  region,
  // Allow all origins; Firebase Auth still protects every callable.
  cors: true as const,
  invoker: 'public' as const,
};

export const onUserProfileCreated = onDocumentCreated(
  { document: 'users/{uid}', region },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const data = snap.data();
    if (data.plan) return;

    const trial = buildTrialFields();
    await snap.ref.set(
      {
        ...trial,
        updatedAt: Timestamp.now(),
      },
      { merge: true },
    );

    await createSubscriptionNotification(event.params.uid, {
      title: 'Welcome to FinTrackly!',
      message: 'Your 7-day free trial has started. Enjoy all premium features.',
      type: 'success',
    });
  },
);

export const initializeTrialIfMissing = onCall(
  { ...callableOptions, secrets: ownerSecrets },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const uid = request.auth.uid;
    const callerEmail = request.auth.token?.email?.trim().toLowerCase() ?? '';
    const ownerEmail = getOwnerEmail();
    const ref = getDb().collection('users').doc(uid);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new HttpsError('not-found', 'User profile not found');
    }

    const data = snap.data() ?? {};

    // Owner account always gets complimentary lifetime premium
    if (ownerEmail && callerEmail === ownerEmail && data.premiumGranted !== true) {
      await grantPremiumAccess(uid);
      return { initialized: false, synced: true, ownerGranted: true };
    }

    const updates: Record<string, unknown> = {};

    if (!data.plan) {
      Object.assign(updates, buildTrialFields());
    } else if (!('premiumGranted' in data)) {
      updates.premiumGranted = false;
    }

    if (Object.keys(updates).length === 0) {
      return { initialized: false, synced: false };
    }

    await ref.set(
      {
        ...updates,
        updatedAt: Timestamp.now(),
      },
      { merge: true },
    );

    return { initialized: !data.plan, synced: true };
  },
);

export const createRazorpayOrder = onCall(
  { ...callableOptions, secrets: razorpaySecrets },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const plan = request.data?.plan as Plan | undefined;
    if (!plan || !['monthly', 'yearly', 'lifetime'].includes(plan)) {
      throw new HttpsError('invalid-argument', 'Invalid plan');
    }

    return createOrder(plan as Exclude<Plan, 'trial'>);
  },
);

/** Send UPI collect request to customer's VPA (e.g. puvanesh@ybl) */
export const initiateUpiCollect = onCall(
  { ...callableOptions, secrets: razorpaySecrets, timeoutSeconds: 30 },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { orderId, vpa, email, contact, amount, plan } = request.data ?? {};
    if (!vpa || typeof vpa !== 'string') {
      throw new HttpsError('invalid-argument', 'UPI ID is required');
    }

    const normalizedVpa = vpa.trim().toLowerCase();

    if (isRazorpayTestMode() && normalizedVpa === 'success@razorpay') {
      if (!plan || !['monthly', 'yearly', 'lifetime'].includes(plan)) {
        throw new HttpsError('invalid-argument', 'Invalid plan');
      }
      const paymentId = `test_pay_${Date.now()}`;
      await activatePaidPlan(
        request.auth.uid,
        plan as Exclude<Plan, 'trial'>,
        paymentId,
      );
      return { paymentId, simulated: true, captured: true };
    }

    if (isRazorpayTestMode() && normalizedVpa === 'failure@razorpay') {
      throw new HttpsError('failed-precondition', 'Test payment declined');
    }

    if (!orderId || !email || !amount) {
      throw new HttpsError('invalid-argument', 'Missing UPI payment details');
    }

    return initiateUpiCollectPayment({
      orderId,
      amount: Number(amount),
      vpa: normalizedVpa,
      email,
      contact: contact || '9999999999',
    });
  },
);

/** Poll until customer approves UPI request, then activate subscription */
export const confirmUpiPayment = onCall(
  { ...callableOptions, secrets: razorpaySecrets },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const uid = request.auth.uid;
    const { paymentId, orderId, plan } = request.data ?? {};
    if (!paymentId || !orderId || !plan) {
      throw new HttpsError('invalid-argument', 'Missing payment details');
    }
    if (!['monthly', 'yearly', 'lifetime'].includes(plan)) {
      throw new HttpsError('invalid-argument', 'Invalid plan');
    }

    const payment = await fetchPayment(paymentId);
    if (payment.order_id !== orderId) {
      throw new HttpsError('permission-denied', 'Payment does not match order');
    }
    if (payment.method !== 'upi') {
      throw new HttpsError(
        'failed-precondition',
        'Only UPI payments are accepted',
      );
    }

    const status = String(payment.status);
    if (status === 'created' || status === 'pending') {
      return { success: false, pending: true, status };
    }

    if (status === 'failed') {
      return { success: false, pending: false, status: 'failed' };
    }

    if (status !== 'captured' && status !== 'authorized') {
      return { success: false, pending: true, status };
    }

    await activatePaidPlan(uid, plan as Exclude<Plan, 'trial'>, paymentId);
    return { success: true, plan, pending: false, status };
  },
);

/** Test Mode only — simulates a successful UPI payment when QR/VPA is unavailable on desktop */
export const simulateTestSubscription = onCall(
  callableOptions,
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    if (!isRazorpayTestMode()) {
      throw new HttpsError(
        'permission-denied',
        'Test simulation is only available with Razorpay Test Mode keys',
      );
    }

    const plan = request.data?.plan as Plan | undefined;
    if (!plan || !['monthly', 'yearly', 'lifetime'].includes(plan)) {
      throw new HttpsError('invalid-argument', 'Invalid plan');
    }

    const uid = request.auth.uid;
    const paymentId = `test_pay_${Date.now()}`;
    await activatePaidPlan(uid, plan as Exclude<Plan, 'trial'>, paymentId);

    return { success: true, plan, simulated: true };
  },
);

/** Test Mode only — reset current user back to trial so you can test payment again */
export const resetTestSubscription = onCall(
  callableOptions,
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    if (!isRazorpayTestMode()) {
      throw new HttpsError(
        'permission-denied',
        'Reset is only available with Razorpay Test Mode keys',
      );
    }

    const uid = request.auth.uid;
    await resetUserToTrial(uid);
    return { success: true, reset: true };
  },
);

function assertOwnerEmail(request: { auth?: { token?: { email?: string } } }) {
  const ownerEmail = getOwnerEmail();
  const callerEmail = request.auth?.token?.email?.trim().toLowerCase();
  if (!ownerEmail || !callerEmail || callerEmail !== ownerEmail) {
    throw new HttpsError('permission-denied', 'Owner access only');
  }
}

/** Owner only — grant or revoke complimentary premium by email */
export const adminManageSubscription = onCall(
  { ...callableOptions, secrets: ownerSecrets },
  async (request) => {
    assertOwnerEmail(request);

    const { action, email, enabled } = request.data ?? {};

    if (action === 'backfillPremiumGranted') {
      const allUsers = await getDb().collection('users').get();
      let updated = 0;

      for (const docSnap of allUsers.docs) {
        if ('premiumGranted' in (docSnap.data() ?? {})) continue;

        await docSnap.ref.set(
          {
            premiumGranted: false,
            updatedAt: Timestamp.now(),
          },
          { merge: true },
        );

        updated += 1;
      }

      return {
        success: true,
        action,
        updated,
        total: allUsers.size,
      };
    }

    if (action === 'setPremiumAccess') {
      if (!email || typeof email !== 'string') {
        throw new HttpsError('invalid-argument', 'email is required');
      }

      if (typeof enabled !== 'boolean') {
        throw new HttpsError(
          'invalid-argument',
          'enabled must be true or false',
        );
      }

      let uid: string;

      try {
        uid = await findUidByEmail(email);
      } catch {
        throw new HttpsError('not-found', `No user found for ${email}`);
      }

      if (enabled) {
        await grantPremiumAccess(uid);
      } else {
        await revokePremiumAccess(uid);
      }

      return {
        success: true,
        action,
        email,
        uid,
        premiumGranted: enabled,
      };
    }

    throw new HttpsError('invalid-argument', 'Unknown action');
  },
);

export const verifyRazorpayPayment = onCall(
  { ...callableOptions, secrets: razorpaySecrets },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const uid = request.auth.uid;
    const {
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
      plan,
    } = request.data ?? {};

    if (!orderId || !paymentId || !signature || !plan) {
      throw new HttpsError('invalid-argument', 'Missing payment details');
    }
    if (!['monthly', 'yearly', 'lifetime'].includes(plan)) {
      throw new HttpsError('invalid-argument', 'Invalid plan');
    }

    const valid = verifyPaymentSignature(orderId, paymentId, signature);
    if (!valid) {
      throw new HttpsError('permission-denied', 'Invalid payment signature');
    }

    const payment = await fetchPayment(paymentId);
    if (payment.method !== 'upi') {
      throw new HttpsError(
        'failed-precondition',
        'Only UPI payments are accepted',
      );
    }
    if (payment.status !== 'captured' && payment.status !== 'authorized') {
      throw new HttpsError('failed-precondition', 'Payment not completed');
    }

    await activatePaidPlan(uid, plan as Exclude<Plan, 'trial'>, paymentId);

    return { success: true, plan };
  },
);

export const restorePurchase = onCall(
  { ...callableOptions, secrets: razorpaySecrets },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const uid = request.auth.uid;
    const snap = await getDb().collection('users').doc(uid).get();
    const data = snap.data();

    if (!data?.paymentId) {
      return {
        restored: false,
        message: 'No previous payment found for this account.',
      };
    }

    if (data.premiumGranted === true || data.plan === 'lifetime') {
      return { restored: true, message: 'Lifetime access is already active.' };
    }

    const expiresAt = data.expiresAt?.toDate?.() as Date | undefined;
    if (
      expiresAt &&
      expiresAt.getTime() > Date.now() &&
      data.subscriptionStatus === 'active'
    ) {
      return {
        restored: true,
        message: 'Your subscription is already active.',
      };
    }

    try {
      const payment = await fetchPayment(data.paymentId);
      if (payment.status === 'captured' || payment.status === 'authorized') {
        const plan = (data.plan as Plan) || 'monthly';
        const newExpires = getExpiresAtForPlan(
          plan === 'trial' ? 'monthly' : (plan as Exclude<Plan, 'trial'>),
        );
        await getDb().collection('users').doc(uid).set(
          {
            subscriptionStatus: 'active',
            expiresAt: newExpires,
            updatedAt: Timestamp.now(),
          },
          { merge: true },
        );
        return { restored: true, message: 'Purchase restored successfully.' };
      }
    } catch (err) {
      logger.warn('restorePurchase failed', err);
    }

    return {
      restored: false,
      message: 'Could not verify previous payment with Razorpay.',
    };
  },
);

export const expireSubscriptions = onSchedule(
  {
    schedule: 'every 24 hours',
    region,
    timeZone: 'Asia/Kolkata',
  },
  async () => {
    const now = Timestamp.now();
    const snapshot = await getDb()
      .collection('users')
      .where('subscriptionStatus', '==', 'active')
      .where('expiresAt', '<=', now)
      .get();

    logger.info(`expireSubscriptions: found ${snapshot.size} users`);

    for (const docSnap of snapshot.docs) {
      const uid = docSnap.id;
      const data = docSnap.data();
      if (data.premiumGranted === true) continue;
      if (data.plan === 'lifetime') continue;
      if (!data.expiresAt) continue;

      await docSnap.ref.set(
        {
          subscriptionStatus: 'expired',
          updatedAt: Timestamp.now(),
        },
        { merge: true },
      );

      await createSubscriptionNotification(uid, {
        title: 'Trial expired',
        message:
          'Premium features are locked. Data deletion in 30 days if you do not subscribe.',
        type: 'warning',
      });
    }
  },
);

export const deleteExpiredUsers = onSchedule(
  {
    schedule: 'every 24 hours',
    region,
    timeZone: 'Asia/Kolkata',
  },
  async () => {
    const now = Timestamp.now();
    const snapshot = await getDb()
      .collection('users')
      .where('subscriptionStatus', '==', 'expired')
      .where('gracePeriodEnd', '<=', now)
      .get();

    logger.info(`deleteExpiredUsers: found ${snapshot.size} users`);

    for (const docSnap of snapshot.docs) {
      if (docSnap.data().premiumGranted === true) continue;
      const uid = docSnap.id;
      try {
        await deleteAllUserData(uid);
        logger.info(`Deleted all data for user ${uid}`);
      } catch (err) {
        logger.error(`Failed to delete user ${uid}`, err);
      }
    }
  },
);
