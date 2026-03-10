import type { Investment, Liability, CashflowEntry } from '../../src/types/investmentTypes';
import { summarizePortfolio } from './calculations';

export function calculateFinancialHealthScore(
  investments: Investment[],
  liabilities: Liability[],
  cashflows: CashflowEntry[]
) {
  const summary = summarizePortfolio(investments);
  const totalAssets = summary.totalValue;
  const totalLiabilities = liabilities.reduce((acc, l) => acc + (l.outstanding || 0), 0);
  
  // 1. Debt Score (30 pts)
  const debtRatio = totalAssets > 0 ? totalLiabilities / totalAssets : 0;
  const debtScore = Math.max(0, 30 - (debtRatio * 60));

  // 2. Emergency Fund Score (20 pts)
  const avgExpense = calculateMonthlyAvg(cashflows, 'expense');
  const liquidAssets = investments
    .filter(i => i.type === 'fixed_deposit' || i.type === 'other')
    .reduce((acc, i) => acc + (i.investedAmount || 0), 0);
  const runway = avgExpense > 0 ? liquidAssets / avgExpense : 0;
  const emergencyScore = Math.min(20, (runway / 6) * 20);

  // 3. Savings Rate Score (25 pts)
  const income = calculateMonthlyAvg(cashflows, 'income');
  const savingsRate = income > 0 ? ((income - avgExpense) / income) * 100 : 0;
  const savingsScore = Math.min(25, (savingsRate / 30) * 25);

  // 4. Diversification Score (25 pts)
  const assetTypes = new Set(investments.map(i => i.type)).size;
  const divScore = Math.min(25, (assetTypes / 5) * 25);

  return {
    total: Math.round(debtScore + emergencyScore + savingsScore + divScore),
    breakdown: { debtRatio, runway, savingsRate, assetTypes }
  };
}

function calculateMonthlyAvg(entries: CashflowEntry[], type: 'income' | 'expense') {
  const filtered = entries.filter(e => e.type === type);
  if (filtered.length === 0) return 0;
  const total = filtered.reduce((acc, e) => acc + e.amount, 0);
  // Simple avg based on unique months present
  const months = new Set(filtered.map(e => e.date.substring(0, 7))).size || 1;
  return total / months;
}

export function getFIREProjection(netWorth: number, monthlySavings: number, expectedReturn = 10) {
  const annualExpense = 50000 * 12; // Example threshold
  const target = annualExpense * 25; // 4% Rule
  const monthlyRate = expectedReturn / 12 / 100;
  
  // Simple compound interest iteration to find months to target
  let current = netWorth;
  let months = 0;
  while (current < target && months < 600) { // cap at 50 years
    current = (current + monthlySavings) * (1 + monthlyRate);
    months++;
  }
  return { target, yearsToFIRE: Math.round(months / 12) };
}