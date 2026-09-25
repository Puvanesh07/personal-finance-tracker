// src/store/portfolioPersistence.ts
//
// Firestore plumbing for the portfolio store (audit Y1 — extracted verbatim
// from portfolioStore.ts, behaviour unchanged). Document references, the
// encrypted read/write helpers and the atomic batch writer (audit C5).
//
// Deliberately imports NOTHING from portfolioStore.ts: the cached encryption
// flag is passed in by the caller, so this stays a leaf module with no cycles.
// Functions that read/write Zustand *state* (settingsPatch, reloadCollectionPatch,
// syncInsuranceBill) remain in the store next to the state shape they know.

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  writeBatch,
} from 'firebase/firestore';

import {
  decryptDoc,
  encryptDoc,
  type FirestoreDoc,
} from '../services/encryptionService';
import { db } from '../services/firebase';
import { markDataDirty } from '../utils/dataVersion';

// Re-exported so the store can build one-off write batches (bulk delete, clear
// all) without importing the Firebase app module directly.
export { db };

export const userCol = (uid: string, col: string) => collection(db, 'users', uid, col);
export const userDoc = (uid: string, col: string, id: string) =>
  doc(db, 'users', uid, col, id);
export const settingsDocRef = (uid: string) =>
  doc(db, 'users', uid, 'settings', 'config');

/** Same reference as userDoc, but also flags the collection as changed so other
 *  tabs/devices can tell that they are stale without re-reading everything. */
export const touchedDoc = (uid: string, col: string, id: string) => {
  markDataDirty(uid, col);
  return doc(db, 'users', uid, col, id);
};

/** Delete a document AND stamp the collection, via touchedDoc. The returned
 *  promise is the raw Firestore delete — call sites keep their existing
 *  `.catch()` handling. */
export const deleteTouchedDoc = (uid: string, col: string, id: string) =>
  deleteDoc(touchedDoc(uid, col, id));

export async function fetchSub<T>(uid: string, col: string): Promise<T[]> {
  const snap = await getDocs(userCol(uid, col));
  return Promise.all(
    snap.docs.map((d) => decryptDoc<T>(uid, d.data() as FirestoreDoc)),
  );
}

/** saveDoc — takes the precomputed encryption flag so we never hit Firestore
 *  for it on every write. Callers pass the store's encryptionEnabled field. */
export async function saveDoc<
  T extends {
    id: string;
    userId?: string;
    createdAt?: string;
    updatedAt?: string;
  },
>(uid: string, col: string, data: T, encryptionEnabled: boolean): Promise<void> {
  const payload = await encryptDoc(uid, data, encryptionEnabled);
  await setDoc(userDoc(uid, col, data.id), payload);
  markDataDirty(uid, col);
}

/** Atomically write (and/or delete) a group of documents in one Firestore batch
 *  so a source record and the cashflow(s) it derives can never half-apply —
 *  e.g. a goal contribution saved but its transfer lost, or vice-versa
 *  (audit C5). Every payload is encrypted the same way saveDoc does. Change
 *  stamps are bumped per touched collection only after a successful commit. */
export async function saveDocsAtomically(
  uid: string,
  writes: { col: string; data: object }[],
  deletes: { col: string; id: string }[] = [],
  encryptionEnabled: boolean = true,
): Promise<void> {
  const batch = writeBatch(db);
  const touchedCols = new Set<string>();
  for (const w of writes) {
    const payload = await encryptDoc(
      uid,
      w.data as Parameters<typeof encryptDoc>[1],
      encryptionEnabled,
    );
    batch.set(
      userDoc(uid, w.col, (w.data as { id: string }).id),
      payload as Parameters<typeof batch.set>[1],
    );
    touchedCols.add(w.col);
  }
  for (const d of deletes) {
    batch.delete(userDoc(uid, d.col, d.id));
    touchedCols.add(d.col);
  }
  await batch.commit();
  touchedCols.forEach((col) => markDataDirty(uid, col));
}
