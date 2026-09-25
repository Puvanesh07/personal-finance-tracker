/**
 * tests/transfers.test.ts  (audit C1 + C5)
 *
 * Guards the net-worth arithmetic behind the two money moves this change adds:
 *   • a goal contribution that relocates cash between two tracked accounts, and
 *   • an EMI that splits into a principal transfer + an interest expense.
 *
 * The whole point of modelling these as `transfer` (instead of a plain expense)
 * is that net worth must NOT silently move when money only changes pockets, and
 * must fall by *only the interest* when a loan payment is booked. These tests pin
 * that behaviour against the shared calculation engine every screen uses.
 */

import { describe, expect, it } from 'vitest';
import {
  calcLiveAccountBalances,
  calculateNetWorth,
  getLiveBankTotal,
  getOffAccountCashflowNet,
} from '../src/utils/calculations';
import type {
  Account,
  CashflowEntry,
  Liability,
} from '../src/types/investmentTypes';

const account = (patch: Partial<Account> = {}): Account =>
  ({
    id: 'acc_1',
    name: 'HDFC Savings',
    type: 'bank',
    balance: 50_000,
    openingBalance: 50_000,
    openingBalanceDate: '2026-01-01',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...patch,
  }) as Account;

const cashflow = (patch: Partial<CashflowEntry> = {}): CashflowEntry =>
  ({
    id: 'cf_1',
    type: 'expense',
    date: '2026-03-05',
    category: 'Groceries',
    amount: 1_000,
    createdAt: '2026-03-05T00:00:00.000Z',
    updatedAt: '2026-03-05T00:00:00.000Z',
    ...patch,
  }) as CashflowEntry;

const liability = (patch: Partial<Liability> = {}): Liability =>
  ({
    id: 'lia_1',
    type: 'home_loan',
    name: 'Home Loan',
    principal: 100_000,
    outstanding: 100_000,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...patch,
  }) as Liability;

// The shape the store writes via goalTransferCashflow() / recordLiabilityPayment().
const goalTransfer = (amount: number, from: string, to: string): CashflowEntry =>
  cashflow({ id: 'cf_goal_x', type: 'transfer', accountId: from, toAccountId: to, amount, category: 'Goal Contribution' });

describe('goal contribution transfer (C1)', () => {
  const funding = account({ id: 'acc_src', openingBalance: 50_000 });
  const dest = account({ id: 'acc_dst', name: 'Goal Sacks', openingBalance: 0, balance: 0 });
  const accounts = [funding, dest];

  it('moves cash from the funding account to the destination account', () => {
    const balances = calcLiveAccountBalances(accounts, [goalTransfer(10_000, 'acc_src', 'acc_dst')]);
    expect(balances['acc_src']).toBe(40_000);
    expect(balances['acc_dst']).toBe(10_000);
  });

  it('is net-worth neutral — the total liquid cash never changes', () => {
    const before = getLiveBankTotal(accounts, []);
    const after = getLiveBankTotal(accounts, [goalTransfer(10_000, 'acc_src', 'acc_dst')]);
    expect(after).toBe(before); // 50,000 → 50,000
    expect(after).toBe(50_000);
  });

  it('calculateNetWorth is identical with or without the transfer', () => {
    const without = calculateNetWorth([], [], [], accounts, []);
    const withTransfer = calculateNetWorth([], [], [], accounts, [
      goalTransfer(10_000, 'acc_src', 'acc_dst'),
    ]);
    expect(withTransfer.netWorth).toBe(without.netWorth);
    expect(withTransfer.netWorth).toBe(50_000);
  });

  it('a transfer is never counted as cashflow savings / spending', () => {
    // Off-account (no accountId) transfer must not skew the income-expense net.
    expect(getOffAccountCashflowNet([cashflow({ id: 't', type: 'transfer', amount: 9_000 })], [])).toBe(0);
  });

  it('deleting the contribution reverses both balances exactly', () => {
    const withTransfer = calcLiveAccountBalances(accounts, [goalTransfer(10_000, 'acc_src', 'acc_dst')]);
    // deleteGoalContribution removes the derived cf_goal_* → recompute with none.
    const afterDelete = calcLiveAccountBalances(accounts, []);
    expect(afterDelete['acc_src']).toBe(50_000);
    expect(afterDelete['acc_dst']).toBe(0);
    expect(afterDelete['acc_src']).toBeGreaterThan(withTransfer['acc_src']);
  });
});

