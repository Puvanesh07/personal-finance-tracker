/**
 * functions/src/pushNotifications.ts
 *
 * Cloud Function: processScheduledNotifications
 * Runs every 30 minutes via Cloud Scheduler.
 * For every user who has at least one enabled notification device, it:
 *   1. Reads their notificationSettings/config from Firestore.
 *   2. Checks quiet hours — skips if currently in quiet window.
 *   3. Reads their data collections (trackedPayments, insurancePolicies,
 *      goals, liabilities, sipPlans, subscriptions).
 *   4. Evaluates rules identical to the client-side notificationRulesEngine.
 *   5. Sends FCM push via Firebase Admin SDK (v1 HTTP API).
 *   6. Writes a sent-record to users/{uid}/pushSent/{key} to prevent resending.
 *
 * Firestore paths read:
 *   users/{uid}                             — subscription status, trialEnd
 *   users/{uid}/notificationDevices/*       — FCM tokens
 *   users/{uid}/notificationSettings/config — per-category toggles + quiet hours
 *   users/{uid}/trackedPayments/*
 *   users/{uid}/insurancePolicies/*
 *   users/{uid}/goals/*
 *   users/{uid}/liabilities/*
 *   users/{uid}/lendingBorrowers/*
 *   users/{uid}/sipPlans/*
 *
 * Firestore paths written:
 *   users/{uid}/pushSent/{key}              — dedup record (expires after 7d)
 *   users/{uid}/notificationDevices/{id}    — failCount/failDates/lastSuccessAt
 *                                              bookkeeping (see STALE TOKEN
 *                                              HANDLING below); device docs
 *                                              are deleted only once they
 *                                              cross the multi-day threshold.
 *
 * ── STALE TOKEN HANDLING ─────────────────────────────────────────────────────
 * A push token can come back as "not-registered"/"invalid-registration-token"
 * for two very different reasons:
 *   (a) It's genuinely dead — the browser/OS unsubscribed it, the app was
 *       uninstalled, etc. This is a real, persistent condition.
 *   (b) It's a BRAND NEW token that hasn't finished propagating through
 *       Apple's/Google's push infrastructure yet, and/or it's being hit by
 *       several concurrent sends at once (this file runs 7 rule categories
 *       in parallel per user, and if more than one of them matches, they'd
 *       previously all call messaging.send() to the same token at nearly
 *       the same millisecond) — this is transient and resolves itself.
 *
 * Naively deleting the device doc on the FIRST failure conflates these two
 * cases and risks wiping out a perfectly good, just-registered token,
 * silently breaking notifications for that user until they reinstall.
 *
 * This file instead:
 *   1. Serializes sends to the same token within a single invocation
 *      (withTokenLock) with a small stagger, instead of firing them all
 *      simultaneously.
 *   2. Retries once after a short delay on that specific error class
 *      (sendWithRetry) before treating it as a failure at all.
 *   3. If it still fails, records a "strike" against the device doc for
 *      TODAY's date only (recordDeviceFailure) — multiple failures on the
 *      same calendar day only count once, so one noisy burst can't itself
 *      cross the threshold.
 *   4. Only deletes the device doc once it has struck out on
 *      STALE_FAIL_THRESHOLD separate calendar days.
 *   5. Any successful send on that token resets its strike count to 0
 *      (recordDeviceSuccess) — so a token that had one bad day and then
 *      works fine isn't slowly marched toward deletion.
 *
 * NOTE ON ENCRYPTION:
 * trackedPayments / insurancePolicies / goals / liabilities / sipPlans /
 * lendingBorrowers documents are encrypted client-side before being written
 * to Firestore (see src/services/encryptionService.ts). fetchCol() below
 * decrypts each document (see ./serverEncryption.ts) before the rule
 * checks run — without that step every field (dueDate, renewalDate, ...)
 * reads as `undefined`, which is what caused the
 * "daysUntilDue=NaN ... no push queued" results. If decryption itself
 * fails for every doc (e.g. functions/.env's ENCRYPTION_SALT doesn't match
 * the web app's VITE_ENCRYPTION_SALT), fetchCol() now pushes an ERROR line
 * into the results array instead of silently returning an empty list —
 * previously that looked identical to "you have no data" ("none found").
 *
 * NOTE ON COVERAGE — what is and isn't implemented here:
 *   ✅ Payments (checkPayments), Insurance (checkInsurance), Goals
 *      (checkGoals), Liabilities/EMI (checkLiabilities), SIP (checkSIP),
 *      Lending (checkLending), Investment Maturity (checkInvestments),
 *      Pending Payments / Receivables (checkPendingPayments),
 *      Subscription/trial (checkSubscription) all have real rule logic
 *      AND are wired into both the 30-min scheduler AND the on-demand
 *      testPushNotifications callable below.
 *   ❌ Agriculture reminders and Attendance reminders have toggles in
 *      src/components/notifications/NotificationSettings.tsx
 *      (agricultureReminders, attendanceReminders) and in
 *      NotifSettings below, but there is NO rule logic anywhere in this
 *      file for either — no checkAgriculture(), no checkAttendance(). No
 *      agri or attendance push notification has ever been sent by this
 *      function; the toggles currently do nothing. Same for weeklyDigest
 *      and monthlyReport (client-side toggles, no server implementation).
 *      Building these requires deciding what should actually trigger a
 *      reminder for each (e.g. an agri crop-cycle harvest date, a
 *      livestock event, an unmarked attendance day) before rules can be
 *      written — that's a feature-build task, not a bug fix.
 */

import * as logger from 'firebase-functions/logger';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getMessaging } from 'firebase-admin/messaging';
import { Timestamp } from 'firebase-admin/firestore';
import { getDb } from './subscriptionUtils';
import { decryptDoc, type FirestoreDoc } from './serverEncryption';

const region = 'asia-south1';

// ── Types ─────────────────────────────────────────────────────────────────────

interface NotifDevice {
  id:       string;   // Firestore doc id under notificationDevices — needed
                       // so sendToUser can record strikes / delete the doc.
  token:    string;
  enabled:  boolean;
  platform: string;
}

interface NotifSettings {
  pushEnabled:          boolean;
  paymentReminders:     boolean;
  insuranceReminders:   boolean;
  goalReminders:        boolean;
  emiReminders:         boolean;
  lendingReminders:     boolean;
  sipReminders:         boolean;
  subscriptionAlerts:   boolean;
  investmentAlerts:     boolean;
  quietHoursEnabled:    boolean;
  quietHoursStart:      string;
  quietHoursEnd:        string;
}

