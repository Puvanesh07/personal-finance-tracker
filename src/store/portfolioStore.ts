import type {
  Account,
  CashflowEntry,
  EssentialsConfig,
  Goal,
  InsightSnapshot,
  InsurancePolicy,
  Investment,
  Liability,
  NetWorthSnapshot,
  NotionConfig,
  PortfolioSnapshot,
  SoldTrade,
} from '../types/investmentTypes';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';

import { create } from 'zustand';
import { createId } from '../utils/id';
import { db } from '../services/firebase';
import { summarizePortfolio } from '../utils/calculations';
import { todayISO } from '../utils/dateUtils';

const userCol = (uid: string, col: string) => collection(db, 'users', uid, col);
const userDoc = (uid: string, col: string, id: string) =>
  doc(db, 'users', uid, col, id);
const settingsDocRef = (uid: string) =>
  doc(db, 'users', uid, 'settings', 'config');

function clean<T extends object>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as T;
}
const now = () => new Date().toISOString();

async function fetchSub<T>(uid: string, col: string): Promise<T[]> {
  const snap = await getDocs(userCol(uid, col));
  return snap.docs.map((d) => d.data() as T);
}

export type SettingsRecord = {
  notion: NotionConfig;
  essentials?: EssentialsConfig;
};

type PortfolioState = {
  uid: string | null;
  ready: boolean;
  investments: Investment[];
  snapshots: PortfolioSnapshot[];
  liabilities: Liability[];
  cashflows: CashflowEntry[];
  goals: Goal[];
  networthSnapshots: NetWorthSnapshot[];
  latestInsight: InsightSnapshot | null;
  notion: NotionConfig;
  essentials: EssentialsConfig;
  accounts: Account[];
  soldTrades: SoldTrade[];
  insurancePolicies: InsurancePolicy[]; // <-- Added
  sipPlans: any[]; // Monthly SIP plan (Firestore)
  _lastSnapshotDate: string | null;

  hydrate: (uid: string) => Promise<void>;
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

  // <-- Added Insurance CRUD methods
  addInsurancePolicy: (
    policy: Omit<InsurancePolicy, 'id' | 'createdAt' | 'updatedAt' | 'userId'>,
  ) => Promise<void>;
  updateInsurancePolicy: (
    id: string,
    patch: Partial<InsurancePolicy>,
  ) => Promise<void>;
  deleteInsurancePolicy: (id: string) => Promise<void>;

  // Monthly SIP Plan
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
  cashflows: [],
  goals: [],
  networthSnapshots: [],
  latestInsight: null,
  notion: DEFAULT_NOTION,
  essentials: DEFAULT_ESSENTIALS,
  accounts: [],
  soldTrades: [],
  insurancePolicies: [], // <-- Initial state added
  sipPlans: [],
  _lastSnapshotDate: null,

  hydrate: async (uid) => {
    set({ uid });
    try {
      const [
        investments,
        snapshots,
        liabilities,
        cashflows,
        goals,
        networthSnapshots,
        insights,
        accounts,
        soldTrades,
        insurancePolicies, // <-- Added to Promise.all
        sipPlans,
      ] = await Promise.all([
        fetchSub<Investment>(uid, 'investments'),
        fetchSub<PortfolioSnapshot>(uid, 'snapshots'),
        fetchSub<Liability>(uid, 'liabilities'),
        fetchSub<CashflowEntry>(uid, 'cashflows'),
        fetchSub<Goal>(uid, 'goals'),
        fetchSub<NetWorthSnapshot>(uid, 'networthSnapshots'),
        fetchSub<InsightSnapshot>(uid, 'insights'),
        fetchSub<Account>(uid, 'accounts'),
        fetchSub<SoldTrade>(uid, 'soldTrades'),
        fetchSub<InsurancePolicy>(uid, 'insurancePolicies'), // <-- Added fetching
        fetchSub<any>(uid, 'sipPlans'),
      ]);

      const settingsSnap = await getDoc(settingsDocRef(uid));
      const settings: SettingsRecord = settingsSnap.exists()
        ? (settingsSnap.data() as SettingsRecord)
        : { notion: DEFAULT_NOTION, essentials: DEFAULT_ESSENTIALS };

      const sortedSnapshots = snapshots.sort((a, b) =>
        a.date.localeCompare(b.date),
      );
      const today = todayISO();
      const alreadySnappedToday = sortedSnapshots.some((s) => s.date === today);

      set({
        ready: true,
        investments: investments.sort((a, b) =>
          b.updatedAt.localeCompare(a.updatedAt),
        ),
        snapshots: sortedSnapshots,
        liabilities: liabilities.sort((a, b) =>
          b.updatedAt.localeCompare(a.updatedAt),
        ),
        cashflows: cashflows.sort(
          (a, b) =>
            b.date.localeCompare(a.date) ||
            b.updatedAt.localeCompare(a.updatedAt),
        ),
        goals: goals.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
        networthSnapshots: networthSnapshots.sort((a, b) =>
          b.createdAt.localeCompare(a.createdAt),
        ),
        latestInsight:
          insights.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ??
          null,
        notion: settings.notion ?? DEFAULT_NOTION,
        essentials: settings.essentials ?? DEFAULT_ESSENTIALS,
        accounts: accounts.sort((a, b) =>
          b.createdAt.localeCompare(a.createdAt),
        ),
        soldTrades: soldTrades.sort((a, b) =>
          b.soldDate.localeCompare(a.soldDate),
        ),
        insurancePolicies: insurancePolicies.sort((a, b) =>
          a.renewalDate.localeCompare(b.renewalDate),
        ), // <-- Sorted policies added
        sipPlans: sipPlans.sort((a: any, b: any) =>
          (a.createdAt || '').localeCompare(b.createdAt || ''),
        ),
        _lastSnapshotDate: alreadySnappedToday ? today : null,
      });
      if (investments.length > 0) await get().recordSnapshotIfNeeded();
    } catch (err) {
      console.error('[PortfolioStore] hydrate failed:', err);
      // Always set ready so the app never stays blank after F5
      set({ ready: true });
    }
  },

  // ... (All existing Investment, Liability, Cashflow, Goal, Account methods remain exactly the same)

  addInvestment: async (investment) => {
    const uid = get().uid;
    if (!uid) return;
    const t = now();
    const withMeta = clean({
      ...investment,
      id: createId('inv'),
      createdAt: t,
      updatedAt: t,
      userId: uid,
    }) as Investment;
    await setDoc(userDoc(uid, 'investments', withMeta.id), withMeta);
    set((s) => ({ investments: [withMeta, ...s.investments] }));
    await get().recordSnapshotIfNeeded();
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
          await updateDoc(
            userDoc(uid, 'investments', match.id),
            clean({ ...draft, updatedAt: t }),
          );
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
        batch.set(userDoc(uid, 'investments', withMeta.id), withMeta);
        newDocs.push(withMeta);
        added++;
      }
    }
    if (newDocs.length > 0) {
      await batch.commit();
      set((s) => ({ investments: [...newDocs, ...s.investments] }));
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
    await setDoc(userDoc(uid, 'investments', id), updated);
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
    const t = now();
    const withMeta = clean({
      ...(liability as any),
      id: createId('lia'),
      createdAt: t,
      updatedAt: t,
      userId: uid,
    }) as Liability;
    await setDoc(userDoc(uid, 'liabilities', withMeta.id), withMeta);
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
    await setDoc(userDoc(uid, 'liabilities', id), updated);
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

  addCashflow: async (entry) => {
    const uid = get().uid;
    if (!uid) return;
    const t = now();
    const withMeta = clean({
      ...entry,
      id: createId('cf'),
      createdAt: t,
      updatedAt: t,
      userId: uid,
    }) as CashflowEntry;
    await setDoc(userDoc(uid, 'cashflows', withMeta.id), withMeta);
    set((s) => ({
      cashflows: [withMeta, ...s.cashflows].sort((a, b) =>
        b.date.localeCompare(a.date),
      ),
    }));
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
    await setDoc(userDoc(uid, 'cashflows', id), updated);
    set((s) => ({
      cashflows: s.cashflows.map((x) => (x.id === id ? updated : x)),
    }));
  },
  deleteCashflow: async (id) => {
    const uid = get().uid;
    if (!uid) return;
    await deleteDoc(userDoc(uid, 'cashflows', id));
    set((s) => ({ cashflows: s.cashflows.filter((x) => x.id !== id) }));
  },

  addGoal: async (goal) => {
    const uid = get().uid;
    if (!uid) return;
    const t = now();
    const withMeta = clean({
      ...(goal as any),
      id: createId('goal'),
      createdAt: t,
      updatedAt: t,
      userId: uid,
    }) as Goal;
    await setDoc(userDoc(uid, 'goals', withMeta.id), withMeta);
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
    await setDoc(userDoc(uid, 'goals', id), updated);
    set((s) => ({ goals: s.goals.map((x) => (x.id === id ? updated : x)) }));
  },
  deleteGoal: async (id) => {
    const uid = get().uid;
    if (!uid) return;
    await deleteDoc(userDoc(uid, 'goals', id));
    set((s) => ({ goals: s.goals.filter((x) => x.id !== id) }));
  },

  addAccount: async (account) => {
    const uid = get().uid;
    if (!uid) return;
    const t = now();
    const raw = clean({
      ...account,
      id: createId('acc'),
      createdAt: t,
      updatedAt: t,
      userId: uid,
    }) as Account;
    await setDoc(userDoc(uid, 'accounts', raw.id), raw);
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
    await setDoc(userDoc(uid, 'accounts', id), raw);
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
    await setDoc(userDoc(uid, 'soldTrades', raw.id), raw);
    set((s) => ({
      soldTrades: [raw, ...s.soldTrades].sort((a, b) =>
        b.soldDate.localeCompare(a.soldDate),
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
    await setDoc(userDoc(uid, 'soldTrades', id), updated);
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

  // ── INSURANCE CRUD ADDED HERE ──
  addInsurancePolicy: async (policy) => {
    const uid = get().uid;
    if (!uid) return;
    const t = now();
    const withMeta = clean({
      ...policy,
      id: createId('ins_pol'),
      createdAt: t,
      updatedAt: t,
      userId: uid,
    }) as InsurancePolicy;
    await setDoc(userDoc(uid, 'insurancePolicies', withMeta.id), withMeta);
    set((s) => ({
      insurancePolicies: [withMeta, ...s.insurancePolicies].sort((a, b) =>
        a.renewalDate.localeCompare(b.renewalDate),
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
    await setDoc(userDoc(uid, 'insurancePolicies', id), updated);
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

  // ── Monthly SIP Plan CRUD ──────────────────────────────────────────────────
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
    await setDoc(userDoc(uid, 'sipPlans', item.id), item);
    set((s) => ({ sipPlans: [...s.sipPlans, item] }));
  },
  updateSipInstrument: async (id, patch) => {
    const uid = get().uid;
    if (!uid) return;
    const existing = get().sipPlans.find((x: any) => x.id === id);
    if (!existing) return;
    const updated = clean({ ...existing, ...patch, id, updatedAt: now() });
    await setDoc(userDoc(uid, 'sipPlans', id), updated);
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
      await setDoc(userDoc(uid, 'sipPlans', existing.id), updated);
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
      await setDoc(userDoc(uid, 'sipPlans', item.id), item);
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

  // ───────────────────────────────

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
    const existing = get().snapshots.find((x) => x.date === date);
    if (existing) {
      const updated: PortfolioSnapshot = { ...existing, totalValue };
      await setDoc(userDoc(uid, 'snapshots', updated.id), updated);
      set((s) => ({
        snapshots: s.snapshots.map((x) => (x.id === updated.id ? updated : x)),
        _lastSnapshotDate: date,
      }));
      return;
    }
    const snap = clean({
      id: createId('snap'),
      date,
      totalValue,
      userId: uid,
    }) as any;
    await setDoc(userDoc(uid, 'snapshots', snap.id), snap);
    set((s) => ({
      snapshots: [...s.snapshots, snap as PortfolioSnapshot].sort((a, b) =>
        a.date.localeCompare(b.date),
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
    const { totalValue } = summarizePortfolio(get().investments);
    const totalLiabilities = get().liabilities.reduce(
      (acc, l) => acc + (l.outstanding || 0),
      0,
    );
    const t = now();
    const snap: NetWorthSnapshot = {
      id: createId('nws'),
      createdAt: t,
      totalAssets: totalValue,
      totalLiabilities,
      netWorth: totalValue - totalLiabilities,
      userId: uid,
      ...(label?.trim() ? { label: label.trim() } : {}),
    };
    await setDoc(userDoc(uid, 'networthSnapshots', snap.id), snap);
    set((s) => ({ networthSnapshots: [snap, ...s.networthSnapshots] }));
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
    await setDoc(userDoc(uid, 'insights', snapshot.id), snapshot);
    set({ latestInsight: snapshot });
  },

  clearAllData: async () => {
    const uid = get().uid;
    if (!uid) return;
    const subCollections = [
      'investments',
      'liabilities',
      'cashflows',
      'goals',
      'snapshots',
      'networthSnapshots',
      'insights',
      'accounts',
      'agriFields',
      'agriCropCycles',
      'agriExpenses',
      'agriLivestock',
      'agriMilkRecords',
      'agriCoconut',
      'agriLivestockEvents',
      'soldTrades',
      'insurancePolicies', // <-- Added to wipeout list
      'sipPlans',
      // Attendance collections
      'attEmployees',
      'attRecords',
      'attTransactions',
      'attSalary',
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
        cashflows: [],
        goals: [],
        networthSnapshots: [],
        latestInsight: null,
        notion: { enabled: false },
        essentials: {},
        accounts: [],
        soldTrades: [],
        insurancePolicies: [], // <-- Cleared locally
        sipPlans: [],
        _lastSnapshotDate: null,
      });
    } catch (error) {
      console.error('Cloud wipe failed:', error);
      throw error;
    }
  },
}));
