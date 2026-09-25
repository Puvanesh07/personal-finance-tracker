/**
 * Make the Gen2 callable Cloud Run services publicly invocable.
 *
 * Why public at all: a browser OPTIONS preflight to a Callable carries no
 * Firebase Auth header, so Cloud Run IAM must allow `allUsers` or every call
 * fails before your code runs. The real access control is therefore IN CODE —
 * every service below must reject a request with no `request.auth`, and the
 * owner-only ones must additionally check the email. That invariant is why
 * adding a service here without an auth guard is not acceptable.
 *
 * `razorpayWebhook` is also public by necessity (Razorpay cannot send a Firebase
 * token); it authenticates with the HMAC in the x-razorpay-signature header.
 */
import fs from 'fs';
import path from 'path';

const PROJECT = process.env.FIREBASE_PROJECT_ID || 'finance-tracker-3b842';
const REGION = 'asia-south1';

// Keep in sync with the exports in functions/src/index.ts.
const SERVICES = [
  'createrazorpayorder',
  'initiateupicollect',
  'confirmupipayment',
  'verifyrazorpaypayment',
  'restorepurchase',
  'adminmanagesubscription',
  'razorpaywebhook',
];

// Services that no longer exist. Listing them used to log a FAIL line for each
// one on every deploy run, which made the real failures invisible.
const REMOVED = ['initializetrialifmissing', 'simulatetestsubscription', 'resettestsubscription'];

async function main() {
  if (REMOVED.some((s) => SERVICES.includes(s))) {
    throw new Error('A removed function is still listed in SERVICES');
  }

  const cfgPath = path.join(
    process.env.USERPROFILE || process.env.HOME || '',
    '.config',
    'configstore',
    'firebase-tools.json',
  );
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  const token = cfg.tokens?.access_token;
  if (!token) throw new Error('No Firebase access token. Run firebase login.');

  for (const service of SERVICES) {
    const url = `https://run.googleapis.com/v1/projects/${PROJECT}/locations/${REGION}/services/${service}:setIamPolicy`;
    const body = {
      policy: {
        bindings: [
          {
            role: 'roles/run.invoker',
            members: ['allUsers'],
          },
        ],
      },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    if (!res.ok) {
      console.error(`FAIL ${service}: ${res.status} ${text.slice(0, 500)}`);
    } else {
      console.log(`OK   ${service}: public invoker set`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
