import Razorpay from 'razorpay';
import { defineSecret } from 'firebase-functions/params';
import { HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { PLAN_AMOUNTS_INR, type Plan } from './subscriptionUtils';
import { hmacHex, timingSafeHexEqual, type OrderLike, type PaymentLike } from './payments';

const razorpayKeyId = defineSecret('RAZORPAY_KEY_ID');
const razorpayKeySecret = defineSecret('RAZORPAY_KEY_SECRET');
const razorpayWebhookSecret = defineSecret('RAZORPAY_WEBHOOK_SECRET');
const ownerEmailSecret = defineSecret('OWNER_EMAIL');

export const razorpaySecrets = [razorpayKeyId, razorpayKeySecret];
export const webhookSecrets = [razorpayKeyId, razorpayKeySecret, razorpayWebhookSecret];
export const ownerSecrets = [ownerEmailSecret];

function readSecret(param: { value: () => string | undefined }, envName: string): string {
  try {
    const viaParam = param.value()?.trim() ?? '';
    if (viaParam) return viaParam;
  } catch {
    // Secret not bound on this function / local emulator without secrets
  }
  return process.env[envName]?.trim() ?? '';
}

export function getWebhookSecret(): string {
  return readSecret(razorpayWebhookSecret, 'RAZORPAY_WEBHOOK_SECRET');
}

/** Razorpay signs the raw request body with the webhook secret. */
export function verifyWebhookSignature(rawBody: string | Buffer, signature: string): boolean {
  const secret = getWebhookSecret();
  if (!secret) {
    throw new HttpsError('failed-precondition', 'Razorpay webhook secret is not configured');
  }
  return timingSafeHexEqual(hmacHex(secret, rawBody), signature);
}

export function getOwnerEmail(): string {
  return (
    process.env.OWNER_EMAIL?.trim().toLowerCase() ||
    process.env.VITE_OWNER_EMAIL?.trim().toLowerCase() ||
    (() => {
      try {
        return ownerEmailSecret.value()?.trim().toLowerCase() || '';
      } catch {
        return '';
      }
    })() ||
    'puvanesh1964@gmail.com'
  );
}

function getCredentials(): { keyId: string; keySecret: string } {
  // Prefer injected secrets (Cloud Functions), then local .env (emulator)
  const keyId = readSecret(razorpayKeyId, 'RAZORPAY_KEY_ID');
  const keySecret = readSecret(razorpayKeySecret, 'RAZORPAY_KEY_SECRET');

  if (!keyId || !keySecret) {
    throw new HttpsError('failed-precondition', 'Razorpay is not configured');
  }
  if (!keyId.startsWith('rzp_')) {
    throw new HttpsError(
      'failed-precondition',
      'Invalid Razorpay Key ID. Re-set RAZORPAY_KEY_ID secret and redeploy.',
    );
  }
  return { keyId, keySecret };
}

function getRazorpay() {
  const { keyId, keySecret } = getCredentials();
  return {
    client: new Razorpay({ key_id: keyId, key_secret: keySecret }),
    keyId,
    keySecret,
  };
}

export async function createOrder(
  plan: Exclude<Plan, 'trial'>,
  userId?: string,
) {
  const { client, keyId } = getRazorpay();
  const amountInr = PLAN_AMOUNTS_INR[plan];
  const order = await client.orders.create({
    amount: amountInr * 100,
    currency: 'INR',
    receipt: `fintrackly_${plan}_${Date.now()}`,
    // notes ride along on every webhook event, which is how the webhook learns
    // which plan and which customer an out-of-band payment belongs to.
    notes: { plan, ...(userId ? { userId } : {}) },
    payment_capture: true,
  });

  if (!keyId.startsWith('rzp_')) {
    throw new HttpsError('failed-precondition', 'Invalid Razorpay Key ID format');
  }

  return {
    orderId: order.id,
    amount: Number(order.amount),
    currency: order.currency ?? 'INR',
    keyId,
    isTestMode: keyId.startsWith('rzp_test_'),
  };
}

export function isRazorpayTestMode(): boolean {
  const { keyId } = getCredentials();
  return keyId.startsWith('rzp_test_');
}

export function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string,
): boolean {
  const { keySecret } = getRazorpay();
  const body = `${orderId}|${paymentId}`;
  return timingSafeHexEqual(hmacHex(keySecret, body), signature);
}

export async function fetchPayment(paymentId: string): Promise<PaymentLike> {
  const { client } = getRazorpay();
  const payment = await client.payments.fetch(paymentId);
  return payment as unknown as PaymentLike;
}

/** The order is the authoritative record of what was actually priced. */
export async function fetchOrder(orderId: string): Promise<OrderLike | undefined> {
  try {
    const { client } = getRazorpay();
    const order = await client.orders.fetch(orderId);
    return order as unknown as OrderLike;
  } catch (err) {
    logger.warn('fetchOrder failed', { orderId, message: (err as Error)?.message });
    return undefined;
  }
}

/** Used by the admin reconciliation tool: recent payments vs our own records. */
export async function listRecentPayments(count = 100): Promise<PaymentLike[]> {
  const { client } = getRazorpay();
  const res = await client.payments.all({ count });
  return ((res as { entity?: { entity?: PaymentLike[] } }).entity?.entity ??
    (res as unknown as { entity: PaymentLike[] }).entity ??
    []) as PaymentLike[];
}

export async function initiateUpiCollectPayment(params: {
  orderId: string;
  amount: number;
  vpa: string;
  email: string;
  contact: string;
}): Promise<{ paymentId: string }> {
  const { keyId, keySecret } = getCredentials();
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const contact = params.contact.replace(/\D/g, '').slice(-10) || '9999999999';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  let res: Response;
  try {
    res = await fetch('https://api.razorpay.com/v1/payments/create/json', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        amount: params.amount,
        currency: 'INR',
        order_id: params.orderId,
        email: params.email,
        contact,
        method: 'upi',
        vpa: params.vpa.trim().toLowerCase(),
      }),
    });
  } catch (err) {
    throw new HttpsError(
      'deadline-exceeded',
      err instanceof Error && err.name === 'AbortError'
        ? 'Razorpay did not respond. In Test Mode use success@razorpay.'
        : 'Could not reach Razorpay. Try again.',
    );
  } finally {
    clearTimeout(timer);
  }

  let body: {
    razorpay_payment_id?: string;
    error?: { description?: string; code?: string };
  } = {};
  const raw = await res.text();
  try {
    body = JSON.parse(raw) as typeof body;
  } catch {
    // Razorpay sometimes returns plain HTML/text 404 when collect API is disabled
  }

  if (!res.ok || !body.razorpay_payment_id) {
    const description =
      body.error?.description ||
      (res.status === 404
        ? 'UPI Collect is not enabled on this Razorpay account. Use Checkout / QR instead.'
        : raw.slice(0, 180) || 'Could not send UPI payment request');
    throw new HttpsError(
      res.status === 404 || res.status === 400 ? 'failed-precondition' : 'internal',
      description,
    );
  }

  return { paymentId: body.razorpay_payment_id };
}
