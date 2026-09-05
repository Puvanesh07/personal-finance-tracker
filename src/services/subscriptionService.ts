import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
import type { PaidPlan, SubscriptionNotification } from '../types/subscription';
import { app, auth, db } from './firebase';

const functions = getFunctions(app, 'asia-south1');

if (import.meta.env.DEV && import.meta.env.VITE_USE_FUNCTIONS_EMULATOR === 'true') {
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}

export function listenUserSubscription(
  uid: string,
  onData: (data: Record<string, unknown> | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => onData(snap.exists() ? (snap.data() as Record<string, unknown>) : null),
    (err) => onError?.(err),
  );
}

export function listenSubscriptionNotifications(
  uid: string,
  onData: (items: SubscriptionNotification[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'notifications', uid, 'items'),
    orderBy('createdAt', 'desc'),
    limit(20),
  );

  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => {
        const data = d.data();
        const createdAt =
          data.createdAt && typeof data.createdAt.toDate === 'function'
            ? data.createdAt.toDate()
            : new Date();
        return {
          id: d.id,
          title: String(data.title ?? ''),
          message: String(data.message ?? ''),
          type: (data.type as SubscriptionNotification['type']) ?? 'info',
          read: Boolean(data.read),
          createdAt,
        };
      });
      onData(items);
    },
    (err) => onError?.(err),
  );
}

/** One-time fetch of subscription notifications — replaces the always-on
 *  onSnapshot listener to avoid persistent Firestore connection cost. */
export async function getSubscriptionNotificationsOnce(
  uid: string,
): Promise<SubscriptionNotification[]> {
  try {
    const q = query(
      collection(db, 'notifications', uid, 'items'),
      orderBy('createdAt', 'desc'),
      limit(20),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      const createdAt =
        data.createdAt && typeof data.createdAt.toDate === 'function'
          ? data.createdAt.toDate()
          : new Date();
      return {
        id: d.id,
        title: String(data.title ?? ''),
        message: String(data.message ?? ''),
        type: (data.type as SubscriptionNotification['type']) ?? 'info',
        read: Boolean(data.read),
        createdAt,
      };
    });
  } catch {
    return [];
  }
}

export async function markNotificationRead(uid: string, notificationId: string) {
  await updateDoc(doc(db, 'notifications', uid, 'items', notificationId), { read: true });
}

export async function markAllNotificationsRead(uid: string, unreadIds: string[]) {
  if (!unreadIds.length) return;
  // Use IDs passed from in-memory state — avoids a full collection read
  await Promise.all(
    unreadIds.map((id) =>
      updateDoc(doc(db, 'notifications', uid, 'items', id), { read: true }),
    ),
  );
}

