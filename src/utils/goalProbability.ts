/**
 * src/utils/goalProbability.ts
 *
 * Pure math engine for Goal Probability (Feature 6).
 * No React, no store imports — takes plain numbers, returns results.
 *
 * Key functions:
 *   goalProbabilityResult()  — full analysis for one goal
 *   whatIfMonthly()          — re-run with a different monthly investment
 *   estimateCompletionYear() — binary search for the year target is hit
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GoalProbabilityInput {
  targetAmount: number;
  currentSaved: number;       // currentAmount + contributions
  monthlyInvestment: number;  // avg monthly surplus / SIP amount
  expectedReturnPct: number;  // annual rate, e.g. 12
  targetDate?: string;        // YYYY-MM-DD — optional deadline
}

export interface GoalProbabilityResult {
  probability: number;        // 0–100
  estimatedCompletionYear: number;
  estimatedCompletionMonth: number; // 1-12
  monthsNeeded: number;
  projectedValue: number;     // value at targetDate (or at monthsNeeded)
  shortfall: number;          // 0 if on track
  isOnTrack: boolean;
  monthlyNeeded: number;      // PMT required to hit target by deadline
  savingsRate: number;        // currentSaved / targetAmount * 100
}

export interface WhatIfResult {
  monthlyInvestment: number;
  estimatedCompletionYear: number;
  estimatedCompletionMonth: number;
  monthsNeeded: number;
  probability: number;
}

// ─── Core math ────────────────────────────────────────────────────────────────

/**
 * Future value of a lump sum + monthly SIP after `months` at `annualReturnPct`.
 * FV = PV*(1+r)^n + PMT*[((1+r)^n - 1)/r]
 */
export function futureValue(
  presentValue: number,
  monthlyContribution: number,
  annualReturnPct: number,
  months: number,
): number {
  if (months <= 0) return presentValue;
  const r = annualReturnPct / 100 / 12;
  if (r === 0) return presentValue + monthlyContribution * months;
  const growth = Math.pow(1 + r, months);
  return presentValue * growth + monthlyContribution * ((growth - 1) / r);
}

/**
 * Monthly SIP needed (PMT) to reach target given existing corpus.
 * Derived from: target = PV*(1+r)^n + PMT*[((1+r)^n-1)/r]
 */
export function monthlyPMT(
  targetAmount: number,
  presentValue: number,
  annualReturnPct: number,
  months: number,
): number {
  if (months <= 0) return 0;
  const r = annualReturnPct / 100 / 12;
  if (r === 0) {
    const gap = targetAmount - presentValue;
    return gap > 0 ? gap / months : 0;
  }
  const growth = Math.pow(1 + r, months);
  const fvPV   = presentValue * growth;
  const gap    = targetAmount - fvPV;
  if (gap <= 0) return 0; // already there
  return gap / ((growth - 1) / r);
}

/**
 * Binary-search the number of months until FV >= target.
 * Returns { months, year, month }.
 */
function findMonthsToTarget(
  target: number,
  currentSaved: number,
  monthly: number,
  annualReturnPct: number,
): { months: number; year: number; month: number } {
  // Safety: if no contribution and no return, check if already funded
  if (monthly <= 0 && annualReturnPct <= 0) {
    if (currentSaved >= target) return { months: 0, year: new Date().getFullYear(), month: new Date().getMonth() + 1 };
    return { months: 9999, year: 9999, month: 1 };
  }

  const MAX_MONTHS = 600; // 50 years cap
  // Quick check if even at max months we can't reach it
  const fvMax = futureValue(currentSaved, monthly, annualReturnPct, MAX_MONTHS);
  if (fvMax < target) {
    const now = new Date();
    const futDate = new Date(now.getFullYear(), now.getMonth() + MAX_MONTHS);
    return { months: MAX_MONTHS, year: futDate.getFullYear(), month: futDate.getMonth() + 1 };
  }

  let lo = 0;
  let hi = MAX_MONTHS;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const fv  = futureValue(currentSaved, monthly, annualReturnPct, mid);
    if (fv >= target) hi = mid;
    else lo = mid + 1;
  }

  const now      = new Date();
  const futDate  = new Date(now.getFullYear(), now.getMonth() + lo);
  return { months: lo, year: futDate.getFullYear(), month: futDate.getMonth() + 1 };
}

/**
 * Convert months-needed vs deadline-months into a 0–100 probability score.
 *
 * Logic:
 *  • If no deadline: probability based on how realistic the investment rate is
 *    (if monthlyNeeded ≤ monthlyInvestment → ~85+%)
 *  • With deadline:
 *    - monthsNeeded ≤ deadline → 85–98% (some uncertainty remains)
 *    - within 10% overshoot → 60–85%
 *    - more than 10% over → scales down
 */
