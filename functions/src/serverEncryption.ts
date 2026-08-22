/**
 * functions/src/serverEncryption.ts
 *
 * ── Why this file exists ────────────────────────────────────────────────────
 * The web app encrypts every document before writing it to Firestore — see
 * `encryptDoc()` in src/services/encryptionService.ts. Encryption is ON by
 * default for every user (isEncryptionEnabled() returns true unless the user
 * has explicitly switched it off in Settings), and it applies to EVERY
 * collection written via `saveDoc()` in src/store/portfolioStore.ts —
 * including `trackedPayments` and `insurancePolicies` — regardless of
 * whether that collection happens to be listed in the client's COLLECTIONS
 * array (that array is only used for the bulk "Encrypt All / Decrypt All"
 * migration buttons, not for per-write encryption).
 *
 * So a document actually stored in Firestore looks like:
 *   { _encrypted: true, _iv: "...", _data: "...", id, userId?, createdAt?, updatedAt? }
 * and none of the real fields (dueDate, title, amount, renewalDate, ...)
 * exist in plaintext there. They only exist inside the encrypted `_data`
 * blob, which is decrypted client-side, in the browser, using the Web
 * Crypto API.
 *
 * `functions/src/pushNotifications.ts` previously read these documents with
 * the Admin SDK and used fields like `p.dueDate` directly — which were
 * `undefined` because the document was still encrypted. `new Date(undefined)`
 * is an Invalid Date, so `daysDiff()` returned `NaN`, and `NaN` never equals
 * any of the reminder-rule day numbers — hence every payment/policy printed
 * `NO MATCH ... daysUntilDue=NaN` no matter what due date you entered.
 *
 * This module re-derives the *exact same* AES-GCM key the client derives
 * (PBKDF2("<uid>::<salt>", salt, 100_000 iterations, SHA-256) → AES-GCM-256)
 * and decrypts documents the same way `decryptDoc()` does on the client, so
 * the Cloud Function sees the real field values.
 *
 * ── Configuration ────────────────────────────────────────────────────────
 * The salt MUST match whatever the web app was built with
 * (`VITE_ENCRYPTION_SALT` in the app's root `.env`). If you never set
 * `VITE_ENCRYPTION_SALT`, the client falls back to the literal string
 * 'default-finance-salt-v1' — and so does this file, automatically. No
 * configuration is required in that (very common) case.
 *
 * If you DID set a custom VITE_ENCRYPTION_SALT for the web app, create
 * `functions/.env` (a separate file from the root `.env` — Firebase
 * Functions v2 auto-loads `functions/.env` at deploy/runtime) containing:
 *
 *   ENCRYPTION_SALT=<the exact same value as your root .env's VITE_ENCRYPTION_SALT>
 */

const DEFAULT_SALT = 'default-finance-salt-v1';

function getSalt(): string {
  return (
    process.env.ENCRYPTION_SALT?.trim() ||
    process.env.VITE_ENCRYPTION_SALT?.trim() ||
    DEFAULT_SALT
  );
}

export type FirestoreDoc = Record<string, unknown>;

// Cache derived keys per uid+salt so we don't re-run PBKDF2 (100k iterations)
// for every single document.
const _keyCache = new Map<string, CryptoKey>();

async function deriveKey(uid: string): Promise<CryptoKey> {
  const salt = getSalt();
  const cacheKey = `${uid}::${salt}`;
  const cached = _keyCache.get(cacheKey);
  if (cached) return cached;

  const encoder = new TextEncoder();

  const baseKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(`${uid}::${salt}`),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations: 100_000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );

  _keyCache.set(cacheKey, key);
  return key;
}

function fromBase64(str: string): Uint8Array {
  return new Uint8Array(Buffer.from(str, 'base64'));
}

/**
 * Decrypt a document read from Firestore via the Admin SDK.
 * Mirrors `decryptDoc()` in src/services/encryptionService.ts exactly.
 * If the doc isn't encrypted (`_encrypted !== true`), it's returned as-is
 * (minus the `_encrypted` flag) — same backward-compatible behavior as the
 * client.
 */
export async function decryptDoc<T>(uid: string, raw: FirestoreDoc): Promise<T> {
  if (raw['_encrypted'] !== true) {
    const copy = { ...raw };
    delete copy['_encrypted'];
    return copy as unknown as T;
  }

  const key = await deriveKey(uid);
  const iv = fromBase64(raw['_iv'] as string);
  const ciphertextBytes = fromBase64(raw['_data'] as string);

  try {
    const plaintextBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      ciphertextBytes as BufferSource,
    );
    return JSON.parse(new TextDecoder().decode(plaintextBuffer)) as T;
  } catch (err) {
    throw new Error(
      `[serverEncryption] Decryption failed for uid=${uid} doc id=${String(raw['id'])}. ` +
        `This means ENCRYPTION_SALT here does not match VITE_ENCRYPTION_SALT used by the ` +
        `web app, or the document is corrupted. ` +
        `err=${err instanceof Error ? err.message : String(err)}`,
    );
  }
}