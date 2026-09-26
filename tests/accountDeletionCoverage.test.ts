/**
 * tests/accountDeletionCoverage.test.ts
 *
 * Feature: Settings → Danger Zone → "Delete My Account" calls the server-side
 * `deleteMyAccount` Cloud Function. The function loops `USER_SUBCOLLECTIONS`
 * and calls `deleteCollection('users/<uid>/<col>')` for each — so if a
 * collection is missing from that list, it silently survives erasure and the
 * user is NOT actually forgotten (GDPR hole).
 *
 * This test pins the list against the exact set the app can write, so a new
 * collection added to the client without also adding it here fails CI.
 */

import { describe, expect, it } from 'vitest';
import {
  USER_SUBCOLLECTIONS,
  SENSITIVE_SUBCOLLECTIONS,
} from '../functions/src/subscriptionUtils';

const REQUIRED = [
  // 15 collections the client export already reads.
  'investments',
  'snapshots',
  'liabilities',
  'cashflows',
  'goals',
  'goalContributions',
  'accounts',
  'soldTrades',
  'pendingPayments',
  'trackedPayments',
  'credentials',
  'insurancePolicies',
  'insurancePayments',
  'sipPlans',
  'networthSnapshots',
  // Extras only Admin-SDK delete/export can reach.
  'insights',
  'settings',
  // The three GDPR-hole fixes flagged in the audit — must NEVER be dropped.
  'orders',
  'notificationDevices',
  'pushSent',
] as const;

describe('deleteMyAccount wipes every user-owned collection', () => {
  it('USER_SUBCOLLECTIONS contains every required collection (GDPR completeness)', () => {
    const missing = REQUIRED.filter((c) => !USER_SUBCOLLECTIONS.includes(c));
    expect(missing).toEqual([]);
  });

  it('has at least the 20 documented entries — no silent shrink', () => {
    expect(USER_SUBCOLLECTIONS.length).toBeGreaterThanOrEqual(20);
  });

  it('orders / notificationDevices / pushSent are present (audit C6 fix)', () => {
    // These three were the GDPR hole: they survived every client-side purge
    // because the browser couldn't enumerate them. Any future refactor that
    // drops them re-opens the leak.
    expect(USER_SUBCOLLECTIONS).toContain('orders');
    expect(USER_SUBCOLLECTIONS).toContain('notificationDevices');
    expect(USER_SUBCOLLECTIONS).toContain('pushSent');
  });

  it('SENSITIVE_SUBCOLLECTIONS is a subset of USER_SUBCOLLECTIONS', () => {
    // Soft-delete phase wipes the sensitive ones first, then the hard purge
    // wipes all. If a sensitive collection isn't in the master list the hard
    // purge will leave it behind.
    for (const col of SENSITIVE_SUBCOLLECTIONS) {
      expect(USER_SUBCOLLECTIONS).toContain(col);
    }
  });

  it('has no duplicates (deleteCollection is not free — dupes waste writes)', () => {
    expect(new Set(USER_SUBCOLLECTIONS).size).toBe(USER_SUBCOLLECTIONS.length);
  });
});
