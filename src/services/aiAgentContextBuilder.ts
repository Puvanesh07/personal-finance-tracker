/**
 * src/services/aiAgentContextBuilder.ts
 *
 * Builds the structured context object expected by the `generateFinanceAI`
 * Firebase callable (functions/lib/ai/financeContext.js).
 *
 * Required shape:
 *   {
 *     summary: { netWorth, totalAssets, totalLiabilities, ... },
 *     investments?: { totalInvested, currentValue, unrealizedPL, records[] },
 *     cashflow?:    { avgMonthlyIncome, avgMonthlyExpense, monthlySurplus, ... },
 *     liabilities?: [...],
 *     payments?:    [...],
 *     goals?:       [...],
 *     insurance?:   [...],
 *     accounts?:    [...],
 *     lending?:     { ... },
 *   }
 *
 * The server-side `compactFinanceContext` selects which modules to send to
 * Groq based on intent — we always build everything we have so the server
 * can pick the right subset.
 */

import { calculateNetWorth, investedValue, currentValue } from '../utils/calculations';
import { usePortfolioStore } from '../store/portfolioStore';
import type { Investment, StockInvestment, MutualFundInvestment } from '../types/investmentTypes';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function monthlyAvg(
  entries: { type: string; amount: number; date: string }[],
  type: 'income' | 'expense',
): number {
  const rows = entries.filter((e) => e.type === type);
  if (!rows.length) return 0;
  const total = rows.reduce((a, r) => a + r.amount, 0);
  const months = new Set(rows.map((r) => r.date.slice(0, 7))).size || 1;
  return total / months;
}

function invPL(inv: Investment): { invested: number; current: number; pl: number; pct: number } {
  const invested = investedValue(inv);
  const current  = currentValue(inv);
  const pl       = current - invested;
  const pct      = invested > 0 ? (pl / invested) * 100 : 0;
  return { invested, current, pl, pct };
}

// ─── Main builder ──────────────────────────────────────────────────────────────

