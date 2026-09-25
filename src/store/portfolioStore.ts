// src/store/portfolioStore.ts
import type {
  Account,
  CashflowEntry,
  Credential,
  EssentialsConfig,
  Goal,
  GoalContribution,
  InsightSnapshot,
  InsurancePolicy,
  InsurancePayment,
  Investment,
  Liability,
  PendingPayment,
  TrackedPayment,
  NetWorthSnapshot,
  NotionConfig,
  PaymentRecurrence,
  PortfolioSnapshot,
  SoldTrade,
} from '../types/investmentTypes';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  writeBatch,
} from 'firebase/firestore';

import {
  decryptDoc,
  encryptDoc,
  type FirestoreDoc,
} from '../services/encryptionService';

import { create } from 'zustand';
import { createId } from '../utils/id';
import { db } from '../services/firebase';
import { calculateNetWorth, calcLiveAccountBalances, getLiveBankTotal, IN_HAND_CASH_ID, IN_HAND_CASH_NAME, summarizePortfolio } from '../utils/calculations';
import { todayISO } from '../utils/dateUtils';
import { policyStatusOf } from '../utils/financialProfile';
import {
  nextDueDate,
  nextSeriesAmount,
  withinSeriesEnd,
} from '../utils/paymentTracker';
import {
  analyseAfterTransaction,
  analyseAfterPayment,
  analyseAfterInvestment,
} from '../services/financialEventEngine';
import {
  checkFeatureLimit,
  checkCanCreateTransactions,
  trialLimitMessage,
} from '../utils/subscriptionUtils';
import type { TrialFeatureKey } from '../types/subscription';
import toast from 'react-hot-toast';

/** Returns true and shows a toast when the user should be blocked from adding.
 *  Call at the top of every addX method that is subject to trial limits. */
function blockIfLimited(feature: TrialFeatureKey, currentCount: number): boolean {
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

const userCol = (uid: string, col: string) => collection(db, 'users', uid, col);
const userDoc = (uid: string, col: string, id: string) =>
  doc(db, 'users', uid, col, id);
const settingsDocRef = (uid: string) =>
  doc(db, 'users', uid, 'settings', 'config');

const safeCompare = (a: string | undefined, b: string | undefined) =>
  (a || '').localeCompare(b || '');

function clean<T extends object>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as T;
}

const now = () => new Date().toISOString();

async function fetchSub<T>(uid: string, col: string): Promise<T[]> {
  const snap = await getDocs(userCol(uid, col));
  return Promise.all(
    snap.docs.map((d) => decryptDoc<T>(uid, d.data() as FirestoreDoc)),
  );
}

/** saveDoc — accepts an optional precomputed encryption flag so we never hit
 *  Firestore for it on every write. Pass the store's encryptionEnabled field. */
async function saveDoc<
  T extends {
    id: string;
    userId?: string;
    createdAt?: string;
    updatedAt?: string;
  },
>(uid: string, col: string, data: T, forceEncrypt?: boolean): Promise<void> {
  // If forceEncrypt not supplied, use store's cached flag (avoids per-write Firestore read)
  const flag = forceEncrypt !== undefined ? forceEncrypt : usePortfolioStore.getState().encryptionEnabled;
  const payload = await encryptDoc(uid, data, flag);
  await setDoc(userDoc(uid, col, data.id), payload);
}

// ── Insurance ↔ Bill Reminder sync ───────────────────────────────────────
// Insurance is the single source of truth: every policy automatically owns
// one recurring Bill Reminder. Edits update only PENDING linked bills (paid
// history is never touched) and deleting a policy removes its future bills.

const PREMIUM_RECURRENCE: Record<
  InsurancePolicy['premiumFrequency'],
  PaymentRecurrence
> = {
  monthly: 'monthly',
  quarterly: 'quarterly',
  'half-yearly': 'half_yearly',
  yearly: 'yearly',
};

/** Create-or-update the pending Bill Reminder linked to an insurance policy.
 *  Idempotent — one linked pending bill per policy, so no duplicates. */
async function syncInsuranceBill(
  uid: string,
  get: () => { trackedPayments: TrackedPayment[] },
  policy: InsurancePolicy,
): Promise<void> {
  if (!policy.renewalDate || !(policy.premiumAmount > 0)) return;
  const recurrence = PREMIUM_RECURRENCE[policy.premiumFrequency] ?? 'yearly';
  const title = `Insurance Premium — ${policy.policyName || policy.provider || 'Policy'}`;
  const linked = get().trackedPayments.find(
    (p) =>
      p.insurancePolicyId === policy.id && p.status === 'pending',
  );
  if (linked) {
    const updated = clean({
      ...linked,
      title,
      paymentType: 'insurance' as const,
      amount: policy.premiumAmount,
      dueDate: policy.renewalDate,
      recurrence,
      endDate: policy.maturityDate,
      // A premium change re-anchors the escalation base for future bills.
      seriesStartDate: policy.renewalDate,
      seriesBaseAmount: policy.premiumAmount,
      notes: `Auto-synced from insurance policy ${policy.policyNumber || policy.id}`,
      insurancePolicyId: policy.id,
      updatedAt: now(),
    }) as TrackedPayment;
    await saveDoc(uid, 'trackedPayments', updated);
    usePortfolioStore.setState((s) => ({
      trackedPayments: s.trackedPayments
        .map((x) => (x.id === updated.id ? updated : x))
        .sort((a, b) => safeCompare(a.dueDate, b.dueDate)),
    }));
    return;
  }
  const t = now();
  const bill = clean({
    id: createId('tp'),
    title,
    paymentType: 'insurance' as const,
    amount: policy.premiumAmount,
    dueDate: policy.renewalDate,
    status: 'pending' as const,
    reminderDays: [1, 3, 7],
    recurrence,
    endDate: policy.maturityDate,
    seriesStartDate: policy.renewalDate,
    seriesIndex: 0,
    seriesBaseAmount: policy.premiumAmount,
    insurancePolicyId: policy.id,
    notes: `Auto-created from insurance policy ${policy.policyNumber || policy.id}`,
    createdAt: t,
    updatedAt: t,
    userId: uid,
  }) as TrackedPayment;
  await saveDoc(uid, 'trackedPayments', bill);
  usePortfolioStore.setState((s) => ({
    trackedPayments: [...s.trackedPayments, bill].sort((a, b) =>
      safeCompare(a.dueDate, b.dueDate),
    ),
  }));
}

/** Target asset-allocation percentages (macro buckets) persisted in the
 *  settings doc. `null` in state means "use DEFAULT_ALLOCATION_TARGETS". */
export type AllocationTargets = Record<
  'equity' | 'debt' | 'realEstate' | 'commodities' | 'cash',
  number
>;

export const DEFAULT_ALLOCATION_TARGETS: AllocationTargets = {
  equity: 55,
  debt: 20,
  realEstate: 10,
  commodities: 10,
  cash: 5,
};

export type SettingsRecord = {
  notion: NotionConfig;
  essentials?: EssentialsConfig;
  encryptionEnabled?: boolean;
  customCategories?: { expense: string[]; income: string[] };
  hiddenCategories?: { expense: string[]; income: string[] };
  customSubcategories?: Record<string, string[]>;
  allocationTargets?: AllocationTargets;
};

