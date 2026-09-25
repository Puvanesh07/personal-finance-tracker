/**
 * tests/alertRules.test.ts
 *
 * The single alert engine (finding #11) that both the in-app bell and the daily
 * email now share. Two invariants matter most:
 *   1. settings gating — a category the user switched off must stay silent, and
 *      the master switch must silence everything.
 *   2. occurrence-scoped keys — one real-world event maps to one key, so a
 *      reminder cannot spam the user and next month's EMI is a NEW key.
 */

import { describe, expect, it } from 'vitest';
import {
  buildMoneyAlerts,
  daysUntil,
  nextMonthlyOccurrence,
  sortBySeverity,
} from '../shared/alertRules.mjs';

/** An ISO yyyy-mm-dd `n` days from local today. */
const isoIn = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

describe('daysUntil / nextMonthlyOccurrence', () => {
  it('measures whole days from today', () => {
    expect(daysUntil(isoIn(0))).toBe(0);
    expect(daysUntil(isoIn(3))).toBe(3);
    expect(daysUntil(isoIn(-2))).toBe(-2);
    expect(daysUntil(undefined)).toBeNaN();
  });

  it('collapses day 31 onto 28 so February never breaks it', () => {
    const { date } = nextMonthlyOccurrence(31);
    expect(Number(date.slice(-2))).toBe(28);
  });
});

describe('buildMoneyAlerts gating', () => {
  const data = {
    trackedPayments: [{ id: 'b1', title: 'Electricity', amount: 1200, dueDate: isoIn(0), status: 'unpaid' }],
    insurancePolicies: [{ id: 'i1', policyName: 'Term', renewalDate: isoIn(3), premiumAmount: 9000 }],
  };

  it('respects the master switch', () => {
    expect(buildMoneyAlerts(data, { pushEnabled: false })).toEqual([]);
    expect(buildMoneyAlerts(data, {}).length).toBeGreaterThan(0);
  });

  it('silences a category the user switched off', () => {
    const only = buildMoneyAlerts(data, { paymentReminders: false });
    expect(only.every((a) => a.kind !== 'payment')).toBe(true);
    expect(only.some((a) => a.kind === 'insurance')).toBe(true);
  });
});

describe('buildMoneyAlerts keys', () => {
  it('scopes a payment key to the exact due date (occurrence, not entity)', () => {
    const bill = { id: 'c1', title: 'Card Bill', amount: 5000, status: 'unpaid' };
    const soon = buildMoneyAlerts({ trackedPayments: [{ ...bill, dueDate: isoIn(0) }] }, {});
    expect(soon[0].key).toBe(`payment:due_today:c1:${isoIn(0)}`);
  });

  it('emits at most one alert per checkpoint for a single due date', () => {
    const due = isoIn(1);
    const alerts = buildMoneyAlerts({ trackedPayments: [{ id: 'x', amount: 100, dueDate: due, status: 'unpaid' }] }, {});
    expect(alerts).toHaveLength(1);
    expect(alerts[0].variant).toBe('due_in_1d');
  });

  it('sorts critical before high before medium', () => {
    const sorted = sortBySeverity([
      { severity: 'medium' },
      { severity: 'critical' },
      { severity: 'high' },
    ]);
    expect(sorted.map((s) => s.severity)).toEqual(['critical', 'high', 'medium']);
  });
});
