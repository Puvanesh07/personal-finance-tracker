// src/store/shared.ts
//
// Helpers shared by the per-module slices. Kept free of any import of the
// store hook itself, so slices can depend on it without a runtime cycle:
// anything that needs live store state receives `get` (the Zustand getter)
// explicitly, e.g. `makePersistence(get)`.
import { setDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';

import {
  checkFeatureLimit,
  checkCanCreateTransactions,
  trialLimitMessage,
} from '../utils/subscriptionUtils';
import { markDataDirty } from '../utils/dataVersion';
import type { TrialFeatureKey } from '../types/subscription';
import type {
  Account,
  CashflowEntry,
  Credential,
  Goal,
  GoalContribution,
  InsurancePayment,
  InsurancePolicy,
  Investment,
  Liability,
  NetWorthSnapshot,
  PaymentRecurrence,
  PendingPayment,
  SoldTrade,
  SipPlan,
  TrackedPayment,
} from '../types/investmentTypes';

import type { PortfolioState } from './types';
import type { SettingsRecord } from './portfolioSettings';
import {
  DEFAULT_ALLOCATION_TARGETS,
  DEFAULT_NOTION,
  DEFAULT_ESSENTIALS,
} from './portfolioSettings';
import {
  fetchSub,
  saveDoc as saveDocRaw,
  saveDocsAtomically as saveDocsAtomicallyRaw,
  settingsDocRef,
} from './portfolioPersistence';

// ── Tiny primitives ──────────────────────────────────────────────────────────

export const safeCompare = (a: string | undefined, b: string | undefined) =>
  (a || '').localeCompare(b || '');

export function clean<T extends object>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as T;
}

export const now = () => new Date().toISOString();

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Signed contribution of one cashflow entry to its linked account. */
export const cashflowDelta = (cf: CashflowEntry) =>
  cf.type === 'income' ? (cf.amount ?? 0) : -(cf.amount ?? 0);

/** Highest one-time data fix currently defined. Bump when adding a migration to
 *  runMigrations(), and never renumber existing entries. */
export const SCHEMA_VERSION = 3;

/** Premium frequency → the matching recurring-series cadence on a Bill Reminder. */
export const PREMIUM_RECURRENCE: Record<
  InsurancePolicy['premiumFrequency'],
  PaymentRecurrence
> = {
  monthly: 'monthly',
  quarterly: 'quarterly',
  'half-yearly': 'half_yearly',
  yearly: 'yearly',
};

/** Returns true and shows a toast when the user should be blocked from adding.
 *  Call at the top of every addX method that is subject to trial limits. */
export function blockIfLimited(feature: TrialFeatureKey, currentCount: number): boolean {
  // First: global expiry check (expired trial = block everything)
  if (!checkCanCreateTransactions()) {
    toast.error('Your trial has expired. Subscribe to add new records.');
    return true;
  }
  // Second: per-feature count limit for active trial users
  if (!checkFeatureLimit(feature, currentCount)) {
    toast.error(trialLimitMessage(feature));
    return true;
  }
  return false;
}

/** Build the derived transfer cashflow for a goal contribution. Deterministic
 *  id ⇒ re-saving overwrites the same doc, so edits never duplicate and a
 *  deleted contribution can be reversed by removing exactly this one entry. */
export function goalTransferCashflow(
  uid: string,
  contribution: { id: string; amount: number; date: string; accountId?: string; toAccountId?: string; note?: string },
): CashflowEntry {
  const t = now();
  return clean({
    id: `cf_goal_${contribution.id}`,
    type: 'transfer' as const,
    date: contribution.date,
    category: 'Goal Contribution',
    amount: contribution.amount,
    notes: contribution.note,
    accountId: contribution.accountId,
    toAccountId: contribution.toAccountId,
    createdAt: t,
    updatedAt: t,
    userId: uid,
  }) as CashflowEntry;
}

// ── Persistence shims ─────────────────────────────────────────────────────────
// The Firestore plumbing lives in portfolioPersistence.ts as a leaf module;
// these wrappers default to the store's cached encryption flag (which is what
// saves a per-write Firestore read). A slice builds them once via
// `makePersistence(get)` and then calls `saveDoc(uid, col, data)` exactly as the
// monolithic store did.

export function makePersistence(get: () => { encryptionEnabled: boolean }) {
  function saveDoc<
    T extends { id: string; userId?: string; createdAt?: string; updatedAt?: string },
  >(uid: string, col: string, data: T, forceEncrypt?: boolean): Promise<void> {
    return saveDocRaw(uid, col, data, forceEncrypt ?? get().encryptionEnabled);
  }
  function saveDocsAtomically(
    uid: string,
    writes: { col: string; data: object }[],
    deletes: { col: string; id: string }[] = [],
  ): Promise<void> {
    return saveDocsAtomicallyRaw(uid, writes, deletes, get().encryptionEnabled);
  }
  return { saveDoc, saveDocsAtomically };
}

// ── Settings / reload helpers ───────────────────────────────────────────────

/** Map the settings document onto the store fields that live inside it. Kept in
 *  one place so the first hydrate and a background refresh can never disagree. */
