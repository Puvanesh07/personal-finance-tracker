// FILE 4 OF 5
// src/utils/backup.ts — FULL REPLACEMENT
// Adds insurancePayments to export and import

import type {
  Account,
  AgriExpense,
  AttendanceEmployee,
  AttendanceRecord,
  AttendanceTransaction,
  CashflowEntry,
  CoconutRecord,
  CropCycle,
  EssentialsConfig,
  Field,
  Goal,
  InsurancePayment,
  Investment,
  Liability,
  Livestock,
  LivestockEvent,
  MilkRecord,
  NetWorthSnapshot,
  NotionConfig,
  PortfolioSnapshot,
  SalaryRecord,
} from '../types/investmentTypes';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  writeBatch,
} from 'firebase/firestore';

import type { SettingsRecord } from '../store/portfolioStore';
import { db } from '../services/firebase';
import { saveAs } from 'file-saver';

export type BackupPayload = {
  version: 1 | 2 | 3 | 4 | 5;
  createdAt: string;
  investments: Investment[];
  liabilities: Liability[];
  cashflows: CashflowEntry[];
  goals: Goal[];
  snapshots: PortfolioSnapshot[];
  networthSnapshots: NetWorthSnapshot[];
  accounts: Account[];
  notion: NotionConfig;
  essentials: EssentialsConfig;
  agriFields?: Field[];
  agriCropCycles?: CropCycle[];
  agriExpenses?: AgriExpense[];
  agriLivestock?: Livestock[];
  agriMilkRecords?: MilkRecord[];
  agriCoconut?: CoconutRecord[];
  agriLivestockEvents?: LivestockEvent[];
  attEmployees?: AttendanceEmployee[];
  attRecords?: AttendanceRecord[];
  attTransactions?: AttendanceTransaction[];
  attSalary?: SalaryRecord[];
  insurancePolicies?: any[];
  insurancePayments?: InsurancePayment[]; // ← NEW
  sipPlans?: any[];
};

const userSubCol = (uid: string, col: string) =>
  collection(db, 'users', uid, col);
const userSubDoc = (uid: string, col: string, id: string) =>
  doc(db, 'users', uid, col, id);
const settingsDocRef = (uid: string) =>
  doc(db, 'users', uid, 'settings', 'config');

async function fetchSub<T>(uid: string, col: string): Promise<T[]> {
  const snap = await getDocs(userSubCol(uid, col));
  return snap.docs.map((d) => d.data() as T);
}

async function batchSet(uid: string, colName: string, items: any[]) {
  if (!items?.length) return;
  for (let i = 0; i < items.length; i += 499) {
    const batch = writeBatch(db);
    items.slice(i, i + 499).forEach((item) => {
      batch.set(userSubDoc(uid, colName, item.id), { ...item, userId: uid });
    });
    await batch.commit();
  }
}

