// tests/financialDNACache.test.ts — audit Y6
// computeFinancialDNA is memoized across calls; verify it (a) returns a stable
// result for identical inputs, (b) shares the same object reference on a cache
// hit, and (c) recomputes when the underlying data changes (length or updatedAt).
import { describe, it, expect } from 'vitest';
import { computeFinancialDNA } from '../src/utils/financialDNA';
import type { CashflowEntry, Investment, Liability } from '../src/types/investmentTypes';

const cf = (over: Partial<CashflowEntry>): CashflowEntry => ({
  id: over.id ?? 'cf1',
  type: 'expense',
  date: '2026-01-05',
  category: 'Food',
  amount: 500,
  createdAt: '2026-01-05T00:00:00.000Z',
  updatedAt: '2026-01-05T00:00:00.000Z',
  ...over,
});

const baseCash = [
  cf({ id: 'i1', type: 'income', category: 'Salary', amount: 50000, date: '2026-01-01' }),
  cf({ id: 'e1', type: 'expense', category: 'Rent', amount: 15000, date: '2026-01-02' }),
  cf({ id: 'e2', type: 'expense', category: 'Dining', amount: 1200, date: '2026-01-03' }),
];
const invs: Investment[] = [];
const liabs: Liability[] = [];
const essentials = { emergencyFundCurrent: 30000, emergencyFundTarget: 60000 };

describe('computeFinancialDNA memo cache (Y6)', () => {
  it('returns an equal, referentially-shared result for identical inputs', () => {
    const a = computeFinancialDNA(baseCash, invs, liabs, essentials);
    const b = computeFinancialDNA(baseCash, invs, liabs, essentials);
    expect(a).toBe(b); // cache hit → same object
    expect(a.dimensions).toHaveLength(5);
  });

  it('recomputes when a new row changes the collection length', () => {
    const first = computeFinancialDNA(baseCash, invs, liabs, essentials);
    const withExtra = [...baseCash, cf({ id: 'e3', amount: 800, date: '2026-02-01' })];
    const second = computeFinancialDNA(withExtra, invs, liabs, essentials);
    expect(second).not.toBe(first);
  });

  it('recomputes when an existing row is edited (updatedAt bumps, length same)', () => {
    const first = computeFinancialDNA(baseCash, invs, liabs, essentials);
    const edited = baseCash.map((c) =>
      c.id === 'e2'
        ? { ...c, amount: 9999, updatedAt: '2026-03-01T00:00:00.000Z' }
        : c,
    );
    const second = computeFinancialDNA(edited, invs, liabs, essentials);
    expect(second).not.toBe(first);
  });
});
