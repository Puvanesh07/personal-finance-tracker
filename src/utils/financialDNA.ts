/**
 * src/utils/financialDNA.ts
 * Financial DNA — Tier 3.
 * Analyses 5 behavioural dimensions from historical store data:
 *   1. Spending Pattern (impulsive → disciplined)
 *   2. Saving Behaviour (none → aggressive saver)
 *   3. Investment Behaviour (passive → active)
 *   4. Debt Behaviour (debt-averse → debt-reliant)
 *   5. Risk Profile (conservative → aggressive)
 */
import type { CashflowEntry, Investment, Liability } from '../types/investmentTypes';
import { investedValue, currentValue } from '../utils/calculations';

export type DNALabel =
  | 'Impulse Spender' | 'Balanced Spender' | 'Mindful Spender' | 'Frugal Saver'
  | 'Non-Saver' | 'Casual Saver' | 'Consistent Saver' | 'Aggressive Saver'
  | 'Passive Investor' | 'Occasional Investor' | 'Active Investor' | 'Wealth Builder'
  | 'Debt-Free' | 'Controlled Debt' | 'High-Debt' | 'Debt-Dependent'
  | 'Conservative' | 'Moderate' | 'Growth-Oriented' | 'Aggressive';

export interface DNADimension {
  key: string;
  label: string;
  emoji: string;
  score: number;        // 0–100
  verdict: DNALabel;
  description: string;
  tip: string;
  color: string;        // Tailwind color token
}

export interface FinancialDNAResult {
  dimensions: DNADimension[];
  overallProfile: string;
  overallEmoji: string;
  strengths: string[];
  improvements: string[];
  archetype: string;    // e.g. "The Disciplined Saver", "The Risk-Taker"
}

function clamp(n: number, min = 0, max = 100) { return Math.min(max, Math.max(min, n)); }

