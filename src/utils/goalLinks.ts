// src/utils/goalLinks.ts
// Helpers for linking specific investments to a Goal and rolling their live
// market value into the goal's "current" amount automatically.

import type { Goal, Investment, InvestmentType } from '../types/investmentTypes';
import { currentValue } from './calculations';

export const INVESTMENT_GROUP_LABEL: Record<InvestmentType, string> = {
  stock: 'Direct Stock',
  mutual_fund: 'Mutual Fund',
  bond: 'Bond / Debenture',
  fixed_deposit: 'Fixed Deposit',
  other: 'Other',
};

export const INVESTMENT_GROUP_ORDER: InvestmentType[] = [
  'stock',
  'mutual_fund',
  'bond',
  'fixed_deposit',
  'other',
];

/** Live market value of every investment linked to a goal. */
export function goalLinkedCurrentValue(
  goal: Pick<Goal, 'linkedAssetIds'>,
  investments: Investment[],
): number {
  const ids = new Set(goal.linkedAssetIds ?? []);
  if (ids.size === 0) return 0;
  return investments.reduce(
    (sum, inv) => (ids.has(inv.id) ? sum + currentValue(inv) : sum),
    0,
  );
}

/** Effective "current" for a goal = saved amount + extra contributions + live linked assets. */
export function effectiveGoalCurrent(
  goal: Goal,
  investments: Investment[],
  extraContributions = 0,
): number {
  return (
    goal.currentAmount +
    extraContributions +
    goalLinkedCurrentValue(goal, investments)
  );
}
