/**
 * functions/src/pushNotifications.ts
 *
 * OPTIMIZED DAILY DIGEST VERSION
 * Cloud Function: processScheduledNotifications
 * Runs ONCE a day at 8:00 AM IST via Cloud Scheduler.
 * 
 * For every user:
 *   1. Reads notificationSettings.
 *   2. Checks all collections (payments, insurance, liabilities, investments) in parallel.
 *   3. Collects all triggered reminders for the day.
 *   4. Sends ONE consolidated email digest.
 *   5. Writes to pushSent dedup collection.
 */

import * as logger from 'firebase-functions/logger';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { Timestamp } from 'firebase-admin/firestore';
import { getDb } from './subscriptionUtils';
import { decryptDoc, type FirestoreDoc } from './serverEncryption';
import * as nodemailer from 'nodemailer';

const region = 'asia-south1';

// ── SMTP / Email transport (nodemailer) ─────────────────────────────────────
let _mailer: nodemailer.Transporter | null = null;

function getMailer(): { ok: true; transporter: nodemailer.Transporter; from: string } | { ok: false; reason: string } {
  if (_mailer) {
    const from = _buildFromAddress();
    return { ok: true, transporter: _mailer, from };
  }
  const host = process.env.SMTP_HOST;
  const portStr = process.env.SMTP_PORT ?? '465';
  const secure = (process.env.SMTP_SECURE ?? 'true').toLowerCase() !== 'false';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = Number(portStr);

  if (!host || !user || !pass || !Number.isFinite(port)) {
    return {
      ok: false,
      reason: `SMTP env vars missing. Need SMTP_HOST="${host ?? ''}" SMTP_USER="${user ?? ''}" SMTP_PORT="${portStr}" SMTP_PASS=***.`,
    };
  }

  try {
    _mailer = nodemailer.createTransport({
      host, port, secure, auth: { user, pass },
    } as nodemailer.TransportOptions);
    const from = _buildFromAddress();
    return { ok: true, transporter: _mailer, from };
  } catch (err: any) {
    return { ok: false, reason: `Failed to create nodemailer transport: ${err?.message ?? String(err)}` };
  }
}

