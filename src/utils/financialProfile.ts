// src/utils/financialProfile.ts
//
// Single source of truth for Financial Profile derived math.
// The profile itself (age, monthlyIncome, monthlyExpense, dependents,
// emergency fund config) lives in `EssentialsConfig` (store: `essentials`)
// and is edited ONLY from the Essentials tab. Everything below is derived:
//
//   monthlySavings = monthlyIncome − monthlyExpense
//   Liquid Assets  = linked bank accounts (live balances) + FD & RD
//   Net Worth      = Total Assets − Total Liabilities + Cashflow Savings
//                    (see calculations.ts)
//
// Consumed by: Essentials tab (health cards), Goals tab (FI timeline &
// goal probability), Dashboard (cash-flow aware Net Worth).

import type {
  Account,
  CashflowEntry,
  EssentialsConfig,
  InsurancePolicy,
  Investment,
  Liability,
  PendingPayment,
} from '../types/investmentTypes';
import {
  calcLiveAccountBalances,
  calculateNetWorth,
  isCashBalanceAccount,
} from './calculations';

export type EssentialsStatus = 'Perfect' | 'Good' | 'Risky';

/** Renewal-date based status of an insurance policy — same rule the main
 *  Insurance page uses (renewalDate in the past = expired). */
export type InsurancePolicyStatus = 'active' | 'expiring' | 'expired';

export function policyStatusOf(
  renewalDate: string | undefined,
  todayIso?: string,
): InsurancePolicyStatus {
  const today = todayIso ?? new Date().toISOString().slice(0, 10);
  if (!renewalDate) return 'active';
  if (renewalDate < today) return 'expired';
  const days = Math.round(
    (new Date(renewalDate).getTime() - new Date(today).getTime()) / 86400000,
  );
  return days <= 30 ? 'expiring' : 'active';
}

/** Read-only projection of an InsurancePolicy for the Essentials cards.
 *  Never stored — always derived from the Insurance feature's source of
 *  truth so add/edit/renew/expire/delete syncs automatically. */
export type PolicyView = {
  id: string;
  policyName: string;
  provider: string;
  coverageAmount: number;
  premiumAmount: number;
  premiumFrequency: InsurancePolicy['premiumFrequency'];
  renewalDate: string;
  status: InsurancePolicyStatus;
};

function toPolicyView(p: InsurancePolicy): PolicyView {
  return {
    id: p.id,
    policyName: p.policyName || p.provider || 'Policy',
    provider: p.provider,
    coverageAmount: p.coverageAmount || 0,
    premiumAmount: p.premiumAmount || 0,
    premiumFrequency: p.premiumFrequency,
    renewalDate: p.renewalDate,
    status: policyStatusOf(p.renewalDate),
  };
}

/** Monthly Savings — always derived, never stored: income − expense. */
export function getMonthlySavings(essentials?: EssentialsConfig): number {
  const income = essentials?.monthlyIncome ?? 0;
  const expense = essentials?.monthlyExpense ?? 0;
  return income > 0 ? income - expense : 0;
}

/** Liquid Assets pulled live from linked accounts (opening ± cashflows)
 *  + FD/RD investments. */
export function calcLiquidAssets(
  accounts: Account[],
  investments: Investment[],
  cashflows?: CashflowEntry[],
): { cashSavings: number; fdRd: number; total: number } {
  const live = calcLiveAccountBalances(accounts ?? [], cashflows ?? []);
  const cashSavings = (accounts ?? [])
    .filter(isCashBalanceAccount)
    .reduce((sum, a) => sum + (live[a.id] ?? a.balance ?? 0), 0);
  const fdRd = (investments ?? [])
    .filter((i) => i.type === 'fixed_deposit')
    .reduce((sum, i) => sum + ((i as any).investedAmount || 0), 0);
  return { cashSavings, fdRd, total: cashSavings + fdRd };
}

/** Map a 0–10 component score to a status badge. */
export function statusOf(score: number): EssentialsStatus {
  if (score >= 8) return 'Perfect';
  if (score >= 5) return 'Good';
  return 'Risky';
}

/** Months until liquid assets + monthly savings reach the FI number
 *  (25× annual expense, i.e. the 4% safe-withdrawal rule) at `returnPct`.
 *  Returns null when unreachable within 50 years or inputs are missing.
 */
