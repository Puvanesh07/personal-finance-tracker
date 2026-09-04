import { initializeApp, getApps } from 'firebase-admin/app';
import * as logger from 'firebase-functions/logger';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { Timestamp } from 'firebase-admin/firestore';

import {
  getDb,
  getExpiresAtForPlan,
  activatePaidPlan,
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

// Ensure Admin SDK is ready before any callable runs.
if (getApps().length === 0) {
  initializeApp();
}

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
  // Scale to zero when idle — eliminates minimum-instance charges.
  // Cold start adds ~1-2s on first call but saves ≈₹6-8/month at low user counts.
  minInstances: 0,
};

// onUserProfileCreated — removed.
// Trial initialization is now handled entirely client-side in
// src/services/subscriptionService.ts → initializeTrialIfMissing()
// This eliminates the Firestore trigger Cloud Run container cost.

// initializeTrialIfMissing cloud function — removed.
// All logic moved to the client. No server round-trip needed on login.
// See src/services/subscriptionService.ts for the replacement.

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

// simulateTestSubscription and resetTestSubscription intentionally removed from production.
// They only worked in Razorpay test mode and contributed idle Cloud Run container costs
// with zero production value. Use the Firebase emulator locally if you need them.

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
        await grantPremiumAccess(uid, email.trim().toLowerCase());
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
  { ...callableOptions, secrets: [...razorpaySecrets, ...ownerSecrets] },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const uid = request.auth.uid;
    const callerEmail = request.auth.token?.email?.trim().toLowerCase() ?? '';
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

    try {
      const valid = verifyPaymentSignature(orderId, paymentId, signature);
      if (!valid) {
        throw new HttpsError('permission-denied', 'Invalid payment signature');
      }

      const payment = await fetchPayment(paymentId);
      const method = String(payment.method ?? '');
      // Standard Checkout may complete via UPI, card, or netbanking
      if (!['upi', 'card', 'netbanking'].includes(method)) {
        throw new HttpsError(
          'failed-precondition',
          `Unsupported payment method: ${method || 'unknown'}`,
        );
      }
      if (payment.status !== 'captured' && payment.status !== 'authorized') {
        throw new HttpsError('failed-precondition', 'Payment not completed');
      }

      const ownerEmail = getOwnerEmail();
      // Owner always keeps complimentary lifetime even after a paid checkout
      if (ownerEmail && callerEmail === ownerEmail) {
        await grantPremiumAccess(uid, callerEmail);
        return { success: true, plan: 'lifetime', ownerGranted: true };
      }

      await activatePaidPlan(uid, plan as Exclude<Plan, 'trial'>, paymentId);
      return { success: true, plan };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      logger.error('verifyRazorpayPayment failed', err);
      throw new HttpsError(
        'internal',
        err instanceof Error ? err.message : 'Payment verification failed',
      );
    }
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
 

// expireSubscriptions — removed from Cloud Functions.
// Now runs as a free GitHub Actions workflow:
// .github/workflows/subscription-maintenance.yml
// (runs daily at 12:30 AM IST, zero cost)

// deleteExpiredUsers — removed from Cloud Functions.
// Also handled by the same GitHub Actions workflow above.