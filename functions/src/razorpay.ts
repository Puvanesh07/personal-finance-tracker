import * as crypto from 'crypto';
import Razorpay from 'razorpay';
import { defineSecret } from 'firebase-functions/params';
import { HttpsError } from 'firebase-functions/v2/https';
import { PLAN_AMOUNTS_INR, type Plan } from './subscriptionUtils';

const razorpayKeyId = defineSecret('RAZORPAY_KEY_ID');
const razorpayKeySecret = defineSecret('RAZORPAY_KEY_SECRET');
const ownerEmailSecret = defineSecret('OWNER_EMAIL');

export const razorpaySecrets = [razorpayKeyId, razorpayKeySecret];
export const ownerSecrets = [ownerEmailSecret];

export function getOwnerEmail(): string {
  return (
    process.env.OWNER_EMAIL?.trim().toLowerCase() ||
    process.env.VITE_OWNER_EMAIL?.trim().toLowerCase() ||
    ownerEmailSecret.value()?.trim().toLowerCase() ||
    ''
  );
}

function getCredentials(): { keyId: string; keySecret: string } {
  // Local emulator: reads from functions/.secret.local or root .env via dotenv
  const envKeyId = process.env.RAZORPAY_KEY_ID;
  const envSecret = process.env.RAZORPAY_KEY_SECRET;
  if (envKeyId && envSecret) {
    return { keyId: envKeyId, keySecret: envSecret };
  }

  const keyId = razorpayKeyId.value();
  const keySecret = razorpayKeySecret.value();
  if (!keyId || !keySecret) {
    throw new HttpsError('failed-precondition', 'Razorpay is not configured');
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

export async function createOrder(plan: Exclude<Plan, 'trial'>) {
  const { client, keyId } = getRazorpay();
  const amountInr = PLAN_AMOUNTS_INR[plan];
  const order = await client.orders.create({
    amount: amountInr * 100,
    currency: 'INR',
    receipt: `fintrackly_${plan}_${Date.now()}`,
    notes: { plan },
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
  const expected = crypto.createHmac('sha256', keySecret).update(body).digest('hex');
  return expected === signature;
}

export async function fetchPayment(paymentId: string) {
  const { client } = getRazorpay();
  return client.payments.fetch(paymentId);
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

  const body = (await res.json()) as {
    razorpay_payment_id?: string;
    error?: { description?: string };
  };

  if (!res.ok || !body.razorpay_payment_id) {
    throw new HttpsError(
      'internal',
      body.error?.description || 'Could not send UPI payment request',
    );
  }

  return { paymentId: body.razorpay_payment_id };
}