function _buildFromAddress(): string {
  const name = process.env.SMTP_FROM_NAME ?? 'FinTrackly Alerts';
  const email = process.env.SMTP_FROM_EMAIL ?? process.env.SMTP_USER ?? 'no-reply@fintrackly.local';
  return `${name} <${email}>`;
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface NotifSettings {
  pushEnabled: boolean;
  paymentReminders: boolean;
  insuranceReminders: boolean;
  goalReminders: boolean;
  emiReminders: boolean;
  lendingReminders: boolean;
  sipReminders: boolean;
  subscriptionAlerts: boolean;
  investmentAlerts: boolean;
  quietHoursEnabled: boolean;
}

interface PushMessage {
  key: string;
  title: string;
  body: string;
  clickUrl: string;
  notifType: string;
  severity: string;
  entityId: string;
  actionLabel?: string;
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

async function shouldSend(uid: string, key: string): Promise<boolean> {
  const db = getDb();
  const snap = await db.collection('users').doc(uid).collection('pushSent').doc(key).get();
  if (!snap.exists) return true;
  
  const data = snap.data()!;
  const ageMs = Date.now() - (data.sentAt?.toMillis() || data.failedAt?.toMillis() || 0);
  // 7-day cooldown for dedup
  return ageMs > 7 * 86_400_000;
}

async function markSent(uid: string, keys: string[]): Promise<void> {
  if (!keys.length) return;
  const db = getDb();
  const now = Timestamp.now();
  const batch = db.batch();
  
  keys.forEach(key => {
    const ref = db.collection('users').doc(uid).collection('pushSent').doc(key);
    batch.set(ref, { key, status: 'sent', sentAt: now, updatedAt: now }, { merge: true });
  });
  
  await batch.commit();
}

const EMAIL_CLICK_BASE = 'https://fintrackly.web.app';

function severityToBadgeColor(severity: string): string {
  switch (severity) {
    case 'critical': return '#dc2626'; // red-600
    case 'high':     return '#ea580c'; // orange-600
    case 'medium':   return '#ca8a04'; // yellow-600
    case 'low':      return '#16a34a'; // green-600
    case 'info':     return '#2563eb'; // blue-600
    default:         return '#475569'; // slate-600
  }
}

// ── Email rendering ──────────────────────────────────────────
function renderConsolidatedHtmlEmail(messages: PushMessage[]): string {
  const dateStr = new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'short', day: 'numeric' });
  
  const itemsHtml = messages.map(msg => {
    const badgeColor = severityToBadgeColor(msg.severity);
    const clickUrl = new URL(msg.clickUrl || '/dashboard', EMAIL_CLICK_BASE).toString();
    return `
      <div style="border-left: 4px solid ${badgeColor}; padding: 12px 16px; margin-bottom: 16px; background: #f8fafc; border-radius: 4px;">
        <h3 style="margin: 0 0 4px 0; font-size: 16px; color: #0f172a;">${msg.title}</h3>
        <p style="margin: 0 0 10px 0; font-size: 14px; color: #334155; line-height: 1.5;">${msg.body}</p>
        <a href="${clickUrl}" style="font-size: 13px; font-weight: 600; color: ${badgeColor}; text-decoration: none;">${msg.actionLabel || 'View Details'} &rarr;</a>
      </div>
    `;
  }).join('');

  return `
  <!doctype html>
  <html lang="en">
    <body style="margin:0;padding:0;background:#0f172a;font-family:sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a; padding: 20px;">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:12px; overflow:hidden;">
            <tr><td style="padding: 24px; border-bottom: 1px solid #e2e8f0;">
              <h2 style="margin:0; color:#0f172a; font-size:20px;">Your Daily Finance Summary</h2>
              <p style="margin:4px 0 0 0; color:#64748b; font-size:14px;">${dateStr} · FinTrackly</p>
            </td></tr>
            <tr><td style="padding: 24px;">
              <p style="margin:0 0 20px 0; color:#334155; font-size:15px;">Here is your financial overview and pending actions for today:</p>
              ${itemsHtml}
            </td></tr>
            <tr><td style="padding: 20px 24px; background: #f1f5f9; text-align: center; font-size: 12px; color: #64748b;">
              <p style="margin: 0;">Sent by FinTrackly. You can manage notifications in your App Settings.</p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
  </html>`;
}

// ── Rule evaluators (Returning Arrays) ────────

async function fetchCol<T>(uid: string, col: string): Promise<T[]> {
  const db = getDb();
  const snap = await db.collection('users').doc(uid).collection(col).get();
  const out: T[] = [];
  for (const d of snap.docs) {
    try {
      const decrypted = await decryptDoc<Record<string, unknown>>(uid, d.data() as FirestoreDoc);
      out.push({ id: d.id, ...decrypted } as T);
    } catch (err) {
      logger.error(`[pushNotif] Decrypt failed uid=${uid} col=${col} doc=${d.id}`);
    }
  }
  return out;
}