export async function exportFullBackup(uid: string) {
  if (!uid) throw new Error('You must be logged in to export data.');

  const [
    investments,
    liabilities,
    cashflows,
    goals,
    snapshots,
    networthSnapshots,
    accounts,
    agriFields,
    agriCropCycles,
    agriExpenses,
    agriLivestock,
    agriMilkRecords,
    agriCoconut,
    agriLivestockEvents,
    attEmployees,
    attRecords,
    attTransactions,
    attSalary,
    insurancePolicies,
    insurancePayments, // ← NEW
    sipPlans,
  ] = await Promise.all([
    fetchSub<Investment>(uid, 'investments'),
    fetchSub<Liability>(uid, 'liabilities'),
    fetchSub<CashflowEntry>(uid, 'cashflows'),
    fetchSub<Goal>(uid, 'goals'),
    fetchSub<PortfolioSnapshot>(uid, 'snapshots'),
    fetchSub<NetWorthSnapshot>(uid, 'networthSnapshots'),
    fetchSub<Account>(uid, 'accounts'),
    fetchSub<Field>(uid, 'agriFields'),
    fetchSub<CropCycle>(uid, 'agriCropCycles'),
    fetchSub<AgriExpense>(uid, 'agriExpenses'),
    fetchSub<Livestock>(uid, 'agriLivestock'),
    fetchSub<MilkRecord>(uid, 'agriMilkRecords'),
    fetchSub<CoconutRecord>(uid, 'agriCoconut'),
    fetchSub<LivestockEvent>(uid, 'agriLivestockEvents'),
    fetchSub<AttendanceEmployee>(uid, 'attEmployees'),
    fetchSub<AttendanceRecord>(uid, 'attRecords'),
    fetchSub<AttendanceTransaction>(uid, 'attTransactions'),
    fetchSub<SalaryRecord>(uid, 'attSalary'),
    fetchSub<any>(uid, 'insurancePolicies'),
    fetchSub<InsurancePayment>(uid, 'insurancePayments'), // ← NEW
    fetchSub<any>(uid, 'sipPlans'),
  ]);

  const settingsSnap = await getDoc(settingsDocRef(uid));
  const settings = settingsSnap.exists()
    ? (settingsSnap.data() as SettingsRecord)
    : null;

  const payload: BackupPayload = {
    version: 5, // bumped from 4 → 5
    createdAt: new Date().toISOString(),
    investments,
    liabilities,
    cashflows,
    goals,
    snapshots,
    networthSnapshots,
    accounts,
    notion: settings?.notion ?? { enabled: false },
    essentials: settings?.essentials ?? {},
    agriFields,
    agriCropCycles,
    agriExpenses,
    agriLivestock,
    agriMilkRecords,
    agriCoconut,
    agriLivestockEvents,
    attEmployees,
    attRecords,
    attTransactions,
    attSalary,
    insurancePolicies,
    insurancePayments, // ← NEW
    sipPlans,
  };

  saveAs(
    new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    }),
    `fintrackly-backup-${new Date().toISOString().split('T')[0]}.json`,
  );
}

export async function importFullBackup(jsonText: string, uid: string) {
  if (!uid) throw new Error('User context missing. Please log in again.');

  const parsed = JSON.parse(jsonText) as BackupPayload;

  // Accept versions 1–5
  if (!parsed || ![1, 2, 3, 4, 5].includes(parsed.version as number))
    throw new Error('Unsupported backup format. Expected version 1–5.');

  await Promise.all([
    batchSet(uid, 'investments', parsed.investments ?? []),
    batchSet(uid, 'liabilities', parsed.liabilities ?? []),
    batchSet(uid, 'cashflows', parsed.cashflows ?? []),
    batchSet(uid, 'goals', parsed.goals ?? []),
    batchSet(uid, 'snapshots', parsed.snapshots ?? []),
    batchSet(uid, 'networthSnapshots', parsed.networthSnapshots ?? []),
    batchSet(uid, 'accounts', (parsed as any).accounts ?? []),
    batchSet(uid, 'agriFields', parsed.agriFields ?? []),
    batchSet(uid, 'agriCropCycles', parsed.agriCropCycles ?? []),
    batchSet(uid, 'agriExpenses', parsed.agriExpenses ?? []),
    batchSet(uid, 'agriLivestock', parsed.agriLivestock ?? []),
    batchSet(uid, 'agriMilkRecords', parsed.agriMilkRecords ?? []),
    batchSet(uid, 'agriCoconut', parsed.agriCoconut ?? []),
    batchSet(uid, 'agriLivestockEvents', parsed.agriLivestockEvents ?? []),
    batchSet(uid, 'attEmployees', parsed.attEmployees ?? []),
    batchSet(uid, 'attRecords', parsed.attRecords ?? []),
    batchSet(uid, 'attTransactions', parsed.attTransactions ?? []),
    batchSet(uid, 'attSalary', parsed.attSalary ?? []),
    batchSet(uid, 'insurancePolicies', (parsed as any).insurancePolicies ?? []),
    batchSet(uid, 'insurancePayments', parsed.insurancePayments ?? []), // ← NEW
    batchSet(uid, 'sipPlans', (parsed as any).sipPlans ?? []),
  ]);

  const batch = writeBatch(db);
  batch.set(settingsDocRef(uid), {
    notion: parsed.notion ?? { enabled: false },
    essentials: parsed.essentials ?? {},
  });
  await batch.commit();
}
