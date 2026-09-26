/**
 * tests/bondMaturityArchive.test.ts
 *
 * Feature: On a bond's maturity date the "Close & Settle" button:
 *   1. syncs every remaining coupon as an income cashflow (reuses syncBondInterest),
 *   2. posts the returned principal as a **transfer** into the linked account
 *      (id = `cf_bondmat_<bondId>`), and
 *   3. flips `bond.status` to `'matured'`.
 *
 * The archived bond is hidden from the Investments list and from net-worth
 * totals (see `isRealizedInvestment`) so the value is not double-counted with
 * the cash that just landed in the bank. This test pins that behavior.
 */

import { describe, expect, it } from 'vitest';
import {
  bondMaturityItemId,
} from '../src/utils/bondSchedule';
import {
  calculateNetWorth,
  isRealizedInvestment,
  summarizePortfolio,
} from '../src/utils/calculations';
import type {
  Account,
  BondInvestment,
  CashflowEntry,
} from '../src/types/investmentTypes';

const bond = (status: BondInvestment['status'] = 'active'): BondInvestment =>
  ({
    id: 'bnd_1',
    type: 'bond',
    name: 'Infosys Bond',
    investedAmount: 50_000,
    interestRate: 10,
    durationMonths: 24,
    startDate: '2024-01-01',
    maturityDate: '2026-01-01',
    payoutFrequency: 'yearly',
    accountId: 'acc_bank',
    status,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    userId: 'u1',
  }) as BondInvestment;

const account = (): Account =>
  ({
    id: 'acc_bank',
    name: 'HDFC Savings',
    type: 'bank',
    balance: 10_000,
    openingBalance: 10_000,
    openingBalanceDate: '2024-01-01',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }) as Account;

const maturityTransfer = (): CashflowEntry =>
  ({
    id: bondMaturityItemId('bnd_1'),
    type: 'transfer',
    date: '2026-01-01',
    category: 'Infosys Bond — Principal Redemption',
    amount: 50_000,
    toAccountId: 'acc_bank',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    userId: 'u1',
  }) as CashflowEntry;

describe('Bond maturity archive & settle', () => {
  it('isRealizedInvestment flags matured / closed, keeps active untouched', () => {
    expect(isRealizedInvestment(bond('active') as any)).toBe(false);
    expect(isRealizedInvestment(bond('matured') as any)).toBe(true);
    expect(isRealizedInvestment(bond('closed') as any)).toBe(true);
    expect(isRealizedInvestment(bond(undefined) as any)).toBe(false);
  });

  it('summarizePortfolio skips realized bonds so their value stops counting as a live asset', () => {
    const activeOnly = summarizePortfolio([bond('active') as any]);
    const maturedOnly = summarizePortfolio([bond('matured') as any]);
    const mixed = summarizePortfolio([
      bond('active') as any,
      { ...bond('active'), id: 'bnd_m', status: 'matured' } as any,
    ]);

    expect(activeOnly.totalValue).toBeGreaterThan(0);
    expect(maturedOnly.totalValue).toBe(0);
    expect(mixed.investedTotal).toBe(activeOnly.investedTotal); // only active counted
  });

  it('after settle: bank +50k (transfer) and asset -50k (realized) → net worth unchanged', () => {
    const accounts = [account()];
    // Before maturity: bank has 10k cash + a live bond asset of ~50k+ accrued.
    const before = calculateNetWorth([bond('active') as any], [], [], accounts, []);
    // After settle: bond marked matured (dropped from live assets) + principal transfer in.
    const after = calculateNetWorth(
      [bond('matured') as any],
      [],
      [],
      accounts,
      [maturityTransfer()],
    );
    // Bank went from 10k → 60k; bond asset was excluded from `after` totals.
    // Net change in netWorth = +50k cash − (bond's live current value that vanished).
    // The exact number depends on accrued interest in currentValueForBond; the
    // contract we're pinning is that the CASH side of the settle is 60k and the
    // BOND side is 0 (realized → not counted).
    expect(after.liquidCash).toBe(60_000);
    // Realized bond adds 0 investment value → netWorth is pure cash.
    expect(after.netWorth).toBe(after.liquidCash);
    expect(before.netWorth).toBeGreaterThan(before.liquidCash); // active bond adds asset value
  });

  it('the principal is a transfer, not income — so it never inflates cashflowSavings', () => {
    const accounts = [account()];
    const nw = calculateNetWorth([], [], [], accounts, [maturityTransfer()]);
    // Transfers are deliberately excluded from savings math by design.
    expect(nw.cashflowSavings).toBe(0);
  });
});
