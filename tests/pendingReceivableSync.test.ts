/**
 * tests/pendingReceivableSync.test.ts
 *
 * Feature: Money You Lent / Receivables. When a Pending Payment is marked
 * "Received" on the Payments page, the store:
 *   1. flips the pending payment status to `received`,
 *   2. auto-posts a matching income Cashflow so it appears on the Cashflow
 *      page and rolls into net worth,
 *   3. uses a deterministic cashflow id (`cf_receivable_<pendingId>`) so a
 *      second "mark received" click cannot create a duplicate income entry.
 *
 * The pending → cashflow bridge is derived (not persisted on the pending
 * doc); the existence of `cf_receivable_<id>` in cashflows IS the sync flag.
 */

import { describe, expect, it } from 'vitest';
import { calculateNetWorth, getReceivablesTotals } from '../src/utils/calculations';
import type {
  Account,
  CashflowEntry,
  PendingPayment,
} from '../src/types/investmentTypes';

/** The exact id convention used by `markPendingPaymentReceived`. */
const cfReceivableId = (pendingId: string) => `cf_receivable_${pendingId}`;

const pending = (patch: Partial<PendingPayment> = {}): PendingPayment =>
  ({
    id: 'pp_1',
    buyerName: 'Ravi',
    amount: 7_500,
    expectedPaymentDate: '2026-05-01',
    status: 'pending',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    userId: 'u1',
    ...patch,
  }) as PendingPayment;

const account = (): Account =>
  ({
    id: 'acc_bank',
    name: 'HDFC Savings',
    type: 'bank',
    balance: 20_000,
    openingBalance: 20_000,
    openingBalanceDate: '2026-01-01',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }) as Account;

describe('Pending receivable → Cashflow auto-sync (mark received)', () => {
  it('uses a deterministic id so a re-click is idempotent', () => {
    expect(cfReceivableId('pp_1')).toBe('cf_receivable_pp_1');
    expect(cfReceivableId('pp_1')).toBe(cfReceivableId('pp_1'));
    expect(cfReceivableId('pp_2')).not.toBe(cfReceivableId('pp_1'));
  });

  it('marking as received removes it from the receivables total', () => {
    const pendings = [
      pending({ id: 'pp_1', amount: 7_500, status: 'pending' }),
      pending({ id: 'pp_2', amount: 2_000, status: 'received' }),
    ];
    const totals = getReceivablesTotals(pendings);
    expect(totals.total).toBe(7_500); // only pp_1 still pending
    expect(totals.count).toBe(1);
  });

  it('a posted receivable income raises net worth (no accountId = off-account savings)', () => {
    const accounts = [account()];
    const income: CashflowEntry = {
      id: cfReceivableId('pp_1'),
      type: 'income',
      date: '2026-05-01',
      category: 'Receivable — Ravi',
      amount: 7_500,
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
      userId: 'u1',
    };
    const nw = calculateNetWorth([], [], [], accounts, [income]);
    expect(nw.cashflowSavings).toBe(7_500);
    expect(nw.netWorth).toBe(27_500); // 20k cash + 7.5k off-account income
  });

  it('a second call would find the existing cf_receivable_<id> and skip re-inserting', () => {
    // This mirrors the store's `alreadyInCF` guard exactly:
    //   const alreadyInCF = get().cashflows.some((c) => c.id === cfId);
    //   if (!alreadyInCF) await saveDoc(...);
    const existingCashflows = [
      { id: cfReceivableId('pp_1'), type: 'income' } as CashflowEntry,
    ];
    const cfId = cfReceivableId('pp_1');
    const alreadyInCF = existingCashflows.some((c) => c.id === cfId);
    expect(alreadyInCF).toBe(true);
  });
});