type PortfolioState = {
  uid: string | null;
  ready: boolean;
  /** Cached encryption flag — read once from settings on hydrate, used for all writes */
  encryptionEnabled: boolean;
  investments: Investment[];
  snapshots: PortfolioSnapshot[];
  liabilities: Liability[];
  pendingPayments: PendingPayment[];
  trackedPayments: TrackedPayment[];
  cashflows: CashflowEntry[];
  goals: Goal[];
  goalContributions: GoalContribution[];
  credentials: Credential[];
  networthSnapshots: NetWorthSnapshot[];
  latestInsight: InsightSnapshot | null;
  notion: NotionConfig;
  essentials: EssentialsConfig;
  accounts: Account[];
  soldTrades: SoldTrade[];
  insurancePolicies: InsurancePolicy[];
  insurancePayments: InsurancePayment[];
  sipPlans: any[];
  _lastSnapshotDate: string | null;

  /** Lazy-load flags — true once a collection has been fetched on demand */
  _goalContributionsLoaded: boolean;
  _insurancePaymentsLoaded: boolean;
  _pendingPaymentsLoaded: boolean;
  _credentialsLoaded: boolean;

  /** Lazy-load actions — call these from the relevant page on first mount */
  loadGoalContributions: () => Promise<void>;
  loadInsurancePayments: () => Promise<void>;
  loadPendingPayments: () => Promise<void>;
  loadCredentials: () => Promise<void>;

  /** User-defined category lists stored in Firestore, keyed by type */
  customCategories: { expense: string[]; income: string[] };
  /** Categories the user has hidden (stored in Firestore) */
  hiddenCategories: { expense: string[]; income: string[] };
  /** User-created subcategories, keyed by parent category (Agriculture → […]) */
  customSubcategories: Record<string, string[]>;

  addCustomCategory: (type: 'expense' | 'income', name: string) => Promise<void>;
  removeCustomCategory: (type: 'expense' | 'income', name: string) => Promise<void>;
  toggleHiddenCategory: (type: 'expense' | 'income', name: string) => Promise<void>;
  addCustomSubcategory: (category: string, name: string) => Promise<void>;
  removeCustomSubcategory: (category: string, name: string) => Promise<void>;

  hydrate: (uid: string, opts?: { force?: boolean }) => Promise<void>;

  /** One-time cleanup: remove bond interest/maturity entries a previous build
   *  auto-posted to Cashflow, and reverse the account credits they created.
   *  Bond interest is now tracked only inside the Investments section. */
  cleanupLegacyBondCashflows: () => Promise<void>;

  addInvestment: (
    investment: Omit<Investment, 'id' | 'createdAt' | 'updatedAt'>,
  ) => Promise<void>;
  importInvestments: (
    drafts: any[],
  ) => Promise<{ added: number; updated: number; skipped: number }>;
  updateInvestment: (id: string, patch: Partial<Investment>) => Promise<void>;
  deleteInvestment: (id: string) => Promise<void>;

  addLiability: (
    liability: Omit<Liability, 'id' | 'createdAt' | 'updatedAt'>,
  ) => Promise<void>;
  updateLiability: (id: string, patch: Partial<Liability>) => Promise<void>;
  deleteLiability: (id: string) => Promise<void>;

  addPendingPayment: (
    payment: Omit<
      PendingPayment,
      'id' | 'createdAt' | 'updatedAt' | 'userId' | 'status' | 'receivedAt'
    >,
  ) => Promise<void>;
  updatePendingPayment: (
    id: string,
    patch: Partial<PendingPayment>,
  ) => Promise<void>;
  deletePendingPayment: (id: string) => Promise<void>;
  markPendingPaymentReceived: (id: string) => Promise<void>;

  addTrackedPayment: (
    payment: Omit<
      TrackedPayment,
      'id' | 'createdAt' | 'updatedAt' | 'userId' | 'status' | 'paidAt'
    >,
  ) => Promise<void>;
  updateTrackedPayment: (
    id: string,
    patch: Partial<TrackedPayment>,
  ) => Promise<void>;
  deleteTrackedPayment: (id: string) => Promise<void>;
  markTrackedPaymentPaid: (id: string) => Promise<void>;

  addCashflow: (
    entry: Omit<CashflowEntry, 'id' | 'createdAt' | 'updatedAt'>,
  ) => Promise<void>;
  updateCashflow: (id: string, patch: Partial<CashflowEntry>) => Promise<void>;
  deleteCashflow: (id: string) => Promise<void>;
  /** Atomic bulk delete — one state update so totals/charts refresh once. */
  deleteCashflows: (ids: string[]) => Promise<void>;

  addGoal: (
    goal: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>,
  ) => Promise<void>;
  updateGoal: (id: string, patch: Partial<Goal>) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;

  addGoalContribution: (
    contribution: Omit<
      GoalContribution,
      'id' | 'createdAt' | 'updatedAt' | 'userId'
    >,
  ) => Promise<void>;
  deleteGoalContribution: (id: string) => Promise<void>;

  addCredential: (
    credential: Omit<Credential, 'id' | 'createdAt' | 'updatedAt' | 'userId'>,
  ) => Promise<void>;
  updateCredential: (id: string, patch: Partial<Credential>) => Promise<void>;
  deleteCredential: (id: string) => Promise<void>;

  addAccount: (
    account: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>,
  ) => Promise<void>;
  updateAccount: (id: string, patch: Partial<Account>) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  /** Set the built-in "Cash in Hand" balance — one editable figure, no account
   *  form. It is stored as an ordinary account record with a fixed id so every
   *  balance consumer (Net Worth, Dashboard, Reports, AI) picks it up. */
  setInHandAmount: (amount: number) => Promise<void>;

  addSoldTrade: (
    trade: Omit<
      SoldTrade,
      'id' | 'createdAt' | 'updatedAt' | 'userId' | 'profit' | 'profitPct'
    >,
  ) => Promise<void>;
  updateSoldTrade: (id: string, patch: Partial<SoldTrade>) => Promise<void>;
  deleteSoldTrade: (id: string) => Promise<void>;

  addInsurancePolicy: (
    policy: Omit<InsurancePolicy, 'id' | 'createdAt' | 'updatedAt' | 'userId'>,
  ) => Promise<void>;
  updateInsurancePolicy: (
    id: string,
    patch: Partial<InsurancePolicy>,
  ) => Promise<void>;
  deleteInsurancePolicy: (id: string) => Promise<void>;
  addInsurancePayment: (
    payment: Omit<
      InsurancePayment,
      'id' | 'createdAt' | 'updatedAt' | 'userId'
    >,
  ) => Promise<void>;
  deleteInsurancePayment: (id: string) => Promise<void>;

  addSipInstrument: (instrument: {
    name: string;
    percentage: number;
    fromAsset?: boolean;
  }) => Promise<void>;
  updateSipInstrument: (id: string, patch: any) => Promise<void>;
  deleteSipInstrument: (id: string) => Promise<void>;
  upsertSipBudget: (budget: number) => Promise<string>;
  deleteSipBudget: () => Promise<void>;

  clearAllData: () => Promise<void>;
  resetSession: () => void;
  setNotionConfig: (patch: Partial<NotionConfig>) => Promise<void>;
  setEssentialsConfig: (patch: Partial<EssentialsConfig>) => Promise<void>;
  allocationTargets: AllocationTargets;
  setAllocationTargets: (targets: AllocationTargets) => Promise<void>;
  recordSnapshotIfNeeded: () => Promise<void>;
  recordSnapshotNow: () => Promise<void>;
  takeNetWorthSnapshot: (label?: string) => Promise<void>;
  saveInsightSnapshot: (
    insight: Omit<InsightSnapshot, 'id' | 'userId' | 'createdAt'>,
  ) => Promise<void>;
};

const DEFAULT_NOTION: NotionConfig = { enabled: false };
const DEFAULT_ESSENTIALS: EssentialsConfig = {};

