// scripts/send-report.js
// FinTrackly Monthly Report — GitHub Actions
// Sends HTML report + JSON backup + CSV ZIP as email attachments

const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const { webcrypto } = require('crypto');
const JSZip = require('jszip');

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

function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
  });
}
const FROM_NAME = 'FinTrackly Reports';

// ── Encryption (mirrors encryptionService.ts) ─────────────────────────────────
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
const fmt = (n) => '₹' + Math.abs(Math.round(n || 0)).toLocaleString('en-IN');
const currentMonth = () => new Date().toISOString().slice(0, 7);
const currentMonthLabel = () =>
  new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' });
const dateStr = () => new Date().toISOString().split('T')[0];

async function fetchCol(uid, col) {
  try {
    const snap = await db.collection('users').doc(uid).collection(col).get();
    const docs = await Promise.all(
      snap.docs.map((d) => decryptDoc(uid, d.data())),
    );
    const valid = docs.filter(Boolean);
    console.log(
      `    ${col}: ${snap.docs.length} docs (${valid.length} readable)`,
    );
    return valid;
  } catch (err) {
    console.error(`    ${col} ERROR:`, err.message);
    return [];
  }
}

// ── CSV Builder ───────────────────────────────────────────────────────────────
function toCSV(data) {
  if (!data || data.length === 0) return '';
  const headers = Object.keys(data[0]);
  const escape = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return (
    [
      headers.join(','),
      ...data.map((row) => headers.map((h) => escape(row[h])).join(',')),
    ].join('\n') + '\n'
  );
}

