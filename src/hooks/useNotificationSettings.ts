/**
 * src/hooks/useNotificationSettings.ts
 *
 * Read-only access to `users/{uid}/notificationSettings/config` for anything
 * that has to decide whether a reminder is wanted at all.
 *
 * The in-app bell derives its notifications on every render, so this must not
 * hit Firestore on each one: the document is fetched once per uid and kept in a
 * module-level store. The Settings panel pushes its saved values into the same
 * store, so a toggle takes effect immediately instead of after a reload.
 *
 * Defaults are all-on, which is what the app behaved like before the settings
 * existed — a user who never opened the panel keeps every reminder.
 */

import { useEffect } from 'react';
import { useSyncExternalStore } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { onIdTokenChanged } from 'firebase/auth';
import { auth, db } from '../services/firebase';
import type { NotificationSettingsConfig } from '../components/notifications/NotificationSettings';

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettingsConfig = {
  pushEnabled: true,
  paymentReminders: true,
  insuranceReminders: true,
  goalReminders: true,
  emiReminders: true,
  sipReminders: true,
  investmentAlerts: true,
  subscriptionAlerts: true,
  weeklyDigest: true,
  monthlyReport: true,
};

type State = {
  uid: string | null;
  settings: NotificationSettingsConfig;
};

let state: State = { uid: null, settings: DEFAULT_NOTIFICATION_SETTINGS };
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function setState(next: State) {
  if (next.uid === state.uid && next.settings === state.settings) return;
  state = next;
  emit();
}

/** Called by the settings panel after a successful save so the bell re-derives
 *  with the new flags right away. */
export function setNotificationSettingsCache(
  uid: string,
  settings: NotificationSettingsConfig,
) {
  if (state.uid !== uid) return; // another account is on screen
  setState({ uid, settings });
}

/** Live document flags for the signed-in user; all-on while it loads. */
export function useNotificationSettings(): NotificationSettingsConfig {
  const uid = useSignedInUid();

  const settings = useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => (state.uid === uid ? state.settings : DEFAULT_NOTIFICATION_SETTINGS),
    () => DEFAULT_NOTIFICATION_SETTINGS,
  );

  useEffect(() => {
    if (!uid) {
      setState({ uid: null, settings: DEFAULT_NOTIFICATION_SETTINGS });
      return;
    }
    const ref = doc(db, 'users', uid, 'notificationSettings', 'config');
    let cancelled = false;

    // Realtime, so a second tab or a save from the settings page lands here.
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (cancelled) return;
        setState({
          uid,
          settings: {
            ...DEFAULT_NOTIFICATION_SETTINGS,
            ...(snap.exists() ? snap.data() : {}),
          },
        });
      },
      // A rules/network failure must not silence the bell — keep the defaults.
      () => {
        if (!cancelled && state.uid !== uid) {
          setState({ uid, settings: DEFAULT_NOTIFICATION_SETTINGS });
        }
      },
    );

    // `onSnapshot` already delivers the current contents, so nothing else to do.
    return () => {
      cancelled = true;
      unsub();
    };
  }, [uid]);

  return settings;
}

/** Current signed-in uid, re-rendering the consumer when the account changes. */
function useSignedInUid(): string | null {
  return useSyncExternalStore(
    (onChange) => onIdTokenChanged(auth, () => onChange()),
    () => auth.currentUser?.uid ?? null,
    () => null,
  );
}

/** Non-hook form for code that runs outside React (e.g. the digest preview). */
export async function loadNotificationSettingsOnce(
  uid: string,
): Promise<NotificationSettingsConfig> {
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'notificationSettings', 'config'));
    return {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      ...(snap.exists() ? snap.data() : {}),
    } as NotificationSettingsConfig;
  } catch {
    return DEFAULT_NOTIFICATION_SETTINGS;
  }
}
