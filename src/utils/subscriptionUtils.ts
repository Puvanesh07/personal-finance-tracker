import type { UserSubscriptionDoc } from '../types/subscription';

export function toDate(
  value: UserSubscriptionDoc['expiresAt'] | undefined | null,
): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string') return new Date(value);
  if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate();
  }
  return null;
}

/** Hardcoded fallback so production builds still recognize the owner if env is missing. */
export const OWNER_EMAIL =
  import.meta.env.VITE_OWNER_EMAIL?.trim().toLowerCase() || 'puvanesh1964@gmail.com';

function isOwnerEmail(authEmail?: string | null, docEmail?: string | null): boolean {
  const login = authEmail?.trim().toLowerCase() ?? '';
  const doc = docEmail?.trim().toLowerCase() ?? '';
  return login === OWNER_EMAIL || doc === OWNER_EMAIL;
}

export function hasPremiumAccess(
  userDoc: UserSubscriptionDoc | null | undefined,
  authEmail?: string | null,
): boolean {
  // Owner always has full access — even before the Firestore profile loads.
  if (isOwnerEmail(authEmail, typeof userDoc?.email === 'string' ? userDoc.email : null)) {
    return true;
  }

  if (!userDoc) return false;
  if (userDoc.premiumGranted === true) return true;
  if (userDoc.plan === 'lifetime') return true;

  // Active trial or paid plan with a future expiry = full premium access
  const expiresAt = toDate(userDoc.expiresAt);
  if (!expiresAt) return false;
  if (userDoc.subscriptionStatus === 'expired') return false;
  return expiresAt.getTime() > Date.now();
}

export function isTrialPlan(userDoc: UserSubscriptionDoc | null | undefined): boolean {
  return userDoc?.plan === 'trial';
}

export function isExpiredStatus(
  userDoc: UserSubscriptionDoc | null | undefined,
  authEmail?: string | null,
): boolean {
  if (hasPremiumAccess(userDoc, authEmail)) return false;
  if (!userDoc) return false;
  if (userDoc.subscriptionStatus === 'expired') return true;
  const expiresAt = toDate(userDoc.expiresAt);
  if (expiresAt && expiresAt.getTime() <= Date.now() && userDoc.plan === 'trial') {
    return true;
  }
  return false;
}

export function getDaysRemaining(userDoc: UserSubscriptionDoc | null | undefined): number | null {
  if (!userDoc) return null;
  if (userDoc.plan === 'lifetime') return null;
  const expiresAt = toDate(userDoc.expiresAt);
  if (!expiresAt) return null;
  const diff = expiresAt.getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function getGraceDaysRemaining(
  userDoc: UserSubscriptionDoc | null | undefined,
): number | null {
  if (!userDoc) return null;
  const graceEnd = toDate(userDoc.gracePeriodEnd);
  if (!graceEnd) return null;
  const diff = graceEnd.getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function getTrialDaysRemaining(
  userDoc: UserSubscriptionDoc | null | undefined,
): number | null {
  if (!userDoc || userDoc.plan !== 'trial') return null;
  const trialEnd = toDate(userDoc.trialEnd);
  if (!trialEnd) return getDaysRemaining(userDoc);
  const diff = trialEnd.getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function canCreateTransactions(
  userDoc: UserSubscriptionDoc | null | undefined,
  authEmail?: string | null,
): boolean {
  if (!userDoc) return false;
  return hasPremiumAccess(userDoc, authEmail);
}

export function buildTrialFields(now = new Date()) {
  const trialStart = now;
  const trialEnd = new Date(now);
  trialEnd.setDate(trialEnd.getDate() + 7);
  const gracePeriodEnd = new Date(trialEnd);
  gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 30);

  return {
    plan: 'trial' as const,
    subscriptionStatus: 'active' as const,
    trialStart,
    trialEnd,
    expiresAt: trialEnd,
    gracePeriodEnd,
    paymentId: null,
    premiumGranted: false,
  };
}

export function formatPlanLabel(plan: UserSubscriptionDoc['plan'] | undefined): string {
  switch (plan) {
    case 'trial':
      return 'Free Trial';
    case 'monthly':
      return 'Monthly';
    case 'yearly':
      return 'Yearly';
    case 'lifetime':
      return 'Lifetime';
    default:
      return 'Unknown';
  }
}

let createTransactionsChecker: () => boolean = () => true;

export function setCreateTransactionsChecker(checker: () => boolean) {
  createTransactionsChecker = checker;
}

export function checkCanCreateTransactions(): boolean {
  return createTransactionsChecker();
}

// ─── Per-feature trial limit helpers ─────────────────────────────────────────

import type { TrialFeatureKey } from '../types/subscription';
import { TRIAL_FEATURE_LIMITS } from '../types/subscription';

/**
 * Returns true if the user is allowed to add one more record for `feature`.
 *
 * Rules:
 *  • Owner / premium-granted / paid plan → always allowed (no limit).
 *  • Active trial → allowed only if currentCount < TRIAL_FEATURE_LIMITS[feature].
 *  • Expired / no subscription → blocked (existing checkCanCreateTransactions handles this).
 */
export function canAddFeature(
  feature: TrialFeatureKey,
  currentCount: number,
  userDoc: UserSubscriptionDoc | null | undefined,
  authEmail?: string | null,
): boolean {
  // Premium users have no limit
  if (hasPremiumAccess(userDoc, authEmail)) {
    // But if they are on an active trial, apply the count limit
    if (!userDoc || userDoc.plan !== 'trial') return true;
  }
  if (!userDoc) return false;
  if (userDoc.plan !== 'trial') return true; // paid plan → unlimited

  const limit = TRIAL_FEATURE_LIMITS[feature];
  return currentCount < limit;
}

/**
 * Module-level checker injected from SubscriptionContext (same pattern as
 * checkCanCreateTransactions). Stores call `checkFeatureLimit(feature)`
 * which reads current counts from their own state and the registered checker.
 *
 * The checker is set via `setFeatureLimitChecker` from SubscriptionContext.
 */
let featureLimitChecker: (feature: TrialFeatureKey, currentCount: number) => boolean =
  () => true;

export function setFeatureLimitChecker(
  checker: (feature: TrialFeatureKey, currentCount: number) => boolean,
) {
  featureLimitChecker = checker;
}

/**
 * Called from store addX methods.  Returns true if the add is allowed.
 * Returns false (and the caller should bail out) when the trial limit is hit.
 */
export function checkFeatureLimit(
  feature: TrialFeatureKey,
  currentCount: number,
): boolean {
  return featureLimitChecker(feature, currentCount);
}

/** Human-readable trial-limit message for toast / UI copy. */
export function trialLimitMessage(feature: TrialFeatureKey): string {
  const limit = TRIAL_FEATURE_LIMITS[feature];
  const labels: Record<TrialFeatureKey, string> = {
    investments: 'investment',
    cashflows: 'cashflow entry',
    payments: 'payment',
    insurance: 'insurance policy',
    liabilities: 'liability',
    credentials: 'credential',
    accounts: 'account',
    agriculture: 'agriculture record',
    goals: 'goal',
    attendance: 'employee',
  };
  return `Trial limit reached: ${limit} ${labels[feature]}${limit === 1 ? '' : 's'} allowed during the free trial. Upgrade to add more.`;
}
