// src/services/financialMetricsEngine.ts

export interface CategorySummary {
  category: string;
  amount: number;
  percentage: number;
}

export interface MonthlyTrend {
  month: string; // YYYY-MM
  income: number;
  expense: number;
  net: number;
}

export function calculateTotalIncome(entries: Array<{ type: string; amount: number }>): number {
  return entries
    .filter((e) => e.type === 'income')
    .reduce((sum, e) => sum + (e.amount || 0), 0);
}

export function calculateTotalExpenses(entries: Array<{ type: string; amount: number }>): number {
  return entries
    .filter((e) => e.type === 'expense')
    .reduce((sum, e) => sum + (e.amount || 0), 0);
}

export function calculateNetCashFlow(entries: Array<{ type: string; amount: number }>): number {
  return calculateTotalIncome(entries) - calculateTotalExpenses(entries);
}

export function calculateCategoryBreakdown(
  entries: Array<{ type: string; amount: number; category: string }>,
  type: 'income' | 'expense' = 'expense',
): CategorySummary[] {
  const filtered = entries.filter((e) => e.type === type);
  const total = filtered.reduce((sum, e) => sum + e.amount, 0);
  const byCategory = new Map<string, number>();

  for (const entry of filtered) {
    const cat = (entry.category || 'Uncategorized').trim();
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + entry.amount);
  }

  return Array.from(byCategory.entries())
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: total > 0 ? (amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export function calculateMonthlyTrend(entries: Array<{ date: string; type: string; amount: number }>): MonthlyTrend[] {
  const map = new Map<string, { income: number; expense: number }>();

  for (const e of entries) {
    const month = e.date.slice(0, 7); // YYYY-MM
    if (!map.has(month)) {
      map.set(month, { income: 0, expense: 0 });
    }
    const current = map.get(month)!;
    if (e.type === 'income') {
      current.income += e.amount;
    } else if (e.type === 'expense') {
      current.expense += e.amount;
    }
  }

  return Array.from(map.entries())
    .map(([month, data]) => ({
      month,
      income: data.income,
      expense: data.expense,
      net: data.income - data.expense,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export function calculateSavingsRate(income: number, expense: number): number {
  if (income <= 0) return 0;
  const savings = income - expense;
  return (savings / income) * 100;
}

export function calculateDebtRatio(totalLiabilities: number, totalAssets: number): number {
  if (totalAssets <= 0) return totalLiabilities > 0 ? 100 : 0;
  return (totalLiabilities / totalAssets) * 100;
}

export function calculateCashRunway(liquidCash: number, monthlyExpense: number): number {
  if (monthlyExpense <= 0) return liquidCash > 0 ? 999 : 0;
  return liquidCash / monthlyExpense;
}

export function calculateNetWorth(totalAssets: number, totalLiabilities: number) {
  return {
    totalAssets,
    totalLiabilities,
    netWorth: totalAssets - totalLiabilities,
  };
}
