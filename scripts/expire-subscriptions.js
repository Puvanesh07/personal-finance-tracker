// scripts/expire-subscriptions.js
// FinTrackly Subscription Maintenance — GitHub Actions (FREE, replaces Cloud Functions)
//
// Four daily jobs, in order:
//   1. expire      — flip active subscriptions whose expiresAt has passed
//   2. warn        — tell people their data is due to be deleted in 7 days
//   3. softDelete  — past grace: cut access, vault the data, start a 30-day undo window
//   4. purge       — 30 days later: remove the vaulted data for good
//
// ── SAFETY MODEL ──────────────────────────────────────────────────────────────
// This script deletes customer financial records, so it is written to be boring:
//   • DRY_RUN_DELETE defaults to TRUE, so phases 3 and 4 only report. Deleting
//     customer data has to be opted into deliberately, per run.
//   • MAX_DELETIONS aborts the run if more users qualify than expected. A normal
//     day touches 0–3 accounts; a bug or a bad timestamp write can qualify 400.
//   • Eligibility is re-checked per document, and a gracePeriodEnd that is
//     missing / not a timestamp / absurdly old is treated as ANOMALY, not as a
//     deletion signal. That matters because `<= now` also matches a zero date.
//   • Anyone who ever paid (paymentId set) is never purged automatically —
//     deleting a paying customer's portfolio is not a defensible default.
//   • Phase 3 keeps an encrypted copy in deletionVault/{uid} for PURGE_AFTER_DAYS
//     so a mistaken run is recoverable.
//
// Required IAM on the service account: Firestore Admin, Firebase Auth Admin
// (to delete the login), and nothing else.

const admin = require('firebase-admin');

// ── Config ────────────────────────────────────────────────────────────────────
const cfg = {
  // Jobs 1–2 are non-destructive (flip a status, send a warning) and keep
  // running as before. Jobs 3–4 delete customer data and are dry-run by default.
  dryRun: (process.env.DRY_RUN ?? 'false').toLowerCase() === 'true',
  deleteDryRun: (process.env.DRY_RUN_DELETE ?? 'true').toLowerCase() !== 'false',
  maxDeletions: Number(process.env.MAX_DELETIONS ?? 10),
  purgeAfterDays: Number(process.env.PURGE_AFTER_DAYS ?? 30),
  warnDaysBefore: Number(process.env.WARN_DAYS_BEFORE ?? 7),
  retainPaidCustomerData: (process.env.RETAIN_PAYER_DATA ?? 'true').toLowerCase() !== 'false',
  executePhase3: (process.env.RUN_SOFT_DELETE ?? 'true').toLowerCase() !== 'false',
  executePhase4: (process.env.RUN_PURGE ?? 'true').toLowerCase() !== 'false',
};

const stats = {
  expired: 0,
  warned: 0,
  softDeleted: 0,
  purged: 0,
  skippedOwner: 0,
  skippedPaidCustomer: 0,
  anomalies: [],
};

const ts = (v) => (v?.toDate ? v.toDate() : v instanceof Date ? v : null);
const dayMs = 86_400_000;

// ── Bootstrap Firebase Admin ──────────────────────────────────────────────────
if (!admin.apps.length) {
  if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      }),
    });
  } else {
    // Workload Identity Federation / GOOGLE_APPLICATION_CREDENTIALS
    admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
  }
}

const db = admin.firestore();

// Sub-collections that hold customer data. `orders` (payment receipts) and the
// push-registration docs were missing here, so they survived every deletion.
const USER_SUBCOLLECTIONS = [
  'investments', 'snapshots', 'liabilities', 'cashflows',
  'goals', 'goalContributions', 'accounts', 'soldTrades',
  'pendingPayments', 'trackedPayments', 'credentials',
  'insurancePolicies', 'insurancePayments',
  'sipPlans', 'networthSnapshots',
  'insights', 'settings', 'notificationSettings',
  'notificationJobs', 'notificationDevices', 'pushSent', 'orders',
];

// Wiped first, at the moment access ends — secrets and device tokens should
// never sit in the undo window even though everything here is encrypted.
const IMMEDIATE_WIPE_COLLECTIONS = ['credentials', 'notificationDevices', 'pushSent'];

async function deleteCollection(path, batchSize = 200) {
  for (;;) {
    const snap = await db.collection(path).limit(batchSize).get();
    if (snap.empty) return;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    if (snap.size < batchSize) return;
  }
}

