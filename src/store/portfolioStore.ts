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
  PortfolioSnapshot,
  SoldTrade,
} from '../types/investmentTypes';
import type { LedgerEntry } from '../types/ledgerTypes';
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
import { calculateNetWorth, summarizePortfolio } from '../utils/calculations';
import { todayISO } from '../utils/dateUtils';
import { nextDueDate } from '../utils/paymentTracker';
import {
  analyseAfterTransaction,
  analyseAfterPayment,
  analyseAfterInvestment,
} from '../services/financialEventEngine';
import {
  deleteLedgerEntry,
  getDeterministicLedgerId,
  saveLedgerEntry,
} from '../services/ledgerService';
import { runIdempotentLedgerMigration } from '../services/migrationService';
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

async function saveDoc<
  T extends {
    id: string;
    userId?: string;
    createdAt?: string;
    updatedAt?: string;
  },
>(uid: string, col: string, data: T): Promise<void> {
  const payload = await encryptDoc(uid, data);
  await setDoc(userDoc(uid, col, data.id), payload);
}

export type SettingsRecord = {
  notion: NotionConfig;
  essentials?: EssentialsConfig;
  encryptionEnabled?: boolean;
  customCategories?: { expense: string[]; income: string[] };
  hiddenCategories?: { expense: string[]; income: string[] };
};

