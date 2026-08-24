// src/store/agricultureStore.ts

import type {
  AgriExpense,
  CoconutRecord,
  CropCycle,
  Field,
  LivestockEvent,
  MilkRecord,
  ProduceSaleLot,
} from '../types/investmentTypes';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
} from 'firebase/firestore';

import { create } from 'zustand';
import { db } from '../services/firebase';
import {
  deleteLedgerEntry,
  getDeterministicLedgerId,
  saveLedgerEntry,
} from '../services/ledgerService';
import {
  checkCanCreateTransactions,
  checkFeatureLimit,
  trialLimitMessage,
} from '../utils/subscriptionUtils';
import toast from 'react-hot-toast';

function blockIfExpired(): boolean {
  if (!checkCanCreateTransactions()) {
    toast.error('Your trial has expired. Subscribe to add new transactions.');
    return true;
  }
  return false;
}

/** Returns true (and toasts) when the agriculture trial limit is reached. */
function blockIfAgriLimited(currentTotalAgriRecords: number): boolean {
  if (!checkFeatureLimit('agriculture', currentTotalAgriRecords)) {
    toast.error(trialLimitMessage('agriculture'));
    return true;
  }
  return false;
}

const safeCompare = (a: string | undefined, b: string | undefined) =>
  (a || '').localeCompare(b || '');

/** Sum of all agri sub-collection records in state — used for limit checks. */
function totalAgriRecords(s: {
  fields: unknown[];
  cropCycles: unknown[];
  agriExpenses: unknown[];
  milkRecords: unknown[];
  coconutRecords: unknown[];
  livestockEvents: unknown[];
  produceSales: unknown[];
}): number {
  return (
    s.fields.length +
    s.cropCycles.length +
    s.agriExpenses.length +
    s.milkRecords.length +
    s.coconutRecords.length +
    s.livestockEvents.length +
    s.produceSales.length
  );
}

const agriCol = (uid: string, col: string) => collection(db, 'users', uid, col);
const agriDoc = (uid: string, col: string, id: string) =>
  doc(db, 'users', uid, col, id);

function agriId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
function clean<T extends object>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as T;
}
const now = () => new Date().toISOString();

async function fetchSub<T>(uid: string, col: string): Promise<T[]> {
  const snap = await getDocs(agriCol(uid, col));
  return snap.docs.map((d) => d.data() as T);
}

// Module-level flag — prevents concurrent hydration calls from piling up
// (e.g. DashboardAgriSummary + AgriculturePage mounting at the same time).
let _hydrating = false;

type AgriState = {
  uid: string | null;
  ready: boolean;
  hydrateError: string | null;
  fields: Field[];
  cropCycles: CropCycle[];
  agriExpenses: AgriExpense[];
  milkRecords: MilkRecord[];
  coconutRecords: CoconutRecord[];
  livestockEvents: LivestockEvent[];
  produceSales: ProduceSaleLot[];

  hydrate: (uid: string, opts?: { force?: boolean }) => Promise<void>;
  clearAll: () => void;

  addField: (
    f: Omit<Field, 'id' | 'createdAt' | 'updatedAt' | 'userId'>,
  ) => Promise<void>;
  updateField: (id: string, patch: Partial<Field>) => Promise<void>;
  deleteField: (id: string) => Promise<void>;

  addCropCycle: (
    c: Omit<CropCycle, 'id' | 'createdAt' | 'updatedAt' | 'userId'>,
  ) => Promise<void>;
  updateCropCycle: (id: string, patch: Partial<CropCycle>) => Promise<void>;
  deleteCropCycle: (id: string) => Promise<void>;

  addAgriExpense: (
    e: Omit<AgriExpense, 'id' | 'createdAt' | 'updatedAt' | 'userId'>,
  ) => Promise<string | void>;
  updateAgriExpense: (id: string, patch: Partial<AgriExpense>) => Promise<void>;
  deleteAgriExpense: (id: string) => Promise<void>;

  addMilkRecord: (
    m: Omit<MilkRecord, 'id' | 'createdAt' | 'updatedAt' | 'userId'>,
  ) => Promise<string | void>;
  updateMilkRecord: (id: string, patch: Partial<MilkRecord>) => Promise<void>;
  deleteMilkRecord: (id: string) => Promise<void>;

  addCoconutRecord: (
    c: Omit<CoconutRecord, 'id' | 'createdAt' | 'updatedAt' | 'userId'>,
  ) => Promise<string | void>;
  updateCoconutRecord: (
    id: string,
    patch: Partial<CoconutRecord>,
  ) => Promise<void>;
  deleteCoconutRecord: (id: string) => Promise<void>;

  addLivestockEvent: (
    e: Omit<LivestockEvent, 'id' | 'createdAt' | 'updatedAt' | 'userId'>,
  ) => Promise<void>;
  updateLivestockEvent: (
    id: string,
    patch: Partial<LivestockEvent>,
  ) => Promise<void>;
  deleteLivestockEvent: (id: string) => Promise<void>;

  addProduceSale: (
    p: Omit<ProduceSaleLot, 'id' | 'createdAt' | 'updatedAt' | 'userId'>,
  ) => Promise<string | void>;
  updateProduceSale: (
    id: string,
    patch: Partial<ProduceSaleLot>,
  ) => Promise<void>;
  deleteProduceSale: (id: string) => Promise<void>;
};

