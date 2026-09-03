// scripts/send-notifications.js
// FinTrackly Daily Finance Digest — GitHub Actions
//
// Replaces the former Firebase Cloud Function `processScheduledNotifications`.
// Runs once a day at 8:00 AM IST via GitHub Actions (no Cloud Scheduler cost).
//
// For every user:
//   1. Reads notificationSettings.
//   2. Checks all collections (payments, insurance, liabilities, investments) in parallel.
//   3. Collects all triggered reminders for the day.
//   4. Deduplicates against pushSent subcollection (7-day cooldown).
//   5. Sends ONE consolidated email digest.
//   6. Writes sent keys back to pushSent.

const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const { webcrypto } = require('crypto');

const subtle = webcrypto.subtle;

// ── Init Firebase ─────────────────────────────────────────────────────────────
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  }),
});
const db = admin.firestore();

// ── Email transport ───────────────────────────────────────────────────────────
function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  });
}
const FROM_NAME = 'FinTrackly Alerts';

// ── Encryption (mirrors encryptionService.ts / send-report.js) ───────────────
const SALT = process.env.VITE_ENCRYPTION_SALT || 'default-finance-salt-v1';
const _keyCache = new Map();

function fromBase64(str) {
  return Buffer.from(str, 'base64');
}

async function deriveKey(uid) {
  if (_keyCache.has(uid)) return _keyCache.get(uid);
  const enc = new TextEncoder();
  const baseKey = await subtle.importKey(
    'raw',
    enc.encode(`${uid}::${SALT}`),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );
  const key = await subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode(SALT),
      iterations: 100_000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );
  _keyCache.set(uid, key);
  return key;
}

