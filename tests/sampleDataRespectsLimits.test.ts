/**
 * tests/sampleDataRespectsLimits.test.ts
 *
 * Feature: "Load sample data" in Settings writes realistic demo rows across
 * every collection. But the free trial caps most collections at 1 item (see
 * `TRIAL_FEATURE_LIMITS`), so a user with a free account must be able to load
 * sample data *without* immediately tripping the blockIfLimited gate or seeing
 * more rows than the plan allows. Extra rows created later by mark-paid
 * recurrences would also push past the cap.
 *
 * These tests pin the invariant that every slice count in loadDummyData /
 * getDummyDataPreview is ≤ the free-tier limit, so future additions to the
 * sample generator cannot silently blow past the plan.
 */

import { describe, expect, it } from 'vitest';
import { getDummyDataPreview } from '../src/services/dummyDataService';
import { TRIAL_FEATURE_LIMITS } from '../src/types/subscription';

describe('Load sample data respects free-tier limits', () => {
  it('tracked + pending payments combined never exceed the payments cap', () => {
    const preview = getDummyDataPreview();
    const paymentsTotal =
      (preview.trackedPayments ?? 0) + (preview.pendingPayments ?? 0);
    expect(paymentsTotal).toBeLessThanOrEqual(TRIAL_FEATURE_LIMITS.payments);
  });

  it('accounts, liabilities, goals, credentials, insurance ≤ their free cap', () => {
    const preview = getDummyDataPreview();
    expect(preview.accounts ?? 0).toBeLessThanOrEqual(TRIAL_FEATURE_LIMITS.accounts);
    expect(preview.liabilities ?? 0).toBeLessThanOrEqual(TRIAL_FEATURE_LIMITS.liabilities);
    expect(preview.goals ?? 0).toBeLessThanOrEqual(TRIAL_FEATURE_LIMITS.goals);
    expect(preview.credentials ?? 0).toBeLessThanOrEqual(TRIAL_FEATURE_LIMITS.credentials);
    expect(preview.insurancePolicies ?? 0).toBeLessThanOrEqual(TRIAL_FEATURE_LIMITS.insurance);
  });

  it('investments and cashflows stay within their larger caps', () => {
    const preview = getDummyDataPreview();
    expect(preview.investments ?? 0).toBeLessThanOrEqual(TRIAL_FEATURE_LIMITS.investments);
    expect(preview.cashflows ?? 0).toBeLessThanOrEqual(TRIAL_FEATURE_LIMITS.cashflows);
  });

  it('every capped feature loads at least one row (still a useful demo)', () => {
    const preview = getDummyDataPreview();
    // A preview showing zero would be useless — the whole point of sample data
    // is to demonstrate the app's surface area on a fresh account.
    expect(preview.investments).toBeGreaterThan(0);
    expect(preview.cashflows).toBeGreaterThan(0);
    expect(preview.trackedPayments).toBeGreaterThan(0);
    expect(preview.goals).toBeGreaterThan(0);
    expect(preview.accounts).toBeGreaterThan(0);
  });

  it('grandTotal stays modest so it fits inside one writeBatch (≤ 499 docs)', () => {
    const preview = getDummyDataPreview();
    expect(preview.grandTotal).toBeLessThanOrEqual(499);
  });
});
