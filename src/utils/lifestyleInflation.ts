/**
 * src/utils/lifestyleInflation.ts
 * Lifestyle Inflation Detector — Tier 2.
 * Compares income growth % vs expense growth % over the last 6 months.
 * Detects lifestyle creep: expenses growing faster than income.
 */
import type { CashflowEntry } from '../types/investmentTypes';

export interface MonthlySnapshot {
  month: string; // YYYY-MM
  income: number;
  expense: number;
  savings: number;
  savingsRate: number;
}

export interface LifestyleInflationResult {
  months: MonthlySnapshot[];
  incomeGrowthPct: number;    // % change first→last
  expenseGrowthPct: number;   // % change first→last
  creepDetected: boolean;     // expenses growing faster than income
  creepGapPct: number;        // expenseGrowth - incomeGrowth
  discretionaryGrowthPct: number; // growth in non-essential categories
  verdict: 'healthy' | 'watch' | 'creep';
  message: string;
}

const ESSENTIAL_CATS = new Set([
  'Housing & Rent', 'Rent', 'Groceries', 'Healthcare', 'Utilities',
  'EMI & Loans', 'Insurance', 'Education', 'Taxes', 'Transport',
]);

export function detectLifestyleInflation(cashflows: CashflowEntry[]): LifestyleInflationResult {
  const monthMap = new Map<string, { income: number; expense: number; discretionary: number }>();

  for (const e of cashflows) {
    const m = e.date.slice(0, 7);
    if (!monthMap.has(m)) monthMap.set(m, { income: 0, expense: 0, discretionary: 0 });
    const bucket = monthMap.get(m)!;
    if (e.type === 'income') bucket.income += e.amount;
    else {
      bucket.expense += e.amount;
      if (!ESSENTIAL_CATS.has(e.category)) bucket.discretionary += e.amount;
    }
  }

  const sorted = [...monthMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const recent = sorted.slice(-6); // last 6 months

  const months: MonthlySnapshot[] = recent.map(([month, d]) => ({
    month,
    income: d.income,
    expense: d.expense,
    savings: d.income - d.expense,
    savingsRate: d.income > 0 ? ((d.income - d.expense) / d.income) * 100 : 0,
  }));

  if (months.length < 3) {
    return {
      months, incomeGrowthPct: 0, expenseGrowthPct: 0,
      creepDetected: false, creepGapPct: 0, discretionaryGrowthPct: 0,
      verdict: 'healthy', message: 'Not enough data yet (need 3+ months).',
    };
  }

  const first = months[0];
  const last  = months[months.length - 1];

  const incomeGrowth      = first.income > 0 ? ((last.income - first.income) / first.income) * 100 : 0;
  const expenseGrowth     = first.expense > 0 ? ((last.expense - first.expense) / first.expense) * 100 : 0;
  const firstDiscr        = recent[0][1].discretionary;
  const lastDiscr         = recent[recent.length - 1][1].discretionary;
  const discretionaryGrowth = firstDiscr > 0 ? ((lastDiscr - firstDiscr) / firstDiscr) * 100 : 0;

  const creepGap     = expenseGrowth - incomeGrowth;
  const creepDetect  = creepGap > 10; // expenses growing 10%+ faster

  const verdict: LifestyleInflationResult['verdict'] =
    creepGap > 20 ? 'creep' : creepGap > 10 ? 'watch' : 'healthy';

  const message =
    verdict === 'creep'
      ? `Lifestyle creep detected. Expenses grew ${Math.round(expenseGrowth)}% while income grew ${Math.round(incomeGrowth)}% — a ${Math.round(creepGap)}% gap.`
      : verdict === 'watch'
      ? `Watch your spending. Expenses growing slightly faster than income (${Math.round(creepGap)}% gap).`
      : `Healthy pattern. Income growing ${Math.round(incomeGrowth)}% vs expenses ${Math.round(expenseGrowth)}%.`;

  return {
    months, incomeGrowthPct: incomeGrowth, expenseGrowthPct: expenseGrowth,
    creepDetected: creepDetect, creepGapPct: creepGap,
    discretionaryGrowthPct: discretionaryGrowth, verdict, message,
  };
}