export async function initializeTrialIfMissing(): Promise<void> {
  const uid = auth.currentUser?.uid;
  const email = auth.currentUser?.email?.trim().toLowerCase() ?? '';
  if (!uid) return;

  // Skip if already run this browser session — avoids a Firestore read on every refresh
  const sessionKey = `ft_trial_init_${uid}`;
  const ownerEmail = (import.meta.env.VITE_OWNER_EMAIL ?? '').trim().toLowerCase();
  const isOwner = ownerEmail && email === ownerEmail;
  // Always re-run for owner so their lifetime grant is kept current
  if (!isOwner && sessionStorage.getItem(sessionKey) === '1') return;

  const ref = doc(db, 'users', uid);

  try {
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : null;

    // Owner always gets lifetime access — set directly without calling Cloud Function
    if (isOwner) {
      if (data?.premiumGranted !== true || data?.plan !== 'lifetime') {
        await setDoc(ref, {
          email,
          plan: 'lifetime',
          subscriptionStatus: 'active',
          premiumGranted: true,
          expiresAt: null,
          gracePeriodEnd: null,
          trialEnd: null,
          paymentId: null,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }
      return;
    }

    // New user — doc doesn't exist yet, create trial
    if (!snap.exists()) {
      const now = new Date();
      const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const gracePeriodEnd = new Date(trialEnd.getTime() + 30 * 24 * 60 * 60 * 1000);
      await setDoc(ref, {
        uid,
        email,
        plan: 'trial',
        subscriptionStatus: 'active',
        trialStart: serverTimestamp(),
        trialEnd: Timestamp.fromDate(trialEnd),
        expiresAt: Timestamp.fromDate(trialEnd),
        gracePeriodEnd: Timestamp.fromDate(gracePeriodEnd),
        paymentId: null,
        premiumGranted: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      return;
    }

    // Existing user — fill in any missing fields only
    const updates: Record<string, unknown> = {};
    if (!data?.plan) {
      const now = new Date();
      const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const gracePeriodEnd = new Date(trialEnd.getTime() + 30 * 24 * 60 * 60 * 1000);
      updates.plan = 'trial';
      updates.subscriptionStatus = 'active';
      updates.trialEnd = Timestamp.fromDate(trialEnd);
      updates.expiresAt = Timestamp.fromDate(trialEnd);
      updates.gracePeriodEnd = Timestamp.fromDate(gracePeriodEnd);
    }
    if (!('premiumGranted' in (data ?? {}))) {
      updates.premiumGranted = false;
    }
    if (email && (!data?.email || String(data.email).toLowerCase() !== email)) {
      updates.email = email;
    }
    if (Object.keys(updates).length > 0) {
      await setDoc(ref, { ...updates, updatedAt: serverTimestamp() }, { merge: true });
    }
  } catch (err) {
    // Silently fail — subscription context will still read existing Firestore state
    console.warn('[initializeTrialIfMissing] client-side init failed:', err);
    return; // Don't set the session flag if the write failed
  }
  // Mark as done for this browser session so we skip the Firestore read on next refresh
  try { sessionStorage.setItem(sessionKey, '1'); } catch { /* private browsing */ }
}

export async function createRazorpayOrder(plan: PaidPlan): Promise<{
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  isTestMode: boolean;
}> {
  const fn = httpsCallable<{ plan: PaidPlan }, {
    orderId: string;
    amount: number;
    currency: string;
    keyId: string;
    isTestMode: boolean;
  }>(functions, 'createRazorpayOrder');
  const result = await fn({ plan });
  return result.data;
}

export async function adminManageSubscription(
  payload:
    | { action: 'setPremiumAccess'; email: string; enabled: boolean }
    | { action: 'backfillPremiumGranted' },
): Promise<
  | {
      success: boolean;
      action: string;
      email: string;
      uid: string;
      premiumGranted: boolean;
    }
  | { success: boolean; action: string; updated: number; total: number }
> {
  const fn = httpsCallable<typeof payload, Awaited<ReturnType<typeof adminManageSubscription>>>(
    functions,
    'adminManageSubscription',
  );
  const result = await fn(payload);
  return result.data;
}

export async function verifyRazorpayPayment(payload: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  plan: PaidPlan;
}): Promise<{ success: boolean; plan: PaidPlan }> {
  const fn = httpsCallable<
    typeof payload,
    { success: boolean; plan: PaidPlan }
  >(functions, 'verifyRazorpayPayment');
  const result = await fn(payload);
  return result.data;
}

export async function restorePurchase(): Promise<{ restored: boolean; message: string }> {
  const fn = httpsCallable<void, { restored: boolean; message: string }>(
    functions,
    'restorePurchase',
  );
  const result = await fn();
  return result.data;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown> | { key: string }) => {
      open?: () => void;
      createPayment: (
        data: Record<string, unknown>,
        intentOptions?: Record<string, unknown>,
      ) => void;
      on: (event: string, handler: (response: unknown) => void) => void;
    };
  }
}

export interface RazorpayPaymentResult {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export function isValidUpiId(vpa: string): boolean {
  return /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z0-9._-]{2,64}$/.test(vpa.trim());
}

function createRazorpayInstance(keyId: string) {
  if (!keyId.startsWith('rzp_')) {
    throw new Error('Invalid Razorpay configuration. Check RAZORPAY_KEY_ID in .env');
  }
  const razorpay = new window.Razorpay!({ key: keyId });
  if (typeof razorpay.createPayment !== 'function') {
    throw new Error('Razorpay custom checkout failed to load. Please refresh and try again.');
  }
  return razorpay;
}

function submitRazorpayPayment(
  keyId: string,
  paymentData: Record<string, unknown>,
  intentOptions?: Record<string, unknown>,
): Promise<RazorpayPaymentResult> {
  const razorpay = createRazorpayInstance(keyId);

  return new Promise((resolve, reject) => {
    const onSuccess = (response: unknown) => {
      const data = response as RazorpayPaymentResult;
      if (!data.razorpay_order_id || !data.razorpay_payment_id || !data.razorpay_signature) {
        reject(new Error('Invalid payment response from Razorpay'));
        return;
      }
      resolve(data);
    };

    const onError = (response: unknown) => {
      const err =
        typeof response === 'object' &&
        response &&
        'error' in response &&
        typeof (response as { error?: { description?: string } }).error?.description === 'string'
          ? (response as { error: { description: string } }).error.description
          : 'Payment failed';
      reject(new Error(err));
    };

    razorpay.on('payment.success', onSuccess);
    razorpay.on('payment.error', onError);
    razorpay.createPayment(paymentData, intentOptions);
  });
}

const RAZORPAY_CUSTOM_SCRIPT = 'https://checkout.razorpay.com/v1/razorpay.js';
const RAZORPAY_CHECKOUT_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load payment script')));
      // Already loaded
      if (window.Razorpay) {
        resolve();
        return;
      }
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load payment script'));
    document.body.appendChild(script);
  });
}

