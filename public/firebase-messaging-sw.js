// public/firebase-messaging-sw.js
// Firebase Cloud Messaging Service Worker
// Handles background push notifications when the Fintrackly PWA is closed or backgrounded.
//
// IMPORTANT: This file MUST remain at the root of your domain:
//   https://fintrackly.web.app/firebase-messaging-sw.js
// Firebase FCM SDK will auto-register it unless you explicitly pass a custom SW.

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// ── Firebase config (must match src/services/firebase.ts) ────────────────────
// These are PUBLIC values — safe to include in the service worker.
firebase.initializeApp({
  apiKey:            'AIzaSyD8ncJMsmrDja8L4Q1D8cLM535tgVF-vUk',
  authDomain:        'finance-tracker-3b842.firebaseapp.com',
  projectId:         'finance-tracker-3b842',
  storageBucket:     'finance-tracker-3b842.firebasestorage.app',
  messagingSenderId: '1058955424393',
  appId:             '1:1058955424393:web:cbdf224d3c9c6c29f5cc58',
});

const messaging = firebase.messaging();

// ── Background message handler ────────────────────────────────────────────────
// Called when the app is in the background or closed.
// FCM automatically shows a notification if the payload has a `notification`
// field. We intercept here to customise the notification (icon, badge, click URL).
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Background message received:', payload);

  const { notification, data } = payload;

  const title = notification?.title ?? data?.title ?? 'Fintrackly';
  const body  = notification?.body  ?? data?.body  ?? '';
  const icon  = '/icons/android-chrome-192x192.png';
  const badge = '/icons/favicon-32x32.png';

  // Deep-link: the Cloud Function sets data.clickUrl to a Fintrackly route.
  const clickUrl = data?.clickUrl ?? '/dashboard';

  const options = {
    body,
    icon,
    badge,
    tag:             data?.tag    ?? 'fintrackly-push',
    data:            { clickUrl, ...(data ?? {}) },
    requireInteraction: data?.requireInteraction === 'true',
    // Vibration pattern: short-short-long
    vibrate: [100, 50, 200],
    actions: data?.actionLabel
      ? [{ action: 'open', title: data.actionLabel }]
      : [],
  };

  return self.registration.showNotification(title, options);
});

// ── Notification click handler ────────────────────────────────────────────────
// Opens the correct Fintrackly page when the user taps a notification.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const clickUrl = event.notification.data?.clickUrl ?? '/dashboard';
  const fullUrl  = self.location.origin + clickUrl;

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // If a Fintrackly tab is already open, focus it and navigate.
        for (const client of windowClients) {
          if (client.url.startsWith(self.location.origin) && 'focus' in client) {
            client.focus();
            return client.navigate(fullUrl);
          }
        }
        // Otherwise open a new window/tab.
        if (clients.openWindow) {
          return clients.openWindow(fullUrl);
        }
      }),
  );
});
