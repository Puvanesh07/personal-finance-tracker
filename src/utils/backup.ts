// src/utils/backup.ts
import type {
  Account,
  AgriExpense,
  CashflowEntry,
  CoconutRecord,
  CropCycle,
  EssentialsConfig,
  Field,
  Goal,
  Investment,
  Liability,
  Livestock,
  LivestockEvent,
  MilkRecord,
  NetWorthSnapshot,
  NotionConfig,
  PortfolioSnapshot,
} from '../types/investmentTypes';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';

import type { SettingsRecord } from '../store/portfolioStore';
import { db } from '../services/firebase';
import { saveAs } from 'file-saver';

// ── Backup shape ────────────────────────────────────────────────────────────
// version 2 adds accounts
// version 3 adds full agriculture data
export type BackupPayload = {
  version: 1 | 2 | 3;
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
  // Agriculture (v3+)
  agriFields?: Field[];
  agriCropCycles?: CropCycle[];
  agriExpenses?: AgriExpense[];
  agriLivestock?: Livestock[];
  agriMilkRecords?: MilkRecord[];
  agriCoconut?: CoconutRecord[];
  agriLivestockEvents?: LivestockEvent[];
};

// ── helpers ─────────────────────────────────────────────────────────────────
async function fetchUserCollection<T>(
  colName: string,
  uid: string,
): Promise<T[]> {
  const q = query(collection(db, colName), where('userId', '==', uid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as T);
}

/**
 * Firestore writeBatch is capped at 500 ops.
 * This helper splits items into ≤500 chunks and commits each batch.
 */
async function batchSet(colName: string, items: any[], uid: string) {
  if (!items?.length) return;
  const CHUNK = 499; // leave 1 slot for safety
  for (let i = 0; i < items.length; i += CHUNK) {
    const batch = writeBatch(db);
    const chunk = items.slice(i, i + CHUNK);
    chunk.forEach((item) => {
      batch.set(doc(db, colName, item.id), { ...item, userId: uid });
    });
    await batch.commit();
  }
}

// ── Export ──────────────────────────────────────────────────────────────────
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
  ] = await Promise.all([
    fetchUserCollection<Investment>('investments', uid),
    fetchUserCollection<Liability>('liabilities', uid),
    fetchUserCollection<CashflowEntry>('cashflows', uid),
    fetchUserCollection<Goal>('goals', uid),
    fetchUserCollection<PortfolioSnapshot>('snapshots', uid),
    fetchUserCollection<NetWorthSnapshot>('networthSnapshots', uid),
    fetchUserCollection<Account>('accounts', uid),
    fetchUserCollection<Field>('agriFields', uid),
    fetchUserCollection<CropCycle>('agriCropCycles', uid),
    fetchUserCollection<AgriExpense>('agriExpenses', uid),
    fetchUserCollection<Livestock>('agriLivestock', uid),
    fetchUserCollection<MilkRecord>('agriMilkRecords', uid),
    fetchUserCollection<CoconutRecord>('agriCoconut', uid),
    fetchUserCollection<LivestockEvent>('agriLivestockEvents', uid),
  ]);

  const settingsDoc = await getDoc(doc(db, 'settings', uid));
  const settings = settingsDoc.exists()
    ? (settingsDoc.data() as SettingsRecord)
    : null;

  const payload: BackupPayload = {
    version: 3,
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
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });

  const dateStr = new Date().toISOString().split('T')[0];
  saveAs(blob, `finance-backup-${dateStr}.json`);
}

// ── Import ──────────────────────────────────────────────────────────────────
export async function importFullBackup(jsonText: string, uid: string) {
  if (!uid) throw new Error('User context missing. Please log in again.');

  const parsed = JSON.parse(jsonText) as BackupPayload;
  if (!parsed || ![1, 2, 3].includes(parsed.version)) {
    throw new Error('Unsupported backup format. Expected version 1, 2, or 3.');
  }

  // Use chunked batch writes to stay within Firestore 500-op limit
  await Promise.all([
    batchSet('investments', parsed.investments ?? [], uid),
    batchSet('liabilities', parsed.liabilities ?? [], uid),
    batchSet('cashflows', parsed.cashflows ?? [], uid),
    batchSet('goals', parsed.goals ?? [], uid),
    batchSet('snapshots', parsed.snapshots ?? [], uid),
    batchSet('networthSnapshots', parsed.networthSnapshots ?? [], uid),
    batchSet('accounts', (parsed as any).accounts ?? [], uid),
    // Agriculture collections (v3)
    batchSet('agriFields', parsed.agriFields ?? [], uid),
    batchSet('agriCropCycles', parsed.agriCropCycles ?? [], uid),
    batchSet('agriExpenses', parsed.agriExpenses ?? [], uid),
    batchSet('agriLivestock', parsed.agriLivestock ?? [], uid),
    batchSet('agriMilkRecords', parsed.agriMilkRecords ?? [], uid),
    batchSet('agriCoconut', parsed.agriCoconut ?? [], uid),
    batchSet('agriLivestockEvents', parsed.agriLivestockEvents ?? [], uid),
  ]);

  // Restore settings in a single doc write
  const settingsBatch = writeBatch(db);
  settingsBatch.set(doc(db, 'settings', uid), {
    id: uid,
    notion: parsed.notion ?? { enabled: false },
    essentials: parsed.essentials ?? {},
  });
  await settingsBatch.commit();
}
