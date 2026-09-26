/**
 * tests/bondInterestSync.test.ts
 *
 * Feature: Bond interest → Cashflow **hybrid sync**. The schedule is
 * auto-generated from the bond's tenure/rate/frequency. In the Track Bond
 * Interest modal the user clicks "Sync to Cashflow" once, and each received
 * coupon becomes an income cashflow with a deterministic ID
 * (`cf_bondint_<bondId>_<index>`) so a second click cannot create duplicates.
 *
 * This test pins the invariants the sync relies on:
 *   • Deterministic IDs (same bond + same index → same cashflow id).
 *   • Interest amount per coupon matches the schedule.
 *   • Only past-dated coupons are eligible (future dates are "upcoming").
 *   • The posted income raises the linked account balance & net worth.
 */

import { describe, expect, it } from 'vitest';
import {
  bondCouponId,
  bondInterestPerPeriod,
  bondMaturityItemId,
  generateBondSchedule,
} from '../src/utils/bondSchedule';
import {
  calcLiveAccountBalances,
  calculateNetWorth,
} from '../src/utils/calculations';
import type {
  Account,
  BondInvestment,
  CashflowEntry,
} from '../src/types/investmentTypes';

const bond = (patch: Partial<BondInvestment> = {}): BondInvestment =>
  ({
    id: 'bnd_1',
    type: 'bond',
    name: 'HDFC Corp Bond',
    investedAmount: 100_000,
    interestRate: 12, // annual %
    durationMonths: 12,
    startDate: '2026-01-01',
    maturityDate: '2027-01-01',
    payoutFrequency: 'monthly',
    accountId: 'acc_bank',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    userId: 'u1',
    ...patch,
  }) as BondInvestment;

const account = (patch: Partial<Account> = {}): Account =>
  ({
    id: 'acc_bank',
    name: 'HDFC Savings',
    type: 'bank',
    balance: 20_000,
    openingBalance: 20_000,
    openingBalanceDate: '2026-01-01',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...patch,
  }) as Account;

describe('Bond interest → Cashflow hybrid sync', () => {
  it('coupon IDs are deterministic — same bond + index always yields the same id', () => {
    expect(bondCouponId('bnd_1', 0)).toBe('cf_bondint_bnd_1_0');
    expect(bondCouponId('bnd_1', 0)).toBe(bondCouponId('bnd_1', 0));
    expect(bondCouponId('bnd_1', 5)).not.toBe(bondCouponId('bnd_1', 6));
    expect(bondMaturityItemId('bnd_1')).toBe('cf_bondmat_bnd_1');
  });

  it('monthly 12% on ₹100,000 for 12 months → ₹1,000 per coupon, 12 coupons + 1 maturity', () => {
    const schedule = generateBondSchedule(bond());
    expect(bondInterestPerPeriod(bond())).toBe(1_000);
    const interestRows = schedule.filter((r) => r.kind === 'interest');
    const maturityRows = schedule.filter((r) => r.kind === 'maturity');
    expect(interestRows.length).toBe(12);
    expect(maturityRows.length).toBe(1);
    expect(interestRows[0].interest).toBe(1_000);
    // Principal portion is only on the maturity row.
    expect(interestRows.every((r) => r.principal === 0)).toBe(true);
    expect(maturityRows[0].principal).toBe(100_000);
  });

  it('sync is idempotent: an existing cashflow with the same deterministic id prevents a second post', () => {
    // Emulate syncBondInterest's dedupe set. It reads all existing cashflow
    // IDs into a Set and skips any coupon whose id is already present.
    const schedule = generateBondSchedule(bond());
    const receivedCoupons = schedule.filter((r) => r.kind === 'interest' && r.date <= '2026-09-26');
    const existingIds = new Set<string>([
      bondCouponId('bnd_1', 0),
      bondCouponId('bnd_1', 1),
    ]);
    const toPost = receivedCoupons.filter(
      (r) => !existingIds.has(bondCouponId('bnd_1', r.index)),
    );
    // Coupons 0 and 1 already synced → only later ones remain.
    expect(toPost.every((r) => r.index >= 2)).toBe(true);
    expect(toPost.length).toBe(receivedCoupons.length - 2);
  });

  it('a posted interest income raises the linked bank balance and net worth by the coupon amount', () => {
    const accounts = [account({ openingBalance: 20_000 })];
    const income: CashflowEntry = {
      id: bondCouponId('bnd_1', 0),
      type: 'income',
      date: '2026-02-01',
      category: 'Bond Interest',
      amount: 1_000,
      accountId: 'acc_bank',
      createdAt: '2026-02-01T00:00:00.000Z',
      updatedAt: '2026-02-01T00:00:00.000Z',
      userId: 'u1',
    };
    const balances = calcLiveAccountBalances(accounts, [income]);
    expect(balances.acc_bank).toBe(21_000);

    const nw = calculateNetWorth([], [], [], accounts, [income]);
    expect(nw.netWorth).toBe(21_000); // pure cash; bond is separate asset
  });

  it('quarterly cadence steps every 3 months and interest triples per coupon', () => {
    const q = bond({ payoutFrequency: 'quarterly', durationMonths: 12 });
    expect(bondInterestPerPeriod(q)).toBe(3_000); // 100k * 12% * 3/12
    const dates = generateBondSchedule(q)
      .filter((r) => r.kind === 'interest')
      .map((r) => r.date);
    expect(dates).toEqual(['2026-01-01', '2026-04-01', '2026-07-01', '2026-10-01']);
  });
});
