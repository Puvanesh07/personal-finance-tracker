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

export function hasPremiumAccess(
  userDoc: UserSubscriptionDoc | null | undefined,
  authEmail?: string | null,
): boolean {
  if (!userDoc) return false;
  if (userDoc.premiumGranted === true) return true;
  if (userDoc.plan === 'lifetime') return true;

  const ownerEmail = import.meta.env.VITE_OWNER_EMAIL?.trim().toLowerCase() ?? '';
  const docEmail =
    typeof userDoc.email === 'string' ? userDoc.email.trim().toLowerCase() : '';
  const loginEmail = authEmail?.trim().toLowerCase() ?? '';
  if (ownerEmail && (docEmail === ownerEmail || loginEmail === ownerEmail)) {
    return true;
  }

  const expiresAt = toDate(userDoc.expiresAt);
  if (!expiresAt) return false;
  return expiresAt.getTime() > Date.now();
}

export function isTrialPlan(userDoc: UserSubscriptionDoc | null | undefined): boolean {
  return userDoc?.plan === 'trial';
}

export function isExpiredStatus(
  userDoc: UserSubscriptionDoc | null | undefined,
  authEmail?: string | null,
): boolean {
  return (
    userDoc?.subscriptionStatus === 'expired' || !hasPremiumAccess(userDoc, authEmail)
  );
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
