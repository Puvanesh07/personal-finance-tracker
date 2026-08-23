// firebase-messaging-sw.js
// Background push handler for Fintrackly PWA (Web Push / FCM v1 HTTP API).
//
// Strategy: FCM sends only a minimal webpush.notification{title,body,icon}.
// ALL custom fields (vibrate, requireInteraction, actions, tag, click url,
// module-specific icon, etc.) arrive as plain-string KV pairs via
// webpush.data.  We reconstruct a complete NotificationOptions object from
// those strings and call self.registration.showNotification() directly —
// this avoids any FCM-side validator mishaps with browser-native fields
// (the classic source of `messaging/invalid-argument`).

importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

const FIREBASE_CONFIG = {
  apiKey:            'AIzaSyA_4v4u1d8aJnKW-DOvS1Hj09nCwh95pAs',
  authDomain:        'fintrackly.firebaseapp.com',
  projectId:         'fintrackly',
  storageBucket:     'fintrackly.appspot.com',
  messagingSenderId: '460591297764',
  appId:             '1:460591297764:web:70e3c15606f2e064439ef1',
  measurementId:     'G-38N2TQ999M',
};

try {
  firebase.initializeApp(FIREBASE_CONFIG);
} catch (_) { /* already initialized in SW scope */ }

let messaging = null;
try {
  messaging = firebase.messaging.isSupported() ? firebase.messaging() : null;
} catch (_) { messaging = null; }

// ── Per-module visual polish (icons, color accent) ───────────────────────────
// These are hints only; FCM already ships the generic app icon as default.
const MODULE_ICONS = {
  welcome:      '/icons/android-chrome-192x192.png',
  payment:      '/icons/android-chrome-192x192.png',
  liability:    '/icons/android-chrome-192x192.png',
  insurance:    '/icons/android-chrome-192x192.png',
  goal:         '/icons/android-chrome-192x192.png',
  investment:   '/icons/android-chrome-192x192.png',
  sip:          '/icons/android-chrome-192x192.png',
  agriculture:  '/icons/android-chrome-192x192.png',
  reminder:     '/icons/android-chrome-192x192.png',
  subscription: '/icons/android-chrome-192x192.png',
  default:      '/icons/android-chrome-192x192.png',
};

function pickIcon(notifType) {
  if (!notifType) return MODULE_ICONS.default;
  const k = String(notifType).toLowerCase();
  for (const prefix of Object.keys(MODULE_ICONS)) {
    if (k.startsWith(prefix)) return MODULE_ICONS[prefix];
  }
  return MODULE_ICONS.default;
}

function parseIntList(s, fallback) {
  if (!s) return fallback;
  try {
    const arr = String(s).split(',').map(x => parseInt(x.trim(), 10)).filter(n => Number.isFinite(n));
    return arr.length ? arr : fallback;
  } catch (_) { return fallback; }
}

function parseBool(s) {
  return s === '1' || s === 'true' || s === true;
}

function parseTimestamp(s) {
  if (!s) return Date.now();
  const n = parseInt(String(s), 10);
  return Number.isFinite(n) && n > 0 ? n : Date.now();
}

// ── Foreground tab tracker (avoids double-banner via setBackgroundMessageHandler) ─
let hasVisibleClient = false;
async function checkVisibleClients() {
  try {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    hasVisibleClient = all.some(c => c.visibilityState === 'visible' || c.focused);
  } catch (_) { hasVisibleClient = false; }
  return hasVisibleClient;
}
self.addEventListener('activate', () => checkVisibleClients());
self.addEventListener('focus',    () => checkVisibleClients());
self.addEventListener('message',  (e) => {
  if (e.data && typeof e.data === 'object' && e.data.type === 'visibility-change') {
    hasVisibleClient = !!e.data.visible;
  }
});

// ── onBackgroundMessage (actual banner rendering) ────────────────────────────
if (messaging) {
  messaging.onBackgroundMessage((payload) => {
    // Prefer explicit data payload; fall back to FCM's merged object.
    const data = (payload && payload.data) ? payload.data : {};
    const notif = (payload && payload.notification) ? payload.notification : {};

    const title         = data.title         || notif.title         || 'Fintrackly';
    const body          = data.body          || notif.body          || '';
    const tag           = data.tag           || data.notifType      || 'fintrackly';
    const icon          = data.icon          || pickIcon(data.notifType);
    const badge         = data.badge         || '/icons/favicon-32x32.png';
    const image         = data.image         || '';
    const vibrate       = parseIntList(data.vibrate, [100, 50, 200]);
    const requireInter  = parseBool(data.requireInteraction);
    const renotify      = parseBool(data.renotify);
    const silent        = parseBool(data.silent);
    const timestamp     = parseTimestamp(data.timestamp);
    const actionLabel   = data.actionLabel   || '';
    const notifType     = data.notifType     || '';

    const options = {
      body,
      icon,
      badge,
      tag,
      requireInteraction: requireInter,
      renotify,
      silent,
      vibrate,
      timestamp,
      data: {
        clickUrl:    data.clickUrl    || '/dashboard',
        notifType:   notifType,
        severity:    data.severity    || 'medium',
        entityId:    data.entityId    || '',
        actionLabel,
        tag,
        title,
        body,
      },
    };
    if (image) options.image = image;
    if (actionLabel) {
      options.actions = [{
        action: 'open',
        title:  actionLabel,
        icon:   '/icons/favicon-32x32.png',
      }];
    }

    return self.registration.showNotification(title, options);
  });
}

// ── Default push (non-FCM or messaging unsupported) ──────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload = null;
  try { payload = event.data.json(); } catch (_) {
    const plain = event.data.text();
    payload = { notification: { title: 'Fintrackly', body: plain }, data: {} };
  }
  // FCM's onBackgroundMessage already handled this when messaging is active.
  // Run our own showNotification only if FCM didn't fire a visible notification
  // (we detect this by payload.notification absence — if present, the block
  // above has already rendered it via showNotification.)
  if (messaging && payload && (payload.data || payload.notification)) return;

  const data = (payload && payload.data) ? payload.data : {};
  const notif = (payload && payload.notification) ? payload.notification : {};
  const title   = data.title   || notif.title   || 'Fintrackly';
  const body    = data.body    || notif.body    || '';
  const tag     = data.tag     || data.notifType || 'fintrackly';
  const options = {
    body,
    tag,
    icon:  '/icons/android-chrome-192x192.png',
    badge: '/icons/favicon-32x32.png',
    data:  { clickUrl: data.clickUrl || '/dashboard', tag, title, body },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification click / action tap ──────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data   = (event.notification && event.notification.data) || {};
  const url    = data.clickUrl || '/dashboard';
  const target = new URL(url, self.location.origin).toString();

  event.waitUntil((async () => {
    try {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const c of all) {
        if ('url' in c) {
          try {
            const existing = new URL(c.url);
            const want     = new URL(target);
            if (existing.origin === want.origin) {
              await c.focus();
              try {
                c.postMessage({ type: 'navigate', url: want.pathname + want.search + want.hash, data });
              } catch (_) { /* noop */ }
              return;
            }
          } catch (_) { /* skip */ }
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(target);
      }
    } catch (_) {
      if (self.clients.openWindow) await self.clients.openWindow(target);
    }
  })());
});

self.addEventListener('notificationclose', () => { /* noop */ });