async function checkPayments(uid: string, settings: NotifSettings): Promise<PushMessage[]> {
  const msgs: PushMessage[] = [];
  if (!settings.paymentReminders) return msgs;
  
  const payments = await fetchCol<any>(uid, 'trackedPayments');
  for (const p of payments) {
    if (p.status === 'paid') continue;
    const days = daysDiff(p.dueDate);
    const reminderDays: number[] = p.reminderDays ?? [1, 3, 7];

    if (days === 0) {
      msgs.push({ key: `payment_due_today:${p.id}:${todayStr()}`, title: `🔔 Payment Due Today`, body: `${p.title} — ${fmt(p.amount)} is due today.`, severity: 'high', clickUrl: '/payments', notifType: 'payment_tracker_due', entityId: p.id, actionLabel: 'Pay Now' });
    } else if (days > 0 && reminderDays.includes(days)) {
      msgs.push({ key: `payment_due_${days}d:${p.id}:${todayStr()}`, title: `💳 Payment Due in ${days} Days`, body: `"${p.title}" — ${fmt(p.amount)} is due on ${p.dueDate}.`, severity: 'medium', clickUrl: '/payments', notifType: 'payment_tracker_due', entityId: p.id });
    } else if (days < 0 && [-1, -3, -6, -9, -12].includes(days)) {
      const absDays = Math.abs(days);
      msgs.push({ key: `payment_overdue_${absDays}d:${p.id}:${todayStr()}`, title: `🚨 Payment OVERDUE`, body: `${p.title} — ${fmt(p.amount)} was due ${absDays} days ago.`, severity: 'critical', clickUrl: '/payments', notifType: 'payment_tracker_overdue', entityId: p.id });
    }
  }
  return msgs;
}

async function checkInsurance(uid: string, settings: NotifSettings): Promise<PushMessage[]> {
  const msgs: PushMessage[] = [];
  if (!settings.insuranceReminders) return msgs;
  
  const policies = await fetchCol<any>(uid, 'insurancePolicies');
  for (const pol of policies) {
    if (!pol.renewalDate) continue;
    const days = daysDiff(pol.renewalDate);
    if (pol.status === 'expired' && !(days < 0 && days >= -3)) continue;

    const triggerDays = [30, 15, 7, 3, 1, 0];
    if (days < 0 && days >= -3) {
      msgs.push({ key: `insurance_expired:${pol.id}:${todayStr()}`, title: `🚨 Insurance Expired`, body: `${pol.policyName} expired on ${pol.renewalDate}. Renew immediately!`, severity: 'critical', clickUrl: '/insurance', notifType: 'insurance_expired', entityId: pol.id });
    } else if (triggerDays.includes(days)) {
      msgs.push({ key: `insurance_due_${days}d:${pol.id}:${todayStr()}`, title: `🛡️ Insurance Renewal: ${pol.policyName}`, body: `Premium ${fmt(pol.premiumAmount)} is due in ${days} days.`, severity: days <= 3 ? 'high' : 'medium', clickUrl: '/insurance', notifType: 'insurance_renewal', entityId: pol.id });
    }
  }
  return msgs;
}

async function checkLiabilities(uid: string, settings: NotifSettings): Promise<PushMessage[]> {
  const msgs: PushMessage[] = [];
  if (!settings.emiReminders) return msgs;
  
  const liabilities = await fetchCol<any>(uid, 'liabilities');
  const today = new Date();
  
  for (const l of liabilities) {
    if (l.status === 'paid' || l.status === 'returned' || l.status === 'paused') continue;
    if ((l.outstanding ?? 0) <= 0) continue;

    if (typeof l.emiDay === 'number' && l.emiDay >= 1 && l.emiDay <= 31) {
      const emiDayDate = new Date(today.getFullYear(), today.getMonth(), l.emiDay);
      if (emiDayDate < today && today.getDate() !== l.emiDay) {
          emiDayDate.setMonth(emiDayDate.getMonth() + 1);
      }
      const daysToEMI = Math.round((emiDayDate.getTime() - today.getTime()) / 86_400_000);

      if ([0, 1, 3].includes(daysToEMI)) {
        msgs.push({ key: `emi_${daysToEMI}d:${l.id}:${todayStr()}`, title: `💸 EMI Alert: ${l.name}`, body: `EMI of ${fmt(l.emiAmount)} is due in ${daysToEMI} days.`, severity: daysToEMI === 0 ? 'high' : 'medium', clickUrl: '/liabilities', notifType: 'liability_emi', entityId: l.id });
      }
    }
  }
  return msgs;
}