interface PushMessage {
  key:        string;         // dedup key stored in pushSent
  title:      string;
  body:       string;
  clickUrl:   string;
  notifType:  string;
  severity:   string;
  entityId:   string;
  actionLabel?: string;
  tag?:       string;         // notification tag for grouping
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysDiff(dateStr: string): number {
  const target = new Date(dateStr);
  const today  = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function fmt(n: number): string {
  return '₹' + Math.abs(Math.round(n || 0)).toLocaleString('en-IN');
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Returns true if the current time (IST) is within the quiet window.
 * Handles overnight windows like 22:00 → 07:00.
 */
function isQuietHour(settings: NotifSettings): boolean {
  if (!settings.quietHoursEnabled) return false;
  // Convert current UTC to IST (UTC+5:30)
  const now = new Date();
  const istOffset = 5 * 60 + 30; // minutes
  const istMs = now.getTime() + istOffset * 60_000;
  const ist = new Date(istMs);
  const hhmm = `${String(ist.getUTCHours()).padStart(2, '0')}:${String(ist.getUTCMinutes()).padStart(2, '0')}`;

  const start = settings.quietHoursStart ?? '22:00';
  const end   = settings.quietHoursEnd   ?? '07:00';

  if (start <= end) {
    // Same-day window, e.g. 01:00 → 06:00
    return hhmm >= start && hhmm < end;
  } else {
    // Overnight window, e.g. 22:00 → 07:00
    return hhmm >= start || hhmm < end;
  }
}

/** Check Firestore pushSent dedup record. Returns true if NOT blocked. */
async function shouldSend(uid: string, key: string, force?: boolean): Promise<boolean> {
  if (force) return true; // testing mode — ignore dedup entirely
  const db = getDb();
  const ref = db.collection('users').doc(uid).collection('pushSent').doc(key);
  const snap = await ref.get();
  if (!snap.exists) return true;
  const data = snap.data()!;
  const status: string = data.status ?? 'sent';

  // failed records: shorter cooldown of 24h (allow retry sooner for transient errors)
  if (status === 'failed') {
    const failedAt: Timestamp = data.failedAt ?? data.sentAt;
    const ageMs = Date.now() - failedAt.toMillis();
    return ageMs > 1 * 86_400_000;
  }

  // success records: standard 7-day expiry (weekly/monthly keys auto-reset)
  const sentAt: Timestamp = data.sentAt;
  const ageMs = Date.now() - sentAt.toMillis();
  return ageMs > 7 * 86_400_000;
}

async function markSent(uid: string, key: string, status: 'sent' | 'failed' = 'sent'): Promise<void> {
  const db = getDb();
  const now = Timestamp.now();
  const record: Record<string, unknown> = {
    key,
    status,
    updatedAt: now,
  };
  if (status === 'sent') {
    record.sentAt = now;
  } else {
    record.failedAt = now;
  }
  await db
    .collection('users').doc(uid)
    .collection('pushSent').doc(key)
    .set(record, { merge: true });
}

// ── Stale-token bookkeeping ─────────────────────────────────────────────────

const STALE_FAIL_THRESHOLD = 3; // must fail on this many SEPARATE calendar days

/** Reset a device's strike count after a successful send. */
async function recordDeviceSuccess(uid: string, deviceDocId: string): Promise<void> {
  const db = getDb();
  await db
    .collection('users').doc(uid)
    .collection('notificationDevices').doc(deviceDocId)
    .set({ failCount: 0, failDates: [], lastSuccessAt: Timestamp.now() }, { merge: true });
}

/**
 * Records a failed send against a device doc for TODAY's date only (repeat
 * failures on the same day only count once, so a single noisy burst of
 * concurrent sends can't itself cross the threshold). Returns true if the
 * device has now failed on STALE_FAIL_THRESHOLD or more separate days and
 * should be deleted.
 */
async function recordDeviceFailure(uid: string, deviceDocId: string): Promise<boolean> {
  const db = getDb();
  const ref = db
    .collection('users').doc(uid)
    .collection('notificationDevices').doc(deviceDocId);

  const snap = await ref.get();
  if (!snap.exists) return false; // already gone, nothing to do

  const data = snap.data()!;
  const prevFailDates: string[] = Array.isArray(data.failDates) ? data.failDates : [];
  const today = todayStr();

  const failDates = prevFailDates.includes(today)
    ? prevFailDates
    : [...prevFailDates, today].slice(-10); // keep at most the last 10 fail-days

  await ref.set(
    { failCount: failDates.length, failDates, lastFailedAt: Timestamp.now() },
    { merge: true },
  );

  return failDates.length >= STALE_FAIL_THRESHOLD;
}

// ── Per-token send serialization ────────────────────────────────────────────
// All 7 rule categories run in parallel per user (see Promise.all below), so
// if more than one matches, they'd otherwise all call messaging.send() to the
// SAME token within the same millisecond. Queuing sends to a given token and
// staggering them slightly avoids hammering a single (possibly still-
// propagating) token with a burst of simultaneous requests.

const _tokenSendQueue = new Map<string, Promise<unknown>>();

function withTokenLock<T>(token: string, fn: () => Promise<T>): Promise<T> {
  const prev = _tokenSendQueue.get(token) ?? Promise.resolve();
  const next = prev.catch(() => undefined).then(async () => {
    const result = await fn();
    await sleep(150); // small stagger before the next queued send on this token
    return result;
  });
  _tokenSendQueue.set(token, next);
  return next;
}

type SendOutcome = 'sent' | 'stale' | 'error';

/**
 * Sends one FCM message to one token. On "not-registered" /
 * "invalid-registration-token", waits briefly and retries ONCE before
 * concluding the token is actually stale — a just-created subscription can
 * bounce with this exact error while it's still propagating.
 */
async function sendWithRetry(
  token: string,
  payload: Parameters<ReturnType<typeof getMessaging>['send']>[0],
): Promise<{ outcome: SendOutcome; errCode?: string }> {
  const messaging = getMessaging();

  const attempt = async (): Promise<{ outcome: SendOutcome; errCode?: string }> => {
    try {
      await messaging.send(payload);
      return { outcome: 'sent' };
    } catch (err: any) {
      const code = err?.errorInfo?.code ?? err?.code;
      return { outcome: 'error', errCode: code };
    }
  };

  const isStaleCode = (code?: string) =>
    code === 'messaging/registration-token-not-registered' ||
    code === 'messaging/invalid-registration-token';

  const first = await attempt();
  if (first.outcome === 'sent') return first;
  if (!isStaleCode(first.errCode)) return first; // real error, don't retry

  // Possibly just propagation lag — wait and try exactly once more.
  await sleep(1_500);
  const second = await attempt();
  if (second.outcome === 'sent') return second;
  if (isStaleCode(second.errCode)) return { outcome: 'stale', errCode: second.errCode };
  return second;
}

/** Send an FCM message to all enabled devices for a user. */
async function sendToUser(
  uid: string,
  devices: NotifDevice[],
  msg: PushMessage,
  opts?: { force?: boolean; results?: string[] },
): Promise<void> {
  const enabled = devices.filter((d) => d.enabled && d.token);
  if (!enabled.length) {
    const line = `uid=${uid} key=${msg.key} — no enabled devices with a token, skipping.`;
    logger.info(`[pushNotif] ${line}`);
    opts?.results?.push(`SKIPPED (no devices): ${line}`);
    return;
  }

  // Check dedup
  const ok = await shouldSend(uid, msg.key, opts?.force);
  if (!ok) {
    const line = `uid=${uid} key=${msg.key} — already sent within the last 7 days (dedup), skipping.`;
    logger.info(`[pushNotif] ${line}`);
    opts?.results?.push(`SKIPPED (dedup — already sent): ${line}`);
    return;
  }

  const severityToPriority: Record<string, 'normal' | 'high'> = {
    info:    'normal',
    low:     'normal',
    medium:  'normal',
    high:    'high',
    critical: 'high',
  };
  const priority = severityToPriority[msg.severity ?? 'medium'];
  const tagVal = msg.tag ?? msg.notifType;

  // ── Minimal 100 % FCM-v1-compliant webpush payload ─────────────────────────
  // Only title / body / icon live inside webpush.notification (fields that
  // every spec version supports).  All behavioural flags and custom values
  // are shipped as plain strings via webpush.data, and the service worker
  // reconstructs the full NotificationOptions at display time.
  // This completely avoids `messaging/invalid-argument` from FCM's strict
  // reinterpretation of browser-native notification fields.
  const payloadFor = (device: NotifDevice) => ({
    token: device.token,
    notification: { title: msg.title, body: msg.body },
    webpush: {
      notification: {
        title: msg.title,
        body:  msg.body,
        icon:  '/icons/android-chrome-192x192.png',
      },
      data: {
        title:            msg.title,
        body:             msg.body,
        clickUrl:         msg.clickUrl,
        notifType:        msg.notifType,
        severity:         msg.severity,
        entityId:         msg.entityId,
        actionLabel:      msg.actionLabel ?? '',
        tag:              tagVal,
        requireInteraction: msg.severity === 'critical' ? '1' : '0',
        renotify:         '1',
        silent:           '0',
        vibrate:          '100,50,200',
        timestamp:        String(Date.now()),
        icon:             '/icons/android-chrome-192x192.png',
        badge:            '/icons/favicon-32x32.png',
        image:            '/icons/apple-touch-icon.png',
      },
      fcmOptions: {
        link: `https://fintrackly.web.app${msg.clickUrl}`,
        analyticsLabel: msg.notifType,
      },
      headers: {
        Urgency: priority === 'high' ? 'high' : 'normal',
      },
    },
    // iOS Safari PWA Web Push & APNs
    // Without this explicit block, FCM *translates* the generic
    // notification{} → APNs but only intermittently for Web Push tokens
    // registered via Safari iOS 16.4+ (PWA Add to Home Screen). The symptom
    // is exactly what the user sees: admin.messaging().send() returns HTTP
    // 200 + tokens count "SENT (2/2)", but iPhone Notification Center shows
    // only 0–1 of the dozen scheduled banner alerts.
    apns: {
      headers: {
        'apns-priority': priority === 'high' ? '10' : '5',
        'apns-push-type': 'alert',
        'apns-topic': 'app.fintrackly.web.push',
      },
      payload: {
        aps: {
          alert: {
            title: msg.title,
            subtitle: 'from Fintrackly',
            body: msg.body,
            ...(msg.actionLabel ? { 'action-loc-key': msg.actionLabel } : {}),
          },
          sound: msg.severity === 'critical'
            ? { critical: true, name: 'default', volume: 1.0 }
            : 'default',
          badge: 1,
          'thread-id': msg.tag ?? msg.notifType,
          'content-available': 1,
          'mutable-content': 1,
          category: msg.actionLabel ? 'FINTrackly_CATEGORY_ACTION' : 'FINTrackly_CATEGORY_DEFAULT',
        },
        clickUrl:   msg.clickUrl,
        notifType:  msg.notifType,
        severity:   msg.severity,
        entityId:   msg.entityId,
        actionLabel: msg.actionLabel ?? '',
        tag:        msg.tag ?? msg.notifType,
      },
      fcmOptions: {
        imageUrl: 'https://fintrackly.web.app/icons/apple-touch-icon.png',
      },
    },
    // Android PWA via Chrome / Android Web Layer via TWA / Play Services
    // FCM auto-routes Chrome Android Push tokens through Play Services; the
    // block below guarantees: (1) a notification channel per-severity so the
    // user can turn high/critical back on if they got muted; (2) heads-up
    // pop-up on high priority instead of silent status bar only.
    android: {
      priority,
      ttl: priority === 'high' ? 2 * 60 * 60 : 24 * 60 * 60, // 2h high vs 24h normal
      notification: {
        title: msg.title,
        body: msg.body,
        icon: 'drawable/ic_stat_name',
        color: '#0F766E', // teal-700 — matches Fintrackly brand
        sound: 'default',
        defaultSound: true,
        defaultVibrateTimings: true,
        defaultLightSettings: true,
        sticky: false,
        eventTimestamp: new Date(),
        clickAction: 'FLUTTER_NOTIFICATION_CLICK',
        channelId:
          msg.severity === 'critical' ? 'fintrackly_critical'
          : msg.severity === 'high'  ? 'fintrackly_high'
          : 'fintrackly_default',
        tag: msg.tag ?? msg.notifType,
        imageUrl: 'https://fintrackly.web.app/icons/android-chrome-192x192.png',
        ...(msg.actionLabel ? {
          actions: [
            { title: msg.actionLabel, action: 'open', icon: 'drawable/ic_stat_name' },
          ],
        } : {}),
      },
      data: {
        clickUrl:   msg.clickUrl,
        notifType:  msg.notifType,
        severity:   msg.severity,
        entityId:   msg.entityId,
        actionLabel: msg.actionLabel ?? '',
        tag:        msg.tag ?? msg.notifType,
      },
    },
  });

  let sentCount = 0;

  const sends = enabled.map((device) =>
    // Serialize + stagger sends that share the same token, instead of firing
    // every category's send to this token at the same instant.
    withTokenLock(device.token, async () => {
      const { outcome, errCode } = await sendWithRetry(device.token, payloadFor(device));

      if (outcome === 'sent') {
        sentCount++;
        await recordDeviceSuccess(uid, device.id);
        return;
      }

      if (outcome === 'stale') {
        const shouldDelete = await recordDeviceFailure(uid, device.id);
        if (shouldDelete) {
          const db = getDb();
          await db
            .collection('users').doc(uid)
            .collection('notificationDevices').doc(device.id)
            .delete();
          const line = `Token for uid=${uid} device=${device.id} failed on ${STALE_FAIL_THRESHOLD}+ separate days — removed.`;
          logger.warn(`[pushNotif] ${line}`);
          opts?.results?.push(`CLEANED (stale token removed): ${line}`);
        } else {
          const line = `uid=${uid} device=${device.id} — token bounced as not-registered (recorded as a strike for today; not yet removed, may just be propagation lag on a new token).`;
          logger.warn(`[pushNotif] ${line}`);
          opts?.results?.push(`ERROR (stale token, strike recorded): ${line}`);
        }
        return;
      }

      // outcome === 'error': a real send failure unrelated to token validity
      const line = `Send error uid=${uid} device=${device.id}: ${errCode ?? 'unknown'}`;
      logger.error(`[pushNotif] ${line}`);
      opts?.results?.push(`ERROR (FCM send failed): ${line}`);
    }),
  );

  await Promise.all(sends);

  if (sentCount > 0) {
    await markSent(uid, msg.key, 'sent');
    const sentLine = `Sent "${msg.title}" → uid=${uid} (${sentCount}/${enabled.length} device(s))`;
    logger.info(`[pushNotif] ${sentLine}`);
    opts?.results?.push(`SENT: ${sentLine}`);
  } else {
    await markSent(uid, msg.key, 'failed');
    const line = `uid=${uid} key=${msg.key} — all ${enabled.length} device send attempt(s) failed. Written status='failed' to pushSent (24h cooldown before next retry).`;
    logger.warn(`[pushNotif] ${line}`);
    opts?.results?.push(`FAILED (no device succeeded): ${line}`);
  }
}

// ── Rule evaluators ───────────────────────────────────────────────────────────

/**
 * Fetch every document in a subcollection AND decrypt it.
 *
 * Documents are written by the client via encryptDoc() (see
 * src/services/encryptionService.ts) and are encrypted by default, so the
 * raw Admin SDK data only has { _encrypted, _iv, _data, id, ... } — none of
 * the real fields. Without this decryption step, every field the caller
 * reads (dueDate, renewalDate, amount, title, ...) is `undefined`, which is
 * exactly what produced the `daysUntilDue=NaN` / "NO MATCH" results.
 *
 * Each document is decrypted independently so one corrupted/undecryptable
 * doc (e.g. written under a different salt) doesn't stop the rest of the
 * user's payments/policies from being evaluated.
 *
 * IMPORTANT: decryption failures are pushed into `opts.results` (not just
 * logged) — if ALL documents in a collection fail to decrypt, the caller
 * ends up with an empty list and reports "0 found", which looks identical
 * to "you have no data" unless the underlying decrypt errors are visible.
 * Pass `opts` (the same one threaded through from testPushNotifications)
 * so a salt mismatch shows up directly in the on-screen test results.
 */
async function fetchCol<T>(
  uid: string,
  col: string,
  opts?: { results?: string[] },
): Promise<T[]> {
  const db = getDb();
  const snap = await db.collection('users').doc(uid).collection(col).get();

  const out: T[] = [];
  let failed = 0;
  for (const d of snap.docs) {
    try {
      const decrypted = await decryptDoc<Record<string, unknown>>(uid, d.data() as FirestoreDoc);
      out.push({ id: d.id, ...decrypted } as T);
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`[pushNotif] uid=${uid} col=${col} doc=${d.id} — decryption failed, skipping this doc: ${msg}`);
      opts?.results?.push(`ERROR (decrypt failed — ${col}): uid=${uid} doc=${d.id} — ${msg}`);
    }
  }

  if (opts?.results) {
    opts.results.push(
      `INFO (${col}): uid=${uid} — found ${snap.size} doc(s), decrypted ${out.length}, failed ${failed}.`,
    );
  }

  return out;
}

// 1. Tracked Payments
async function checkPayments(
  uid: string,
  devices: NotifDevice[],
  settings: NotifSettings,
  opts?: { force?: boolean; results?: string[] },
): Promise<void> {
  if (!settings.paymentReminders) {
    logger.info(`[pushNotif] uid=${uid} — paymentReminders is OFF in notificationSettings, skipping all payment checks.`);
    return;
  }
  const payments = await fetchCol<any>(uid, 'trackedPayments', opts);
  logger.info(`[pushNotif] uid=${uid} — evaluating ${payments.length} tracked payment(s).`);

  for (const p of payments) {
    if (p.status === 'paid') {
      logger.info(`[pushNotif] uid=${uid} payment=${p.id} — status is 'paid', skipping.`);
      continue;
    }
    const days = daysDiff(p.dueDate);
    const reminderDays: number[] = p.reminderDays ?? [1, 3, 7];
    logger.info(`[pushNotif] uid=${uid} payment=${p.id} title="${p.title}" dueDate=${p.dueDate} daysUntilDue=${days} reminderDays=[${reminderDays.join(',')}]`);

    let fireKey = '';
    let title   = '';
    let body    = '';
    let severity = 'medium';

    if (days === 0) {
      fireKey = `payment_due_today:${p.id}:${todayStr()}`;
      title   = `🔔 Payment Due Today`;
      body    = `${p.title} — ${fmt(p.amount)} is due today (${p.dueDate}). Don't forget to pay!`;
      severity = 'high';
    } else if (days > 0 && reminderDays.includes(days)) {
      fireKey = `payment_due_${days}d:${p.id}:${todayStr()}`;
      title   = `💳 Payment Due in ${days} Day${days > 1 ? 's' : ''}`;
      body    = `"${p.title}" — ${fmt(p.amount)} is due on ${p.dueDate} (${days} day${days > 1 ? 's' : ''} left).`;
      severity = days <= 1 ? 'high' : 'medium';
    } else if (days < 0 && [-1, -3, -6, -9, -12].includes(days)) {
      const absDays = Math.abs(days);
      fireKey = `payment_overdue_${absDays}d:${p.id}:${todayStr()}`;
      title   = absDays >= 6 ? `🚨 Payment OVERDUE ${absDays}d` : `⚠️ Payment Overdue`;
      body    = `${p.title} — ${fmt(p.amount)} was due ${absDays} day${absDays > 1 ? 's' : ''} ago on ${p.dueDate}. Pay immediately to avoid penalties.`;
      severity = absDays >= 6 ? 'critical' : 'high';
    }

    if (!fireKey) {
      const line = `uid=${uid} payment=${p.id} — daysUntilDue=${days} matches no reminder rule, no push queued.`;
      logger.info(`[pushNotif] ${line}`);
      opts?.results?.push(`NO MATCH (payment): ${line}`);
      continue;
    }
    await sendToUser(uid, devices, {
      key:        fireKey,
      title,
      body,
      clickUrl:   '/payments',
      notifType:  days < 0 ? 'payment_tracker_overdue' : 'payment_tracker_due',
      severity,
      entityId:   p.id,
      actionLabel: 'View Payments',
      tag:        `payment_${p.id}`,
    }, opts);
  }
}

// 2. Insurance Renewals
async function checkInsurance(
  uid: string,
  devices: NotifDevice[],
  settings: NotifSettings,
  opts?: { force?: boolean; results?: string[] },
): Promise<void> {
  if (!settings.insuranceReminders) {
    logger.info(`[pushNotif] uid=${uid} — insuranceReminders is OFF in notificationSettings, skipping all insurance checks.`);
    return;
  }
  const policies = await fetchCol<any>(uid, 'insurancePolicies', opts);
  logger.info(`[pushNotif] uid=${uid} — evaluating ${policies.length} insurance polic${policies.length === 1 ? 'y' : 'ies'}.`);

  for (const pol of policies) {
    if (!pol.renewalDate) {
      logger.info(`[pushNotif] uid=${uid} policy=${pol.id} — no renewalDate set, skipping.`);
      continue;
    }
    const days = daysDiff(pol.renewalDate);
    const triggerDays = [30, 15, 7, 3, 1, 0];

    // If policy is marked 'expired' in the DB but renewal isn't recent enough
    // for an expired push (i.e. more than 3 days past renewal), skip it —
    // otherwise we'd re-fire an "expired" push every 30 minutes forever.
    // But if it just expired within the last 3 days (days in [-3, -1]),
    // DON'T skip — we still want to send the "Insurance Expired" push even
    // though the client UI may have already flipped status to 'expired'.
    if (pol.status === 'expired' && !(days < 0 && days >= -3)) {
      logger.info(`[pushNotif] uid=${uid} policy=${pol.id} — status='expired' and renewal not within the last 3 days (days=${days}), skipping.`);
      opts?.results?.push(`SKIPPED (insurance): uid=${uid} policy=${pol.id} — status expired and ${Math.abs(days)}d past renewal (only -1/-2/-3d fire).`);
      continue;
    }
    logger.info(`[pushNotif] uid=${uid} policy=${pol.id} name="${pol.policyName}" renewalDate=${pol.renewalDate} daysUntilRenewal=${days} triggerDays=[${triggerDays.join(',')}] status=${pol.status ?? 'n/a'}`);

    if (!triggerDays.includes(days) && !(days < 0 && days >= -3)) {
      const line = `uid=${uid} policy=${pol.id} — daysUntilRenewal=${days} matches no trigger day (renewal reminders at 30/15/7/3/1/0d; expired reminders only for -1/-2/-3d). No push queued.`;
      logger.info(`[pushNotif] ${line}`);
      opts?.results?.push(`NO MATCH (insurance): ${line}`);
      continue;
    }

    let title = '';
    let body  = '';
    let severity = 'medium';
    let fireKey  = '';

    if (days < 0) {
      const absDays = Math.abs(days);
      fireKey  = `insurance_expired:${pol.id}:${todayStr()}`;
      title    = `🚨 Insurance Expired`;
      body     = `${pol.policyName}${pol.provider ? ` (${pol.provider})` : ''} expired ${absDays} day${absDays === 1 ? '' : 's'} ago on ${pol.renewalDate}. Coverage: ${fmt(pol.coverageAmount ?? 0)}. Renew immediately!`;
      severity = 'critical';
    } else if (days === 0) {
      fireKey  = `insurance_due_today:${pol.id}:${todayStr()}`;
      title    = `🛡️ Insurance Renews Today`;
      body     = `${pol.policyName}${pol.provider ? ` (${pol.provider})` : ''} expires TODAY. Premium ${fmt(pol.premiumAmount ?? 0)}. Coverage ${fmt(pol.coverageAmount ?? 0)}.`;
      severity = 'high';
    } else if (days === 1) {
      fireKey  = `insurance_due_${days}d:${pol.id}:${todayStr()}`;
      title    = `⏰ Renewal Tomorrow: ${pol.policyName}`;
      body     = `${pol.policyName} — premium ${fmt(pol.premiumAmount ?? 0)} due tomorrow.`;
      severity = 'high';
    } else if (days === 7) {
      fireKey  = `insurance_due_${days}d:${pol.id}:${todayStr()}`;
      title    = `🛡️ Insurance Due in 7 Days`;
      body     = `${pol.policyName}${pol.provider ? ` (${pol.provider})` : ''} — ${fmt(pol.coverageAmount ?? 0)} coverage renews in 7 days. Plan for premium ${fmt(pol.premiumAmount ?? 0)}.`;
      severity = 'medium';
    } else if (days === 30) {
      fireKey  = `insurance_due_${days}d:${pol.id}:${todayStr()}`;
      title    = `🛡️ Insurance Renewal Upcoming (30d)`;
      body     = `${pol.policyName}${pol.provider ? ` (${pol.provider})` : ''} renews in 30 days. Expected premium: ${fmt(pol.premiumAmount ?? 0)}.`;
      severity = 'low';
    } else {
      // 15d or 3d catches
      fireKey  = `insurance_due_${days}d:${pol.id}:${todayStr()}`;
      title    = `🛡️ Insurance Renewal in ${days} Day${days > 1 ? 's' : ''}`;
      body     = `${pol.policyName}${pol.provider ? ` (${pol.provider})` : ''} — premium ${fmt(pol.premiumAmount ?? 0)} due in ${days} days.`;
      severity = days <= 3 ? 'critical' : days <= 7 ? 'high' : 'medium';
    }

    await sendToUser(uid, devices, {
      key:        fireKey,
      title,
      body,
      clickUrl:   '/insurance',
      notifType:  days < 0 ? 'insurance_expired' : 'insurance_renewal',
      severity,
      entityId:   pol.id,
      actionLabel: 'View Insurance',
      tag:        `insurance_${pol.id}`,
    }, opts);
  }
}

// 3. Goals
async function checkGoals(
  uid: string,
  devices: NotifDevice[],
  settings: NotifSettings,
  opts?: { force?: boolean; results?: string[] },
): Promise<void> {
  if (!settings.goalReminders) return;
  const goals = await fetchCol<any>(uid, 'goals', opts);

  for (const g of goals) {
    if (g.status === 'completed') continue;
    const pct = g.targetAmount > 0
      ? Math.round((g.currentAmount / g.targetAmount) * 100)
      : 0;

    let fired = false;

    // Goal achieved
    if (pct >= 100) {
      fired = true;
      await sendToUser(uid, devices, {
        key:        `goal_achieved:${g.id}:once`,
        title:      `🎯 Goal Achieved!`,
        body:       `Congratulations! You've reached your "${g.name}" goal of ${fmt(g.targetAmount)}.`,
        clickUrl:   '/goals',
        notifType:  'goal_achieved',
        severity:   'info',
        entityId:   g.id,
        actionLabel: 'View Goals',
        tag:        `goal_${g.id}`,
      }, opts);
    }

    // Deadline approaching
    if (g.dueDate) {
      const days = daysDiff(g.dueDate);
      if (days === 7 && pct < 100) {
        fired = true;
        await sendToUser(uid, devices, {
          key:        `goal_deadline_7d:${g.id}:${todayStr()}`,
          title:      `⏰ Goal Deadline in 7 Days`,
          body:       `"${g.name}" — ${pct}% complete. ${fmt(g.targetAmount - g.currentAmount)} still needed.`,
          clickUrl:   '/goals',
          notifType:  'goal_progress',
          severity:   'high',
          entityId:   g.id,
          actionLabel: 'View Goals',
          tag:        `goal_${g.id}`,
        }, opts);
      }
      if (days === 30 && pct < 80) {
        fired = true;
        await sendToUser(uid, devices, {
          key:        `goal_deadline_30d:${g.id}:${todayStr()}`,
          title:      `📊 Goal Deadline in 30 Days`,
          body:       `"${g.name}" — ${pct}% complete with 30 days left. Target: ${fmt(g.targetAmount)}.`,
          clickUrl:   '/goals',
          notifType:  'goal_progress',
          severity:   'medium',
          entityId:   g.id,
          actionLabel: 'View Goals',
          tag:        `goal_${g.id}`,
        }, opts);
      }
    }

    // Monthly contribution reminder — 1st of month
    const today = new Date();
    if (today.getDate() === 1 && pct < 100) {
      fired = true;
      await sendToUser(uid, devices, {
        key:        `goal_monthly:${g.id}:${currentMonthKey()}`,
        title:      `💰 Monthly Goal Contribution`,
        body:       `Don't forget to contribute to "${g.name}" — ${pct}% reached. Target: ${fmt(g.targetAmount)}.`,
        clickUrl:   '/goals',
        notifType:  'goal_contribution_reminder',
        severity:   'low',
        entityId:   g.id,
        actionLabel: 'Add Contribution',
        tag:        `goal_${g.id}`,
      }, opts);
    }

    if (!fired) {
      const line = `uid=${uid} goal=${g.id} name="${g.name}" pct=${pct}% dueDate=${g.dueDate ?? 'none'} — matches no goal rule today (achieved needs pct>=100; deadline rules only fire at exactly 7 or 30 days left; monthly nudge only fires on the 1st).`;
      logger.info(`[pushNotif] ${line}`);
      opts?.results?.push(`NO MATCH (goal): ${line}`);
    }
  }
}

function _daysToNextDayOfMonth(todayDate: number, dueDay: number, today: Date): number {
  if (dueDay >= todayDate) {
    return dueDay - todayDate;
  }
  const nextMonthSameDay = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    dueDay,
  );
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), todayDate);
  return Math.round((nextMonthSameDay.getTime() - todayMidnight.getTime()) / 86_400_000);
}

