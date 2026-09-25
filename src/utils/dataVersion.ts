/**
 * src/utils/dataVersion.ts
 *
 * Cheap "did anything change?" signal, so the app can stop re-reading every
 * collection on every tab focus.
 *
 * Without this, a reconnect or an alt-tab back to the app costs one Firestore
 * read per document the user owns. With it, that check costs exactly one read
 * of the settings document, and only collections whose stamp moved are refetched.
 *
 * Writes are debounced and merged: a burst of saves costs one extra write, not
 * one per save.
 */

import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

const FLUSH_MS = 3000;

/** Identifies *this tab* in the stamps. A stamp written by us must not trigger a
 *  reload (our memory is already the newest copy of it), while a stamp from a
 *  phone, another tab or a Cloud Function must. Per-tab rather than per-user so
 *  two open tabs still sync with each other. */
const CLIENT_ID =
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

export const selfClientId = () => CLIENT_ID;

/** `dataVersions/{collection}` — a server time plus the tab that caused it. */
export type DataStamp = { ms: number; by: string };

const pending = new Map<string, Set<string>>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

const settingsRef = (uid: string) => doc(db, 'users', uid, 'settings', 'config');

function flush(uid: string) {
  const cols = pending.get(uid);
  pending.delete(uid);
  timers.delete(uid);
  if (!cols?.size) return;

  const patch: Record<string, unknown> = { dataUpdatedAt: serverTimestamp() };
  for (const col of cols) {
    patch[`dataVersions.${col}`] = { at: serverTimestamp(), by: CLIENT_ID };
  }

  setDoc(settingsRef(uid), patch, { merge: true }).catch((err) => {
    // Never let bookkeeping break a user-visible save.
    console.warn('[dataVersion] stamp write failed:', (err as Error)?.message);
  });
}

/** Call after any write to a user collection. */
export function markDataDirty(uid: string, collection: string) {
  if (!uid || !collection) return;
  if (!pending.has(uid)) pending.set(uid, new Set());
  pending.get(uid)!.add(collection);

  if (timers.has(uid)) return;
  timers.set(
    uid,
    setTimeout(() => flush(uid), FLUSH_MS),
  );
}

/** Pull the stamps out of a settings document that was already read, so the
 *  first hydrate costs no extra read. Exported for the store's hydrate(). */
export function versionsFromSettings(
  data?: Record<string, unknown> | null,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [col, stamp] of Object.entries(stampsFromSettings(data))) {
    if (stamp.ms) out[col] = stamp.ms;
  }
  return out;
}

/** Same map, but keeping the writing client so a reload can skip its own edits. */
export function stampsFromSettings(
  data?: Record<string, unknown> | null,
): Record<string, DataStamp> {
  const raw = (data?.dataVersions ?? {}) as Record<
    string,
    | { at?: { toMillis?: () => number }; by?: string }
    | { toMillis?: () => number }
    | number
  >;
  const out: Record<string, DataStamp> = {};
  for (const [col, value] of Object.entries(raw)) {
    if (value == null) continue;
    if (typeof value === 'number') {
      out[col] = { ms: value, by: '' };
      continue;
    }
    // `{ at: Timestamp, by: clientId }` is the current shape; a bare Timestamp
    // is what builds before this wrote and has no known origin.
    const nested = (value as { at?: { toMillis?: () => number } }).at;
    const ts = nested ?? (value as { toMillis?: () => number });
    const ms = typeof ts?.toMillis === 'function' ? ts.toMillis() : Number(ts) || 0;
    out[col] = { ms, by: (value as { by?: string }).by ?? '' };
  }
  return out;
}

/** Read the current stamps. One document read. */
export async function readDataVersions(uid: string): Promise<Record<string, number>> {
  const stamps = await readDataStamps(uid);
  const out: Record<string, number> = {};
  for (const [col, stamp] of Object.entries(stamps)) {
    if (stamp.ms) out[col] = stamp.ms;
  }
  return out;
}

/** Same, keeping the writing client — see `staleCollections()`. */
export async function readDataStamps(
  uid: string,
): Promise<Record<string, DataStamp>> {
  try {
    const snap = await getDoc(settingsRef(uid));
    return stampsFromSettings(snap.data() as Record<string, unknown> | undefined);
  } catch {
    return {};
  }
}

/** Collections whose server stamp is newer than what we last loaded, ignoring
 *  the ones this very tab wrote (`own` — its memory is already current). */
export function staleCollections(
  loaded: Record<string, number>,
  current: Record<string, DataStamp>,
  own = CLIENT_ID,
): string[] {
  return Object.entries(current)
    .filter(
      ([col, stamp]) =>
        stamp.by !== own && (stamp.ms ?? 0) > (loaded[col] ?? 0),
    )
    .map(([col]) => col);
}

/** Live view of the stamps. One listener for every user collection, so a change
 *  made on the phone shows up on the laptop without polling each collection.
 *  `onStamps` fires with the full map whenever any stamp moves. */
export function subscribeDataVersions(
  uid: string,
  onStamps: (stamps: Record<string, DataStamp>) => void,
): () => void {
  if (!uid) return () => {};
  try {
    return onSnapshot(
      settingsRef(uid),
      (snap) => onStamps(stampsFromSettings(snap.data() as Record<string, unknown> | undefined)),
      // Offline / rules change: the focus + online handlers still do a manual
      // `readDataVersions()` check, so a lost listener degrades, never breaks.
      () => {},
    );
  } catch {
    return () => {};
  }
}

/** Drop pending state on sign-out so the next user never inherits a flush. */
export function resetDataVersions(uid: string) {
  pending.delete(uid);
  const timer = timers.get(uid);
  if (timer) clearTimeout(timer);
  timers.delete(uid);
}
