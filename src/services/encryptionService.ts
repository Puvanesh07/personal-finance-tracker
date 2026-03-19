// ============================================================
//  src/services/encryptionService.ts
// ============================================================

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
} from 'firebase/firestore';

import { db } from './firebase';

// ─── Types ───────────────────────────────────────────────────────────────────

export type FirestoreDoc = Record<string, unknown>;

// ─── Config ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SALT: string =
  (import.meta as any).env?.VITE_ENCRYPTION_SALT ?? 'default-finance-salt-v1';

const COLLECTIONS = [
  'investments',
  'liabilities',
  'cashflows',
  'goals',
  'accounts',
  'soldTrades',
  'insurancePolicies',
  'sipPlans',
  'snapshots',
  'networthSnapshots',
  'insights',
  'agriFields',
  'agriCropCycles',
  'agriExpenses',
  'agriLivestock',
  'agriMilkRecords',
  'agriCoconut',
  'agriLivestockEvents',
  'attEmployees',
  'attRecords',
  'attTransactions',
  'attSalary',
];

// ─── Key cache ────────────────────────────────────────────────────────────────

const _keyCache = new Map<string, CryptoKey>();

async function deriveKey(uid: string): Promise<CryptoKey> {
  const cached = _keyCache.get(uid);
  if (cached) return cached;

  const encoder = new TextEncoder();

  const baseKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(`${uid}::${SALT}`),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(SALT),
      iterations: 100_000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );

  _keyCache.set(uid, key);
  return key;
}

// ─── Base64 helpers (no spread — avoids Uint8Array TS error) ─────────────────

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(str: string): Uint8Array {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ─── Firebase flag ────────────────────────────────────────────────────────────

const settingsRef = (uid: string) =>
  doc(db, 'users', uid, 'settings', 'config');

/**
 * Read the master encryption boolean flag from Firestore.
 * Path: users/{uid}/settings/config → { encryptionEnabled: boolean }
 *
 * This is the "x-encrypted: true/false" boolean flag you asked for.
 */
export async function isEncryptionEnabled(uid: string): Promise<boolean> {
  try {
    const snap = await getDoc(settingsRef(uid));
    // Default is ON — only return false if explicitly set to false
    if (!snap.exists()) return true;
    const data = snap.data() as Record<string, unknown>;
    return data['encryptionEnabled'] !== false;
  } catch {
    return true; // Default ON even if Firestore read fails
  }
}

/**
 * Set the encryptionEnabled boolean flag in Firebase.
 * This is the "x-encrypted: true/false" toggle you asked for.
 *
 * await setEncryptionEnabled(uid, true);   // turn ON
 * await setEncryptionEnabled(uid, false);  // turn OFF
 */
export async function setEncryptionEnabled(
  uid: string,
  enabled: boolean,
): Promise<void> {
  await setDoc(
    settingsRef(uid),
    { encryptionEnabled: enabled },
    { merge: true },
  );
}

// ─── Core encrypt ─────────────────────────────────────────────────────────────

/**
 * Encrypt a document before writing to Firestore.
 *
 * forceEncrypt = true      → always encrypt (ignores Firebase flag)
 * forceEncrypt = false     → always plain   (ignores Firebase flag)
 * forceEncrypt = undefined → reads Firebase flag automatically
 */
export async function encryptDoc<
  T extends {
    id: string;
    userId?: string;
    createdAt?: string;
    updatedAt?: string;
  },
>(uid: string, data: T, forceEncrypt?: boolean): Promise<FirestoreDoc> {
  const shouldEncrypt =
    forceEncrypt !== undefined ? forceEncrypt : await isEncryptionEnabled(uid);

  if (!shouldEncrypt) {
    return { ...(data as Record<string, unknown>), _encrypted: false };
  }

  const key = await deriveKey(uid);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(data));

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext,
  );

  return {
    _encrypted: true,
    _iv: toBase64(iv),
    _data: toBase64(new Uint8Array(ciphertextBuffer)),
    id: data.id,
    ...(data.userId ? { userId: data.userId } : {}),
    ...(data.createdAt ? { createdAt: data.createdAt } : {}),
    ...(data.updatedAt ? { updatedAt: data.updatedAt } : {}),
  };
}

