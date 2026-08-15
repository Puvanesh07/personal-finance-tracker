import type {
  BondInvestment,
  FixedDepositInvestment,
  Investment,
  InvestmentType,
  Liability,
  MutualFundInvestment,
  OtherInvestment,
  StockInvestment,
} from '../types/investmentTypes';

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

// The five types the rest of the app understands. Anything else (bad/legacy
// data from an import, a manually-edited JSON backup, a future type that
// hasn't shipped yet, etc.) is treated as 'other' so a single malformed
// record can never crash the whole dashboard.
export const KNOWN_INVESTMENT_TYPES: InvestmentType[] = [
  'stock',
  'mutual_fund',
  'bond',
  'fixed_deposit',
  'other',
];

export function isKnownInvestmentType(type: unknown): type is InvestmentType {
  return (
    typeof type === 'string' &&
    (KNOWN_INVESTMENT_TYPES as string[]).includes(type)
  );
}

/** Safely resolves the bucket a (possibly malformed) investment belongs to. */
export function safeInvestmentType(inv: unknown): InvestmentType {
  const type = (inv as { type?: unknown } | null | undefined)?.type;
  return isKnownInvestmentType(type) ? type : 'other';
}

export function investedValue(inv: Investment): number {
  switch (inv.type) {
    case 'stock':
      return (inv.quantity ?? 0) * (inv.buyPrice ?? 0);
    case 'mutual_fund':
      return inv.investedAmount ?? 0;
    case 'bond':
      return inv.investedAmount ?? 0;
    case 'fixed_deposit':
      return inv.investedAmount ?? 0;
    case 'other':
      return inv.investedAmount ?? 0;
    default: {
      // Unknown/legacy type — fall back to whatever numeric hint is present
      // instead of throwing, so a single bad record can't break the app.
      const anyInv = inv as {
        investedAmount?: number;
        quantity?: number;
        buyPrice?: number;
      };
      if (anyInv.investedAmount != null) return anyInv.investedAmount;
      if (anyInv.quantity != null && anyInv.buyPrice != null) {
        return anyInv.quantity * anyInv.buyPrice;
      }
      return 0;
    }
  }
}

export function currentValue(inv: Investment): number {
  switch (inv.type) {
    case 'stock':
      return (inv.quantity ?? 0) * (inv.currentPrice ?? 0);
    case 'mutual_fund':
      return (inv.units ?? 0) * (inv.nav ?? 0);
    case 'bond':
      return (inv.investedAmount ?? 0) + expectedInterestForBond(inv);
    case 'fixed_deposit':
      return maturityValueForFD(inv);
    case 'other':
      return inv.currentValue ?? 0;
    default:
      // Unknown/legacy type — best-effort fallback, never throw.
      return (
        (inv as { currentValue?: number })?.currentValue ??
        (inv as { investedAmount?: number })?.investedAmount ??
        0
      );
  }
}

export function profitLoss(inv: Investment): number {
  return currentValue(inv) - investedValue(inv);
}

export function expectedInterestForBond(bond: BondInvestment): number {
  return (
    ((bond.investedAmount ?? 0) *
      ((bond.interestRate ?? 0) / 100) *
      (bond.durationMonths ?? 0)) /
    12
  );
}

export function interestEarnedForFD(fd: FixedDepositInvestment): number {
  return (
    ((fd.investedAmount ?? 0) *
      ((fd.interestRate ?? 0) / 100) *
      (fd.durationMonths ?? 0)) /
    12
  );
}

export function maturityValueForFD(fd: FixedDepositInvestment): number {
  return (fd.investedAmount ?? 0) + interestEarnedForFD(fd);
}

export function typeLabel(type: InvestmentType) {
  switch (type) {
    case 'stock':
      return 'Stock';
    case 'mutual_fund':
      return 'Mutual fund';
    case 'bond':
      return 'Bond';
    case 'fixed_deposit':
      return 'Fixed deposit';
    case 'other':
      return 'Other';
  }
}

export type PortfolioSummary = {
  totalValue: number;
  investedTotal: number;
  profitLossTotal: number;
  byType: Record<
    InvestmentType,
    { invested: number; current: number; profitLoss: number }
  >;
  expectedInterest: {
    bonds: number;
    fds: number;
    total: number;
  };
};