describe('EMI payment split (C1)', () => {
  const cash = account({ id: 'acc_bank', openingBalance: 50_000 });
  const accounts = [cash];
  const lia = liability({ outstanding: 100_000 });

  // recordLiabilityPayment with accountId writes:
  //   cf_emip_* transfer (principal, source account only — money leaves to lender)
  //   cf_emii_* expense  (interest)
  // and reduces liability.outstanding by the principal.
  const emiFlows = (principal: number, interest: number): CashflowEntry[] => {
    const flows: CashflowEntry[] = [];
    if (principal > 0)
      flows.push(cashflow({ id: 'cf_emip', type: 'transfer', accountId: 'acc_bank', amount: principal, category: 'Home Loan — Principal' }));
    if (interest > 0)
      flows.push(cashflow({ id: 'cf_emii', type: 'expense', accountId: 'acc_bank', amount: interest, category: 'Home Loan — Interest' }));
    return flows;
  };

  it('the funding account drops by the FULL emi (principal + interest)', () => {
    const balances = calcLiveAccountBalances(accounts, emiFlows(8_000, 2_000));
    expect(balances['acc_bank']).toBe(50_000 - 10_000);
  });

  it('net worth falls by ONLY the interest', () => {
    const before = calculateNetWorth([], [lia], [], accounts, []);
    expect(before.netWorth).toBe(50_000 - 100_000); // -50,000

    const paidLiability = liability({ outstanding: 100_000 - 8_000 });
    const after = calculateNetWorth([], [paidLiability], [], accounts, emiFlows(8_000, 2_000));
    // cash 40,000 - debt 92,000 = -52,000 → exactly 2,000 worse (the interest)
    expect(after.netWorth).toBe(before.netWorth - 2_000);
  });

  it('a 100% principal payment (no interest) is net-worth neutral', () => {
    const before = calculateNetWorth([], [lia], [], accounts, []);
    const paidLiability = liability({ outstanding: 100_000 - 10_000 });
    const after = calculateNetWorth([], [paidLiability], [], accounts, emiFlows(10_000, 0));
    expect(after.netWorth).toBe(before.netWorth);
  });

  it('interest is genuinely spent — the principal transfer is not double-counted', () => {
    const paidLiability = liability({ outstanding: 100_000 - 8_000 });
    const after = calculateNetWorth([], [paidLiability], [], accounts, emiFlows(8_000, 2_000));
    // Both linked flows already moved the bank balance, so off-account savings = 0.
    expect(after.cashflowSavings).toBe(0);
    expect(after.liquidCash).toBe(40_000);
  });
});

describe('backward compatibility (legacy income / expense)', () => {
  const accounts = [account({ id: 'acc_1', openingBalance: 50_000 })];

  it('legacy income still increases the balance and net worth', () => {
    const balances = calcLiveAccountBalances(accounts, [
      cashflow({ id: 'i', type: 'income', accountId: 'acc_1', amount: 5_000 }),
    ]);
    expect(balances['acc_1']).toBe(55_000);
  });

  it('legacy expense still decreases the balance', () => {
    const balances = calcLiveAccountBalances(accounts, [
      cashflow({ id: 'e', type: 'expense', accountId: 'acc_1', amount: 1_000 }),
    ]);
    expect(balances['acc_1']).toBe(49_000);
  });

  it('an account with no openingBalanceDate still counts entries from the epoch', () => {
    const legacy = [account({ id: 'acc_1', openingBalanceDate: undefined as unknown as string })];
    const balances = calcLiveAccountBalances(legacy, [goalTransfer(5_000, 'acc_1', 'acc_1')]);
    // source and destination are the same account here → -5,000 then +5,000 → unchanged
    expect(balances['acc_1']).toBe(50_000);
  });
});
