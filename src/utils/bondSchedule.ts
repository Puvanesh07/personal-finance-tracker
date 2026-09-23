// src/utils/bondSchedule.ts
/**
 * Bond interest schedule engine.
 *
 * Given a bond's principal, rate, tenure, start date and payout frequency this
 * module derives the full coupon schedule (each interest payment) plus the
 * maturity settlement. Every payment is shown as Received / Upcoming based on
 * today's date alone — bond interest lives inside the Investments section and
 * is never posted to Cashflow or Accounts automatically.
 *
 * Coupon timing follows the product spec: the first coupon lands on the
 * investment (start) date, then every full period after that. A tenured bond of
 * N months paid monthly therefore produces N coupons (start .. start+N-1) and
 * returns the principal on the maturity date (start + N months). Any leftover
 * partial period is paid as a prorated final coupon on the maturity date.
 */

import type {
  BondInvestment,
  BondPayoutFrequency,
  ISODateString,
} from '../types/investmentTypes';
import { addMonths, monthKey, parseBusinessDate } from '../services/dateService';
import { todayISO } from './dateUtils';

/** Number of months covered by one coupon for each payout frequency. */
export const MONTHS_PER_PERIOD: Record<BondPayoutFrequency, number> = {
  monthly: 1,
  quarterly: 3,
  half_yearly: 6,
  yearly: 12,
};

export const PAYOUT_FREQUENCY_LABELS: Record<BondPayoutFrequency, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  half_yearly: 'Half-Yearly',
  yearly: 'Yearly',
};

export const PAYOUT_FREQUENCY_OPTIONS: BondPayoutFrequency[] = [
  'monthly',
  'quarterly',
  'half_yearly',
  'yearly',
];

/** A single row in a bond's payment schedule. */
export type BondScheduleItem = {
  /** 0-based index of the coupon (maturity item uses index -1). */
  index: number;
  /** Payment date (YYYY-MM-DD). */
  date: ISODateString;
  /** Interest portion of this payment. */
  interest: number;
  /** Principal portion (only non-zero on the maturity settlement). */
  principal: number;
  /** Total credited on this date (interest + principal). */
  amount: number;
  kind: 'interest' | 'maturity';
  /** Stable unique id for the row (used as a list key). */
  id: string;
};

export type BondPaymentStatus = 'received' | 'upcoming' | 'missed';

export type BondScheduleRow = BondScheduleItem & {
  status: BondPaymentStatus;
};

/** Stable id for a coupon schedule row. */
export function bondCouponId(bondId: string, index: number): string {
  return `cf_bondint_${bondId}_${index}`;
}

