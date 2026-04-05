// src/utils/backup.ts
//
// VERSION 8 — updated to include:
//  • Goal contributions sub-collection (goalContributions)
//  • Goal status + completedAt fields preserved in goals array
//  • Liability returnedAt field preserved in liabilities array
//  • EPF is stored inside investments (type: 'other', assetType: 'epf') — no separate collection needed
//  • Import accepts v1–8 for backwards compatibility

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
  GoalContribution,
  InsurancePayment,
  Investment,
  LendingBorrower,
  LendingTransaction,
  Liability,
  Livestock,
  LivestockEvent,
  MilkRecord,
  NetWorthSnapshot,
  NotionConfig,
  PortfolioSnapshot,
  ProduceSaleLot,
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

// ── Backup Payload ────────────────────────────────────────────────────────────

export type BackupPayload = {
  version: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  createdAt: string;
  investments: Investment[];
  liabilities: Liability[]; // includes returnedAt, status fields
  cashflows: CashflowEntry[];
  goals: Goal[]; // includes status, completedAt fields
  goalContributions?: GoalContribution[]; // NEW v8
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
  agriProduceSales?: ProduceSaleLot[];
  attEmployees?: AttendanceEmployee[];
  attRecords?: AttendanceRecord[];
  attTransactions?: AttendanceTransaction[];
  attSalary?: SalaryRecord[];
  insurancePolicies?: any[];
  insurancePayments?: InsurancePayment[];
  lendingBorrowers?: LendingBorrower[];
  lendingTransactions?: LendingTransaction[];
  sipPlans?: any[];
  soldTrades?: any[];
};

// ── Firestore helpers ─────────────────────────────────────────────────────────

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
  // Firestore batch limit is 500 writes — chunk into 499 to be safe
  for (let i = 0; i < items.length; i += 499) {
    const batch = writeBatch(db);
    items.slice(i, i + 499).forEach((item) => {
      if (!item?.id) return; // skip items without an id
      batch.set(userSubDoc(uid, colName, item.id), { ...item, userId: uid });
    });
    await batch.commit();
  }
}

// ── Export ────────────────────────────────────────────────────────────────────

export async function exportFullBackup(uid: string) {
  if (!uid) throw new Error('You must be logged in to export data.');

  const [
    investments,
    liabilities,
    cashflows,
    goals,
    goalContributions, // NEW v8
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
    agriProduceSales,
    attEmployees,
    attRecords,
    attTransactions,
    attSalary,
    insurancePolicies,
    insurancePayments,
    lendingBorrowers,
    lendingTransactions,
    sipPlans,
    soldTrades,
  ] = await Promise.all([
    fetchSub<Investment>(uid, 'investments'),
    fetchSub<Liability>(uid, 'liabilities'),
    fetchSub<CashflowEntry>(uid, 'cashflows'),
    fetchSub<Goal>(uid, 'goals'),
    fetchSub<GoalContribution>(uid, 'goalContributions'), // NEW v8
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
    fetchSub<ProduceSaleLot>(uid, 'agriProduceSales'),
    fetchSub<AttendanceEmployee>(uid, 'attEmployees'),
    fetchSub<AttendanceRecord>(uid, 'attRecords'),
    fetchSub<AttendanceTransaction>(uid, 'attTransactions'),
    fetchSub<SalaryRecord>(uid, 'attSalary'),
    fetchSub<any>(uid, 'insurancePolicies'),
    fetchSub<InsurancePayment>(uid, 'insurancePayments'),
    fetchSub<LendingBorrower>(uid, 'lendingBorrowers'),
    fetchSub<LendingTransaction>(uid, 'lendingTransactions'),
    fetchSub<any>(uid, 'sipPlans'),
    fetchSub<any>(uid, 'soldTrades'),
  ]);

  const settingsSnap = await getDoc(settingsDocRef(uid));
  const settings = settingsSnap.exists()
    ? (settingsSnap.data() as SettingsRecord)
    : null;

  const payload: BackupPayload = {
    version: 8, // ← bumped to 8
    createdAt: new Date().toISOString(),
    investments,
    liabilities, // now includes returnedAt + status: 'returned'
    cashflows,
    goals, // now includes status + completedAt
    goalContributions, // NEW v8
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
    agriProduceSales,
    attEmployees,
    attRecords,
    attTransactions,
    attSalary,
    insurancePolicies,
    insurancePayments,
    lendingBorrowers,
    lendingTransactions,
    sipPlans,
    soldTrades,
  };

  saveAs(
    new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    }),
    `fintrackly-backup-${new Date().toISOString().split('T')[0]}.json`,
  );
}

// ── Import ────────────────────────────────────────────────────────────────────

export async function importFullBackup(jsonText: string, uid: string) {
  if (!uid) throw new Error('User context missing. Please log in again.');

  const parsed = JSON.parse(jsonText) as BackupPayload;

  // Accept versions 1–8
  const supportedVersions = [1, 2, 3, 4, 5, 6, 7, 8];
  if (!parsed || !supportedVersions.includes(parsed.version as number)) {
    throw new Error('Unsupported backup format. Expected version 1–8.');
  }

  await Promise.all([
    batchSet(uid, 'investments', parsed.investments ?? []),
    batchSet(uid, 'liabilities', parsed.liabilities ?? []),
    batchSet(uid, 'cashflows', parsed.cashflows ?? []),
    batchSet(uid, 'goals', parsed.goals ?? []),
    batchSet(uid, 'goalContributions', parsed.goalContributions ?? []), // NEW v8
    batchSet(uid, 'snapshots', parsed.snapshots ?? []),
    batchSet(uid, 'networthSnapshots', parsed.networthSnapshots ?? []),
    batchSet(uid, 'accounts', parsed.accounts ?? []),
    batchSet(uid, 'agriFields', parsed.agriFields ?? []),
    batchSet(uid, 'agriCropCycles', parsed.agriCropCycles ?? []),
    batchSet(uid, 'agriExpenses', parsed.agriExpenses ?? []),
    batchSet(uid, 'agriLivestock', parsed.agriLivestock ?? []),
    batchSet(uid, 'agriMilkRecords', parsed.agriMilkRecords ?? []),
    batchSet(uid, 'agriCoconut', parsed.agriCoconut ?? []),
    batchSet(uid, 'agriLivestockEvents', parsed.agriLivestockEvents ?? []),
    batchSet(uid, 'agriProduceSales', parsed.agriProduceSales ?? []),
    batchSet(uid, 'attEmployees', parsed.attEmployees ?? []),
    batchSet(uid, 'attRecords', parsed.attRecords ?? []),
    batchSet(uid, 'attTransactions', parsed.attTransactions ?? []),
    batchSet(uid, 'attSalary', parsed.attSalary ?? []),
    batchSet(uid, 'insurancePolicies', parsed.insurancePolicies ?? []),
    batchSet(uid, 'insurancePayments', parsed.insurancePayments ?? []),
    batchSet(uid, 'lendingBorrowers', parsed.lendingBorrowers ?? []),
    batchSet(uid, 'lendingTransactions', parsed.lendingTransactions ?? []),
    batchSet(uid, 'sipPlans', parsed.sipPlans ?? []),
    batchSet(uid, 'soldTrades', parsed.soldTrades ?? []),
  ]);

  // Restore settings document
  const batch = writeBatch(db);
  batch.set(settingsDocRef(uid), {
    notion: parsed.notion ?? { enabled: false },
    essentials: parsed.essentials ?? {},
  });
  await batch.commit();
}
