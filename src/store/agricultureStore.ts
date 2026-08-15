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
import { checkCanCreateTransactions } from '../utils/subscriptionUtils';
import toast from 'react-hot-toast';

function blockIfExpired(): boolean {
  if (!checkCanCreateTransactions()) {
    toast.error('Your trial has expired. Subscribe to add new transactions.');
    return true;
  }
  return false;
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

type AgriState = {
  uid: string | null;
  ready: boolean;
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
        fields: fields.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        cropCycles: cropCycles.sort((a, b) =>
          b.startDate.localeCompare(a.startDate),
        ),
        agriExpenses: agriExpenses.sort((a, b) => b.date.localeCompare(a.date)),
        milkRecords: milkRecords.sort((a, b) => b.date.localeCompare(a.date)),
        coconutRecords: coconutRecords.sort((a, b) =>
          b.date.localeCompare(a.date),
        ),
        livestockEvents: livestockEvents.sort((a, b) =>
          b.date.localeCompare(a.date),
        ),
        produceSales: produceSales.sort((a, b) => b.date.localeCompare(a.date)),
      });
    } catch (err) {
      console.error('[AgriStore] hydrate failed:', err);
      set({ uid, ready: false });
    }
  },

  clearAll: () =>
    set({
      fields: [],
      cropCycles: [],
      agriExpenses: [],
      milkRecords: [],
      coconutRecords: [],
      livestockEvents: [],
      produceSales: [],
      ready: false,
      uid: null,
    }),

  // ── Fields ────────────────────────────────────────────────────────────────
  addField: async (f) => {
    const uid = get().uid;
    if (!uid) return;
    if (blockIfExpired()) return;
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
    const t = now();
    const raw: AgriExpense = clean({
      ...e,
      id: agriId('aex'),
      userId: uid,
      createdAt: t,
      updatedAt: t,
    });
    await setDoc(agriDoc(uid, 'agriExpenses', raw.id), raw);
    set((s) => ({
      agriExpenses: [raw, ...s.agriExpenses].sort((a, b) =>
        b.date.localeCompare(a.date),
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
    set((s) => ({
      agriExpenses: s.agriExpenses.map((x) => (x.id === id ? raw : x)),
    }));
  },
  deleteAgriExpense: async (id) => {
    const uid = get().uid;
    if (!uid) return;
    await deleteDoc(agriDoc(uid, 'agriExpenses', id));
    set((s) => ({ agriExpenses: s.agriExpenses.filter((x) => x.id !== id) }));
  },

  // ── Milk ──────────────────────────────────────────────────────────────────
  addMilkRecord: async (m) => {
    const uid = get().uid;
    if (!uid) return;
    if (blockIfExpired()) return;
    const t = now();
    const raw: MilkRecord = clean({
      ...m,
      id: agriId('mlk'),
      userId: uid,
      createdAt: t,
      updatedAt: t,
    });
    await setDoc(agriDoc(uid, 'agriMilkRecords', raw.id), raw);
    set((s) => ({
      milkRecords: [raw, ...s.milkRecords].sort((a, b) =>
        b.date.localeCompare(a.date),
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
    set((s) => ({
      milkRecords: s.milkRecords.map((x) => (x.id === id ? raw : x)),
    }));
  },
  deleteMilkRecord: async (id) => {
    const uid = get().uid;
    if (!uid) return;
    await deleteDoc(agriDoc(uid, 'agriMilkRecords', id));
    set((s) => ({ milkRecords: s.milkRecords.filter((x) => x.id !== id) }));
  },

  // ── Coconut ───────────────────────────────────────────────────────────────
  addCoconutRecord: async (c) => {
    const uid = get().uid;
    if (!uid) return;
    if (blockIfExpired()) return;
    const t = now();
    const raw: CoconutRecord = clean({
      ...c,
      id: agriId('coc'),
      userId: uid,
      createdAt: t,
      updatedAt: t,
    });
    await setDoc(agriDoc(uid, 'agriCoconut', raw.id), raw);
    set((s) => ({
      coconutRecords: [raw, ...s.coconutRecords].sort((a, b) =>
        b.date.localeCompare(a.date),
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
    set((s) => ({
      coconutRecords: s.coconutRecords.map((x) => (x.id === id ? raw : x)),
    }));
  },
  deleteCoconutRecord: async (id) => {
    const uid = get().uid;
    if (!uid) return;
    await deleteDoc(agriDoc(uid, 'agriCoconut', id));
    set((s) => ({
      coconutRecords: s.coconutRecords.filter((x) => x.id !== id),
    }));
  },

  // ── Livestock Events ──────────────────────────────────────────────────────
  addLivestockEvent: async (e) => {
    const uid = get().uid;
    if (!uid) return;
    if (blockIfExpired()) return;
    const t = now();
    const raw: LivestockEvent = clean({
      ...e,
      id: agriId('lve'),
      userId: uid,
      createdAt: t,
      updatedAt: t,
    });
    await setDoc(agriDoc(uid, 'agriLivestockEvents', raw.id), raw);
    set((s) => ({
      livestockEvents: [raw, ...s.livestockEvents].sort((a, b) =>
        b.date.localeCompare(a.date),
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
    set((s) => ({
      livestockEvents: s.livestockEvents.map((x) => (x.id === id ? raw : x)),
    }));
  },
  deleteLivestockEvent: async (id) => {
    const uid = get().uid;
    if (!uid) return;
    await deleteDoc(agriDoc(uid, 'agriLivestockEvents', id));
    set((s) => ({
      livestockEvents: s.livestockEvents.filter((x) => x.id !== id),
    }));
  },

  // ── Produce Sales ─────────────────────────────────────────────────────────
  addProduceSale: async (p) => {
    const uid = get().uid;
    if (!uid) return;
    if (blockIfExpired()) return;
    const t = now();
    const raw: ProduceSaleLot = clean({
      ...p,
      id: agriId('prd'),
      userId: uid,
      createdAt: t,
      updatedAt: t,
    });
    await setDoc(agriDoc(uid, 'agriProduceSales', raw.id), raw);
    set((s) => ({
      produceSales: [raw, ...s.produceSales].sort((a, b) =>
        b.date.localeCompare(a.date),
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
    set((s) => ({
      produceSales: s.produceSales.map((x) => (x.id === id ? raw : x)),
    }));
  },
  deleteProduceSale: async (id) => {
    const uid = get().uid;
    if (!uid) return;
    await deleteDoc(agriDoc(uid, 'agriProduceSales', id));
    set((s) => ({
      produceSales: s.produceSales.filter((x) => x.id !== id),
    }));
  },
}));
