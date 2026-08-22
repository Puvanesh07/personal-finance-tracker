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
 *      Lending (checkLending), Subscription/trial (checkSubscription) all
 *      have real rule logic AND are wired into both the 30-min scheduler
 *      AND the on-demand testPushNotifications callable below.
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

/** Check Firestore pushSent dedup record. Returns true if NOT yet sent today. */
async function shouldSend(uid: string, key: string, force?: boolean): Promise<boolean> {
  if (force) return true; // testing mode — ignore dedup entirely
  const db = getDb();
  const ref = db.collection('users').doc(uid).collection('pushSent').doc(key);
  const snap = await ref.get();
  if (!snap.exists) return true;
  const data = snap.data()!;
  // re-allow after 7 days (so weekly/monthly keys auto-reset)
  const sentAt: Timestamp = data.sentAt;
  const ageMs = Date.now() - sentAt.toMillis();
  return ageMs > 7 * 86_400_000;
}

async function markSent(uid: string, key: string): Promise<void> {
  const db = getDb();
  await db
    .collection('users').doc(uid)
    .collection('pushSent').doc(key)
    .set({ sentAt: Timestamp.now(), key }, { merge: true });
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

  const payloadFor = (device: NotifDevice) => ({
    token: device.token,
    notification: { title: msg.title, body: msg.body },
    webpush: {
      notification: {
        title:   msg.title,
        body:    msg.body,
        icon:    '/icons/android-chrome-192x192.png',
        badge:   '/icons/favicon-32x32.png',
        tag:     msg.tag ?? msg.notifType,
        vibrate: [100, 50, 200],
        requireInteraction: msg.severity === 'critical',
        actions: msg.actionLabel
          ? [{ action: 'open', title: msg.actionLabel }]
          : [],
      },
      fcmOptions: {
        link: `https://fintrackly.web.app${msg.clickUrl}`,
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
    await markSent(uid, msg.key);
    const sentLine = `Sent "${msg.title}" → uid=${uid} (${sentCount}/${enabled.length} device(s))`;
    logger.info(`[pushNotif] ${sentLine}`);
    opts?.results?.push(`SENT: ${sentLine}`);
  } else {
    const line = `uid=${uid} key=${msg.key} — all ${enabled.length} device send attempt(s) failed, nothing marked as sent (dedup key NOT written, will retry next run).`;
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
      body    = `${p.title} — ${fmt(p.amount)} is due today.`;
      severity = 'high';
    } else if (days > 0 && reminderDays.includes(days)) {
      fireKey = `payment_due_${days}d:${p.id}:${todayStr()}`;
      title   = `💳 Payment Due in ${days} Day${days > 1 ? 's' : ''}`;
      body    = `${p.title} — ${fmt(p.amount)} due on ${p.dueDate}.`;
      severity = days <= 1 ? 'high' : 'medium';
    } else if (days === -1 || days === -3) {
      fireKey = `payment_overdue_${Math.abs(days)}d:${p.id}:${todayStr()}`;
      title   = `⚠️ Payment Overdue`;
      body    = `${p.title} — ${fmt(p.amount)} was due ${Math.abs(days)} day${Math.abs(days) > 1 ? 's' : ''} ago.`;
      severity = 'critical';
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
    if (pol.status === 'expired') {
      logger.info(`[pushNotif] uid=${uid} policy=${pol.id} — status is 'expired', skipping.`);
      continue;
    }
    const days = daysDiff(pol.renewalDate);
    const triggerDays = [30, 15, 7, 3, 1, 0];
    logger.info(`[pushNotif] uid=${uid} policy=${pol.id} name="${pol.policyName}" renewalDate=${pol.renewalDate} daysUntilRenewal=${days} triggerDays=[${triggerDays.join(',')}]`);

    if (!triggerDays.includes(days) && !(days < 0 && days >= -3)) {
      const line = `uid=${uid} policy=${pol.id} — daysUntilRenewal=${days} matches no trigger day, no push queued.`;
      logger.info(`[pushNotif] ${line}`);
      opts?.results?.push(`NO MATCH (insurance): ${line}`);
      continue;
    }

    let title = '';
    let body  = '';
    let severity = 'medium';
    let fireKey  = '';

    if (days < 0) {
      fireKey  = `insurance_expired:${pol.id}:${todayStr()}`;
      title    = `🚨 Insurance Expired`;
      body     = `${pol.policyName} expired ${Math.abs(days)} day(s) ago. Renew immediately!`;
      severity = 'critical';
    } else if (days === 0) {
      fireKey  = `insurance_due_today:${pol.id}:${todayStr()}`;
      title    = `🛡️ Insurance Renews Today`;
      body     = `${pol.policyName} — ${fmt(pol.premiumAmount ?? 0)} renewal due today.`;
      severity = 'high';
    } else {
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

  for (const l of liabilities) {
    if (l.status === 'paid' || l.status === 'returned') continue;
    if (!l.emiAmount || l.emiAmount <= 0) {
      opts?.results?.push(`SKIPPED (liability): uid=${uid} liability=${l.id} — no emiAmount set, skipping.`);
      continue;
    }

    let fired = false;

    // EMI-day reminder (1st of month nudge)
    if (today.getDate() === 1) {
      fired = true;
      await sendToUser(uid, devices, {
        key:        `emi_monthly:${l.id}:${currentMonthKey()}`,
        title:      `💸 EMI Due This Month`,
        body:       `${l.name} — EMI of ${fmt(l.emiAmount)}. Outstanding: ${fmt(l.outstanding ?? 0)}.`,
        clickUrl:   '/liabilities',
        notifType:  'liability_emi',
        severity:   'medium',
        entityId:   l.id,
        actionLabel: 'View Liabilities',
        tag:        `emi_${l.id}`,
      }, opts);
    }

    // End-date approaching
    if (l.endDate) {
      const days = daysDiff(l.endDate);
      if (days === 3 || days === 1 || days === 0) {
        fired = true;
        const label = days === 0 ? 'Today' : `in ${days} day${days > 1 ? 's' : ''}`;
        await sendToUser(uid, devices, {
          key:        `liab_end_${days}d:${l.id}:${todayStr()}`,
          title:      `🔴 Final Loan Payment ${label}`,
          body:       `${l.name} — final payment of ${fmt(l.outstanding ?? 0)} due ${label}.`,
          clickUrl:   '/liabilities',
          notifType:  'liability_due',
          severity:   days === 0 ? 'critical' : 'high',
          entityId:   l.id,
          actionLabel: 'Pay Now',
          tag:        `liab_${l.id}`,
        }, opts);
      }
    }

    if (!fired) {
      const line = `uid=${uid} liability=${l.id} name="${l.name}" endDate=${l.endDate ?? 'none'} — matches no liability rule today (monthly nudge only fires on the 1st; end-date rule only fires at exactly 3, 1, or 0 days left).`;
      logger.info(`[pushNotif] ${line}`);
      opts?.results?.push(`NO MATCH (liability): ${line}`);
    }
  }
}

// 5. SIP reminder — 5th of month
async function checkSIP(
  uid: string,
  devices: NotifDevice[],
  settings: NotifSettings,
  opts?: { force?: boolean; results?: string[] },
): Promise<void> {
  if (!settings.sipReminders) return;
  const today = new Date();
  if (today.getDate() !== 5 && !opts?.force) {
    opts?.results?.push(`NO MATCH (sip): uid=${uid} — SIP reminder only fires on the 5th of the month (today is the ${today.getDate()}).`);
    return;
  }

  const sipPlans = await fetchCol<any>(uid, 'sipPlans', opts);
  const budgetDoc = sipPlans.find((s) => s.type === 'budget');
  if (!budgetDoc?.budget || budgetDoc.budget <= 0) {
    opts?.results?.push(`NO MATCH (sip): uid=${uid} — no sipPlans doc with type='budget' and budget>0 found.`);
    return;
  }

  await sendToUser(uid, devices, {
    key:        `sip_monthly:${currentMonthKey()}:${uid}`,
    title:      `📅 Monthly SIP Reminder`,
    body:       `Your monthly SIP budget is ${fmt(budgetDoc.budget)}. Have you invested this month?`,
    clickUrl:   '/investments',
    notifType:  'sip_reminder',
    severity:   'low',
    entityId:   `sip_${uid}`,
    actionLabel: 'View SIP Plan',
    tag:        'sip_monthly',
  }, opts);
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
    let fired = false;

    if (days === 3) {
      fired = true;
      await sendToUser(uid, devices, {
        key:        `lending_due_3d:${b.id}:${todayStr()}`,
        title:      `🤝 Lending Due in 3 Days`,
        body:       `Payment from ${b.name} is due in 3 days.`,
        clickUrl:   '/liabilities',
        notifType:  'lending_due',
        severity:   'medium',
        entityId:   b.id,
        actionLabel: 'View Lending',
        tag:        `lending_${b.id}`,
      }, opts);
    }
    if (days <= 0 && days >= -3) {
      fired = true;
      const label = days === 0 ? 'today' : `${Math.abs(days)} day(s) ago`;
      await sendToUser(uid, devices, {
        key:        `lending_overdue_${Math.abs(days)}d:${b.id}:${todayStr()}`,
        title:      `❗ Lending Overdue`,
        body:       `Payment from ${b.name} was due ${label}. Follow up!`,
        clickUrl:   '/liabilities',
        notifType:  'lending_overdue',
        severity:   'high',
        entityId:   b.id,
        actionLabel: 'View Lending',
        tag:        `lending_${b.id}`,
      }, opts);
    }

    if (!fired) {
      const line = `uid=${uid} borrower=${b.id} name="${b.name}" nextDueDate=${b.nextDueDate} daysUntilDue=${days} — matches no lending rule today (due reminder only fires at exactly 3 days out; overdue only fires from 0 to -3 days).`;
      logger.info(`[pushNotif] ${line}`);
      opts?.results?.push(`NO MATCH (lending): ${line}`);
    }
  }
}

// 7. Subscription / trial
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