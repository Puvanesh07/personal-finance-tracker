import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
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
    limit(50),
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

export async function markNotificationRead(uid: string, notificationId: string) {
  await updateDoc(doc(db, 'notifications', uid, 'items', notificationId), { read: true });
}

export async function markAllNotificationsRead(uid: string) {
  const q = query(collection(db, 'notifications', uid, 'items'), limit(50));
  const snap = await getDocs(q);
  await Promise.all(
    snap.docs
      .filter((d) => !d.data().read)
      .map((d) => updateDoc(d.ref, { read: true })),
  );
}

export async function initializeTrialIfMissing(): Promise<void> {
  try {
    const fn = httpsCallable(functions, 'initializeTrialIfMissing');
    await fn();
  } catch {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const ref = doc(db, 'users', uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const data = snap.data();
    if (data.premiumGranted !== undefined) return;
    await updateDoc(ref, {
      premiumGranted: false,
      updatedAt: serverTimestamp(),
    });
  }
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

export async function resetTestSubscription(): Promise<{ success: boolean; reset: boolean }> {
  const fn = httpsCallable<void, { success: boolean; reset: boolean }>(
    functions,
    'resetTestSubscription',
  );
  const result = await fn();
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function simulateTestSubscription(plan: PaidPlan): Promise<{
  success: boolean;
  plan: PaidPlan;
  simulated: boolean;
}> {
  const fn = httpsCallable<{ plan: PaidPlan }, {
    success: boolean;
    plan: PaidPlan;
    simulated: boolean;
  }>(functions, 'simulateTestSubscription', { timeout: 20000 });
  const result = await fn({ plan });
  return result.data;
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
  params.onStatus?.(`Payment request sent to ${vpa}. Open your UPI app and approve it.`);

  const collect = await initiateUpiCollect({
    orderId: order.orderId,
    amount: order.amount,
    vpa,
    email: params.email,
    contact: params.contact,
    plan: params.plan,
  });

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