// ─── Core decrypt ─────────────────────────────────────────────────────────────

/**
 * Decrypt a document read from Firestore.
 * If _encrypted !== true, returns the document as-is (backward-compatible).
 */
export async function decryptDoc<T>(
  uid: string,
  raw: FirestoreDoc,
): Promise<T> {
  if (raw['_encrypted'] !== true) {
    const copy = { ...raw };
    delete copy['_encrypted'];
    return copy as unknown as T;
  }

  const key = await deriveKey(uid);
  const iv = fromBase64(raw['_iv'] as string);
  const ciphertextBytes = fromBase64(raw['_data'] as string);

  let plaintextBuffer: ArrayBuffer;
  try {
    plaintextBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      ciphertextBytes as BufferSource,
    );
  } catch {
    throw new Error(
      `[EncryptionService] Decryption failed for doc id=${String(raw['id'])}. ` +
        `Wrong key or corrupted data. Check VITE_ENCRYPTION_SALT.`,
    );
  }

  return JSON.parse(new TextDecoder().decode(plaintextBuffer)) as T;
}

// ─── Batch helpers ────────────────────────────────────────────────────────────

export async function encryptDocs<
  T extends {
    id: string;
    userId?: string;
    createdAt?: string;
    updatedAt?: string;
  },
>(uid: string, docs: T[], forceEncrypt?: boolean): Promise<FirestoreDoc[]> {
  return Promise.all(docs.map((d) => encryptDoc(uid, d, forceEncrypt)));
}

export async function decryptDocs<T>(
  uid: string,
  docs: FirestoreDoc[],
): Promise<T[]> {
  return Promise.all(docs.map((d) => decryptDoc<T>(uid, d)));
}

// ─── Migration — encrypt all existing data ────────────────────────────────────

/**
 * Encrypt ALL existing Firestore documents for a user.
 * Call once after turning ON encryption for the first time.
 */
export async function migrateAllDataToEncrypted(
  uid: string,
  onProgress?: (col: string, done: number, total: number) => void,
): Promise<void> {
  for (const colName of COLLECTIONS) {
    const colRef = collection(db, 'users', uid, colName);
    const snap = await getDocs(colRef);
    if (snap.empty) continue;

    const docs = snap.docs;
    const total = docs.length;
    let done = 0;

    for (let i = 0; i < docs.length; i += 249) {
      const batch = writeBatch(db);
      const slice = docs.slice(i, i + 249);

      for (const d of slice) {
        const plain = d.data() as FirestoreDoc;
        if (plain['_encrypted'] === true) {
          done++;
          continue;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const encrypted = await encryptDoc(uid, plain as any, true);
        batch.set(d.ref, encrypted);
        done++;
      }

      await batch.commit();
      onProgress?.(colName, done, total);
    }
  }
}

// ─── Migration — decrypt all data back to plain ───────────────────────────────

/**
 * Decrypt ALL Firestore documents back to plain storage.
 * Call once after turning OFF encryption.
 */
export async function migrateAllDataToPlain(
  uid: string,
  onProgress?: (col: string, done: number, total: number) => void,
): Promise<void> {
  for (const colName of COLLECTIONS) {
    const colRef = collection(db, 'users', uid, colName);
    const snap = await getDocs(colRef);
    if (snap.empty) continue;

    const docs = snap.docs;
    const total = docs.length;
    let done = 0;

    for (let i = 0; i < docs.length; i += 249) {
      const batch = writeBatch(db);
      const slice = docs.slice(i, i + 249);

      for (const d of slice) {
        const raw = d.data() as FirestoreDoc;
        if (raw['_encrypted'] !== true) {
          done++;
          continue;
        }
        const plain = await decryptDoc<Record<string, unknown>>(uid, raw);
        batch.set(d.ref, { ...plain, _encrypted: false });
        done++;
      }

      await batch.commit();
      onProgress?.(colName, done, total);
    }
  }
}