type PortfolioState = {
  uid: string | null;
  ready: boolean;
  investments: Investment[];
  snapshots: PortfolioSnapshot[];
  liabilities: Liability[];
  pendingPayments: PendingPayment[];
  trackedPayments: TrackedPayment[];
  cashflows: CashflowEntry[];
  ledgerEntries: LedgerEntry[];
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

  /** User-defined category lists stored in Firestore, keyed by type */
  customCategories: { expense: string[]; income: string[] };
  /** Categories the user has hidden (stored in Firestore) */
  hiddenCategories: { expense: string[]; income: string[] };

  addCustomCategory: (type: 'expense' | 'income', name: string) => Promise<void>;
  removeCustomCategory: (type: 'expense' | 'income', name: string) => Promise<void>;
  toggleHiddenCategory: (type: 'expense' | 'income', name: string) => Promise<void>;

  hydrate: (uid: string, opts?: { force?: boolean }) => Promise<void>;

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
  investments: [],
  snapshots: [],
  liabilities: [],
  pendingPayments: [],
  trackedPayments: [],
  cashflows: [],
  ledgerEntries: [],
  goals: [],
  goalContributions: [],
  credentials: [],
  networthSnapshots: [],
  latestInsight: null,
  notion: DEFAULT_NOTION,
  essentials: DEFAULT_ESSENTIALS,
  accounts: [],
  soldTrades: [],
  insurancePolicies: [],
  insurancePayments: [],
  sipPlans: [],
  _lastSnapshotDate: null,
  customCategories: { expense: [], income: [] },
  hiddenCategories: { expense: [], income: [] },

  hydrate: async (uid, opts) => {
    const { uid: currentUid, ready } = get();
    if (!opts?.force && currentUid === uid && ready) return;

    set({ uid });
    try {
      // Run background migration if required for legacy records
      void runIdempotentLedgerMigration(uid).catch((err) =>
        console.error('[PortfolioStore] ledger migration failed:', err),
      );

      // Phase 1: dashboard-critical only — show UI as soon as this completes
      const [
        investments,
        snapshots,
        liabilities,
        cashflows,
        goals,
        accounts,
      ] = await Promise.all([
        fetchSub<Investment>(uid, 'investments'),
        fetchSub<PortfolioSnapshot>(uid, 'snapshots'),
        fetchSub<Liability>(uid, 'liabilities'),
        fetchSub<CashflowEntry>(uid, 'cashflows'),
        fetchSub<Goal>(uid, 'goals'),
        fetchSub<Account>(uid, 'accounts'),
      ]);

      const settingsSnap = await getDoc(settingsDocRef(uid));
      const settings: SettingsRecord = settingsSnap.exists()
        ? (settingsSnap.data() as SettingsRecord)
        : { notion: DEFAULT_NOTION, essentials: DEFAULT_ESSENTIALS };

      const sortedSnapshots = snapshots.sort((a, b) =>
        safeCompare(a.date, b.date),
      );
      const today = todayISO();
      const alreadySnappedToday = sortedSnapshots.some((s) => s.date === today);

      set({
        ready: true,
        investments: investments.sort((a, b) =>
          safeCompare(b.updatedAt, a.updatedAt),
        ),
        snapshots: sortedSnapshots,
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
        accounts: accounts.sort((a, b) =>
          safeCompare(b.createdAt, a.createdAt),
        ),
        _lastSnapshotDate: alreadySnappedToday ? today : null,
      });

      if (investments.length > 0 && !opts?.force) {
        void get().recordSnapshotIfNeeded();
      }

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
      };

      const loadPhase2 = async () => {
        const [
          pendingPayments,
          goalContributions,
          credentials,
          networthSnapshots,
          insurancePayments,
          sipPlans,
          ledgerEntries,
        ] = await Promise.all([
          fetchSub<PendingPayment>(uid, 'pendingPayments'),
          fetchSub<GoalContribution>(uid, 'goalContributions'),
          fetchSub<Credential>(uid, 'credentials'),
          fetchSub<NetWorthSnapshot>(uid, 'networthSnapshots'),
          fetchSub<InsurancePayment>(uid, 'insurancePayments'),
          fetchSub<any>(uid, 'sipPlans'),
          fetchSub<LedgerEntry>(uid, 'ledgerEntries'),
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
          pendingPayments: pendingPayments.sort((a, b) =>
            safeCompare(a.expectedPaymentDate, b.expectedPaymentDate),
          ),
          goalContributions: goalContributions.sort((a, b) =>
            safeCompare(b.date, a.date),
          ),
          credentials: credentials.sort((a, b) =>
            safeCompare(b.updatedAt, a.updatedAt),
          ),
          networthSnapshots: networthSnapshots.sort((a, b) =>
            safeCompare(b.createdAt, a.createdAt),
          ),
          latestInsight,
          insurancePayments: insurancePayments.sort((a, b) =>
            safeCompare(b.paidAt, a.paidAt),
          ),
          sipPlans: sipPlans.sort((a: any, b: any) =>
            safeCompare(a.createdAt, b.createdAt),
          ),
          ledgerEntries: ledgerEntries.sort(
            (a, b) =>
              safeCompare(b.date, a.date) ||
              safeCompare(b.updatedAt, a.updatedAt),
          ),
        });
      };

      if (opts?.force) {
        // Import / restore: wait until every collection is in memory
        await Promise.all([
          loadPhase1b().catch((err) =>
            console.error('[PortfolioStore] phase 1b hydrate failed:', err),
          ),
          loadPhase2().catch((err) =>
            console.error('[PortfolioStore] secondary hydrate failed:', err),
          ),
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
    await get().recordSnapshotIfNeeded();
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
      await get().recordSnapshotIfNeeded();
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
    await get().recordSnapshotIfNeeded();
  },

  deleteInvestment: async (id) => {
    const uid = get().uid;
    if (!uid) return;
    await deleteDoc(userDoc(uid, 'investments', id));
    set((s) => ({ investments: s.investments.filter((x) => x.id !== id) }));
    await get().recordSnapshotIfNeeded();
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

    let updatedLedgers = get().ledgerEntries;
    if (updated.status === 'received' && updated.receivedAt) {
      const ledgerItem = await saveLedgerEntry(uid, {
        id: getDeterministicLedgerId('receivable', updated.id),
        type: 'income',
        date: updated.receivedAt,
        amount: updated.amount,
        category: `Receivable - ${updated.buyerName}`,
        module: 'personal',
        sourceType: 'receivable',
        sourceId: updated.id,
        notes: updated.itemDescription,
      });
      updatedLedgers = [ledgerItem, ...updatedLedgers.filter((x) => x.id !== ledgerItem.id)];
    }

    set((s) => ({
      pendingPayments: s.pendingPayments
        .map((x) => (x.id === id ? updated : x))
        .sort((a, b) =>
          safeCompare(a.expectedPaymentDate, b.expectedPaymentDate),
        ),
      ledgerEntries: updatedLedgers.sort((a, b) => safeCompare(b.date, a.date)),
    }));
  },

  deletePendingPayment: async (id) => {
    const uid = get().uid;
    if (!uid) return;
    await deleteDoc(userDoc(uid, 'pendingPayments', id));
    await deleteLedgerEntry(uid, getDeterministicLedgerId('receivable', id));
    set((s) => ({
      pendingPayments: s.pendingPayments.filter((x) => x.id !== id),
      ledgerEntries: s.ledgerEntries.filter((x) => x.id !== getDeterministicLedgerId('receivable', id)),
    }));
  },

  addTrackedPayment: async (payment) => {
    const uid = get().uid;
    if (!uid) return;
    if (blockIfLimited('payments', get().pendingPayments.length + get().trackedPayments.length)) return;
    const t = now();
    const withMeta = clean({
      ...payment,
      reminderDays: payment.reminderDays?.length
        ? payment.reminderDays
        : [1, 3, 7],
      recurrence: payment.recurrence ?? 'none',
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
    const updated = clean({
      ...existing,
      ...(patch as Partial<TrackedPayment>),
      id,
      updatedAt: now(),
    }) as TrackedPayment;
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
    await deleteLedgerEntry(uid, getDeterministicLedgerId('payment', id));
    set((s) => ({
      trackedPayments: s.trackedPayments.filter((x) => x.id !== id),
      ledgerEntries: s.ledgerEntries.filter((x) => x.id !== getDeterministicLedgerId('payment', id)),
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

    // Save ONE canonical ledger entry idempotently
    const ledgerItem = await saveLedgerEntry(uid, {
      id: getDeterministicLedgerId('payment', existing.id),
      type: 'expense',
      date: paidAt,
      amount: existing.amount,
      category: existing.title || existing.paymentType || 'Payment',
      module: 'payment',
      sourceType: 'payment',
      sourceId: existing.id,
      notes: existing.notes,
    });

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

    const nextPayments: TrackedPayment[] = [];
    if (nextDate) {
      const t = now();
      const next = clean({
        title: existing.title,
        paymentType: existing.paymentType,
        amount: existing.amount,
        dueDate: nextDate,
        reminderDays: existing.reminderDays,
        recurrence: existing.recurrence,
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
      ledgerEntries: [ledgerItem, ...s.ledgerEntries.filter((x) => x.id !== ledgerItem.id)].sort(
        (a, b) => safeCompare(b.date, a.date),
      ),
      cashflows: alreadyInCF
        ? s.cashflows
        : [cashflowItem, ...s.cashflows].sort((a, b) => safeCompare(b.date, a.date)),
    }));
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

    const ledgerItem = await saveLedgerEntry(uid, {
      id: `ledger_cf_${withMeta.id}`,
      type: withMeta.type,
      date: withMeta.date,
      amount: withMeta.amount,
      category: withMeta.category,
      accountId: withMeta.accountId,
      module: 'personal',
      sourceType: 'manual',
      sourceId: withMeta.id,
      notes: withMeta.notes,
    });

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
      ledgerEntries: [ledgerItem, ...s.ledgerEntries.filter((x) => x.id !== ledgerItem.id)].sort(
        (a, b) => safeCompare(b.date, a.date),
      ),
      accounts: updatedAccounts,
    }));
    // ── Fire event engine ────────────────────────────────────────────────
    void analyseAfterTransaction(
      get().cashflows, get().investments, get().liabilities, get().trackedPayments, withMeta,
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

    const ledgerItem = await saveLedgerEntry(uid, {
      id: `ledger_cf_${updated.id}`,
      type: updated.type,
      date: updated.date,
      amount: updated.amount,
      category: updated.category,
      accountId: updated.accountId,
      module: 'personal',
      sourceType: 'manual',
      sourceId: updated.id,
      notes: updated.notes,
    });

    set((s) => ({
      cashflows: s.cashflows.map((x) => (x.id === id ? updated : x)),
      ledgerEntries: s.ledgerEntries.map((x) => (x.id === ledgerItem.id ? ledgerItem : x)),
    }));
  },

  deleteCashflow: async (id) => {
    const uid = get().uid;
    if (!uid) return;
    await deleteDoc(userDoc(uid, 'cashflows', id));
    await deleteLedgerEntry(uid, `ledger_cf_${id}`);
    set((s) => ({
      cashflows: s.cashflows.filter((x) => x.id !== id),
      ledgerEntries: s.ledgerEntries.filter((x) => x.id !== `ledger_cf_${id}`),
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
    if (blockIfLimited('accounts', get().accounts.length)) return;
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
    await deleteDoc(userDoc(uid, 'accounts', id));
    set((s) => ({ accounts: s.accounts.filter((x) => x.id !== id) }));
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

    // ── Also write to ledgerEntries ───────────────────────────────────────
    const ledgerItem = await saveLedgerEntry(uid, {
      id: getDeterministicLedgerId('investment', raw.id),
      type: 'income',
      date: trade.soldDate,
      amount: trade.sellPrice * (trade.quantity ?? 1),
      category: `Investment Sale — ${trade.investmentName ?? 'Asset'}`,
      module: 'investment',
      sourceType: 'investment',
      sourceId: raw.id,
      notes: sellCashflow.notes,
    });

    set((s) => ({
      soldTrades: [raw, ...s.soldTrades].sort((a, b) =>
        safeCompare(b.soldDate, a.soldDate),
      ),
      cashflows: [sellCashflow, ...s.cashflows].sort((a, b) =>
        safeCompare(b.date, a.date),
      ),
      ledgerEntries: [ledgerItem, ...s.ledgerEntries.filter((x) => x.id !== ledgerItem.id)].sort(
        (a, b) => safeCompare(b.date, a.date),
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
  },

  deleteInsurancePolicy: async (id) => {
    const uid = get().uid;
    if (!uid) return;
    await deleteDoc(userDoc(uid, 'insurancePolicies', id));
    set((s) => ({
      insurancePolicies: s.insurancePolicies.filter((x) => x.id !== id),
    }));
  },

  addInsurancePayment: async (payment) => {
    const uid = get().uid;
    if (!uid) return;
    const t = now();
    const withMeta = clean({
      ...payment,
      id: createId('inspay'),
      createdAt: t,
      updatedAt: t,
      userId: uid,
    }) as InsurancePayment;
    await saveDoc(uid, 'insurancePayments', withMeta);
    set((s) => ({
      insurancePayments: [withMeta, ...s.insurancePayments].sort((a, b) =>
        safeCompare(b.paidAt, a.paidAt),
      ),
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
    const { totalAssets, totalLiabilities, netWorth } = calculateNetWorth(
      state.investments,
      state.liabilities,
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
    const accountBalance = (state.accounts ?? []).reduce((s, a) => s + (a.balance || 0), 0);

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
      'ledgerEntries',
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
        ledgerEntries: [],
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
      ledgerEntries: [],
      goals: [],
      goalContributions: [],
      credentials: [],
      networthSnapshots: [],
      latestInsight: null,
      notion: DEFAULT_NOTION,
      essentials: DEFAULT_ESSENTIALS,
      accounts: [],
      soldTrades: [],
      insurancePolicies: [],
      insurancePayments: [],
      sipPlans: [],
      _lastSnapshotDate: null,
    });
  },
}));
