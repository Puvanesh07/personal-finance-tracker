/**
 * src/utils/spendingVelocity.ts
 * Spending Velocity — Tier 2.
 * Shows how fast money is being spent this month vs budget/average.
 */
import type { CashflowEntry } from '../types/investmentTypes';

export interface SpendingVelocityResult {
  daysInMonth: number;
  daysElapsed: number;
  daysRemaining: number;
  spentSoFar: number;
  projectedMonthEnd: number;   // at current daily rate
  avgMonthlyExpense: number;   // 3-month average
  dailyBurnRate: number;       // today's avg spend/day
  expectedSpendAtThisPoint: number; // linear expected based on avg
  velocityPct: number;         // 100 = on track, >100 = spending faster
  budgetUsedPct: number;       // % of avg monthly used
  verdict: 'on_track' | 'slightly_over' | 'over' | 'critical';
  message: string;
  topCategoryToday: string | null;
  topCategoryThisMonth: string | null;
}

export function computeSpendingVelocity(cashflows: CashflowEntry[]): SpendingVelocityResult {
  const now       = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysElapsed = now.getDate();
  const daysRemaining = daysInMonth - daysElapsed;

  // This month's expenses
  const thisMonthExp = cashflows.filter(e => e.type === 'expense' && e.date.startsWith(thisMonth));
  const spentSoFar   = thisMonthExp.reduce((a, e) => a + e.amount, 0);

  // 3-month average (exclude current month)
  const prevMonths = [...new Set(
    cashflows
      .filter(e => e.type === 'expense' && !e.date.startsWith(thisMonth))
      .map(e => e.date.slice(0, 7)),
  )].sort().slice(-3);

  const prevTotal    = cashflows
    .filter(e => e.type === 'expense' && prevMonths.includes(e.date.slice(0, 7)))
    .reduce((a, e) => a + e.amount, 0);
  const avgMonthly   = prevMonths.length > 0 ? prevTotal / prevMonths.length : 0;

  const dailyBurnRate = daysElapsed > 0 ? spentSoFar / daysElapsed : 0;
  const projected     = dailyBurnRate * daysInMonth;

  // Expected at this point in month (linear)
  const expectedAtPoint = avgMonthly > 0 ? (avgMonthly / daysInMonth) * daysElapsed : 0;
  const velocityPct     = expectedAtPoint > 0 ? (spentSoFar / expectedAtPoint) * 100 : 100;
  const budgetUsedPct   = avgMonthly > 0 ? (spentSoFar / avgMonthly) * 100 : 0;

  // Top categories
  const catTotals = thisMonthExp.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + e.amount;
    return acc;
  }, {} as Record<string, number>);
  const topCategoryThisMonth = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const todayStr = now.toISOString().slice(0, 10);
  const todayExp = thisMonthExp.filter(e => e.date === todayStr);
  const todayCats = todayExp.reduce((acc, e) => { acc[e.category] = (acc[e.category] ?? 0) + e.amount; return acc; }, {} as Record<string, number>);
  const topCategoryToday = Object.entries(todayCats).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const verdict: SpendingVelocityResult['verdict'] =
    velocityPct >= 150 ? 'critical'
    : velocityPct >= 120 ? 'over'
    : velocityPct >= 105 ? 'slightly_over'
    : 'on_track';

  const message =
    verdict === 'critical'
      ? `You've used ${Math.round(budgetUsedPct)}% of your monthly budget with ${daysRemaining} days left. Projected month-end: ₹${Math.round(projected).toLocaleString('en-IN')}.`
      : verdict === 'over'
      ? `Spending ${Math.round(velocityPct - 100)}% faster than usual. Slow down to stay on track.`
      : verdict === 'slightly_over'
      ? `Slightly above pace — ${Math.round(budgetUsedPct)}% used with ${daysRemaining}d remaining.`
      : `On track. ${Math.round(budgetUsedPct)}% of monthly budget used with ${daysRemaining} days left.`;

  return {
    daysInMonth, daysElapsed, daysRemaining, spentSoFar,
    projectedMonthEnd: projected, avgMonthlyExpense: avgMonthly,
    dailyBurnRate, expectedSpendAtThisPoint: expectedAtPoint,
    velocityPct, budgetUsedPct, verdict, message,
    topCategoryToday, topCategoryThisMonth,
  };
}
