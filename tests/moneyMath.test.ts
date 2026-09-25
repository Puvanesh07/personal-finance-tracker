/**
 * tests/moneyMath.test.ts
 *
 * The arithmetic a launch is judged on: account balances and net worth.
 * These were written after a bug where `addCashflow` folded the amount into the
 * stored `balance` while the live figure added the same cashflow again — every
 * screen that used the live number showed money twice, and no test caught it.
 */

import { describe, expect, it } from 'vitest';
import {
  calcLiveAccountBalances,
  calculateNetWorth,
  getLiveBankTotal,
  getOffAccountCashflowNet,
  round2,
} from '../src/utils/calculations';
import type {
  Account,
  CashflowEntry,
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
    ...patch,
  }) as CashflowEntry;

describe('calcLiveAccountBalances', () => {
  it('starts from the opening balance and applies linked cashflows', () => {
    const accounts = [account()];
    const flows = [
      cashflow({ accountId: 'acc_1', type: 'income', amount: 10_000 }),
      cashflow({ id: 'cf_2', accountId: 'acc_1', type: 'expense', amount: 1_500 }),
    ];
    expect(calcLiveAccountBalances(accounts, flows)['acc_1']).toBe(58_500);
  });

  it('ignores cashflows before the opening-balance date', () => {
    const accounts = [account({ openingBalanceDate: '2026-03-01' })];
    const flows = [cashflow({ accountId: 'acc_1', date: '2026-02-27', type: 'income', amount: 9_000 })];
    expect(calcLiveAccountBalances(accounts, flows)['acc_1']).toBe(50_000);
  });

  it('falls back to the stored balance on a legacy account with no anchor', () => {
    const accounts = [account({ openingBalance: undefined as unknown as number })];
    const flows = [cashflow({ accountId: 'acc_1', type: 'income', amount: 2_000 })];
    expect(calcLiveAccountBalances(accounts, flows)['acc_1']).toBe(52_000);
  });

  it('leaves an entry with no account out of every balance', () => {
    const accounts = [account()];
    const flows = [cashflow({ accountId: undefined })];
    expect(calcLiveAccountBalances(accounts, flows)['acc_1']).toBe(50_000);
  });
});

describe('getLiveBankTotal', () => {
  it('counts cash-like accounts and leaves credit cards out', () => {
    const accounts = [
      account({ id: 'acc_bank' }),
      account({ id: 'acc_cc', type: 'credit', openingBalance: 30_000 }),
    ];
    expect(getLiveBankTotal(accounts, [])).toBe(50_000);
  });
});

describe('getOffAccountCashflowNet', () => {
  it('only nets entries that are not linked to a tracked account', () => {
    const accounts = [account()];
    const flows = [
      cashflow({ id: 'cf_linked', accountId: 'acc_1', type: 'income', amount: 4_000 }),
      cashflow({ id: 'cf_off', type: 'income', amount: 3_000 }),
      cashflow({ id: 'cf_off2', type: 'expense', amount: 1_200 }),
    ];
    // The linked 4,000 already moved the account balance.
    expect(getOffAccountCashflowNet(flows, accounts)).toBe(1_800);
  });

  it('treats an entry pointing at a deleted account as off-account', () => {
    expect(
      getOffAccountCashflowNet([cashflow({ accountId: 'gone' })], []),
    ).toBe(-1_000);
  });
});

describe('calculateNetWorth', () => {
  it('does not count an account-linked cashflow twice', () => {
    const accounts = [account()];
    const flows = [cashflow({ accountId: 'acc_1', type: 'income', amount: 20_000 })];
    const nw = calculateNetWorth([], [], [], accounts, flows);

    expect(nw.liquidCash).toBe(70_000);
    expect(nw.cashflowSavings).toBe(0);
    expect(nw.netWorth).toBe(70_000);
  });

  it('adds off-account savings on top of assets minus liabilities', () => {
    const nw = calculateNetWorth(
      [],
      [],
      [],
      [account()],
      [
        cashflow({ id: 'a', type: 'income', amount: 5_000 }),
        cashflow({ id: 'b', type: 'expense', amount: 2_000 }),
      ],
    );
    expect(nw.liquidCash).toBe(50_000);
    expect(nw.cashflowSavings).toBe(3_000);
    expect(nw.netWorth).toBe(53_000);
  });
});

describe('round2', () => {
  it('keeps two decimals and never drifts', () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(1234.5678)).toBe(1234.57);
    expect(round2(-1234.5678)).toBe(-1234.57);
  });
});