function computeProbability(
  monthsNeeded: number,
  deadlineMonths: number | null,
  monthlyInvestment: number,
  monthlyNeeded: number,
): number {
  if (deadlineMonths === null) {
    // No deadline — measure if current monthly is sufficient
    if (monthlyNeeded <= 0) return 98;
    if (monthlyInvestment <= 0) return 5;
    const ratio = monthlyInvestment / monthlyNeeded;
    if (ratio >= 1.5) return 95;
    if (ratio >= 1.2) return 88;
    if (ratio >= 1.0) return 82;
    if (ratio >= 0.8) return 65;
    if (ratio >= 0.5) return 40;
    return 15;
  }

  if (deadlineMonths <= 0) return monthsNeeded === 0 ? 100 : 0;

  const ratio = monthsNeeded / deadlineMonths;
  if (ratio <= 0.8)  return 96;
  if (ratio <= 0.95) return 90;
  if (ratio <= 1.0)  return 82;
  if (ratio <= 1.1)  return 68;
  if (ratio <= 1.25) return 50;
  if (ratio <= 1.5)  return 30;
  if (ratio <= 2.0)  return 15;
  return 5;
}

// ─── Main engine ──────────────────────────────────────────────────────────────

export function goalProbabilityResult(
  input: GoalProbabilityInput,
): GoalProbabilityResult {
  const {
    targetAmount,
    currentSaved,
    monthlyInvestment,
    expectedReturnPct,
    targetDate,
  } = input;

  if (targetAmount <= 0) {
    return {
      probability: 0, estimatedCompletionYear: 0, estimatedCompletionMonth: 0,
      monthsNeeded: 0, projectedValue: 0, shortfall: 0,
      isOnTrack: true, monthlyNeeded: 0, savingsRate: 0,
    };
  }

  const savingsRate = Math.min(100, (currentSaved / targetAmount) * 100);

  // Already achieved?
  if (currentSaved >= targetAmount) {
    const now = new Date();
    return {
      probability: 100,
      estimatedCompletionYear: now.getFullYear(),
      estimatedCompletionMonth: now.getMonth() + 1,
      monthsNeeded: 0,
      projectedValue: currentSaved,
      shortfall: 0,
      isOnTrack: true,
      monthlyNeeded: 0,
      savingsRate: 100,
    };
  }

  // Deadline months
  let deadlineMonths: number | null = null;
  if (targetDate) {
    const now   = new Date();
    const due   = new Date(targetDate);
    const diff  = (due.getFullYear() - now.getFullYear()) * 12 + (due.getMonth() - now.getMonth());
    deadlineMonths = Math.max(0, diff);
  }

  // Time to reach target
  const completion = findMonthsToTarget(
    targetAmount, currentSaved, monthlyInvestment, expectedReturnPct,
  );

  // PMT needed to hit deadline (or best estimate if no deadline)
  const pmt = deadlineMonths !== null
    ? monthlyPMT(targetAmount, currentSaved, expectedReturnPct, deadlineMonths)
    : monthlyPMT(targetAmount, currentSaved, expectedReturnPct, completion.months);

  // Projected value at deadline (or completion)
  const evalMonths  = deadlineMonths ?? completion.months;
  const projectedValue = futureValue(currentSaved, monthlyInvestment, expectedReturnPct, evalMonths);
  const shortfall   = Math.max(0, targetAmount - projectedValue);

  const probability = computeProbability(
    completion.months, deadlineMonths, monthlyInvestment, pmt,
  );

  return {
    probability,
    estimatedCompletionYear:  completion.year,
    estimatedCompletionMonth: completion.month,
    monthsNeeded:  completion.months,
    projectedValue,
    shortfall,
    isOnTrack: shortfall === 0,
    monthlyNeeded: pmt,
    savingsRate,
  };
}

/**
 * What-if: same goal but different monthly investment.
 * Cheap to call in a slider onChange — pure math, no store reads.
 */
export function whatIfMonthly(
  input: Omit<GoalProbabilityInput, 'monthlyInvestment'>,
  newMonthly: number,
): WhatIfResult {
  const result = goalProbabilityResult({ ...input, monthlyInvestment: newMonthly });
  return {
    monthlyInvestment:        newMonthly,
    estimatedCompletionYear:  result.estimatedCompletionYear,
    estimatedCompletionMonth: result.estimatedCompletionMonth,
    monthsNeeded:             result.monthsNeeded,
    probability:              result.probability,
  };
}

/**
 * Generate a set of what-if scenarios for display in the UI
 * (e.g. 0.5x, 0.75x, 1x, 1.25x, 1.5x, 2x of current monthly).
 */
export function generateWhatIfTable(
  input: GoalProbabilityInput,
): WhatIfResult[] {
  const base    = input.monthlyInvestment;
  const factors = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
  return factors.map((f) =>
    whatIfMonthly(input, Math.round(base * f)),
  );
}