export function computeFinancialDNA(
  cashflows: CashflowEntry[],
  investments: Investment[],
  liabilities: Liability[],
  essentials: { emergencyFundCurrent?: number; emergencyFundTarget?: number },
): FinancialDNAResult {

  const incEntries = cashflows.filter(e => e.type === 'income');
  const expEntries = cashflows.filter(e => e.type === 'expense');
  const months     = new Set([...incEntries, ...expEntries].map(e => e.date.slice(0, 7))).size || 1;
  const avgInc     = incEntries.reduce((a, e) => a + e.amount, 0) / months;
  const avgExp     = expEntries.reduce((a, e) => a + e.amount, 0) / months;
  const savingsRate = avgInc > 0 ? ((avgInc - avgExp) / avgInc) * 100 : 0;

  // ── 1. Spending Pattern ──────────────────────────────────────────────────
  // Score: higher = more disciplined. Factors: savings rate, consistency, category diversity
  const catSet = new Set(expEntries.map(e => e.category)).size;
  const impulseCats = ['Shopping', 'Entertainment', 'Dining', 'Food & Dining', 'Subscriptions'];
  const impulseSpend = expEntries
    .filter(e => impulseCats.includes(e.category))
    .reduce((a, e) => a + e.amount, 0);
  const impulsePct = avgExp > 0 ? (impulseSpend / (avgExp * months)) * 100 : 0;
  const spendingScore = clamp(100 - impulsePct * 0.8 + savingsRate * 0.4);

  const spendingVerdict: DNALabel =
    spendingScore >= 75 ? 'Mindful Spender'
    : spendingScore >= 50 ? 'Balanced Spender'
    : spendingScore >= 25 ? 'Impulse Spender'
    : 'Impulse Spender';

  void catSet;

  // ── 2. Saving Behaviour ──────────────────────────────────────────────────
  const efPct = (essentials.emergencyFundTarget ?? 0) > 0
    ? ((essentials.emergencyFundCurrent ?? 0) / (essentials.emergencyFundTarget ?? 1)) * 100
    : 0;
  const savingScore = clamp(savingsRate * 1.5 + efPct * 0.3);

  const savingVerdict: DNALabel =
    savingScore >= 75 ? 'Aggressive Saver'
    : savingScore >= 50 ? 'Consistent Saver'
    : savingScore >= 25 ? 'Casual Saver'
    : 'Non-Saver';

  // ── 3. Investment Behaviour ──────────────────────────────────────────────
  const invMonths    = new Set(investments.map(i => i.createdAt.slice(0, 7))).size;
  const totalInvested = investments.reduce((a, i) => a + investedValue(i), 0);
  const totalCurrent  = investments.reduce((a, i) => a + currentValue(i), 0);
  const invGrowthPct  = totalInvested > 0 ? ((totalCurrent - totalInvested) / totalInvested) * 100 : 0;
  const invTypes      = new Set(investments.map(i => i.type)).size;
  const invScore      = clamp(
    invMonths * 4 +
    (totalInvested > 0 ? Math.min(40, Math.log10(totalInvested) * 10) : 0) +
    invTypes * 5 +
    Math.min(20, invGrowthPct * 0.5),
  );

  const invVerdict: DNALabel =
    invScore >= 75 ? 'Wealth Builder'
    : invScore >= 50 ? 'Active Investor'
    : invScore >= 25 ? 'Occasional Investor'
    : 'Passive Investor';

  // ── 4. Debt Behaviour ────────────────────────────────────────────────────
  const activeLiab = liabilities.filter(l => !l.status || l.status === 'active');
  const totalDebt  = activeLiab.reduce((a, l) => a + (l.outstanding ?? 0), 0);
  const avgIncome12 = avgInc * 12;
  const debtToInc  = avgIncome12 > 0 ? (totalDebt / avgIncome12) * 100 : 0;
  const debtScore  = clamp(100 - debtToInc * 0.6);

  const debtVerdict: DNALabel =
    debtScore >= 80 ? 'Debt-Free'
    : debtScore >= 55 ? 'Controlled Debt'
    : debtScore >= 30 ? 'High-Debt'
    : 'Debt-Dependent';

  // ── 5. Risk Profile ──────────────────────────────────────────────────────
  const equityInv  = investments.filter(i => i.type === 'stock' || i.type === 'mutual_fund');
  const equityVal  = equityInv.reduce((a, i) => a + currentValue(i), 0);
  const equityPct  = totalCurrent > 0 ? (equityVal / totalCurrent) * 100 : 0;
  const riskScore  = clamp(equityPct * 0.8 + invTypes * 5);

  const riskVerdict: DNALabel =
    riskScore >= 70 ? 'Aggressive'
    : riskScore >= 45 ? 'Growth-Oriented'
    : riskScore >= 20 ? 'Moderate'
    : 'Conservative';

  // ── Assemble dimensions ──────────────────────────────────────────────────
  const dimensions: DNADimension[] = [
    {
      key: 'spending', label: 'Spending Pattern', emoji: '💸',
      score: spendingScore, verdict: spendingVerdict,
      description: spendingVerdict === 'Mindful Spender'
        ? 'You spend intentionally and avoid impulse purchases.'
        : spendingVerdict === 'Balanced Spender'
        ? 'Good balance between needs and wants. Minor impulse tendencies.'
        : 'Impulse spending is reducing your savings potential.',
      tip: spendingScore < 50
        ? 'Try a 24-hour rule before non-essential purchases.'
        : 'Keep tracking spending to maintain discipline.',
      color: spendingScore >= 70 ? 'emerald' : spendingScore >= 40 ? 'amber' : 'rose',
    },
    {
      key: 'saving', label: 'Saving Behaviour', emoji: '💰',
      score: savingScore, verdict: savingVerdict,
      description: savingScore >= 75
        ? `Excellent! You save ${Math.round(savingsRate)}% of income.`
        : savingScore >= 50
        ? `You save ${Math.round(savingsRate)}% of income — room to grow.`
        : `Savings rate is only ${Math.round(savingsRate)}%. Aim for 20%+.`,
      tip: savingsRate < 20
        ? 'Set up auto-transfer to savings on payday.'
        : 'Consider increasing investments with surplus savings.',
      color: savingScore >= 70 ? 'emerald' : savingScore >= 40 ? 'amber' : 'rose',
    },
    {
      key: 'investment', label: 'Investment Behaviour', emoji: '📈',
      score: invScore, verdict: invVerdict,
      description: invVerdict === 'Wealth Builder'
        ? 'You invest regularly across multiple asset classes.'
        : invVerdict === 'Active Investor'
        ? 'Good investment activity. Diversify further for better returns.'
        : invVerdict === 'Occasional Investor'
        ? 'Investing sporadically. Consistency is key to wealth building.'
        : 'No significant investment activity detected.',
      tip: invScore < 50
        ? 'Start a monthly SIP — even ₹500/month compounds significantly.'
        : 'Review portfolio allocation annually for rebalancing.',
      color: invScore >= 70 ? 'indigo' : invScore >= 40 ? 'amber' : 'slate',
    },
    {
      key: 'debt', label: 'Debt Behaviour', emoji: '🏦',
      score: debtScore, verdict: debtVerdict,
      description: debtVerdict === 'Debt-Free'
        ? 'Excellent! Minimal debt relative to income.'
        : debtVerdict === 'Controlled Debt'
        ? 'Manageable debt levels. Stay on top of EMI payments.'
        : `Debt-to-income ratio is elevated (${Math.round(debtToInc)}%).`,
      tip: debtScore < 50
        ? 'Follow the avalanche method: pay highest-interest debt first.'
        : 'Avoid new debt unless absolutely necessary.',
      color: debtScore >= 70 ? 'emerald' : debtScore >= 40 ? 'amber' : 'rose',
    },
    {
      key: 'risk', label: 'Risk Profile', emoji: '⚡',
      score: riskScore, verdict: riskVerdict,
      description: riskVerdict === 'Aggressive'
        ? `${Math.round(equityPct)}% in equity — high growth potential, high risk.`
        : riskVerdict === 'Growth-Oriented'
        ? `Balanced equity exposure (${Math.round(equityPct)}%) — good for long-term goals.`
        : riskVerdict === 'Moderate'
        ? 'Low equity exposure. Consider increasing for better long-term returns.'
        : 'Very conservative portfolio. Inflation may erode real returns.',
      tip: riskScore < 30
        ? 'Consider adding index funds for inflation-beating returns.'
        : riskScore > 80
        ? 'Diversify into bonds or FDs to reduce volatility.'
        : 'Your risk profile looks balanced for your situation.',
      color: riskScore >= 70 ? 'violet' : riskScore >= 40 ? 'sky' : 'slate',
    },
  ];

  // ── Archetype ─────────────────────────────────────────────────────────────
  const avgScore = dimensions.reduce((a, d) => a + d.score, 0) / dimensions.length;
  const archetype =
    savingScore >= 70 && invScore >= 70 ? 'The Wealth Builder'
    : spendingScore >= 70 && debtScore >= 70 ? 'The Disciplined Saver'
    : riskScore >= 70 ? 'The Risk-Taker'
    : debtScore >= 70 && savingScore >= 50 ? 'The Debt-Free Achiever'
    : invScore >= 60 ? 'The Steady Investor'
    : avgScore >= 60 ? 'The Balanced Planner'
    : 'The Financial Beginner';

  const overallProfile = avgScore >= 75 ? 'Excellent' : avgScore >= 55 ? 'Good' : avgScore >= 35 ? 'Average' : 'Needs Work';

  const strengths    = dimensions.filter(d => d.score >= 65).map(d => d.label);
  const improvements = dimensions.filter(d => d.score < 45).map(d => d.label);

  return {
    dimensions,
    overallProfile,
    overallEmoji: avgScore >= 75 ? '🏆' : avgScore >= 55 ? '💪' : avgScore >= 35 ? '📈' : '🔧',
    strengths,
    improvements,
    archetype,
  };
}
