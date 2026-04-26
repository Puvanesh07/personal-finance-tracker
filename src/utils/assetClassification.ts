// src/utils/assetClassification.ts

import type { Investment } from '../types/investmentTypes';
import { currentValue } from './calculations';

export type DashboardHoldingFilter =
  | 'all'
  | 'equity'
  | 'stocks'
  | 'mutual_funds'
  | 'etfs'
  | 'gold'
  | 'silver'
  | 'bonds';

export type AllocationBucket =
  | 'stocks'
  | 'mutualFunds'
  | 'etfs'
  | 'gold'
  | 'silver'
  | 'bonds'
  | 'other';

type ExposureFlags = {
  isGold: boolean;
  isSilver: boolean;
  isEtf: boolean;
  isBondLike: boolean;
  isStock: boolean;
  isMutualFund: boolean;
};

// Now includes 'sector' and 'marketCap' for better matching
function normalizedText(inv: Investment): string {
  const anyInv = inv as any;
  const sector = anyInv.sector || '';
  const marketCap = anyInv.marketCap || '';
  return `${inv.name} ${inv.symbol ?? ''} ${inv.platform ?? ''} ${sector} ${marketCap}`.toLowerCase();
}

function detectExposure(inv: Investment): ExposureFlags {
  const text = normalizedText(inv);

  // Match "etf", "etfs", or anything with "bees" (common Indian ETFs)
  const isEtf = /\betfs?\b/.test(text) || text.includes('bees');

  const isGold =
    inv.type === 'other'
      ? inv.assetType === 'gold'
      : /\bgold\b|\bsgb\b|\bgoldbees\b|\bgol[d]?\s*etf\b/.test(text);

  const isSilver =
    inv.type === 'other'
      ? inv.assetType === 'silver'
      : /\bsilver\b|\bsilv(er)?bees\b|\bsilv?\s*etf\b/.test(text);

  return {
    isGold,
    isSilver,
    // Gold/Silver ETFs should never be treated as generic ETFs in asset allocation.
    isEtf: isEtf && !isGold && !isSilver,
    isBondLike:
      inv.type === 'bond' ||
      inv.type === 'fixed_deposit' ||
      (inv.type === 'other' &&
        (inv.assetType === 'ppf' ||
          inv.assetType === 'nps' ||
          inv.assetType === 'epf')),
    isStock: inv.type === 'stock' && !isEtf && !isGold && !isSilver,
    isMutualFund: inv.type === 'mutual_fund' && !isEtf && !isGold && !isSilver,
  };
}

export function classifyInvestmentBucket(inv: Investment): AllocationBucket {
  const exposure = detectExposure(inv);

  if (exposure.isGold) return 'gold';
  if (exposure.isSilver) return 'silver';
  if (exposure.isEtf) return 'etfs';
  if (exposure.isStock) return 'stocks';
  if (exposure.isMutualFund) return 'mutualFunds';
  if (exposure.isBondLike) return 'bonds';
  return 'other';
}

export function includeHoldingByFilter(
  inv: Investment,
  filter: DashboardHoldingFilter,
): boolean {
  if (filter === 'all') return true;
  const exposure = detectExposure(inv);
  switch (filter) {
    case 'equity':
      return (
        exposure.isStock ||
        exposure.isMutualFund ||
        exposure.isEtf ||
        exposure.isGold ||
        exposure.isSilver
      );
    case 'stocks':
      return exposure.isStock;
    case 'mutual_funds':
      return exposure.isMutualFund;
    case 'etfs':
      return exposure.isEtf;
    case 'gold':
      return exposure.isGold;
    case 'silver':
      return exposure.isSilver;
    case 'bonds':
      return exposure.isBondLike;
    default:
      return true;
  }
}

export function getAllocationTotals(investments: Investment[]) {
  const totals = {
    overall: 0,
    stocks: 0,
    mutualFunds: 0,
    etfs: 0,
    gold: 0,
    silver: 0,
    bonds: 0,
    other: 0,
  };

  for (const inv of investments) {
    const value = currentValue(inv);
    totals.overall += value;
    const bucket = classifyInvestmentBucket(inv);
    totals[bucket] += value;
  }

  return totals;
}