export const usePortfolioStore = create<PortfolioState>((set, get) => ({
  uid: null,
  ready: false,
  encryptionEnabled: true, // default ON; updated from settings on hydrate
  investments: [],
  snapshots: [],
  liabilities: [],
  pendingPayments: [],
  trackedPayments: [],
  cashflows: [],
  goals: [],
  goalContributions: [],
  credentials: [],
  networthSnapshots: [],
  latestInsight: null,
  notion: DEFAULT_NOTION,
  essentials: DEFAULT_ESSENTIALS,
  allocationTargets: DEFAULT_ALLOCATION_TARGETS,
  accounts: [],
  soldTrades: [],
  insurancePolicies: [],
  insurancePayments: [],
  sipPlans: [],
  _lastSnapshotDate: null,
  customCategories: { expense: [], income: [] },
  hiddenCategories: { expense: [], income: [] },
  customSubcategories: {},
  _goalContributionsLoaded: false,
  _insurancePaymentsLoaded: false,
  _pendingPaymentsLoaded: false,
  _credentialsLoaded: false,

  loadGoalContributions: async () => {
    const { uid, _goalContributionsLoaded } = get();
    if (!uid || _goalContributionsLoaded) return;
    const items = await fetchSub<GoalContribution>(uid, 'goalContributions');
    set({ goalContributions: items.sort((a, b) => safeCompare(b.date, a.date)), _goalContributionsLoaded: true });
  },
  loadInsurancePayments: async () => {
    const { uid, _insurancePaymentsLoaded } = get();
    if (!uid || _insurancePaymentsLoaded) return;
    const items = await fetchSub<InsurancePayment>(uid, 'insurancePayments');
    set({ insurancePayments: items.sort((a, b) => safeCompare(b.paidAt, a.paidAt)), _insurancePaymentsLoaded: true });
  },
  loadPendingPayments: async () => {
    const { uid, _pendingPaymentsLoaded } = get();
    if (!uid || _pendingPaymentsLoaded) return;
    const items = await fetchSub<PendingPayment>(uid, 'pendingPayments');
    set({ pendingPayments: items.sort((a, b) => safeCompare(a.expectedPaymentDate, b.expectedPaymentDate)), _pendingPaymentsLoaded: true });
  },
  loadCredentials: async () => {
    const { uid, _credentialsLoaded } = get();
    if (!uid || _credentialsLoaded) return;
    const items = await fetchSub<Credential>(uid, 'credentials');
    set({ credentials: items.sort((a, b) => safeCompare(b.updatedAt, a.updatedAt)), _credentialsLoaded: true });
  },

  hydrate: async (uid, opts) => {
    const { uid: currentUid, ready } = get();
    if (!opts?.force && currentUid === uid && ready) return;

    set({ uid });
    try {

      // Phase 1: dashboard-critical only — show UI as soon as this completes
      const [
        investments,
        liabilities,
        cashflows,
        goals,
        accounts,
        pendingPayments,
      ] = await Promise.all([
        fetchSub<Investment>(uid, 'investments'),
        fetchSub<Liability>(uid, 'liabilities'),
        fetchSub<CashflowEntry>(uid, 'cashflows'),
        fetchSub<Goal>(uid, 'goals'),
        fetchSub<Account>(uid, 'accounts'),
        fetchSub<PendingPayment>(uid, 'pendingPayments'),
      ]);

      const settingsSnap = await getDoc(settingsDocRef(uid));
      const settings: SettingsRecord = settingsSnap.exists()
        ? (settingsSnap.data() as SettingsRecord)
        : { notion: DEFAULT_NOTION, essentials: DEFAULT_ESSENTIALS };

      // Cache encryption flag in store — eliminates per-write Firestore read
      const encryptionEnabled = settings.encryptionEnabled !== false;

      set({
        ready: true,
        encryptionEnabled,
        investments: investments.sort((a, b) =>
          safeCompare(b.updatedAt, a.updatedAt),
        ),
        liabilities: liabilities.sort((a, b) =>
          safeCompare(b.updatedAt, a.updatedAt),
        ),
        cashflows: cashflows.sort(
          (a, b) =>
            safeCompare(b.date, a.date) ||
            safeCompare(b.updatedAt, a.updatedAt),
        ),
        goals: goals.sort((a, b) => safeCompare(b.updatedAt, a.updatedAt)),
        notion: settings.notion ?? DEFAULT_NOTION,
        essentials: settings.essentials ?? DEFAULT_ESSENTIALS,
        customCategories: settings.customCategories ?? { expense: [], income: [] },
        hiddenCategories: settings.hiddenCategories ?? { expense: [], income: [] },
        customSubcategories: settings.customSubcategories ?? {},
        allocationTargets: { ...DEFAULT_ALLOCATION_TARGETS, ...(settings.allocationTargets ?? {}) },
        accounts: accounts.sort((a, b) =>
          safeCompare(b.createdAt, a.createdAt),
        ),
        pendingPayments: pendingPayments.sort((a, b) =>
          safeCompare(a.expectedPaymentDate, b.expectedPaymentDate),
        ),
        _pendingPaymentsLoaded: true,
      });

      // Auto-snapshot removed: GrowthChart now uses networthSnapshots (manual snapshots).
      // Investment edits no longer trigger a daily write to `snapshots`.

      // Remove any bond interest a previous build auto-posted to Cashflow.
      void get()
        .cleanupLegacyBondCashflows()
        .catch((err) =>
          console.error('[PortfolioStore] bond cashflow cleanup failed:', err),
        );

      const loadPhase1b = async () => {
        const [trackedPayments, soldTrades, insurancePolicies] =
          await Promise.all([
            fetchSub<TrackedPayment>(uid, 'trackedPayments'),
            fetchSub<SoldTrade>(uid, 'soldTrades'),
            fetchSub<InsurancePolicy>(uid, 'insurancePolicies'),
          ]);
        set({
          trackedPayments: trackedPayments.sort((a, b) =>
            safeCompare(a.dueDate, b.dueDate),
          ),
          soldTrades: soldTrades.sort((a, b) =>
            safeCompare(b.soldDate, a.soldDate),
          ),
          insurancePolicies: insurancePolicies.sort((a, b) =>
            safeCompare(a.renewalDate, b.renewalDate),
          ),
        });

        // ── Backfill: policies saved before auto-sync get their linked bill ──
        // Idempotent — any policy that already owns a pending bill is skipped,
        // so this writes once per legacy policy and is a no-op afterwards.
        // Lapsed (renewal already past) policies are left alone so we never
        // revive a cancelled policy or raise a phantom "overdue" bill.
        const today = todayISO();
        for (const pol of insurancePolicies) {
          if (!pol.renewalDate || !(pol.premiumAmount > 0)) continue;
          if (policyStatusOf(pol.renewalDate, today) === 'expired') continue;
          const hasPending = trackedPayments.some(
            (p) => p.insurancePolicyId === pol.id && p.status === 'pending',
          );
          if (hasPending) continue;
          await syncInsuranceBill(uid, get, pol);
        }
      };

      const loadPhase2 = async () => {
        const [
          networthSnapshots,
          sipPlans,
        ] = await Promise.all([
          fetchSub<NetWorthSnapshot>(uid, 'networthSnapshots'),
          fetchSub<any>(uid, 'sipPlans'),
        ]);

        // Only fetch the single latest insight — no need for the full collection
        const latestInsightSnap = await getDocs(
          query(userCol(uid, 'insights'), orderBy('createdAt', 'desc'), limit(1)),
        );
        const latestInsight = latestInsightSnap.empty
          ? null
          : await decryptDoc<InsightSnapshot>(uid, latestInsightSnap.docs[0].data() as FirestoreDoc)
              .then((d) => d)
              .catch(() => null);

        set({
          networthSnapshots: networthSnapshots.sort((a, b) =>
            safeCompare(b.createdAt, a.createdAt),
          ),
          latestInsight,
          sipPlans: sipPlans.sort((a: any, b: any) =>
            safeCompare(a.createdAt, b.createdAt),
          ),
        });
      };

      if (opts?.force) {
        // Import / restore: wait until every collection is in memory including lazy ones
        await Promise.all([
          loadPhase1b().catch((err) =>
            console.error('[PortfolioStore] phase 1b hydrate failed:', err),
          ),
          loadPhase2().catch((err) =>
            console.error('[PortfolioStore] secondary hydrate failed:', err),
          ),
        ]);
        // Force-load lazy collections too so restored data is immediately visible
        await Promise.all([
          get().loadGoalContributions().catch(() => {}),
          get().loadInsurancePayments().catch(() => {}),
          get().loadPendingPayments().catch(() => {}),
          get().loadCredentials().catch(() => {}),
        ]);
      } else {
        // Phase 1b: other dashboard widgets — background
        void loadPhase1b().catch((err) =>
          console.error('[PortfolioStore] phase 1b hydrate failed:', err),
        );

        // Phase 2: secondary collections — load in background without blocking UI
        void loadPhase2().catch((err) =>
          console.error('[PortfolioStore] secondary hydrate failed:', err),
        );
      }
    } catch (err) {
      console.error('[PortfolioStore] hydrate failed:', err);
      set({ ready: true });
    }
  },

  cleanupLegacyBondCashflows: async () => {
    const uid = get().uid;
    if (!uid) return;

    // Only the deterministic ids this feature ever wrote — never user entries.
    const legacy = get().cashflows.filter(
      (c) => c.id.startsWith('cf_bondint_') || c.id.startsWith('cf_bondmat_'),
    );
    if (legacy.length === 0) return;

    const t = now();
    const legacyIds = new Set(legacy.map((c) => c.id));

    // Reverse the balance credit each legacy entry applied to its account.
    const deltas = new Map<string, number>();
    for (const cf of legacy) {
      if (!cf.accountId) continue;
      deltas.set(
        cf.accountId,
        (deltas.get(cf.accountId) ?? 0) - (cf.amount ?? 0),
      );
    }

    // Delete the auto-posted entries from Firestore.
    await Promise.all(
      legacy.map((cf) =>
        deleteDoc(userDoc(uid, 'cashflows', cf.id)).catch((err) =>
          console.error(
            '[PortfolioStore] legacy bond cashflow delete failed:',
            err,
          ),
        ),
      ),
    );

    // Persist the reversed account balances.
    const touchedAccounts = new Map<string, Account>();
    for (const [accId, delta] of deltas) {
      const base = get().accounts.find((a) => a.id === accId);
      if (!base) continue;
      const next = clean({
        ...base,
        balance: Math.round(((base.balance ?? 0) + delta) * 100) / 100,
        updatedAt: t,
      }) as Account;
      touchedAccounts.set(accId, next);
      await saveDoc(uid, 'accounts', next);
    }

    set((s) => ({
      cashflows: s.cashflows.filter((c) => !legacyIds.has(c.id)),
      accounts: s.accounts.map((a) => touchedAccounts.get(a.id) ?? a),
    }));
  },

  addInvestment: async (investment) => {
    const uid = get().uid;
    if (!uid) return;
    if (blockIfLimited('investments', get().investments.length)) return;
    const t = now();
    const withMeta = clean({
      ...investment,
      id: createId('inv'),
      createdAt: t,
      updatedAt: t,
      userId: uid,
    }) as Investment;
    await saveDoc(uid, 'investments', withMeta);
    set((s) => ({ investments: [withMeta, ...s.investments] }));
    void analyseAfterInvestment(withMeta);
  },

  importInvestments: async (drafts) => {
    const uid = get().uid;
    if (!uid) return { added: 0, updated: 0, skipped: 0 };
    const existing = get().investments;
    let added = 0,
      updated = 0,
      skipped = 0;
    const t = now();
    const batch = writeBatch(db);
    const newDocs: Investment[] = [];

    const updatedDocs: Investment[] = [];

    for (const draft of drafts) {
      const match = existing.find(
        (inv) =>
          inv.name === draft.name &&
          inv.type === draft.type &&
          inv.platform === draft.platform,
      );
      if (match) {
        const hasChanged =
          ('quantity' in draft && draft.quantity !== (match as any).quantity) ||
          ('units' in draft && draft.units !== (match as any).units) ||
          ('buyPrice' in draft && draft.buyPrice !== (match as any).buyPrice) ||
          ('investedAmount' in draft &&
            draft.investedAmount !== (match as any).investedAmount) ||
          ('currentPrice' in draft &&
            draft.currentPrice !== (match as any).currentPrice) ||
          ('nav' in draft && draft.nav !== (match as any).nav);
        if (hasChanged) {
          const mergedDoc = clean({
            ...match,
            ...draft,
            updatedAt: t,
          }) as Investment;
          const payload = await encryptDoc(uid, mergedDoc);
          await setDoc(userDoc(uid, 'investments', match.id), payload);
          updatedDocs.push(mergedDoc);
          updated++;
        } else skipped++;
      } else {
        const withMeta = clean({
          ...draft,
          id: createId('inv'),
          createdAt: t,
          updatedAt: t,
          userId: uid,
        }) as Investment;
        const payload = await encryptDoc(uid, withMeta);
        batch.set(userDoc(uid, 'investments', withMeta.id), payload);
        newDocs.push(withMeta);
        added++;
      }
    }
    if (newDocs.length > 0) {
      await batch.commit();
    }
    if (newDocs.length > 0 || updatedDocs.length > 0) {
      set((s) => {
        const updatedIds = new Set(updatedDocs.map((d) => d.id));
        const merged = s.investments.map((inv) =>
          updatedIds.has(inv.id)
            ? updatedDocs.find((d) => d.id === inv.id)!
            : inv,
        );
        return { investments: [...newDocs, ...merged] };
      });
    }
    return { added, updated, skipped };
  },

  updateInvestment: async (id, patch) => {
    const uid = get().uid;
    if (!uid) return;
    const existing = get().investments.find((x) => x.id === id);
    if (!existing) return;
    const updated = clean({
      ...existing,
      ...patch,
      id,
      updatedAt: now(),
    }) as Investment;
    await saveDoc(uid, 'investments', updated);
    set((s) => ({
      investments: s.investments.map((x) => (x.id === id ? updated : x)),
    }));
  },

  deleteInvestment: async (id) => {
    const uid = get().uid;
    if (!uid) return;
    await deleteDoc(userDoc(uid, 'investments', id));
    set((s) => ({ investments: s.investments.filter((x) => x.id !== id) }));
  },

  addLiability: async (liability) => {
    const uid = get().uid;
    if (!uid) return;
    if (blockIfLimited('liabilities', get().liabilities.length)) return;
    const t = now();
    const withMeta = clean({
      ...(liability as any),
      id: createId('lia'),
      createdAt: t,
      updatedAt: t,
      userId: uid,
    }) as Liability;
    await saveDoc(uid, 'liabilities', withMeta);
    set((s) => ({ liabilities: [withMeta, ...s.liabilities] }));
  },

  updateLiability: async (id, patch) => {
    const uid = get().uid;
    if (!uid) return;
    const existing = get().liabilities.find((x) => x.id === id);
    if (!existing) return;
    const updated = clean({
      ...existing,
      ...(patch as any),
      id,
      updatedAt: now(),
    }) as Liability;
    await saveDoc(uid, 'liabilities', updated);
    set((s) => ({
      liabilities: s.liabilities.map((x) => (x.id === id ? updated : x)),
    }));
  },

  deleteLiability: async (id) => {
    const uid = get().uid;
    if (!uid) return;
    await deleteDoc(userDoc(uid, 'liabilities', id));
    set((s) => ({ liabilities: s.liabilities.filter((x) => x.id !== id) }));
  },

  addPendingPayment: async (payment) => {
    const uid = get().uid;
    if (!uid) return;
    if (blockIfLimited('payments', get().pendingPayments.length + get().trackedPayments.length)) return;
    const t = now();
    const withMeta = clean({
      ...payment,
      id: createId('pp'),
      status: 'pending' as const,
      createdAt: t,
      updatedAt: t,
      userId: uid,
    }) as PendingPayment;
    await saveDoc(uid, 'pendingPayments', withMeta);
    set((s) => ({
      pendingPayments: [withMeta, ...s.pendingPayments].sort((a, b) =>
        safeCompare(a.expectedPaymentDate, b.expectedPaymentDate),
      ),
    }));
  },

  updatePendingPayment: async (id, patch) => {
    const uid = get().uid;
    if (!uid) return;
    const existing = get().pendingPayments.find((x) => x.id === id);
    if (!existing) return;
    const updated = clean({
      ...existing,
      ...(patch as Partial<PendingPayment>),
      id,
      updatedAt: now(),
    }) as PendingPayment;
    await saveDoc(uid, 'pendingPayments', updated);

    set((s) => ({
      pendingPayments: s.pendingPayments
        .map((x) => (x.id === id ? updated : x))
        .sort((a, b) =>
          safeCompare(a.expectedPaymentDate, b.expectedPaymentDate),
        ),
    }));
  },

  deletePendingPayment: async (id) => {
    const uid = get().uid;
    if (!uid) return;
    await deleteDoc(userDoc(uid, 'pendingPayments', id));
    set((s) => ({
      pendingPayments: s.pendingPayments.filter((x) => x.id !== id),
    }));
  },

  markPendingPaymentReceived: async (id) => {
    const uid = get().uid;
    if (!uid) return;
    const existing = get().pendingPayments.find((x) => x.id === id);
    if (!existing) return;
    if (existing.status === 'received') return;

    const receivedAt = todayISO();
    const updated = clean({
      ...existing,
      status: 'received' as const,
      receivedAt,
      updatedAt: now(),
    }) as PendingPayment;
    await saveDoc(uid, 'pendingPayments', updated);

    // ── Also write a cashflow income entry so it appears in Cashflow ────
    const cfId = `cf_receivable_${existing.id}`;
    const cashflowItem = clean({
      type: 'income' as const,
      date: receivedAt,
      category: `Receivable — ${existing.buyerName}`,
      amount: existing.amount,
      notes: existing.itemDescription
        ? `${existing.itemDescription}${existing.notes ? ` · ${existing.notes}` : ''}`
        : existing.notes,
      id: cfId,
      createdAt: now(),
      updatedAt: now(),
      userId: uid,
    }) as import('../types/investmentTypes').CashflowEntry;
    // Only add if not already present (idempotent)
    const alreadyInCF = get().cashflows.some((c) => c.id === cfId);
    if (!alreadyInCF) {
      await saveDoc(uid, 'cashflows', cashflowItem);
    }

    set((s) => ({
      pendingPayments: s.pendingPayments
        .map((x) => (x.id === id ? updated : x))
        .sort((a, b) => safeCompare(a.expectedPaymentDate, b.expectedPaymentDate)),
      cashflows: alreadyInCF
        ? s.cashflows
        : [cashflowItem, ...s.cashflows].sort((a, b) => safeCompare(b.date, a.date)),
    }));
  },

  addTrackedPayment: async (payment) => {
    const uid = get().uid;
    if (!uid) return;
    if (blockIfLimited('payments', get().pendingPayments.length + get().trackedPayments.length)) return;
    const t = now();
    const recurring = (payment.recurrence ?? 'none') !== 'none';
    const withMeta = clean({
      ...payment,
      reminderDays: payment.reminderDays?.length
        ? payment.reminderDays
        : [1, 3, 7],
      recurrence: payment.recurrence ?? 'none',
      // Anchor a new recurring series at its first bill so later amounts
      // escalate from the starting amount, never from drifted values.
      ...(recurring
        ? {
            seriesStartDate: payment.dueDate,
            seriesIndex: 0,
            seriesBaseAmount: payment.amount,
          }
        : {}),
      id: createId('tp'),
      status: 'pending' as const,
      createdAt: t,
      updatedAt: t,
      userId: uid,
    }) as TrackedPayment;
    await saveDoc(uid, 'trackedPayments', withMeta);
    set((s) => ({
      trackedPayments: [...s.trackedPayments, withMeta].sort((a, b) =>
        safeCompare(a.dueDate, b.dueDate),
      ),
    }));
  },

  updateTrackedPayment: async (id, patch) => {
    const uid = get().uid;
    if (!uid) return;
    const existing = get().trackedPayments.find((x) => x.id === id);
    if (!existing) return;
    let updated = clean({
      ...existing,
      ...(patch as Partial<TrackedPayment>),
      id,
      updatedAt: now(),
    }) as TrackedPayment;
    // Editing the FIRST bill of a series re-anchors the escalation base;
    // already-created historical bills are separate docs and stay untouched.
    if (
      updated.recurrence !== 'none' &&
      (updated.seriesIndex ?? 0) === 0
    ) {
      updated = clean({
        ...updated,
        seriesStartDate: updated.dueDate,
        seriesBaseAmount: updated.amount,
      }) as TrackedPayment;
    }
    await saveDoc(uid, 'trackedPayments', updated);
    set((s) => ({
      trackedPayments: s.trackedPayments
        .map((x) => (x.id === id ? updated : x))
        .sort((a, b) => safeCompare(a.dueDate, b.dueDate)),
    }));
  },

  deleteTrackedPayment: async (id) => {
    const uid = get().uid;
    if (!uid) return;
    await deleteDoc(userDoc(uid, 'trackedPayments', id));
    set((s) => ({
      trackedPayments: s.trackedPayments.filter((x) => x.id !== id),
    }));
  },

  markTrackedPaymentPaid: async (id) => {
    const uid = get().uid;
    if (!uid) return;
    const existing = get().trackedPayments.find((x) => x.id === id);
    if (!existing) return;
    const paidAt = todayISO();
    const updated = clean({
      ...existing,
      status: 'paid' as const,
      paidAt,
      updatedAt: now(),
    }) as TrackedPayment;
    await saveDoc(uid, 'trackedPayments', updated);

    // ── Also write a cashflow expense entry so it appears in Cashflow ────
    const cfId = `cf_payment_${existing.id}`;
    const cashflowItem = clean({
      type: 'expense' as const,
      date: paidAt,
      category: existing.title || existing.paymentType || 'Payment',
      amount: existing.amount,
      notes: existing.notes,
      id: cfId,
      createdAt: now(),
      updatedAt: now(),
      userId: uid,
    }) as import('../types/investmentTypes').CashflowEntry;
    // Only add if not already present (idempotent)
    const alreadyInCF = get().cashflows.some((c) => c.id === cfId);
    if (!alreadyInCF) {
      await saveDoc(uid, 'cashflows', cashflowItem);
    }

    const nextDate =
      existing.recurrence !== 'none'
        ? nextDueDate(existing.dueDate, existing.recurrence)
        : null;
    // Stop generating once the series end date is reached.
    const nextIndex = (existing.seriesIndex ?? 0) + 1;
    const canGenerate =
      nextDate !== null && withinSeriesEnd(existing.endDate, nextDate);

    // ── Insurance-linked bill paid → advance the policy (source of truth) ──
    let policyPatch: Partial<InsurancePolicy> | null = null;
    let policyIdToSync: string | null = null;
    let premiumPayment: InsurancePayment | null = null;
    if (existing.insurancePolicyId) {
      const pol = get().insurancePolicies.find(
        (p) => p.id === existing.insurancePolicyId,
      );
      if (pol) {
        const recurrence = PREMIUM_RECURRENCE[pol.premiumFrequency] ?? 'yearly';
        let renewal = pol.renewalDate;
        // Advance renewalDate past the paid bill (handles missed/edited bills).
        for (let i = 0; i < 400 && renewal <= existing.dueDate; i++) {
          const nxt = nextDueDate(renewal, recurrence);
          if (!nxt) break;
          renewal = nxt;
        }
        policyPatch = { renewalDate: renewal, lastPaymentDate: paidAt };
        policyIdToSync = pol.id;

        // ── Mirror it into the policy's Payment History too, so "mark paid" in
        //    Bill Reminder is visible on the Insurance side. The bill id is the
        //    unique reference: if the premium was already recorded from the
        //    Insurance page (addInsurancePayment settles the bill there), this
        //    is skipped and no second payment row is created. ──
        // Payments are lazy-loaded, so make sure the dedupe check sees them all.
        await get().loadInsurancePayments();
        const alreadyLogged = get().insurancePayments.some(
          (p) => p.trackedPaymentId === existing.id,
        );
        if (!alreadyLogged) {
          premiumPayment = clean({
            id: createId('inspay'),
            policyId: pol.id,
            amount: existing.amount,
            paidAt,
            note: 'Marked paid from Bill Reminders',
            trackedPaymentId: existing.id,
            createdAt: now(),
            updatedAt: now(),
            userId: uid,
          }) as InsurancePayment;
          await saveDoc(uid, 'insurancePayments', premiumPayment);
        }
      }
    }

    const nextPayments: TrackedPayment[] = [];
    if (nextDate && canGenerate) {
      const t = now();
      const next = clean({
        title: existing.title,
        paymentType: existing.paymentType,
        amount: nextSeriesAmount(existing, nextDate, nextIndex),
        dueDate: nextDate,
        reminderDays: existing.reminderDays,
        recurrence: existing.recurrence,
        endDate: existing.endDate,
        increaseAmount: existing.increaseAmount,
        increaseEvery: existing.increaseEvery,
        seriesStartDate: existing.seriesStartDate ?? existing.dueDate,
        seriesIndex: nextIndex,
        seriesBaseAmount: existing.seriesBaseAmount ?? existing.amount,
        insurancePolicyId: existing.insurancePolicyId,
        notes: existing.notes,
        id: createId('tp'),
        status: 'pending' as const,
        createdAt: t,
        updatedAt: t,
        userId: uid,
      }) as TrackedPayment;
      await saveDoc(uid, 'trackedPayments', next);
      nextPayments.push(next);
    }

    set((s) => ({
      trackedPayments: s.trackedPayments
        .map((x) => (x.id === id ? updated : x))
        .concat(nextPayments)
        .sort((a, b) => safeCompare(a.dueDate, b.dueDate)),
      cashflows: alreadyInCF
        ? s.cashflows
        : [cashflowItem, ...s.cashflows].sort((a, b) => safeCompare(b.date, a.date)),
      // Mirror of the paid bill into Insurance Payment History (if any).
      insurancePayments: premiumPayment
        ? [premiumPayment, ...s.insurancePayments].sort((a, b) =>
            safeCompare(b.paidAt, a.paidAt),
          )
        : s.insurancePayments,
    }));

    // Persist the advanced policy and re-sync its next premium bill.
    if (policyIdToSync && policyPatch) {
      await get().updateInsurancePolicy(policyIdToSync, policyPatch);
    }

    void analyseAfterPayment(existing);
  },

  addCashflow: async (entry) => {
    const uid = get().uid;
    if (!uid) return;
    if (blockIfLimited('cashflows', get().cashflows.length)) return;
    const t = now();
    const withMeta = clean({
      ...entry,
      id: createId('cf'),
      createdAt: t,
      updatedAt: t,
      userId: uid,
    }) as CashflowEntry;
    await saveDoc(uid, 'cashflows', withMeta);

    // ── Auto-update linked account balance ────────────────────────────────
    let updatedAccounts = get().accounts;
    if (withMeta.accountId) {
      const account = updatedAccounts.find((a) => a.id === withMeta.accountId);
      if (account) {
        const delta     = withMeta.type === 'income' ? withMeta.amount : -withMeta.amount;
        const newBal    = (account.balance ?? 0) + delta;
        const patched   = clean({ ...account, balance: newBal, updatedAt: now() }) as typeof account;
        await saveDoc(uid, 'accounts', patched);
        updatedAccounts = updatedAccounts.map((a) => (a.id === account.id ? patched : a));
      }
    }

    set((s) => ({
      cashflows: [withMeta, ...s.cashflows].sort((a, b) =>
        safeCompare(b.date, a.date),
      ),
      accounts: updatedAccounts,
    }));
    // ── Fire event engine ────────────────────────────────────────────────
    void analyseAfterTransaction(
      get().cashflows, get().investments, get().liabilities, get().trackedPayments, withMeta,
      get().accounts, get().pendingPayments,
    );
  },

  updateCashflow: async (id, patch) => {
    const uid = get().uid;
    if (!uid) return;
    const existing = get().cashflows.find((x) => x.id === id);
    if (!existing) return;
    const updated = clean({
      ...existing,
      ...patch,
      id,
      updatedAt: now(),
    }) as CashflowEntry;
    await saveDoc(uid, 'cashflows', updated);

    set((s) => ({
      cashflows: s.cashflows.map((x) => (x.id === id ? updated : x)),
    }));
  },

  deleteCashflow: async (id) => {
    const uid = get().uid;
    if (!uid) return;
    await deleteDoc(userDoc(uid, 'cashflows', id));
    set((s) => ({
      cashflows: s.cashflows.filter((x) => x.id !== id),
    }));
  },

  deleteCashflows: async (ids) => {
    const uid = get().uid;
    if (!uid || ids.length === 0) return;
    const idSet = new Set(ids);
    await Promise.all(
      ids.map((id) => deleteDoc(userDoc(uid, 'cashflows', id))),
    );
    set((s) => ({
      cashflows: s.cashflows.filter((x) => !idSet.has(x.id)),
    }));
  },

  addGoal: async (goal) => {
    const uid = get().uid;
    if (!uid) return;
    if (blockIfLimited('goals', get().goals.length)) return;
    const t = now();
    const withMeta = clean({
      ...(goal as any),
      id: createId('goal'),
      createdAt: t,
      updatedAt: t,
      userId: uid,
    }) as Goal;
    await saveDoc(uid, 'goals', withMeta);
    set((s) => ({ goals: [withMeta, ...s.goals] }));
  },

  updateGoal: async (id, patch) => {
    const uid = get().uid;
    if (!uid) return;
    const existing = get().goals.find((x) => x.id === id);
    if (!existing) return;
    const updated = clean({
      ...existing,
      ...(patch as any),
      id,
      updatedAt: now(),
    }) as Goal;
    await saveDoc(uid, 'goals', updated);
    set((s) => ({ goals: s.goals.map((x) => (x.id === id ? updated : x)) }));
  },

  deleteGoal: async (id) => {
    const uid = get().uid;
    if (!uid) return;
    await deleteDoc(userDoc(uid, 'goals', id));
    set((s) => ({ goals: s.goals.filter((x) => x.id !== id) }));
  },

  addGoalContribution: async (contribution) => {
    const uid = get().uid;
    if (!uid) return;
    const t = now();
    const withMeta = clean({
      ...contribution,
      id: createId('gc'),
      createdAt: t,
      updatedAt: t,
      userId: uid,
    }) as GoalContribution;
    await saveDoc(uid, 'goalContributions', withMeta);
    set((s) => ({
      goalContributions: [withMeta, ...s.goalContributions].sort((a, b) =>
        safeCompare(b.date, a.date),
      ),
    }));
  },

  deleteGoalContribution: async (id) => {
    const uid = get().uid;
    if (!uid) return;
    await deleteDoc(userDoc(uid, 'goalContributions', id));
    set((s) => ({
      goalContributions: s.goalContributions.filter((x) => x.id !== id),
    }));
  },

  addCredential: async (credential) => {
    const uid = get().uid;
    if (!uid) return;
    if (blockIfLimited('credentials', get().credentials.length)) return;
    const t = now();
    const withMeta = clean({
      ...credential,
      id: createId('cred'),
      createdAt: t,
      updatedAt: t,
      userId: uid,
    }) as Credential;
    await saveDoc(uid, 'credentials', withMeta);
    set((s) => ({
      credentials: [withMeta, ...s.credentials].sort((a, b) =>
        safeCompare(b.updatedAt, a.updatedAt),
      ),
    }));
  },

  updateCredential: async (id, patch) => {
    const uid = get().uid;
    if (!uid) return;
    const existing = get().credentials.find((x) => x.id === id);
    if (!existing) return;
    const updated = clean({
      ...existing,
      ...patch,
      id,
      updatedAt: now(),
    }) as Credential;
    await saveDoc(uid, 'credentials', updated);
    set((s) => ({
      credentials: s.credentials.map((x) => (x.id === id ? updated : x)),
    }));
  },

  deleteCredential: async (id) => {
    const uid = get().uid;
    if (!uid) return;
    await deleteDoc(userDoc(uid, 'credentials', id));
    set((s) => ({ credentials: s.credentials.filter((x) => x.id !== id) }));
  },

  addAccount: async (account) => {
    const uid = get().uid;
    if (!uid) return;
    // The built-in Cash-in-Hand record never uses up a plan slot.
    const usedSlots = get().accounts.filter((a) => a.id !== IN_HAND_CASH_ID).length;
    if (blockIfLimited('accounts', usedSlots)) return;
    const t = now();
    const raw = clean({
      ...account,
      id: createId('acc'),
      createdAt: t,
      updatedAt: t,
      userId: uid,
    }) as Account;
    await saveDoc(uid, 'accounts', raw);
    set((s) => ({ accounts: [raw, ...s.accounts] }));
  },

  updateAccount: async (id, patch) => {
    const uid = get().uid;
    if (!uid) return;
    const existing = get().accounts.find((x) => x.id === id);
    if (!existing) return;
    const raw = clean({
      ...existing,
      ...patch,
      id,
      updatedAt: now(),
    }) as Account;
    await saveDoc(uid, 'accounts', raw);
    set((s) => ({ accounts: s.accounts.map((x) => (x.id === id ? raw : x)) }));
  },

  deleteAccount: async (id) => {
    const uid = get().uid;
    if (!uid) return;
    // Cash in Hand is part of the model, not a user account — clear it instead.
    if (id === IN_HAND_CASH_ID) return get().setInHandAmount(0);
    await deleteDoc(userDoc(uid, 'accounts', id));
    set((s) => ({ accounts: s.accounts.filter((x) => x.id !== id) }));
  },

  setInHandAmount: async (amount) => {
    const uid = get().uid;
    if (!uid) return;
    const value = Math.max(0, Math.round((Number(amount) || 0) * 100) / 100);
    const t = now();
    const existing = get().accounts.find((a) => a.id === IN_HAND_CASH_ID);

    if (!existing) {
      const created = clean({
        id: IN_HAND_CASH_ID,
        name: IN_HAND_CASH_NAME,
        type: 'cash' as const,
        balance: value,
        openingBalance: value,
        openingBalanceDate: todayISO(),
        createdAt: t,
        updatedAt: t,
        userId: uid,
      }) as Account;
      await saveDoc(uid, 'accounts', created);
      set((s) => ({ accounts: [created, ...s.accounts] }));
      return;
    }

    // Re-anchor the opening balance so the *live* balance (opening ± linked
    // cashflow entries) lands exactly on the entered figure — cash spent from
    // this account is still tracked like any other account.
    const live = calcLiveAccountBalances(get().accounts, get().cashflows);
    const currentOpening = existing.openingBalance ?? existing.balance ?? 0;
    const cashflowDelta = (live[existing.id] ?? currentOpening) - currentOpening;
    const openingBalance = Math.round((value - cashflowDelta) * 100) / 100;

    const updated = clean({
      ...existing,
      name: existing.name || IN_HAND_CASH_NAME,
      type: 'cash' as const,
      balance: value,
      openingBalance,
      updatedAt: t,
    }) as Account;
    await saveDoc(uid, 'accounts', updated);
    set((s) => ({
      accounts: s.accounts.map((x) => (x.id === updated.id ? updated : x)),
    }));
  },

  addSoldTrade: async (trade) => {
    const uid = get().uid;
    if (!uid) return;
    const t = now();
    const profit = trade.sellPrice - trade.buyPrice;
    const profitPct = trade.buyPrice > 0 ? (profit / trade.buyPrice) * 100 : 0;
    const raw = clean({
      ...trade,
      id: createId('sold'),
      profit,
      profitPct,
      userId: uid,
      createdAt: t,
      updatedAt: t,
    }) as SoldTrade;
    await saveDoc(uid, 'soldTrades', raw);

    // ── Auto-create cashflow income entry for sale proceeds ──────────────
    const sellCashflow = clean({
      type: 'income' as const,
      date: trade.soldDate,
      category: `Investment Sale — ${trade.investmentName ?? 'Asset'}`,
      amount: trade.sellPrice * (trade.quantity ?? 1),
      notes: `Sold ${trade.investmentName ?? 'investment'}. Profit: ₹${Math.round(profit * (trade.quantity ?? 1)).toLocaleString('en-IN')}`,
      id: createId('cf'),
      createdAt: t,
      updatedAt: t,
      userId: uid,
    }) as import('../types/investmentTypes').CashflowEntry;
    await saveDoc(uid, 'cashflows', sellCashflow);

    set((s) => ({
      soldTrades: [raw, ...s.soldTrades].sort((a, b) =>
        safeCompare(b.soldDate, a.soldDate),
      ),
      cashflows: [sellCashflow, ...s.cashflows].sort((a, b) =>
        safeCompare(b.date, a.date),
      ),
    }));
  },

  updateSoldTrade: async (id, patch) => {
    const uid = get().uid;
    if (!uid) return;
    const existing = get().soldTrades.find((x) => x.id === id);
    if (!existing) return;
    const merged = { ...existing, ...patch, id, updatedAt: now() };
    const profit = merged.sellPrice - merged.buyPrice;
    const profitPct =
      merged.buyPrice > 0 ? (profit / merged.buyPrice) * 100 : 0;
    const updated = clean({ ...merged, profit, profitPct }) as SoldTrade;
    await saveDoc(uid, 'soldTrades', updated);
    set((s) => ({
      soldTrades: s.soldTrades.map((x) => (x.id === id ? updated : x)),
    }));
  },

  deleteSoldTrade: async (id) => {
    const uid = get().uid;
    if (!uid) return;
    await deleteDoc(userDoc(uid, 'soldTrades', id));
    set((s) => ({ soldTrades: s.soldTrades.filter((x) => x.id !== id) }));
  },

  addInsurancePolicy: async (policy) => {
    const uid = get().uid;
    if (!uid) return;
    if (blockIfLimited('insurance', get().insurancePolicies.length)) return;
    const t = now();
    const withMeta = clean({
      ...policy,
      id: createId('ins_pol'),
      createdAt: t,
      updatedAt: t,
      userId: uid,
    }) as InsurancePolicy;
    await saveDoc(uid, 'insurancePolicies', withMeta);
    set((s) => ({
      insurancePolicies: [withMeta, ...s.insurancePolicies].sort((a, b) =>
        safeCompare(a.renewalDate, b.renewalDate),
      ),
    }));
    // Insurance is the source of truth → auto-create its recurring Bill Reminder.
    await syncInsuranceBill(uid, get, withMeta);
  },

  updateInsurancePolicy: async (id, patch) => {
    const uid = get().uid;
    if (!uid) return;
    const existing = get().insurancePolicies.find((x) => x.id === id);
    if (!existing) return;
    const updated = clean({
      ...existing,
      ...patch,
      id,
      updatedAt: now(),
    }) as InsurancePolicy;
    await saveDoc(uid, 'insurancePolicies', updated);
    set((s) => ({
      insurancePolicies: s.insurancePolicies.map((x) =>
        x.id === id ? updated : x,
      ),
    }));
    // Propagate premium / date / frequency changes into the linked future bill.
    await syncInsuranceBill(uid, get, updated);
  },

  deleteInsurancePolicy: async (id) => {
    const uid = get().uid;
    if (!uid) return;
    await deleteDoc(userDoc(uid, 'insurancePolicies', id));
    set((s) => ({
      insurancePolicies: s.insurancePolicies.filter((x) => x.id !== id),
    }));
    // Remove the policy's PENDING bills; paid history stays untouched.
    const linkedPending = get().trackedPayments.filter(
      (p) => p.insurancePolicyId === id && p.status === 'pending',
    );
    for (const bill of linkedPending) {
      await get().deleteTrackedPayment(bill.id);
    }
  },

  addInsurancePayment: async (payment) => {
    const uid = get().uid;
    if (!uid) return;
    const t = now();

    const policy = get().insurancePolicies.find((p) => p.id === payment.policyId);
    const linkedBill = get().trackedPayments.find(
      (p) =>
        p.insurancePolicyId === payment.policyId && p.status === 'pending',
    );

    const withMeta = clean({
      ...payment,
      id: createId('inspay'),
      // Unique cross-reference to the Bill Reminder this premium settled. When
      // markTrackedPaymentPaid sees it, it skips writing its own history row —
      // so the payment is never duplicated on the Insurance side.
      trackedPaymentId: linkedBill?.id,
      createdAt: t,
      updatedAt: t,
      userId: uid,
    }) as InsurancePayment;
    await saveDoc(uid, 'insurancePayments', withMeta);
    // In state BEFORE the bill is settled — the dedupe check reads the store.
    // The loaded flag is set too, so that check can't refetch and overwrite it.
    set((s) => ({
      _insurancePaymentsLoaded: true,
      insurancePayments: [withMeta, ...s.insurancePayments].sort((a, b) =>
        safeCompare(b.paidAt, a.paidAt),
      ),
    }));

    // ── Settle the linked pending Bill Reminder. markTrackedPaymentPaid
    //    writes its own cashflow entry, advances the policy renewal date and
    //    generates the next premium bill — so nothing is duplicated here. ──
    let settledByBill = false;
    if (linkedBill) {
      await get().markTrackedPaymentPaid(linkedBill.id);
      settledByBill = true;
    }

    // ── Cashflow expense entry (skipped when the bill reminder already wrote one)
    const policyName = policy?.policyName?.trim() || 'Insurance Policy';
    const cfId = `cf_inspay_${withMeta.id}`;
    const cashflowItem = clean({
      type: 'expense' as const,
      date: withMeta.paidAt,
      category: `Insurance — ${policyName} Premium`,
      amount: withMeta.amount,
      notes: withMeta.note
        ? `${policyName} premium payment · ${withMeta.note}`
        : `${policyName} premium payment`,
      id: cfId,
      createdAt: t,
      updatedAt: t,
      userId: uid,
    }) as CashflowEntry;
    const alreadyInCF = settledByBill || get().cashflows.some((c) => c.id === cfId);
    if (!alreadyInCF) {
      await saveDoc(uid, 'cashflows', cashflowItem);
    }

    set((s) => ({
      cashflows: alreadyInCF
        ? s.cashflows
        : [cashflowItem, ...s.cashflows].sort((a, b) => safeCompare(b.date, a.date)),
    }));
  },

  deleteInsurancePayment: async (id) => {
    const uid = get().uid;
    if (!uid) return;
    await deleteDoc(userDoc(uid, 'insurancePayments', id));
    set((s) => ({
      insurancePayments: s.insurancePayments.filter((x) => x.id !== id),
    }));
  },

  addSipInstrument: async (instrument) => {
    const uid = get().uid;
    if (!uid) return;
    const t = now();
    const item = clean({
      ...instrument,
      id: createId('sip'),
      type: 'instrument',
      userId: uid,
      createdAt: t,
      updatedAt: t,
    });
    await saveDoc(uid, 'sipPlans', item as any);
    set((s) => ({ sipPlans: [...s.sipPlans, item] }));
  },

  updateSipInstrument: async (id, patch) => {
    const uid = get().uid;
    if (!uid) return;
    const existing = get().sipPlans.find((x: any) => x.id === id);
    if (!existing) return;
    const updated = clean({ ...existing, ...patch, id, updatedAt: now() });
    await saveDoc(uid, 'sipPlans', updated as any);
    set((s) => ({
      sipPlans: s.sipPlans.map((x: any) => (x.id === id ? updated : x)),
    }));
  },

  deleteSipInstrument: async (id) => {
    const uid = get().uid;
    if (!uid) return;
    await deleteDoc(userDoc(uid, 'sipPlans', id));
    set((s) => ({ sipPlans: s.sipPlans.filter((x: any) => x.id !== id) }));
  },

  upsertSipBudget: async (budget) => {
    const uid = get().uid;
    if (!uid) return '';
    const existing = get().sipPlans.find((x: any) => x.type === 'budget');
    const t = now();
    if (existing) {
      const updated = clean({ ...existing, budget, updatedAt: t });
      await saveDoc(uid, 'sipPlans', updated as any);
      set((s) => ({
        sipPlans: s.sipPlans.map((x: any) =>
          x.id === existing.id ? updated : x,
        ),
      }));
      return existing.id;
    } else {
      const item = clean({
        id: createId('sipb'),
        type: 'budget',
        budget,
        userId: uid,
        createdAt: t,
        updatedAt: t,
      });
      await saveDoc(uid, 'sipPlans', item as any);
      set((s) => ({ sipPlans: [...s.sipPlans, item] }));
      return item.id;
    }
  },

  deleteSipBudget: async () => {
    const uid = get().uid;
    if (!uid) return;
    const existing = get().sipPlans.find((x: any) => x.type === 'budget');
    if (!existing) return;
    await deleteDoc(userDoc(uid, 'sipPlans', existing.id));
    set((s) => ({
      sipPlans: s.sipPlans.filter((x: any) => x.id !== existing.id),
    }));
  },

  // ── Custom category management (persisted in settings doc) ───────────────

  addCustomCategory: async (type, name) => {
    const uid = get().uid;
    if (!uid) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const current = get().customCategories;
    if (current[type].includes(trimmed)) return; // no duplicates
    const updated = { ...current, [type]: [...current[type], trimmed] };
    await setDoc(settingsDocRef(uid), { customCategories: updated }, { merge: true });
    set({ customCategories: updated });
  },

  removeCustomCategory: async (type, name) => {
    const uid = get().uid;
    if (!uid) return;
    const current = get().customCategories;
    const updated = { ...current, [type]: current[type].filter((c) => c !== name) };
    await setDoc(settingsDocRef(uid), { customCategories: updated }, { merge: true });
    set({ customCategories: updated });
  },

  toggleHiddenCategory: async (type, name) => {
    const uid = get().uid;
    if (!uid) return;
    const current = get().hiddenCategories;
    const list    = current[type];
    const updated = list.includes(name)
      ? { ...current, [type]: list.filter((c) => c !== name) }
      : { ...current, [type]: [...list, name] };
    await setDoc(settingsDocRef(uid), { hiddenCategories: updated }, { merge: true });
    set({ hiddenCategories: updated });
  },

  // ── Custom subcategory management (persisted in settings doc) ────────────
  // Keyed by parent category so a new subcategory is instantly available in
  // the Add Entry form, the subcategory filter and every count derived from it.

  addCustomSubcategory: async (category, name) => {
    const uid = get().uid;
    if (!uid) return;
    const parent = category.trim();
    const trimmed = name.trim();
    if (!parent || !trimmed) return;
    const current = get().customSubcategories;
    const list = current[parent] ?? [];
    if (list.includes(trimmed)) return; // no duplicates
    const updated = { ...current, [parent]: [...list, trimmed] };
    await setDoc(settingsDocRef(uid), { customSubcategories: updated }, { merge: true });
    set({ customSubcategories: updated });
  },

  removeCustomSubcategory: async (category, name) => {
    const uid = get().uid;
    if (!uid) return;
    const current = get().customSubcategories;
    const list = current[category];
    if (!list) return;
    const updated = { ...current, [category]: list.filter((c) => c !== name) };
    await setDoc(settingsDocRef(uid), { customSubcategories: updated }, { merge: true });
    set({ customSubcategories: updated });
  },

  setNotionConfig: async (patch) => {
    const uid = get().uid;
    if (!uid) return;
    const notion = { ...get().notion, ...patch };
    await setDoc(
      settingsDocRef(uid),
      { notion, essentials: get().essentials },
      { merge: true },
    );
    set({ notion });
  },

  setEssentialsConfig: async (patch) => {
    const uid = get().uid;
    if (!uid) return;
    const essentials = { ...get().essentials, ...patch };
    await setDoc(
      settingsDocRef(uid),
      { notion: get().notion, essentials },
      { merge: true },
    );
    set({ essentials });
  },

  setAllocationTargets: async (targets) => {
    const uid = get().uid;
    if (!uid) return;
    await setDoc(
      settingsDocRef(uid),
      { allocationTargets: targets },
      { merge: true },
    );
    set({ allocationTargets: targets });
  },

  recordSnapshotIfNeeded: async () => {
    const uid = get().uid;
    if (!uid) return;
    const date = todayISO();
    if (get()._lastSnapshotDate === date) return;
    const { totalValue } = summarizePortfolio(get().investments);
    const deterministicId = `snap_${date}`;
    const existing = get().snapshots.find((x) => x.date === date || x.id === deterministicId);
    if (existing) {
      const updated: PortfolioSnapshot = { ...existing, totalValue };
      await saveDoc(uid, 'snapshots', updated);
      set((s) => ({
        snapshots: s.snapshots.map((x) => (x.id === updated.id ? updated : x)),
        _lastSnapshotDate: date,
      }));
      return;
    }
    const snap = clean({
      id: deterministicId,
      date,
      totalValue,
      userId: uid,
    }) as any;
    await saveDoc(uid, 'snapshots', snap);
    set((s) => ({
      snapshots: [...s.snapshots, snap as PortfolioSnapshot].sort((a, b) =>
        safeCompare(a.date, b.date),
      ),
      _lastSnapshotDate: date,
    }));
  },

  recordSnapshotNow: async () => {
    set({ _lastSnapshotDate: null });
    await get().recordSnapshotIfNeeded();
  },

  takeNetWorthSnapshot: async (label) => {
    const uid = get().uid;
    if (!uid) return;
    const state = get();

    // ── Core net worth ───────────────────────────────────────────────────────
    const { totalAssets, totalLiabilities, netWorth, receivablesTotal, receivablesPrincipal, receivablesInterest } = calculateNetWorth(
      state.investments,
      state.liabilities,
      state.pendingPayments,
      state.accounts,
      state.cashflows,
    );

    // ── Investment breakdown ─────────────────────────────────────────────────
    const portfolioSummary = summarizePortfolio(state.investments);
    const realizedProfit = (state.soldTrades ?? []).reduce((s, t) => s + (t.profit || 0), 0);

    // ── Cashflow — current month ─────────────────────────────────────────────
    const todayStr = todayISO();
    const ym = todayStr.slice(0, 7); // "YYYY-MM"
    const thisMonthCf = (state.cashflows ?? []).filter((c) => (c.date ?? '').startsWith(ym));
    const monthIncome = thisMonthCf.filter((c) => c.type === 'income').reduce((s, c) => s + c.amount, 0);
    const monthExpense = thisMonthCf.filter((c) => c.type === 'expense').reduce((s, c) => s + c.amount, 0);

    // ── Liquid cash ──────────────────────────────────────────────────────────
    const accountBalance = getLiveBankTotal(state.accounts ?? [], state.cashflows ?? []);

    // ── Goals ────────────────────────────────────────────────────────────────
    const goals = state.goals ?? [];
    const goalsSaved = goals.reduce((s, g) => s + (g.currentAmount || 0), 0);
    const goalsTarget = goals.reduce((s, g) => s + (g.targetAmount || 0), 0);
    const goalsProgress = goalsTarget > 0 ? Math.min(100, (goalsSaved / goalsTarget) * 100) : 0;

    // ── Insurance ────────────────────────────────────────────────────────────
    const insurancePolicies = state.insurancePolicies ?? [];
    const insuranceCoverage = insurancePolicies.reduce((s, p) => s + (p.coverageAmount || 0), 0);

    // ── SIP ──────────────────────────────────────────────────────────────────
    const sipPlans = state.sipPlans ?? [];
    const sipBudget = sipPlans.find((x: any) => x.type === 'budget');
    const sipInstruments = sipPlans.filter((x: any) => x.type === 'instrument');
    const sipMonthlyBudget = sipBudget?.budget || 0;

    // ── Liabilities breakdown ────────────────────────────────────────────────
    const activeLiabilities = (state.liabilities ?? []).filter(
      (l) => l.status !== 'paid' && l.status !== 'returned',
    );
    const totalEmiMonthly = activeLiabilities.reduce((s, l) => s + (l.emiAmount || 0), 0);

    const date = todayStr;
    const t = now();
    const deterministicId = label?.trim() ? createId('nws') : `networthSnapshot_${date}`;

    const snap: NetWorthSnapshot = clean({
      id: deterministicId,
      createdAt: t,
      userId: uid,
      ...(label?.trim() ? { label: label.trim() } : {}),
      // Core
      totalAssets,
      totalLiabilities,
      netWorth,
      // Investments
      investmentValue: portfolioSummary.totalValue,
      investedTotal: portfolioSummary.investedTotal,
      unrealizedPnl: portfolioSummary.profitLossTotal,
      realizedProfit,
      // Cashflow
      monthIncome,
      monthExpense,
      monthNet: monthIncome - monthExpense,
      // Cash
      accountBalance,
      // Goals
      goalsProgress,
      goalsCount: goals.length,
      goalsSaved,
      goalsTarget,
      // Insurance
      insuranceCoverage,
      insurancePoliciesCount: insurancePolicies.length,
      // SIP
      sipMonthlyBudget,
      sipInstrumentsCount: sipInstruments.length,
      // Liabilities
      liabilitiesCount: activeLiabilities.length,
      totalEmiMonthly,
      // Receivables
      receivablesTotal,
      receivablesPrincipal,
      receivablesInterest,
      receivablesCount: (state.pendingPayments ?? []).filter((p) => p.status !== 'received').length,
    }) as NetWorthSnapshot;

    await saveDoc(uid, 'networthSnapshots', snap);
    set((s) => ({
      networthSnapshots: [
        snap,
        ...s.networthSnapshots.filter((x) => x.id !== snap.id),
      ],
    }));
  },

  saveInsightSnapshot: async (data) => {
    const uid = get().uid;
    if (!uid) return;
    const t = now();
    const snapshot = clean({
      ...data,
      id: createId('ins'),
      userId: uid,
      createdAt: t,
    }) as InsightSnapshot;
    await saveDoc(uid, 'insights', snapshot);
    // Delete any older insight docs — cap the collection to 1 document
    try {
      const older = await getDocs(
        query(userCol(uid, 'insights'), orderBy('createdAt', 'desc'), limit(10)),
      );
      const toDelete = older.docs.slice(1); // keep only the newest
      if (toDelete.length > 0) {
        const batch = writeBatch(db);
        toDelete.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    } catch {
      // Non-critical — ignore cleanup errors
    }
    set({ latestInsight: snapshot });
  },

  clearAllData: async () => {
    const uid = get().uid;
    if (!uid) return;

    const subCollections = [
      'investments',
      'liabilities',
      'pendingPayments',
      'trackedPayments',
      'cashflows',
      'goals',
      'goalContributions',
      'credentials',
      'snapshots',
      'networthSnapshots',
      'insights',
      'accounts',
      'soldTrades',
      'insurancePolicies',
      'insurancePayments',
      'sipPlans',
      'notificationJobs',
    ];

    try {
      for (const colName of subCollections) {
        const snap = await getDocs(userCol(uid, colName));
        if (snap.empty) continue;
        const refs = snap.docs.map((d) => d.ref);
        for (let i = 0; i < refs.length; i += 499) {
          const batch = writeBatch(db);
          refs.slice(i, i + 499).forEach((ref) => batch.delete(ref));
          await batch.commit();
        }
      }

      const b = writeBatch(db);
      b.delete(settingsDocRef(uid));
      await b.commit();

      set({
        investments: [],
        snapshots: [],
        liabilities: [],
        pendingPayments: [],
        trackedPayments: [],
        cashflows: [],
        goals: [],
        goalContributions: [],
        credentials: [],
        networthSnapshots: [],
        latestInsight: null,
        notion: { enabled: false },
        essentials: {},
        accounts: [],
        soldTrades: [],
        insurancePolicies: [],
        insurancePayments: [],
        sipPlans: [],
        _lastSnapshotDate: null,
      });
    } catch (error) {
      console.error('Cloud wipe failed:', error);
      throw error;
    }
  },

  resetSession: () => {
    set({
      uid: null,
      ready: false,
      investments: [],
      snapshots: [],
      liabilities: [],
      pendingPayments: [],
      trackedPayments: [],
      cashflows: [],
      goals: [],
      goalContributions: [],
      credentials: [],
      networthSnapshots: [],
      latestInsight: null,
      notion: DEFAULT_NOTION,
      essentials: DEFAULT_ESSENTIALS,
      allocationTargets: DEFAULT_ALLOCATION_TARGETS,
      accounts: [],
      soldTrades: [],
      insurancePolicies: [],
      insurancePayments: [],
      sipPlans: [],
      _lastSnapshotDate: null,
      _goalContributionsLoaded: false,
      _insurancePaymentsLoaded: false,
      _pendingPaymentsLoaded: false,
      _credentialsLoaded: false,
    });
  },
}));
