// scripts/expire-subscriptions.js
// FinTrackly Subscription Maintenance — GitHub Actions (FREE, replaces Cloud Functions)
//
// Replaces TWO Cloud Run functions that were costing money as idle containers:
//   - expireSubscriptions   (was: Cloud Scheduler → Cloud Run, daily midnight)
//   - deleteExpiredUsers    (was: Cloud Scheduler → Cloud Run, daily 12:30 AM)
//
// This script does both jobs in one pass, called once per day by GitHub Actions.
// No Cloud Run minimum-instance cost. No Cloud Scheduler cost. Completely free.

const admin = require('firebase-admin');

// ── Bootstrap Firebase Admin ──────────────────────────────────────────────────
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

// Sub-collections to delete when wiping a user's data
const USER_SUBCOLLECTIONS = [
  'investments', 'snapshots', 'liabilities', 'cashflows',
  'goals', 'goalContributions', 'accounts', 'soldTrades',
  'pendingPayments', 'trackedPayments', 'credentials',
  'insurancePolicies', 'insurancePayments', 'lendingBorrowers',
  'lendingTransactions', 'sipPlans', 'networthSnapshots',
  'insights', 'settings', 'notificationSettings',
];

async function deleteCollection(path, batchSize = 200) {
  const colRef = db.collection(path);
  const snap = await colRef.limit(batchSize).get();
  if (snap.empty) return;
  const batch = db.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  if (snap.size >= batchSize) await deleteCollection(path, batchSize);
}

async function deleteAllUserData(uid) {
  for (const col of USER_SUBCOLLECTIONS) {
    await deleteCollection(`users/${uid}/${col}`);
  }
  await deleteCollection(`notifications/${uid}/items`);
  await db.collection('users').doc(uid).delete();
  console.log(`[deleteExpiredUsers] Deleted all data for uid: ${uid}`);
}

async function createNotification(uid, title, message, type) {
  await db.collection('notifications').doc(uid).collection('items').add({
    title, message, type, read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

// ── Job 1: Mark expired subscriptions as expired ─────────────────────────────
async function expireSubscriptions() {
  const now = admin.firestore.Timestamp.now();

  const snap = await db.collection('users')
    .where('subscriptionStatus', '==', 'active')
    .where('expiresAt', '<=', now)
    .get();

  console.log(`[expireSubscriptions] Found ${snap.size} users to expire`);
  if (snap.empty) return;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    if (data.premiumGranted === true) continue;  // owner — never expire
    if (data.plan === 'lifetime') continue;       // lifetime — never expire
    if (!data.expiresAt) continue;

    try {
      await docSnap.ref.set(
        { subscriptionStatus: 'expired', updatedAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true },
      );
      await createNotification(
        docSnap.id,
        'Subscription expired',
        'Premium features are locked. Data deletion in 30 days if you do not subscribe.',
        'warning',
      );
      console.log(`[expireSubscriptions] Expired uid: ${docSnap.id}`);
    } catch (err) {
      console.error(`[expireSubscriptions] Failed for uid ${docSnap.id}:`, err.message);
    }
  }
}

// ── Job 2: Delete users past their grace period ───────────────────────────────
async function deleteExpiredUsers() {
  const now = admin.firestore.Timestamp.now();

  const snap = await db.collection('users')
    .where('subscriptionStatus', '==', 'expired')
    .where('gracePeriodEnd', '<=', now)
    .get();

  console.log(`[deleteExpiredUsers] Found ${snap.size} users past grace period`);
  if (snap.empty) return;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    if (data.premiumGranted === true) continue;
    try {
      await deleteAllUserData(docSnap.id);
    } catch (err) {
      console.error(`[deleteExpiredUsers] Failed for uid ${docSnap.id}:`, err.message);
    }
  }
}

// ── Run both jobs ─────────────────────────────────────────────────────────────
async function main() {
  try {
    console.log('=== FinTrackly Subscription Maintenance ===');
    console.log('Time:', new Date().toISOString());

    await expireSubscriptions();
    await deleteExpiredUsers();

    console.log('=== Done ===');
    process.exit(0);
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
}

main();
