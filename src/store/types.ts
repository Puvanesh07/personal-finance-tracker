// src/store/types.ts
//
// Single source of truth for the composed portfolio store shape. The store is
// assembled from per-module slices (see src/store/slices/*.ts), but every slice
// is typed against ONE canonical `PortfolioState` interface via
// `Pick<PortfolioState, ...>`. That keeps the public API identical to the old
// monolithic store (zero consumer churn) while letting TypeScript verify — at
// composition time — that every module contributes exactly its members.
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
  NetWorthSnapshot,
  NotionConfig,
  PendingPayment,
  PortfolioSnapshot,
  SoldTrade,
  TrackedPayment,
  SipPlan,
  SipInstrumentPlan,
} from '../types/investmentTypes';
import type { AllocationTargets } from './portfolioSettings';
import type { DataStamp } from '../utils/dataVersion';

/** What a hydrate actually reloaded — lets callers report the truth. */
export type HydrateResult = { documents: number; collections: number };

export type PortfolioState = {
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
  sipPlans: SipPlan[];
  _lastSnapshotDate: string | null;

  /** Lazy-load flags — true once a collection has been fetched on demand */
  _goalContributionsLoaded: boolean;
  _insurancePaymentsLoaded: boolean;
  _pendingPaymentsLoaded: boolean;
  _credentialsLoaded: boolean;

  /** Per-collection change stamps as of the last load, and when that happened.
   *  Used by refreshIfStale() to refetch only what actually moved. */
  _dataVersions: Record<string, number>;
  /** Latest stamps seen on the wire (live sync), before they are applied. */
  _liveStamps: Record<string, DataStamp>;
  lastHydrateAt: number;
  _schemaVersion: number;

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

  hydrate: (uid: string, opts?: { force?: boolean }) => Promise<HydrateResult>;

  /** Apply any one-time data fixes newer than the version this account has
   *  recorded, then store the new version. Before this, the legacy bond sweep
   *  and the insurance bill backfill re-read and re-wrote user history on every
   *  login — the same work forever, and the only writes a brand-new device made
   *  on opening the app. */
  runMigrations: () => Promise<void>;
  backfillInsuranceBills: () => Promise<void>;
  /** Idempotent, non-destructive repair (C1): ensure every goal contribution
   *  that names a funding *and* destination account has its derived
   *  net-worth-neutral transfer. Legacy contributions (no accounts) are left
   *  exactly as saved — they never moved money between tracked accounts. */
  backfillGoalTransfers: () => Promise<void>;

  /** One settings read; refetch only collections whose change stamp moved.
   *  This is what makes a tab-focus or reconnect refresh nearly free.
   *  `stamps` lets the live listener hand over what it just saw instead of
   *  reading the settings document a second time. */
  refreshIfStale: (stamps?: Record<string, DataStamp>) => Promise<number>;

  /** Watch the change stamps so an edit made on another device lands here
   *  without a reload. One document listener for every collection, and it only
   *  costs a real read when something actually moved. */
  startLiveSync: () => void;
  stopLiveSync: () => void;

  /** Repair stored account balances drifted by an older build that wrote
   *  cashflow deltas into `balance` on add and never reversed them. */
  reconcileAccountBalances: () => Promise<{ changed: number; legacy: number }>;

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
  /** Re-apply a just-deleted document (audit I5 undo). Writes the SAME id so
   *  links survive, and is idempotent — a no-op if the row is already back. */
  restoreEntity: (col: string, entity: { id: string }) => Promise<void>;

  /** Post a bond's received-but-unsynced coupon interest to Cashflow as income.
   *  Idempotent (each entry keyed by the deterministic schedule id). Optionally
   *  restrict to specific coupon indexes. Returns how many rows were created. */
  syncBondInterest: (bondId: string, indexes?: number[]) => Promise<number>;
  /** Close a matured bond: sync all received interest, post the returned
   *  principal as a `transfer` into the linked account, and mark the bond
   *  `matured` (kept for history, dropped from live assets — not deleted). */
  settleBondMaturity: (bondId: string) => Promise<void>;

  addLiability: (
    liability: Omit<Liability, 'id' | 'createdAt' | 'updatedAt'>,
  ) => Promise<void>;
  updateLiability: (id: string, patch: Partial<Liability>) => Promise<void>;
  deleteLiability: (id: string) => Promise<void>;
  /** Record an EMI / installment: principal reduces the outstanding balance,
   *  interest is booked as a real expense, and the full amount leaves a funding
   *  account — all in one atomic batch (C1/C5). Net-worth impact = interest. */
  recordLiabilityPayment: (
    liabilityId: string,
    payment: {
      date: string;
      amount: number;
      principal: number;
      interest: number;
      accountId?: string;
      note?: string;
    },
  ) => Promise<void>;
  /** Reverse a recorded EMI: restores the outstanding balance and removes its
   *  two derived cashflows. */
  deleteLiabilityPayment: (
    liabilityId: string,
    paymentId: string,
  ) => Promise<void>;

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
  /** Create-or-update the pending Bill Reminder linked to an insurance policy.
   *  Idempotent — one linked pending bill per policy, so no duplicates. Owned by
   *  the payments slice (it writes `trackedPayments`) but invoked by insurance. */
  syncInsuranceBill: (uid: string, policy: InsurancePolicy) => Promise<void>;
  /** Re-anchor overdue recurring bills to their current occurrence after the
   *  app was closed for one or more cycles — latest occurrence only, never
   *  minting the missed intermediate bills (audit I1). */
  catchUpRecurringSeries: () => Promise<void>;

  addCashflow: (
    entry: Omit<CashflowEntry, 'id' | 'createdAt' | 'updatedAt'>,
  ) => Promise<void>;
  updateCashflow: (id: string, patch: Partial<CashflowEntry>) => Promise<void>;
  deleteCashflow: (id: string) => Promise<void>;
  /** Atomic bulk delete — one state update so totals/charts refresh once. */
  deleteCashflows: (ids: string[]) => Promise<void>;
  /** Bulk-import validated statement rows (audit I2). Writes every draft in
   *  chunked atomic batches tagged with the SAME importBatchId, so a partial
   *  failure can never leave a half-committed statement and the whole import
   *  is reversible via deleteCashflowsByBatch. Returns how many landed. */
  importCashflows: (
    drafts: Omit<CashflowEntry, 'id' | 'createdAt' | 'updatedAt'>[],
    importBatchId: string,
  ) => Promise<{ imported: number }>;
  /** Roll back an entire statement import in one atomic pass, with undo. */
  deleteCashflowsByBatch: (importBatchId: string) => Promise<{ removed: number }>;

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
  updateSipInstrument: (
    id: string,
    patch: Partial<Omit<SipInstrumentPlan, 'id' | 'type' | 'userId' | 'createdAt'>>,
  ) => Promise<void>;
  deleteSipInstrument: (id: string) => Promise<void>;
  upsertSipBudget: (budget: number) => Promise<string>;
  deleteSipBudget: () => Promise<void>;

  clearAllData: () => Promise<void>;
  resetSession: () => void;
  setNotionConfig: (patch: Partial<NotionConfig>) => Promise<void>;
  setEssentialsConfig: (patch: Partial<EssentialsConfig>) => Promise<void>;
  allocationTargets: AllocationTargets;
  setAllocationTargets: (targets: AllocationTargets) => Promise<void>;
  takeNetWorthSnapshot: (label?: string) => Promise<void>;
  saveInsightSnapshot: (
    insight: Omit<InsightSnapshot, 'id' | 'userId' | 'createdAt'>,
  ) => Promise<void>;
};
