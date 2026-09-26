import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import * as logger from 'firebase-functions/logger';
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
// import { onSchedule } from 'firebase-functions/v2/scheduler';
import { Timestamp } from 'firebase-admin/firestore';

import {
  getDb,
  getExpiresAtForPlan,
  activatePaidPlan,
  grantPremiumAccess,
  revokePremiumAccess,
  findUidByEmail,
  syncAuthClaims,
  deleteAllUserData,
  USER_SUBCOLLECTIONS,
  type Plan,
} from './subscriptionUtils';
import {
  createOrder,
  fetchPayment,
  fetchOrder,
  listRecentPayments,
  verifyPaymentSignature,
  verifyWebhookSignature,
  razorpaySecrets,
  webhookSecrets,
  ownerSecrets,
  getOwnerEmail,
  isRazorpayTestMode,
  initiateUpiCollectPayment,
} from './razorpay';
import {
  assertPaymentMatchesOrder,
  claimOrderPaid,
  isPaidPlan,
  recordCreatedOrder,
  resolvePaidPlan,
  type PaidPlan,
} from './payments';
import { handleRazorpayEvent } from './webhook';

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
    if (!isPaidPlan(plan)) {
      throw new HttpsError('invalid-argument', 'Invalid plan');
    }

    const order = await createOrder(plan, request.auth.uid);

    // Remember what we quoted, so verification (and the webhook) can check the
    // money that actually arrived against the plan we offered.
    await recordCreatedOrder(request.auth.uid, {
      orderId: order.orderId,
      plan,
      amount: order.amount,
      currency: order.currency ?? 'INR',
    });

    return order;
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
    const { paymentId, orderId } = request.data ?? {};
    if (!paymentId || !orderId) {
      throw new HttpsError('invalid-argument', 'Missing payment details');
    }

    const payment = await fetchPayment(paymentId);
    if (String(payment.method ?? '') !== 'upi') {
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

    // The order decides the plan; the client's claim is only a hint.
    const order = await fetchOrder(orderId);
    const plan = resolvePaidPlan(order, request.data?.plan);
    assertPaymentMatchesOrder(payment, order!, orderId);

    const claimed = await claimOrderPaid(uid, orderId, String(paymentId), {
      plan,
      amount: Number(order?.amount ?? 0),
    });
    if (!claimed) {
      const snap = await getDb().collection('users').doc(uid).get();
      return {
        success: true,
        plan: (snap.data()?.plan as PaidPlan) ?? plan,
        pending: false,
        status,
        alreadyApplied: true,
      };
    }

    await activatePaidPlan(uid, plan, String(paymentId));
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

    if (action === 'expireNow') {
      const targetEmail = typeof email === 'string' ? email : '';
      if (!targetEmail) {
        throw new HttpsError('invalid-argument', 'email is required');
      }
      const uid = await findUidByEmail(targetEmail);
      const now = new Date();
      const trialEnd = Timestamp.fromDate(now);
      await getDb().collection('users').doc(uid).set(
        {
          plan: 'trial' as Plan,
          subscriptionStatus: 'expired',
          trialEnd,
          expiresAt: trialEnd,
          gracePeriodEnd: Timestamp.fromDate(new Date(now.getTime() + 60_000)),
          updatedAt: Timestamp.now(),
        },
        { merge: true },
      );
      await syncAuthClaims(uid, 'trial', false);
      return { success: true, action, uid };
    }

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

    if (action === 'syncClaims') {
      // One-time rollout of custom claims: existing customers have none until
      // their next token refresh, and rules/limits want them straight away.
      const allUsers = await getDb().collection('users').get();
      let updated = 0;

      for (const docSnap of allUsers.docs) {
        const d = docSnap.data() ?? {};
        const plan = (d.plan as Plan) || 'trial';
        const expiresAt = d.expiresAt?.toDate?.() as Date | undefined;
        const active =
          d.premiumGranted === true ||
          plan === 'lifetime' ||
          (d.subscriptionStatus === 'active' && (!expiresAt || expiresAt.getTime() > Date.now()));
        await syncAuthClaims(docSnap.id, plan, active);
        updated += 1;
      }

      return { success: true, action, updated, total: allUsers.size };
    }

    if (action === 'reconcilePayments') {
      // "I paid but I'm still locked out" is the worst support ticket there is,
      // and with the webhook it no longer has to exist. This finds every
      // captured Razorpay payment that our user records do not reflect, and
      // optionally re-activates it through the same code path as the webhook.
      const apply = request.data?.apply === true;
      const { checked, mismatches } = await runPaymentReconcile(apply);
      return { success: true, action, checked, mismatches };
    }

    throw new HttpsError('invalid-argument', 'Unknown action');
  },
);