function _daySuffix(d: number): string {
  const j = d % 10;
  const k = d % 100;
  if (j === 1 && k !== 11) return 'st';
  if (j === 2 && k !== 12) return 'nd';
  if (j === 3 && k !== 13) return 'rd';
  return 'th';
}

// 4. Liabilities / EMI
async function checkLiabilities(
  uid: string,
  devices: NotifDevice[],
  settings: NotifSettings,
  opts?: { force?: boolean; results?: string[] },
): Promise<void> {
  if (!settings.emiReminders) return;
  const liabilities = await fetchCol<any>(uid, 'liabilities', opts);
  const today = new Date();
  const todayDate = today.getDate();

  for (const l of liabilities) {
    if (l.status === 'paid' || l.status === 'returned' || l.status === 'paused') continue;
    if ((l.outstanding ?? 0) <= 0) {
      opts?.results?.push(`SKIPPED (liability): uid=${uid} liability=${l.id} — outstanding<=0, skipping.`);
      continue;
    }

    let fired = false;
    const emiAmountStr = l.emiAmount ? fmt(l.emiAmount) : 'your EMI amount';

    // 4a. EMI-day reminders based on emiDay (T-3, T-1, T=today)
    if (typeof l.emiDay === 'number' && l.emiDay >= 1 && l.emiDay <= 31) {
      const daysToEMI = _daysToNextDayOfMonth(todayDate, l.emiDay, today);
      const suffix = _daySuffix(l.emiDay);

      if (daysToEMI === 0) {
        fired = true;
        await sendToUser(uid, devices, {
          key:        `emi_today:${l.id}:${todayStr()}`,
          title:      `💸 EMI Due Today: ${l.name}`,
          body:       `${l.name} — ${emiAmountStr} is due today (${l.emiDay}${suffix} of every month). Outstanding: ${fmt(l.outstanding ?? 0)}.`,
          clickUrl:   '/liabilities',
          notifType:  'liability_emi',
          severity:   'high',
          entityId:   l.id,
          actionLabel: 'View Liabilities',
          tag:        `emi_${l.id}`,
        }, opts);
      } else if (daysToEMI === 1) {
        fired = true;
        await sendToUser(uid, devices, {
          key:        `emi_1d:${l.id}:${todayStr()}`,
          title:      `💸 EMI Tomorrow: ${l.name}`,
          body:       `${emiAmountStr} for "${l.name}" is due tomorrow (${l.emiDay}${suffix}).`,
          clickUrl:   '/liabilities',
          notifType:  'liability_emi',
          severity:   'medium',
          entityId:   l.id,
          actionLabel: 'View Liabilities',
          tag:        `emi_${l.id}`,
        }, opts);
      } else if (daysToEMI === 3) {
        fired = true;
        await sendToUser(uid, devices, {
          key:        `emi_3d:${l.id}:${todayStr()}`,
          title:      `⏰ EMI in 3 Days — ${l.name}`,
          body:       `Keep ${emiAmountStr} ready for "${l.name}" on ${l.emiDay}${suffix}.`,
          clickUrl:   '/liabilities',
          notifType:  'liability_emi',
          severity:   'low',
          entityId:   l.id,
          actionLabel: 'View Liabilities',
          tag:        `emi_${l.id}`,
        }, opts);
      }
    }

    // 4b. End-date final repayment — T within (1..3) days, today, and up to T+14 OVERDUE
    if (l.endDate) {
      const days = daysDiff(l.endDate);
      if (days === 0) {
        fired = true;
        await sendToUser(uid, devices, {
          key:        `liab_end_today:${l.id}:${todayStr()}`,
          title:      `🔴 FINAL Due Today — ${l.name}`,
          body:       `Final payment of ${fmt(l.outstanding ?? 0)} for "${l.name}" is DUE TODAY. Close this liability!`,
          clickUrl:   '/liabilities',
          notifType:  'liability_due',
          severity:   'critical',
          entityId:   l.id,
          actionLabel: 'Pay Now',
          tag:        `liab_${l.id}`,
        }, opts);
      } else if (days > 0 && days <= 3) {
        fired = true;
        await sendToUser(uid, devices, {
          key:        `liab_end_${days}d:${l.id}:${todayStr()}`,
          title:      `⏰ Final Payment in ${days}d — ${l.name}`,
          body:       `${fmt(l.outstanding ?? 0)} remaining on "${l.name}" — closes on ${l.endDate}.`,
          clickUrl:   '/liabilities',
          notifType:  'liability_due',
          severity:   'medium',
          entityId:   l.id,
          actionLabel: 'View Liabilities',
          tag:        `liab_${l.id}`,
        }, opts);
      } else if (days < 0 && days >= -14) {
        fired = true;
        const absDays = Math.abs(days);
        await sendToUser(uid, devices, {
          key:        `liab_end_overdue_${absDays}d:${l.id}:${todayStr()}`,
          title:      `⚠️ OVERDUE ${absDays}d — ${l.name}`,
          body:       `Final payment of ${fmt(l.outstanding ?? 0)} was due ${absDays} day${absDays === 1 ? '' : 's'} ago. Credit score impact risk — pay immediately.`,
          clickUrl:   '/liabilities',
          notifType:  'liability_overdue',
          severity:   'critical',
          entityId:   l.id,
          actionLabel: 'Pay Now',
          tag:        `liab_${l.id}`,
        }, opts);
      }
    }

    if (!fired) {
      const line = `uid=${uid} liability=${l.id} name="${l.name}" emiDay=${l.emiDay ?? 'none'} endDate=${l.endDate ?? 'none'} — no EMI-day rule (0/1/3 days until next EMI day) and no end-date rule (0–3d left, or overdue ≤14d) matched today.`;
      logger.info(`[pushNotif] ${line}`);
      opts?.results?.push(`NO MATCH (liability): ${line}`);
    }
  }
}

