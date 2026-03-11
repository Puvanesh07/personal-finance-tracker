import type {
  CashflowEntry,
  EssentialsConfig,
  Goal,
  Investment,
  Liability,
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
// src/utils/backup.ts
import { saveAs } from 'file-saver';

export type BackupPayload = {
  version: 1;
  createdAt: string;
  investments: Investment[];
  liabilities: Liability[];
  cashflows: CashflowEntry[];
  goals: Goal[];
  snapshots: PortfolioSnapshot[];
  networthSnapshots: NetWorthSnapshot[];
  notion: NotionConfig;
  essentials: EssentialsConfig;
};

// Helper to fetch only data belonging to the current user
async function fetchUserCollection<T>(
  colName: string,
  uid: string,
): Promise<T[]> {
  const q = query(collection(db, colName), where('userId', '==', uid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as T);
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
  ] = await Promise.all([
    fetchUserCollection<Investment>('investments', uid),
    fetchUserCollection<Liability>('liabilities', uid),
    fetchUserCollection<CashflowEntry>('cashflows', uid),
    fetchUserCollection<Goal>('goals', uid),
    fetchUserCollection<PortfolioSnapshot>('snapshots', uid),
    fetchUserCollection<NetWorthSnapshot>('networthSnapshots', uid),
  ]);

  // Settings are stored with the UID as the document ID
  const settingsDoc = await getDoc(doc(db, 'settings', uid));
  const settings = settingsDoc.exists()
    ? (settingsDoc.data() as SettingsRecord)
    : null;

  const payload: BackupPayload = {
    version: 1,
    createdAt: new Date().toISOString(),
    investments,
    liabilities,
    cashflows,
    goals,
    snapshots,
    networthSnapshots,
    notion: settings?.notion ?? { enabled: false },
    essentials: settings?.essentials ?? {},
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });

  const dateStr = new Date().toISOString().split('T')[0];
  saveAs(blob, `finance-backup-${dateStr}.json`);
}

export async function importFullBackup(jsonText: string, uid: string) {
  if (!uid) throw new Error('User context missing. Please log in again.');

  const parsed = JSON.parse(jsonText) as BackupPayload;
  if (!parsed || parsed.version !== 1)
    throw new Error('Unsupported backup format.');

  const batch = writeBatch(db);

  const addToBatch = (colName: string, items: any[]) => {
    if (!items) return;
    items.forEach((item) => {
      // Ensure the imported data is assigned to the current user
      const dataWithUid = { ...item, userId: uid };
      batch.set(doc(db, colName, item.id), dataWithUid);
    });
  };

  addToBatch('investments', parsed.investments);
  addToBatch('liabilities', parsed.liabilities);
  addToBatch('cashflows', parsed.cashflows);
  addToBatch('goals', parsed.goals);
  addToBatch('snapshots', parsed.snapshots);
  addToBatch('networthSnapshots', parsed.networthSnapshots);

  // Restore settings
  batch.set(doc(db, 'settings', uid), {
    id: uid,
    notion: parsed.notion ?? { enabled: false },
    essentials: parsed.essentials ?? {},
  });

  await batch.commit();
}