async function checkInvestments(uid: string, settings: NotifSettings): Promise<PushMessage[]> {
  const msgs: PushMessage[] = [];
  if (!settings.investmentAlerts) return msgs;
  
  const investments = await fetchCol<any>(uid, 'investments');
  for (const inv of investments) {
    if (!inv.maturityDate || (inv.type !== 'bond' && inv.type !== 'fixed_deposit')) continue;
    const days = daysDiff(inv.maturityDate);

    if (days <= 0) {
      msgs.push({ key: `inv_matured:${inv.id}:${inv.maturityDate}`, title: `🎉 Investment Matured`, body: `Your investment "${inv.name}" has matured.`, severity: 'info', clickUrl: '/investments', notifType: 'investment_matured', entityId: inv.id });
    } else if (days === 7 || days === 30) {
      msgs.push({ key: `inv_mat_upcoming_${days}d:${inv.id}:${todayStr()}`, title: `⏰ Investment Maturing Soon`, body: `"${inv.name}" matures in ${days} days.`, severity: 'low', clickUrl: '/investments', notifType: 'investment_upcoming', entityId: inv.id });
    }
  }
  return msgs;
}

// ── Main scheduled function ───────────────────────────────────────────────────

export const processScheduledNotifications = onSchedule(
  {
    schedule: '0 8 * * *', // Runs EXACTLY ONCE a day at 8:00 AM IST
    region,
    timeZone: 'Asia/Kolkata',
    timeoutSeconds: 540,
    memory: '256MiB', // Reduced memory to lower costs safely
  },
  async () => {
    const db = getDb();
    logger.info('[pushNotif] processScheduledNotifications started (Daily Run)');

    const usersSnap = await db.collection('users').get();
    const mailer = getMailer();

    if (!mailer.ok) {
      logger.error('[pushNotif] SMTP not configured. Cannot send emails.');
      return;
    }

    for (const userDoc of usersSnap.docs) {
      const uid = userDoc.id;
      const userData = userDoc.data() ?? {};
      const userEmail = (typeof userData.email === 'string' && userData.email.includes('@')) ? userData.email.trim() : null;
      
      if (!userEmail) continue; 

      const settingsSnap = await db.collection('users').doc(uid).collection('notificationSettings').doc('config').get();
      const settings: NotifSettings = {
        pushEnabled: true, paymentReminders: true, insuranceReminders: true,
        goalReminders: true, emiReminders: true, lendingReminders: true,
        sipReminders: true, subscriptionAlerts: true, investmentAlerts: true,
        quietHoursEnabled: false, ...(settingsSnap.exists ? settingsSnap.data() : {}),
      };

      if (!settings.pushEnabled) continue;

      // 1. Gather all triggered rules concurrently
      const allMessages = (await Promise.all([
        checkPayments(uid, settings),
        checkInsurance(uid, settings),
        checkLiabilities(uid, settings),
        checkInvestments(uid, settings)
      ])).flat();

      if (allMessages.length === 0) continue;

      // 2. Filter out already-sent messages (Deduplication)
      const messagesToSend: PushMessage[] = [];
      for (const msg of allMessages) {
        if (await shouldSend(uid, msg.key)) {
          messagesToSend.push(msg);
        }
      }

      if (messagesToSend.length === 0) continue;

      // 3. Send Single Consolidated Email
      try {
        const htmlBody = renderConsolidatedHtmlEmail(messagesToSend);
        await mailer.transporter.sendMail({
          from: mailer.from,
          to: userEmail,
          subject: `🔔 Your Daily Finance Summary (${messagesToSend.length} alerts)`,
          html: htmlBody,
        });

        // 4. Mark all as sent in DB
        const keys = messagesToSend.map(m => m.key);
        await markSent(uid, keys);
        
        logger.info(`[pushNotif] Sent daily digest to ${userEmail} with ${messagesToSend.length} items.`);
      } catch (err) {
        logger.error(`[pushNotif] Failed to send digest to ${userEmail}:`, err);
      }
    }
  }
);