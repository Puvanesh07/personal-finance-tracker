import type {
  CashflowEntry,
  EssentialsConfig,
  Goal,
  InsightSnapshot,
  Investment,
  Liability,
  NetWorthSnapshot,
  NotionConfig,
  PortfolioSnapshot,
} from '../types/investmentTypes';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

import { create } from 'zustand';
import { createId } from '../utils/id';
import { db } from '../services/firebase';
import { summarizePortfolio } from '../utils/calculations';
import { todayISO } from '../utils/dateUtils';

export type SettingsRecord = {
  id: string;
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

  hydrate: (uid: string) => Promise<void>;
  addInvestment: (
    investment: Omit<Investment, 'id' | 'createdAt' | 'updatedAt'>,
  ) => Promise<void>;

  // ✅ Add this right here!
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

async function fetchUserCollection<T>(
  collectionName: string,
  uid: string,
): Promise<T[]> {
  const q = query(collection(db, collectionName), where('userId', '==', uid));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => doc.data() as T);
}

export const usePortfolioStore = create<PortfolioState>((set, get) => ({
  uid: null,
  ready: false,
  investments: [],
  snapshots: [],
  liabilities: [],
  cashflows: [],
  goals: [],
  networthSnapshots: [],
  latestInsight: null, // Initial state
  notion: DEFAULT_NOTION,
  essentials: DEFAULT_ESSENTIALS,

  hydrate: async (uid: string) => {
    set({ uid });
    const [
      investments,
      snapshots,
      liabilities,
      cashflows,
      goals,
      networthSnapshots,
      insights, // Added
    ] = await Promise.all([
      fetchUserCollection<Investment>('investments', uid),
      fetchUserCollection<PortfolioSnapshot>('snapshots', uid),
      fetchUserCollection<Liability>('liabilities', uid),
      fetchUserCollection<CashflowEntry>('cashflows', uid),
      fetchUserCollection<Goal>('goals', uid),
      fetchUserCollection<NetWorthSnapshot>('networthSnapshots', uid),
      fetchUserCollection<InsightSnapshot>('insights', uid), // Added
    ]);

    const settingsDoc = await getDoc(doc(db, 'settings', uid));
    const settings = settingsDoc.exists()
      ? (settingsDoc.data() as SettingsRecord)
      : ({
          id: uid,
          notion: DEFAULT_NOTION,
          essentials: DEFAULT_ESSENTIALS,
        } as SettingsRecord);

    set({
      ready: true,
      investments: investments.sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt),
      ),
      snapshots: snapshots.sort((a, b) => a.date.localeCompare(b.date)),
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
      // Sort insights and pick the most recent one
      latestInsight:
        insights.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ||
        null,
      notion: settings.notion ?? DEFAULT_NOTION,
      essentials: settings.essentials ?? DEFAULT_ESSENTIALS,
    });

    if (investments.length > 0) {
      await get().recordSnapshotIfNeeded();
    }
  },

  saveInsightSnapshot: async (data) => {
    const uid = get().uid;
    if (!uid) return;
    const now = new Date().toISOString();

    const raw: InsightSnapshot = {
      ...data,
      id: createId('ins'),
      userId: uid,
      createdAt: now,
    };

    // ✅ Strip ALL undefined fields before writing to Firestore
    const snapshot = Object.fromEntries(
      Object.entries(raw).filter(([_, v]) => v !== undefined),
    ) as InsightSnapshot;

    await setDoc(doc(db, 'insights', snapshot.id), snapshot);
    set({ latestInsight: snapshot });
  },

  addInvestment: async (investment) => {
    const uid = get().uid;
    if (!uid) return;
    const now = new Date().toISOString();

    const raw = {
      ...investment,
      id: createId('inv'),
      createdAt: now,
      updatedAt: now,
      userId: uid,
    };

    // ✅ Strip ALL undefined fields before writing to Firestore
    const withMeta: any = Object.fromEntries(
      Object.entries(raw).filter(([_, v]) => v !== undefined),
    ) as any;

    await setDoc(doc(db, 'investments', withMeta.id), withMeta);
    set((s) => ({ investments: [withMeta, ...s.investments] }));
    await get().recordSnapshotIfNeeded();
  },

  // Add this to your PortfolioState type in portfolioStore.ts
  // importInvestments: (drafts: any[]) => Promise<{ added: number; updated: number; skipped: number }>;

  importInvestments: async (drafts: any[]) => {
    const uid = get().uid;
    if (!uid) return { added: 0, updated: 0, skipped: 0 };

    const existingInvestments = get().investments;
    let added = 0;
    let updated = 0;
    let skipped = 0;

    for (const draft of drafts) {
      // 1. Find if this asset already exists (Key: Name + Type + Platform)
      const existing = existingInvestments.find(
        (inv) =>
          inv.name === draft.name &&
          inv.type === draft.type &&
          inv.platform === draft.platform,
      );

      if (existing) {
        // 2. Check for changes in key data points
        const hasChanged =
          ('quantity' in draft &&
            draft.quantity !== (existing as any).quantity) ||
          ('units' in draft && draft.units !== (existing as any).units) ||
          ('buyPrice' in draft &&
            draft.buyPrice !== (existing as any).buyPrice) ||
          ('investedAmount' in draft &&
            draft.investedAmount !== (existing as any).investedAmount) ||
          ('currentPrice' in draft &&
            draft.currentPrice !== (existing as any).currentPrice) ||
          ('nav' in draft && draft.nav !== (existing as any).nav);

        if (hasChanged) {
          // Update existing record
          await get().updateInvestment(existing.id, draft);
          updated++;
        } else {
          // Exactly the same - skip to avoid duplicates
          skipped++;
        }
      } else {
        // 3. New asset - add it
        await get().addInvestment(draft);
        added++;
      }
    }

    return { added, updated, skipped };
  },

  updateInvestment: async (id, patch) => {
    const existing = get().investments.find((x) => x.id === id);
    if (!existing) return;

    const raw = {
      ...existing,
      ...patch,
      id,
      updatedAt: new Date().toISOString(),
    };

    // ✅ Strip ALL undefined fields before writing to Firestore
    const updated = Object.fromEntries(
      Object.entries(raw).filter(([_, v]) => v !== undefined),
    ) as Investment;

    await setDoc(doc(db, 'investments', id), updated);
    set((s) => ({
      investments: s.investments.map((x) => (x.id === id ? updated : x)),
    }));
    await get().recordSnapshotIfNeeded();
  },

  deleteInvestment: async (id) => {
    await deleteDoc(doc(db, 'investments', id));
    set((s) => ({ investments: s.investments.filter((x) => x.id !== id) }));
    await get().recordSnapshotIfNeeded();
  },

  addLiability: async (liability) => {
    const uid = get().uid;
    if (!uid) return;
    const now = new Date().toISOString();
    const withMeta: any = {
      ...(liability as any),
      id: createId('lia'),
      createdAt: now,
      updatedAt: now,
      userId: uid,
    };
    await setDoc(doc(db, 'liabilities', withMeta.id), withMeta);
    set((s) => ({ liabilities: [withMeta as Liability, ...s.liabilities] }));
  },

  updateLiability: async (id, patch) => {
    const existing = get().liabilities.find((x) => x.id === id);
    if (!existing) return;
    const updated: Liability = {
      ...existing,
      ...(patch as any),
      id,
      updatedAt: new Date().toISOString(),
    };
    await setDoc(doc(db, 'liabilities', id), updated);
    set((s) => ({
      liabilities: s.liabilities.map((x) => (x.id === id ? updated : x)),
    }));
  },

  deleteLiability: async (id) => {
    await deleteDoc(doc(db, 'liabilities', id));
    set((s) => ({ liabilities: s.liabilities.filter((x) => x.id !== id) }));
  },

  addCashflow: async (entry) => {
    const uid = get().uid;
    if (!uid) return;
    const now = new Date().toISOString();

    const raw = {
      ...entry,
      id: createId('cf'),
      createdAt: now,
      updatedAt: now,
      userId: uid,
    };

    // ✅ Strip ALL undefined fields before writing to Firestore
    const withMeta = Object.fromEntries(
      Object.entries(raw).filter(([_, v]) => v !== undefined),
    ) as CashflowEntry;

    await setDoc(doc(db, 'cashflows', withMeta.id), withMeta);

    // Update local state and sort so newest are at the top
    set((s) => ({
      cashflows: [withMeta, ...s.cashflows].sort((a, b) =>
        b.date.localeCompare(a.date),
      ),
    }));
  },

  updateCashflow: async (id, patch) => {
    const existing = get().cashflows.find((x) => x.id === id);
    if (!existing) return;

    const raw = {
      ...existing,
      ...patch,
      id,
      updatedAt: new Date().toISOString(),
    };

    // ✅ Strip ALL undefined fields before writing to Firestore
    const updated = Object.fromEntries(
      Object.entries(raw).filter(([_, v]) => v !== undefined),
    ) as CashflowEntry;

    await setDoc(doc(db, 'cashflows', id), updated);
    set((s) => ({
      cashflows: s.cashflows.map((x) => (x.id === id ? updated : x)),
    }));
  },

  deleteCashflow: async (id) => {
    await deleteDoc(doc(db, 'cashflows', id));
    set((s) => ({ cashflows: s.cashflows.filter((x) => x.id !== id) }));
  },

  addGoal: async (goal) => {
    const uid = get().uid;
    if (!uid) return;
    const now = new Date().toISOString();
    const withMeta: any = {
      ...(goal as any),
      id: createId('goal'),
      createdAt: now,
      updatedAt: now,
      userId: uid,
    };
    await setDoc(doc(db, 'goals', withMeta.id), withMeta);
    set((s) => ({ goals: [withMeta as Goal, ...s.goals] }));
  },

  updateGoal: async (id, patch) => {
    const existing = get().goals.find((x) => x.id === id);
    if (!existing) return;
    const updated: Goal = {
      ...existing,
      ...(patch as any),
      id,
      updatedAt: new Date().toISOString(),
    };
    await setDoc(doc(db, 'goals', id), updated);
    set((s) => ({ goals: s.goals.map((x) => (x.id === id ? updated : x)) }));
  },

  deleteGoal: async (id) => {
    await deleteDoc(doc(db, 'goals', id));
    set((s) => ({ goals: s.goals.filter((x) => x.id !== id) }));
  },

  clearAllData: async () => {
    const uid = get().uid;
    if (!uid) return;

    const batch = writeBatch(db);
    const collections = [
      'investments',
      'liabilities',
      'cashflows',
      'goals',
      'snapshots',
      'networthSnapshots',
      'insights',
    ];

    try {
      // 1. Delete all user-specific documents from cloud collections
      for (const colName of collections) {
        const q = query(collection(db, colName), where('userId', '==', uid));
        const snap = await getDocs(q);
        snap.docs.forEach((doc) => batch.delete(doc.ref));
      }

      // 2. Delete specific user settings doc
      batch.delete(doc(db, 'settings', uid));

      await batch.commit();

      // 3. Reset local state
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
      });
    } catch (error) {
      console.error('Cloud wipe failed:', error);
      throw error;
    }
  },

  setNotionConfig: async (patch) => {
    const uid = get().uid;
    if (!uid) return;
    const settingsDoc = await getDoc(doc(db, 'settings', uid));
    const settings = settingsDoc.exists()
      ? (settingsDoc.data() as SettingsRecord)
      : ({
          id: uid,
          notion: DEFAULT_NOTION,
          essentials: DEFAULT_ESSENTIALS,
        } as SettingsRecord);
    const updated: SettingsRecord = {
      ...settings,
      notion: { ...settings.notion, ...patch },
    };
    await setDoc(doc(db, 'settings', uid), updated);
    set({ notion: updated.notion });
  },

  setEssentialsConfig: async (patch) => {
    const uid = get().uid;
    if (!uid) return;
    const settingsDoc = await getDoc(doc(db, 'settings', uid));
    const settings = settingsDoc.exists()
      ? (settingsDoc.data() as SettingsRecord)
      : ({
          id: uid,
          notion: DEFAULT_NOTION,
          essentials: DEFAULT_ESSENTIALS,
        } as SettingsRecord);
    const updated: SettingsRecord = {
      ...settings,
      essentials: { ...(settings.essentials ?? {}), ...patch },
    };
    await setDoc(doc(db, 'settings', uid), updated);
    set({ essentials: updated.essentials ?? DEFAULT_ESSENTIALS });
  },

  recordSnapshotIfNeeded: async () => {
    const uid = get().uid;
    if (!uid) return;
    const date = todayISO();
    const existing = get().snapshots.find((x) => x.date === date);
    const { totalValue } = summarizePortfolio(get().investments);

    if (existing) {
      const updated: PortfolioSnapshot = { ...existing, totalValue };
      await setDoc(doc(db, 'snapshots', updated.id), updated);
      set((s) => ({
        snapshots: s.snapshots.map((x) => (x.id === updated.id ? updated : x)),
      }));
      return;
    }

    const snap: any = { id: createId('snap'), date, totalValue, userId: uid };
    await setDoc(doc(db, 'snapshots', snap.id), snap);
    set((s) => ({
      snapshots: [...s.snapshots, snap as PortfolioSnapshot].sort((a, b) =>
        a.date.localeCompare(b.date),
      ),
    }));
  },

  recordSnapshotNow: async () => {
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
    const now = new Date().toISOString();

    const snap: NetWorthSnapshot = {
      id: createId('nws'),
      createdAt: now,
      totalAssets: totalValue,
      totalLiabilities,
      netWorth: totalValue - totalLiabilities,
      userId: uid,
      // ✅ Only set label if it's a non-empty string — Firestore rejects undefined
      ...(label?.trim() ? { label: label.trim() } : {}),
    };

    await setDoc(doc(db, 'networthSnapshots', snap.id), snap);
    set((s) => ({ networthSnapshots: [snap, ...s.networthSnapshots] }));
  },
}));