function buildCSVAttachments(allData) {
  const {
    investments = [],
    soldTrades = [],
    liabilities = [],
    cashflows = [],
    goals = [],
    accounts = [],
    insurancePolicies = [],
    lendingBorrowers = [],
    lendingTransactions = [],
    agriFields = [],
    agriCropCycles = [],
    agriExpenses = [],
    agriMilkRecords = [],
    agriCoconut = [],
    agriLivestockEvents = [],
    agriProduceSales = [],
    attEmployees = [],
    attRecords = [],
    attTransactions = [],
    attSalary = [],
  } = allData;

  const files = [];
  const accountMap = {};
  accounts.forEach((a) => {
    accountMap[a.id] = a.name;
  });
  const empMap = {};
  attEmployees.forEach((e) => {
    empMap[e.id] = e.name;
  });
  const bMap = {};
  lendingBorrowers.forEach((b) => {
    bMap[b.id] = b.name;
  });

  if (investments.length) {
    files.push({
      name: 'investments.csv',
      csv: toCSV(
        investments.map((i) => ({
          Type: i.type,
          Name: i.name,
          Symbol: i.symbol ?? '',
          Platform: i.platform ?? '',
          'Quantity / Units': i.quantity ?? i.units ?? '',
          'Buy Price / NAV': i.buyPrice ?? i.nav ?? '',
          'Current Price': i.currentPrice ?? '',
          'Invested Amount':
            i.investedAmount ?? (i.quantity ?? 0) * (i.buyPrice ?? 0),
          'Current Value':
            i.type === 'stock'
              ? (i.quantity ?? 0) * (i.currentPrice ?? i.buyPrice ?? 0)
              : i.type === 'mutual_fund'
                ? (i.units ?? 0) * (i.nav ?? 0)
                : (i.currentValue ?? i.investedAmount ?? ''),
          Notes: i.notes ?? '',
        })),
      ),
    });
  }

  if (soldTrades.length) {
    files.push({
      name: 'profits.csv',
      csv: toCSV(
        soldTrades.map((t) => ({
          'Asset Name': t.investmentName,
          Type: t.investmentType,
          Symbol: t.symbol ?? '',
          Platform: t.platform ?? '',
          Quantity: t.quantity ?? '',
          'Buy Cost (₹)': t.buyPrice,
          'Sell Value (₹)': t.sellPrice,
          'Profit/Loss (₹)': t.profit,
          'Return %': t.profitPct?.toFixed(2) ?? '',
          'Sale Date': t.soldDate,
          Notes: t.notes ?? '',
        })),
      ),
    });
  }

  if (cashflows.length) {
    files.push({
      name: 'cashflows.csv',
      csv: toCSV(
        cashflows.map((cf) => ({
          Date: cf.date,
          Type: cf.type,
          Category: cf.category,
          Account: cf.accountId
            ? (accountMap[cf.accountId] ?? cf.accountId)
            : '',
          Amount: cf.amount,
          Notes: cf.notes ?? '',
        })),
      ),
    });
  }

  if (liabilities.length) {
    files.push({
      name: 'liabilities.csv',
      csv: toCSV(
        liabilities.map((l) => ({
          Name: l.name,
          Type: l.type,
          Principal: l.principal,
          Outstanding: l.outstanding,
          'Interest Rate': l.interestRate ?? '',
          'Start Date': l.startDate ?? '',
          'End Date': l.endDate ?? '',
        })),
      ),
    });
  }

  if (goals.length) {
    files.push({
      name: 'goals.csv',
      csv: toCSV(
        goals.map((g) => ({
          Name: g.name,
          'Target Amount': g.targetAmount,
          'Current Amount': g.currentAmount,
          Progress:
            g.targetAmount > 0
              ? `${Math.round((g.currentAmount / g.targetAmount) * 100)}%`
              : '0%',
          'Due Date': g.dueDate ?? '',
        })),
      ),
    });
  }

  if (accounts.length) {
    files.push({
      name: 'accounts.csv',
      csv: toCSV(
        accounts.map((a) => ({
          Name: a.name,
          Type: a.type,
          Balance: a.balance,
        })),
      ),
    });
  }

  if (insurancePolicies.length) {
    files.push({
      name: 'insurance-policies.csv',
      csv: toCSV(
        insurancePolicies.map((p) => ({
          Type: p.type,
          Provider: p.provider,
          'Policy Name': p.policyName,
          'Coverage Amount': p.coverageAmount,
          'Premium Amount': p.premiumAmount,
          'Premium Frequency': p.premiumFrequency,
          'Renewal Date': p.renewalDate ?? '',
          'Policy Number': p.policyNumber ?? '',
          Nominee: p.nominee ?? '',
        })),
      ),
    });
  }

  if (lendingBorrowers.length) {
    files.push({
      name: 'lending-borrowers.csv',
      csv: toCSV(
        lendingBorrowers.map((b) => ({
          Name: b.name,
          Phone: b.phone ?? '',
          Status: b.status,
          'Interest Rate (%)': b.interestRate ?? '',
          'Due Date': b.nextDueDate ?? '',
        })),
      ),
    });
  }
  if (lendingTransactions.length) {
    files.push({
      name: 'lending-transactions.csv',
      csv: toCSV(
        lendingTransactions.map((tx) => ({
          Date: tx.date,
          Borrower: bMap[tx.borrowerId] || 'Unknown',
          Type: tx.type,
          Amount: tx.amount,
          Notes: tx.notes ?? '',
        })),
      ),
    });
  }

  // Agriculture
  if (agriFields.length) {
    files.push({
      name: 'agri-fields.csv',
      csv: toCSV(
        agriFields.map((f) => ({
          Name: f.name,
          'Area (Acres)': f.areAcres,
          Location: f.location ?? '',
          'Soil Type': f.soilType ?? '',
        })),
      ),
    });
  }
  if (agriCropCycles.length) {
    files.push({
      name: 'agri-crops.csv',
      csv: toCSV(
        agriCropCycles.map((c) => ({
          'Crop Name': c.cropName,
          Field: c.fieldName ?? '',
          Season: c.season,
          'Start Date': c.startDate,
          'Harvest Date': c.actualHarvestDate ?? c.expectedHarvestDate ?? '',
          'Invested Amount': c.investedAmount,
          'Harvest Income': c.harvestIncome,
          'Profit/Loss': (c.harvestIncome || 0) - (c.investedAmount || 0),
          Notes: c.notes ?? '',
        })),
      ),
    });
  }
  if (agriExpenses.length) {
    files.push({
      name: 'agri-expenses.csv',
      csv: toCSV(
        agriExpenses.map((e) => ({
          Date: e.date,
          Category: e.category,
          Amount: e.amount,
          Notes: e.notes ?? '',
        })),
      ),
    });
  }
  if (agriMilkRecords.length) {
    files.push({
      name: 'agri-milk.csv',
      csv: toCSV(
        agriMilkRecords.map((m) => ({
          Date: m.date,
          Liters: m.liters,
          'Price/Liter': m.pricePerLiter,
          Income: (m.liters || 0) * (m.pricePerLiter || 0),
          'Sold To': m.soldTo ?? '',
        })),
      ),
    });
  }
  if (agriCoconut.length) {
    files.push({
      name: 'agri-coconut.csv',
      csv: toCSV(
        agriCoconut.map((c) => ({
          Date: c.date,
          Trees: c.numberOfTrees,
          'Total Coconuts': c.totalCoconuts,
          'Sell Method': c.sellMethod,
          'Price/Coconut': c.pricePerCoconut ?? '',
          Income: c.harvestIncome,
          Investment: c.investmentAmount,
          Profit: (c.harvestIncome || 0) - (c.investmentAmount || 0),
          Notes: c.notes ?? '',
        })),
      ),
    });
  }
  if (agriProduceSales.length) {
    files.push({
      name: 'agri-produce-sales.csv',
      csv: toCSV(
        agriProduceSales.map((p) => ({
          Date: p.date,
          'Produce Name': p.produceName,
          Category: p.category,
          Unit: p.unit,
          Quantity: p.quantity,
          'Price/Unit': p.pricePerUnit,
          Commission: p.commissionAmount ?? 0,
          'Total Amount': p.totalAmount,
          'Sold To': p.soldTo ?? '',
          Notes: p.notes ?? '',
        })),
      ),
    });
  }
  if (agriLivestockEvents.length) {
    files.push({
      name: 'agri-livestock-events.csv',
      csv: toCSV(
        agriLivestockEvents.map((e) => ({
          Date: e.date,
          Animal: e.animalType,
          'Event Type': e.eventType,
          Count: e.count,
          Price: e.price ?? '',
          Notes: e.notes ?? '',
        })),
      ),
    });
  }

  // Attendance
  if (attEmployees.length) {
    files.push({
      name: 'attendance-workers.csv',
      csv: toCSV(
        attEmployees.map((e) => ({
          Name: e.name,
          Phone: e.phone ?? '',
          'Daily Wage (₹)': e.dailyWage,
          Notes: e.notes ?? '',
        })),
      ),
    });
  }
  if (attRecords.length) {
    files.push({
      name: 'attendance-records.csv',
      csv: toCSV(
        attRecords.map((r) => ({
          Date: r.date,
          Worker: empMap[r.employeeId] ?? r.employeeId,
          Present: r.present ? 'Yes' : 'No',
          'Daily Wage (₹)': r.wage,
          'Extra Work (₹)': r.extraWork ?? 0,
          'Total (₹)': r.present ? (r.wage || 0) + (r.extraWork || 0) : 0,
          Note: r.note ?? '',
        })),
      ),
    });
  }
  if (attTransactions.length) {
    files.push({
      name: 'attendance-advances.csv',
      csv: toCSV(
        attTransactions.map((t) => ({
          Date: t.date,
          Worker: empMap[t.employeeId] ?? t.employeeId,
          Type: t.type,
          'Amount (₹)': t.amount,
          Note: t.note ?? '',
        })),
      ),
    });
  }
  if (attSalary.length) {
    files.push({
      name: 'attendance-salary.csv',
      csv: toCSV(
        attSalary.map((s) => ({
          Month: s.month,
          Worker: empMap[s.employeeId] ?? s.employeeId,
          'Days Worked': s.daysWorked,
          'Net Payable (₹)': s.netPayable ?? s.finalSalary,
          Status: s.paymentStatus,
        })),
      ),
    });
  }

  return files;
}

