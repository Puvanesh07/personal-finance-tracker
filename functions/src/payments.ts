/**
 * functions/src/payments.ts
 *
 * Single source of truth for "what did this customer actually pay for?".
 *
 * Rule: the Razorpay ORDER is authoritative. Anything the browser claims about
 * a plan is treated as a hint only — never as the value we activate. Both the
 * verify/confirm callables and the webhook go through resolvePaidPlan() +
 * claimOrderPaid() so the two paths can never disagree.
 */

import * as crypto from 'crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';

import { PLAN_AMOUNTS_INR, getDb, type Plan } from './subscriptionUtils';

export type PaidPlan = Exclude<Plan, 'trial'>;

export const PAID_PLANS: PaidPlan[] = ['monthly', 'yearly', 'lifetime'];

export function isPaidPlan(value: unknown): value is PaidPlan {
  return typeof value === 'string' && (PAID_PLANS as string[]).includes(value);
}

export function amountInPaiseForPlan(plan: PaidPlan): number {
  return PLAN_AMOUNTS_INR[plan] * 100;
}

/** Shape of the bits of a Razorpay order / payment we care about. */
export interface OrderLike {
  id?: string;
  amount?: number | string;
  currency?: string;
  status?: string;
  notes?: Record<string, unknown> | null;
}

export interface PaymentLike {
  id?: string;
  order_id?: string;
  amount?: number | string;
  currency?: string;
  status?: string;
  method?: string;
  notes?: Record<string, unknown> | null;
}

/**
 * Constant-time HMAC check. Used for both payment signatures and webhook
 * signatures — string `===` on a MAC is a timing oracle, and the fix is free.
 */
export function timingSafeHexEqual(expectedHex: string, provided: string): boolean {
  if (typeof provided !== 'string') return false;
  const trimmed = provided.trim().toLowerCase();
  if (!/^[0-9a-f]+$/.test(trimmed)) return false;
  const a = Buffer.from(expectedHex.toLowerCase(), 'hex');
  const b = Buffer.from(trimmed, 'hex');
  if (a.length !== b.length || a.length === 0) return false;
  return crypto.timingSafeEqual(a, b);
}

export function hmacHex(secret: string, payload: string | Buffer): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Decide which plan to activate from the order itself.
 *
 * - order.notes.plan is the plan we asked Razorpay to create the order for
 * - order.amount is cross-checked against the price table, so an order whose
 *   notes were stripped still cannot be upgraded by the client
 * - a claimedPlan that disagrees with the order is logged and ignored
 */
export function resolvePaidPlan(order: OrderLike | undefined, claimedPlan: unknown): PaidPlan {
  if (!order) {
    throw new HttpsError('failed-precondition', 'Order not found at Razorpay. Try again.');
  }

  const notesPlan = isPaidPlan(order.notes?.plan) ? order.notes.plan : null;

  const amount = Number(order.amount);
  const currency = String(order.currency ?? 'INR').toUpperCase();
  if (!Number.isFinite(amount) || amount <= 0 || currency !== 'INR') {
    throw new HttpsError('failed-precondition', 'Order currency/amount is not supported.');
  }
  const amountPlan = (PAID_PLANS.find((p) => amountInPaiseForPlan(p) === amount) ??
    null) as PaidPlan | null;

  if (notesPlan && amountPlan && notesPlan !== amountPlan) {
    logger.error('Order notes/amount disagree — refusing to activate', {
      orderId: order.id,
      notesPlan,
      amountPlan,
      amount,
    });
    throw new HttpsError('failed-precondition', 'Order is inconsistent. Contact support.');
  }

  const resolved = notesPlan ?? amountPlan;
  if (!resolved) {
    throw new HttpsError('failed-precondition', 'Unrecognised order. Nothing was charged to you.');
  }

  if (isPaidPlan(claimedPlan) && claimedPlan !== resolved) {
    logger.warn('Client claimed a plan that does not match the order', {
      orderId: order.id,
      claimedPlan,
      resolved,
    });
  }

  return resolved;
}

/** Payment must belong to the order it claims, for the same amount. */
export function assertPaymentMatchesOrder(payment: PaymentLike | undefined, order: OrderLike, orderId: string): void {
  if (!payment?.id) {
    throw new HttpsError('not-found', 'Payment not found at Razorpay.');
  }
  if (payment.order_id && payment.order_id !== orderId) {
    throw new HttpsError('permission-denied', 'Payment does not belong to this order.');
  }
  const paid = Number(payment.amount);
  if (Number.isFinite(paid) && Number(order.amount) !== paid) {
    throw new HttpsError('permission-denied', 'Payment amount does not match the order amount.');
  }
}

/**
 * Idempotency gate. Returns true when the caller should go ahead and activate,
 * false when this exact payment has already been applied (retried client call,
 * webhook + callable racing each other, etc.).
 */
export async function claimOrderPaid(
  uid: string,
  orderId: string,
  paymentId: string,
  meta: { plan?: PaidPlan; amount?: number } = {},
): Promise<boolean> {
  const db = getDb();
  const ref = db.collection('users').doc(uid).collection('orders').doc(orderId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = (snap.data() ?? {}) as Record<string, unknown>;

    if (data.status === 'paid') {
      logger.info('Order already activated — skipping duplicate activation', {
        uid,
        orderId,
        existingPayment: String(data.paymentId ?? ''),
        attemptedPayment: paymentId,
      });
      return false;
    }

    tx.set(
      ref,
      {
        orderId,
        plan: data.plan ?? meta.plan ?? null,
        amount: data.amount ?? meta.amount ?? null,
        status: 'paid',
        paymentId,
        createdAt: data.createdAt ?? Timestamp.now(),
        paidAt: Timestamp.now(),
      },
      { merge: true },
    );
    return true;
  });
}

/** Book-keeping at order creation so a later webhook can find the owner. */
export async function recordCreatedOrder(
  uid: string,
  order: { orderId: string; plan: PaidPlan; amount: number; currency: string },
): Promise<void> {
  await getDb()
    .collection('users')
    .doc(uid)
    .collection('orders')
    .doc(order.orderId)
    .set(
      {
        orderId: order.orderId,
        plan: order.plan,
        amount: order.amount,
        currency: order.currency,
        status: 'created',
        createdAt: Timestamp.now(),
      },
      { merge: true },
    );
}

/** Mark the stored order docs as refunded for support tooling. */
export async function markOrderRefunded(paymentId: string, amount: number): Promise<void> {
  const db = getDb();
  const users = await db.collection('users').where('paymentId', '==', paymentId).limit(1).get();
  if (users.empty) return;
  const uid = users.docs[0].id;
  const orders = await db
    .collection('users')
    .doc(uid)
    .collection('orders')
    .where('paymentId', '==', paymentId)
    .limit(1)
    .get();
  if (orders.empty) return;
  await orders.docs[0].ref.set({ status: 'refunded', refundAmount: amount, refundedAt: Timestamp.now() }, { merge: true });
}