// 5. SIP reminder — first 7 days of month (nudge early for monthly budget) + allocation health check
async function checkSIP(
  uid: string,
  devices: NotifDevice[],
  settings: NotifSettings,
  opts?: { force?: boolean; results?: string[] },
): Promise<void> {
  if (!settings.sipReminders) return;
  const today = new Date();
  const todayDay = today.getDate();

  const sipPlans = await fetchCol<any>(uid, 'sipPlans', opts);
  const budgetDoc = sipPlans.find((s: any) => s && s.type === 'budget');
  const instruments = sipPlans.filter((s: any) => s && s.type === 'instrument');
  const budgetAmt = budgetDoc?.budget || 0;
  const totalPct = instruments.reduce((sum: number, i: any) => sum + (i.percentage || 0), 0);
  let fired = false;

  // 5a. Monthly SIP nudge (first 7 days of month) — only if budget set
  if (budgetAmt > 0 && todayDay <= 7) {
    fired = true;
    await sendToUser(uid, devices, {
      key:        `sip_monthly:${currentMonthKey()}:${uid}`,
      title:      `📅 SIP Time — Invest This Month!`,
      body:       `Your planned SIP budget is ${fmt(budgetAmt)} across ${instruments.length} instrument${instruments.length === 1 ? '' : 's'}. Execute your orders early in the month for better rupee-cost averaging.`,
      clickUrl:   '/investments',
      notifType:  'sip_reminder',
      severity:   'low',
      entityId:   `sip_${uid}`,
      actionLabel: 'Open SIP Plan',
      tag:        'sip_monthly',
    }, opts);
  } else if (budgetAmt > 0 && todayDay > 7 && !opts?.force) {
    opts?.results?.push(`NO MATCH (sip): uid=${uid} — SIP monthly nudge only fires the first 7 days of the month (today is day ${todayDay}).`);
  } else if (!budgetAmt || budgetAmt <= 0) {
    opts?.results?.push(`NO MATCH (sip): uid=${uid} — no sipPlans doc with type='budget' and budget>0 found for monthly nudge.`);
  }

  // 5b. Allocation mismatch warning — whenever sum of instrument % != 100%
  if (budgetAmt > 0 && instruments.length > 0 && (totalPct < 95 || totalPct > 100)) {
    fired = true;
    const allocKey = `sip_alloc:${currentMonthKey()}:${Math.round(totalPct)}`;
    const over = totalPct > 100;
    const bodySuffix = over
      ? `That is over 100% of your budget — trim some allocations.`
      : `${(100 - totalPct).toFixed(0)}% of ${fmt(budgetAmt)} is still unallocated.`;
    await sendToUser(uid, devices, {
      key:        allocKey,
      title:      over ? `🧭 SIP Over-Allocated!` : `🧭 SIP Not Fully Allocated`,
      body:       `Your instrument allocation sums to ${totalPct.toFixed(0)}%. ${bodySuffix}`,
      clickUrl:   '/investments',
      notifType:  'sip_allocation_mismatch',
      severity:   over ? 'high' : 'medium',
      entityId:   `sip_alloc_${uid}`,
      actionLabel: 'Fix Allocation',
      tag:        'sip_allocation',
    }, opts);
  } else if (budgetAmt > 0 && instruments.length > 0) {
    opts?.results?.push(`INFO (sip): uid=${uid} — allocation = ${totalPct.toFixed(0)}% (within 95-100% healthy band, no warning needed).`);
  }

  if (!fired && !opts?.results?.some((r) => r.startsWith('NO MATCH (sip)'))) {
    opts?.results?.push(`NO MATCH (sip): uid=${uid} — no SIP rule fired today (monthly nudge 1-7 if budget>0; allocation warning when sum% outside 95-100%).`);
  }
}

