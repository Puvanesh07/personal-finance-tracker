// ─────────────────────────────────────────────────────────────────────────────
// FILE 2: CREATE NEW FILE
//   src/store/attendanceStore.ts
// ─────────────────────────────────────────────────────────────────────────────

import type {
  AttendanceEmployee,
  AttendanceRecord,
  AttendanceTransaction,
  PaymentStatus,
  SalaryRecord,
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

// ── Helpers ──────────────────────────────────────────────────────────────────

const col = (uid: string, c: string) => collection(db, 'users', uid, c);
const docRef = (uid: string, c: string, id: string) =>
  doc(db, 'users', uid, c, id);

function attId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function clean<T extends object>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as T;
}

const now = () => new Date().toISOString();

async function fetchSub<T>(uid: string, c: string): Promise<T[]> {
  const snap = await getDocs(col(uid, c));
  return snap.docs.map((d) => d.data() as T);
}

// ── State Type ───────────────────────────────────────────────────────────────

type AttendanceState = {
  uid: string | null;
  ready: boolean;
  employees: AttendanceEmployee[];
  attendanceRecords: AttendanceRecord[];
  transactions: AttendanceTransaction[];
  salaryRecords: SalaryRecord[];

  hydrate: (uid: string, opts?: { force?: boolean }) => Promise<void>;
  clearAll: () => void;

  // Employees
  addEmployee: (
    e: Omit<AttendanceEmployee, 'id' | 'createdAt' | 'updatedAt' | 'userId'>,
  ) => Promise<void>;
  updateEmployee: (
    id: string,
    patch: Partial<AttendanceEmployee>,
  ) => Promise<void>;
  deleteEmployee: (id: string) => Promise<void>;

  // Attendance Records
  addAttendanceRecord: (
    r: Omit<AttendanceRecord, 'id' | 'createdAt' | 'updatedAt' | 'userId'>,
  ) => Promise<void>;
  updateAttendanceRecord: (
    id: string,
    patch: Partial<AttendanceRecord>,
  ) => Promise<void>;
  deleteAttendanceRecord: (id: string) => Promise<void>;
  bulkSetAttendance: (
    records: Omit<
      AttendanceRecord,
      'id' | 'createdAt' | 'updatedAt' | 'userId'
    >[],
  ) => Promise<void>;

  // Transactions (advance / deduction / extra)
  addTransaction: (
    t: Omit<AttendanceTransaction, 'id' | 'createdAt' | 'updatedAt' | 'userId'>,
  ) => Promise<void>;
  updateTransaction: (
    id: string,
    patch: Partial<AttendanceTransaction>,
  ) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;

  // Salary Records
  addSalaryRecord: (
    s: Omit<SalaryRecord, 'id' | 'createdAt' | 'updatedAt' | 'userId'>,
  ) => Promise<string | void>;
  updateSalaryRecord: (
    id: string,
    patch: Partial<SalaryRecord>,
  ) => Promise<void>;
  deleteSalaryRecord: (id: string) => Promise<void>;
  markSalaryPaid: (
    id: string,
    paidAmount: number,
    status: PaymentStatus,
  ) => Promise<void>;

  // Export / Import
  exportAttendanceJSON: () => string;
  importAttendanceJSON: (json: string) => Promise<void>;
};

// ── Store ─────────────────────────────────────────────────────────────────────