type ReconcileMismatch = {
  paymentId: string;
  orderId: string;
  uid: string;
  amount: number;
  action: string;
};

/** Find captured Razorpay payments that no user record reflects, and (when
 *  `apply` is true) re-activate them through the same code path the webhook
 *  uses. Shared by the admin action and the daily schedule (audit C7). */
async function runPaymentReconcile(
  apply: boolean,
): Promise<{ checked: number; mismatches: ReconcileMismatch[] }> {
  const payments = await listRecentPayments(100);
  const db = getDb();
  const mismatches: ReconcileMismatch[] = [];

  for (const payment of payments) {
    if (String(payment.status) !== 'captured' && String(payment.status) !== 'authorized') {
      continue;
    }
    const uid = String(payment.notes?.userId ?? '');
    if (!uid) continue;

    const userSnap = await db.collection('users').doc(uid).get();
    const user = userSnap.data() ?? {};
    const alreadyApplied = user.paymentId === payment.id || user.premiumGranted === true;
    if (alreadyApplied) continue;

    let what = 'missing activation';
    if (apply) {
      const order = await fetchOrder(String(payment.order_id ?? ''));
      if (order) {
        const plan = resolvePaidPlan(order, order.notes?.plan);
        assertPaymentMatchesOrder(payment, order, String(payment.order_id ?? ''));
        const claimed = await claimOrderPaid(uid, String(payment.order_id), String(payment.id), {
          plan,
          amount: Number(order.amount),
        });
        if (claimed) {
          await activatePaidPlan(uid, plan, String(payment.id));
          what = `activated ${plan}`;
        } else {
          what = 'order already applied';
        }
      }
    }

    mismatches.push({
      paymentId: String(payment.id ?? ''),
      orderId: String(payment.order_id ?? ''),
      uid,
      amount: Number(payment.amount ?? 0) / 100,
      action: what,
    });
  }

  return { checked: payments.length, mismatches };
}

/** dailyPaymentReconcile — safety net for the "I paid, still locked out"
 *  ticket. Runs once a day, self-heals any captured-but-unapplied payments,
 *  and emits a structured error log (for Cloud Logging alerting) if anything
 *  slipped past the webhook. Scheduled functions are billed per invocation —
 *  not as idle Cloud Run containers — so this stays free at launch volumes. */