// 6. Lending overdue
async function checkLending(
  uid: string,
  devices: NotifDevice[],
  settings: NotifSettings,
  opts?: { force?: boolean; results?: string[] },
): Promise<void> {
  if (!settings.lendingReminders) return;
  const borrowers = await fetchCol<any>(uid, 'lendingBorrowers', opts);

  for (const b of borrowers) {
    if (b.status !== 'active' || !b.nextDueDate) {
      opts?.results?.push(`SKIPPED (lending): uid=${uid} borrower=${b.id} — status is not 'active' or nextDueDate is missing.`);
      continue;
    }
    const days = daysDiff(b.nextDueDate);
    if (days < -30) {
      opts?.results?.push(`NO MATCH (lending): uid=${uid} borrower=${b.id} — ${Math.abs(days)}d past due (>30d past due threshold, no longer notifying).`);
      continue;
    }
    let fired = false;
    const nameStr = b.name ?? 'the borrower';

    if (days === 7) {
      fired = true;
      await sendToUser(uid, devices, {
        key:        `lending_due_7d:${b.id}:${todayStr()}`,
        title:      `🤝 Lending Due in a Week — ${nameStr}`,
        body:       `${nameStr} — payment due on ${b.nextDueDate}.`,
        clickUrl:   '/liabilities',
        notifType:  'lending_due',
        severity:   'low',
        entityId:   b.id,
        actionLabel: 'View Lending',
        tag:        `lending_${b.id}`,
      }, opts);
    }
    if (days === 3) {
      fired = true;
      await sendToUser(uid, devices, {
        key:        `lending_due_3d:${b.id}:${todayStr()}`,
        title:      `🤝 3 Days Until ${nameStr} Payment`,
        body:       `Remind ${nameStr} about the payment on ${b.nextDueDate}.`,
        clickUrl:   '/liabilities',
        notifType:  'lending_due',
        severity:   'low',
        entityId:   b.id,
        actionLabel: 'View Lending',
        tag:        `lending_${b.id}`,
      }, opts);
    }
    if (days === 0) {
      fired = true;
      await sendToUser(uid, devices, {
        key:        `lending_due_today:${b.id}:${todayStr()}`,
        title:      `🤝 Collect Today: ${nameStr}`,
        body:       `Payment from ${nameStr} is due today (${b.nextDueDate}). Follow up!`,
        clickUrl:   '/liabilities',
        notifType:  'lending_due',
        severity:   'high',
        entityId:   b.id,
        actionLabel: 'View Lending',
        tag:        `lending_${b.id}`,
      }, opts);
    }
    if (days < 0 && [-1, -3, -7, -14, -21].includes(days)) {
      fired = true;
      const absDays = Math.abs(days);
      await sendToUser(uid, devices, {
        key:        `lending_overdue_${absDays}d:${b.id}:${todayStr()}`,
        title:      absDays >= 7 ? `❗ OVERDUE ${absDays}d: ${nameStr}` : `❗ Lending Overdue`,
        body:       `${nameStr}'s payment is ${absDays} day${absDays === 1 ? '' : 's'} overdue (was due ${b.nextDueDate}). Collect immediately.`,
        clickUrl:   '/liabilities',
        notifType:  'lending_overdue',
        severity:   absDays >= 7 ? 'high' : 'medium',
        entityId:   b.id,
        actionLabel: 'View Lending',
        tag:        `lending_${b.id}`,
      }, opts);
    }

    if (!fired) {
      const line = `uid=${uid} borrower=${b.id} name="${nameStr}" nextDueDate=${b.nextDueDate} daysUntilDue=${days} — no rule matched today (due reminders fire at exactly 7/3/0d; overdue fires on -1/-3/-7/-14/-21d).`;
      logger.info(`[pushNotif] ${line}`);
      opts?.results?.push(`NO MATCH (lending): ${line}`);
    }
  }
}

