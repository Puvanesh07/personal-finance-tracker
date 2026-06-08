import type {
  CashflowEntry,
  EssentialsConfig,
  Goal,
  Investment,
  Liability,
} from '../types/investmentTypes';
import { calculateNetWorth, summarizePortfolio } from './calculations';

export type PortfolioAIContext = {
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  equityPct: number;
  monthlyIncome: number;
  monthlyExpense: number;
  monthlySurplus: number;
  emergencyTarget: number;
  emergencyCurrent: number;
  goalsActive: number;
  goalsCompleted: number;
  healthScore: number;
};

function monthlyAvg(entries: CashflowEntry[], t: 'income' | 'expense') {
  const rows = entries.filter((e) => e.type === t);
  if (!rows.length) return 0;
  const total = rows.reduce((a, r) => a + r.amount, 0);
  const months = new Set(rows.map((r) => r.date.slice(0, 7))).size || 1;
  return total / months;
}

export function buildPortfolioAIContext(args: {
  investments: Investment[];
  liabilities: Liability[];
  cashflows: CashflowEntry[];
  essentials: EssentialsConfig;
  goals: Goal[];
}): PortfolioAIContext | null {
  const { investments, liabilities, cashflows, essentials, goals } = args;
  if (
    investments.length === 0 &&
    liabilities.length === 0 &&
    cashflows.length === 0 &&
    goals.length === 0 &&
    !(essentials.emergencyFundCurrent || essentials.emergencyFundTarget)
  ) {
    return null;
  }
  const { totalAssets, totalLiabilities, netWorth } = calculateNetWorth(
    investments,
    liabilities,
  );
  const s = summarizePortfolio(investments);
  const equity = s.byType.stock.current + s.byType.mutual_fund.current;
  const equityPct = totalAssets > 0 ? (equity / totalAssets) * 100 : 0;
  const income = monthlyAvg(cashflows, 'income');
  const expense = monthlyAvg(cashflows, 'expense');
  const surplus = income - expense;
  const debtRatio = totalAssets > 0 ? totalLiabilities / totalAssets : 0;
  const emergencyCurrent = essentials.emergencyFundCurrent ?? 0;
  const emergencyTarget = essentials.emergencyFundTarget ?? 0;
  const emergencyScore =
    emergencyTarget > 0
      ? Math.min(20, (emergencyCurrent / emergencyTarget) * 20)
      : emergencyCurrent > 0
        ? 5
        : 0;
  const healthScore = Math.round(
    Math.max(0, 30 - debtRatio * 60) +
      emergencyScore +
      Math.min(25, Math.max(0, income > 0 ? (surplus / income) * 100 : 0)) +
      Math.min(25, equityPct > 0 && equityPct < 85 ? 22 : 10),
  );
  return {
    netWorth,
    totalAssets,
    totalLiabilities,
    equityPct,
    monthlyIncome: income,
    monthlyExpense: expense,
    monthlySurplus: surplus,
    emergencyTarget,
    emergencyCurrent,
    goalsActive: goals.filter((g) => !g.status || g.status === 'active').length,
    goalsCompleted: goals.filter((g) => g.status === 'completed' || g.status === 'success').length,
    healthScore,
  };
}

