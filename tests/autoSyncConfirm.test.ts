/**
 * tests/autoSyncConfirm.test.ts
 *
 * Feature: Auto-sync confirmation gate. Before any UI action that will also
 * write linked rows to another collection (bond interest → cashflow, mark
 * paid → next bill + cashflow + policy advance, mark received → cashflow),
 * the app shows a Yes/No prompt explaining exactly what will change.
 *
 * These tests pin:
 *   • The prompt text always contains the "What will change:" header and
 *     every line of the `affects` array.
 *   • `confirmAutoSync` returns false when `window.confirm` returns false
 *     (so callers short-circuit and no side effects run).
 *   • Every builder produces a human-readable summary the user can decide on.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildBondSettlePrompt,
  buildBondSyncPrompt,
  buildMarkPaidPrompt,
  buildMarkReceivedPrompt,
  confirmAutoSync,
  formatAutoSyncMessage,
} from '../src/utils/autoSyncConfirm';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('formatAutoSyncMessage', () => {
  it('renders title, description, every affects line, and the OK/Cancel hint', () => {
    const text = formatAutoSyncMessage({
      title: 'Hello',
      description: 'Body',
      affects: ['Do X', 'Do Y'],
    });
    expect(text).toContain('Hello');
    expect(text).toContain('Body');
    expect(text).toContain('What will change:');
    expect(text).toContain('  • Do X');
    expect(text).toContain('  • Do Y');
    expect(text).toContain('OK to sync now, or Cancel');
  });

  it('adds the ⚠ irreversible banner only when flagged', () => {
    expect(formatAutoSyncMessage({ title: 't', description: 'd', affects: [] })).not.toContain('irreversible');
    const withWarn = formatAutoSyncMessage({
      title: 't',
      description: 'd',
      affects: [],
      irreversible: true,
    });
    expect(withWarn).toContain('cannot be easily undone');
  });
});

describe('confirmAutoSync gate', () => {
  it('returns false when the user cancels → caller MUST skip the sync', () => {
    let seen = '';
    const spy = vi.fn((msg: string) => {
      seen = msg;
      return false;
    });
    vi.stubGlobal('window', { confirm: spy });
    const ok = confirmAutoSync({ title: 'x', description: 'y', affects: ['z'] });
    expect(ok).toBe(false);
    expect(spy).toHaveBeenCalledTimes(1);
    // The exact message passed to window.confirm contains the affects list.
    expect(seen).toContain('What will change:');
  });

  it('returns true when the user accepts', () => {
    vi.stubGlobal('window', { confirm: () => true });
    expect(confirmAutoSync({ title: 'x', description: 'y', affects: [] })).toBe(true);
  });

  it('defaults to false in non-browser environments (no window.confirm)', () => {
    vi.stubGlobal('window', undefined);
    expect(confirmAutoSync({ title: 'x', description: 'y', affects: [] })).toBe(false);
  });
});

describe('buildMarkPaidPrompt', () => {
  it('mentions the expense Cashflow, next recurring bill, and policy advance when linked', () => {
    const p = buildMarkPaidPrompt({
      title: 'HDFC EMI',
      amount: 41500,
      recurrence: 'monthly',
      isLinkedToInsurance: true,
    });
    const msg = formatAutoSyncMessage(p);
    expect(msg).toContain('HDFC EMI');
    expect(msg).toContain('41,500'); // en-IN grouping
    expect(msg).toContain('expense to Cashflow');
    expect(msg).toContain('next recurring bill (monthly)');
    expect(msg).toContain('insurance policy renewal');
  });

  it('omits the recurring-bill line when the payment is one-off', () => {
    const p = buildMarkPaidPrompt({
      title: 'One Time Fee',
      amount: 500,
      recurrence: 'none',
    });
    const msg = formatAutoSyncMessage(p);
    expect(msg).not.toContain('next recurring bill');
    expect(msg).not.toContain('insurance policy');
  });
});

describe('buildBondSyncPrompt / buildBondSettlePrompt', () => {
  it('sync prompt names the count and rupee total', () => {
    const msg = formatAutoSyncMessage(buildBondSyncPrompt(3, 4500));
    expect(msg).toContain('3 Cashflow income entries');
    expect(msg).toContain('4,500');
    expect(msg).toContain('never duplicated');
  });

  it('sync prompt uses singular for one coupon', () => {
    expect(formatAutoSyncMessage(buildBondSyncPrompt(1, 1000))).toContain('1 Cashflow income entry ');
  });

  it('settle prompt flags irreversibility and lists the archive step', () => {
    const msg = formatAutoSyncMessage(buildBondSettlePrompt('TCS Bond', 100_000, 2));
    expect(msg).toContain('TCS Bond');
    expect(msg).toContain('cannot be easily undone');
    expect(msg).toContain('matured');
    expect(msg).toContain('transfer of ₹1,00,000');
    expect(msg).toContain('2 pending Bond Interest income entries');
  });

  it('settle prompt says interest is already synced when count is zero', () => {
    expect(formatAutoSyncMessage(buildBondSettlePrompt('B', 10, 0))).toContain(
      'All interest has already been synced.',
    );
  });
});

describe('buildMarkReceivedPrompt', () => {
  it('names buyer, amount, and both side effects', () => {
    const msg = formatAutoSyncMessage(buildMarkReceivedPrompt('Ravi', 7500));
    expect(msg).toContain('Ravi');
    expect(msg).toContain('7,500');
    expect(msg).toContain('Flip the pending payment');
    expect(msg).toContain('income entry');
    expect(msg).toContain('Net worth will rise');
  });
});