// 7. Investment maturity — bonds / fixed deposits (matured, 7d, 30d warnings)
async function checkInvestments(
  uid: string,
  devices: NotifDevice[],
  settings: NotifSettings,
  opts?: { force?: boolean; results?: string[] },
): Promise<void> {
  if (!settings.investmentAlerts) {
    logger.info(`[pushNotif] uid=${uid} — investmentAlerts is OFF in notificationSettings, skipping investment maturity checks.`);
    return;
  }
  const investments = await fetchCol<any>(uid, 'investments', opts);
  logger.info(`[pushNotif] uid=${uid} — evaluating ${investments.length} investment(s) for maturity.`);

  for (const inv of investments) {
    if (inv.type !== 'bond' && inv.type !== 'fixed_deposit') continue;
    if (!inv.maturityDate) continue;

    const days = daysDiff(inv.maturityDate);
    const invested = inv.investedAmount || 0;
    const rate = inv.interestRate || 0;
    const duration = inv.durationMonths || 0;
    const profit = invested * (rate / 100) * (duration / 12);
    const expectedPayout = invested + profit;
    let fired = false;
    const invName = inv.name || 'Your Investment';

    if (days <= 0) {
      // Matured — push a single notification per maturity date
      fired = true;
      await sendToUser(uid, devices, {
        key:        `inv_matured:${inv.id}:${inv.maturityDate}`,
        title:      `🎉 Investment Matured: ${invName}`,
        body:       `Your ${inv.type === 'bond' ? 'Bond' : 'FD'} "${invName}" matured on ${inv.maturityDate}. Expected payout ~${fmt(expectedPayout)} (invested ${fmt(invested)} + profit ${fmt(profit)}). Book your profit in the app.`,
        clickUrl:   '/investments',
        notifType:  'investment_matured',
        severity:   'info',
        entityId:   inv.id,
        actionLabel: 'View Profits',
        tag:        `inv_${inv.id}`,
      }, opts);
    } else if (days === 7) {
      fired = true;
      await sendToUser(uid, devices, {
        key:        `inv_mat_upcoming_7d:${inv.id}:${todayStr()}`,
        title:      `⏰ Investment Maturing in 7 Days`,
        body:       `Your ${inv.type === 'bond' ? 'Bond' : 'FD'} "${invName}" matures in 7 days (${inv.maturityDate}). Expected payout ~${fmt(expectedPayout)}.`,
        clickUrl:   '/investments',
        notifType:  'investment_maturity_upcoming',
        severity:   'low',
        entityId:   inv.id,
        actionLabel: 'View Investment',
        tag:        `inv_${inv.id}`,
      }, opts);
    } else if (days === 30) {
      fired = true;
      await sendToUser(uid, devices, {
        key:        `inv_mat_upcoming_30d:${inv.id}:${todayStr()}`,
        title:      `⏳ 30 Days Until Maturity — ${invName}`,
        body:       `"${invName}" (${inv.type === 'bond' ? 'Bond' : 'FD'}) matures in a month. Expected payout ~${fmt(expectedPayout)}.`,
        clickUrl:   '/investments',
        notifType:  'investment_maturity_upcoming',
        severity:   'low',
        entityId:   inv.id,
        actionLabel: 'View Investment',
        tag:        `inv_${inv.id}`,
      }, opts);
    }

    if (!fired) {
      const line = `uid=${uid} inv=${inv.id} name="${invName}" type=${inv.type} maturityDate=${inv.maturityDate} daysUntilMaturity=${days} — maturity push only fires on exactly 30/7 days left or days<=0 (matured).`;
      logger.info(`[pushNotif] ${line}`);
      opts?.results?.push(`NO MATCH (investment): ${line}`);
    }
  }
}