async function buildCSVZip(allData) {
  const files = buildCSVAttachments(allData);
  if (!files.length) return null;
  const zip = new JSZip();
  const folder = zip.folder('fintrackly-data');
  files.forEach(({ name, csv }) => folder.file(name, csv));
  const buf = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  });
  return { buffer: buf, count: files.length };
}

// ── HTML Report Builders ──────────────────────────────────────────────────────
function tableRows(data) {
  return data
    .map(
      ([label, value, color]) =>
        `<tr><td style="padding:6px 0;color:#94a3b8;font-size:13px">${label}</td>` +
        `<td style="padding:6px 0;text-align:right;font-size:13px;font-weight:600;color:${color}">${value}</td></tr>`,
    )
    .join('');
}

function section(title, color, content) {
  return (
    `<div style="margin-bottom:28px">` +
    `<h2 style="color:${color};font-size:15px;margin:0 0 12px;padding-bottom:8px;border-bottom:1px solid #334155">${title}</h2>` +
    `<table style="width:100%;border-collapse:collapse">${content}</table></div>`
  );
}

function emailTemplate(sections, monthLbl, attachmentSummary) {
  const attachNote = attachmentSummary
    ? `<div style="margin:20px 0;background:#1e3a5f;border:1px solid #3b82f620;border-radius:12px;padding:16px 20px">
        <p style="color:#60a5fa;font-size:13px;font-weight:600;margin:0 0 6px">📎 Attachments included in this email</p>
        <p style="color:#94a3b8;font-size:12px;margin:0">${attachmentSummary}</p>
      </div>`
    : '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<div style="max-width:620px;margin:0 auto;padding:28px 16px">
<div style="background:#1e293b;border:1px solid #22c55e33;border-radius:16px;padding:28px 24px;margin-bottom:20px;text-align:center">
<div style="font-size:36px;margin-bottom:10px">📊</div>
<h1 style="color:#f1f5f9;font-size:22px;margin:0 0 6px;font-weight:600">FinTrackly Monthly Report</h1>
<p style="color:#64748b;font-size:14px;margin:0">${monthLbl}</p>
</div>
${attachNote}
<div style="background:#1e293b;border:1px solid #334155;border-radius:16px;padding:28px 24px;margin-bottom:20px">
${sections.join('<hr style="border:none;border-top:1px solid #1e3a5f;margin:16px 0">')}
</div>
<div style="text-align:center;padding:16px 8px">
<p style="color:#475569;font-size:12px;margin:0 0 8px">FinTrackly — Your personal finance and farm tracker</p>
<p style="color:#334155;font-size:11px;margin:0 0 4px">💡 Save the attached JSON backup to Google Drive or your phone for safekeeping.</p>
<a href="https://finance-tracker-3b842.web.app/settings" style="color:#22c55e;text-decoration:none;font-size:11px">Manage account</a>
</div></div></body></html>`;
}

// ── Build full report HTML + collect all data ─────────────────────────────────
async function buildReportAndData(uid) {
  const month = currentMonth();
  const monthLbl = currentMonthLabel();
  const sections = [];
  console.log(`  Building report — uid: ${uid}, month: ${month}`);

  // Fetch ALL collections
  const [
    cashflows,
    investments,
    soldTrades,
    liabilities,
    accounts,
    goals,
    agriFields,
    agriCropCycles,
    agriExpenses,
    agriMilkRecords,
    agriLivestockEvents,
    agriCoconut,
    agriProduceSales,
    attEmployees,
    attRecords,
    attTransactions,
    attSalary,
    insurancePolicies,
    insurancePayments,
    sipPlanDocs,
    lendingBorrowers,
    lendingTransactions,
  ] = await Promise.all([
    fetchCol(uid, 'cashflows'),
    fetchCol(uid, 'investments'),
    fetchCol(uid, 'soldTrades'),
    fetchCol(uid, 'liabilities'),
    fetchCol(uid, 'accounts'),
    fetchCol(uid, 'goals'),
    fetchCol(uid, 'agriFields'),
    fetchCol(uid, 'agriCropCycles'),
    fetchCol(uid, 'agriExpenses'),
    fetchCol(uid, 'agriMilkRecords'),
    fetchCol(uid, 'agriLivestockEvents'),
    fetchCol(uid, 'agriCoconut'),
    fetchCol(uid, 'agriProduceSales'),
    fetchCol(uid, 'attEmployees'),
    fetchCol(uid, 'attRecords'),
    fetchCol(uid, 'attTransactions'),
    fetchCol(uid, 'attSalary'),
    fetchCol(uid, 'insurancePolicies'),
    fetchCol(uid, 'insurancePayments'),
    fetchCol(uid, 'sipPlans'),
    fetchCol(uid, 'lendingBorrowers'),
    fetchCol(uid, 'lendingTransactions'),
  ]);

  const allData = {
    cashflows,
    investments,
    soldTrades,
    liabilities,
    accounts,
    goals,
    agriFields,
    agriCropCycles,
    agriExpenses,
    agriMilkRecords,
    agriLivestockEvents,
    agriCoconut,
    agriProduceSales,
    attEmployees,
    attRecords,
    attTransactions,
    attSalary,
    insurancePolicies,
    insurancePayments,
    sipPlanDocs,
    lendingBorrowers,
    lendingTransactions,
  };

  // ── 1. Cashflow ────────────────────────────────────────────────────────────
  {
    const mc = cashflows.filter((c) => (c.date || '').startsWith(month));
    const allInc = cashflows
      .filter((c) => c.type === 'income')
      .reduce((s, c) => s + (c.amount || 0), 0);
    const allExp = cashflows
      .filter((c) => c.type === 'expense')
      .reduce((s, c) => s + (c.amount || 0), 0);
    const mIncome = mc
      .filter((c) => c.type === 'income')
      .reduce((s, c) => s + (c.amount || 0), 0);
    const mExpense = mc
      .filter((c) => c.type === 'expense')
      .reduce((s, c) => s + (c.amount || 0), 0);
    const net = mIncome - mExpense;
    const catMap = {};
    mc.filter((c) => c.type === 'expense').forEach((c) => {
      catMap[c.category || 'Other'] =
        (catMap[c.category || 'Other'] || 0) + (c.amount || 0);
    });
    const topCats = Object.entries(catMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    const rows = [];
    if (mc.length > 0) {
      rows.push([`Income — ${monthLbl}`, fmt(mIncome), '#22c55e']);
      rows.push([`Expenses — ${monthLbl}`, fmt(mExpense), '#ef4444']);
      rows.push(['Net Savings', fmt(net), net >= 0 ? '#22c55e' : '#ef4444']);
      if (mIncome > 0)
        rows.push([
          'Savings Rate',
          `${Math.round((net / mIncome) * 100)}%`,
          '#64748b',
        ]);
    }
    rows.push(['Total Income (all time)', fmt(allInc), '#64748b']);
    rows.push(['Total Expense (all time)', fmt(allExp), '#64748b']);
    rows.push([
      'Net (all time)',
      fmt(allInc - allExp),
      allInc - allExp >= 0 ? '#22c55e' : '#ef4444',
    ]);
    if (topCats.length > 0) {
      rows.push(['— Top Expense Categories —', '', '#475569']);
      topCats.forEach(([cat, amt]) =>
        rows.push([`  ${cat}`, fmt(amt), '#f59e0b']),
      );
    }
    if (cashflows.length > 0 || rows.length > 0)
      sections.push(
        section('💰 Cashflow — ' + monthLbl, '#22c55e', tableRows(rows)),
      );
  }

  // ── 2. Investments ─────────────────────────────────────────────────────────
  if (investments.length > 0) {
    const calcInvested = (i) =>
      i.type === 'stock'
        ? (i.quantity || 0) * (i.buyPrice || 0)
        : i.investedAmount || 0;
    const calcCurrent = (i) => {
      if (i.type === 'stock')
        return (i.quantity || 0) * (i.currentPrice || i.buyPrice || 0);
      if (i.type === 'mutual_fund') return (i.units || 0) * (i.nav || 0);
      if (i.type === 'other') return i.currentValue || i.investedAmount || 0;
      return i.investedAmount || 0;
    };
    const totalInvested = investments.reduce((s, i) => s + calcInvested(i), 0);
    const totalCurrent = investments.reduce((s, i) => s + calcCurrent(i), 0);
    const pnl = totalCurrent - totalInvested;
    const pnlPct =
      totalInvested > 0 ? ((pnl / totalInvested) * 100).toFixed(2) : '0';
    const stocks = investments.filter((i) => i.type === 'stock');
    const mfs = investments.filter((i) => i.type === 'mutual_fund');
    const fds = investments.filter((i) => i.type === 'fixed_deposit');
    const bonds = investments.filter((i) => i.type === 'bond');
    const others = investments.filter((i) => i.type === 'other');
    const gainers = stocks
      .map((i) => ({
        name: i.name || i.symbol,
        pnl: calcCurrent(i) - calcInvested(i),
      }))
      .sort((a, b) => b.pnl - a.pnl)
      .slice(0, 3);
    const rows = [
      ['Total Holdings', `${investments.length}`, '#e2e8f0'],
      ['Amount Invested', fmt(totalInvested), '#94a3b8'],
      ['Current Value', fmt(totalCurrent), '#e2e8f0'],
      [
        'Profit / Loss',
        `${pnl >= 0 ? '+' : ''}${fmt(pnl)} (${pnl >= 0 ? '+' : ''}${pnlPct}%)`,
        pnl >= 0 ? '#22c55e' : '#ef4444',
      ],
    ];
    if (stocks.length) rows.push(['Stocks', `${stocks.length}`, '#3b82f6']);
    if (mfs.length) rows.push(['Mutual Funds', `${mfs.length}`, '#8b5cf6']);
    if (fds.length) rows.push(['Fixed Deposits', `${fds.length}`, '#f59e0b']);
    if (bonds.length) rows.push(['Bonds', `${bonds.length}`, '#06b6d4']);
    if (others.length)
      rows.push(['Other Assets', `${others.length}`, '#64748b']);
    if (gainers.length > 0) {
      rows.push(['— Top Stock P&L —', '', '#475569']);
      gainers.forEach((g) =>
        rows.push([
          `  ${g.name}`,
          `${g.pnl >= 0 ? '+' : ''}${fmt(g.pnl)}`,
          g.pnl >= 0 ? '#22c55e' : '#ef4444',
        ]),
      );
    }
    sections.push(
      section(
        `📈 Investments (${investments.length} holdings)`,
        '#3b82f6',
        tableRows(rows),
      ),
    );
  }

  // ── 3. Sold Trades ─────────────────────────────────────────────────────────
  if (soldTrades.length > 0) {
    const realisedPnl = soldTrades.reduce((s, t) => s + (t.profit || 0), 0);
    const monthSold = soldTrades.filter((t) =>
      (t.soldAt || t.updatedAt || '').startsWith(month),
    );
    const monthPnl = monthSold.reduce((s, t) => s + (t.profit || 0), 0);
    const rows = [
      [
        'Total Realised P&L',
        `${realisedPnl >= 0 ? '+' : ''}${fmt(realisedPnl)}`,
        realisedPnl >= 0 ? '#22c55e' : '#ef4444',
      ],
      ['Total Trades Closed', `${soldTrades.length}`, '#e2e8f0'],
    ];
    if (monthSold.length > 0) {
      rows.push([`Closed This Month`, `${monthSold.length}`, '#94a3b8']);
      rows.push([
        `This Month P&L`,
        `${monthPnl >= 0 ? '+' : ''}${fmt(monthPnl)}`,
        monthPnl >= 0 ? '#22c55e' : '#ef4444',
      ]);
    }
    sections.push(section('💹 Realised Profits', '#10b981', tableRows(rows)));
  }

  // ── 4. Liabilities ─────────────────────────────────────────────────────────
  if (liabilities.length > 0) {
    const outstanding = liabilities.reduce(
      (s, l) => s + (l.outstanding || 0),
      0,
    );
    const principal = liabilities.reduce((s, l) => s + (l.principal || 0), 0);
    const rows = [
      ['Total Loans', `${liabilities.length}`, '#e2e8f0'],
      ['Total Principal', fmt(principal), '#94a3b8'],
      ['Total Outstanding', fmt(outstanding), '#ef4444'],
      ['Paid Off', fmt(principal - outstanding), '#22c55e'],
      [
        'Repayment Progress',
        principal > 0
          ? `${Math.round(((principal - outstanding) / principal) * 100)}%`
          : '—',
        '#a78bfa',
      ],
    ];
    liabilities
      .slice(0, 5)
      .forEach((l) =>
        rows.push([
          `  ${l.name || l.lenderName || 'Loan'}`,
          fmt(l.outstanding || 0),
          '#ef4444',
        ]),
      );
    sections.push(
      section(
        `🏦 Liabilities (${liabilities.length} loans)`,
        '#ef4444',
        tableRows(rows),
      ),
    );
  }

  // ── 5. Accounts ────────────────────────────────────────────────────────────
  if (accounts.length > 0) {
    const totalBal = accounts.reduce((s, a) => s + (a.balance || 0), 0);
    const rows = accounts.map((a) => [
      a.name || 'Account',
      fmt(a.balance || 0),
      '#e2e8f0',
    ]);
    rows.push(['Total Balance', fmt(totalBal), '#a78bfa']);
    sections.push(
      section(`🏧 Accounts (${accounts.length})`, '#a78bfa', tableRows(rows)),
    );
  }

  // ── 6. Goals ───────────────────────────────────────────────────────────────
  if (goals.length > 0) {
    const goalRows = goals.map((g) => {
      const pct =
        g.targetAmount > 0
          ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100))
          : 0;
      const bar =
        '█'.repeat(Math.round(pct / 10)) +
        '░'.repeat(10 - Math.round(pct / 10));
      return [
        `${g.name || 'Goal'} [${bar}]`,
        `${fmt(g.currentAmount)} / ${fmt(g.targetAmount)} (${pct}%)`,
        pct >= 80 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444',
      ];
    });
    sections.push(
      section('🎯 Financial Goals', '#f59e0b', tableRows(goalRows)),
    );
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
            [
              'Status',
              pct >= 100
                ? '✅ Fully Funded'
                : pct >= 50
                  ? '⚠️ Building Up'
                  : '❗ Needs Attention',
              pct >= 100 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444',
            ],
          ]),
        ),
      );
    }
  }

  // ── 7. Agriculture ─────────────────────────────────────────────────────────
  if (
    agriFields.length ||
    agriCropCycles.length ||
    agriMilkRecords.length ||
    agriCoconut.length ||
    agriLivestockEvents.length ||
    agriProduceSales.length ||
    agriExpenses.length
  ) {
    const agriRows = [];
    if (agriFields.length > 0) {
      const totalAcres = agriFields.reduce((s, f) => s + (f.areAcres || 0), 0);
      agriRows.push([
        'Total Fields',
        `${agriFields.length} (${totalAcres.toFixed(1)} acres)`,
        '#4ade80',
      ]);
    }
    if (agriCropCycles.length > 0) {
      const activeCrops = agriCropCycles.filter((c) => !c.actualHarvestDate);
      const harvestedCrops = agriCropCycles.filter(
        (c) => !!c.actualHarvestDate,
      );
      const totalCropIncome = harvestedCrops.reduce(
        (s, c) => s + (c.harvestIncome || 0),
        0,
      );
      const totalCropInvested = agriCropCycles.reduce(
        (s, c) => s + (c.investedAmount || 0),
        0,
      );
      agriRows.push(['Active Crop Cycles', `${activeCrops.length}`, '#4ade80']);
      agriRows.push([
        'Harvested Cycles',
        `${harvestedCrops.length}`,
        '#64748b',
      ]);
      agriRows.push(['Total Crop Income', fmt(totalCropIncome), '#22c55e']);
      agriRows.push([
        'Total Crop Investment',
        fmt(totalCropInvested),
        '#ef4444',
      ]);
      agriRows.push([
        'Crop Net Profit',
        fmt(totalCropIncome - totalCropInvested),
        totalCropIncome - totalCropInvested >= 0 ? '#22c55e' : '#ef4444',
      ]);
      activeCrops
        .slice(0, 3)
        .forEach((c) =>
          agriRows.push([
            `  🌱 ${c.cropName || 'Crop'} (${c.fieldName || ''})`,
            `Since ${c.startDate || '?'}`,
            '#94a3b8',
          ]),
        );
    }
    if (agriExpenses.length > 0) {
      const allFarmExp = agriExpenses.reduce((s, e) => s + (e.amount || 0), 0);
      const monthFarmExp = agriExpenses
        .filter((e) => (e.date || '').startsWith(month))
        .reduce((s, e) => s + (e.amount || 0), 0);
      agriRows.push(['Farm Expenses (all time)', fmt(allFarmExp), '#ef4444']);
      if (monthFarmExp > 0)
        agriRows.push([
          `Farm Expenses — ${monthLbl}`,
          fmt(monthFarmExp),
          '#ef4444',
        ]);
    }
    if (agriMilkRecords.length > 0) {
      const milkMonth = agriMilkRecords.filter((m) =>
        (m.date || '').startsWith(month),
      );
      const milkLiters = milkMonth.reduce((s, m) => s + (m.liters || 0), 0);
      const milkIncome = milkMonth.reduce(
        (s, m) => s + (m.liters || 0) * (m.pricePerLiter || 0),
        0,
      );
      const allMilkLiters = agriMilkRecords.reduce(
        (s, m) => s + (m.liters || 0),
        0,
      );
      const allMilkInc = agriMilkRecords.reduce(
        (s, m) => s + (m.liters || 0) * (m.pricePerLiter || 0),
        0,
      );
      if (milkLiters > 0)
        agriRows.push([
          `Milk — ${monthLbl} (${milkLiters.toFixed(1)} L)`,
          fmt(milkIncome),
          '#14b8a6',
        ]);
      agriRows.push([
        `Milk All Time (${allMilkLiters.toFixed(0)} L)`,
        fmt(allMilkInc),
        '#64748b',
      ]);
    }
    if (agriCoconut.length > 0) {
      const cocIncome = agriCoconut.reduce(
        (s, c) => s + (c.harvestIncome || 0),
        0,
      );
      const totalCoconuts = agriCoconut.reduce(
        (s, c) => s + (c.totalCoconuts || 0),
        0,
      );
      const cocInvestment = agriCoconut.reduce(
        (s, c) => s + (c.investmentAmount || 0),
        0,
      );
      agriRows.push([
        `Coconut Harvests (${totalCoconuts.toLocaleString()} nuts)`,
        fmt(cocIncome),
        '#f59e0b',
      ]);
      if (cocInvestment > 0) {
        agriRows.push(['Coconut Investment', fmt(cocInvestment), '#ef4444']);
        agriRows.push([
          'Coconut Net',
          fmt(cocIncome - cocInvestment),
          cocIncome - cocInvestment >= 0 ? '#22c55e' : '#ef4444',
        ]);
      }
    }
    if (agriProduceSales.length > 0) {
      const produceMonth = agriProduceSales.filter((p) =>
        (p.date || '').startsWith(month),
      );
      const produceIncomeMonth = produceMonth.reduce(
        (s, p) => s + (p.totalAmount || 0),
        0,
      );
      const allProduceInc = agriProduceSales.reduce(
        (s, p) => s + (p.totalAmount || 0),
        0,
      );
      if (produceIncomeMonth > 0)
        agriRows.push([
          `Produce Sales — ${monthLbl}`,
          fmt(produceIncomeMonth),
          '#22c55e',
        ]);
      agriRows.push([
        'Produce Sales (all time)',
        fmt(allProduceInc),
        '#64748b',
      ]);
      const produceMap = {};
      agriProduceSales.forEach((p) => {
        produceMap[p.produceName || 'Item'] =
          (produceMap[p.produceName || 'Item'] || 0) + (p.totalAmount || 0);
      });
      Object.entries(produceMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .forEach(([name, amt]) =>
          agriRows.push([`  🥬 ${name}`, fmt(amt), '#94a3b8']),
        );
    }
    if (agriLivestockEvents.length > 0) {
      const types = [
        'goat',
        'cow',
        'buffalo',
        'sheep',
        'poultry',
        'pig',
        'other',
      ];
      const counts = {};
      types.forEach((type) => {
        const cnt = agriLivestockEvents
          .filter((e) => e.animalType === type)
          .reduce((n, e) => {
            if (['purchase', 'birth', 'existing'].includes(e.eventType))
              return n + (e.count || 0);
            if (['sale', 'death'].includes(e.eventType))
              return n - (e.count || 0);
            return n;
          }, 0);
        if (cnt > 0) counts[type] = cnt;
      });
      const total = Object.values(counts).reduce((s, n) => s + n, 0);
      if (total > 0) {
        agriRows.push(['Total Livestock', `${total} animals`, '#94a3b8']);
        Object.entries(counts).forEach(([type, cnt]) =>
          agriRows.push([
            `  ${type.charAt(0).toUpperCase() + type.slice(1)}`,
            `${cnt}`,
            '#64748b',
          ]),
        );
      }
    }
    if (agriRows.length > 0)
      sections.push(section('🌾 Agriculture', '#4ade80', tableRows(agriRows)));
  }

  // ── 8. Farm Workers ────────────────────────────────────────────────────────
  if (attEmployees.length > 0) {
    const monthAtt = attRecords.filter((r) => (r.date || '').startsWith(month));
    const present = monthAtt.filter((r) => r.present).length;
    const absent = monthAtt.filter((r) => !r.present).length;
    const wages = monthAtt.reduce(
      (s, r) => s + (r.present ? (r.wage || 0) + (r.extraWork || 0) : 0),
      0,
    );
    const advances = attTransactions
      .filter((t) => t.type === 'advance' && (t.date || '').startsWith(month))
      .reduce((s, t) => s + (t.amount || 0), 0);
    const allAdv = attTransactions
      .filter((t) => t.type === 'advance')
      .reduce((s, t) => s + (t.amount || 0), 0);
    const unpaid = attSalary.filter(
      (s) => s.month === month && s.paymentStatus !== 'paid',
    );
    const empMap = {};
    attEmployees.forEach((e) => {
      empMap[e.id] = e.name;
    });
    const wRows = [
      ['Total Workers', `${attEmployees.length}`, '#e2e8f0'],
      ['Days Present This Month', `${present}`, '#22c55e'],
      ['Days Absent This Month', `${absent}`, '#ef4444'],
      ['Wages This Month', fmt(wages), '#22c55e'],
    ];
    if (advances > 0)
      wRows.push(['Advances This Month', fmt(advances), '#f59e0b']);
    if (allAdv > 0)
      wRows.push(['Total Advances (all time)', fmt(allAdv), '#64748b']);
    if (unpaid.length > 0) {
      wRows.push([`⚠ Pending Salary`, `${unpaid.length} worker(s)`, '#ef4444']);
      unpaid
        .slice(0, 3)
        .forEach((s) =>
          wRows.push([
            `  ${empMap[s.employeeId] || 'Worker'}`,
            fmt(s.netPayable || 0),
            '#f59e0b',
          ]),
        );
    }
    attEmployees.slice(0, 6).forEach((emp) => {
      const empPresent = monthAtt.filter(
        (r) => r.employeeId === emp.id && r.present,
      ).length;
      wRows.push([`  ${emp.name}`, `${empPresent} days`, '#64748b']);
    });
    sections.push(
      section('👷 Farm Workers — ' + monthLbl, '#60a5fa', tableRows(wRows)),
    );
  }

  // ── 9. Insurance ───────────────────────────────────────────────────────────
  if (insurancePolicies.length > 0) {
    const totalCoverage = insurancePolicies.reduce(
      (s, p) => s + (p.coverageAmount || 0),
      0,
    );
    const totalYearlyPremium = insurancePolicies.reduce((s, p) => {
      const m =
        p.premiumFrequency === 'monthly'
          ? 12
          : p.premiumFrequency === 'quarterly'
            ? 4
            : p.premiumFrequency === 'half-yearly'
              ? 2
              : 1;
      return s + (p.premiumAmount || 0) * m;
    }, 0);
    const today = new Date();
    const expiringSoon = insurancePolicies.filter((p) => {
      if (!p.renewalDate) return false;
      const d = Math.ceil((new Date(p.renewalDate) - today) / 86400000);
      return d >= 0 && d <= 30;
    });
    const expired = insurancePolicies.filter(
      (p) => p.renewalDate && new Date(p.renewalDate) < today,
    );
    const insRows = [
      ['Total Policies', `${insurancePolicies.length}`, '#e2e8f0'],
      ['Total Coverage', fmt(totalCoverage), '#a78bfa'],
      ['Yearly Premium', fmt(totalYearlyPremium), '#94a3b8'],
      ['Monthly Cost', fmt(totalYearlyPremium / 12), '#64748b'],
    ];
    if (expiringSoon.length > 0)
      insRows.push([
        `⏰ Renewing Soon (≤30 days)`,
        `${expiringSoon.length}`,
        '#f59e0b',
      ]);
    if (expired.length > 0)
      insRows.push([`⚠ Expired Policies`, `${expired.length}`, '#ef4444']);
    insurancePolicies.forEach((p) => {
      const days = p.renewalDate
        ? Math.ceil((new Date(p.renewalDate) - today) / 86400000)
        : null;
      const note =
        days !== null
          ? days < 0
            ? ' ⚠ EXPIRED'
            : days <= 30
              ? ` ⏰ ${days}d`
              : ''
          : '';
      insRows.push([
        `${(p.type || 'POLICY').toUpperCase()} — ${p.policyName || p.provider || ''}${note}`,
        fmt(p.coverageAmount || 0),
        days !== null && days < 0
          ? '#ef4444'
          : days !== null && days <= 30
            ? '#f59e0b'
            : '#cbd5e1',
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

  // ── 10. SIP Plan ───────────────────────────────────────────────────────────
  if (sipPlanDocs.length > 0) {
    const budgetDoc = sipPlanDocs.find((d) => d.type === 'budget');
    const instruments = sipPlanDocs.filter((d) => d.type === 'instrument');
    const budget = budgetDoc?.budget || 0;
    const totalPct = instruments.reduce((s, i) => s + (i.percentage || 0), 0);
    if (budget > 0 || instruments.length > 0) {
      const sipRows = [];
      if (budget > 0)
        sipRows.push(['Monthly SIP Budget', fmt(budget), '#22c55e']);
      if (instruments.length > 0)
        sipRows.push([
          'Instruments Planned',
          `${instruments.length}`,
          '#e2e8f0',
        ]);
      if (budget > 0)
        sipRows.push([
          'Allocated Amount',
          fmt((budget * totalPct) / 100),
          '#22c55e',
        ]);
      if (totalPct > 0)
        sipRows.push([
          'Allocation',
          `${totalPct.toFixed(0)}%`,
          totalPct > 100 ? '#ef4444' : '#22c55e',
        ]);
      if (budget > 0 && totalPct < 100)
        sipRows.push([
          'Unallocated',
          fmt(budget - (budget * totalPct) / 100),
          '#f59e0b',
        ]);
      instruments.forEach((inst) => {
        const amt = budget > 0 ? (budget * (inst.percentage || 0)) / 100 : 0;
        sipRows.push([
          `  ${inst.name || 'Instrument'} (${inst.percentage || 0}%)`,
          budget > 0 ? fmt(amt) : `${inst.percentage || 0}%`,
          '#94a3b8',
        ]);
      });
      sections.push(
        section('📅 Monthly SIP Plan', '#06b6d4', tableRows(sipRows)),
      );
    }
  }

  // ── 11. Lending ────────────────────────────────────────────────────────────
  if (lendingBorrowers.length > 0) {
    const validIds = new Set(lendingBorrowers.map((b) => b.id));
    let totalGiven = 0,
      totalReturned = 0,
      totalInterest = 0;
    lendingTransactions.forEach((t) => {
      if (!validIds.has(t.borrowerId)) return;
      if (t.type === 'principal_given') totalGiven += t.amount || 0;
      if (t.type === 'principal_returned') totalReturned += t.amount || 0;
      if (t.type === 'interest_paid') totalInterest += t.amount || 0;
    });
    const active = lendingBorrowers.filter((b) => b.status === 'active');
    const lendingRows = [
      ['Total Borrowers', `${lendingBorrowers.length}`, '#e2e8f0'],
      ['Active Accounts', `${active.length}`, '#22c55e'],
      ['Total Principal Given', fmt(totalGiven), '#94a3b8'],
      ['Principal Returned', fmt(totalReturned), '#22c55e'],
      ['Outstanding Balance', fmt(totalGiven - totalReturned), '#f59e0b'],
      ['Total Interest Earned', fmt(totalInterest), '#22c55e'],
    ];
    active.slice(0, 4).forEach((b) => {
      const given = lendingTransactions
        .filter((t) => t.borrowerId === b.id && t.type === 'principal_given')
        .reduce((s, t) => s + (t.amount || 0), 0);
      const returned = lendingTransactions
        .filter((t) => t.borrowerId === b.id && t.type === 'principal_returned')
        .reduce((s, t) => s + (t.amount || 0), 0);
      lendingRows.push([
        `  ${b.name || 'Borrower'}`,
        fmt(given - returned),
        '#f59e0b',
      ]);
    });
    sections.push(
      section('🤝 Lending & Financing', '#6366f1', tableRows(lendingRows)),
    );
  }

  if (sections.length === 0) {
    sections.push(`<div style="text-align:center;padding:20px"><div style="font-size:32px;margin-bottom:12px">👋</div>
      <p style="color:#94a3b8;font-size:14px;margin:0">Your FinTrackly account is active.<br>Start adding data to see your monthly summary here.</p></div>`);
  }

  return { sections, allData, monthLbl };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== FinTrackly Monthly Report ===');
  console.log('Time:', new Date().toISOString());
  console.log('Encryption salt:', SALT.slice(0, 8) + '...');

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

  const testEmail = process.env.TEST_EMAIL;
  const skipAttachments = process.env.SKIP_ATTACHMENTS === 'true';

  if (testEmail) {
    console.log(`\nTest mode — sending to: ${testEmail}`);
    try {
      const user = await admin.auth().getUserByEmail(testEmail);
      console.log(`Found user uid: ${user.uid}`);

      const { sections, allData, monthLbl } = await buildReportAndData(
        user.uid,
      );

      // Build attachments
      const attachments = [];
      let attachmentSummary = null;

      if (!skipAttachments) {
        // JSON backup
        const jsonPayload = {
          version: 7,
          createdAt: new Date().toISOString(),
          ...allData,
        };
        const jsonBuf = Buffer.from(
          JSON.stringify(jsonPayload, null, 2),
          'utf-8',
        );
        attachments.push({
          filename: `fintrackly-backup-${dateStr()}.json`,
          content: jsonBuf,
          contentType: 'application/json',
        });

        // CSV ZIP
        const csvResult = await buildCSVZip(allData);
        if (csvResult) {
          attachments.push({
            filename: `fintrackly-data-${dateStr()}.zip`,
            content: csvResult.buffer,
            contentType: 'application/zip',
          });
          attachmentSummary = `📋 CSV data (${csvResult.count} files in ZIP) · 💾 Full JSON backup`;
        } else {
          attachmentSummary = `💾 Full JSON backup`;
        }
        console.log(
          `Attachments: JSON (${(jsonBuf.length / 1024).toFixed(1)} KB)` +
            (csvResult
              ? `, CSV ZIP (${(csvResult.buffer.length / 1024).toFixed(1)} KB, ${csvResult.count} files)`
              : ''),
        );
      }

      const html = emailTemplate(sections, monthLbl, attachmentSummary);

      const info = await transporter.sendMail({
        from: `"${FROM_NAME}" <${process.env.GMAIL_USER}>`,
        to: testEmail,
        subject: `📊 FinTrackly Monthly Report — ${currentMonthLabel()} (Test)`,
        html,
        attachments,
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
  let users = [],
    pageToken;
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
      const { sections, allData, monthLbl } = await buildReportAndData(
        user.uid,
      );
      const attachments = [];
      let attachmentSummary = null;

      if (!skipAttachments) {
        const jsonPayload = {
          version: 7,
          createdAt: new Date().toISOString(),
          ...allData,
        };
        const jsonBuf = Buffer.from(
          JSON.stringify(jsonPayload, null, 2),
          'utf-8',
        );
        attachments.push({
          filename: `fintrackly-backup-${dateStr()}.json`,
          content: jsonBuf,
          contentType: 'application/json',
        });

        const csvResult = await buildCSVZip(allData);
        if (csvResult) {
          attachments.push({
            filename: `fintrackly-data-${dateStr()}.zip`,
            content: csvResult.buffer,
            contentType: 'application/zip',
          });
          attachmentSummary = `📋 CSV data (${csvResult.count} files in ZIP) · 💾 Full JSON backup`;
        } else {
          attachmentSummary = `💾 Full JSON backup`;
        }
      }

      const html = emailTemplate(sections, monthLbl, attachmentSummary);
      await transporter.sendMail({
        from: `"${FROM_NAME}" <${process.env.GMAIL_USER}>`,
        to: user.email,
        subject: `📊 Your FinTrackly Monthly Report — ${currentMonthLabel()}`,
        html,
        attachments,
      });
      console.log(`✓ sent → ${user.email}`);
      sent++;
      await new Promise((r) => setTimeout(r, 800)); // slightly longer delay due to attachments
    } catch (err) {
      console.error(`✗ failed → ${user.email}:`, err.message);
      errors++;
    }
  }

  console.log(`\nDone — Sent: ${sent}, Errors: ${errors}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal:', err.message, err.stack);
  process.exit(1);
});