async function createNotification(uid, title, message, type) {
  await db.collection('notifications').doc(uid).collection('items').add({
    title, message, type, read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * Copy one subcollection into the vault, unmodified.
 * Documents are stored field-encrypted, so a vault copy is no more readable
 * than the live data was — it exists purely so a bad run can be undone.
 */
async function vaultSubcollection(uid, col) {
  const src = await db.collection(`users/${uid}/${col}`).get();
  if (src.empty) return 0;
  let copied = 0;
  for (const chunk of splitInto(src.docs, 200)) {
    const batch = db.batch();
    for (const d of chunk) {
      batch.set(db.collection(`deletionVault/${uid}/entities`).doc(`${col}__${d.id}`), {
        _sourceCollection: col,
        _sourceId: d.id,
        _archivedAt: admin.firestore.FieldValue.serverTimestamp(),
        data: d.data(),
      });
      copied += 1;
    }
    if (!cfg.deleteDryRun) await batch.commit();
  }
  return copied;
}

function splitInto(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ── Guard: is this document actually safe to act on? ──────────────────────────
function assessDeletionEligibility(data, now) {
  if (data.premiumGranted === true) return { act: false, reason: 'owner' };
  if (data.plan === 'lifetime' && data.subscriptionStatus === 'active') {
    return { act: false, reason: 'active lifetime' };
  }
  if (data.subscriptionStatus !== 'expired') return { act: false, reason: 'not expired' };

  const grace = ts(data.gracePeriodEnd);
  if (!data.gracePeriodEnd || !grace) {
    return { act: false, anomaly: 'gracePeriodEnd missing or not a timestamp' };
  }
  // A zero/epoch date would satisfy `<= now` and delete a healthy account.
  if (grace.getTime() < now.getTime() - 365 * dayMs) {
    return { act: false, anomaly: `gracePeriodEnd implausibly old: ${grace.toISOString()}` };
  }
  if (grace.getTime() > now.getTime()) return { act: false, reason: 'still in grace' };

  if (cfg.retainPaidCustomerData && data.paymentId) {
    return { act: false, reason: 'ever paid — manual review' };
  }
  return { act: true, grace };
}

// ── Job 1: expire ─────────────────────────────────────────────────────────────
async function expireSubscriptions(now) {
  const snap = await db.collection('users')
    .where('subscriptionStatus', '==', 'active')
    .where('expiresAt', '<=', admin.firestore.Timestamp.fromDate(now))
    .get();

  console.log(`[expire] Found ${snap.size} users past their expiry`);

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    if (data.premiumGranted === true || data.plan === 'lifetime' || !ts(data.expiresAt)) continue;

    if (cfg.dryRun) {
      console.log(`[expire] DRY RUN would expire uid ${docSnap.id}`);
      stats.expired += 1;
      continue;
    }

    try {
      await docSnap.ref.set(
        {
          subscriptionStatus: 'expired',
          gracePeriodEnd: admin.firestore.Timestamp.fromDate(
            new Date(ts(data.expiresAt).getTime() + 30 * dayMs),
          ),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      // Rules and any claim-driven logic need to know access ended.
      await admin.auth().setCustomUserClaims(docSnap.id, { plan: data.plan || 'trial', premium: false });
      await createNotification(
        docSnap.id,
        'Subscription expired',
        'Premium features are locked. Your data stays for 30 days, then is deleted unless you subscribe.',
        'warning',
      );
      stats.expired += 1;
    } catch (err) {
      console.error(`[expire] Failed for uid ${docSnap.id}:`, err.message);
    }
  }
}

// ── Job 2: warn before the deletion date ──────────────────────────────────────
async function warnGracePeriodEnding(now) {
  const horizon = admin.firestore.Timestamp.fromDate(new Date(now.getTime() + cfg.warnDaysBefore * dayMs));
  const snap = await db.collection('users')
    .where('subscriptionStatus', '==', 'expired')
    .where('gracePeriodEnd', '<=', horizon)
    .get();

  console.log(`[warn] ${snap.size} accounts inside the ${cfg.warnDaysBefore}-day warning window`);

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    if (data.premiumGranted === true) continue;
    if (data.graceNoticeSentAt) continue;           // one warning per account
    const grace = ts(data.gracePeriodEnd);
    if (!grace || grace.getTime() <= now.getTime()) continue; // already due — job 3 handles it

    const daysLeft = Math.max(1, Math.ceil((grace.getTime() - now.getTime()) / dayMs));
    if (cfg.dryRun) {
      console.log(`[warn] DRY RUN would notify uid ${docSnap.id} (${daysLeft} days left)`);
      stats.warned += 1;
      continue;
    }
    try {
      await createNotification(
        docSnap.id,
        'Your data will be deleted',
        `You are ${daysLeft} day(s) from the end of your grace period. Subscribe to keep your portfolio, or export it from Settings now.`,
        'warning',
      );
      await docSnap.ref.set({ graceNoticeSentAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      stats.warned += 1;
    } catch (err) {
      console.error(`[warn] Failed for uid ${docSnap.id}:`, err.message);
    }
  }
}

// ── Job 3: soft delete (access ends, data vaulted) ────────────────────────────
async function softDeleteExpired(now) {
  if (!cfg.executePhase3) return;

  const snap = await db.collection('users')
    .where('subscriptionStatus', '==', 'expired')
    .where('gracePeriodEnd', '<=', admin.firestore.Timestamp.fromDate(now))
    .get();

  console.log(`[softDelete] ${snap.size} accounts past their grace period`);

  // Runaway guard: no ordinary day deletes a crowd.
  if (snap.size > cfg.maxDeletions) {
    stats.anomalies.push(`softDelete matched ${snap.size} users (> MAX_DELETIONS=${cfg.maxDeletions}) — ABORTED`);
    console.error(`[softDelete] ABORT: ${snap.size} candidates exceeds the cap. Inspect before rerunning.`);
    return;
  }

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const verdict = assessDeletionEligibility(data, now);
    if (!verdict.act) {
      if (verdict.anomaly) stats.anomalies.push(`${docSnap.id}: ${verdict.anomaly}`);
      if (verdict.reason === 'owner') stats.skippedOwner += 1;
      if (verdict.reason?.startsWith('ever paid')) stats.skippedPaidCustomer += 1;
      console.log(`[softDelete] skip ${docSnap.id}: ${verdict.anomaly ?? verdict.reason}`);
      continue;
    }

    if (cfg.deleteDryRun) {
      console.log(`[softDelete] DRY RUN would vault + revoke uid ${docSnap.id}`);
      continue;
    }

    try {
      // 1. Vault everything except what must go immediately.
      for (const col of USER_SUBCOLLECTIONS) {
        if (IMMEDIATE_WIPE_COLLECTIONS.includes(col)) continue;
        await vaultSubcollection(docSnap.id, col);
      }
      for (const col of IMMEDIATE_WIPE_COLLECTIONS) {
        await deleteCollection(`users/${docSnap.id}/${col}`);
      }

      // 2. The login itself is removed — access ends now, not in 30 days.
      try {
        await admin.auth().deleteUser(docSnap.id);
      } catch (err) {
        if (err?.code !== 'auth/user-not-found') throw err;
      }

      // 3. Tombstone: keep the users doc only long enough to hold the undo clock.
      await docSnap.ref.set(
        {
          subscriptionStatus: 'deleted',
          deletedAt: admin.firestore.FieldValue.serverTimestamp(),
          purgeAfter: admin.firestore.Timestamp.fromDate(
            new Date(now.getTime() + cfg.purgeAfterDays * dayMs),
          ),
          email: null,
          phone: null,
          displayName: null,
        },
        { merge: true },
      );
      await deleteCollection(`notifications/${docSnap.id}/items`);

      stats.softDeleted += 1;
      console.log(`[softDelete] revoked ${docSnap.id}; data vaulted for ${cfg.purgeAfterDays} days`);
    } catch (err) {
      stats.anomalies.push(`${docSnap.id}: softDelete failed — ${err.message}`);
      console.error(`[softDelete] Failed for uid ${docSnap.id}:`, err.message);
    }
  }
}

// ── Job 4: purge (undo window elapsed) ────────────────────────────────────────
async function purgeDeleted(now) {
  if (!cfg.executePhase4) return;

  const snap = await db.collection('users')
    .where('subscriptionStatus', '==', 'deleted')
    .where('purgeAfter', '<=', admin.firestore.Timestamp.fromDate(now))
    .get();

  console.log(`[purge] ${snap.size} accounts past their undo window`);

  if (snap.size > cfg.maxDeletions) {
    stats.anomalies.push(`purge matched ${snap.size} users (> MAX_DELETIONS=${cfg.maxDeletions}) — ABORTED`);
    console.error(`[purge] ABORT: ${snap.size} candidates exceeds the cap.`);
    return;
  }

  for (const docSnap of snap.docs) {
    if (cfg.deleteDryRun) {
      console.log(`[purge] DRY RUN would permanently erase uid ${docSnap.id}`);
      continue;
    }
    try {
      for (const col of USER_SUBCOLLECTIONS) {
        await deleteCollection(`users/${docSnap.id}/${col}`);
      }
      await deleteCollection(`deletionVault/${docSnap.id}/entities`);
      await docSnap.ref.delete();
      stats.purged += 1;
      console.log(`[purge] erased ${docSnap.id}`);
    } catch (err) {
      stats.anomalies.push(`${docSnap.id}: purge failed — ${err.message}`);
      console.error(`[purge] Failed for uid ${docSnap.id}:`, err.message);
    }
  }
}

// ── Run ───────────────────────────────────────────────────────────────────────
async function main() {
  const now = new Date();
  console.log('=== FinTrackly Subscription Maintenance ===');
  console.log('Time:', now.toISOString());
  console.log('Mode:', `expire/warn ${cfg.dryRun ? 'DRY RUN' : 'execute'} · delete ${cfg.deleteDryRun ? 'DRY RUN' : '*** EXECUTE ***'}`);
  console.log('Caps:', `MAX_DELETIONS=${cfg.maxDeletions}`, `PURGE_AFTER_DAYS=${cfg.purgeAfterDays}`);

  await expireSubscriptions(now);
  await warnGracePeriodEnding(now);
  await softDeleteExpired(now);
  await purgeDeleted(now);

  console.log('=== Summary ===');
  console.table(stats);
  if (stats.anomalies.length) {
    console.error('ANOMALIES (needs a human):');
    stats.anomalies.forEach((a) => console.error('  -', a));
    // Non-zero exit turns the Action red, which is the only alarm this job has.
    process.exit(1);
  }
  console.log('=== Done ===');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

