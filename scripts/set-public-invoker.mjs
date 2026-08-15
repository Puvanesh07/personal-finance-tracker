/**
 * Make all Gen2 callable Cloud Run services publicly invocable.
 * Required so browser OPTIONS preflight (no auth header) succeeds.
 */
import fs from 'fs';
import path from 'path';

const PROJECT = 'finance-tracker-3b842';
const REGION = 'asia-south1';

const SERVICES = [
  'createrazorpayorder',
  'adminmanagesubscription',
  'initializetrialifmissing',
  'initiateupicollect',
  'confirmupipayment',
  'verifyrazorpaypayment',
  'restorepurchase',
  'simulatetestsubscription',
  'resettestsubscription',
];

async function main() {
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
