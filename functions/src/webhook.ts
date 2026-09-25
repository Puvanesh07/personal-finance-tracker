/**
 * functions/src/webhook.ts
 *
 * Razorpay → us. This is the authoritative activation path: it works even when
 * the customer closes the tab mid-checkout, which is the most common way
 * subscriptions silently never appear.
 *
 * Kept separate from index.ts/razorpay.ts so nothing here participates in an
 * import cycle: it is the only module allowed to know about all three.
 */

import * as logger from 'firebase-functions/logger';
import { Timestamp } from 'firebase-admin/firestore';

import { getDb, activatePaidPlan, syncAuthClaims, type Plan } from './subscriptionUtils';
import { fetchOrder } from './razorpay';
import {
  assertPaymentMatchesOrder,
  claimOrderPaid,
  isPaidPlan,
  markOrderRefunded,
  resolvePaidPlan,
  type OrderLike,
  type PaidPlan,
  type PaymentLike,
} from './payments';

/**
 * One-shot dedupe. Razorpay retries anything we don't answer with 2xx for
 * hours, and a retry that re-activates a plan is worse than the original
 * failure. Document id = event id, so a replay costs one read.
 */
async function alreadyHandled(eventId: string): Promise<boolean> {
  if (!eventId) return false;
  const db = getDb();
  const ref = db.collection('webhookEvents').doc(eventId);
  const snap = await ref.get();
  if (snap.exists) return true;
  await ref.set({ receivedAt: Timestamp.now() });
  return false;
}

function entityOf(payload: Record<string, unknown>, key: string): Record<string, unknown> | undefined {
  const bucket = payload?.[key] as { entity?: Record<string, unknown> } | undefined;
  return bucket?.entity;
}

/** Resolve which Firebase user a Razorpay payment belongs to. */
async function findUidForPayment(payment: PaymentLike, order: OrderLike): Promise<string> {
  const fromNotes = String(order.notes?.userId ?? payment.notes?.userId ?? '');
  if (fromNotes) return fromNotes;

  if (payment.id) {
    const db = getDb();
    const byPayment = await db.collection('users').where('paymentId', '==', payment.id).limit(1).get();
    if (!byPayment.empty) return byPayment.docs[0].id;
  }
  return '';
}

async function onPaymentCaptured(payment: PaymentLike, orderHint?: OrderLike): Promise<string> {
  const orderId = String(payment.order_id ?? '');
  if (!orderId) return 'payment without order_id — ignored';

  const order = orderHint?.id === orderId ? orderHint : await fetchOrder(orderId);
  const plan = resolvePaidPlan(order, order?.notes?.plan);
  assertPaymentMatchesOrder(payment, order!, orderId);

  const uid = await findUidForPayment(payment, order!);
  if (!uid) {
    logger.error('Webhook payment has no matching user — needs manual reconciliation', {
      paymentId: payment.id,
      orderId,
    });
    return 'no user matched';
  }

  const claimed = await claimOrderPaid(uid, orderId, String(payment.id ?? ''), {
    plan,
    amount: Number(order!.amount),
  });
  if (!claimed) return `order ${orderId} already applied`;

  await activatePaidPlan(uid, plan, String(payment.id ?? ''));
  logger.info('Subscription activated via webhook', { uid, plan, orderId });
  return `activated ${plan} for ${uid}`;
}

async function onRefund(payment: PaymentLike, refund: Record<string, unknown>): Promise<string> {
  const paymentId = String(refund.payment_id ?? payment.id ?? '');
  const refundedAmount = Number(refund.amount ?? 0);
  if (!paymentId) return 'refund without payment_id — ignored';
  if (String(refund.status ?? '') !== 'processed') return `refund status ${refund.status}`;

  const db = getDb();
  const users = await db.collection('users').where('paymentId', '==', paymentId).limit(1).get();
  if (users.empty) return 'refund for an unknown payment';

  const uid = users.docs[0].id;
  const paidAmount = Number(users.docs[0].data()?.paidAmount ?? 0);

  await markOrderRefunded(paymentId, refundedAmount);

  // A refund larger than the charge means the subscription is paid back in
  // full — walk the account back to trial. Anything less is a partial refund
  // and we only record it; a human decides what that means.
  const fullRefund = !paidAmount || refundedAmount >= paidAmount * 0.99;
  if (!fullRefund) return `partial refund recorded for ${uid}`;

  const trialEnd = Timestamp.fromDate(new Date(Date.now() + 7 * 86_400_000));
  await db.collection('users').doc(uid).set(
    {
      plan: 'trial' as Plan,
      subscriptionStatus: 'expired',
      expiresAt: trialEnd,
      trialEnd,
      gracePeriodEnd: Timestamp.fromDate(new Date(trialEnd.toDate().getTime() + 30 * 86_400_000)),
      refundedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    },
    { merge: true },
  );
  await db.collection('notifications').doc(uid).collection('items').add({
    title: 'Refund processed',
    message: 'Your payment was refunded, so the account is back on the trial plan.',
    type: 'warning',
    read: false,
    createdAt: Timestamp.now(),
  });
  await syncAuthClaims(uid, 'trial', false);
  logger.info('Subscription revoked after refund', { uid, paymentId });
  return `revoked ${uid} after refund`;
}

/** Top-level handler. Returns a human-readable outcome for the audit log. */
export async function handleRazorpayEvent(event: Record<string, unknown>): Promise<string> {
  const type = String(event?.event ?? '');
  const payload = (event?.payload ?? {}) as Record<string, unknown>;

  const eventId = `${type}:${String((entityOf(payload, 'payment') as PaymentLike)?.id ?? '')}:${String(
    (entityOf(payload, 'refund') as Record<string, unknown>)?.id ?? '',
  )}`;
  if (await alreadyHandled(eventId)) return `duplicate ${eventId}`;

  switch (type) {
    case 'payment.captured':
      return onPaymentCaptured(entityOf(payload, 'payment') as PaymentLike, entityOf(payload, 'order') as OrderLike);

    case 'order.paid': {
      const order = entityOf(payload, 'order') as OrderLike | undefined;
      const payment = entityOf(payload, 'payment') as PaymentLike | undefined;
      if (!payment) return `order.paid without payment entity (${order?.id})`;
      // Keep the paid amount on the user record so refunds can be compared to it
      const plan = isPaidPlan(order?.notes?.plan) ? (order!.notes!.plan as PaidPlan) : undefined;
      if (payment.status === 'captured' || payment.status === 'authorized') {
        const outcome = await onPaymentCaptured(payment, order);
        if (plan) {
          const uid = await findUidForPayment(payment, order ?? {});
          if (uid) {
            await getDb().collection('users').doc(uid).set({ paidAmount: Number(order?.amount ?? 0) / 100 }, { merge: true });
          }
        }
        return outcome;
      }
      return `order.paid with payment status ${payment.status}`;
    }

    case 'payment.failed': {
      const payment = entityOf(payload, 'payment') as PaymentLike;
      logger.warn('Razorpay reported a failed payment', { paymentId: payment?.id, order: payment?.order_id });
      return 'payment.failed noted';
    }

    case 'refund.processed':
    case 'refund.failed':
      return onRefund(entityOf(payload, 'payment') as PaymentLike, entityOf(payload, 'refund') ?? {});

    default:
      // Anything else must still be acked, or Razorpay retries it forever.
      return `unhandled event ${type}`;
  }
}
