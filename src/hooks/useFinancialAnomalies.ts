/**
 * src/hooks/useFinancialAnomalies.ts
 *
 * Real-time Financial Anomaly Detection — Feature 34 / Level 5.
 * Detects:
 *   1. Unusually large single transaction (vs personal history)
 *   2. Spending spike — this month vs 3-month average
 *   3. Unusual income drop
 *   4. High-frequency small purchases (financial leakage)
 *   5. Silent expense category growth (silent expense detector)
 */

import { useMemo } from 'react';
import { usePortfolioStore } from '../store/portfolioStore';
import { formatINR } from '../utils/format';

export type AnomalySeverity = 'critical' | 'warning' | 'info';

export interface FinancialAnomaly {
  id: string;
  emoji: string;
  title: string;
  body: string;
  severity: AnomalySeverity;
  /** Pre-filled AI Coach question */
  question: string;
  linkTo?: string;
}

function monthKey(date: string) { return date.slice(0, 7); }
function daysIntoMonth() { return new Date().getDate(); }
function thisMonth() { return new Date().toISOString().slice(0, 7); }

export function useFinancialAnomalies(): FinancialAnomaly[] {
  const cashflows = usePortfolioStore((s) => s.cashflows);

  return useMemo(() => {
    const anomalies: FinancialAnomaly[] = [];
    const now     = thisMonth();
    const current = cashflows.filter((e) => e.date.startsWith(now));

    // ── 1. Unusually large single transaction ───────────────────────────────
    const expEntries  = cashflows.filter((e) => e.type === 'expense');
    if (expEntries.length >= 10) {
      const sorted = [...expEntries].sort((a, b) => b.amount - a.amount);
      const top5   = sorted.slice(0, Math.ceil(expEntries.length * 0.1));
      const avg    = expEntries.reduce((s, e) => s + e.amount, 0) / expEntries.length;
      const threshold = avg * 5; // 5x average = anomaly

      for (const entry of current.filter((e) => e.type === 'expense')) {
        if (entry.amount >= threshold && !top5.some((t) => t.id === entry.id)) {
          anomalies.push({
            id:       `large_txn_${entry.id}`,
            emoji:    '🔴',
            title:    `Unusually large expense: ${formatINR(entry.amount)}`,
            body:     `${entry.category} on ${entry.date} — ${Math.round(entry.amount / avg)}× your average transaction`,
            severity: 'critical',
            question: 'Why do I have an unusually large expense?',
            linkTo:   '/cashflow',
          });
          break; // one at a time
        }
      }
    }

    // ── 2. Spending spike — this month vs 3-month average ──────────────────
    const prevMonths = [...new Set(
      cashflows
        .filter((e) => e.type === 'expense' && !e.date.startsWith(now))
        .map((e) => monthKey(e.date)),
    )].sort().slice(-3);

    if (prevMonths.length >= 2) {
      const prevExp = cashflows.filter(
        (e) => e.type === 'expense' && prevMonths.includes(monthKey(e.date)),
      );
      const prevAvg    = prevExp.reduce((s, e) => s + e.amount, 0) / prevMonths.length;
      const currentExp = current.filter((e) => e.type === 'expense');
      const thisMonthTotal = currentExp.reduce((s, e) => s + e.amount, 0);

      // Pro-rate: compare at same point in month
      const daysFraction = Math.min(daysIntoMonth() / 30, 1);
      const projected    = daysFraction > 0 ? thisMonthTotal / daysFraction : thisMonthTotal;
      const spikePct     = prevAvg > 0 ? ((projected - prevAvg) / prevAvg) * 100 : 0;

      if (spikePct >= 25) {
        anomalies.push({
          id:       'spending_spike',
          emoji:    '🔴',
          title:    `Spending ${Math.round(spikePct)}% higher than usual`,
          body:     `Projected month-end: ${formatINR(Math.round(projected))} vs avg ${formatINR(Math.round(prevAvg))}`,
          severity: spikePct >= 50 ? 'critical' : 'warning',
          question: 'Why is my spending higher than usual this month?',
          linkTo:   '/cashflow',
        });
      }
    }

    // ── 3. Income drop this month ───────────────────────────────────────────
    const prevIncomeMonths = [...new Set(
      cashflows
        .filter((e) => e.type === 'income' && !e.date.startsWith(now))
        .map((e) => monthKey(e.date)),
    )].sort().slice(-3);

    if (prevIncomeMonths.length >= 2) {
      const prevInc    = cashflows.filter(
        (e) => e.type === 'income' && prevIncomeMonths.includes(monthKey(e.date)),
      );
      const prevAvgInc = prevInc.reduce((s, e) => s + e.amount, 0) / prevIncomeMonths.length;
      const thisInc    = current.filter((e) => e.type === 'income').reduce((s, e) => s + e.amount, 0);
      const dropPct    = prevAvgInc > 0 ? ((prevAvgInc - thisInc) / prevAvgInc) * 100 : 0;

      if (dropPct >= 30 && daysIntoMonth() > 10) {
        anomalies.push({
          id:       'income_drop',
          emoji:    '🟠',
          title:    `Income ${Math.round(dropPct)}% lower than average`,
          body:     `This month: ${formatINR(thisInc)} vs avg ${formatINR(Math.round(prevAvgInc))}`,
          severity: 'warning',
          question: 'Why is my income lower than usual this month?',
          linkTo:   '/cashflow',
        });
      }
    }

    // ── 4. Financial leakage — many small purchases ─────────────────────────
    const smallExpenses = current.filter((e) => e.type === 'expense' && e.amount < 500);
    if (smallExpenses.length >= 10) {
      const total = smallExpenses.reduce((s, e) => s + e.amount, 0);
      anomalies.push({
        id:       'financial_leakage',
        emoji:    '💧',
        title:    `${smallExpenses.length} small purchases totalling ${formatINR(total)}`,
        body:     `These transactions (each < ₹500) add up to ${formatINR(total)} this month`,
        severity: 'info',
        question: 'How much am I spending on small purchases this month?',
        linkTo:   '/cashflow',
      });
    }

    // ── 5. Silent expense growth — category growing quietly ────────────────
    if (prevMonths.length >= 2) {
      const catMap: Record<string, number[]> = {};

      for (const m of prevMonths) {
        const monthEntries = cashflows.filter(
          (e) => e.type === 'expense' && monthKey(e.date) === m,
        );
        for (const e of monthEntries) {
          if (!catMap[e.category]) catMap[e.category] = [];
          catMap[e.category].push(e.amount);
        }
      }

      for (const [cat, amounts] of Object.entries(catMap)) {
        if (amounts.length < 2) continue;
        const prevMonthAmt = amounts[amounts.length - 1];
        const olderAvg     = amounts.slice(0, -1).reduce((s, v) => s + v, 0) / (amounts.length - 1);
        const growth       = olderAvg > 0 ? ((prevMonthAmt - olderAvg) / olderAvg) * 100 : 0;

        if (growth >= 40 && prevMonthAmt >= 1000) {
          anomalies.push({
            id:       `silent_growth_${cat}`,
            emoji:    '📈',
            title:    `"${cat}" spending up ${Math.round(growth)}%`,
            body:     `Last month: ${formatINR(prevMonthAmt)} vs ${formatINR(Math.round(olderAvg))} prior avg`,
            severity: 'info',
            question: `Why did my ${cat} spending increase?`,
            linkTo:   '/cashflow',
          });
          break; // one at a time
        }
      }
    }

    return anomalies.slice(0, 5);
  }, [cashflows]);
}
