/**
 * src/utils/aiFinancialPlan.ts — AI Financial Plan Generator (Tier 3).
 * Generates a structured monthly plan from real store data.
 * No AI calls needed — pure math allocation based on actual numbers.
 */
import type { CashflowEntry, Investment, Liability, Goal, GoalContribution } from '../types/investmentTypes';

export interface PlanLineItem {
  label: string;
  emoji: string;
  amount: number;
  pct: number;           // % of income
  priority: number;      // 1 = highest
  category: 'essential' | 'investment' | 'goal' | 'emergency' | 'debt' | 'flexible';
  note?: string;
}

export interface MonthlyFinancialPlan {
  month: string;         // e.g. "September 2026"
  totalIncome: number;
  totalAllocated: number;
  surplus: number;
  status: '🟢 Healthy' | '🟡 Tight' | '🔴 Deficit';
  items: PlanLineItem[];
  topRecommendation: string;
  savingsRate: number;
}

export function generateMonthlyPlan(
  cashflows: CashflowEntry[],
  investments: Investment[],
  liabilities: Liability[],
  goals: Goal[],
  goalContributions: GoalContribution[],
  essentials: { emergencyFundCurrent?: number; emergencyFundTarget?: number },
  accounts: { balance: number }[],
): MonthlyFinancialPlan {

  const now   = new Date();
  const month = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  // ── Derive base numbers ───────────────────────────────────────────────────
  const incEntries = cashflows.filter(e => e.type === 'income');
  const expEntries = cashflows.filter(e => e.type === 'expense');
  const incMonths  = new Set(incEntries.map(e => e.date.slice(0, 7))).size || 1;
  const expMonths  = new Set(expEntries.map(e => e.date.slice(0, 7))).size || 1;
  const avgInc     = incEntries.reduce((a, e) => a + e.amount, 0) / incMonths;
  const avgExp     = expEntries.reduce((a, e) => a + e.amount, 0) / expMonths;

  // Category breakdown of expenses
  const catMap: Record<string, number> = {};
  for (const e of expEntries) {
    catMap[e.category] = (catMap[e.category] ?? 0) + e.amount / expMonths;
  }

  const essentialCats = new Set(['Housing & Rent', 'Rent', 'Groceries', 'Healthcare', 'Utilities', 'EMI & Loans', 'Insurance', 'Education', 'Transport', 'Petrol']);
  void investments;
  const essentialSpend = Object.entries(catMap)
    .filter(([k]) => essentialCats.has(k))
    .reduce((a, [, v]) => a + v, 0);
  const discretionarySpend = avgExp - essentialSpend;

  // ── EMI obligations ───────────────────────────────────────────────────────
  const activeLiab = liabilities.filter(l => !l.status || l.status === 'active');
  const totalEMI   = activeLiab.reduce((a, l) => a + (l.emiAmount ?? 0), 0);
  const highIntDebt = [...activeLiab].sort((a, b) => (b.interestRate ?? 0) - (a.interestRate ?? 0))[0];

  // ── Emergency fund gap ────────────────────────────────────────────────────
  const efCurrent = essentials.emergencyFundCurrent ?? 0;
  const efTarget  = essentials.emergencyFundTarget  ?? (avgExp * 6);
  const efGap     = Math.max(0, efTarget - efCurrent);
  const efMonthly = efGap > 0 ? Math.min(avgInc * 0.1, efGap) : 0;

  // ── Goal contributions ────────────────────────────────────────────────────
  const activeGoals = goals.filter(g => !g.status || g.status === 'active');
  const totalGoalNeed = activeGoals.reduce((a, g) => {
    const contrib = goalContributions.filter(c => c.goalId === g.id).reduce((s, c) => s + c.amount, 0);
    const saved   = g.currentAmount + contrib;
    const remaining = Math.max(0, g.targetAmount - saved);
    if (!g.dueDate || remaining <= 0) return a;
    const months = Math.max(1,
      (new Date(g.dueDate).getFullYear() - now.getFullYear()) * 12 +
      (new Date(g.dueDate).getMonth() - now.getMonth()),
    );
    return a + remaining / months;
  }, 0);
  const goalMonthly = Math.min(avgInc * 0.15, totalGoalNeed);

  // ── Investment allocation ─────────────────────────────────────────────────
  const surplus       = avgInc - essentialSpend - totalEMI - efMonthly - goalMonthly;
  const investMonthly = Math.max(0, surplus * 0.5);
  const flexible      = Math.max(0, surplus - investMonthly);

  // ── Build plan items ──────────────────────────────────────────────────────
  const items: PlanLineItem[] = [];

  const add = (
    label: string, emoji: string, amount: number,
    category: PlanLineItem['category'], priority: number, note?: string,
  ) => {
    if (amount <= 0) return;
    items.push({ label, emoji, amount: Math.round(amount), pct: avgInc > 0 ? (amount / avgInc) * 100 : 0, priority, category, note });
  };

  add('Essential Expenses', '🏠', essentialSpend, 'essential', 1, 'Rent, food, utilities, transport');
  if (totalEMI > 0) add('EMI / Debt Payments', '🏦', totalEMI, 'debt', 2, `${activeLiab.length} active loan${activeLiab.length > 1 ? 's' : ''}`);
  if (efMonthly > 0) add('Emergency Fund', '🛡️', efMonthly, 'emergency', 3, `Build to ${Math.round((efCurrent / efTarget) * 100)}% target`);
  if (goalMonthly > 0) add('Goal Contributions', '🎯', goalMonthly, 'goal', 4, activeGoals.slice(0, 2).map(g => g.name).join(', '));
  if (investMonthly > 0) add('Investments / SIP', '📈', investMonthly, 'investment', 5, '50% of monthly surplus');
  if (flexible > 0) add('Flexible / Discretionary', '☕', flexible, 'flexible', 6, 'Dining, entertainment, lifestyle');
  if (discretionarySpend > flexible) {
    add('Reduce Discretionary', '✂️', 0, 'flexible', 7, `Currently spending ${Math.round(discretionarySpend).toLocaleString('en-IN')}/mo — consider trimming`);
  }

  const totalAllocated = items.filter(i => i.category !== 'flexible' || i.amount > 0).reduce((a, i) => a + i.amount, 0);
  const planSurplus    = avgInc - totalAllocated;
  const savingsRate    = avgInc > 0 ? ((avgInc - essentialSpend - totalEMI) / avgInc) * 100 : 0;

  const status: MonthlyFinancialPlan['status'] =
    planSurplus >= 0 && savingsRate >= 20 ? '🟢 Healthy'
    : planSurplus >= 0 ? '🟡 Tight'
    : '🔴 Deficit';

  // ── Top recommendation ────────────────────────────────────────────────────
  const rec =
    efGap > 0 && efCurrent < avgExp * 3
      ? `Build emergency fund first — you're at ${Math.round((efCurrent / efTarget) * 100)}% of target.`
      : highIntDebt && (highIntDebt.interestRate ?? 0) > 12
      ? `Prioritise paying off "${highIntDebt.name}" (${highIntDebt.interestRate}% interest) — it costs more than most investments return.`
      : investMonthly > 0
      ? `Invest ₹${Math.round(investMonthly).toLocaleString('en-IN')}/mo in index funds or SIPs for long-term wealth building.`
      : 'Track expenses consistently — awareness is the first step to financial control.';

  void accounts;

  return {
    month, totalIncome: Math.round(avgInc), totalAllocated,
    surplus: Math.round(planSurplus), status, items,
    topRecommendation: rec, savingsRate,
  };
}