// 8. Pending Payments (receivables — buyers who owe us)
async function checkPendingPayments(
  uid: string,
  devices: NotifDevice[],
  settings: NotifSettings,
  opts?: { force?: boolean; results?: string[] },
): Promise<void> {
  if (!settings.paymentReminders) {
    logger.info(`[pushNotif] uid=${uid} — paymentReminders is OFF, skipping pending-payment (receivable) checks.`);
    return;
  }
  const pending = await fetchCol<any>(uid, 'pendingPayments', opts);
  logger.info(`[pushNotif] uid=${uid} — evaluating ${pending.length} pending payment(s) (receivables).`);

  for (const p of pending) {
    if (p.status !== 'pending' || !p.expectedPaymentDate) {
      opts?.results?.push(`SKIPPED (pendingPayment): uid=${uid} pp=${p.id} — status!==pending or expectedPaymentDate missing.`);
      continue;
    }
    const days = daysDiff(p.expectedPaymentDate);
    if (days < -30) {
      opts?.results?.push(`NO MATCH (pendingPayment): uid=${uid} pp=${p.id} — ${Math.abs(days)}d past due (>30d threshold, no longer notifying).`);
      continue;
    }
    const amtStr = fmt(p.amount);
    const buyer = p.buyerName ?? 'the buyer';
    let fired = false;
    let fireKey = '';
    let title = '';
    let body = '';
    let severity: 'info' | 'low' | 'medium' | 'high' | 'critical' = 'low';

    if (days === 0) {
      fireKey = `pp_today:${p.id}:${todayStr()}`;
      title = `🔴 Receive Today: ${fmt(p.amount)} from ${buyer}`;
      body = `${buyer} owes ${amtStr} for "${p.itemDescription ?? 'item'}" — expected TODAY. Follow up!`;
      severity = 'high';
      fired = true;
    } else if (days === 1) {
      fireKey = `pp_1d:${p.id}:${todayStr()}`;
      title = `⏰ Payment Tomorrow: ${buyer}`;
      body = `Expect ${amtStr} from ${buyer} tomorrow (${p.expectedPaymentDate}) for "${p.itemDescription ?? 'item'}".`;
      severity = 'medium';
      fired = true;
    } else if (days === 5) {
      fireKey = `pp_5d:${p.id}:${todayStr()}`;
      title = `💰 Incoming in 5d — ${buyer}`;
      body = `${amtStr} receivable on ${p.expectedPaymentDate} from ${buyer} for "${p.itemDescription ?? 'item'}".`;
      severity = 'low';
      fired = true;
    } else if (days < 0 && [-1, -3, -7, -14, -21].includes(days)) {
      const absDays = Math.abs(days);
      fireKey = `pp_overdue_${absDays}d:${p.id}:${todayStr()}`;
      title = absDays >= 7 ? `⚠️ OVERDUE ${absDays}d: ${buyer}` : `⚠️ OVERDUE: ${buyer}`;
      body = `${amtStr} was due ${absDays} day${absDays === 1 ? '' : 's'} ago from ${buyer} (${p.expectedPaymentDate}) for "${p.itemDescription ?? 'item'}". Follow up urgently.`;
      severity = absDays >= 7 ? 'high' : 'medium';
      fired = true;
    }

    if (fired && fireKey) {
      await sendToUser(uid, devices, {
        key:        fireKey,
        title,
        body,
        clickUrl:   '/liabilities?section=pending-payments',
        notifType:  days < 0 ? 'pending_payment_overdue' : 'pending_payment_due',
        severity,
        entityId:   p.id,
        actionLabel: 'Pending Payments',
        tag:        `pp_${p.id}`,
      }, opts);
    } else {
      const line = `uid=${uid} pp=${p.id} buyer="${buyer}" expected=${p.expectedPaymentDate} daysUntilDue=${days} — due reminders only fire on exactly 5/1/0d; overdue fires on -1/-3/-7/-14/-21d.`;
      logger.info(`[pushNotif] ${line}`);
      opts?.results?.push(`NO MATCH (pendingPayment): ${line}`);
    }
  }
}

// 9. Subscription / trial
async function checkSubscription(
  uid: string,
  devices: NotifDevice[],
  settings: NotifSettings,
  opts?: { force?: boolean; results?: string[] },
): Promise<void> {
  if (!settings.subscriptionAlerts) return;
  const db = getDb();
  const snap = await db.collection('users').doc(uid).get();
  if (!snap.exists) return;
  const data = snap.data()!;

  if (data.premiumGranted === true || data.plan === 'lifetime') {
    opts?.results?.push(`SKIPPED (subscription): uid=${uid} — premiumGranted or lifetime plan, no trial/expiry checks apply.`);
    return;
  }

  const status: string = data.subscriptionStatus ?? '';
  const trialEnd: Timestamp | null = data.trialEnd ?? null;
  let fired = false;

  if (status === 'active' && trialEnd) {
    const days = daysDiff(trialEnd.toDate().toISOString().slice(0, 10));

    if (days === 3) {
      fired = true;
      await sendToUser(uid, devices, {
        key:        `trial_ending_3d:${uid}:${todayStr()}`,
        title:      `⏳ Fintrackly Trial Ending Soon`,
        body:       `Your free trial ends in 3 days. Upgrade now to keep all premium features.`,
        clickUrl:   '/pricing',
        notifType:  'trial_ending',
        severity:   'high',
        entityId:   uid,
        actionLabel: 'Upgrade Now',
        tag:        'trial_ending',
      }, opts);
    }
    if (days === 1) {
      fired = true;
      await sendToUser(uid, devices, {
        key:        `trial_ending_1d:${uid}:${todayStr()}`,
        title:      `⏳ Trial Ends Tomorrow`,
        body:       `Your Fintrackly free trial ends tomorrow. Upgrade to avoid losing access.`,
        clickUrl:   '/pricing',
        notifType:  'trial_ending',
        severity:   'critical',
        entityId:   uid,
        actionLabel: 'Upgrade Now',
        tag:        'trial_ending',
      }, opts);
    }
    if (days === 0) {
      fired = true;
      await sendToUser(uid, devices, {
        key:        `trial_ending_today:${uid}:${todayStr()}`,
        title:      `🔒 Fintrackly Trial Ends Today`,
        body:       `Your free trial ends today. Subscribe now to keep your data and premium access.`,
        clickUrl:   '/pricing',
        notifType:  'trial_ending',
        severity:   'critical',
        entityId:   uid,
        actionLabel: 'Subscribe Now',
        tag:        'trial_ending',
      }, opts);
    }
    if (!fired) {
      opts?.results?.push(`NO MATCH (subscription): uid=${uid} trialEnd=${trialEnd.toDate().toISOString().slice(0, 10)} daysUntilTrialEnd=${days} — only fires at exactly 3, 1, or 0 days left.`);
    }
  }

  if (status === 'expired') {
    fired = true;
    await sendToUser(uid, devices, {
      key:        `sub_expired:${uid}:${todayStr()}`,
      title:      `🔒 Subscription Expired`,
      body:       `Fintrackly premium features are locked. Subscribe to restore full access.`,
      clickUrl:   '/pricing',
      notifType:  'subscription_expired',
      severity:   'critical',
      entityId:   uid,
      actionLabel: 'Subscribe',
      tag:        'subscription_expired',
    }, opts);
  }

  if (!fired && status !== 'active') {
    opts?.results?.push(`NO MATCH (subscription): uid=${uid} status="${status}" — not 'active' with a trialEnd, and not 'expired'.`);
  }
}