export function summarizePortfolio(
  investments: Investment[],
): PortfolioSummary {
  const byType: PortfolioSummary['byType'] = {
    stock: { invested: 0, current: 0, profitLoss: 0 },
    mutual_fund: { invested: 0, current: 0, profitLoss: 0 },
    bond: { invested: 0, current: 0, profitLoss: 0 },
    fixed_deposit: { invested: 0, current: 0, profitLoss: 0 },
    other: { invested: 0, current: 0, profitLoss: 0 },
  };

  let bondsInterest = 0;
  let fdsInterest = 0;

  for (const inv of investments ?? []) {
    if (!inv) continue; // guard against null/undefined entries in imported data

    // Route unrecognized/malformed types into the 'other' bucket instead of
    // crashing — byType[inv.type] used to be indexed directly, which threw
    // "Cannot read properties of undefined (reading 'invested')" whenever a
    // record had a type outside the five known ones (e.g. bad/edited JSON
    // import, or a legacy type that's since been removed).
    const bucket = safeInvestmentType(inv);

    const invested = investedValue(inv);
    const current = currentValue(inv);
    const pl = current - invested;

    byType[bucket].invested += invested;
    byType[bucket].current += current;
    byType[bucket].profitLoss += pl;

    if (inv.type === 'bond') bondsInterest += expectedInterestForBond(inv);
    if (inv.type === 'fixed_deposit') fdsInterest += interestEarnedForFD(inv);
  }

  const investedTotal = Object.values(byType).reduce(
    (acc, v) => acc + v.invested,
    0,
  );
  const totalValue = Object.values(byType).reduce(
    (acc, v) => acc + v.current,
    0,
  );
  const profitLossTotal = totalValue - investedTotal;

  return {
    totalValue,
    investedTotal,
    profitLossTotal,
    byType,
    expectedInterest: {
      bonds: bondsInterest,
      fds: fdsInterest,
      total: bondsInterest + fdsInterest,
    },
  };
}

export function calculateCAGR(
  startValue: number,
  endValue: number,
  years: number,
): number | null {
  if (startValue <= 0 || endValue <= 0 || years <= 0) return null;
  return Math.pow(endValue / startValue, 1 / years) - 1;
}

type CashflowPoint = { amount: number; date: string | Date };

/**
 * Basic XIRR implementation via Newton-Raphson with a bisection fallback.
 * Amount convention: outflows negative, inflows positive.
 */
export function calculateXIRR(
  cashflows: CashflowPoint[],
  guess = 0.12,
): number | null {
  if (cashflows.length < 2) return null;
  const points = cashflows
    .map((c) => ({
      amount: Number(c.amount),
      date: c.date instanceof Date ? c.date : new Date(c.date),
    }))
    .filter((c) => Number.isFinite(c.amount) && !Number.isNaN(c.date.getTime()))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (points.length < 2) return null;
  const hasPos = points.some((p) => p.amount > 0);
  const hasNeg = points.some((p) => p.amount < 0);
  if (!hasPos || !hasNeg) return null;

  const t0 = points[0].date.getTime();
  const years = (d: Date) => (d.getTime() - t0) / (365 * 24 * 60 * 60 * 1000);

  const npv = (r: number) =>
    points.reduce(
      (sum, p) => sum + p.amount / Math.pow(1 + r, years(p.date)),
      0,
    );

  const dNpv = (r: number) =>
    points.reduce(
      (sum, p) =>
        sum - (years(p.date) * p.amount) / Math.pow(1 + r, years(p.date) + 1),
      0,
    );

  let r = guess;
  for (let i = 0; i < 60; i++) {
    const f = npv(r);
    const fp = dNpv(r);
    if (!Number.isFinite(f) || !Number.isFinite(fp) || Math.abs(fp) < 1e-12)
      break;
    const next = r - f / fp;
    if (!Number.isFinite(next) || next <= -0.999999999) break;
    if (Math.abs(next - r) < 1e-7) return next;
    r = next;
  }

  // fallback: bisection in a wide practical interval
  let lo = -0.95;
  let hi = 5;
  let fLo = npv(lo);
  let fHi = npv(hi);
  if (fLo * fHi > 0) return null;
  for (let i = 0; i < 120; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid);
    if (Math.abs(fMid) < 1e-7) return mid;
    if (fLo * fMid < 0) {
      hi = mid;
      fHi = fMid;
    } else {
      lo = mid;
      fLo = fMid;
    }
    if (Math.abs(hi - lo) < 1e-7) return (hi + lo) / 2;
  }
  return null;
}

export function toStockLikeRow(inv: Investment) {
  if (inv.type !== 'stock') return null;
  return inv satisfies StockInvestment;
}

export function toMutualFundRow(inv: Investment) {
  if (inv.type !== 'mutual_fund') return null;
  return inv satisfies MutualFundInvestment;
}

export function toOtherRow(inv: Investment) {
  if (inv.type !== 'other') return null;
  return inv satisfies OtherInvestment;
}

/** Active liabilities only — excludes settled (returned/paid) debts. */
export function getActiveLiabilitiesTotal(liabilities: Liability[]): number {
  return liabilities
    .filter((l) => l.status !== 'returned' && l.status !== 'paid')
    .reduce((acc, l) => acc + (l.outstanding || 0), 0);
}

export type NetWorthBreakdown = {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
};

/** Net Worth = Total Assets − Total Liabilities */
export function calculateNetWorth(
  investments: Investment[],
  liabilities: Liability[],
): NetWorthBreakdown {
  const { totalValue } = summarizePortfolio(investments);
  const totalLiabilities = getActiveLiabilitiesTotal(liabilities);
  return {
    totalAssets: totalValue,
    totalLiabilities,
    netWorth: totalValue - totalLiabilities,
  };
}
