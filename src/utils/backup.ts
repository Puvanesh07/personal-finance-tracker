// src/utils/backup.ts

import type {
  Account,
  AgriExpense,
  AttendanceEmployee,
  AttendanceRecord,
  AttendanceTransaction,
  CashflowEntry,
  CoconutRecord,
  Credential,
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
  PendingPayment,
  TrackedPayment,
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

import {
  decryptDoc,
  encryptDoc,
  type FirestoreDoc,
} from '../services/encryptionService';
import type { SettingsRecord } from '../store/portfolioStore';
import { db } from '../services/firebase';
import { saveAs } from 'file-saver';

export type BackupPayload = {
  version: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;
  createdAt: string;
  investments: Investment[];
  liabilities: Liability[];
  cashflows: CashflowEntry[];
  ledgerEntries?: any[];
  goals: Goal[];
  goalContributions?: GoalContribution[];
  credentials?: Credential[]; // ← NEW
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
  pendingPayments?: PendingPayment[];
  trackedPayments?: TrackedPayment[];
};

const userSubCol = (uid: string, col: string) =>
  collection(db, 'users', uid, col);
const userSubDoc = (uid: string, col: string, id: string) =>
  doc(db, 'users', uid, col, id);
const settingsDocRef = (uid: string) =>
  doc(db, 'users', uid, 'settings', 'config');

async function fetchSub<T>(uid: string, col: string): Promise<T[]> {
  const snap = await getDocs(userSubCol(uid, col));
  return Promise.all(
    snap.docs.map((d) => decryptDoc<T>(uid, d.data() as FirestoreDoc)),
  );
}

async function batchSet(uid: string, colName: string, items: any[]) {
  if (!items?.length) return;
  for (let i = 0; i < items.length; i += 499) {
    const batch = writeBatch(db);
    for (const item of items.slice(i, i + 499)) {
      if (!item?.id) continue;
      const withUser = { ...item, userId: uid };
      const payload = await encryptDoc(uid, withUser);
      batch.set(userSubDoc(uid, colName, item.id), payload);
    }
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
    goalContributions,
    credentials, // ← NEW
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
    pendingPayments,
    trackedPayments,
    ledgerEntries,
  ] = await Promise.all([
    fetchSub<Investment>(uid, 'investments'),
    fetchSub<Liability>(uid, 'liabilities'),
    fetchSub<CashflowEntry>(uid, 'cashflows'),
    fetchSub<Goal>(uid, 'goals'),
    fetchSub<GoalContribution>(uid, 'goalContributions'),
    fetchSub<Credential>(uid, 'credentials'),
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
    fetchSub<PendingPayment>(uid, 'pendingPayments'),
    fetchSub<TrackedPayment>(uid, 'trackedPayments'),
    fetchSub<any>(uid, 'ledgerEntries'),
  ]);

  const settingsSnap = await getDoc(settingsDocRef(uid));
  const settings = settingsSnap.exists()
    ? (settingsSnap.data() as SettingsRecord)
    : null;

  const payload: BackupPayload = {
    version: 11,
    createdAt: new Date().toISOString(),
    investments,
    liabilities,
    cashflows,
    ledgerEntries,
    goals,
    goalContributions,
    credentials, // ← NEW
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
    pendingPayments,
    trackedPayments,
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
  const supportedVersions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  if (!parsed || !supportedVersions.includes(parsed.version as number)) {
    throw new Error('Unsupported backup format.');
  }

  await Promise.all([
    batchSet(uid, 'investments', parsed.investments ?? []),
    batchSet(uid, 'liabilities', parsed.liabilities ?? []),
    batchSet(uid, 'cashflows', parsed.cashflows ?? []),
    batchSet(uid, 'ledgerEntries', parsed.ledgerEntries ?? []),
    batchSet(uid, 'goals', parsed.goals ?? []),
    batchSet(uid, 'goalContributions', parsed.goalContributions ?? []),
    batchSet(uid, 'credentials', parsed.credentials ?? []), // ← NEW
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
    batchSet(uid, 'pendingPayments', parsed.pendingPayments ?? []),
    batchSet(uid, 'trackedPayments', parsed.trackedPayments ?? []),
  ]);

  const batch = writeBatch(db);
  batch.set(settingsDocRef(uid), {
    notion: parsed.notion ?? { enabled: false },
    essentials: parsed.essentials ?? {},
  });
  await batch.commit();
}
