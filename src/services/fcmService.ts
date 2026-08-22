/**
 * src/services/fcmService.ts
 *
 * Firebase Cloud Messaging — client-side service.
 *
 * Responsibilities:
 *  1. Request / check notification permission.
 *  2. Get the FCM registration token (requires VAPID key).
 *  3. Store the device registration under users/{uid}/notificationDevices/{deviceId}.
 *  4. Listen for foreground messages and relay them to the in-app notificationStore.
 *  5. Provide helpers to unregister (delete token) when user disables notifications.
 *
 * Firestore structure written here:
 *   users/{uid}/notificationDevices/{deviceId}
 *   {
 *     token:       string,        // FCM registration token
 *     platform:    "web",
 *     type:        "pwa" | "browser",
 *     browser:     string,        // e.g. "Chrome 126"
 *     enabled:     boolean,
 *     createdAt:   Timestamp,
 *     lastSeenAt:  Timestamp,
 *   }
 */

import { getMessaging, getToken, onMessage, deleteToken, type Messaging } from 'firebase/messaging';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { app } from './firebase';
import { db } from './firebase';

// ── Stable device fingerprint ─────────────────────────────────────────────────
// We use a random ID stored in localStorage so the same browser always maps
// to the same Firestore document (rather than creating a new one on every login).
const DEVICE_ID_KEY = 'fintrackly_device_id';

function getOrCreateDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = 'dev_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

// ── Browser name helper ───────────────────────────────────────────────────────
function getBrowserName(): string {
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua))    return 'Edge';
  if (/OPR\//.test(ua))    return 'Opera';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Firefox\//.test(ua))return 'Firefox';
  if (/Safari\//.test(ua)) return 'Safari';
  return 'Browser';
}

function isPWA(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

// ── Dedicated FCM service worker registration ─────────────────────────────────
// IMPORTANT: We do NOT use `navigator.serviceWorker.ready` here. This app also
// runs vite-plugin-pwa, which registers its own Workbox service worker at the
// root scope ("/") for offline caching. `serviceWorker.ready` resolves to
// WHICHEVER worker is already controlling the page — on this app that's the
// Workbox one, not firebase-messaging-sw.js. That worker has no `push` event
// handling wired to Firebase, so background notifications silently never show,
// even though the token is issued and saved successfully.
//
// To fix this we explicitly register firebase-messaging-sw.js on its own scope
// (separate from "/"), so it doesn't collide with the Workbox worker, and pass
// THAT registration into getToken().
let _fcmSwRegistration: ServiceWorkerRegistration | null = null;

async function getFcmServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  if (_fcmSwRegistration) return _fcmSwRegistration;

  _fcmSwRegistration = await navigator.serviceWorker.register(
    '/firebase-messaging-sw.js',
    { scope: '/firebase-cloud-messaging-push-scope' },
  );

  return _fcmSwRegistration;
}

// ── Singleton messaging instance ──────────────────────────────────────────────
let _messaging: Messaging | null = null;

function getMessagingInstance(): Messaging | null {
  if (!('Notification' in window)) return null; // not supported (iOS Safari non-PWA)
  try {
    if (!_messaging) _messaging = getMessaging(app);
    return _messaging;
  } catch {
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

/** Returns current notification permission state (or 'unsupported'). */
export function getNotificationPermission(): PermissionState {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission as PermissionState;
}

/** Returns true if this browser/OS can do web push at all. */
export function isPushSupported(): boolean {
  return (
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

/**
 * Request notification permission, get FCM token, save to Firestore.
 * Call this after the user taps "Enable Notifications".
 *
 * @returns 'granted' if successful, 'denied' or 'unsupported' otherwise.
 */
export async function registerForPush(uid: string): Promise<PermissionState> {
  if (!isPushSupported()) return 'unsupported';

  const messaging = getMessagingInstance();
  if (!messaging) return 'unsupported';

  // Ask for permission
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';

  try {
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string;
    if (!vapidKey || vapidKey === 'YOUR_VAPID_PUBLIC_KEY_HERE') {
      console.warn('[FCM] VAPID key not configured. Push registration skipped.');
      return 'denied';
    }

    // Register (or reuse) the dedicated FCM service worker — NOT the app's
    // general-purpose Workbox/PWA service worker.
    const swReg = await getFcmServiceWorkerRegistration();

    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: swReg,
    });

    if (!token) return 'denied';

    await saveDeviceToFirestore(uid, token, true);

    console.log('[FCM] Device registered successfully.');
    return 'granted';
  } catch (err) {
    console.error('[FCM] Registration failed:', err);
    return 'denied';
  }
}

/**
 * Silently re-register on login if permission is already granted.
 * Updates the lastSeenAt timestamp and refreshes the token.
 */
export async function silentReRegisterIfGranted(uid: string): Promise<void> {
  if (!isPushSupported()) return;
  if (Notification.permission !== 'granted') return;

  const messaging = getMessagingInstance();
  if (!messaging) return;

  try {
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string;
    if (!vapidKey || vapidKey === 'YOUR_VAPID_PUBLIC_KEY_HERE') return;

    const swReg = await getFcmServiceWorkerRegistration();
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: swReg });
    if (token) await saveDeviceToFirestore(uid, token, true);
  } catch {
    // Non-fatal — FCM token refresh failure shouldn't crash the app
  }
}

/** Unregister this device — call when user disables push in settings. */
export async function unregisterDevice(uid: string): Promise<void> {
  const messaging = getMessagingInstance();
  if (messaging) {
    try { await deleteToken(messaging); } catch { /* ignore */ }
  }

  const deviceId = getOrCreateDeviceId();
  try {
    await deleteDoc(doc(db, 'users', uid, 'notificationDevices', deviceId));
  } catch { /* ignore */ }

  // Also drop the cached registration handle so a future registerForPush()
  // call re-registers (and re-fetches) the FCM service worker cleanly.
  _fcmSwRegistration = null;
}

/** Write / update the device document in Firestore. */
async function saveDeviceToFirestore(uid: string, token: string, enabled: boolean) {
  const deviceId = getOrCreateDeviceId();
  const ref = doc(db, 'users', uid, 'notificationDevices', deviceId);
  await setDoc(ref, {
    token,
    platform: 'web',
    type: isPWA() ? 'pwa' : 'browser',
    browser: getBrowserName(),
    enabled,
    lastSeenAt: serverTimestamp(),
    // createdAt only set on first write (merge keeps existing value)
  }, { merge: true });

  // Ensure createdAt is set on first write
  await setDoc(ref, { createdAt: serverTimestamp() }, { merge: true });
}

/**
 * Subscribe to foreground messages.
 * When the app is OPEN, FCM does NOT show a native notification automatically —
 * we relay it to the in-app notification store instead.
 *
 * @param onForegroundMessage callback receiving the raw FCM payload
 * @returns unsubscribe function
 */
export function listenForegroundMessages(
  onForegroundMessage: (payload: {
    title: string;
    body: string;
    clickUrl: string;
    data: Record<string, string>;
  }) => void,
): () => void {
  const messaging = getMessagingInstance();
  if (!messaging) return () => {};

  const unsub = onMessage(messaging, (payload) => {
    const title    = payload.notification?.title ?? payload.data?.title ?? 'Fintrackly';
    const body     = payload.notification?.body  ?? payload.data?.body  ?? '';
    const clickUrl = payload.data?.clickUrl ?? '/dashboard';
    onForegroundMessage({ title, body, clickUrl, data: (payload.data ?? {}) as Record<string, string> });
  });

  return unsub;
}