// ── On-demand dedup-reset callable ─────────────────────────────────────────────
// Deletes ALL pushSent dedup records for the currently signed-in user ONLY.
// Use this when you want the 30-minute SCHEDULER (not the test callable, which
// already supports {force:true}) to re-fire pushes that "already sent today".
export const clearNotificationDedup = onCall(
  { region },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'You must be signed in to clear your own notification dedup.');
    }
    const db = getDb();
    const col = db.collection('users').doc(uid).collection('pushSent');

    // Stream all docs in chunks and delete each one (batched for safety).
    // 500 is the maximum writes per Firestore WriteBatch.
    const BATCH_SIZE = 500;
    let deleted = 0;
    let cursor: any = undefined;

    while (true) {
      let q: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = col.limit(BATCH_SIZE);
      if (cursor) q = q.startAfter(cursor);
      const snap = await q.get();
      if (snap.empty) break;

      const batch = db.batch();
      for (const doc of snap.docs) batch.delete(doc.ref);
      await batch.commit();

      deleted += snap.docs.length;
      cursor = snap.docs[snap.docs.length - 1];
      if (snap.docs.length < BATCH_SIZE) break;
    }

    return {
      ok: true,
      uid,
      deleted,
      message: `Deleted ${deleted} pushSent dedup record(s) for uid=${uid}. The scheduler on its next run will now re-fire any push condition that matches your data.`,
    };
  },
);

// ── On-demand test callable ───────────────────────────────────────────────────
// Lets you (signed in as yourself) trigger the exact same rule engine
// instantly, for just your own account, and get a plain-English report back —
// instead of waiting for the 30-min scheduler and digging through Cloud
// Function logs. Pass { force: true } to bypass the dedup check so repeated
// test runs on the same day still send.
export const testPushNotifications = onCall(
  { region },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'You must be signed in to run this test.');
    }
    const force = request.data?.force === true;

    const db = getDb();
    const results: string[] = [];

    const devicesSnap = await db
      .collection('users').doc(uid)
      .collection('notificationDevices').get();
    const devices: NotifDevice[] = devicesSnap.docs.map(
      (d) => ({ id: d.id, ...(d.data() as Omit<NotifDevice, 'id'>) }),
    );
    const enabledDevices = devices.filter((d) => d.enabled && d.token);

    if (!enabledDevices.length) {
      return {
        ok: false,
        reason: 'No enabled device with a token found under notificationDevices for this account. Enable push from Settings on the device first.',
        deviceCount: devices.length,
        results: [],
      };
    }

    const settingsSnap = await db
      .collection('users').doc(uid)
      .collection('notificationSettings').doc('config').get();

    const settings: NotifSettings = {
      pushEnabled:       true,
      paymentReminders:  true,
      insuranceReminders:true,
      goalReminders:     true,
      emiReminders:      true,
      lendingReminders:  true,
      sipReminders:      true,
      subscriptionAlerts:true,
      investmentAlerts:  true,
      quietHoursEnabled: true,
      quietHoursStart:   '22:00',
      quietHoursEnd:     '07:00',
      ...(settingsSnap.exists ? settingsSnap.data() : {}),
    };

    if (!settings.pushEnabled) {
      return {
        ok: false,
        reason: 'pushEnabled is OFF in your notificationSettings/config document.',
        settings,
        results: [],
      };
    }

    const inQuietHour = isQuietHour(settings);
    if (inQuietHour && !force) {
      return {
        ok: false,
        reason: `Currently inside your quiet hours window (${settings.quietHoursStart}–${settings.quietHoursEnd} IST). Pass force:true to override for testing, or disable quiet hours.`,
        settings,
        results: [],
      };
    }

    const opts = { force, results };

    // Every category that has rule logic implemented is tested here — not
    // just payments/insurance. Agriculture and attendance reminders are NOT
    // included because there is currently no rule logic for them at all
    // anywhere in this file — see the file header note.
    await Promise.all([
      checkPayments(uid, enabledDevices, settings, opts),
      checkInsurance(uid, enabledDevices, settings, opts),
      checkGoals(uid, enabledDevices, settings, opts),
      checkLiabilities(uid, enabledDevices, settings, opts),
      checkSIP(uid, enabledDevices, settings, opts),
      checkLending(uid, enabledDevices, settings, opts),
      checkInvestments(uid, enabledDevices, settings, opts),
      checkPendingPayments(uid, enabledDevices, settings, opts),
      checkSubscription(uid, enabledDevices, settings, opts),
    ]);

    return {
      ok: true,
      deviceCount: enabledDevices.length,
      settings,
      results, // human-readable line per record evaluated: SENT / NO MATCH / SKIPPED / ERROR / INFO / CLEANED
    };
  },
);

// ── Main scheduled function ───────────────────────────────────────────────────

export const processScheduledNotifications = onSchedule(
  {
    schedule:  'every 30 minutes',
    region,
    timeZone:  'Asia/Kolkata',
    timeoutSeconds: 540,    // 9 minutes — generous for large user bases
    memory:    '512MiB',
  },
  async () => {
    const db = getDb();
    logger.info('[pushNotif] processScheduledNotifications started');

    // Get all user docs (paginated — firebase-admin listUsers for auth,
    // but here we query Firestore users collection directly since we need data).
    const usersSnap = await db.collection('users').get();
    logger.info(`[pushNotif] Processing ${usersSnap.size} users`);

    let sent = 0;
    let skipped = 0;

    for (const userDoc of usersSnap.docs) {
      const uid = userDoc.id;

      try {
        // 1. Load devices
        const devicesSnap = await db
          .collection('users').doc(uid)
          .collection('notificationDevices').get();

        const devices: NotifDevice[] = devicesSnap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<NotifDevice, 'id'>) }))
          .filter((d) => d.enabled && d.token);

        if (!devices.length) { skipped++; continue; }

        // 2. Load notification settings
        const settingsSnap = await db
          .collection('users').doc(uid)
          .collection('notificationSettings').doc('config').get();

        const settings: NotifSettings = {
          pushEnabled:       true,
          paymentReminders:  true,
          insuranceReminders:true,
          goalReminders:     true,
          emiReminders:      true,
          lendingReminders:  true,
          sipReminders:      true,
          subscriptionAlerts:true,
          investmentAlerts:  true,
          quietHoursEnabled: true,
          quietHoursStart:   '22:00',
          quietHoursEnd:     '07:00',
          ...(settingsSnap.exists ? settingsSnap.data() : {}),
        };

        if (!settings.pushEnabled) { skipped++; continue; }

        // 3. Check quiet hours
        if (isQuietHour(settings)) { skipped++; continue; }

        // 4. Run all rule checks in parallel
        await Promise.all([
          checkPayments(uid, devices, settings),
          checkInsurance(uid, devices, settings),
          checkGoals(uid, devices, settings),
          checkLiabilities(uid, devices, settings),
          checkSIP(uid, devices, settings),
          checkLending(uid, devices, settings),
          checkInvestments(uid, devices, settings),
          checkPendingPayments(uid, devices, settings),
          checkSubscription(uid, devices, settings),
        ]);

        sent++;
      } catch (err) {
        logger.error(`[pushNotif] Error for uid=${uid}:`, err);
      }
    }

    logger.info(`[pushNotif] Done — processed=${sent}, skipped=${skipped}`);
  },
);