export function monthsToFinancialIndependence(args: {
  liquidAssets: number;
  monthlySavings: number;
  monthlyExpense: number;
  returnPct?: number;
}): number | null {
  const { liquidAssets, monthlySavings, monthlyExpense } = args;
  const target = monthlyExpense * 12 * 25;
  if (target <= 0) return null;
  if (liquidAssets >= target) return 0;
  const r = (args.returnPct ?? 12) / 100 / 12;
  let fv = liquidAssets;
  for (let n = 1; n <= 600; n++) {
    fv = fv * (1 + r) + monthlySavings;
    if (fv >= target) return n;
  }
  return null;
}

export type EssentialsHealth = {
  hasProfile: boolean;
  hasAnyData: boolean;
  /** Overall health score, 0–10 (1 decimal). */
  overall: number;
  overallLabel: string;
  monthlyIncome: number;
  monthlyExpense: number;
  monthlySavings: number;
  liquid: { cashSavings: number; fdRd: number; extra: number; total: number };
  emergency: { runwayMonths: number; score: number; status: EssentialsStatus };
  savings: {
    rate: number;
    fiYears: number | null;
    score: number;
    status: EssentialsStatus;
  };
  term: {
    cover: number;
    recommended: number;
    score: number;
    status: EssentialsStatus;
    /** How `recommended` was derived. */
    formula: 'expense25' | 'income10' | 'none';
    policies: PolicyView[];
    activePremium: number;
  };
  health: {
    cover: number;
    recommended: number;
    minRecommended: number;
    dependents: number;
    score: number;
    status: EssentialsStatus;
    policies: PolicyView[];
    activePremium: number;
  };
  debt: {
    ratio: number; // 0–1
    totalLiabilities: number;
    totalAssets: number;
    netWorth: number;
    score: number;
    status: EssentialsStatus;
  };
};

function coverScore(cover: number, recommended: number): number {
  if (recommended <= 0) return cover > 0 ? 6 : 0;
  if (cover >= recommended) return 10;
  if (cover >= recommended / 2) return 6;
  return cover > 0 ? 3 : 0;
}