/** Stable id for the maturity settlement row. */
export function bondMaturityItemId(bondId: string): string {
  return `cf_bondmat_${bondId}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Interest paid by a single coupon for the bond's frequency. */
export function bondInterestPerPeriod(bond: BondInvestment): number {
  const freq = bond.payoutFrequency ?? 'monthly';
  const months = MONTHS_PER_PERIOD[freq];
  const principal = bond.investedAmount ?? 0;
  const rate = bond.interestRate ?? 0;
  return round2((principal * (rate / 100) * months) / 12);
}

/** Effective maturity date — falls back to start + tenure when unset. */
export function bondMaturityDate(bond: BondInvestment): ISODateString {
  if (bond.maturityDate) return bond.maturityDate;
  return addMonths(bond.startDate, bond.durationMonths ?? 0);
}

/**
 * Builds the complete, date-ordered payment schedule for a bond (coupons plus
 * the final maturity settlement). Pure — does not read Cashflow state.
 */
export function generateBondSchedule(bond: BondInvestment): BondScheduleItem[] {
  const freq = bond.payoutFrequency ?? 'monthly';
  const step = MONTHS_PER_PERIOD[freq];
  const principal = bond.investedAmount ?? 0;
  const rate = bond.interestRate ?? 0;
  const tenure = bond.durationMonths ?? 0;
  const start = bond.startDate;

  if (!start || !parseBusinessDate(start) || tenure <= 0) return [];

  const perPeriod = bondInterestPerPeriod(bond);
  const items: BondScheduleItem[] = [];

  // Full-period coupons: k = 0 .. (fullPeriods - 1), first on the start date.
  const fullPeriods = Math.floor(tenure / step);
  for (let k = 0; k < fullPeriods; k++) {
    const date = addMonths(start, k * step);
    items.push({
      index: k,
      date,
      interest: perPeriod,
      principal: 0,
      amount: perPeriod,
      kind: 'interest',
      id: bondCouponId(bond.id, k),
    });
  }

  // Leftover partial period paid as a prorated coupon on the maturity date.
  const remainingMonths = tenure - fullPeriods * step;
  const finalInterest =
    remainingMonths > 0
      ? round2((principal * (rate / 100) * remainingMonths) / 12)
      : 0;

  const maturity = bondMaturityDate(bond);
  items.push({
    index: -1,
    date: maturity,
    interest: finalInterest,
    principal,
    amount: round2(principal + finalInterest),
    kind: 'maturity',
    id: bondMaturityItemId(bond.id),
  });

  return items.sort((a, b) => a.date.localeCompare(b.date));
}

export type BondSummary = {
  perPeriodInterest: number;
  totalExpectedInterest: number;
  principal: number;
  totalMaturityAmount: number;
  interestReceived: number;
  interestRemaining: number;
  principalReceived: boolean;
  couponCount: number;
  couponsReceived: number;
  nextPayment: BondScheduleRow | null;
  maturityDate: ISODateString;
  isMatured: boolean;
  /** Interest actually received grouped by month key (YYYY-MM). */
  byMonth: { month: string; amount: number }[];
  schedule: BondScheduleRow[];
};

/**
 * Derives a bond's roll-up totals and per-payment status purely from its
 * schedule and today's date. Bond interest is tracked inside the Investments
 * section only — nothing is posted to Cashflow or Accounts automatically.
 *
 * Status rules:
 *  - date <= today -> received
 *  - date >  today -> upcoming
 */
export function summarizeBond(bond: BondInvestment): BondSummary {
  const schedule = generateBondSchedule(bond);
  const today = todayISO();

  const rows: BondScheduleRow[] = schedule.map((item) => ({
    ...item,
    status: item.date <= today ? 'received' : 'upcoming',
  }));

  const coupons = rows.filter((r) => r.kind === 'interest');
  const maturityRow = rows.find((r) => r.kind === 'maturity');

  const totalExpectedInterest = round2(
    rows.reduce((s, r) => s + r.interest, 0),
  );
  const interestReceived = round2(
    rows
      .filter((r) => r.status === 'received')
      .reduce((s, r) => s + r.interest, 0),
  );
  const principalReceived = maturityRow?.status === 'received';

  // Month-by-month breakdown of interest actually received.
  const monthMap = new Map<string, number>();
  for (const r of rows) {
    if (r.status !== 'received' || r.interest <= 0) continue;
    const key = monthKey(r.date);
    monthMap.set(key, round2((monthMap.get(key) ?? 0) + r.interest));
  }
  const byMonth = [...monthMap.entries()]
    .map(([month, amount]) => ({ month, amount }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const nextPayment =
    rows.find((r) => r.status === 'upcoming') ??
    rows.find((r) => r.status === 'missed') ??
    null;

  return {
    perPeriodInterest: bondInterestPerPeriod(bond),
    totalExpectedInterest,
    principal: bond.investedAmount ?? 0,
    totalMaturityAmount: round2(
      (bond.investedAmount ?? 0) + totalExpectedInterest,
    ),
    interestReceived,
    interestRemaining: round2(totalExpectedInterest - interestReceived),
    principalReceived,
    couponCount: coupons.length,
    couponsReceived: coupons.filter((c) => c.status === 'received').length,
    nextPayment,
    maturityDate: bondMaturityDate(bond),
    isMatured: principalReceived || (maturityRow?.date ?? '') <= today,
    byMonth,
    schedule: rows,
  };
}
