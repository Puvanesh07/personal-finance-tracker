// scripts/send-report.js
// FinTrackly Monthly Report — runs via GitHub Actions
// No Firebase Blaze needed — uses Firebase Admin SDK (read-only Firestore)

const admin = require('firebase-admin');
const { Resend } = require('resend');

// ── Init Firebase Admin ───────────────────────────────────────────────────────
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  }),
});
const db = admin.firestore();

// ── Init Resend ───────────────────────────────────────────────────────────────
const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.FROM_EMAIL || 'reports@fintrackly.in';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n) => '₹' + Math.abs(Math.round(n)).toLocaleString('en-IN');

function lastMonth() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 7);
}

function lastMonthLabel() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
}

async function fetchCol(uid, col) {
  try {
    const snap = await db.collection('users').doc(uid).collection(col).get();
    return snap.docs.map((d) => d.data());
  } catch {
    return [];
  }
}

// ── HTML Helpers ──────────────────────────────────────────────────────────────
function tableRows(data) {
  return data
    .map(
      ([label, value, color]) => `
    <tr>
      <td style="padding:6px 0;color:#94a3b8;font-size:13px">${label}</td>
      <td style="padding:6px 0;text-align:right;font-size:13px;font-weight:600;color:${color}">${value}</td>
    </tr>`,
    )
    .join('');
}

function section(title, color, content) {
  return `
  <div style="margin-bottom:28px">
    <h2 style="color:${color};font-size:15px;margin:0 0 12px;padding-bottom:8px;border-bottom:1px solid #334155">${title}</h2>
    <table style="width:100%;border-collapse:collapse">${content}</table>
  </div>`;
}

function emailTemplate(sections, monthLbl) {
  return `<!DOCTYPE html><html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:28px 16px">
    <div style="background:#1e293b;border:1px solid #22c55e33;border-radius:16px;padding:28px 24px;margin-bottom:20px;text-align:center">
      <div style="font-size:36px;margin-bottom:10px">📊</div>
      <h1 style="color:#f1f5f9;font-size:22px;margin:0 0 6px;font-weight:600">FinTrackly Monthly Report</h1>
      <p style="color:#64748b;font-size:14px;margin:0">${monthLbl}</p>
    </div>
    <div style="background:#1e293b;border:1px solid #334155;border-radius:16px;padding:28px 24px;margin-bottom:20px">
      ${sections.join('')}
    </div>
    <div style="text-align:center;padding:16px 8px">
      <p style="color:#475569;font-size:12px;margin:0 0 4px">FinTrackly — Your personal finance &amp; farm tracker</p>
      <p style="color:#334155;font-size:11px;margin:0">
        <a href="https://finance-tracker-3b842.web.app/settings" style="color:#22c55e;text-decoration:none">Manage account</a>
      </p>
    </div>
  </div>
</body></html>`;
}

