/**
 * src/utils/milestones.ts — Money Milestones (Tier 3).
 * Detects achieved and in-progress financial milestones from store data.
 */
import type { Investment, Liability, CashflowEntry } from '../types/investmentTypes';
import { calculateNetWorth, investedValue } from '../utils/calculations';

export interface Milestone {
  id: string;
  emoji: string;
  title: string;
  description: string;
  unlocked: boolean;
  unlockedDate?: string;
  progress: number;       // 0–100
  progressLabel: string;
  category: 'investment' | 'networth' | 'savings' | 'debt' | 'cashflow' | 'goal';
  reward: string;         // fun descriptor
}

function fmt(n: number) { return '₹' + Math.round(Math.abs(n)).toLocaleString('en-IN'); }
function clamp(n: number) { return Math.min(100, Math.max(0, n)); }

export function computeMilestones(
  investments: Investment[],
  liabilities: Liability[],
  cashflows: CashflowEntry[],
  essentials: { emergencyFundCurrent?: number; emergencyFundTarget?: number },
  accounts: { balance: number }[],
): Milestone[] {

  const { netWorth, totalAssets } = calculateNetWorth(investments, liabilities);
  const totalInvested = investments.reduce((a, i) => a + investedValue(i), 0);
  const activeLiab    = liabilities.filter(l => !l.status || l.status === 'active');
  const totalDebt     = activeLiab.reduce((a, l) => a + (l.outstanding ?? 0), 0);
  const bankBalance   = accounts.reduce((a, ac) => a + (ac.balance ?? 0), 0);
  const efCurrent     = essentials.emergencyFundCurrent ?? 0;
  const expEntries    = cashflows.filter(e => e.type === 'expense');
  const avgMonthlyExp = expEntries.length
    ? expEntries.reduce((a, e) => a + e.amount, 0) / (new Set(expEntries.map(e => e.date.slice(0, 7))).size || 1)
    : 0;

  const milestones: Milestone[] = [

    // ── Investment milestones ────────────────────────────────────────────
    {
      id: 'first_investment',
      emoji: '🌱', category: 'investment',
      title: 'First Investment', reward: 'The Seed Planter',
      description: 'Make your first investment in any asset.',
      unlocked: investments.length > 0,
      progress: clamp(investments.length * 100),
      progressLabel: investments.length > 0 ? 'Unlocked!' : '0 investments',
    },
    {
      id: 'invest_1l',
      emoji: '💸', category: 'investment',
      title: '₹1 Lakh Invested', reward: 'The Six-Figure Investor',
      description: 'Total invested amount crosses ₹1,00,000.',
      unlocked: totalInvested >= 100_000,
      progress: clamp((totalInvested / 100_000) * 100),
      progressLabel: `${fmt(totalInvested)} / ${fmt(100_000)}`,
    },
    {
      id: 'invest_5l',
      emoji: '📈', category: 'investment',
      title: '₹5 Lakh Invested', reward: 'The Committed Investor',
      description: 'Total invested amount crosses ₹5,00,000.',
      unlocked: totalInvested >= 500_000,
      progress: clamp((totalInvested / 500_000) * 100),
      progressLabel: `${fmt(totalInvested)} / ${fmt(500_000)}`,
    },
    {
      id: 'invest_25l',
      emoji: '🚀', category: 'investment',
      title: '₹25 Lakh Invested', reward: 'The Wealth Builder',
      description: 'Total invested amount crosses ₹25,00,000.',
      unlocked: totalInvested >= 2_500_000,
      progress: clamp((totalInvested / 2_500_000) * 100),
      progressLabel: `${fmt(totalInvested)} / ${fmt(2_500_000)}`,
    },
    {
      id: 'invest_1cr',
      emoji: '👑', category: 'investment',
      title: '₹1 Crore Invested', reward: 'The Crorepati',
      description: 'Total invested amount crosses ₹1,00,00,000.',
      unlocked: totalInvested >= 10_000_000,
      progress: clamp((totalInvested / 10_000_000) * 100),
      progressLabel: `${fmt(totalInvested)} / ${fmt(10_000_000)}`,
    },

    // ── Net worth milestones ─────────────────────────────────────────────
    {
      id: 'networth_1l',
      emoji: '🏦', category: 'networth',
      title: '₹1 Lakh Net Worth', reward: 'The First Lakh',
      description: 'Net worth crosses ₹1,00,000.',
      unlocked: netWorth >= 100_000,
      progress: clamp((netWorth / 100_000) * 100),
      progressLabel: `${fmt(netWorth)} / ${fmt(100_000)}`,
    },
    {
      id: 'networth_5l',
      emoji: '💰', category: 'networth',
      title: '₹5 Lakh Net Worth', reward: 'The Five-Lakh Club',
      description: 'Net worth crosses ₹5,00,000.',
      unlocked: netWorth >= 500_000,
      progress: clamp((netWorth / 500_000) * 100),
      progressLabel: `${fmt(netWorth)} / ${fmt(500_000)}`,
    },
    {
      id: 'networth_25l',
      emoji: '🏆', category: 'networth',
      title: '₹25 Lakh Net Worth', reward: 'The Millionaire Milestone',
      description: 'Net worth crosses ₹25,00,000.',
      unlocked: netWorth >= 2_500_000,
      progress: clamp((netWorth / 2_500_000) * 100),
      progressLabel: `${fmt(netWorth)} / ${fmt(2_500_000)}`,
    },
    {
      id: 'networth_1cr',
      emoji: '💎', category: 'networth',
      title: '₹1 Crore Net Worth', reward: 'The Crorepati',
      description: 'Net worth crosses ₹1,00,00,000.',
      unlocked: netWorth >= 10_000_000,
      progress: clamp((netWorth / 10_000_000) * 100),
      progressLabel: `${fmt(netWorth)} / ${fmt(10_000_000)}`,
    },

    // ── Emergency fund ───────────────────────────────────────────────────
    {
      id: 'ef_3months',
      emoji: '🛡️', category: 'savings',
      title: '3-Month Emergency Fund', reward: 'The Safety Net',
      description: 'Emergency fund covers 3 months of expenses.',
      unlocked: avgMonthlyExp > 0 ? efCurrent >= avgMonthlyExp * 3 : efCurrent > 0,
      progress: avgMonthlyExp > 0 ? clamp((efCurrent / (avgMonthlyExp * 3)) * 100) : 0,
      progressLabel: avgMonthlyExp > 0 ? `${fmt(efCurrent)} / ${fmt(avgMonthlyExp * 3)}` : `${fmt(efCurrent)} saved`,
    },
    {
      id: 'ef_6months',
      emoji: '🔐', category: 'savings',
      title: '6-Month Emergency Fund', reward: 'The Fortress Builder',
      description: 'Emergency fund covers 6 months of expenses.',
      unlocked: avgMonthlyExp > 0 ? efCurrent >= avgMonthlyExp * 6 : false,
      progress: avgMonthlyExp > 0 ? clamp((efCurrent / (avgMonthlyExp * 6)) * 100) : 0,
      progressLabel: avgMonthlyExp > 0 ? `${fmt(efCurrent)} / ${fmt(avgMonthlyExp * 6)}` : '—',
    },

    // ── Debt milestones ──────────────────────────────────────────────────
    {
      id: 'debt_free',
      emoji: '🎉', category: 'debt',
      title: 'Debt-Free!', reward: 'The Liberator',
      description: 'All active liabilities fully paid off.',
      unlocked: activeLiab.length === 0 && liabilities.length > 0,
      progress: liabilities.length > 0 && totalDebt === 0 ? 100 : 0,
      progressLabel: activeLiab.length === 0 ? 'No active debts ✓' : `${activeLiab.length} active liabilities`,
    },
    {
      id: 'first_loan_repaid',
      emoji: '✅', category: 'debt',
      title: 'First Loan Repaid', reward: 'The Finisher',
      description: 'Fully repay any one liability.',
      unlocked: liabilities.some(l => l.status === 'paid' || l.status === 'returned'),
      progress: liabilities.some(l => l.status === 'paid' || l.status === 'returned') ? 100 : 0,
      progressLabel: liabilities.some(l => l.status === 'paid') ? 'Unlocked!' : 'Repay any one loan',
    },

    // ── Cashflow milestones ──────────────────────────────────────────────
    {
      id: 'first_income',
      emoji: '💼', category: 'cashflow',
      title: 'First Income Recorded', reward: 'The Earner',
      description: 'Log your first income entry.',
      unlocked: cashflows.some(e => e.type === 'income'),
      progress: cashflows.some(e => e.type === 'income') ? 100 : 0,
      progressLabel: cashflows.some(e => e.type === 'income') ? 'Unlocked!' : 'Add an income entry',
    },
    {
      id: 'positive_cashflow',
      emoji: '📊', category: 'cashflow',
      title: '3 Months Positive Cashflow', reward: 'The Surplus Master',
      description: 'Income > Expenses for 3 consecutive months.',
      unlocked: (() => {
        const monthMap = new Map<string, { inc: number; exp: number }>();
        for (const e of cashflows) {
          const m = e.date.slice(0, 7);
          if (!monthMap.has(m)) monthMap.set(m, { inc: 0, exp: 0 });
          const b = monthMap.get(m)!;
          if (e.type === 'income') b.inc += e.amount; else b.exp += e.amount;
        }
        const sorted = [...monthMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
        let streak = 0;
        for (let i = sorted.length - 1; i >= 0; i--) {
          const [, d] = sorted[i];
          if (d.inc > d.exp) streak++;
          else break;
        }
        return streak >= 3;
      })(),
      progress: (() => {
        const monthMap = new Map<string, { inc: number; exp: number }>();
        for (const e of cashflows) {
          const m = e.date.slice(0, 7);
          if (!monthMap.has(m)) monthMap.set(m, { inc: 0, exp: 0 });
          const b = monthMap.get(m)!;
          if (e.type === 'income') b.inc += e.amount; else b.exp += e.amount;
        }
        const sorted = [...monthMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
        let streak = 0;
        for (let i = sorted.length - 1; i >= 0; i--) {
          const [, d] = sorted[i];
          if (d.inc > d.exp) streak++;
          else break;
        }
        return clamp((streak / 3) * 100);
      })(),
      progressLabel: '3-month streak needed',
    },

    // ── Total assets ─────────────────────────────────────────────────────
    {
      id: 'assets_10l',
      emoji: '🌟', category: 'networth',
      title: '₹10 Lakh Total Assets', reward: 'The Asset Accumulator',
      description: 'Total assets (investments + cash) exceed ₹10,00,000.',
      unlocked: totalAssets >= 1_000_000,
      progress: clamp((totalAssets / 1_000_000) * 100),
      progressLabel: `${fmt(totalAssets)} / ${fmt(1_000_000)}`,
    },
  ];

  void bankBalance;
  return milestones.sort((a, b) => {
    if (a.unlocked && !b.unlocked) return -1;
    if (!a.unlocked && b.unlocked)  return 1;
    return b.progress - a.progress;
  });
}