/** Full Essentials health check — one pure function shared by all tabs. */
export function calcEssentialsHealth(args: {
  essentials?: EssentialsConfig;
  accounts: Account[];
  investments: Investment[];
  liabilities: Liability[];
  insurancePolicies: InsurancePolicy[];
  pendingPayments?: PendingPayment[];
  cashflows?: CashflowEntry[];
}): EssentialsHealth {
  const { essentials, accounts, investments, liabilities, insurancePolicies } =
    args;

  const monthlyIncome = essentials?.monthlyIncome ?? 0;
  const monthlyExpense = essentials?.monthlyExpense ?? 0;
  const monthlySavings = getMonthlySavings(essentials);
  // Dependents is a COUNT of people (0–20), never an amount — clamp so stale
  // or mistyped values (e.g. 100000) can't inflate recommendations to crores.
  const dependents = Math.max(0, Math.min(20, Math.round(essentials?.dependents ?? 0)));
  const hasProfile = monthlyIncome > 0 || monthlyExpense > 0;

  const {
    totalAssets,
    totalLiabilities,
    netWorth,
  } = calculateNetWorth(
    investments,
    liabilities,
    args.pendingPayments,
    accounts,
    args.cashflows,
  );
  const hasAnyData =
    hasProfile || totalAssets > 0 || totalLiabilities > 0;

  // ── Liquid assets & emergency fund ───────────────────────────────────────
  const { cashSavings, fdRd, total: liquidBase } = calcLiquidAssets(
    accounts,
    investments,
    args.cashflows,
  );
  const extra = essentials?.emergencyFundCurrent ?? 0;
  const totalLiquid = liquidBase + extra;

  let runwayMonths = 0;
  let efScore = 0;
  if (monthlyExpense > 0) {
    runwayMonths = totalLiquid / monthlyExpense;
    efScore = Math.min(10, (runwayMonths / 6) * 10); // 6+ months = perfect
  } else {
    const target = essentials?.emergencyFundTarget ?? 0;
    if (target > 0) {
      const pct = Math.min(1, totalLiquid / target);
      efScore = pct * 10;
      runwayMonths = pct * 6;
    } else if (totalLiquid > 0) {
      efScore = 5;
    }
  }

  // ── Savings rate & FI timeline ───────────────────────────────────────────
  const rate =
    monthlyIncome > 0 ? (monthlySavings / monthlyIncome) * 100 : 0;
  const savingsScore = hasProfile
    ? Math.min(10, Math.max(0, (rate / 40) * 10)) // 40%+ saved = perfect
    : 0;
  const fiMonths = monthsToFinancialIndependence({
    liquidAssets: totalLiquid,
    monthlySavings: Math.max(0, monthlySavings),
    monthlyExpense,
  });

  // ── Insurance covers (live-synced from the Insurance feature) ───────────
  // Expired policies no longer protect anyone, so only active / expiring
  // policies count towards cover — exactly what the Insurance page shows.
  const termPolicies = insurancePolicies
    .filter((p) => p.type === 'life')
    .map(toPolicyView)
    .sort((a, b) => a.renewalDate.localeCompare(b.renewalDate));
  const healthPolicies = insurancePolicies
    .filter((p) => p.type === 'health')
    .map(toPolicyView)
    .sort((a, b) => a.renewalDate.localeCompare(b.renewalDate));
  const liveCover = (views: PolicyView[]) =>
    views
      .filter((v) => v.status !== 'expired')
      .reduce((s, v) => s + v.coverageAmount, 0);
  const livePremium = (views: PolicyView[]) =>
    views
      .filter((v) => v.status !== 'expired')
      .reduce((s, v) => s + v.premiumAmount, 0);
  const termCover = liveCover(termPolicies);
  const healthCover = liveCover(healthPolicies);
  // Ideal term cover: 25× annual expense − net worth already saved;
  // fall back to 10× annual income when no expense is on the profile.
  let termFormula: 'expense25' | 'income10' | 'none' = 'none';
  let termRecommended = 0;
  if (monthlyExpense > 0) {
    termFormula = 'expense25';
    termRecommended = Math.max(0, monthlyExpense * 12 * 25 - netWorth);
  } else if (monthlyIncome > 0) {
    termFormula = 'income10';
    termRecommended = monthlyIncome * 12 * 10;
  }
  const healthMinRecommended = 500_000 + dependents * 250_000;
  const healthRecommended = healthMinRecommended * 2;
  const termScore = coverScore(termCover, termRecommended);
  const healthScore = coverScore(healthCover, healthRecommended);

  // ── Debt ratio ───────────────────────────────────────────────────────────
  const ratio =
    totalAssets > 0
      ? Math.min(1, totalLiabilities / totalAssets)
      : totalLiabilities > 0
        ? 1
        : 0;
  let debtScore = 0;
  if (totalAssets > 0 || totalLiabilities > 0) {
    debtScore =
      ratio === 0 ? 10 : ratio <= 0.2 ? 10 : ratio <= 0.4 ? 7 : ratio <= 0.6 ? 4 : 1;
  }

  // ── Overall (weighted, 0–10) ─────────────────────────────────────────────
  const overall = hasAnyData
    ? Math.round(
        (efScore * 0.3 +
          savingsScore * 0.25 +
          debtScore * 0.2 +
          termScore * 0.15 +
          healthScore * 0.1) *
          10,
      ) / 10
    : 0;
  const overallLabel = !hasAnyData
    ? 'No Data Yet'
    : overall >= 8
      ? 'Excellent'
      : overall >= 6
        ? 'Looking Good'
        : overall >= 4
          ? 'Needs Attention'
          : 'At Risk';

  return {
    hasProfile,
    hasAnyData,
    overall,
    overallLabel,
    monthlyIncome,
    monthlyExpense,
    monthlySavings,
    liquid: { cashSavings, fdRd, extra, total: totalLiquid },
    emergency: {
      runwayMonths,
      score: Math.round(efScore),
      status: statusOf(efScore),
    },
    savings: {
      rate,
      fiYears: fiMonths == null ? null : Math.round((fiMonths / 12) * 10) / 10,
      score: Math.round(savingsScore),
      status: hasProfile ? statusOf(savingsScore) : 'Risky',
    },
    term: {
      cover: termCover,
      recommended: termRecommended,
      score: termScore,
      status: statusOf(termScore),
      formula: termFormula,
      policies: termPolicies,
      activePremium: livePremium(termPolicies),
    },
    health: {
      cover: healthCover,
      recommended: healthRecommended,
      minRecommended: healthMinRecommended,
      dependents,
      score: healthScore,
      status: statusOf(healthScore),
      policies: healthPolicies,
      activePremium: livePremium(healthPolicies),
    },
    debt: {
      ratio,
      totalLiabilities,
      totalAssets,
      netWorth,
      score: debtScore,
      status: statusOf(debtScore),
    },
  };
}