export const useAgriStore = create<AgriState>((set, get) => ({
  uid: null,
  ready: false,
  hydrateError: null,
  fields: [],
  cropCycles: [],
  agriExpenses: [],
  milkRecords: [],
  coconutRecords: [],
  livestockEvents: [],
  produceSales: [],

  hydrate: async (uid, opts) => {
    const { uid: currentUid, ready } = get();
    if (!opts?.force && currentUid === uid && ready) return;

    // Prevent concurrent hydrations — use a module-level flag.
    // Force calls (e.g. post-import) are always allowed through.
    if (_hydrating && !opts?.force) return;
    _hydrating = true;

    try {
      const [
        fields,
        cropCycles,
        agriExpenses,
        milkRecords,
        coconutRecords,
        livestockEvents,
        produceSales,
      ] = await Promise.all([
        fetchSub<Field>(uid, 'agriFields'),
        fetchSub<CropCycle>(uid, 'agriCropCycles'),
        fetchSub<AgriExpense>(uid, 'agriExpenses'),
        fetchSub<MilkRecord>(uid, 'agriMilkRecords'),
        fetchSub<CoconutRecord>(uid, 'agriCoconut'),
        fetchSub<LivestockEvent>(uid, 'agriLivestockEvents'),
        fetchSub<ProduceSaleLot>(uid, 'agriProduceSales'),
      ]);
      set({
        uid,
        ready: true,
        hydrateError: null,
        fields: fields.sort((a, b) => safeCompare(b.createdAt, a.createdAt)),
        cropCycles: cropCycles.sort((a, b) =>
          safeCompare(b.startDate, a.startDate),
        ),
        agriExpenses: agriExpenses.sort((a, b) => safeCompare(b.date, a.date)),
        milkRecords: milkRecords.sort((a, b) => safeCompare(b.date, a.date)),
        coconutRecords: coconutRecords.sort((a, b) =>
          safeCompare(b.date, a.date),
        ),
        livestockEvents: livestockEvents.sort((a, b) =>
          safeCompare(b.date, a.date),
        ),
        produceSales: produceSales.sort((a, b) => safeCompare(b.date, a.date)),
      });
    } catch (err) {
      console.error('[AgriStore] hydrate failed:', err);
      // Set ready:true so useEnsureAgriHydrated stops retrying and the UI
      // renders with whatever data is already in the store (or empty arrays).
      // hydrateError lets the UI show a proper error state instead of
      // looping infinitely on the loading skeleton.
      set({
        uid,
        ready: true,
        hydrateError:
          err instanceof Error ? err.message : 'Failed to load agriculture data',
      });
    } finally {
      _hydrating = false;
    }
  },

  clearAll: () => {
    _hydrating = false;
    set({
      fields: [],
      cropCycles: [],
      agriExpenses: [],
      milkRecords: [],
      coconutRecords: [],
      livestockEvents: [],
      produceSales: [],
      ready: false,
      hydrateError: null,
      uid: null,
    });
  },

  // ── Fields ────────────────────────────────────────────────────────────────
  addField: async (f) => {
    const uid = get().uid;
    if (!uid) return;
    if (blockIfExpired()) return;
    if (blockIfAgriLimited(totalAgriRecords(get()))) return;
    const t = now();
    const raw: Field = clean({
      ...f,
      id: agriId('fld'),
      userId: uid,
      createdAt: t,
      updatedAt: t,
    });
    await setDoc(agriDoc(uid, 'agriFields', raw.id), raw);
    set((s) => ({ fields: [raw, ...s.fields] }));
  },
  updateField: async (id, patch) => {
    const uid = get().uid;
    if (!uid) return;
    const ex = get().fields.find((x) => x.id === id);
    if (!ex) return;
    const raw = clean({ ...ex, ...patch, id, updatedAt: now() }) as Field;
    await setDoc(agriDoc(uid, 'agriFields', id), raw);
    set((s) => ({ fields: s.fields.map((x) => (x.id === id ? raw : x)) }));
  },
  deleteField: async (id) => {
    const uid = get().uid;
    if (!uid) return;
    await deleteDoc(agriDoc(uid, 'agriFields', id));
    set((s) => ({ fields: s.fields.filter((x) => x.id !== id) }));
  },

  // ── Crop Cycles ───────────────────────────────────────────────────────────
  addCropCycle: async (c) => {
    const uid = get().uid;
    if (!uid) return;
    if (blockIfExpired()) return;
    if (blockIfAgriLimited(totalAgriRecords(get()))) return;
    const t = now();
    const raw: CropCycle = clean({
      ...c,
      id: agriId('crp'),
      userId: uid,
      createdAt: t,
      updatedAt: t,
    });
    await setDoc(agriDoc(uid, 'agriCropCycles', raw.id), raw);
    set((s) => ({ cropCycles: [raw, ...s.cropCycles] }));
  },
  updateCropCycle: async (id, patch) => {
    const uid = get().uid;
    if (!uid) return;
    const ex = get().cropCycles.find((x) => x.id === id);
    if (!ex) return;
    const raw: CropCycle = clean({ ...ex, ...patch, id, updatedAt: now() });
    await setDoc(agriDoc(uid, 'agriCropCycles', id), raw);
    set((s) => ({
      cropCycles: s.cropCycles.map((x) => (x.id === id ? raw : x)),
    }));
  },
  deleteCropCycle: async (id) => {
    const uid = get().uid;
    if (!uid) return;
    await deleteDoc(agriDoc(uid, 'agriCropCycles', id));
    set((s) => ({ cropCycles: s.cropCycles.filter((x) => x.id !== id) }));
  },

  // ── Agri Expenses ─────────────────────────────────────────────────────────
  addAgriExpense: async (e) => {
    const uid = get().uid;
    if (!uid) return;
    if (blockIfExpired()) return;
    if (blockIfAgriLimited(totalAgriRecords(get()))) return;
    const t = now();
    const raw: AgriExpense = clean({
      ...e,
      id: agriId('aex'),
      userId: uid,
      createdAt: t,
      updatedAt: t,
    });
    await setDoc(agriDoc(uid, 'agriExpenses', raw.id), raw);

    await saveLedgerEntry(uid, {
      id: getDeterministicLedgerId('agriculture_expense', raw.id),
      type: 'expense',
      date: raw.date,
      amount: raw.amount,
      category: `Agri ${raw.category}`,
      accountId: raw.accountId,
      module: 'agriculture',
      sourceType: 'agriculture_expense',
      sourceId: raw.id,
      costCenterId: raw.cropCycleId,
      notes: raw.notes,
    });

    set((s) => ({
      agriExpenses: [raw, ...s.agriExpenses].sort((a, b) =>
        safeCompare(b.date, a.date),
      ),
    }));
    return raw.id;
  },
  updateAgriExpense: async (id, patch) => {
    const uid = get().uid;
    if (!uid) return;
    const ex = get().agriExpenses.find((x) => x.id === id);
    if (!ex) return;
    const raw: AgriExpense = clean({ ...ex, ...patch, id, updatedAt: now() });
    await setDoc(agriDoc(uid, 'agriExpenses', id), raw);

    await saveLedgerEntry(uid, {
      id: getDeterministicLedgerId('agriculture_expense', raw.id),
      type: 'expense',
      date: raw.date,
      amount: raw.amount,
      category: `Agri ${raw.category}`,
      accountId: raw.accountId,
      module: 'agriculture',
      sourceType: 'agriculture_expense',
      sourceId: raw.id,
      costCenterId: raw.cropCycleId,
      notes: raw.notes,
    });

    set((s) => ({
      agriExpenses: s.agriExpenses.map((x) => (x.id === id ? raw : x)),
    }));
  },
  deleteAgriExpense: async (id) => {
    const uid = get().uid;
    if (!uid) return;
    await deleteDoc(agriDoc(uid, 'agriExpenses', id));
    await deleteLedgerEntry(uid, getDeterministicLedgerId('agriculture_expense', id));
    set((s) => ({ agriExpenses: s.agriExpenses.filter((x) => x.id !== id) }));
  },

  // ── Milk ──────────────────────────────────────────────────────────────────
  addMilkRecord: async (m) => {
    const uid = get().uid;
    if (!uid) return;
    if (blockIfExpired()) return;
    if (blockIfAgriLimited(totalAgriRecords(get()))) return;
    const t = now();
    const raw: MilkRecord = clean({
      ...m,
      id: agriId('mlk'),
      userId: uid,
      createdAt: t,
      updatedAt: t,
    });
    await setDoc(agriDoc(uid, 'agriMilkRecords', raw.id), raw);

    await saveLedgerEntry(uid, {
      id: getDeterministicLedgerId('dairy_sale', raw.id),
      type: 'income',
      date: raw.date,
      amount: raw.liters * raw.pricePerLiter,
      category: 'Dairy Milk Sale',
      accountId: raw.accountId,
      module: 'agriculture',
      sourceType: 'dairy_sale',
      sourceId: raw.id,
      notes: `Dairy ${raw.session ?? ''} ${raw.liters}L x ₹${raw.pricePerLiter}`,
    });

    set((s) => ({
      milkRecords: [raw, ...s.milkRecords].sort((a, b) =>
        safeCompare(b.date, a.date),
      ),
    }));
    return raw.id;
  },
  updateMilkRecord: async (id, patch) => {
    const uid = get().uid;
    if (!uid) return;
    const ex = get().milkRecords.find((x) => x.id === id);
    if (!ex) return;
    const raw: MilkRecord = clean({ ...ex, ...patch, id, updatedAt: now() });
    await setDoc(agriDoc(uid, 'agriMilkRecords', id), raw);

    await saveLedgerEntry(uid, {
      id: getDeterministicLedgerId('dairy_sale', raw.id),
      type: 'income',
      date: raw.date,
      amount: raw.liters * raw.pricePerLiter,
      category: 'Dairy Milk Sale',
      accountId: raw.accountId,
      module: 'agriculture',
      sourceType: 'dairy_sale',
      sourceId: raw.id,
      notes: `Dairy ${raw.session ?? ''} ${raw.liters}L x ₹${raw.pricePerLiter}`,
    });

    set((s) => ({
      milkRecords: s.milkRecords.map((x) => (x.id === id ? raw : x)),
    }));
  },
  deleteMilkRecord: async (id) => {
    const uid = get().uid;
    if (!uid) return;
    await deleteDoc(agriDoc(uid, 'agriMilkRecords', id));
    await deleteLedgerEntry(uid, getDeterministicLedgerId('dairy_sale', id));
    set((s) => ({ milkRecords: s.milkRecords.filter((x) => x.id !== id) }));
  },

  // ── Coconut ───────────────────────────────────────────────────────────────
  addCoconutRecord: async (c) => {
    const uid = get().uid;
    if (!uid) return;
    if (blockIfExpired()) return;
    if (blockIfAgriLimited(totalAgriRecords(get()))) return;
    const t = now();
    const raw: CoconutRecord = clean({
      ...c,
      id: agriId('coc'),
      userId: uid,
      createdAt: t,
      updatedAt: t,
    });
    await setDoc(agriDoc(uid, 'agriCoconut', raw.id), raw);

    if (raw.harvestIncome > 0) {
      await saveLedgerEntry(uid, {
        id: getDeterministicLedgerId('coconut_income', raw.id),
        type: 'income',
        date: raw.date,
        amount: raw.harvestIncome,
        category: 'Coconut Harvest Income',
        accountId: raw.accountId,
        module: 'agriculture',
        sourceType: 'coconut_income',
        sourceId: raw.id,
        notes: raw.notes,
      });
    }
    if (raw.investmentAmount > 0) {
      await saveLedgerEntry(uid, {
        id: getDeterministicLedgerId('coconut_expense', raw.id),
        type: 'expense',
        date: raw.date,
        amount: raw.investmentAmount,
        category: 'Coconut Investment Expense',
        accountId: raw.accountId,
        module: 'agriculture',
        sourceType: 'coconut_expense',
        sourceId: raw.id,
        notes: raw.notes,
      });
    }

    set((s) => ({
      coconutRecords: [raw, ...s.coconutRecords].sort((a, b) =>
        safeCompare(b.date, a.date),
      ),
    }));
    return raw.id;
  },
  updateCoconutRecord: async (id, patch) => {
    const uid = get().uid;
    if (!uid) return;
    const ex = get().coconutRecords.find((x) => x.id === id);
    if (!ex) return;
    const raw: CoconutRecord = clean({ ...ex, ...patch, id, updatedAt: now() });
    await setDoc(agriDoc(uid, 'agriCoconut', id), raw);

    if (raw.harvestIncome > 0) {
      await saveLedgerEntry(uid, {
        id: getDeterministicLedgerId('coconut_income', raw.id),
        type: 'income',
        date: raw.date,
        amount: raw.harvestIncome,
        category: 'Coconut Harvest Income',
        accountId: raw.accountId,
        module: 'agriculture',
        sourceType: 'coconut_income',
        sourceId: raw.id,
        notes: raw.notes,
      });
    } else {
      await deleteLedgerEntry(uid, getDeterministicLedgerId('coconut_income', raw.id));
    }
    if (raw.investmentAmount > 0) {
      await saveLedgerEntry(uid, {
        id: getDeterministicLedgerId('coconut_expense', raw.id),
        type: 'expense',
        date: raw.date,
        amount: raw.investmentAmount,
        category: 'Coconut Investment Expense',
        accountId: raw.accountId,
        module: 'agriculture',
        sourceType: 'coconut_expense',
        sourceId: raw.id,
        notes: raw.notes,
      });
    } else {
      await deleteLedgerEntry(uid, getDeterministicLedgerId('coconut_expense', raw.id));
    }

    set((s) => ({
      coconutRecords: s.coconutRecords.map((x) => (x.id === id ? raw : x)),
    }));
  },
  deleteCoconutRecord: async (id) => {
    const uid = get().uid;
    if (!uid) return;
    await deleteDoc(agriDoc(uid, 'agriCoconut', id));
    await deleteLedgerEntry(uid, getDeterministicLedgerId('coconut_income', id));
    await deleteLedgerEntry(uid, getDeterministicLedgerId('coconut_expense', id));
    set((s) => ({
      coconutRecords: s.coconutRecords.filter((x) => x.id !== id),
    }));
  },

  // ── Livestock Events ──────────────────────────────────────────────────────
  addLivestockEvent: async (e) => {
    const uid = get().uid;
    if (!uid) return;
    if (blockIfExpired()) return;
    if (blockIfAgriLimited(totalAgriRecords(get()))) return;
    const t = now();
    const raw: LivestockEvent = clean({
      ...e,
      id: agriId('lve'),
      userId: uid,
      createdAt: t,
      updatedAt: t,
    });
    await setDoc(agriDoc(uid, 'agriLivestockEvents', raw.id), raw);

    if (raw.eventType === 'sale' && (raw.price ?? 0) > 0) {
      await saveLedgerEntry(uid, {
        id: getDeterministicLedgerId('livestock', `${raw.id}_sale`),
        type: 'income',
        date: raw.date,
        amount: raw.price!,
        category: `Livestock Sale - ${raw.animalType}`,
        accountId: raw.accountId,
        module: 'agriculture',
        sourceType: 'livestock',
        sourceId: raw.id,
        notes: raw.notes,
      });
    } else if (raw.eventType === 'purchase' && (raw.price ?? 0) > 0) {
      await saveLedgerEntry(uid, {
        id: getDeterministicLedgerId('livestock', `${raw.id}_purchase`),
        type: 'expense',
        date: raw.date,
        amount: raw.price!,
        category: `Livestock Purchase - ${raw.animalType}`,
        accountId: raw.accountId,
        module: 'agriculture',
        sourceType: 'livestock',
        sourceId: raw.id,
        notes: raw.notes,
      });
    }

    set((s) => ({
      livestockEvents: [raw, ...s.livestockEvents].sort((a, b) =>
        safeCompare(b.date, a.date),
      ),
    }));
  },
  updateLivestockEvent: async (id, patch) => {
    const uid = get().uid;
    if (!uid) return;
    const ex = get().livestockEvents.find((x) => x.id === id);
    if (!ex) return;
    const raw: LivestockEvent = clean({
      ...ex,
      ...patch,
      id,
      updatedAt: now(),
    });
    await setDoc(agriDoc(uid, 'agriLivestockEvents', id), raw);

    if (raw.eventType === 'sale' && (raw.price ?? 0) > 0) {
      await saveLedgerEntry(uid, {
        id: getDeterministicLedgerId('livestock', `${raw.id}_sale`),
        type: 'income',
        date: raw.date,
        amount: raw.price!,
        category: `Livestock Sale - ${raw.animalType}`,
        accountId: raw.accountId,
        module: 'agriculture',
        sourceType: 'livestock',
        sourceId: raw.id,
        notes: raw.notes,
      });
      await deleteLedgerEntry(uid, getDeterministicLedgerId('livestock', `${raw.id}_purchase`));
    } else if (raw.eventType === 'purchase' && (raw.price ?? 0) > 0) {
      await saveLedgerEntry(uid, {
        id: getDeterministicLedgerId('livestock', `${raw.id}_purchase`),
        type: 'expense',
        date: raw.date,
        amount: raw.price!,
        category: `Livestock Purchase - ${raw.animalType}`,
        accountId: raw.accountId,
        module: 'agriculture',
        sourceType: 'livestock',
        sourceId: raw.id,
        notes: raw.notes,
      });
      await deleteLedgerEntry(uid, getDeterministicLedgerId('livestock', `${raw.id}_sale`));
    }

    set((s) => ({
      livestockEvents: s.livestockEvents.map((x) => (x.id === id ? raw : x)),
    }));
  },
  deleteLivestockEvent: async (id) => {
    const uid = get().uid;
    if (!uid) return;
    await deleteDoc(agriDoc(uid, 'agriLivestockEvents', id));
    await deleteLedgerEntry(uid, getDeterministicLedgerId('livestock', `${id}_sale`));
    await deleteLedgerEntry(uid, getDeterministicLedgerId('livestock', `${id}_purchase`));
    set((s) => ({
      livestockEvents: s.livestockEvents.filter((x) => x.id !== id),
    }));
  },

  // ── Produce Sales ─────────────────────────────────────────────────────────
  addProduceSale: async (p) => {
    const uid = get().uid;
    if (!uid) return;
    if (blockIfExpired()) return;
    if (blockIfAgriLimited(totalAgriRecords(get()))) return;
    const t = now();
    const raw: ProduceSaleLot = clean({
      ...p,
      id: agriId('prd'),
      userId: uid,
      createdAt: t,
      updatedAt: t,
    });
    await setDoc(agriDoc(uid, 'agriProduceSales', raw.id), raw);

    await saveLedgerEntry(uid, {
      id: getDeterministicLedgerId('agriculture_sale', raw.id),
      type: 'income',
      date: raw.date,
      amount: raw.totalAmount,
      category: `Crop Sale - ${raw.produceName}`,
      accountId: raw.accountId,
      module: 'agriculture',
      sourceType: 'agriculture_sale',
      sourceId: raw.id,
      notes: raw.notes,
    });

    set((s) => ({
      produceSales: [raw, ...s.produceSales].sort((a, b) =>
        safeCompare(b.date, a.date),
      ),
    }));
    return raw.id;
  },
  updateProduceSale: async (id, patch) => {
    const uid = get().uid;
    if (!uid) return;
    const ex = get().produceSales.find((x) => x.id === id);
    if (!ex) return;
    const raw: ProduceSaleLot = clean({
      ...ex,
      ...patch,
      id,
      updatedAt: now(),
    });
    await setDoc(agriDoc(uid, 'agriProduceSales', id), raw);

    await saveLedgerEntry(uid, {
      id: getDeterministicLedgerId('agriculture_sale', raw.id),
      type: 'income',
      date: raw.date,
      amount: raw.totalAmount,
      category: `Crop Sale - ${raw.produceName}`,
      accountId: raw.accountId,
      module: 'agriculture',
      sourceType: 'agriculture_sale',
      sourceId: raw.id,
      notes: raw.notes,
    });

    set((s) => ({
      produceSales: s.produceSales.map((x) => (x.id === id ? raw : x)),
    }));
  },
  deleteProduceSale: async (id) => {
    const uid = get().uid;
    if (!uid) return;
    await deleteDoc(agriDoc(uid, 'agriProduceSales', id));
    await deleteLedgerEntry(uid, getDeterministicLedgerId('agriculture_sale', id));
    set((s) => ({
      produceSales: s.produceSales.filter((x) => x.id !== id),
    }));
  },
}));
