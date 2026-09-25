/**
 * tests/recurringCatchUp.test.ts  (audit I1)
 *
 * Latest-occurrence-only catch-up: when the app stays closed for one or more
 * cycles, the SINGLE pending recurring bill re-anchors to the current period —
 * the missed intermediate bills are never minted, paid bills are never touched,
 * and a just-overdue bill stays overdue so it can still be marked paid late.
 */

import { describe, expect, it } from 'vitest';
import { advanceToCurrentOccurrence } from '../src/utils/paymentTracker';
import type { TrackedPayment } from '../src/types/investmentTypes';

const bill = (over: Partial<TrackedPayment> = {}): TrackedPayment =>
  ({
    id: 'tp1',
    title: 'Rent',
    paymentType: 'rent',
    amount: 15000,
    dueDate: '2026-06-01',
    status: 'pending',
    reminderDays: [1, 3, 7],
    recurrence: 'monthly',
    seriesStartDate: '2026-06-01',
    seriesIndex: 0,
    seriesBaseAmount: 15000,
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...over,
  }) as TrackedPayment;

describe('advanceToCurrentOccurrence', () => {
  it('re-anchors a bill left months behind to the FIRST occurrence on/after today', () => {
    const res = advanceToCurrentOccurrence(bill(), '2026-09-24');
    expect(res).not.toBeNull();
    // June 1 → July 1 → Aug 1 → Sep 1 → Oct 1 (first date >= today).
    expect(res!.dueDate).toBe('2026-10-01');
    expect(res!.seriesIndex).toBe(4);
  });

  it('never mints the missed intermediate occurrences', () => {
    // A single patch is returned, not one per skipped cycle.
    const res = advanceToCurrentOccurrence(bill(), '2026-09-24');
    expect(res).not.toBeNull();
    expect(res!.dueDate > '2026-09-24' || res!.dueDate === '2026-09-24').toBe(
      true,
    );
    // Jul/Aug (the missed ones) are simply gone — no arrays, no duplicates.
    expect(res!.dueDate).not.toBe('2026-07-01');
    expect(res!.dueDate).not.toBe('2026-08-01');
  });

  it('recomputes the escalated amount from the series anchor, not from drift', () => {
    const res = advanceToCurrentOccurrence(
      bill({ increaseAmount: 500, increaseEvery: 'recurrence' }),
      '2026-09-24',
    );
    // Index 4 × ₹500 on a ₹15,000 base.
    expect(res!.amount).toBe(17000);
  });

  it('leaves a just-overdue bill alone so it can still be paid late', () => {
    // 10 days late on a monthly series = inside the 45-day grace window.
    expect(advanceToCurrentOccurrence(bill({ dueDate: '2026-09-14' }), '2026-09-24')).toBeNull();
  });

  it('leaves current and future bills untouched', () => {
    expect(advanceToCurrentOccurrence(bill({ dueDate: '2026-12-01' }), '2026-09-24')).toBeNull();
  });

  it('never advances a paid bill (history stays written)', () => {
    expect(
      advanceToCurrentOccurrence(
        bill({ status: 'paid', paidAt: '2026-06-02' }),
        '2026-09-24',
      ),
    ).toBeNull();
  });

  it('stops when the series end date falls before today', () => {
    expect(
      advanceToCurrentOccurrence(
        bill({ endDate: '2026-08-01' }),
        '2026-09-24',
      ),
    ).toBeNull();
  });

  it('ignores one-time bills', () => {
    expect(
      advanceToCurrentOccurrence(bill({ recurrence: 'none' }), '2026-09-24'),
    ).toBeNull();
  });

  it('is idempotent — running it on the advanced bill changes nothing', () => {
    const today = '2026-09-24';
    const first = advanceToCurrentOccurrence(bill(), today)!;
    const moved = bill({
      dueDate: first.dueDate,
      seriesIndex: first.seriesIndex,
      amount: first.amount,
    });
    expect(advanceToCurrentOccurrence(moved, today)).toBeNull();
  });
});