/** Build the full context object to pass to `generateFinanceAI`. */
export function buildAgentContext(): Record<string, unknown> {
  const {
    investments,
    liabilities,
    cashflows,
    goals,
    goalContributions,
    accounts,
    trackedPayments,
    insurancePolicies,
    lendingBorrowers,
    lendingTransactions,
    essentials,
  } = usePortfolioStore.getState();

  const { totalAssets, totalLiabilities, netWorth } = calculateNetWorth(investments, liabilities);
  const avgIncome  = monthlyAvg(cashflows, 'income');
  const avgExpense = monthlyAvg(cashflows, 'expense');
  const surplus    = avgIncome - avgExpense;
  const savingsRate = avgIncome > 0 ? ((surplus / avgIncome) * 100) : 0;

  // ── Summary (always required) ────────────────────────────────────────────
  const summary = {
    netWorth,
    totalAssets,
    totalLiabilities,
    debtToAssetRatio: totalAssets > 0 ? totalLiabilities / totalAssets : 0,
    avgMonthlyIncome:  avgIncome,
    avgMonthlyExpense: avgExpense,
    monthlySurplus:    surplus,
    savingsRatePct:    savingsRate,
    emergencyFundTarget:  essentials.emergencyFundTarget  ?? 0,
    emergencyFundCurrent: essentials.emergencyFundCurrent ?? 0,
    investmentCount: investments.length,
    liabilityCount:  liabilities.filter((l) => !l.status || l.status === 'active').length,
    goalCount:       goals.filter((g) => !g.status || g.status === 'active').length,
    accountCount:    accounts.length,
  };

  // ── Investments ──────────────────────────────────────────────────────────
  const totalInvested = investments.reduce((a, i) => a + investedValue(i), 0);
  const totalCurrent  = investments.reduce((a, i) => a + currentValue(i), 0);
  const unrealizedPL  = totalCurrent - totalInvested;
  const unrealizedPct = totalInvested > 0 ? (unrealizedPL / totalInvested) * 100 : 0;

  const invRecords = investments.map((inv) => {
    const { invested, current, pl, pct } = invPL(inv);
    const base = {
      name:        inv.name,
      symbol:      inv.symbol ?? null,
      type:        inv.type,
      invested,
      currentValue: current,
      profitLoss:   pl,
      returnPct:    pct,
    };
    if (inv.type === 'stock') {
      const s = inv as StockInvestment;
      return { ...base, quantity: s.quantity, buyPrice: s.buyPrice, currentPrice: s.currentPrice, sector: s.sector };
    }
    if (inv.type === 'mutual_fund') {
      const m = inv as MutualFundInvestment;
      return { ...base, units: m.units, nav: m.nav };
    }
    return base;
  });

  const investmentsCtx = investments.length > 0 ? {
    totalInvested,
    currentValue: totalCurrent,
    unrealizedPL,
    unrealizedPct,
    records: invRecords,
  } : undefined;

  // ── Cash flow ────────────────────────────────────────────────────────────
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const thisMonthEntries = cashflows.filter((e) => e.date.startsWith(thisMonth));
  const thisIncome  = thisMonthEntries.filter((e) => e.type === 'income').reduce((a, e) => a + e.amount, 0);
  const thisExpense = thisMonthEntries.filter((e) => e.type === 'expense').reduce((a, e) => a + e.amount, 0);

  // Top expense categories (all time)
  const catMap = cashflows
    .filter((e) => e.type === 'expense')
    .reduce((acc, e) => { acc[e.category] = (acc[e.category] ?? 0) + e.amount; return acc; }, {} as Record<string, number>);
  const topCategories = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([category, total]) => ({ category, total }));

  const cashflowCtx = cashflows.length > 0 ? {
    avgMonthlyIncome:  avgIncome,
    avgMonthlyExpense: avgExpense,
    monthlySurplus:    surplus,
    savingsRatePct:    savingsRate,
    thisMonthIncome:   thisIncome,
    thisMonthExpense:  thisExpense,
    topCategories,
    entryCount: cashflows.length,
  } : undefined;

  // ── Liabilities ──────────────────────────────────────────────────────────
  const activeLiabilities = liabilities.filter((l) => !l.status || l.status === 'active');
  const liabilitiesCtx = activeLiabilities.length > 0
    ? activeLiabilities
        .sort((a, b) => (b.interestRate ?? 0) - (a.interestRate ?? 0))
        .map((l) => ({
          name:         l.name,
          type:         l.type,
          outstanding:  l.outstanding ?? 0,
          interestRate: l.interestRate ?? null,
          emiAmount:    l.emiAmount ?? null,
          endDate:      l.endDate ?? null,
        }))
    : undefined;

  // ── Payments ─────────────────────────────────────────────────────────────
  const today    = now.toISOString().slice(0, 10);
  const in30days = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);
  const pendingPayments = trackedPayments.filter((p) => p.status === 'pending');
  const paymentsCtx = pendingPayments.length > 0 ? {
    pendingCount: pendingPayments.length,
    totalPending: pendingPayments.reduce((a, p) => a + p.amount, 0),
    items: pendingPayments
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 20)
      .map((p) => ({
        title:    p.title,
        amount:   p.amount,
        dueDate:  p.dueDate,
        overdue:  p.dueDate < today,
        dueSoon:  p.dueDate >= today && p.dueDate <= in30days,
        recurrence: p.recurrence,
      })),
  } : undefined;

  // ── Goals ────────────────────────────────────────────────────────────────
  const activeGoals = goals.filter((g) => !g.status || g.status === 'active');
  const goalsCtx = activeGoals.length > 0
    ? activeGoals.map((g) => {
        const contributions = goalContributions.filter((c) => c.goalId === g.id);
        const contributed   = contributions.reduce((a, c) => a + c.amount, 0);
        const saved         = g.currentAmount + contributed;
        const progress      = g.targetAmount > 0 ? Math.min(100, (saved / g.targetAmount) * 100) : 0;
        return {
          name:         g.name,
          targetAmount: g.targetAmount,
          savedAmount:  saved,
          progressPct:  progress,
          remaining:    Math.max(0, g.targetAmount - saved),
          dueDate:      g.dueDate ?? null,
        };
      })
    : undefined;

  // ── Insurance ────────────────────────────────────────────────────────────
  const insuranceCtx = insurancePolicies.length > 0 ? {
    policyCount:    insurancePolicies.length,
    totalCoverage:  insurancePolicies.reduce((a, p) => a + (p.coverageAmount ?? 0), 0),
    totalPremium:   insurancePolicies.reduce((a, p) => a + (p.premiumAmount ?? 0), 0),
    policies: insurancePolicies.map((p) => ({
      name:             p.policyName,
      type:             p.type,
      coverageAmount:   p.coverageAmount,
      premiumAmount:    p.premiumAmount,
      premiumFrequency: p.premiumFrequency,
      renewalDate:      p.renewalDate,
    })),
  } : undefined;

  // ── Accounts ─────────────────────────────────────────────────────────────
  const accountsCtx = accounts.length > 0 ? {
    totalBalance: accounts.reduce((a, ac) => a + (ac.balance ?? 0), 0),
    accounts: accounts.map((ac) => ({
      name:    ac.name,
      type:    ac.type,
      balance: ac.balance ?? 0,
    })),
  } : undefined;

  // ── Lending ──────────────────────────────────────────────────────────────
  const activeBorrowers = lendingBorrowers.filter((b) => b.status === 'active');
  const lendingCtx = activeBorrowers.length > 0 ? {
    activeBorrowerCount: activeBorrowers.length,
    borrowers: activeBorrowers.map((b) => {
      const txns     = lendingTransactions.filter((t) => t.borrowerId === b.id);
      const given    = txns.filter((t) => t.type === 'principal_given').reduce((a, t) => a + t.amount, 0);
      const returned = txns.filter((t) => t.type === 'principal_returned').reduce((a, t) => a + t.amount, 0);
      const interest = txns.filter((t) => t.type === 'interest_paid').reduce((a, t) => a + t.amount, 0);
      return {
        name:                b.name,
        principalGiven:      given,
        principalReturned:   returned,
        outstanding:         given - returned,
        interestCollected:   interest,
        interestRate:        b.interestRate ?? null,
      };
    }),
  } : null;

  // ── Emergency fund ───────────────────────────────────────────────────────
  const emergencyFundCtx = (essentials.emergencyFundTarget || essentials.emergencyFundCurrent)
    ? {
        target:  essentials.emergencyFundTarget  ?? 0,
        current: essentials.emergencyFundCurrent ?? 0,
        pct:     (essentials.emergencyFundTarget ?? 0) > 0
          ? Math.min(100, ((essentials.emergencyFundCurrent ?? 0) / (essentials.emergencyFundTarget ?? 1)) * 100)
          : 0,
      }
    : undefined;

  // ── Assemble ─────────────────────────────────────────────────────────────
  return {
    summary,
    ...(investmentsCtx  ? { investments:   investmentsCtx  } : {}),
    ...(cashflowCtx     ? { cashflow:      cashflowCtx     } : {}),
    ...(liabilitiesCtx  ? { liabilities:   liabilitiesCtx  } : {}),
    ...(paymentsCtx     ? { payments:      paymentsCtx     } : {}),
    ...(goalsCtx        ? { goals:         goalsCtx        } : {}),
    ...(insuranceCtx    ? { insurance:     insuranceCtx    } : {}),
    ...(accountsCtx     ? { accounts:      accountsCtx     } : {}),
    ...(emergencyFundCtx? { emergencyFund: emergencyFundCtx} : {}),
    lending:     lendingCtx  ?? null,
  };
}

/**
 * Minimal context for GENERAL (educational) questions.
 * The server still requires `summary` to exist — we send an empty summary
 * so it passes validation. The Groq prompt (QUESTION_SYSTEM_PROMPT) will
 * say "no data available" for personal fields if asked, and answer
 * educational questions from its own knowledge.
 */
export function buildGeneralQuestionContext(): Record<string, unknown> {
  return {
    summary: {
      note: 'General financial education question — no personal portfolio data required.',
    },
  };
}

