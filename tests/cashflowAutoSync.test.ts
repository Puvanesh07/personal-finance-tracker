/**
 * tests/cashflowAutoSync.test.ts
 *
 * Feature: When you add an income / expense / transfer on the Cashflow page,
 * the Accounts page balance and the Dashboard net worth update automatically
 * (no explicit "recalculate" — every screen derives from the same engine).
 *
 * These are the exact scenarios from the user's ask:
 *   • Enter an expense on an account → that account's balance drops.
 *   • Enter income on an account    → that account's balance rises.
 *   • Delete either entry           → balance reverts exactly.
 *   • A transfer between accounts   → both move, net worth is unchanged.
 */

import { describe, expect, it } from 'vitest';
import {
  calcLiveAccountBalances,
  calculateNetWorth,
  getLiveBankTotal,
} from '../src/utils/calculations';
import type { Account, CashflowEntry } from '../src/types/investmentTypes';

const account = (patch: Partial<Account> = {}): Account =>
  ({
    id: 'acc_bank',
    name: 'HDFC Savings',
    type: 'bank',
    balance: 50_000,
    openingBalance: 50_000,
    openingBalanceDate: '2026-01-01',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...patch,
  }) as Account;

const flow = (patch: Partial<CashflowEntry> = {}): CashflowEntry =>
  ({
    id: 'cf_1',
    type: 'expense',
    date: '2026-05-01',
    category: 'General',
    amount: 1_000,
    accountId: 'acc_bank',
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
    userId: 'u1',
    ...patch,
  }) as CashflowEntry;

describe('Cashflow → Account auto-sync (the classic add/edit/delete loop)', () => {
  it('adding an expense instantly reduces that account\'s live balance', () => {
    const accounts = [account({ openingBalance: 50_000 })];
    const balances = calcLiveAccountBalances(accounts, [
      flow({ id: 'cf_exp', type: 'expense', amount: 2_500 }),
    ]);
    expect(balances.acc_bank).toBe(47_500);
  });

  it('adding an income instantly increases that account\'s live balance', () => {
    const accounts = [account({ openingBalance: 50_000 })];
    const balances = calcLiveAccountBalances(accounts, [
      flow({ id: 'cf_inc', type: 'income', amount: 10_000 }),
    ]);
    expect(balances.acc_bank).toBe(60_000);
  });

  it('deleting the entry reverts the balance to the opening value (idempotent derivation)', () => {
    const accounts = [account({ openingBalance: 50_000 })];
    const withFlow = calcLiveAccountBalances(accounts, [
      flow({ id: 'cf_exp', type: 'expense', amount: 2_500 }),
    ]);
    const afterDelete = calcLiveAccountBalances(accounts, []);
    expect(withFlow.acc_bank).toBe(47_500);
    expect(afterDelete.acc_bank).toBe(50_000);
  });

  it('a transfer moves cash between two accounts and leaves the liquid total unchanged', () => {
    const src = account({ id: 'acc_a', openingBalance: 40_000 });
    const dst = account({ id: 'acc_b', name: 'Cash in Hand', type: 'cash', openingBalance: 10_000, balance: 10_000 });
    const accounts = [src, dst];
    const balances = calcLiveAccountBalances(accounts, [
      flow({
        id: 'cf_xfer',
        type: 'transfer',
        amount: 5_000,
        accountId: 'acc_a',
        toAccountId: 'acc_b',
      }),
    ]);
    expect(balances.acc_a).toBe(35_000);
    expect(balances.acc_b).toBe(15_000);
    expect(getLiveBankTotal(accounts, [flow({ id: 'cf_xfer', type: 'transfer', amount: 5_000, accountId: 'acc_a', toAccountId: 'acc_b' })])).toBe(50_000);
  });

  it('net worth rises with income and falls with expense — one entry at a time', () => {
    const accounts = [account({ openingBalance: 50_000 })];
    const base = calculateNetWorth([], [], [], accounts, []);
    expect(base.netWorth).toBe(50_000);

    const withIncome = calculateNetWorth([], [], [], accounts, [
      flow({ id: 'i', type: 'income', amount: 3_000 }),
    ]);
    expect(withIncome.netWorth).toBe(53_000);

    const withExpense = calculateNetWorth([], [], [], accounts, [
      flow({ id: 'e', type: 'expense', amount: 1_200 }),
    ]);
    expect(withExpense.netWorth).toBe(48_800);
  });

  it('a cashflow without accountId does not touch any account balance but still counts as savings', () => {
    const accounts = [account({ openingBalance: 50_000 })];
    const orphan = flow({ id: 'orphan', type: 'income', amount: 500, accountId: undefined });
    const balances = calcLiveAccountBalances(accounts, [orphan]);
    expect(balances.acc_bank).toBe(50_000);

    const nw = calculateNetWorth([], [], [], accounts, [orphan]);
    expect(nw.cashflowSavings).toBe(500);
  });

  it('openingBalanceDate acts as a hard cutoff — older entries are ignored for that account', () => {
    const acc = account({ openingBalance: 30_000, openingBalanceDate: '2026-04-01' });
    const older = flow({ id: 'old', type: 'expense', date: '2026-03-01', amount: 1_000 });
    const newer = flow({ id: 'new', type: 'expense', date: '2026-05-01', amount: 2_000 });
    const balances = calcLiveAccountBalances([acc], [older, newer]);
    expect(balances.acc_bank).toBe(28_000); // only the 2,000 expense after 04-01 counts
  });
});