async function decryptDoc(uid, raw) {
  if (raw['_encrypted'] !== true) {
    const copy = { ...raw };
    delete copy['_encrypted'];
    return copy;
  }
  try {
    const key = await deriveKey(uid);
    const buf = await subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(raw['_iv']) },
      key,
      fromBase64(raw['_data']),
    );
    return JSON.parse(new TextDecoder().decode(buf));
  } catch (e) {
    console.warn(`    [warn] decryptDoc id=${raw['id']}: ${e.message}`);
    return null;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function daysDiff(dateStr) {
  const target = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function fmt(n) {
  return '₹' + Math.abs(Math.round(n || 0)).toLocaleString('en-IN');
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

async function fetchCol(uid, col) {
  try {
    const snap = await db.collection('users').doc(uid).collection(col).get();
    const docs = await Promise.all(snap.docs.map((d) => decryptDoc(uid, d.data())));
    return docs
      .map((doc, i) => (doc ? { id: snap.docs[i].id, ...doc } : null))
      .filter(Boolean);
  } catch (err) {
    console.error(`    [fetchCol] uid=${uid} col=${col} ERROR:`, err.message);
    return [];
  }
}

// ── Deduplication (mirrors pushNotifications.ts shouldSend / markSent) ────────
async function shouldSend(uid, key) {
  const snap = await db
    .collection('users')
    .doc(uid)
    .collection('pushSent')
    .doc(key)
    .get();
  if (!snap.exists) return true;
  const data = snap.data();
  const ageMs =
    Date.now() -
    (data.sentAt?.toMillis?.() || data.failedAt?.toMillis?.() || 0);
  // 7-day cooldown — same as original function
  return ageMs > 7 * 86_400_000;
}

async function markSent(uid, keys) {
  if (!keys.length) return;
  const now = admin.firestore.Timestamp.now();
  const batch = db.batch();
  keys.forEach((key) => {
    const ref = db
      .collection('users')
      .doc(uid)
      .collection('pushSent')
      .doc(key);
    batch.set(
      ref,
      { key, status: 'sent', sentAt: now, updatedAt: now },
      { merge: true },
    );
  });
  await batch.commit();
}

// ── Rule evaluators ───────────────────────────────────────────────────────────

async function checkPayments(uid, settings) {
  const msgs = [];
  if (!settings.paymentReminders) return msgs;

  const payments = await fetchCol(uid, 'trackedPayments');
  for (const p of payments) {
    if (p.status === 'paid') continue;
    const days = daysDiff(p.dueDate);
    const reminderDays = p.reminderDays ?? [1, 3, 7];

    if (days === 0) {
      msgs.push({
        key: `payment_due_today:${p.id}:${todayStr()}`,
        title: '🔔 Payment Due Today',
        body: `${p.title} — ${fmt(p.amount)} is due today.`,
        severity: 'high',
        clickUrl: '/payments',
        notifType: 'payment_tracker_due',
        entityId: p.id,
        actionLabel: 'Pay Now',
      });
    } else if (days > 0 && reminderDays.includes(days)) {
      msgs.push({
        key: `payment_due_${days}d:${p.id}:${todayStr()}`,
        title: `💳 Payment Due in ${days} Days`,
        body: `"${p.title}" — ${fmt(p.amount)} is due on ${p.dueDate}.`,
        severity: 'medium',
        clickUrl: '/payments',
        notifType: 'payment_tracker_due',
        entityId: p.id,
      });
    } else if (days < 0 && [-1, -3, -6, -9, -12].includes(days)) {
      const absDays = Math.abs(days);
      msgs.push({
        key: `payment_overdue_${absDays}d:${p.id}:${todayStr()}`,
        title: '🚨 Payment OVERDUE',
        body: `${p.title} — ${fmt(p.amount)} was due ${absDays} days ago.`,
        severity: 'critical',
        clickUrl: '/payments',
        notifType: 'payment_tracker_overdue',
        entityId: p.id,
      });
    }
  }
  return msgs;
}

async function checkInsurance(uid, settings) {
  const msgs = [];
  if (!settings.insuranceReminders) return msgs;

  const policies = await fetchCol(uid, 'insurancePolicies');
  for (const pol of policies) {
    if (!pol.renewalDate) continue;
    const days = daysDiff(pol.renewalDate);
    if (pol.status === 'expired' && !(days < 0 && days >= -3)) continue;

    if (days < 0 && days >= -3) {
      msgs.push({
        key: `insurance_expired:${pol.id}:${todayStr()}`,
        title: '🚨 Insurance Expired',
        body: `${pol.policyName} expired on ${pol.renewalDate}. Renew immediately!`,
        severity: 'critical',
        clickUrl: '/insurance',
        notifType: 'insurance_expired',
        entityId: pol.id,
      });
    } else if ([30, 15, 7, 3, 1, 0].includes(days)) {
      msgs.push({
        key: `insurance_due_${days}d:${pol.id}:${todayStr()}`,
        title: `🛡️ Insurance Renewal: ${pol.policyName}`,
        body: `Premium ${fmt(pol.premiumAmount)} is due in ${days} days.`,
        severity: days <= 3 ? 'high' : 'medium',
        clickUrl: '/insurance',
        notifType: 'insurance_renewal',
        entityId: pol.id,
      });
    }
  }
  return msgs;
}

async function checkLiabilities(uid, settings) {
  const msgs = [];
  if (!settings.emiReminders) return msgs;

  const liabilities = await fetchCol(uid, 'liabilities');
  const today = new Date();

  for (const l of liabilities) {
    if (['paid', 'returned', 'paused'].includes(l.status)) continue;
    if ((l.outstanding ?? 0) <= 0) continue;

    if (typeof l.emiDay === 'number' && l.emiDay >= 1 && l.emiDay <= 31) {
      const emiDayDate = new Date(
        today.getFullYear(),
        today.getMonth(),
        l.emiDay,
      );
      if (emiDayDate < today && today.getDate() !== l.emiDay) {
        emiDayDate.setMonth(emiDayDate.getMonth() + 1);
      }
      const daysToEMI = Math.round(
        (emiDayDate.getTime() - today.getTime()) / 86_400_000,
      );

      if ([0, 1, 3].includes(daysToEMI)) {
        msgs.push({
          key: `emi_${daysToEMI}d:${l.id}:${todayStr()}`,
          title: `💸 EMI Alert: ${l.name}`,
          body: `EMI of ${fmt(l.emiAmount)} is due in ${daysToEMI} days.`,
          severity: daysToEMI === 0 ? 'high' : 'medium',
          clickUrl: '/liabilities',
          notifType: 'liability_emi',
          entityId: l.id,
        });
      }
    }
  }
  return msgs;
}

async function checkInvestments(uid, settings) {
  const msgs = [];
  if (!settings.investmentAlerts) return msgs;

  const investments = await fetchCol(uid, 'investments');
  for (const inv of investments) {
    if (
      !inv.maturityDate ||
      (inv.type !== 'bond' && inv.type !== 'fixed_deposit')
    )
      continue;
    const days = daysDiff(inv.maturityDate);

    if (days <= 0) {
      msgs.push({
        key: `inv_matured:${inv.id}:${inv.maturityDate}`,
        title: '🎉 Investment Matured',
        body: `Your investment "${inv.name}" has matured.`,
        severity: 'info',
        clickUrl: '/investments',
        notifType: 'investment_matured',
        entityId: inv.id,
      });
    } else if (days === 7 || days === 30) {
      msgs.push({
        key: `inv_mat_upcoming_${days}d:${inv.id}:${todayStr()}`,
        title: '⏰ Investment Maturing Soon',
        body: `"${inv.name}" matures in ${days} days.`,
        severity: 'low',
        clickUrl: '/investments',
        notifType: 'investment_upcoming',
        entityId: inv.id,
      });
    }
  }
  return msgs;
}

// ── Email renderer ────────────────────────────────────────────────────────────
const EMAIL_CLICK_BASE = 'https://fintrackly.web.app';

function severityToBadgeColor(severity) {
  switch (severity) {
    case 'critical': return '#dc2626';
    case 'high':     return '#ea580c';
    case 'medium':   return '#ca8a04';
    case 'low':      return '#16a34a';
    case 'info':     return '#2563eb';
    default:         return '#475569';
  }
}

function renderConsolidatedHtmlEmail(messages) {
  const dateStr = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  const itemsHtml = messages
    .map((msg) => {
      const badgeColor = severityToBadgeColor(msg.severity);
      const clickUrl = new URL(
        msg.clickUrl || '/dashboard',
        EMAIL_CLICK_BASE,
      ).toString();
      return `
      <div style="border-left:4px solid ${badgeColor};padding:12px 16px;margin-bottom:16px;background:#f8fafc;border-radius:4px;">
        <h3 style="margin:0 0 4px 0;font-size:16px;color:#0f172a;">${msg.title}</h3>
        <p style="margin:0 0 10px 0;font-size:14px;color:#334155;line-height:1.5;">${msg.body}</p>
        <a href="${clickUrl}" style="font-size:13px;font-weight:600;color:${badgeColor};text-decoration:none;">${msg.actionLabel || 'View Details'} &rarr;</a>
      </div>`;
    })
    .join('');

  return `
  <!doctype html>
  <html lang="en">
    <body style="margin:0;padding:0;background:#0f172a;font-family:sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:20px;">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">
            <tr><td style="padding:24px;border-bottom:1px solid #e2e8f0;">
              <h2 style="margin:0;color:#0f172a;font-size:20px;">Your Daily Finance Summary</h2>
              <p style="margin:4px 0 0 0;color:#64748b;font-size:14px;">${dateStr} · FinTrackly</p>
            </td></tr>
            <tr><td style="padding:24px;">
              <p style="margin:0 0 20px 0;color:#334155;font-size:15px;">Here is your financial overview and pending actions for today:</p>
              ${itemsHtml}
            </td></tr>
            <tr><td style="padding:20px 24px;background:#f1f5f9;text-align:center;font-size:12px;color:#64748b;">
              <p style="margin:0;">Sent by FinTrackly. You can manage notifications in your App Settings.</p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
  </html>`;
}

// ── Per-user processing ───────────────────────────────────────────────────────
async function processUser(uid, userEmail, transporter) {
  // Load notification settings with safe defaults (all enabled)
  const settingsSnap = await db
    .collection('users')
    .doc(uid)
    .collection('notificationSettings')
    .doc('config')
    .get();

  const settings = {
    pushEnabled: true,
    paymentReminders: true,
    insuranceReminders: true,
    goalReminders: true,
    emiReminders: true,
    lendingReminders: true,
    sipReminders: true,
    subscriptionAlerts: true,
    investmentAlerts: true,
    quietHoursEnabled: false,
    ...(settingsSnap.exists ? settingsSnap.data() : {}),
  };

  if (!settings.pushEnabled) {
    console.log(`  ↳ notifications disabled → ${userEmail}`);
    return { skipped: true };
  }

  // 1. Gather all triggered rules concurrently
  const allMessages = (
    await Promise.all([
      checkPayments(uid, settings),
      checkInsurance(uid, settings),
      checkLiabilities(uid, settings),
      checkInvestments(uid, settings),
    ])
  ).flat();

  if (allMessages.length === 0) {
    console.log(`  ↳ no alerts today → ${userEmail}`);
    return { skipped: true };
  }

  // 2. Filter out already-sent messages (deduplication)
  const messagesToSend = [];
  for (const msg of allMessages) {
    if (await shouldSend(uid, msg.key)) {
      messagesToSend.push(msg);
    }
  }

  if (messagesToSend.length === 0) {
    console.log(`  ↳ all deduplicated (already sent) → ${userEmail}`);
    return { skipped: true };
  }

  // 3. Send single consolidated email
  const htmlBody = renderConsolidatedHtmlEmail(messagesToSend);
  await transporter.sendMail({
    from: `"${FROM_NAME}" <${process.env.GMAIL_USER}>`,
    to: userEmail,
    subject: `🔔 Your Daily Finance Summary (${messagesToSend.length} alert${messagesToSend.length > 1 ? 's' : ''})`,
    html: htmlBody,
  });

  // 4. Mark all as sent
  await markSent(uid, messagesToSend.map((m) => m.key));

  console.log(
    `  ✓ sent digest (${messagesToSend.length} alerts) → ${userEmail}`,
  );
  return { sent: messagesToSend.length };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== FinTrackly Daily Notifications ===');
  console.log('Time (UTC):', new Date().toISOString());

  const required = [
    'FIREBASE_PROJECT_ID',
    'FIREBASE_CLIENT_EMAIL',
    'FIREBASE_PRIVATE_KEY',
    'GMAIL_USER',
    'GMAIL_PASS',
  ];
  for (const key of required) {
    if (!process.env[key]) {
      console.error(`MISSING env var: ${key}`);
      process.exit(1);
    }
  }
  console.log('All env vars present ✓');

  const transporter = createTransporter();
  try {
    await transporter.verify();
    console.log('Gmail connection verified ✓');
  } catch (err) {
    console.error('Gmail connection FAILED:', err.message);
    process.exit(1);
  }

  // TEST_EMAIL — send only to this address (for manual workflow_dispatch testing)
  const testEmail = process.env.TEST_EMAIL;

  if (testEmail) {
    console.log(`\nTest mode — processing: ${testEmail}`);
    try {
      const user = await admin.auth().getUserByEmail(testEmail);
      console.log(`Found uid: ${user.uid}`);
      await processUser(user.uid, testEmail, transporter);
    } catch (err) {
      console.error('ERROR:', err.message);
      process.exit(1);
    }
    process.exit(0);
  }

  // Production — iterate all users from Firestore (avoids Auth list cost)
  const usersSnap = await db.collection('users').get();
  console.log(`\nFound ${usersSnap.size} user documents`);

  let sent = 0;
  let skipped = 0;
  let errors = 0;

  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    const data = userDoc.data() ?? {};
    const userEmail =
      typeof data.email === 'string' && data.email.includes('@')
        ? data.email.trim()
        : null;

    if (!userEmail) {
      skipped++;
      continue;
    }

    try {
      const result = await processUser(uid, userEmail, transporter);
      if (result.skipped) {
        skipped++;
      } else {
        sent++;
      }
      // Small delay to stay within Gmail rate limits
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      console.error(`  ✗ failed → ${userEmail}:`, err.message);
      errors++;
    }
  }

  console.log(`\nDone — Sent: ${sent}, Skipped: ${skipped}, Errors: ${errors}`);
  process.exit(errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal:', err.message, err.stack);
  process.exit(1);
});