/** Standard Checkout (QR / UPI apps) — works on live merchants without S2S UPI collect. */
export async function payWithStandardCheckout(params: {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  email: string;
  contact: string;
  planName: string;
}): Promise<RazorpayPaymentResult> {
  await loadScript(RAZORPAY_CHECKOUT_SCRIPT);

  if (!window.Razorpay || typeof window.Razorpay !== 'function') {
    throw new Error('Razorpay Checkout failed to load. Please refresh and try again.');
  }

  return new Promise((resolve, reject) => {
    const options: Record<string, unknown> = {
      key: params.keyId,
      amount: params.amount,
      currency: params.currency || 'INR',
      name: 'FinTrackly',
      description: `${params.planName} subscription`,
      order_id: params.orderId,
      prefill: {
        email: params.email,
        contact: params.contact.replace(/\D/g, '').slice(-10) || '9999999999',
      },
      theme: { color: '#059669' },
      method: { upi: true, card: true, netbanking: true, wallet: false },
      handler: (response: RazorpayPaymentResult) => {
        if (!response.razorpay_order_id || !response.razorpay_payment_id || !response.razorpay_signature) {
          reject(new Error('Invalid payment response from Razorpay'));
          return;
        }
        resolve(response);
      },
      modal: {
        ondismiss: () => reject(new Error('Payment cancelled')),
      },
    };

    const Checkout = window.Razorpay;
    if (!Checkout) {
      reject(new Error('Razorpay Checkout failed to load. Please refresh and try again.'));
      return;
    }
    const rzp = new Checkout(options);
    if (typeof rzp.open !== 'function') {
      reject(new Error('Razorpay Checkout is unavailable. Please refresh and try again.'));
      return;
    }
    rzp.open();
  });
}

export async function simulateTestSubscription(_plan: PaidPlan): Promise<void> {
  // simulateTestSubscription Cloud Function was removed.
  // Test payments now go via initiateUpiCollect with success@razorpay VPA,
  // which handles the test-mode activation server-side.
  throw new Error('simulateTestSubscription is no longer available. Use success@razorpay as VPA instead.');
}

export async function initiateUpiCollect(params: {
  orderId: string;
  amount: number;
  vpa: string;
  email: string;
  contact: string;
  plan?: PaidPlan;
}): Promise<{ paymentId: string; simulated?: boolean; captured?: boolean }> {
  const fn = httpsCallable<typeof params, {
    paymentId: string;
    simulated?: boolean;
    captured?: boolean;
  }>(functions, 'initiateUpiCollect', { timeout: 25000 });
  const result = await fn(params);
  return result.data;
}

export async function confirmUpiPayment(params: {
  paymentId: string;
  orderId: string;
  plan: PaidPlan;
}): Promise<{ success: boolean; pending?: boolean; status?: string; plan?: PaidPlan }> {
  const fn = httpsCallable<typeof params, {
    success: boolean;
    pending?: boolean;
    status?: string;
    plan?: PaidPlan;
  }>(functions, 'confirmUpiPayment');
  const result = await fn(params);
  return result.data;
}

function callableErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    const msg = (err as { message: string }).message;
    if (msg && !msg.includes('internal')) return msg;
  }
  return fallback;
}

