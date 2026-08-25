// src/hooks/useTrialLimits.ts
// Exposes per-feature trial usage counts, limits, and atLimit flags.
// Used by: TrialUsagePanel (Pricing page), useTrialGuard, and any add-form
// that wants to show inline limit warnings before the store blocks them.

import { useMemo } from 'react';
import { usePortfolioStore } from '../store/portfolioStore';
import { useSubscription } from '../context/SubscriptionContext';
import {
  TRIAL_FEATURE_LIMITS,
  TRIAL_FEATURE_LABELS,
  TRIAL_FEATURE_ICONS,
  type TrialFeatureKey,
} from '../types/subscription';

export interface FeatureUsage {
  key: TrialFeatureKey;
  label: string;
  icon: string;
  count: number;
  limit: number;
  /** pct 0–100, capped at 100 */
  pct: number;
  atLimit: boolean;
  /** true when user has a paid plan — limits don't apply */
  unlimited: boolean;
}

export interface TrialLimitsResult {
  /** Whether the limits system is even relevant for this user */
  isTrialUser: boolean;
  /** true if NOT on a trial (paid plan) — all features are unlimited */
  isPremium: boolean;
  usage: Record<TrialFeatureKey, FeatureUsage>;
  /** Convenience array in display order */
  usageList: FeatureUsage[];
  /** true if ANY feature is at or over limit */
  anyAtLimit: boolean;
}

const DISPLAY_ORDER: TrialFeatureKey[] = [
  'investments',
  'cashflows',
  'payments',
  'insurance',
  'liabilities',
  'credentials',
  'accounts',
  'goals',
];

export function useTrialLimits(): TrialLimitsResult {
  const { isTrial, hasPremiumAccess } = useSubscription();

  // ── Raw counts from stores ────────────────────────────────────────────────
  const investments = usePortfolioStore((s) => s.investments.length);
  const cashflows = usePortfolioStore((s) => s.cashflows.length);
  // "payments" = trackedPayments + pendingPayments combined
  const trackedPayments = usePortfolioStore((s) => s.trackedPayments.length);
  const pendingPayments = usePortfolioStore((s) => s.pendingPayments.length);
  const insurance = usePortfolioStore((s) => s.insurancePolicies.length);
  const liabilities = usePortfolioStore((s) => s.liabilities.length);
  const credentials = usePortfolioStore((s) => s.credentials.length);
  const accounts = usePortfolioStore((s) => s.accounts.length);
  const goals = usePortfolioStore((s) => s.goals.length);

  // Payments = tracked + pending (both "payment" features share the same limit)
  const payments = trackedPayments + pendingPayments;

  const isPremium = hasPremiumAccess && !isTrial;

  const rawCounts: Record<TrialFeatureKey, number> = {
    investments,
    cashflows,
    payments,
    insurance,
    liabilities,
    credentials,
    accounts,
    goals,
  };

  const usage = useMemo<Record<TrialFeatureKey, FeatureUsage>>(() => {
    const result = {} as Record<TrialFeatureKey, FeatureUsage>;
    for (const key of DISPLAY_ORDER) {
      const count = rawCounts[key];
      const limit = TRIAL_FEATURE_LIMITS[key];
      result[key] = {
        key,
        label: TRIAL_FEATURE_LABELS[key],
        icon: TRIAL_FEATURE_ICONS[key],
        count,
        limit,
        pct: isPremium ? 100 : Math.min(100, Math.round((count / limit) * 100)),
        atLimit: !isPremium && isTrial && count >= limit,
        unlimited: isPremium,
      };
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isPremium,
    isTrial,
    investments,
    cashflows,
    payments,
    insurance,
    liabilities,
    credentials,
    accounts,
    goals,
  ]);

  const usageList = DISPLAY_ORDER.map((k) => usage[k]);
  const anyAtLimit = usageList.some((u) => u.atLimit);

  return {
    isTrialUser: isTrial,
    isPremium,
    usage,
    usageList,
    anyAtLimit,
  };
}
