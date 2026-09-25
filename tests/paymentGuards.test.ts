/**
 * tests/paymentGuards.test.ts
 *
 * The server-side money guards (finding #2/#8): these decide which plan gets
 * activated after a Razorpay payment. A browser must never be able to pay ₹99
 * and walk away with `lifetime`. Every path — callable and webhook — funnels
 * through these pure helpers, so pinning them here is the cheapest way to keep
 * a regression from turning into a real revenue leak.
 */

import { describe, expect, it, vi } from 'vitest';

// Keep the suite pure: no Firestore/admin init is needed for these guards.
vi.mock('../functions/src/subscriptionUtils', () => ({
  PLAN_AMOUNTS_INR: { monthly: 99, yearly: 599, lifetime: 899 },
  getDb: () => {
    throw new Error('getDb should not be called by pure guards');
  },
}));

const {
  isPaidPlan,
  amountInPaiseForPlan,
  timingSafeHexEqual,
  hmacHex,
  resolvePaidPlan,
  assertPaymentMatchesOrder,
} = await import('../functions/src/payments');

describe('isPaidPlan / amountInPaiseForPlan', () => {
  it('accepts only real paid plans', () => {
    expect(isPaidPlan('monthly')).toBe(true);
    expect(isPaidPlan('yearly')).toBe(true);
    expect(isPaidPlan('lifetime')).toBe(true);
    expect(isPaidPlan('trial')).toBe(false);
    expect(isPaidPlan('forever')).toBe(false);
    expect(isPaidPlan(undefined)).toBe(false);
    expect(isPaidPlan(123)).toBe(false);
  });

  it('converts rupees to paise', () => {
    expect(amountInPaiseForPlan('monthly')).toBe(9_900);
    expect(amountInPaiseForPlan('yearly')).toBe(59_900);
    expect(amountInPaiseForPlan('lifetime')).toBe(89_900);
  });
});

describe('timingSafeHexEqual / hmacHex', () => {
  it('matches a correct HMAC and rejects a wrong one', () => {
    const secret = 'topsecret';
    const good = hmacHex(secret, 'order_1|pay_1');
    expect(timingSafeHexEqual(good, good)).toBe(true);
    expect(timingSafeHexEqual(good, hmacHex('wrongsecret', 'order_1|pay_1'))).toBe(false);
  });

  it('ignores case/whitespace but refuses non-hex and empty', () => {
    const sig = hmacHex('k', 'payload');
    expect(timingSafeHexEqual(sig, `  ${sig.toUpperCase()} `)).toBe(true);
    expect(timingSafeHexEqual(sig, 'not-hex')).toBe(false);
    expect(timingSafeHexEqual(sig, '')).toBe(false);
    expect(timingSafeHexEqual('', sig)).toBe(false);
  });
});

describe('resolvePaidPlan', () => {
  it('activates the plan stored on the order notes', () => {
    expect(resolvePaidPlan({ amount: 59_900, currency: 'INR', notes: { plan: 'yearly' } }, 'yearly')).toBe('yearly');
  });

  it('ignores a client claim that disagrees with the order', () => {
    // Paid for monthly (₹99) but the browser claims lifetime.
    const order = { amount: 9_900, currency: 'INR', notes: { plan: 'monthly' } };
    expect(resolvePaidPlan(order, 'lifetime')).toBe('monthly');
  });

  it('falls back to the amount when notes were stripped', () => {
    expect(resolvePaidPlan({ amount: 89_900, currency: 'INR', notes: null }, 'monthly')).toBe('lifetime');
  });

  it('refuses an order whose notes and amount disagree', () => {
    const order = { amount: 9_900, currency: 'INR', notes: { plan: 'lifetime' } };
    expect(() => resolvePaidPlan(order, 'lifetime')).toThrow(/inconsistent/i);
  });

  it('refuses a non-INR or unknown-amount order', () => {
    expect(() => resolvePaidPlan({ amount: 9_900, currency: 'USD', notes: { plan: 'monthly' } }, 'monthly')).toThrow();
    expect(() => resolvePaidPlan({ amount: 12_345, currency: 'INR', notes: null }, 'monthly')).toThrow();
  });

  it('throws when the order is missing entirely', () => {
    expect(() => resolvePaidPlan(undefined, 'monthly')).toThrow(/not found/i);
  });
});

describe('assertPaymentMatchesOrder', () => {
  const order = { id: 'order_1', amount: 9_900, currency: 'INR' };

  it('passes when the payment belongs to the order and amount', () => {
    expect(() =>
      assertPaymentMatchesOrder({ id: 'pay_1', order_id: 'order_1', amount: 9_900 }, order, 'order_1'),
    ).not.toThrow();
  });

  it('rejects a payment for a different order', () => {
    expect(() =>
      assertPaymentMatchesOrder({ id: 'pay_1', order_id: 'other', amount: 9_900 }, order, 'order_1'),
    ).toThrow(/does not belong/i);
  });

  it('rejects a payment whose amount differs from the order', () => {
    expect(() =>
      assertPaymentMatchesOrder({ id: 'pay_1', order_id: 'order_1', amount: 100 }, order, 'order_1'),
    ).toThrow(/amount does not match/i);
  });

  it('rejects a missing payment', () => {
    expect(() => assertPaymentMatchesOrder(undefined, order, 'order_1')).toThrow(/not found/i);
  });
});
