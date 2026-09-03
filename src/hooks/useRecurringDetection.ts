/**
 * src/hooks/useRecurringDetection.ts
 *
 * Recurring Transaction Detection — Feature 5 (hook).
 * Scans cashflow entries and identifies likely recurring transactions
 * based on: same category + similar amount + repeating monthly pattern.
 */

import { useMemo } from 'react';
import { usePortfolioStore } from '../store/portfolioStore';
import { formatINR } from '../utils/format';

export interface RecurringCandidate {
  category: string;
  type: 'income' | 'expense';
  avgAmount: number;
  occurrences: number;
  months: string[];         // YYYY-MM list of months it appeared
  lastDate: string;
  confidence: 'high' | 'medium';
  suggestedTitle: string;
}

export function useRecurringDetection(): RecurringCandidate[] {
  const cashflows = usePortfolioStore((s) => s.cashflows);

  return useMemo(() => {
    if (cashflows.length < 4) return [];

    // Group by (type, category) key
    const groups = new Map<string, typeof cashflows>();
    for (const e of cashflows) {
      const key = `${e.type}__${(e.category || '').toLowerCase().trim()}`;
      const arr = groups.get(key) ?? [];
      arr.push(e);
      groups.set(key, arr);
    }

    const candidates: RecurringCandidate[] = [];

    for (const [key, entries] of groups) {
      if (entries.length < 2) continue;

      // Distinct months this category appeared
      const monthSet = new Set(entries.map((e) => e.date.slice(0, 7)));
      if (monthSet.size < 2) continue;

      const months   = [...monthSet].sort();
      const amounts  = entries.map((e) => e.amount);
      const avgAmt   = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const minAmt   = Math.min(...amounts);
      const maxAmt   = Math.max(...amounts);

      // Amount stability: max deviation < 20% of average → likely recurring
      const deviation = maxAmt - minAmt;
      const stable    = deviation / avgAmt < 0.2;

      // Monthly pattern: check consecutive-month gaps
      const monthDates = months.map((m) => {
        const [y, mo] = m.split('-').map(Number);
        return y * 12 + mo;
      });
      let consecutiveCount = 0;
      for (let i = 1; i < monthDates.length; i++) {
        if (monthDates[i] - monthDates[i - 1] === 1) consecutiveCount++;
      }
      const isConsecutive = consecutiveCount >= Math.floor(months.length * 0.6);

      if (!stable && !isConsecutive) continue;
      if (months.length < 2) continue;

      const [type, category] = key.split('__') as ['income' | 'expense', string];
      const confidence: RecurringCandidate['confidence'] =
        stable && isConsecutive && months.length >= 3 ? 'high' : 'medium';

      const lastDate  = entries.sort((a, b) => b.date.localeCompare(a.date))[0].date;
      const titleCase = category.replace(/\b\w/g, (c) => c.toUpperCase());

      candidates.push({
        category:       titleCase,
        type,
        avgAmount:      Math.round(avgAmt),
        occurrences:    months.length,
        months,
        lastDate,
        confidence,
        suggestedTitle: `${titleCase} (${formatINR(Math.round(avgAmt))}/mo)`,
      });
    }

    // Sort by confidence then occurrences
    return candidates
      .sort((a, b) => {
        if (a.confidence !== b.confidence) return a.confidence === 'high' ? -1 : 1;
        return b.occurrences - a.occurrences;
      })
      .slice(0, 10);
  }, [cashflows]);
}