/**
 * Live payments use Razorpay Standard Checkout (QR / UPI apps).
 * Server-side UPI collect (`/v1/payments/create/json`) is not available on most live merchants
 * and returns 404 — that was causing the 500 on initiateUpiCollect.
 */
export async function payWithUpiIdAndWait(params: {
  plan: PaidPlan;
  vpa: string;
  email: string;
  contact: string;
  onStatus?: (message: string) => void;
}): Promise<void> {
  const vpa = params.vpa.trim().toLowerCase();
  const isTestKey = (import.meta.env.VITE_RAZORPAY_KEY_ID ?? '').startsWith('rzp_test_');

  if (isTestKey && vpa === 'success@razorpay') {
    params.onStatus?.('Test Mode: confirming payment…');
    await simulateTestSubscription(params.plan);
    return;
  }

  if (isTestKey && vpa === 'failure@razorpay') {
    throw new Error('Test payment declined. Use success@razorpay to pass.');
  }

  params.onStatus?.('Creating payment…');
  const order = await createRazorpayOrder(params.plan);

  // Live (and non-test-VPA): open Standard Checkout — scan QR or pay in UPI app.
  if (!isTestKey) {
    params.onStatus?.('Complete payment in the Razorpay window…');
    const planLabel =
      params.plan === 'monthly' ? 'Monthly' : params.plan === 'yearly' ? 'Yearly' : 'Lifetime';
    const response = await payWithStandardCheckout({
      keyId: order.keyId,
      orderId: order.orderId,
      amount: order.amount,
      currency: order.currency,
      email: params.email,
      contact: params.contact,
      planName: planLabel,
    });
    params.onStatus?.('Confirming payment…');
    await verifyRazorpayPayment({ ...response, plan: params.plan });
    return;
  }

  // Test Mode with a real-looking VPA: try server collect (works with Razorpay test keys).
  params.onStatus?.(`Payment request sent to ${vpa}. Open your UPI app and approve it.`);

  let collect: { paymentId: string; simulated?: boolean; captured?: boolean };
  try {
    collect = await initiateUpiCollect({
      orderId: order.orderId,
      amount: order.amount,
      vpa,
      email: params.email,
      contact: params.contact,
      plan: params.plan,
    });
  } catch (err) {
    throw new Error(
      callableErrorMessage(
        err,
        'Could not start UPI payment. In Test Mode use success@razorpay.',
      ),
    );
  }

  if (collect.captured || collect.simulated) return;

  for (let attempt = 0; attempt < 40; attempt += 1) {
    await sleep(3000);
    const result = await confirmUpiPayment({
      paymentId: collect.paymentId,
      orderId: order.orderId,
      plan: params.plan,
    });

    if (result.success) return;

    if (!result.pending) {
      throw new Error('Payment failed or was declined in your UPI app');
    }

    if (attempt % 3 === 0) {
      params.onStatus?.('Waiting for approval in your UPI app…');
    }
  }

  throw new Error('Payment timed out. Open your UPI app, approve the request, then try again.');
}

export async function payWithUpiApp(params: {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  email: string;
  contact: string;
  app: 'gpay' | 'phonepe' | 'paytm';
}): Promise<RazorpayPaymentResult> {
  await loadRazorpayCustomScript();

  const intentMap = {
    gpay: { gpay: true },
    phonepe: { phonepe: true },
    paytm: { paytm: true },
  } as const;

  const baseData = {
    amount: params.amount,
    currency: params.currency || 'INR',
    email: params.email,
    contact: params.contact.replace(/\D/g, '').slice(-10) || '9999999999',
    order_id: params.orderId,
    method: 'upi',
  };

  return submitRazorpayPayment(params.keyId, baseData, intentMap[params.app]);
}


export function loadRazorpayCustomScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      try {
        const probe = new window.Razorpay({ key: 'rzp_test_probe' });
        if (typeof probe.createPayment === 'function') {
          resolve();
          return;
        }
      } catch {
        // Load custom script below
      }
    }

    const existing = document.querySelector(`script[src="${RAZORPAY_CUSTOM_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Razorpay')));
      return;
    }

    const script = document.createElement('script');
    script.src = RAZORPAY_CUSTOM_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay'));
    document.body.appendChild(script);
  });
}