// ── Build report for one user ─────────────────────────────────────────────────
async function buildReport(uid) {
  const month = lastMonth();
  const monthLbl = lastMonthLabel();
  const sections = [];

  // 1. Cashflow
  const cashflows = await fetchCol(uid, 'cashflows');
  const mc = cashflows.filter((c) => (c.date || '').startsWith(month));
  if (mc.length > 0) {
    const income = mc
      .filter((c) => c.type === 'income')
      .reduce((s, c) => s + (c.amount || 0), 0);
    const expense = mc
      .filter((c) => c.type === 'expense')
      .reduce((s, c) => s + (c.amount || 0), 0);
    const net = income - expense;
    sections.push(
      section(
        '💰 Cashflow — ' + monthLbl,
        '#22c55e',
        tableRows([
          ['Income', fmt(income), '#22c55e'],
          ['Expenses', fmt(expense), '#ef4444'],
          ['Net Savings', fmt(net), net >= 0 ? '#22c55e' : '#ef4444'],
        ]),
      ),
    );
  }

  // 2. Investments
  const investments = await fetchCol(uid, 'investments');
  if (investments.length > 0) {
    const invested = investments.reduce((s, i) => {
      if (i.type === 'stock') return s + (i.quantity || 0) * (i.buyPrice || 0);
      return s + (i.investedAmount || 0);
    }, 0);
    const current = investments.reduce((s, i) => {
      if (i.type === 'stock')
        return s + (i.quantity || 0) * (i.currentPrice || 0);
      if (i.type === 'mutual_fund') return s + (i.units || 0) * (i.nav || 0);
      return s + (i.investedAmount || 0);
    }, 0);
    const pnl = current - invested;
    sections.push(
      section(
        `📈 Investments (${investments.length} holdings)`,
        '#3b82f6',
        tableRows([
          ['Amount Invested', fmt(invested), '#94a3b8'],
          ['Current Value', fmt(current), '#e2e8f0'],
          [
            'Profit / Loss',
            (pnl >= 0 ? '+' : '') + fmt(pnl),
            pnl >= 0 ? '#22c55e' : '#ef4444',
          ],
        ]),
      ),
    );
  }

  // 3. Liabilities
  const liabilities = await fetchCol(uid, 'liabilities');
  if (liabilities.length > 0) {
    const outstanding = liabilities.reduce(
      (s, l) => s + (l.outstanding || 0),
      0,
    );
    sections.push(
      section(
        `🏦 Liabilities (${liabilities.length} loans)`,
        '#ef4444',
        tableRows([['Total Outstanding', fmt(outstanding), '#ef4444']]),
      ),
    );
  }

  // 4. Accounts
  const accounts = await fetchCol(uid, 'accounts');
  if (accounts.length > 0) {
    const totalBal = accounts.reduce((s, a) => s + (a.balance || 0), 0);
    const accRows = accounts
      .slice(0, 5)
      .map((a) => [a.name || 'Account', fmt(a.balance || 0), '#e2e8f0']);
    accRows.push(['Total Balance', fmt(totalBal), '#a78bfa']);
    sections.push(
      section(
        `🏧 Accounts (${accounts.length})`,
        '#a78bfa',
        tableRows(accRows),
      ),
    );
  }

  // 5. Goals + Emergency Fund
  const goals = await fetchCol(uid, 'goals');
  if (goals.length > 0) {
    const goalRows = goals.slice(0, 6).map((g) => {
      const pct =
        g.targetAmount > 0
          ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100))
          : 0;
      return [
        `${g.name || 'Goal'} (${pct}%)`,
        `${fmt(g.currentAmount)} / ${fmt(g.targetAmount)}`,
        pct >= 80 ? '#22c55e' : '#f59e0b',
      ];
    });
    sections.push(section('🎯 Goals', '#f59e0b', tableRows(goalRows)));

    const ef = goals.find((g) =>
      (g.name || '').toLowerCase().includes('emergency'),
    );
    if (ef) {
      const pct =
        ef.targetAmount > 0
          ? Math.min(
              100,
              Math.round((ef.currentAmount / ef.targetAmount) * 100),
            )
          : 0;
      sections.push(
        section(
          '🛡️ Emergency Fund',
          '#14b8a6',
          tableRows([
            ['Saved', fmt(ef.currentAmount), '#14b8a6'],
            ['Target', fmt(ef.targetAmount), '#94a3b8'],
            [
              'Progress',
              `${pct}%`,
              pct >= 100 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444',
            ],
          ]),
        ),
      );
    }
  }

  // 6. Agriculture
  const [crops, agriExp, milk, livestock, coconut] = await Promise.all([
    fetchCol(uid, 'agriCropCycles'),
    fetchCol(uid, 'agriExpenses'),
    fetchCol(uid, 'agriMilkRecords'),
    fetchCol(uid, 'agriLivestockEvents'),
    fetchCol(uid, 'agriCoconut'),
  ]);
  if (crops.length || milk.length || agriExp.length || coconut.length) {
    const cropIncome = crops.reduce((s, c) => s + (c.harvestIncome || 0), 0);
    const farmExp = agriExp
      .filter((e) => (e.date || '').startsWith(month))
      .reduce((s, e) => s + (e.amount || 0), 0);
    const milkMonth = milk.filter((m) => (m.date || '').startsWith(month));
    const milkLiters = milkMonth.reduce((s, m) => s + (m.liters || 0), 0);
    const milkIncome = milkMonth.reduce(
      (s, m) => s + (m.liters || 0) * (m.pricePerLiter || 0),
      0,
    );
    const cocIncome = coconut
      .filter((c) => (c.date || '').startsWith(month))
      .reduce((s, c) => s + (c.harvestIncome || 0), 0);
    const animals = ['goat', 'cow', 'buffalo', 'sheep', 'poultry'].reduce(
      (total, type) => {
        const cnt = livestock
          .filter((e) => e.animalType === type)
          .reduce((n, e) => {
            if (e.eventType === 'purchase' || e.eventType === 'birth')
              return n + (e.count || 0);
            if (e.eventType === 'sale' || e.eventType === 'death')
              return n - (e.count || 0);
            return n;
          }, 0);
        return total + Math.max(0, cnt);
      },
      0,
    );
    const agriRows = [];
    if (cropIncome > 0)
      agriRows.push(['Crop Income (total)', fmt(cropIncome), '#22c55e']);
    if (farmExp > 0)
      agriRows.push(['Farm Expenses (month)', fmt(farmExp), '#ef4444']);
    if (milkLiters > 0)
      agriRows.push([
        `Milk (${milkLiters.toFixed(1)} L)`,
        fmt(milkIncome),
        '#14b8a6',
      ]);
    if (cocIncome > 0)
      agriRows.push(['Coconut Income', fmt(cocIncome), '#f59e0b']);
    if (animals > 0)
      agriRows.push(['Livestock', `${animals} animals`, '#94a3b8']);
    if (agriRows.length)
      sections.push(section('🌾 Agriculture', '#4ade80', tableRows(agriRows)));
  }

  // 7. Farm Workers / Attendance
  const [emps, attRecs, attTxns, salRecs] = await Promise.all([
    fetchCol(uid, 'attEmployees'),
    fetchCol(uid, 'attRecords'),
    fetchCol(uid, 'attTransactions'),
    fetchCol(uid, 'attSalary'),
  ]);
  if (emps.length > 0) {
    const monthAtt = attRecs.filter((r) => (r.date || '').startsWith(month));
    const present = monthAtt.filter((r) => r.present).length;
    const wages = monthAtt.reduce(
      (s, r) => s + (r.present ? (r.wage || 0) + (r.extraWork || 0) : 0),
      0,
    );
    const advances = attTxns
      .filter((t) => t.type === 'advance' && (t.date || '').startsWith(month))
      .reduce((s, t) => s + (t.amount || 0), 0);
    const unpaid = salRecs.filter(
      (s) => s.month === month && s.paymentStatus !== 'paid',
    ).length;
    const wRows = [
      ['Total Workers', `${emps.length}`, '#e2e8f0'],
      ['Days Worked (Month)', `${present}`, '#22c55e'],
      ['Wages Payable', fmt(wages), '#22c55e'],
    ];
    if (advances > 0) wRows.push(['Advances Given', fmt(advances), '#f59e0b']);
    if (unpaid > 0)
      wRows.push(['Pending Salary', `${unpaid} workers`, '#ef4444']);
    sections.push(
      section('👷 Farm Workers — ' + monthLbl, '#60a5fa', tableRows(wRows)),
    );
  }

  if (sections.length === 0) return null;
  return emailTemplate(sections, monthLbl);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(
    '[FinTrackly] Monthly report job started —',
    new Date().toISOString(),
  );

  const testEmail = process.env.TEST_EMAIL;

  if (testEmail) {
    // Test mode — send to one specific email
    console.log(`[Test mode] Sending to ${testEmail} only`);
    try {
      const user = await admin.auth().getUserByEmail(testEmail);
      const html = await buildReport(user.uid);
      if (!html) {
        console.log('No data found for this user — email not sent');
        process.exit(0);
      }
      await resend.emails.send({
        from: FROM,
        to: testEmail,
        subject: `📊 FinTrackly Monthly Report — ${lastMonthLabel()} (Test)`,
        html,
      });
      console.log(`✓ Test report sent to ${testEmail}`);
    } catch (err) {
      console.error('Failed:', err.message);
      process.exit(1);
    }
    process.exit(0);
  }

  // Production mode — send to all users
  let users = [];
  let pageToken;
  do {
    const result = await admin.auth().listUsers(1000, pageToken);
    users = users.concat(result.users);
    pageToken = result.pageToken;
  } while (pageToken);

  console.log(`Processing ${users.length} users`);

  let sent = 0,
    skipped = 0,
    errors = 0;

  for (const user of users) {
    if (!user.email) {
      skipped++;
      continue;
    }
    try {
      const html = await buildReport(user.uid);
      if (!html) {
        console.log(`  skip ${user.email} — no data`);
        skipped++;
        continue;
      }
      await resend.emails.send({
        from: FROM,
        to: user.email,
        subject: `📊 Your FinTrackly Monthly Report — ${lastMonthLabel()}`,
        html,
      });
      console.log(`  ✓ sent to ${user.email}`);
      sent++;
      // 600ms delay — stay within Resend rate limit (2 req/sec)
      await new Promise((r) => setTimeout(r, 600));
    } catch (err) {
      console.error(`  ✗ failed for ${user.email}:`, err.message);
      errors++;
    }
  }

  console.log(`\nDone — Sent: ${sent}, Skipped: ${skipped}, Errors: ${errors}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
