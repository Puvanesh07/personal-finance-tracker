// src/services/migrationService.ts

import { doc, getDoc, getDocs, setDoc, writeBatch, collection } from 'firebase/firestore';
import { db } from './firebase';
import { decryptDoc, encryptDoc, type FirestoreDoc } from './encryptionService';
import type { LedgerEntry } from '../types/ledgerTypes';
import { getDeterministicLedgerId } from './ledgerService';
import type { CashflowEntry, PendingPayment, TrackedPayment } from '../types/investmentTypes';

const MIGRATION_VERSION = 1;

export async function runIdempotentLedgerMigration(uid: string): Promise<boolean> {
  if (!uid) return false;

  const userRef = doc(db, 'users', uid, 'settings', 'config');
  const settingsSnap = await getDoc(userRef);
  const settingsData = settingsSnap.exists() ? settingsSnap.data() : {};

  if (settingsData?.migrationVersion >= MIGRATION_VERSION) {
    return false; // Already migrated
  }

  const subCol = (c: string) => collection(db, 'users', uid, c);
  const fetchDocs = async <T>(c: string): Promise<T[]> => {
    const snap = await getDocs(subCol(c));
    return Promise.all(snap.docs.map((d) => decryptDoc<T>(uid, d.data() as FirestoreDoc)));
  };

  const [
    cashflows,
    trackedPayments,
    pendingPayments,
  ] = await Promise.all([
    fetchDocs<CashflowEntry>('cashflows'),
    fetchDocs<TrackedPayment>('trackedPayments'),
    fetchDocs<PendingPayment>('pendingPayments'),
  ]);

  const newLedgerEntries: LedgerEntry[] = [];
  const now = new Date().toISOString();

  // 1. Migrate manual Cashflow entries
  for (const cf of cashflows) {
    newLedgerEntries.push({
      id: `ledger_cf_${cf.id}`,
      type: cf.type,
      date: cf.date,
      amount: cf.amount,
      category: cf.category || 'General',
      accountId: cf.accountId,
      module: 'personal',
      sourceType: 'manual',
      sourceId: cf.id,
      notes: cf.notes,
      userId: uid,
      createdAt: cf.createdAt || now,
      updatedAt: cf.updatedAt || now,
    });
  }

  // 2. Migrate paid Tracked Payments
  for (const tp of trackedPayments) {
    if (tp.status === 'paid' && tp.paidAt) {
      const id = getDeterministicLedgerId('payment', tp.id);
      newLedgerEntries.push({
        id,
        type: 'expense',
        date: tp.paidAt,
        amount: tp.amount,
        category: tp.title || tp.paymentType || 'Bill Payment',
        module: 'payment',
        sourceType: 'payment',
        sourceId: tp.id,
        notes: tp.notes,
        userId: uid,
        createdAt: tp.createdAt || now,
        updatedAt: tp.updatedAt || now,
      });
    }
  }

  // 3. Migrate received Pending Payments (Receivables)
  for (const pp of pendingPayments) {
    if (pp.status === 'received' && pp.receivedAt) {
      const id = getDeterministicLedgerId('receivable', pp.id);
      newLedgerEntries.push({
        id,
        type: 'income',
        date: pp.receivedAt,
        amount: pp.amount,
        category: `Receivable - ${pp.buyerName}`,
        module: 'personal',
        sourceType: 'receivable',
        sourceId: pp.id,
        notes: pp.itemDescription,
        userId: uid,
        createdAt: pp.createdAt || now,
        updatedAt: pp.updatedAt || now,
      });
    }
  }

  // Batch write all migrated entries into Firestore
  const ledgerDocRef = (id: string) => doc(db, 'users', uid, 'ledgerEntries', id);
  for (let i = 0; i < newLedgerEntries.length; i += 499) {
    const batch = writeBatch(db);
    for (const entry of newLedgerEntries.slice(i, i + 499)) {
      const encrypted = await encryptDoc(uid, entry);
      batch.set(ledgerDocRef(entry.id), encrypted);
    }
    await batch.commit();
  }

  // Mark migration complete in settings
  await setDoc(userRef, { migrationVersion: MIGRATION_VERSION }, { merge: true });
  return true;
}