// export const dailyPaymentReconcile = onSchedule(
//   {
//     region,
//     secrets: [...razorpaySecrets, ...ownerSecrets],
//     schedule: 'every 24 hours from 6:00pm',
//     timeZone: 'Asia/Kolkata',
//     timeoutSeconds: 300,
//   },
//   async () => {
//     try {
//       const { checked, mismatches } = await runPaymentReconcile(true);
//       if (mismatches.length === 0) {
//         logger.info('dailyPaymentReconcile: all payments reconciled', { checked });
//         return;
//       }
//       logger.error('dailyPaymentReconcile: payment activation mismatches (webhook gaps)', {
//         checked,
//         count: mismatches.length,
//         mismatches,
//       });
//     } catch (err) {
//       logger.error('dailyPaymentReconcile failed', err);
//     }
//   },
// );

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
    } = request.data ?? {};

    if (!orderId || !paymentId || !signature) {
      throw new HttpsError('invalid-argument', 'Missing payment details');
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

      // The ORDER is authoritative. Without this, a ₹99 order plus a body
      // claiming `plan: 'lifetime'` bought a lifetime licence.
      const order = await fetchOrder(orderId);
      const plan = resolvePaidPlan(order, request.data?.plan);
      assertPaymentMatchesOrder(payment, order!, orderId);

      const claimed = await claimOrderPaid(uid, orderId, paymentId, {
        plan,
        amount: Number(order?.amount ?? 0),
      });
      if (!claimed) {
        const snap = await getDb().collection('users').doc(uid).get();
        return {
          success: true,
          plan: (snap.data()?.plan as PaidPlan) ?? plan,
          alreadyApplied: true,
        };
      }

      await activatePaidPlan(uid, plan, paymentId);
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

/**
 * Razorpay server→server webhook — the authoritative activation path.
 *
 * Deliberately NOT a callable: no Firebase token is sent by Razorpay, so this
 * authenticates purely by HMAC over the raw body. Answers 200 for anything it
 * cannot handle, because a non-200 makes Razorpay retry the same event for
 * hours and every retry lands on the dedupe table anyway.
 */
export const razorpayWebhook = onRequest(
  { region, secrets: webhookSecrets, maxInstances: 5, timeoutSeconds: 54 },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(200).send('ok');
      return;
    }

    const signature = String(req.header('x-razorpay-signature') ?? '');
    try {
      if (!signature || !verifyWebhookSignature(req.rawBody ?? Buffer.from(''), signature)) {
        logger.warn('Rejected Razorpay webhook: bad signature');
        res.status(401).send('invalid signature');
        return;
      }
      const outcome = await handleRazorpayEvent(req.body as Record<string, unknown>);
      logger.info('razorpayWebhook', { outcome });
      res.status(200).send(outcome);
    } catch (err) {
      logger.error('razorpayWebhook failed', err);
      // 500 → Razorpay retries. Only do that for transient failures, which is
      // what an exception is; signature rejection above returns 401 instead.
      res.status(500).send('error');
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
        const resolvedPlan = (plan === 'trial' ? 'monthly' : plan) as Exclude<Plan, 'trial'>;
        const newExpires = getExpiresAtForPlan(resolvedPlan);
        await getDb().collection('users').doc(uid).set(
          {
            subscriptionStatus: 'active',
            expiresAt: newExpires,
            gracePeriodEnd: newExpires
              ? Timestamp.fromDate(new Date(newExpires.toDate().getTime() + 30 * 86_400_000))
              : null,
            paidAmount: Number(payment.amount ?? 0) / 100,
            updatedAt: Timestamp.now(),
          },
          { merge: true },
        );
        await syncAuthClaims(uid, resolvedPlan, true);
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

// ── Account lifecycle (audit C6 — data portability & right-to-erasure) ─────

/** Recent sign-in gate (5 min). Deleting an account or exporting everything is
 *  high-impact, so we refuse to run on a stale session an unlocked device could
 *  replay. Mirrors Firebase's own `requires-recent-login` posture. */
function assertRecentLogin(request: { auth?: { token: { auth_time?: number } } }) {
  const authTime = request.auth?.token?.auth_time ?? 0;
  const FIVE_MIN = 5 * 60;
  if (Date.now() / 1000 - authTime > FIVE_MIN) {
    throw new HttpsError(
      'permission-denied',
      'Please sign in again to continue (recent authentication required).',
    );
  }
}

/** exportMyData — full, structured JSON of everything the user owns.
 *  Satisfies GDPR/IT-Amendment Act data-portability: the client downloads it as
 *  a file. Timestamps serialize to {_seconds,_nanoseconds} by Firestore. */
export const exportMyData = onCall(callableOptions, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }
  assertRecentLogin(request);
  const uid = request.auth.uid;
  const db = getDb();

  const profile = (await db.collection('users').doc(uid).get()).data() ?? null;

  const collections: Record<string, unknown[]> = {};
  for (const col of USER_SUBCOLLECTIONS) {
    const snap = await db.collection(`users/${uid}/${col}`).get();
    collections[col] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  const notifSnap = await db
    .collection(`notifications/${uid}/items`)
    .get()
    .catch(() => null);

  return {
    exportedAt: new Date().toISOString(),
    uid,
    profile,
    collections,
    notifications: notifSnap ? notifSnap.docs.map((d) => ({ id: d.id, ...d.data() })) : [],
  };
});

/** deleteMyAccount — irreversible erasure of every document + the auth user.
 *  Reuses the same `deleteAllUserData` the admin purge uses (all 20
 *  sub-collections + notifications + the user doc), then deletes the login so
 *  the uid can never read anything again. Client must re-auth first. */
export const deleteMyAccount = onCall(callableOptions, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }
  assertRecentLogin(request);
  const uid = request.auth.uid;

  // Belt-and-braces: require the client to echo a confirmation token so a
  // mis-fired call can never wipe an account.
  if (request.data?.confirm !== 'DELETE') {
    throw new HttpsError('invalid-argument', 'Missing confirmation');
  }

  await deleteAllUserData(uid);
  try {
    await getAuth().deleteUser(uid);
  } catch (err) {
    // Data is already gone; a lingering auth user is not a privacy leak, but
    // surface it so we can clean up.
    logger.error('deleteMyAccount: data deleted but auth user removal failed', err);
    return { deleted: true, authDeleted: false };
  }
  logger.info('deleteMyAccount: account fully deleted', { uid });
  return { deleted: true, authDeleted: true };
});
 

// expireSubscriptions — removed from Cloud Functions.
// Now runs as a free GitHub Actions workflow:
// .github/workflows/subscription-maintenance.yml
// (runs daily at 12:30 AM IST, zero cost)

// deleteExpiredUsers — removed from Cloud Functions.
// Also handled by the same GitHub Actions workflow above.