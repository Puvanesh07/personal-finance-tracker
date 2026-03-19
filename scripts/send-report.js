// scripts/send-report.js
// FinTrackly Monthly Report — GitHub Actions
// Uses Gmail + Nodemailer — completely free, no domain needed

const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

// ── Init Firebase ─────────────────────────────────────────────────────────────
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  }),
});
const db = admin.firestore();

// ── Init Gmail transporter ────────────────────────────────────────────────────
function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS, // 16-char App Password (not your Gmail login password)
    },
  });
}

const FROM_NAME = 'FinTrackly Reports';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n) => '₹' + Math.abs(Math.round(n || 0)).toLocaleString('en-IN');

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function currentMonthLabel() {
  return new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' });
}

async function fetchCol(uid, col) {
  try {
    const snap = await db.collection('users').doc(uid).collection(col).get();
    console.log(`    ${col}: ${snap.docs.length} docs`);
    return snap.docs.map((d) => d.data());
  } catch (err) {
    console.error(`    ${col} ERROR:`, err.message);
    return [];
  }
}

// ── HTML helpers ──────────────────────────────────────────────────────────────
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
      <p style="color:#475569;font-size:12px;margin:0 0 4px">FinTrackly — Your personal finance and farm tracker</p>
      <p style="color:#334155;font-size:11px;margin:0">
        <a href="https://finance-tracker-3b842.web.app/settings" style="color:#22c55e;text-decoration:none">Manage account</a>
      </p>
    </div>
  </div>
