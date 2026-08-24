// src/services/ledgerService.ts

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import { decryptDoc, encryptDoc, type FirestoreDoc } from './encryptionService';
import type { LedgerEntry, LedgerModule, LedgerSourceType, LedgerType } from '../types/ledgerTypes';
import { currentTimestampISO, todayBusinessDate } from './dateService';

const ledgerCol = (uid: string) => collection(db, 'users', uid, 'ledgerEntries');
const ledgerDoc = (uid: string, id: string) => doc(db, 'users', uid, 'ledgerEntries', id);

/**
 * Generates a deterministic ID for a ledger entry given a sourceType and sourceId.
 * Guarantees idempotency (e.g. marking a payment paid twice will upsert the same doc ID).
 */
export function getDeterministicLedgerId(sourceType: LedgerSourceType, sourceId: string): string {
  const sanitizedSource = sourceType.replace(/[^a-zA-Z0-9_]/g, '_');
  const sanitizedId = sourceId.replace(/[^a-zA-Z0-9_]/g, '_');
  return `ledger_${sanitizedSource}_${sanitizedId}`;
}

export async function fetchLedgerEntries(uid: string): Promise<LedgerEntry[]> {
  const snap = await getDocs(ledgerCol(uid));
  const entries = await Promise.all(
    snap.docs.map((d) => decryptDoc<LedgerEntry>(uid, d.data() as FirestoreDoc)),
  );
  return entries.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

export type UpsertLedgerPayload = {
  id?: string;
  type: LedgerType;
  date: string;
  amount: number;
  category: string;
  subcategory?: string;
  accountId?: string;
  module?: LedgerModule;
  sourceType?: LedgerSourceType;
  sourceId?: string;
  costCenterId?: string;
  notes?: string;
};

/**
 * Idempotently saves or updates a ledger entry in Firestore.
 */
export async function saveLedgerEntry(
  uid: string,
  payload: UpsertLedgerPayload,
): Promise<LedgerEntry> {
  const t = currentTimestampISO();
  const sourceType = payload.sourceType ?? 'manual';
  const id = payload.id ?? (payload.sourceId ? getDeterministicLedgerId(sourceType, payload.sourceId) : `ledger_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);

  const entry: LedgerEntry = {
    id,
    type: payload.type,
    date: payload.date || todayBusinessDate(),
    amount: Math.abs(payload.amount),
    category: payload.category.trim() || 'General',
    subcategory: payload.subcategory?.trim(),
    accountId: payload.accountId || undefined,
    module: payload.module ?? 'personal',
    sourceType,
    sourceId: payload.sourceId,
    costCenterId: payload.costCenterId,
    notes: payload.notes?.trim(),
    userId: uid,
    createdAt: t,
    updatedAt: t,
  };

  const encrypted = await encryptDoc(uid, entry);
  await setDoc(ledgerDoc(uid, id), encrypted);
  return entry;
}

/**
 * Deletes a ledger entry by ID.
 */
export async function deleteLedgerEntry(uid: string, id: string): Promise<void> {
  await deleteDoc(ledgerDoc(uid, id));
}

/**
 * Deletes a ledger entry associated with a specific sourceType and sourceId.
 */
export async function deleteLedgerEntryBySource(
  uid: string,
  sourceType: LedgerSourceType,
  sourceId: string,
): Promise<void> {
  const deterministicId = getDeterministicLedgerId(sourceType, sourceId);
  await deleteDoc(ledgerDoc(uid, deterministicId));

  // Also query in case legacy entries had random IDs
  const q = query(
    ledgerCol(uid),
    where('sourceType', '==', sourceType),
    where('sourceId', '==', sourceId),
  );
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
}