export function settingsPatch(settings: SettingsRecord): Partial<PortfolioState> {
  return {
    // Cache encryption flag in store — eliminates per-write Firestore read
    encryptionEnabled: settings.encryptionEnabled !== false,
    notion: settings.notion ?? DEFAULT_NOTION,
    essentials: settings.essentials ?? DEFAULT_ESSENTIALS,
    customCategories: settings.customCategories ?? { expense: [], income: [] },
    hiddenCategories: settings.hiddenCategories ?? { expense: [], income: [] },
    customSubcategories: settings.customSubcategories ?? {},
    allocationTargets: {
      ...DEFAULT_ALLOCATION_TARGETS,
      ...(settings.allocationTargets ?? {}),
    },
    _schemaVersion: Number(settings.schemaVersion ?? 0),
  };
}

/** Write the settings document and stamp the change, so a Notion config or
 *  custom category edited on one device reaches the others instead of living
 *  there until a full reload. */
export async function saveSettings(uid: string, patch: Record<string, unknown>) {
  // Settings are plain config (categories, Notion ids) — always stored unencrypted.
  await setDoc(settingsDocRef(uid), patch, { merge: true });
  markDataDirty(uid, 'settings');
}

/** Refetch a single collection and return the state patch that replaces it.
 *  This is what makes a background refresh cheap: only collections whose change
 *  stamp actually moved are read again. Returns null for collections handled
 *  elsewhere (settings/insights) or not currently loaded (lazy collections get
 *  fetched fresh by their own loader, so refreshing them here would defeat the
 *  lazy loading). */
export async function reloadCollectionPatch(
  uid: string,
  col: string,
  state: PortfolioState,
): Promise<{ patch: Partial<PortfolioState>; documents: number } | null> {
  switch (col) {
    case 'investments': {
      const items = await fetchSub<Investment>(uid, col);
      return {
        documents: items.length,
        patch: { investments: items.sort((a, b) => safeCompare(b.updatedAt, a.updatedAt)) },
      };
    }
    case 'liabilities': {
      const items = await fetchSub<Liability>(uid, col);
      return {
        documents: items.length,
        patch: { liabilities: items.sort((a, b) => safeCompare(b.updatedAt, a.updatedAt)) },
      };
    }
    case 'cashflows': {
      const items = await fetchSub<CashflowEntry>(uid, col);
      return {
        documents: items.length,
        patch: {
          cashflows: items.sort(
            (a, b) =>
              safeCompare(b.date, a.date) || safeCompare(b.updatedAt, a.updatedAt),
          ),
        },
      };
    }
    case 'goals': {
      const items = await fetchSub<Goal>(uid, col);
      return {
        documents: items.length,
        patch: { goals: items.sort((a, b) => safeCompare(b.updatedAt, a.updatedAt)) },
      };
    }
    case 'accounts': {
      const items = await fetchSub<Account>(uid, col);
      return {
        documents: items.length,
        patch: { accounts: items.sort((a, b) => safeCompare(b.createdAt, a.createdAt)) },
      };
    }
    case 'trackedPayments': {
      const items = await fetchSub<TrackedPayment>(uid, col);
      return {
        documents: items.length,
        patch: { trackedPayments: items.sort((a, b) => safeCompare(a.dueDate, b.dueDate)) },
      };
    }
    case 'soldTrades': {
      const items = await fetchSub<SoldTrade>(uid, col);
      return {
        documents: items.length,
        patch: { soldTrades: items.sort((a, b) => safeCompare(b.soldDate, a.soldDate)) },
      };
    }
    case 'insurancePolicies': {
      const items = await fetchSub<InsurancePolicy>(uid, col);
      return {
        documents: items.length,
        patch: {
          insurancePolicies: items.sort((a, b) => safeCompare(a.renewalDate, b.renewalDate)),
        },
      };
    }
    case 'networthSnapshots': {
      const items = await fetchSub<NetWorthSnapshot>(uid, col);
      return {
        documents: items.length,
        patch: {
          networthSnapshots: items.sort((a, b) => safeCompare(b.createdAt, a.createdAt)),
        },
      };
    }
    case 'sipPlans': {
      const items = await fetchSub<SipPlan>(uid, col);
      return {
        documents: items.length,
        patch: { sipPlans: items.sort((a, b) => safeCompare(a.createdAt, b.createdAt)) },
      };
    }
    // Lazy collections: only worth refreshing if the user already opened them.
    case 'goalContributions': {
      if (!state._goalContributionsLoaded) return null;
      const items = await fetchSub<GoalContribution>(uid, col);
      return {
        documents: items.length,
        patch: {
          goalContributions: items.sort((a, b) => safeCompare(b.date, a.date)),
        },
      };
    }
    case 'insurancePayments': {
      if (!state._insurancePaymentsLoaded) return null;
      const items = await fetchSub<InsurancePayment>(uid, col);
      return {
        documents: items.length,
        patch: {
          insurancePayments: items.sort((a, b) => safeCompare(b.paidAt, a.paidAt)),
        },
      };
    }
    case 'pendingPayments': {
      if (!state._pendingPaymentsLoaded) return null;
      const items = await fetchSub<PendingPayment>(uid, col);
      return {
        documents: items.length,
        patch: {
          pendingPayments: items.sort((a, b) =>
            safeCompare(a.expectedPaymentDate, b.expectedPaymentDate),
          ),
        },
      };
    }
    case 'credentials': {
      if (!state._credentialsLoaded) return null;
      const items = await fetchSub<Credential>(uid, col);
      return {
        documents: items.length,
        patch: { credentials: items.sort((a, b) => safeCompare(b.updatedAt, a.updatedAt)) },
      };
    }
    default:
      return null;
  }
}
