// src/services/migrationService.ts

import { doc, getDoc, getDocs, setDoc, writeBatch, collection } from 'firebase/firestore';
import { db } from './firebase';
import { decryptDoc, encryptDoc, type FirestoreDoc } from './encryptionService';
import type { LedgerEntry } from '../types/ledgerTypes';
import { getDeterministicLedgerId } from './ledgerService';
import type { CashflowEntry, PendingPayment, TrackedPayment, AgriExpense, ProduceSaleLot, MilkRecord, CoconutRecord, LivestockEvent } from '../types/investmentTypes';

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
    agriExpenses,
    produceSales,
    milkRecords,
    coconutRecords,
    livestockEvents,
  ] = await Promise.all([
    fetchDocs<CashflowEntry>('cashflows'),
    fetchDocs<TrackedPayment>('trackedPayments'),
    fetchDocs<PendingPayment>('pendingPayments'),
    fetchDocs<AgriExpense>('agriExpenses'),
    fetchDocs<ProduceSaleLot>('agriProduceSales'),
    fetchDocs<MilkRecord>('agriMilkRecords'),
    fetchDocs<CoconutRecord>('agriCoconut'),
    fetchDocs<LivestockEvent>('agriLivestockEvents'),
  ]);

  const newLedgerEntries: LedgerEntry[] = [];
  const now = new Date().toISOString();

  // 1. Migrate manual Cashflow entries
  for (const cf of cashflows) {
    // Avoid legacy agri tags if present
    const isAgriTagged = cf.notes?.includes('[agri:');
    if (isAgriTagged) continue; // Will be migrated from agri collections directly

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

  // 4. Migrate Agriculture Expenses
  for (const ae of agriExpenses) {
    const id = getDeterministicLedgerId('agriculture_expense', ae.id);
    newLedgerEntries.push({
      id,
      type: 'expense',
      date: ae.date,
      amount: ae.amount,
      category: `Agri ${ae.category}`,
      accountId: ae.accountId,
      module: 'agriculture',
      sourceType: 'agriculture_expense',
      sourceId: ae.id,
      notes: ae.notes,
      userId: uid,
      createdAt: ae.createdAt || now,
      updatedAt: ae.updatedAt || now,
    });
  }

  // 5. Migrate Agriculture Produce Sales
  for (const ps of produceSales) {
    const id = getDeterministicLedgerId('agriculture_sale', ps.id);
    newLedgerEntries.push({
      id,
      type: 'income',
      date: ps.date,
      amount: ps.totalAmount,
      category: `Crop Sale - ${ps.produceName}`,
      accountId: ps.accountId,
      module: 'agriculture',
      sourceType: 'agriculture_sale',
      sourceId: ps.id,
      notes: ps.notes,
      userId: uid,
      createdAt: ps.createdAt || now,
      updatedAt: ps.updatedAt || now,
    });
  }

  // 6. Migrate Dairy Milk Sales
  for (const mr of milkRecords) {
    const id = getDeterministicLedgerId('dairy_sale', mr.id);
    newLedgerEntries.push({
      id,
      type: 'income',
      date: mr.date,
      amount: mr.liters * mr.pricePerLiter,
      category: 'Dairy Milk Sale',
      accountId: mr.accountId,
      module: 'agriculture',
      sourceType: 'dairy_sale',
      sourceId: mr.id,
      notes: `Dairy ${mr.session ?? ''} ${mr.liters}L x ₹${mr.pricePerLiter}`,
      userId: uid,
      createdAt: mr.createdAt || now,
      updatedAt: mr.updatedAt || now,
    });
  }

  // 7. Migrate Coconut Records
  for (const cr of coconutRecords) {
    if (cr.harvestIncome > 0) {
      const id = getDeterministicLedgerId('coconut_income', cr.id);
      newLedgerEntries.push({
        id,
        type: 'income',
        date: cr.date,
        amount: cr.harvestIncome,
        category: 'Coconut Harvest Income',
        accountId: cr.accountId,
        module: 'agriculture',
        sourceType: 'coconut_income',
        sourceId: cr.id,
        notes: cr.notes,
        userId: uid,
        createdAt: cr.createdAt || now,
        updatedAt: cr.updatedAt || now,
      });
    }
    if (cr.investmentAmount > 0) {
      const id = getDeterministicLedgerId('coconut_expense', cr.id);
      newLedgerEntries.push({
        id,
        type: 'expense',
        date: cr.date,
        amount: cr.investmentAmount,
        category: 'Coconut Investment Expense',
        accountId: cr.accountId,
        module: 'agriculture',
        sourceType: 'coconut_expense',
        sourceId: cr.id,
        notes: cr.notes,
        userId: uid,
        createdAt: cr.createdAt || now,
        updatedAt: cr.updatedAt || now,
      });
    }
  }

  // 8. Migrate Livestock Events
  for (const le of livestockEvents) {
    if (le.eventType === 'sale' && (le.price ?? 0) > 0) {
      const id = getDeterministicLedgerId('livestock', `${le.id}_sale`);
      newLedgerEntries.push({
        id,
        type: 'income',
        date: le.date,
        amount: le.price!,
        category: `Livestock Sale - ${le.animalType}`,
        accountId: le.accountId,
        module: 'agriculture',
        sourceType: 'livestock',
        sourceId: le.id,
        notes: le.notes,
        userId: uid,
        createdAt: le.createdAt || now,
        updatedAt: le.updatedAt || now,
      });
    }
    if (le.eventType === 'purchase' && (le.price ?? 0) > 0) {
      const id = getDeterministicLedgerId('livestock', `${le.id}_purchase`);
      newLedgerEntries.push({
        id,
        type: 'expense',
        date: le.date,
        amount: le.price!,
        category: `Livestock Purchase - ${le.animalType}`,
        accountId: le.accountId,
        module: 'agriculture',
        sourceType: 'livestock',
        sourceId: le.id,
        notes: le.notes,
        userId: uid,
        createdAt: le.createdAt || now,
        updatedAt: le.updatedAt || now,
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