</body></html>`;
}

// ── Build report for one user ─────────────────────────────────────────────────
async function buildReport(uid) {
  const month = currentMonth();
  const monthLbl = currentMonthLabel();
  const sections = [];

  console.log(`  Building report — uid: ${uid}, month: ${month}`);

  // 1. Cashflow
  const cashflows = await fetchCol(uid, 'cashflows');
  if (cashflows.length > 0) {
    const mc = cashflows.filter((c) => (c.date || '').startsWith(month));
    const mIncome = mc
      .filter((c) => c.type === 'income')
      .reduce((s, c) => s + (c.amount || 0), 0);
    const mExpense = mc
      .filter((c) => c.type === 'expense')
      .reduce((s, c) => s + (c.amount || 0), 0);
    const net = mIncome - mExpense;
    const allInc = cashflows
      .filter((c) => c.type === 'income')
      .reduce((s, c) => s + (c.amount || 0), 0);
    const allExp = cashflows
      .filter((c) => c.type === 'expense')
      .reduce((s, c) => s + (c.amount || 0), 0);
    const rows = [];
    if (mc.length > 0) {
      rows.push(['This Month Income', fmt(mIncome), '#22c55e']);
      rows.push(['This Month Expenses', fmt(mExpense), '#ef4444']);
      rows.push(['Net Savings', fmt(net), net >= 0 ? '#22c55e' : '#ef4444']);
    }
    rows.push(['Total Income (all time)', fmt(allInc), '#64748b']);
    rows.push(['Total Expense (all time)', fmt(allExp), '#64748b']);
    sections.push(
      section('💰 Cashflow — ' + monthLbl, '#22c55e', tableRows(rows)),
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
    const principal = liabilities.reduce((s, l) => s + (l.principal || 0), 0);
    sections.push(
      section(
        `🏦 Liabilities (${liabilities.length} loans)`,
        '#ef4444',
        tableRows([
          ['Total Principal', fmt(principal), '#94a3b8'],
          ['Total Outstanding', fmt(outstanding), '#ef4444'],
          ['Paid Off', fmt(principal - outstanding), '#22c55e'],
        ]),
      ),
    );
  }

  // 4. Accounts
  const accounts = await fetchCol(uid, 'accounts');
  if (accounts.length > 0) {
    const totalBal = accounts.reduce((s, a) => s + (a.balance || 0), 0);
    const accRows = accounts
      .slice(0, 6)
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
        `${g.name || 'Goal'} — ${pct}%`,
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
  if (crops.length || milk.length || coconut.length || livestock.length) {
    const cropIncome = crops.reduce((s, c) => s + (c.harvestIncome || 0), 0);
    const allFarmExp = agriExp.reduce((s, e) => s + (e.amount || 0), 0);
    const milkMonth = milk.filter((m) => (m.date || '').startsWith(month));
    const milkLiters = milkMonth.reduce((s, m) => s + (m.liters || 0), 0);
    const milkIncome = milkMonth.reduce(
      (s, m) => s + (m.liters || 0) * (m.pricePerLiter || 0),
      0,
    );
    const allMilkInc = milk.reduce(
      (s, m) => s + (m.liters || 0) * (m.pricePerLiter || 0),
      0,
    );
    const cocIncome = coconut.reduce((s, c) => s + (c.harvestIncome || 0), 0);
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
    if (allFarmExp > 0)
      agriRows.push(['Farm Expenses (total)', fmt(allFarmExp), '#ef4444']);
    if (milkLiters > 0)
      agriRows.push([
        `Milk This Month (${milkLiters.toFixed(1)} L)`,
        fmt(milkIncome),
        '#14b8a6',
      ]);
    if (allMilkInc > 0)
      agriRows.push(['Milk Income (all time)', fmt(allMilkInc), '#64748b']);
    if (cocIncome > 0)
      agriRows.push(['Coconut Income (total)', fmt(cocIncome), '#f59e0b']);
    if (animals > 0)
      agriRows.push(['Current Livestock', `${animals} animals`, '#94a3b8']);
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
    const allAdv = attTxns
      .filter((t) => t.type === 'advance')
      .reduce((s, t) => s + (t.amount || 0), 0);
    const unpaid = salRecs.filter(
      (s) => s.month === month && s.paymentStatus !== 'paid',
    ).length;
    const wRows = [
      ['Total Workers', `${emps.length}`, '#e2e8f0'],
      ['Days Worked This Month', `${present}`, '#22c55e'],
      ['Wages This Month', fmt(wages), '#22c55e'],
    ];
    if (advances > 0)
      wRows.push(['Advances This Month', fmt(advances), '#f59e0b']);
    if (allAdv > 0)
      wRows.push(['Total Advances Given', fmt(allAdv), '#64748b']);
    if (unpaid > 0)
      wRows.push(['Pending Salary', `${unpaid} workers`, '#ef4444']);
    sections.push(
      section('👷 Farm Workers — ' + monthLbl, '#60a5fa', tableRows(wRows)),
    );
  }

  // 8. Insurance Policies
  const insurancePolicies = await fetchCol(uid, 'insurancePolicies');
  if (insurancePolicies.length > 0) {
    const totalCoverage = insurancePolicies.reduce(
      (s, p) => s + (p.coverageAmount || 0),
      0,
    );
    const totalYearlyPremium = insurancePolicies.reduce((s, p) => {
      return (
        s +
        (p.premiumFrequency === 'monthly'
          ? (p.premiumAmount || 0) * 12
          : p.premiumAmount || 0)
      );
    }, 0);
    const expiringSoon = insurancePolicies.filter((p) => {
      if (!p.renewalDate) return false;
      const renewal = new Date(p.renewalDate);
      const today = new Date();
      const diffDays = Math.ceil((renewal - today) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 30;
    });
    const expired = insurancePolicies.filter(
      (p) => p.renewalDate && new Date(p.renewalDate) < new Date(),
    );

    const insRows = [
      ['Total Policies', `${insurancePolicies.length}`, '#e2e8f0'],
      ['Total Coverage', fmt(totalCoverage), '#a78bfa'],
      ['Yearly Premium', fmt(totalYearlyPremium), '#94a3b8'],
    ];
    if (expiringSoon.length > 0)
      insRows.push([
        `⏰ Renewing Soon`,
        `${expiringSoon.length} policy`,
        '#f59e0b',
      ]);
    if (expired.length > 0)
      insRows.push([
        `⚠ Expired Policies`,
        `${expired.length} policy`,
        '#ef4444',
      ]);

    // Top policies
    insurancePolicies.slice(0, 4).forEach((p) => {
      insRows.push([
        `${p.type?.toUpperCase() || 'POLICY'} — ${p.policyName || p.provider || ''}`,
        fmt(p.coverageAmount || 0),
        '#cbd5e1',
      ]);
    });

    sections.push(
      section(
        `🛡 Insurance (${insurancePolicies.length} policies)`,
        '#a78bfa',
        tableRows(insRows),
      ),
    );
  }

  // 9. Monthly SIP Plan
  const sipPlanDocs = await fetchCol(uid, 'sipPlans');
  if (sipPlanDocs.length > 0) {
    const budgetDoc = sipPlanDocs.find((d) => d.type === 'budget');
    const instruments = sipPlanDocs.filter((d) => d.type === 'instrument');
    const budget = budgetDoc?.budget || 0;
    const totalPct = instruments.reduce((s, i) => s + (i.percentage || 0), 0);
    const allocatedAmt = budget > 0 ? (budget * totalPct) / 100 : 0;

    if (budget > 0 || instruments.length > 0) {
      const sipRows = [];
      if (budget > 0) sipRows.push(['Monthly Budget', fmt(budget), '#22c55e']);
      if (instruments.length > 0)
        sipRows.push(['Instruments', `${instruments.length}`, '#e2e8f0']);
      if (budget > 0)
        sipRows.push(['Allocated Amount', fmt(allocatedAmt), '#22c55e']);
      if (totalPct > 0)
        sipRows.push([
          `Allocation`,
          `${totalPct.toFixed(0)}%`,
          totalPct > 100 ? '#ef4444' : '#22c55e',
        ]);

      instruments.slice(0, 6).forEach((inst) => {
        const amt = budget > 0 ? (budget * (inst.percentage || 0)) / 100 : 0;
        sipRows.push([
          `${inst.name || 'Instrument'} (${inst.percentage || 0}%)`,
          budget > 0 ? fmt(amt) : `${inst.percentage || 0}%`,
          '#94a3b8',
        ]);
      });

      sections.push(
        section('📅 Monthly SIP Plan', '#06b6d4', tableRows(sipRows)),
      );
    }
  }

  // If no data at all — send a basic welcome email
  if (sections.length === 0) {
    sections.push(`
    <div style="text-align:center;padding:20px">
      <div style="font-size:32px;margin-bottom:12px">👋</div>
      <p style="color:#94a3b8;font-size:14px;margin:0">
        Your FinTrackly account is active.<br>
        Start adding data to see your monthly summary here.
      </p>
    </div>`);
  }

  return emailTemplate(sections, monthLbl);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== FinTrackly Monthly Report ===');
  console.log('Time:', new Date().toISOString());
  console.log('Gmail:', process.env.GMAIL_USER);

  // Validate required env vars
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

  // Verify Gmail connection before starting
  try {
    await transporter.verify();
    console.log('Gmail connection verified ✓');
  } catch (err) {
    console.error('Gmail connection FAILED:', err.message);
    console.error('Check GMAIL_USER and GMAIL_PASS secrets');
    process.exit(1);
  }

  const testEmail = process.env.TEST_EMAIL;

  if (testEmail) {
    console.log(`\nTest mode — sending to: ${testEmail}`);
    try {
      const user = await admin.auth().getUserByEmail(testEmail);
      console.log(`Found user uid: ${user.uid}`);
      const html = await buildReport(user.uid);
      console.log('Report built ✓');

      const info = await transporter.sendMail({
        from: `"${FROM_NAME}" <${process.env.GMAIL_USER}>`,
        to: testEmail,
        subject: `📊 FinTrackly Monthly Report — ${currentMonthLabel()} (Test)`,
        html,
      });
      console.log('Message sent:', info.messageId);
      console.log(`\n✓ Test email sent to ${testEmail}`);
    } catch (err) {
      console.error('\nERROR:', err.message);
      console.error(err.stack);
      process.exit(1);
    }
    process.exit(0);
  }

  // Production — all users
  let users = [];
  let pageToken;
  do {
    const result = await admin.auth().listUsers(1000, pageToken);
    users = users.concat(result.users);
    pageToken = result.pageToken;
  } while (pageToken);

  console.log(`\nFound ${users.length} users`);
  let sent = 0,
    errors = 0;

  for (const user of users) {
    if (!user.email) continue;
    try {
      const html = await buildReport(user.uid);
      await transporter.sendMail({
        from: `"${FROM_NAME}" <${process.env.GMAIL_USER}>`,
        to: user.email,
        subject: `📊 Your FinTrackly Monthly Report — ${currentMonthLabel()}`,
        html,
      });
      console.log(`✓ sent → ${user.email}`);
      sent++;
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      console.error(`✗ failed → ${user.email}:`, err.message);
      errors++;
    }
  }

  console.log(`\nDone — Sent: ${sent}, Errors: ${errors}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  console.error(err.stack);
  process.exit(1);
});
