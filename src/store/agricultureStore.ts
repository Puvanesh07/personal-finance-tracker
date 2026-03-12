// src/store/agricultureStore.ts

import type {
  AgriExpense,
  CoconutRecord,
  CropCycle,
  Field,
  LivestockEvent,
  MilkRecord,
} from '../types/investmentTypes';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  where,
} from 'firebase/firestore';

import { create } from 'zustand';
import { db } from '../services/firebase';

function agriId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

async function fetchCol<T>(col: string, uid: string): Promise<T[]> {
  const q = query(collection(db, col), where('userId', '==', uid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as T);
}

function clean<T extends object>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as T;
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

  hydrate: (uid: string) => Promise<void>;
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
  ) => Promise<void>;
  updateAgriExpense: (id: string, patch: Partial<AgriExpense>) => Promise<void>;
  deleteAgriExpense: (id: string) => Promise<void>;

  addMilkRecord: (
    m: Omit<MilkRecord, 'id' | 'createdAt' | 'updatedAt' | 'userId'>,
  ) => Promise<void>;
  updateMilkRecord: (id: string, patch: Partial<MilkRecord>) => Promise<void>;
  deleteMilkRecord: (id: string) => Promise<void>;

  addCoconutRecord: (
    c: Omit<CoconutRecord, 'id' | 'createdAt' | 'updatedAt' | 'userId'>,
  ) => Promise<void>;
  updateCoconutRecord: (
    id: string,
    patch: Partial<CoconutRecord>,
  ) => Promise<void>;
  deleteCoconutRecord: (id: string) => Promise<void>;

  // Livestock Event actions (event-based tracking: purchase/birth/sale/death)
  addLivestockEvent: (
    e: Omit<LivestockEvent, 'id' | 'createdAt' | 'updatedAt' | 'userId'>,
  ) => Promise<void>;
  deleteLivestockEvent: (id: string) => Promise<void>;
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

  hydrate: async (uid) => {
    const [
      fields,
      cropCycles,
      agriExpenses,
      milkRecords,
      coconutRecords,
      livestockEvents,
    ] = await Promise.all([
      fetchCol<Field>('agriFields', uid),
      fetchCol<CropCycle>('agriCropCycles', uid),
      fetchCol<AgriExpense>('agriExpenses', uid),
      fetchCol<MilkRecord>('agriMilkRecords', uid),
      fetchCol<CoconutRecord>('agriCoconut', uid),
      fetchCol<LivestockEvent>('agriLivestockEvents', uid),
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
    });
  },

  // ready: true keeps the page showing empty state instead of infinite spinner
  clearAll: () =>
    set({
      fields: [],
      cropCycles: [],
      agriExpenses: [],
      milkRecords: [],
      coconutRecords: [],
      livestockEvents: [],
      ready: true,
      uid: get().uid,
    }),

  // ── Fields ────────────────────────────────────────────────────────────────
  addField: async (f) => {
    const uid = get().uid!;
    const now = new Date().toISOString();
    const raw: Field = clean({
      ...f,
      id: agriId('fld'),
      userId: uid,
      createdAt: now,
      updatedAt: now,
    });
    await setDoc(doc(db, 'agriFields', raw.id), raw);
    set((s) => ({ fields: [raw, ...s.fields] }));
  },
  updateField: async (id, patch) => {
    const raw = clean({
      ...get().fields.find((x) => x.id === id)!,
      ...patch,
      updatedAt: new Date().toISOString(),
    });
    await setDoc(doc(db, 'agriFields', id), raw);
    set((s) => ({ fields: s.fields.map((x) => (x.id === id ? raw : x)) }));
  },
  deleteField: async (id) => {
    await deleteDoc(doc(db, 'agriFields', id));
    set((s) => ({ fields: s.fields.filter((x) => x.id !== id) }));
  },

  // ── Crop Cycles ───────────────────────────────────────────────────────────
  addCropCycle: async (c) => {
    const uid = get().uid!;
    const now = new Date().toISOString();
    const raw: CropCycle = clean({
      ...c,
      id: agriId('crp'),
      userId: uid,
      createdAt: now,
      updatedAt: now,
    });
    await setDoc(doc(db, 'agriCropCycles', raw.id), raw);
    set((s) => ({ cropCycles: [raw, ...s.cropCycles] }));
  },
  updateCropCycle: async (id, patch) => {
    const raw: CropCycle = clean({
      ...get().cropCycles.find((x) => x.id === id)!,
      ...patch,
      updatedAt: new Date().toISOString(),
    });
    await setDoc(doc(db, 'agriCropCycles', id), raw);
    set((s) => ({
      cropCycles: s.cropCycles.map((x) => (x.id === id ? raw : x)),
    }));
  },
  deleteCropCycle: async (id) => {
    await deleteDoc(doc(db, 'agriCropCycles', id));
    set((s) => ({ cropCycles: s.cropCycles.filter((x) => x.id !== id) }));
  },

  // ── Agri Expenses ─────────────────────────────────────────────────────────
  addAgriExpense: async (e) => {
    const uid = get().uid!;
    const now = new Date().toISOString();
    const raw: AgriExpense = clean({
      ...e,
      id: agriId('aex'),
      userId: uid,
      createdAt: now,
      updatedAt: now,
    });
    await setDoc(doc(db, 'agriExpenses', raw.id), raw);
    set((s) => ({
      agriExpenses: [raw, ...s.agriExpenses].sort((a, b) =>
        b.date.localeCompare(a.date),
      ),
    }));
  },
  updateAgriExpense: async (id, patch) => {
    const raw: AgriExpense = clean({
      ...get().agriExpenses.find((x) => x.id === id)!,
      ...patch,
      updatedAt: new Date().toISOString(),
    });
    await setDoc(doc(db, 'agriExpenses', id), raw);
    set((s) => ({
      agriExpenses: s.agriExpenses.map((x) => (x.id === id ? raw : x)),
    }));
  },
  deleteAgriExpense: async (id) => {
    await deleteDoc(doc(db, 'agriExpenses', id));
    set((s) => ({ agriExpenses: s.agriExpenses.filter((x) => x.id !== id) }));
  },

  // ── Milk Records ──────────────────────────────────────────────────────────
  addMilkRecord: async (m) => {
    const uid = get().uid!;
    const now = new Date().toISOString();
    const raw: MilkRecord = clean({
      ...m,
      id: agriId('mlk'),
      userId: uid,
      createdAt: now,
      updatedAt: now,
    });
    await setDoc(doc(db, 'agriMilkRecords', raw.id), raw);
    set((s) => ({
      milkRecords: [raw, ...s.milkRecords].sort((a, b) =>
        b.date.localeCompare(a.date),
      ),
    }));
  },
  updateMilkRecord: async (id, patch) => {
    const raw: MilkRecord = clean({
      ...get().milkRecords.find((x) => x.id === id)!,
      ...patch,
      updatedAt: new Date().toISOString(),
    });
    await setDoc(doc(db, 'agriMilkRecords', id), raw);
    set((s) => ({
      milkRecords: s.milkRecords.map((x) => (x.id === id ? raw : x)),
    }));
  },
  deleteMilkRecord: async (id) => {
    await deleteDoc(doc(db, 'agriMilkRecords', id));
    set((s) => ({ milkRecords: s.milkRecords.filter((x) => x.id !== id) }));
  },

  // ── Coconut Records ───────────────────────────────────────────────────────
  addCoconutRecord: async (c) => {
    const uid = get().uid!;
    const now = new Date().toISOString();
    const raw: CoconutRecord = clean({
      ...c,
      id: agriId('coc'),
      userId: uid,
      createdAt: now,
      updatedAt: now,
    });
    await setDoc(doc(db, 'agriCoconut', raw.id), raw);
    set((s) => ({
      coconutRecords: [raw, ...s.coconutRecords].sort((a, b) =>
        b.date.localeCompare(a.date),
      ),
    }));
  },
  updateCoconutRecord: async (id, patch) => {
    const raw: CoconutRecord = clean({
      ...get().coconutRecords.find((x) => x.id === id)!,
      ...patch,
      updatedAt: new Date().toISOString(),
    });
    await setDoc(doc(db, 'agriCoconut', id), raw);
    set((s) => ({
      coconutRecords: s.coconutRecords.map((x) => (x.id === id ? raw : x)),
    }));
  },
  deleteCoconutRecord: async (id) => {
    await deleteDoc(doc(db, 'agriCoconut', id));
    set((s) => ({
      coconutRecords: s.coconutRecords.filter((x) => x.id !== id),
    }));
  },

  // ── Livestock Events ──────────────────────────────────────────────────────
  addLivestockEvent: async (e) => {
    const uid = get().uid!;
    const now = new Date().toISOString();
    const raw: LivestockEvent = clean({
      ...e,
      id: agriId('lve'),
      userId: uid,
      createdAt: now,
      updatedAt: now,
    });
    await setDoc(doc(db, 'agriLivestockEvents', raw.id), raw);
    set((s) => ({
      livestockEvents: [raw, ...s.livestockEvents].sort((a, b) =>
        b.date.localeCompare(a.date),
      ),
    }));
  },
  deleteLivestockEvent: async (id) => {
    await deleteDoc(doc(db, 'agriLivestockEvents', id));
    set((s) => ({
      livestockEvents: s.livestockEvents.filter((x) => x.id !== id),
    }));
  },
}));
