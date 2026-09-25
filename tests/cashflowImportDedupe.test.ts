/**
 * tests/cashflowImportDedupe.test.ts  (audit I2)
 *
 * Statement imports have no natural key, so re-importing the same month must
 * be caught by a content fingerprint (account + date + type + whole-rupee
 * amount). These tests pin the pure helper the import wizard relies on before
 * it ever touches the store — a false negative duplicates the user's ledger,
 * a false positive silently drops a legitimate second coffee.
 */

import { describe, expect, it } from 'vitest';
import {
  cashflowDuplicateKey,
  findDuplicateRowNumbers,
} from '../src/utils/cashflowImport';

const draft = (over: Partial<Parameters<typeof cashflowDuplicateKey>[0]> = {}) => ({
  accountId: 'acc1',
  date: '2026-09-01',
  type: 'expense',
  amount: 500,
  ...over,
});

describe('cashflowDuplicateKey', () => {
  it('fingerprints account, date, type and rounded amount', () => {
    expect(cashflowDuplicateKey(draft())).toBe('acc1|2026-09-01|expense|500');
  });

  it('treats a missing account as its own bucket (not "" colliding with an id)', () => {
    const key = cashflowDuplicateKey(draft({ accountId: undefined }));
    expect(key.startsWith('__any__|')).toBe(true);
    expect(key).not.toBe(cashflowDuplicateKey(draft({ accountId: '' })));
  });

  it('rounds paise so 500.4 and 500.2 from different sources still collide', () => {
    expect(cashflowDuplicateKey(draft({ amount: 500.4 }))).toBe(
      cashflowDuplicateKey(draft({ amount: 500.2 })),
    );
  });

  it('does NOT collide on a different date, type, account or amount', () => {
    const base = cashflowDuplicateKey(draft());
    expect(cashflowDuplicateKey(draft({ date: '2026-09-02' }))).not.toBe(base);
    expect(cashflowDuplicateKey(draft({ type: 'income' }))).not.toBe(base);
    expect(cashflowDuplicateKey(draft({ accountId: 'acc2' }))).not.toBe(base);
    expect(cashflowDuplicateKey(draft({ amount: 501 }))).not.toBe(base);
  });
});

describe('findDuplicateRowNumbers', () => {
  it('flags a row that matches an already-stored entry', () => {
    const dupes = findDuplicateRowNumbers(
      [{ rowNumber: 3, draft: draft() }],
      [draft()],
    );
    expect([...dupes]).toEqual([3]);
  });

  it('flags the second of two identical rows inside the same file', () => {
    const dupes = findDuplicateRowNumbers(
      [
        { rowNumber: 1, draft: draft() },
        { rowNumber: 2, draft: draft() },
      ],
      [],
    );
    // First occurrence wins — only row 2 is a duplicate.
    expect([...dupes]).toEqual([2]);
  });

  it('leaves distinct rows untouched', () => {
    const dupes = findDuplicateRowNumbers(
      [
        { rowNumber: 1, draft: draft() },
        { rowNumber: 2, draft: draft({ amount: 750 }) },
        { rowNumber: 3, draft: draft({ type: 'income' }) },
      ],
      [draft({ accountId: 'other' })],
    );
    expect(dupes.size).toBe(0);
  });

  it('returns an empty set for an empty batch', () => {
    expect(findDuplicateRowNumbers([], [draft()]).size).toBe(0);
  });
});