export const useAttendanceStore = create<AttendanceState>((set, get) => ({
  uid: null,
  ready: false,
  employees: [],
  attendanceRecords: [],
  transactions: [],
  salaryRecords: [],

  hydrate: async (uid, opts) => {
    const { uid: currentUid, ready } = get();
    if (!opts?.force && currentUid === uid && ready) return;

    try {
      const [employees, attendanceRecords, transactions, salaryRecords] =
        await Promise.all([
          fetchSub<AttendanceEmployee>(uid, 'attEmployees'),
          fetchSub<AttendanceRecord>(uid, 'attRecords'),
          fetchSub<AttendanceTransaction>(uid, 'attTransactions'),
          fetchSub<SalaryRecord>(uid, 'attSalary'),
        ]);
      set({
        uid,
        ready: true,
        employees: employees.sort((a, b) => a.name.localeCompare(b.name)),
        attendanceRecords: attendanceRecords.sort((a, b) =>
          b.date.localeCompare(a.date),
        ),
        transactions: transactions.sort((a, b) => b.date.localeCompare(a.date)),
        salaryRecords: salaryRecords.sort((a, b) =>
          b.month.localeCompare(a.month),
        ),
      });
    } catch (err) {
      console.error('[AttendanceStore] hydrate failed:', err);
      set({ uid, ready: false });
    }
  },

  clearAll: () =>
    set({
      uid: null,
      ready: false,
      employees: [],
      attendanceRecords: [],
      transactions: [],
      salaryRecords: [],
    }),

  // ── Employees ──────────────────────────────────────────────────────────────

  addEmployee: async (e) => {
    const uid = get().uid;
    if (!uid) return;
    const t = now();
    const raw: AttendanceEmployee = clean({
      ...e,
      id: attId('emp'),
      userId: uid,
      createdAt: t,
      updatedAt: t,
    });
    await setDoc(docRef(uid, 'attEmployees', raw.id), raw);
    set((s) => ({
      employees: [...s.employees, raw].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    }));
  },

  updateEmployee: async (id, patch) => {
    const uid = get().uid;
    if (!uid) return;
    const ex = get().employees.find((x) => x.id === id);
    if (!ex) return;
    const raw: AttendanceEmployee = clean({
      ...ex,
      ...patch,
      id,
      updatedAt: now(),
    });
    await setDoc(docRef(uid, 'attEmployees', id), raw);
    set((s) => ({
      employees: s.employees
        .map((x) => (x.id === id ? raw : x))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }));
  },

  deleteEmployee: async (id) => {
    const uid = get().uid;
    if (!uid) return;
    await deleteDoc(docRef(uid, 'attEmployees', id));
    set((s) => ({ employees: s.employees.filter((x) => x.id !== id) }));
  },

  // ── Attendance Records ──────────────────────────────────────────────────────

  addAttendanceRecord: async (r) => {
    const uid = get().uid;
    if (!uid) return;
    const t = now();
    const raw: AttendanceRecord = clean({
      ...r,
      id: attId('att'),
      userId: uid,
      createdAt: t,
      updatedAt: t,
    });
    await setDoc(docRef(uid, 'attRecords', raw.id), raw);
    set((s) => ({
      attendanceRecords: [raw, ...s.attendanceRecords].sort((a, b) =>
        b.date.localeCompare(a.date),
      ),
    }));
  },

  updateAttendanceRecord: async (id, patch) => {
    const uid = get().uid;
    if (!uid) return;
    const ex = get().attendanceRecords.find((x) => x.id === id);
    if (!ex) return;
    const raw: AttendanceRecord = clean({
      ...ex,
      ...patch,
      id,
      updatedAt: now(),
    });
    await setDoc(docRef(uid, 'attRecords', id), raw);
    set((s) => ({
      attendanceRecords: s.attendanceRecords.map((x) =>
        x.id === id ? raw : x,
      ),
    }));
  },

  deleteAttendanceRecord: async (id) => {
    const uid = get().uid;
    if (!uid) return;
    await deleteDoc(docRef(uid, 'attRecords', id));
    set((s) => ({
      attendanceRecords: s.attendanceRecords.filter((x) => x.id !== id),
    }));
  },

  bulkSetAttendance: async (records) => {
    const uid = get().uid;
    if (!uid) return;
    const t = now();
    const raws: AttendanceRecord[] = records.map((r) =>
      clean({
        ...r,
        id: attId('att'),
        userId: uid,
        createdAt: t,
        updatedAt: t,
      }),
    );
    await Promise.all(
      raws.map((raw) => setDoc(docRef(uid, 'attRecords', raw.id), raw)),
    );
    set((s) => ({
      attendanceRecords: [...raws, ...s.attendanceRecords].sort((a, b) =>
        b.date.localeCompare(a.date),
      ),
    }));
  },

  // ── Transactions ────────────────────────────────────────────────────────────

  addTransaction: async (t) => {
    const uid = get().uid;
    if (!uid) return;
    const ts = now();
    const raw: AttendanceTransaction = clean({
      ...t,
      id: attId('txn'),
      userId: uid,
      createdAt: ts,
      updatedAt: ts,
    });
    await setDoc(docRef(uid, 'attTransactions', raw.id), raw);
    set((s) => ({
      transactions: [raw, ...s.transactions].sort((a, b) =>
        b.date.localeCompare(a.date),
      ),
    }));
  },

  updateTransaction: async (id, patch) => {
    const uid = get().uid;
    if (!uid) return;
    const ex = get().transactions.find((x) => x.id === id);
    if (!ex) return;
    const raw: AttendanceTransaction = clean({
      ...ex,
      ...patch,
      id,
      updatedAt: now(),
    });
    await setDoc(docRef(uid, 'attTransactions', id), raw);
    set((s) => ({
      transactions: s.transactions.map((x) => (x.id === id ? raw : x)),
    }));
  },

  deleteTransaction: async (id) => {
    const uid = get().uid;
    if (!uid) return;
    await deleteDoc(docRef(uid, 'attTransactions', id));
    set((s) => ({
      transactions: s.transactions.filter((x) => x.id !== id),
    }));
  },

  // ── Salary Records ──────────────────────────────────────────────────────────

  addSalaryRecord: async (s) => {
    const uid = get().uid;
    if (!uid) return;
    const t = now();
    const raw: SalaryRecord = clean({
      ...s,
      id: attId('sal'),
      userId: uid,
      createdAt: t,
      updatedAt: t,
    });
    await setDoc(docRef(uid, 'attSalary', raw.id), raw);
    set((st) => ({
      salaryRecords: [raw, ...st.salaryRecords].sort((a, b) =>
        b.month.localeCompare(a.month),
      ),
    }));
    return raw.id;
  },

  updateSalaryRecord: async (id, patch) => {
    const uid = get().uid;
    if (!uid) return;
    const ex = get().salaryRecords.find((x) => x.id === id);
    if (!ex) return;
    const raw: SalaryRecord = clean({ ...ex, ...patch, id, updatedAt: now() });
    await setDoc(docRef(uid, 'attSalary', id), raw);
    set((s) => ({
      salaryRecords: s.salaryRecords.map((x) => (x.id === id ? raw : x)),
    }));
  },

  deleteSalaryRecord: async (id) => {
    const uid = get().uid;
    if (!uid) return;
    await deleteDoc(docRef(uid, 'attSalary', id));
    set((s) => ({
      salaryRecords: s.salaryRecords.filter((x) => x.id !== id),
    }));
  },

  markSalaryPaid: async (id, paidAmount, status) => {
    const uid = get().uid;
    if (!uid) return;
    const ex = get().salaryRecords.find((x) => x.id === id);
    if (!ex) return;
    const raw: SalaryRecord = clean({
      ...ex,
      paidAmount,
      paymentStatus: status,
      updatedAt: now(),
    });
    await setDoc(docRef(uid, 'attSalary', id), raw);
    set((s) => ({
      salaryRecords: s.salaryRecords.map((x) => (x.id === id ? raw : x)),
    }));
  },

  // ── Export / Import ─────────────────────────────────────────────────────────

  exportAttendanceJSON: () => {
    const { employees, attendanceRecords, transactions, salaryRecords } = get();
    return JSON.stringify(
      {
        employees,
        attendanceRecords,
        transactions,
        salaryRecords,
        exportedAt: now(),
      },
      null,
      2,
    );
  },

  importAttendanceJSON: async (json) => {
    const uid = get().uid;
    if (!uid) return;
    const data = JSON.parse(json);
    const t = now();

    const employees: AttendanceEmployee[] = (data.employees ?? []).map(
      (e: AttendanceEmployee) => clean({ ...e, userId: uid, updatedAt: t }),
    );
    const attendanceRecords: AttendanceRecord[] = (
      data.attendanceRecords ?? []
    ).map((r: AttendanceRecord) => clean({ ...r, userId: uid, updatedAt: t }));
    const transactions: AttendanceTransaction[] = (data.transactions ?? []).map(
      (tx: AttendanceTransaction) =>
        clean({ ...tx, userId: uid, updatedAt: t }),
    );
    const salaryRecords: SalaryRecord[] = (data.salaryRecords ?? []).map(
      (s: SalaryRecord) => clean({ ...s, userId: uid, updatedAt: t }),
    );

    await Promise.all([
      ...employees.map((e) => setDoc(docRef(uid, 'attEmployees', e.id), e)),
      ...attendanceRecords.map((r) =>
        setDoc(docRef(uid, 'attRecords', r.id), r),
      ),
      ...transactions.map((tx) =>
        setDoc(docRef(uid, 'attTransactions', tx.id), tx),
      ),
      ...salaryRecords.map((s) => setDoc(docRef(uid, 'attSalary', s.id), s)),
    ]);

    set({
      employees: employees.sort((a, b) => a.name.localeCompare(b.name)),
      attendanceRecords: attendanceRecords.sort((a, b) =>
        b.date.localeCompare(a.date),
      ),
      transactions: transactions.sort((a, b) => b.date.localeCompare(a.date)),
      salaryRecords: salaryRecords.sort((a, b) =>
        b.month.localeCompare(a.month),
      ),
    });
  },
}));
