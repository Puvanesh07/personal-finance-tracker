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

// ── Zero-data check ───────────────────────────────────────────────────────────
// Returns true if the user has at least one record in ANY collection.
// If false, we skip sending the report email entirely.
function hasAnyData(allData) {
  return [
    allData.investments,
    allData.cashflows,
    allData.liabilities,
    allData.pendingPayments,
    allData.trackedPayments,
    allData.accounts,
    allData.goals,
    allData.goalContributions,
    allData.soldTrades,
    allData.insurancePolicies,
    allData.insurancePayments,
    allData.credentials,
    allData.sipPlans,
    allData.networthSnapshots,
    allData.snapshots,
    allData.lendingBorrowers,
    allData.lendingTransactions,
    allData.agriFields,
    allData.agriCropCycles,
    allData.agriExpenses,
    allData.agriLivestock,
    allData.agriMilkRecords,
    allData.agriCoconut,
    allData.agriLivestockEvents,
    allData.agriProduceSales,
    allData.attEmployees,
    allData.attRecords,
    allData.attTransactions,
    allData.attSalary,
  ].some((col) => Array.isArray(col) && col.length > 0);
}

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
const fmtSigned = (n) =>
  `${n >= 0 ? '+' : '-'}${fmt(Math.abs(n || 0))}`;
const currentMonth = () => new Date().toISOString().slice(0, 7);
const currentMonthLabel = () =>
  new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' });
const dateStr = () => new Date().toISOString().split('T')[0];
const shortDate = (d) => (d || '').slice(5, 10);
const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

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

async function fetchSettingsDoc(uid) {
  try {
    const snap = await db
      .collection('users')
      .doc(uid)
      .collection('settings')
      .doc('config')
      .get();
    return snap.exists ? snap.data() : null;
  } catch (err) {
    console.error(`    settings/config ERROR:`, err.message);
    return null;
  }
}

/**
 * Build the EXACT same JSON backup payload as Settings → Export JSON.
 * Mirrors `exportFullBackup()` in src/utils/backup.ts (BackupPayload v10)
 * so the attached JSON can be restored 1:1 via Import Full Backup.
 */
function buildBackupJSON(collections, settingsDoc) {
  const {
    investments = [],
    liabilities = [],
    cashflows = [],
    goals = [],
    goalContributions = [],
    credentials = [],
    snapshots = [],
    networthSnapshots = [],
    accounts = [],
    agriFields = [],
    agriCropCycles = [],
    agriExpenses = [],
    agriLivestock = [],
    agriMilkRecords = [],
    agriCoconut = [],
    agriLivestockEvents = [],
    agriProduceSales = [],
    attEmployees = [],
    attRecords = [],
    attTransactions = [],
    attSalary = [],
    insurancePolicies = [],
    insurancePayments = [],
    lendingBorrowers = [],
    lendingTransactions = [],
    sipPlans = [],
    soldTrades = [],
    pendingPayments = [],
    trackedPayments = [],
  } = collections;

  const payload = {
    version: 10,
    createdAt: new Date().toISOString(),
    investments,
    liabilities,
    cashflows,
    goals,
    goalContributions,
    credentials,
    snapshots,
    networthSnapshots,
    accounts,
    notion: settingsDoc?.notion ?? { enabled: false },
    essentials: settingsDoc?.essentials ?? {},
    agriFields,
    agriCropCycles,
    agriExpenses,
    agriLivestock,
    agriMilkRecords,
    agriCoconut,
    agriLivestockEvents,
    agriProduceSales,
    attEmployees,
    attRecords,
    attTransactions,
    attSalary,
    insurancePolicies,
    insurancePayments,
    lendingBorrowers,
    lendingTransactions,
    sipPlans,
    soldTrades,
    pendingPayments,
    trackedPayments,
  };

  return payload;
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
    goalContributions = [],
    accounts = [],
    insurancePolicies = [],
    insurancePayments = [],
    pendingPayments = [],
    trackedPayments = [],
    credentials = [],
    sipPlans = [],
    lendingBorrowers = [],
    lendingTransactions = [],
    agriFields = [],
    agriCropCycles = [],
    agriExpenses = [],
    agriLivestock = [],
    agriMilkRecords = [],
    agriCoconut = [],
    agriLivestockEvents = [],
    agriProduceSales = [],
    attEmployees = [],
    attRecords = [],
    attTransactions = [],
    attSalary = [],
    snapshots = [],
    networthSnapshots = [],
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
  const goalMap = {};
  goals.forEach((g) => {
    goalMap[g.id] = g.name;
  });
  const policyMap = {};
  insurancePolicies.forEach((p) => {
    policyMap[p.id] = p.policyName;
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
          Status: i.status ?? 'active',
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
          EMI: l.emiAmount ?? '',
          'Start Date': l.startDate ?? '',
          'End Date': l.endDate ?? '',
          Status: l.status ?? 'active',
        })),
      ),
    });
  }

  if (pendingPayments.length) {
    files.push({
      name: 'pending-payments.csv',
      csv: toCSV(
        pendingPayments.map((p) => ({
          Buyer: p.buyerName,
          Phone: p.buyerPhone ?? '',
          Item: p.itemDescription,
          Amount: p.amount,
          'Sale Date': p.saleDate,
          'Expected Date': p.expectedPaymentDate,
          Status: p.status,
          Notes: p.notes ?? '',
        })),
      ),
    });
  }

  if (trackedPayments.length) {
    files.push({
      name: 'payment-tracker.csv',
      csv: toCSV(
        trackedPayments.map((p) => ({
          Title: p.title,
          Type: p.paymentType,
          Amount: p.amount,
          'Due Date': p.dueDate,
          Status: p.status,
          Recurrence: p.recurrence,
          Notes: p.notes ?? '',
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
          Status: g.status ?? 'active',
        })),
      ),
    });
  }

  if (goalContributions.length) {
    files.push({
      name: 'goal-contributions.csv',
      csv: toCSV(
        goalContributions.map((c) => ({
          Goal: goalMap[c.goalId] ?? c.goalId,
          Amount: c.amount,
          Date: c.date,
          Note: c.note ?? '',
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
          'Opening Balance': a.openingBalance ?? '',
          'Opening Date': a.openingBalanceDate ?? '',
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

  if (insurancePayments.length) {
    files.push({
      name: 'insurance-payments.csv',
      csv: toCSV(
        insurancePayments.map((p) => ({
          Policy: policyMap[p.policyId] ?? p.policyId,
          Amount: p.amount,
          'Paid At': p.paidAt,
          Note: p.note ?? '',
        })),
      ),
    });
  }

  if (credentials.length) {
    files.push({
      name: 'credentials.csv',
      csv: toCSV(
        credentials.map((c) => ({
          Title: c.title,
          Category: c.category,
          Identifier: c.identifier ?? '',
          Notes: c.notes ?? '',
        })),
      ),
    });
  }

  if (sipPlans.length) {
    files.push({
      name: 'sip-plans.csv',
      csv: toCSV(
        sipPlans.map((s) => ({
          Type: s.type ?? '',
          Name: s.name ?? '',
          Percentage: s.percentage ?? '',
          Budget: s.budget ?? '',
        })),
      ),
    });
  }

  if (networthSnapshots.length) {
    files.push({
      name: 'networth-snapshots.csv',
      csv: toCSV(
        networthSnapshots.map((s) => ({
          Date: s.createdAt?.slice(0, 10) ?? '',
          Label: s.label ?? '',
          'Total Assets': s.totalAssets,
          'Total Liabilities': s.totalLiabilities,
          'Net Worth': s.netWorth,
        })),
      ),
    });
  }

  if (snapshots.length) {
    files.push({
      name: 'portfolio-snapshots.csv',
      csv: toCSV(
        snapshots.map((s) => ({
          Date: s.date ?? '',
          'Total Value': s.totalValue,
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
  if (agriLivestock.length) {
    files.push({
      name: 'agri-livestock.csv',
      csv: toCSV(
        agriLivestock.map((l) => ({
          Type: l.type,
          Name: l.name ?? '',
          Count: l.count,
          'Purchase Cost': l.purchaseCost,
          'Current Value': l.currentValue,
          'Purchase Date': l.purchaseDate,
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
          Crop: e.cropName ?? '',
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
          Session: m.session ?? '',
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

// ── HTML Report Builders (Redesigned) ─────────────────────────────────────────

function noRecords(label = 'No records yet') {
  return `<tr><td colspan="10" style="padding:10px 8px;color:#475569;font-size:12px;font-style:italic;text-align:center">— ${label} —</td></tr>`;
}

function tableRows(data) {
  return data
    .map(
      ([label, value, color]) =>
        `<tr><td style="padding:5px 0;color:#94a3b8;font-size:13px">${label}</td>` +
        `<td style="padding:5px 0;text-align:right;font-size:13px;font-weight:600;color:${color}">${value}</td></tr>`,
    )
    .join('');
}

function section(title, color, content, anchor) {
  const idAttr = anchor ? ` id="${anchor}"` : '';
  return (
    `<div style="margin-bottom:32px"${idAttr}>` +
    `<h2 style="color:${color};font-size:15px;margin:0 0 14px;padding-bottom:10px;border-bottom:2px solid ${color}40;letter-spacing:0.2px">${title}</h2>` +
    `<div style="background:#0f172a40;border-radius:10px;padding:14px 16px">${content}</div></div>`
  );
}

function sectionGroup(title, icon, color) {
  return (
    `<div style="margin:36px 0 20px;background:linear-gradient(135deg, ${color}15 0%, transparent 100%);border-left:3px solid ${color};border-radius:0 10px 10px 0;padding:14px 18px">` +
    `<h1 style="color:${color};font-size:17px;margin:0;font-weight:600">${icon} ${title}</h1>` +
    `</div>`
  );
}

function dataTable(headers, rows, colAligns) {
  const headRow = headers
    .map(
      (h, i) =>
        `<th style="padding:8px 10px;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;text-align:${
          colAligns?.[i] || 'left'
        };border-bottom:1px solid #1e293b">${h}</th>`,
    )
    .join('');
  return (
    `<table style="width:100%;border-collapse:collapse;margin-top:4px">` +
    `<thead><tr>${headRow}</tr></thead>` +
    `<tbody>${rows.join('')}</tbody></table>`
  );
}

function dataRow(cells, aligns, colors) {
  return (
    '<tr>' +
    cells
      .map(
        (c, i) =>
          `<td style="padding:7px 10px;font-size:12.5px;color:${
            colors?.[i] || '#cbd5e1'
          };text-align:${
            aligns?.[i] || 'left'
          };border-bottom:1px solid #1e293b50">${c}</td>`,
      )
      .join('') +
    '</tr>'
  );
}

function summaryCard(label, value, color, sub) {
  return `<div style="flex:1;min-width:120px;background:#0f172a;border:1px solid #1e293b;border-radius:10px;padding:12px 14px;margin:4px">
    <div style="color:#64748b;font-size:10.5px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">${label}</div>
    <div style="color:${color};font-size:18px;font-weight:700;margin-bottom:2px">${value}</div>
    ${sub ? `<div style="color:#475569;font-size:10.5px">${sub}</div>` : ''}
  </div>`;
}

function buildTOC(items) {
  const chips = items
    .map(
      ([emoji, label, color]) =>
        `<a href="#${label.toLowerCase().replace(/\s+/g, '-')}" style="display:inline-block;background:#0f172a80;border:1px solid ${color}40;color:${color};font-size:11.5px;padding:6px 11px;margin:3px;border-radius:20px;text-decoration:none">${emoji} ${label}</a>`,
    )
    .join('');
  return `<div style="margin-bottom:8px">${chips}</div>`;
}

function emailTemplate(sections, monthLbl, attachmentSummary, overview) {
  const attachNote = attachmentSummary
    ? `<div style="margin:20px 0;background:#1e3a5f;border:1px solid #3b82f640;border-radius:12px;padding:16px 20px">
        <p style="color:#60a5fa;font-size:13px;font-weight:600;margin:0 0 6px">📎 Attachments included in this email</p>
        <p style="color:#94a3b8;font-size:12px;margin:0">${attachmentSummary}</p>
      </div>`
    : '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#020617;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e2e8f0;line-height:1.5">
<div style="max-width:720px;margin:0 auto;padding:20px 14px">

<!-- Header -->
<div style="background:linear-gradient(135deg, #1e293b 0%, #0f172a 100%);border:1px solid #22c55e33;border-radius:18px;padding:32px 24px 28px;margin-bottom:22px;text-align:center;position:relative;overflow:hidden">
<div style="position:absolute;top:-40px;right:-40px;width:140px;height:140px;background:radial-gradient(circle,#22c55e20 0%,transparent 70%);border-radius:50%"></div>
<div style="position:absolute;bottom:-50px;left:-50px;width:160px;height:160px;background:radial-gradient(circle,#3b82f615 0%,transparent 70%);border-radius:50%"></div>
<div style="position:relative">
<div style="font-size:42px;margin-bottom:10px">📊</div>
<h1 style="color:#f8fafc;font-size:24px;margin:0 0 6px;font-weight:700;letter-spacing:-0.3px">FinTrackly Monthly Report</h1>
<p style="color:#64748b;font-size:14px;margin:0;font-weight:500">${monthLbl}</p>
<div style="margin-top:14px;color:#94a3b8;font-size:12px">Comprehensive overview of your finances, farm &amp; workforce</div>
</div>
</div>

${attachNote}

${overview || ''}

<div style="background:#1e293b;border:1px solid #334155;border-radius:16px;padding:24px 20px;margin-bottom:22px">
${sections.join('')}
</div>

<div style="text-align:center;padding:18px 10px 6px">
<p style="color:#475569;font-size:12px;margin:0 0 8px">FinTrackly — Your personal finance and farm tracker</p>
<p style="color:#334155;font-size:11px;margin:0 0 6px">💡 Attached JSON backup includes all modules — same format as Settings → Export JSON.</p>
<p style="color:#334155;font-size:11px;margin:0 0 10px">📋 CSV ZIP contains individual sheets for each module.</p>
<a href="https://finance-tracker-3b842.web.app/settings" style="color:#22c55e;text-decoration:none;font-size:11px;font-weight:500">Manage account</a>
</div>

</div>
</body>
</html>`;
}

// ── Build full report HTML + collect all data ─────────────────────────────────
/**
 * Builds the monthly report HTML and collects all user data.
 * 
 * HTML RENDERING RULES (per-section conditional):
 *  - Each section (Cashflow, Investments, Liabilities, etc.) is only rendered
 *    in the HTML report if that collection has at least 1 record.
 *  - If a user has NO data in Cashflow, the Cashflow section is excluded from HTML.
 *  - If a user has NO data across ALL modules, main() skips sending the email entirely.
 * 
 * JSON BACKUP (always complete):
 *  - The JSON backup attachment ALWAYS includes all collections, even empty arrays.
 *  - This matches the exact format of Settings → Export JSON for 1:1 restore compatibility.
 */
async function buildReportAndData(uid) {
  const month = currentMonth();
  const monthLbl = currentMonthLabel();
  const sections = [];
  const tocItems = [];
  console.log(`  Building report — uid: ${uid}, month: ${month}`);

  // Fetch ALL collections
  const [
    cashflows,
    investments,
    soldTrades,
    liabilities,
    pendingPayments,
    trackedPayments,
    accounts,
    goals,
    goalContributions,
    credentials,
    snapshots,
    networthSnapshots,
    agriFields,
    agriCropCycles,
    agriExpenses,
    agriLivestock,
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
    settingsDoc,
  ] = await Promise.all([
    fetchCol(uid, 'cashflows'),
    fetchCol(uid, 'investments'),
    fetchCol(uid, 'soldTrades'),
    fetchCol(uid, 'liabilities'),
    fetchCol(uid, 'pendingPayments'),
    fetchCol(uid, 'trackedPayments'),
    fetchCol(uid, 'accounts'),
    fetchCol(uid, 'goals'),
    fetchCol(uid, 'goalContributions'),
    fetchCol(uid, 'credentials'),
    fetchCol(uid, 'snapshots'),
    fetchCol(uid, 'networthSnapshots'),
    fetchCol(uid, 'agriFields'),
    fetchCol(uid, 'agriCropCycles'),
    fetchCol(uid, 'agriExpenses'),
    fetchCol(uid, 'agriLivestock'),
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
    fetchSettingsDoc(uid),
  ]);

  const allData = {
    cashflows,
    investments,
    soldTrades,
    liabilities,
    pendingPayments,
    trackedPayments,
    accounts,
    goals,
    goalContributions,
    credentials,
    snapshots,
    networthSnapshots,
    agriFields,
    agriCropCycles,
    agriExpenses,
    agriLivestock,
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
    sipPlans: sipPlanDocs,
    lendingBorrowers,
    lendingTransactions,
  };

  // ── Pre-compute module presence flags (used by TOC + section guards) ─────────
  const hasAgriData = !!(
    agriFields.length || agriCropCycles.length || agriMilkRecords.length ||
    agriCoconut.length || agriLivestockEvents.length || agriLivestock.length ||
    agriProduceSales.length || agriExpenses.length
  );

  // ── Derived: Investment calculations ────────────────────────────────────────
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
  const invPnl = totalCurrent - totalInvested;

  // ── Derived: Cashflow month vs all-time ─────────────────────────────────────
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
  const mNet = mIncome - mExpense;

  // ── Derived: Totals for overview ────────────────────────────────────────────
  const totalAccountBal = accounts.reduce((s, a) => s + (a.balance || 0), 0);
  const totalLiabOut = liabilities.reduce(
    (s, l) => s + (l.outstanding || 0),
    0,
  );
  const pendingRecv = pendingPayments
    .filter((p) => p.status !== 'received')
    .reduce((s, p) => s + (p.amount || 0), 0);
  const duesUpcoming = trackedPayments
    .filter((p) => p.status !== 'paid')
    .reduce((s, p) => s + (p.amount || 0), 0);
  const totalCoverage = insurancePolicies.reduce(
    (s, p) => s + (p.coverageAmount || 0),
    0,
  );
  const validLendingIds = new Set(lendingBorrowers.map((b) => b.id));
  let totalGiven = 0,
    totalReturned = 0;
  lendingTransactions.forEach((t) => {
    if (!validLendingIds.has(t.borrowerId)) return;
    if (t.type === 'principal_given') totalGiven += t.amount || 0;
    if (t.type === 'principal_returned') totalReturned += t.amount || 0;
  });
  const lendingOutstanding = totalGiven - totalReturned;

  let netWorth = 0;
  if (networthSnapshots.length > 0) {
    const sortedNw = [...networthSnapshots].sort((a, b) =>
      (a.createdAt || '').localeCompare(b.createdAt || ''),
    );
    netWorth = sortedNw[sortedNw.length - 1]?.netWorth || 0;
  } else {
    netWorth =
      totalAccountBal + totalCurrent + lendingOutstanding - totalLiabOut;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. EXECUTIVE OVERVIEW
  // ═══════════════════════════════════════════════════════════════════════════
  sections.push(sectionGroup('Executive Overview', '🎯', '#22c55e'));
  tocItems.push(['🎯', 'Overview', '#22c55e']);

  {
    const cards = [
      summaryCard('Net Worth', fmt(netWorth), '#f8fafc', 'Assets − Liabilities'),
      summaryCard(
        'This Month Savings',
        fmtSigned(mNet),
        mNet >= 0 ? '#22c55e' : '#ef4444',
        `Income ${fmt(mIncome)} · Expense ${fmt(mExpense)}`,
      ),
      summaryCard(
        'Investment Portfolio',
        fmt(totalCurrent),
        '#3b82f6',
        `${investments.length} holdings · P&L ${fmtSigned(invPnl)}`,
      ),
      summaryCard('Cash in Accounts', fmt(totalAccountBal), '#a78bfa', `${accounts.length} accounts`),
    ];
    const cardRow =
      `<div style="display:flex;flex-wrap:wrap;margin:-4px">${cards.join('')}</div>`;

    const quickStats = [];
    quickStats.push(['Total Liabilities', fmt(totalLiabOut), '#ef4444']);
    quickStats.push(['Receivables (Pending)', fmt(pendingRecv), pendingRecv > 0 ? '#f59e0b' : '#64748b']);
    quickStats.push(['Upcoming Dues', fmt(duesUpcoming), duesUpcoming > 0 ? '#f97316' : '#64748b']);
    quickStats.push(['Insurance Coverage', fmt(totalCoverage), '#a78bfa']);
    if (lendingOutstanding > 0)
      quickStats.push(['Lent (Outstanding)', fmt(lendingOutstanding), '#6366f1']);
    quickStats.push([
      'Savings Rate (Month)',
      mIncome > 0 ? `${Math.round((mNet / mIncome) * 100)}%` : '—',
      mNet >= 0 ? '#22c55e' : '#ef4444',
    ]);
    quickStats.push([
      'Emergency Fund Target',
      goals.some((g) => (g.name || '').toLowerCase().includes('emergency'))
        ? 'Tracked 🔍'
        : 'Not set ⚠️',
      '#0ea5e9',
    ]);

    sections.push(
      section(
        '📌 Snapshot',
        '#22c55e',
        cardRow +
          `<div style="margin-top:16px"><table style="width:100%;border-collapse:collapse">${tableRows(quickStats)}</table></div>`,
        'overview',
      ),
    );

    // Quick Navigation TOC — only include sections that have data
    if (cashflows.length > 0)          tocItems.push(['💰', 'Cashflow',    '#22c55e']);
    if (investments.length > 0)        tocItems.push(['📈', 'Investments', '#3b82f6']);
    if (soldTrades.length > 0)         tocItems.push(['💹', 'Profits',     '#10b981']);
    if (liabilities.length > 0)        tocItems.push(['🏦', 'Liabilities', '#ef4444']);
    if (pendingPayments.length > 0)    tocItems.push(['📋', 'Payments',    '#f97316']);
    if (trackedPayments.length > 0)    tocItems.push(['⏰', 'Dues',        '#f97316']);
    if (accounts.length > 0)           tocItems.push(['🏧', 'Accounts',    '#a78bfa']);
    if (goals.length > 0)              tocItems.push(['🎯', 'Goals',       '#f59e0b']);
    if (insurancePolicies.length > 0)  tocItems.push(['🛡', 'Insurance',   '#a78bfa']);
    if (sipPlanDocs.length > 0)        tocItems.push(['📅', 'SIP Plan',    '#06b6d4']);
    if (lendingBorrowers.length > 0)   tocItems.push(['🤝', 'Lending',     '#6366f1']);
    if (credentials.length > 0)        tocItems.push(['🔐', 'Credentials', '#0ea5e9']);
    if (networthSnapshots.length > 0 || snapshots.length > 0)
                                       tocItems.push(['📜', 'Net Worth',   '#14b8a6']);
    if (hasAgriData)                   tocItems.push(['🌾', 'Agriculture', '#4ade80']);
    if (attEmployees.length > 0)       tocItems.push(['👷', 'Workers',     '#60a5fa']);

    sections.push(
      `<div style="margin-bottom:28px">
        <h2 style="color:#64748b;font-size:12px;margin:0 0 10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Quick Jump</h2>
        ${buildTOC(tocItems)}
      </div>`,
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP A — WEALTH & SAVINGS
  // ═══════════════════════════════════════════════════════════════════════════
  const hasGroupA = cashflows.length > 0 || investments.length > 0 || soldTrades.length > 0;
  if (hasGroupA) sections.push(sectionGroup('Wealth, Income & Savings', '💰', '#22c55e'));

  // ── 1. Cashflow (Detailed) ──────────────────────────────────────────────────
  if (cashflows.length > 0) {
    const catMap = {};
    mc.filter((c) => c.type === 'expense').forEach((c) => {
      catMap[c.category || 'Other'] =
        (catMap[c.category || 'Other'] || 0) + (c.amount || 0);
    });
    const incCatMap = {};
    mc.filter((c) => c.type === 'income').forEach((c) => {
      incCatMap[c.category || 'Other'] =
        (incCatMap[c.category || 'Other'] || 0) + (c.amount || 0);
    });
    const topExpCats = Object.entries(catMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const topIncCats = Object.entries(incCatMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const rows = [];
    rows.push([`📥 Income — ${monthLbl}`, fmt(mIncome), '#22c55e']);
    rows.push([`📤 Expenses — ${monthLbl}`, fmt(mExpense), '#ef4444']);
    rows.push(['Net Savings', fmt(mNet), mNet >= 0 ? '#22c55e' : '#ef4444']);
    if (mIncome > 0)
      rows.push([
        'Savings Rate',
        `${Math.round((mNet / mIncome) * 100)}%`,
        '#64748b',
      ]);
    rows.push([
      'Transactions This Month',
      `${mc.length} entries`,
      '#64748b',
    ]);
    rows.push(['', '', '#00000000']);
    rows.push(['Total Income (all time)', fmt(allInc), '#64748b']);
    rows.push(['Total Expense (all time)', fmt(allExp), '#64748b']);
    rows.push([
      'Net (all time)',
      fmt(allInc - allExp),
      allInc - allExp >= 0 ? '#22c55e' : '#ef4444',
    ]);

    // Recent transactions table
    const recentTx = [...mc]
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .slice(0, 10);
    const txRows = recentTx.length
      ? recentTx.map((tx) =>
          dataRow(
            [
              shortDate(tx.date),
              esc(tx.category || '—'),
              tx.type === 'income' ? '📥' : '📤',
              esc(tx.notes || '—').slice(0, 30),
              fmt(tx.amount),
            ],
            ['left', 'left', 'center', 'left', 'right'],
            [
              '#94a3b8',
              '#cbd5e1',
              tx.type === 'income' ? '#22c55e' : '#ef4444',
              '#64748b',
              tx.type === 'income' ? '#22c55e' : '#ef4444',
            ],
          ),
        )
      : [noRecords('No cashflow entries this month')];

    const txTable = dataTable(
      ['Date', 'Category', 'Type', 'Note', 'Amount'],
      txRows,
      ['left', 'left', 'center', 'left', 'right'],
    );

    const expCatRows = topExpCats.length
      ? topExpCats.map(([cat, amt]) =>
          dataRow(
            [esc(cat), fmt(amt)],
            ['left', 'right'],
            ['#cbd5e1', '#f59e0b'],
          ),
        )
      : [noRecords('No expenses this month')];
    const expCatTable = dataTable(
      ['Expense Category', 'Spent'],
      expCatRows,
      ['left', 'right'],
    );

    const incCatRows = topIncCats.length
      ? topIncCats.map(([cat, amt]) =>
          dataRow(
            [esc(cat), fmt(amt)],
            ['left', 'right'],
            ['#cbd5e1', '#22c55e'],
          ),
        )
      : [noRecords('No income this month')];
    const incCatTable = dataTable(
      ['Income Source', 'Earned'],
      incCatRows,
      ['left', 'right'],
    );

    sections.push(
      section(
        `💰 Cashflow — ${monthLbl}`,
        '#22c55e',
        `<table style="width:100%;border-collapse:collapse;margin-bottom:18px">${tableRows(rows)}</table>` +
          `<div style="display:flex;flex-wrap:wrap;gap:14px;margin-bottom:18px">
            <div style="flex:1;min-width:240px">
              <div style="color:#22c55e;font-size:12px;font-weight:600;margin-bottom:6px">📥 Top Income Sources</div>
              ${incCatTable}
            </div>
            <div style="flex:1;min-width:240px">
              <div style="color:#ef4444;font-size:12px;font-weight:600;margin-bottom:6px">📤 Top Expense Categories</div>
              ${expCatTable}
            </div>
          </div>` +
          `<div>
            <div style="color:#64748b;font-size:12px;font-weight:600;margin-bottom:6px">📝 Recent Transactions (This Month)</div>
            ${txTable}
          </div>`,
        'cashflow',
      ),
    );
  }

  // ── 2. Investments (Holdings table + breakdown) ─────────────────────────────
  if (investments.length > 0) {
    const pnlPct =
      totalInvested > 0 ? ((invPnl / totalInvested) * 100).toFixed(2) : '0';
    const stocks = investments.filter((i) => i.type === 'stock');
    const mfs = investments.filter((i) => i.type === 'mutual_fund');
    const fds = investments.filter((i) => i.type === 'fixed_deposit');
    const bonds = investments.filter((i) => i.type === 'bond');
    const others = investments.filter((i) => i.type === 'other');

    const typeBreakdown = [];
    if (stocks.length)
      typeBreakdown.push([
        'Stocks',
        `${stocks.length} · ${fmt(stocks.reduce((s, i) => s + calcCurrent(i), 0))}`,
        '#3b82f6',
      ]);
    if (mfs.length)
      typeBreakdown.push([
        'Mutual Funds',
        `${mfs.length} · ${fmt(mfs.reduce((s, i) => s + calcCurrent(i), 0))}`,
        '#8b5cf6',
      ]);
    if (fds.length)
      typeBreakdown.push([
        'Fixed Deposits',
        `${fds.length} · ${fmt(fds.reduce((s, i) => s + calcCurrent(i), 0))}`,
        '#f59e0b',
      ]);
    if (bonds.length)
      typeBreakdown.push([
        'Bonds',
        `${bonds.length} · ${fmt(bonds.reduce((s, i) => s + calcCurrent(i), 0))}`,
        '#06b6d4',
      ]);
    if (others.length)
      typeBreakdown.push([
        'Other Assets',
        `${others.length} · ${fmt(others.reduce((s, i) => s + calcCurrent(i), 0))}`,
        '#64748b',
      ]);

    const summary = [
      ['Total Holdings', `${investments.length} assets`, '#e2e8f0'],
      ['Amount Invested', fmt(totalInvested), '#94a3b8'],
      ['Current Value', fmt(totalCurrent), '#e2e8f0'],
      [
        'Unrealised P&L',
        `${invPnl >= 0 ? '+' : ''}${fmt(invPnl)} (${invPnl >= 0 ? '+' : ''}${pnlPct}%)`,
        invPnl >= 0 ? '#22c55e' : '#ef4444',
      ],
    ];

    // Top holdings table by current value
    const topHoldings = [...investments]
      .map((i) => ({
        name: i.name,
        type: i.type,
        qty: i.quantity ?? i.units ?? '—',
        price:
          i.type === 'stock'
            ? i.currentPrice ?? i.buyPrice
            : i.type === 'mutual_fund'
              ? i.nav
              : '—',
        invested: calcInvested(i),
        current: calcCurrent(i),
        pnl: calcCurrent(i) - calcInvested(i),
      }))
      .sort((a, b) => b.current - a.current)
      .slice(0, 10);

    const holdingRows = topHoldings.length
      ? topHoldings.map((h) => {
          const pnlColor = h.pnl >= 0 ? '#22c55e' : '#ef4444';
          return dataRow(
            [
              esc(h.name || 'Asset').slice(0, 24),
              esc(h.type || '').slice(0, 3),
              h.current > 0 ? fmt(h.current) : '—',
              `${h.pnl >= 0 ? '+' : ''}${fmt(h.pnl)}`,
            ],
            ['left', 'left', 'right', 'right'],
            ['#cbd5e1', '#64748b', '#e2e8f0', pnlColor],
          );
        })
      : [noRecords('No investment holdings yet')];

    const holdingsTable = dataTable(
      ['Holding', 'Type', 'Value', 'P&L'],
      holdingRows,
      ['left', 'left', 'right', 'right'],
    );

    sections.push(
      section(
        `📈 Investments (${investments.length} holdings)`,
        '#3b82f6',
        `<table style="width:100%;border-collapse:collapse;margin-bottom:14px">${tableRows([...summary, ...typeBreakdown])}</table>` +
          `<div>
            <div style="color:#64748b;font-size:12px;font-weight:600;margin-bottom:6px">🏆 Top Holdings (by Value)</div>
            ${holdingsTable}
          </div>`,
        'investments',
      ),
    );
  }

  // ── 3. Sold Trades / Realised Profits (Table) ───────────────────────────────
  if (soldTrades.length > 0) {
    const realisedPnl = soldTrades.reduce((s, t) => s + (t.profit || 0), 0);
    const monthSold = soldTrades.filter((t) =>
      (t.soldAt || t.soldDate || t.updatedAt || '').startsWith(month),
    );
    const monthPnl = monthSold.reduce((s, t) => s + (t.profit || 0), 0);

    const recentSold = [...soldTrades]
      .sort((a, b) =>
        (b.soldDate || b.soldAt || b.updatedAt || '').localeCompare(
          a.soldDate || a.soldAt || a.updatedAt || '',
        ),
      )
      .slice(0, 10);
    const soldRows = recentSold.length
      ? recentSold.map((t) => {
          const c = t.profit >= 0 ? '#22c55e' : '#ef4444';
          return dataRow(
            [
              shortDate(t.soldDate || t.soldAt || t.updatedAt),
              esc(t.investmentName || '').slice(0, 22),
              fmt(t.sellPrice),
              `${t.profit >= 0 ? '+' : ''}${fmt(t.profit)}`,
              t.profitPct ? `${t.profitPct >= 0 ? '+' : ''}${t.profitPct.toFixed(1)}%` : '—',
            ],
            ['left', 'left', 'right', 'right', 'right'],
            ['#94a3b8', '#cbd5e1', '#e2e8f0', c, c],
          );
        })
      : [noRecords('No sold trades yet')];
    const soldTable = dataTable(
      ['Sold', 'Asset', 'Sale Value', 'P&L', 'Return'],
      soldRows,
      ['left', 'left', 'right', 'right', 'right'],
    );

    const summary = [
      [
        'Total Realised P&L',
        `${realisedPnl >= 0 ? '+' : ''}${fmt(realisedPnl)}`,
        realisedPnl >= 0 ? '#22c55e' : '#ef4444',
      ],
      ['Total Trades Closed', `${soldTrades.length}`, '#e2e8f0'],
    ];
    if (monthSold.length > 0) {
      summary.push([`Closed This Month`, `${monthSold.length}`, '#94a3b8']);
      summary.push([
        `This Month P&L`,
        `${monthPnl >= 0 ? '+' : ''}${fmt(monthPnl)}`,
        monthPnl >= 0 ? '#22c55e' : '#ef4444',
      ]);
    }

    sections.push(
      section(
        '💹 Realised Profits / Sold Trades',
        '#10b981',
        `<table style="width:100%;border-collapse:collapse;margin-bottom:16px">${tableRows(summary)}</table>` +
          `<div>
            <div style="color:#64748b;font-size:12px;font-weight:600;margin-bottom:6px">📜 Recent Sales</div>
            ${soldTable}
          </div>`,
        'profits',
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP B — OBLIGATIONS & DUES
  // ═══════════════════════════════════════════════════════════════════════════
  const hasGroupB = liabilities.length > 0 || pendingPayments.length > 0 || trackedPayments.length > 0;
  if (hasGroupB) sections.push(sectionGroup('Liabilities, Dues & Payments', '🏦', '#ef4444'));

  // ── 4. Liabilities ──────────────────────────────────────────────────────────
  if (liabilities.length > 0) {
    const principal = liabilities.reduce((s, l) => s + (l.principal || 0), 0);
    const paidOff = principal - totalLiabOut;
    const liabList = liabilities.slice(0, 8).map((l) => {
      const emiText = l.emiAmount ? ` · EMI ${fmt(l.emiAmount)}` : '';
      const rateText = l.interestRate ? ` @ ${l.interestRate}%` : '';
      return dataRow(
        [
          esc(l.name || l.lenderName || 'Loan'),
          esc((l.type || '') + rateText + emiText).slice(0, 36),
          fmt(l.outstanding || 0),
          l.principal > 0
            ? `${Math.round(((l.principal - (l.outstanding || 0)) / l.principal) * 100)}%`
            : '—',
          l.status === 'paid' || l.status === 'returned' ? '✅ Paid' : l.endDate ? shortDate(l.endDate) : '—',
        ],
        ['left', 'left', 'right', 'right', 'center'],
        [
          '#cbd5e1',
          '#64748b',
          '#ef4444',
          paidOff >= 0 ? '#22c55e' : '#f59e0b',
          l.status === 'paid' ? '#22c55e' : '#94a3b8',
        ],
      );
    });
    const liabRows = liabList.length ? liabList : [noRecords()];
    const liabTable = dataTable(
      ['Loan / Liability', 'Details', 'Outstanding', 'Paid %', 'End Date'],
      liabRows,
      ['left', 'left', 'right', 'right', 'center'],
    );

    const summary = [
      ['Total Loans', `${liabilities.length}`, '#e2e8f0'],
      ['Total Principal', fmt(principal), '#94a3b8'],
      ['Total Outstanding', fmt(totalLiabOut), '#ef4444'],
      ['Paid Off', fmt(paidOff), '#22c55e'],
      [
        'Repayment Progress',
        principal > 0
          ? `${Math.round((paidOff / principal) * 100)}%`
          : '—',
        '#a78bfa',
      ],
    ];

    sections.push(
      section(
        `🏦 Liabilities (${liabilities.length} items)`,
        '#ef4444',
        `<table style="width:100%;border-collapse:collapse;margin-bottom:16px">${tableRows(summary)}</table>` +
          `<div>
            <div style="color:#64748b;font-size:12px;font-weight:600;margin-bottom:6px">📋 Loan Details</div>
            ${liabTable}
          </div>`,
        'liabilities',
      ),
    );
  }

  // ── 5. Pending Payments (Receivables) ───────────────────────────────────────
  if (pendingPayments.length > 0) {
    const pending = pendingPayments.filter((p) => p.status !== 'received');
    const receivedThisMonth = pendingPayments.filter((p) =>
      (p.receivedAt || p.saleDate || '').startsWith(month) &&
      p.status === 'received',
    );
    const recvAmt = receivedThisMonth.reduce(
      (s, p) => s + (p.amount || 0),
      0,
    );

    const ppRows = pending.slice(0, 10).map((p) => {
      const overdue =
        p.expectedPaymentDate &&
        new Date(p.expectedPaymentDate) < new Date(dateStr());
      return dataRow(
        [
          esc(p.buyerName || 'Buyer').slice(0, 18),
          esc(p.itemDescription || '').slice(0, 28),
          shortDate(p.saleDate),
          shortDate(p.expectedPaymentDate),
          fmt(p.amount || 0),
          overdue ? '🔴 Overdue' : '⏳ Pending',
        ],
        ['left', 'left', 'left', 'left', 'right', 'center'],
        [
          '#cbd5e1',
          '#94a3b8',
          '#64748b',
          overdue ? '#ef4444' : '#94a3b8',
          '#f59e0b',
          overdue ? '#ef4444' : '#f59e0b',
        ],
      );
    });
    const rows = ppRows.length ? ppRows : [noRecords('No pending receivables')];
    const ppTable = dataTable(
      ['Buyer', 'Item', 'Sale', 'Expected', 'Amount', 'Status'],
      rows,
      ['left', 'left', 'left', 'left', 'right', 'center'],
    );

    const summary = [
      ['Receivables (Pending)', fmt(pendingRecv), pendingRecv > 0 ? '#f59e0b' : '#64748b'],
      ['Pending Items', `${pending.length}`, '#e2e8f0'],
      ['Total Receivable Items', `${pendingPayments.length}`, '#94a3b8'],
    ];
    if (recvAmt > 0)
      summary.push([
        `Received — ${monthLbl}`,
        fmt(recvAmt),
        '#22c55e',
      ]);

    sections.push(
      section(
        `💵 Pending Payments (Receivables)`,
        '#f59e0b',
        `<table style="width:100%;border-collapse:collapse;margin-bottom:16px">${tableRows(summary)}</table>` +
          `<div>
            <div style="color:#64748b;font-size:12px;font-weight:600;margin-bottom:6px">📋 Outstanding Receivables</div>
            ${ppTable}
          </div>`,
        'payments',
      ),
    );
  }

  // ── 6. Tracked Payments (Payment Tracker / Dues) ────────────────────────────
  if (trackedPayments.length > 0) {
    const unpaid = trackedPayments.filter((p) => p.status !== 'paid');
    const paidThisMonth = trackedPayments.filter((p) =>
      (p.paidAt || p.dueDate || '').startsWith(month) && p.status === 'paid',
    );
    const paidAmt = paidThisMonth.reduce(
      (s, p) => s + (p.amount || 0),
      0,
    );

    const today = new Date();
    const tpRows = unpaid.slice(0, 10).map((p) => {
      const d = p.dueDate
        ? Math.ceil((new Date(p.dueDate) - today) / 86400000)
        : 999;
      let status = `${d}d`;
      let col = '#94a3b8';
      if (d < 0) {
        status = `🔴 ${-d}d overdue`;
        col = '#ef4444';
      } else if (d <= 7) {
        status = `🟠 ${d}d left`;
        col = '#f59e0b';
      } else if (d <= 30) {
        status = `🟡 ${d}d`;
        col = '#eab308';
      }
      return dataRow(
        [
          esc(p.title || 'Payment').slice(0, 22),
          esc(p.paymentType || 'custom').slice(0, 10),
          shortDate(p.dueDate),
          esc(p.recurrence || 'none').slice(0, 6),
          fmt(p.amount || 0),
          status,
        ],
        ['left', 'left', 'left', 'left', 'right', 'center'],
        ['#cbd5e1', '#64748b', '#94a3b8', '#64748b', '#f97316', col],
      );
    });
    const rows = tpRows.length ? tpRows : [noRecords('No upcoming dues — all clear!')];
    const tpTable = dataTable(
      ['Payment', 'Type', 'Due', 'Recur', 'Amount', 'Timeline'],
      rows,
      ['left', 'left', 'left', 'left', 'right', 'center'],
    );

    const summary = [
      ['Upcoming Dues (Unpaid)', fmt(duesUpcoming), duesUpcoming > 0 ? '#f97316' : '#22c55e'],
      ['Unpaid Items', `${unpaid.length}`, '#e2e8f0'],
      ['Total Tracked', `${trackedPayments.length}`, '#94a3b8'],
    ];
    if (paidAmt > 0)
      summary.push([`Paid — ${monthLbl}`, fmt(paidAmt), '#22c55e']);

    sections.push(
      section(
        `⏰ Payment Tracker (Dues & Reminders)`,
        '#f97316',
        `<table style="width:100%;border-collapse:collapse;margin-bottom:16px">${tableRows(summary)}</table>` +
          `<div>
            <div style="color:#64748b;font-size:12px;font-weight:600;margin-bottom:6px">📋 Upcoming Dues</div>
            ${tpTable}
          </div>`,
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP C — ACCOUNTS, GOALS, INSURANCE
  // ═══════════════════════════════════════════════════════════════════════════
  const hasGroupC = accounts.length > 0 || goals.length > 0 || insurancePolicies.length > 0 || 
                    sipPlanDocs.length > 0 || lendingBorrowers.length > 0 || credentials.length > 0 || 
                    networthSnapshots.length > 0 || snapshots.length > 0;
  if (hasGroupC) sections.push(sectionGroup('Accounts, Goals & Protection', '🏧', '#a78bfa'));

  // ── 7. Accounts (with type and opening bal) ─────────────────────────────────
  if (accounts.length > 0) {
    const accRows = accounts.slice(0, 10).map((a) => {
      const delta = (a.balance || 0) - (a.openingBalance || 0);
      return dataRow(
        [
          esc(a.name || 'Account'),
          (a.type || 'bank') === 'credit' ? '💳 Credit' : '🏦 Bank',
          fmt(a.balance || 0),
          a.openingBalance ? fmt(a.openingBalance) : '—',
          a.openingBalance
            ? `${delta >= 0 ? '+' : ''}${fmt(delta)}`
            : '—',
        ],
        ['left', 'left', 'right', 'right', 'right'],
        [
          '#cbd5e1',
          a.type === 'credit' ? '#ef4444' : '#22c55e',
          a.type === 'credit' && (a.balance || 0) > 0 ? '#ef4444' : '#e2e8f0',
          '#94a3b8',
          delta >= 0 ? '#22c55e' : '#ef4444',
        ],
      );
    });
    const rows = accRows.length ? accRows : [noRecords()];
    const accTable = dataTable(
      ['Account', 'Type', 'Balance', 'Opening', 'Change'],
      rows,
      ['left', 'left', 'right', 'right', 'right'],
    );

    const bankBal = accounts
      .filter((a) => a.type !== 'credit')
      .reduce((s, a) => s + (a.balance || 0), 0);
    const credBal = accounts
      .filter((a) => a.type === 'credit')
      .reduce((s, a) => s + (a.balance || 0), 0);
    const summary = [
      ['Total Balance', fmt(totalAccountBal), '#a78bfa'],
      ['Bank Accounts Balance', fmt(bankBal), '#22c55e'],
    ];
    if (credBal > 0)
      summary.push(['Credit Card Dues', fmt(credBal), '#ef4444']);

    sections.push(
      section(
        `🏧 Accounts (${accounts.length})`,
        '#a78bfa',
        `<table style="width:100%;border-collapse:collapse;margin-bottom:16px">${tableRows(summary)}</table>` +
          `<div>
            <div style="color:#64748b;font-size:12px;font-weight:600;margin-bottom:6px">📋 Account Details</div>
            ${accTable}
          </div>`,
        'accounts',
      ),
    );
  }

  // ── 8. Goals + Goal Contributions ───────────────────────────────────────────
  if (goals.length > 0) {
    const goalMapById = {};
    goals.forEach((g) => (goalMapById[g.id] = g));

    const perGoalContribs = {};
    goalContributions.forEach((c) => {
      const gid = c.goalId;
      if (!perGoalContribs[gid]) perGoalContribs[gid] = [];
      perGoalContribs[gid].push(c);
    });

    const monthContribTotal = goalContributions
      .filter((c) => (c.date || '').startsWith(month))
      .reduce((s, c) => s + (c.amount || 0), 0);

    const goalRows = goals.map((g) => {
      const pct =
        g.targetAmount > 0
          ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100))
          : 0;
      const contribs = perGoalContribs[g.id] || [];
      const contribTotal = contribs.reduce((s, c) => s + (c.amount || 0), 0);
      const bar =
        '█'.repeat(Math.round(pct / 10)) +
        '░'.repeat(10 - Math.round(pct / 10));
      const statusColor =
        pct >= 80 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444';
      const status =
        g.status === 'completed' || g.status === 'success'
          ? '✅ Done'
          : pct >= 100
            ? '✅ Funded'
            : pct >= 80
              ? '🟢 On track'
              : pct >= 40
                ? '🟡 Building'
                : '🔸 Need focus';
      return dataRow(
        [
          `${esc(g.name || 'Goal')} <span style="color:#475569">[${bar}]</span>`,
          g.dueDate ? shortDate(g.dueDate) : '—',
          `${fmt(g.currentAmount)} / ${fmt(g.targetAmount)}`,
          `${pct}%`,
          status,
          contribTotal > 0 ? fmt(contribTotal) : '—',
        ],
        ['left', 'left', 'right', 'right', 'center', 'right'],
        [
          '#cbd5e1',
          '#94a3b8',
          statusColor,
          statusColor,
          statusColor,
          '#0ea5e9',
        ],
      );
    });
    const gTable = dataTable(
      ['Goal', 'Target Date', 'Saved / Target', 'Progress', 'Status', 'Contribs'],
      goalRows,
      ['left', 'left', 'right', 'right', 'center', 'right'],
    );

    // Recent contributions table
    const recentContrib = [...goalContributions]
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .slice(0, 8);
    const rcRows = recentContrib.length
      ? recentContrib.map((c) =>
          dataRow(
            [
              shortDate(c.date),
              esc(goalMapById[c.goalId]?.name || 'Goal').slice(0, 20),
              fmt(c.amount || 0),
              esc((c.note || '—')).slice(0, 24),
            ],
            ['left', 'left', 'right', 'left'],
            ['#94a3b8', '#cbd5e1', '#0ea5e9', '#64748b'],
          ),
        )
      : [noRecords('No contributions yet — start contributing to your goals!')];
    const rcTable = dataTable(
      ['Date', 'Goal', 'Amount', 'Note'],
      rcRows,
      ['left', 'left', 'right', 'left'],
    );

    const summary = [
      ['Active Goals', `${goals.length}`, '#e2e8f0'],
      ['Total Target Amount', fmt(goals.reduce((s, g) => s + (g.targetAmount || 0), 0)), '#94a3b8'],
      ['Total Saved So Far', fmt(goals.reduce((s, g) => s + (g.currentAmount || 0), 0)), '#e2e8f0'],
    ];
    if (monthContribTotal > 0)
      summary.push([
        `Contributed — ${monthLbl}`,
        fmt(monthContribTotal),
        '#0ea5e9',
      ]);

    sections.push(
      section(
        `🎯 Goals & Contributions (${goals.length} goals)`,
        '#f59e0b',
        `<table style="width:100%;border-collapse:collapse;margin-bottom:16px">${tableRows(summary)}</table>` +
          `<div style="margin-bottom:18px">
            <div style="color:#64748b;font-size:12px;font-weight:600;margin-bottom:6px">🎯 Goal Progress</div>
            ${gTable}
          </div>` +
          `<div>
            <div style="color:#64748b;font-size:12px;font-weight:600;margin-bottom:6px">💸 Recent Contributions</div>
            ${rcTable}
          </div>`,
        'goals',
      ),
    );

    // Emergency fund focused section if present
    const ef = goals.find((g) =>
      (g.name || '').toLowerCase().includes('emergency'),
    );
    if (ef) {
      const pct =
        ef.targetAmount > 0
          ? Math.min(100, Math.round((ef.currentAmount / ef.targetAmount) * 100))
          : 0;
      const months =
        mExpense > 0 ? Math.round((ef.currentAmount / mExpense) * 10) / 10 : 0;
      sections.push(
        section(
          '🛡️ Emergency Fund Status',
          '#14b8a6',
          tableRows([
            ['Saved', fmt(ef.currentAmount), '#14b8a6'],
            ['Target', fmt(ef.targetAmount), '#94a3b8'],
            [
              'Progress',
              `${pct}%`,
              pct >= 100 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444',
            ],
            months > 0
              ? [
                  `Covers ~${months} months of expenses`,
                  months >= 6 ? '✅ Excellent' : months >= 3 ? '⚠️ Building' : '❗ Low',
                  months >= 6 ? '#22c55e' : months >= 3 ? '#f59e0b' : '#ef4444',
                ]
              : ['', '', '#00000000'],
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

  // ── 9. Insurance + Insurance Payments ───────────────────────────────────────
  if (insurancePolicies.length > 0) {
    const today = new Date();
    const expiringSoon = insurancePolicies.filter((p) => {
      if (!p.renewalDate) return false;
      const d = Math.ceil((new Date(p.renewalDate) - today) / 86400000);
      return d >= 0 && d <= 30;
    });
    const expired = insurancePolicies.filter(
      (p) => p.renewalDate && new Date(p.renewalDate) < today,
    );

    const policyMapById = {};
    insurancePolicies.forEach((p) => (policyMapById[p.id] = p));

    const yearlyPremium = insurancePolicies.reduce((s, p) => {
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
    const monthPrem = insurancePayments
      .filter((p) => (p.paidAt || '').startsWith(month))
      .reduce((s, p) => s + (p.amount || 0), 0);

    const polRows = insurancePolicies.slice(0, 10).map((p) => {
      const days = p.renewalDate
        ? Math.ceil((new Date(p.renewalDate) - today) / 86400000)
        : null;
      const note =
        days !== null
          ? days < 0
            ? '🔴 EXPIRED'
            : days <= 30
              ? `🟠 ${days}d left`
              : `🟢 ${days}d`
          : '';
      const freq =
        p.premiumFrequency === 'monthly'
          ? 'mo'
          : p.premiumFrequency === 'quarterly'
            ? 'qr'
            : p.premiumFrequency === 'half-yearly'
              ? 'hy'
              : 'yr';
      return dataRow(
        [
          `${(p.type || 'POLICY').toUpperCase()} — ${esc(p.policyName || p.provider || '')}`,
          esc(p.provider || '').slice(0, 16),
          fmt(p.coverageAmount || 0),
          `${fmt(p.premiumAmount || 0)}/${freq}`,
          p.renewalDate ? shortDate(p.renewalDate) : '—',
          note,
        ],
        ['left', 'left', 'right', 'right', 'left', 'center'],
        [
          '#cbd5e1',
          '#64748b',
          '#a78bfa',
          '#f59e0b',
          '#94a3b8',
          days !== null && days < 0
            ? '#ef4444'
            : days !== null && days <= 30
              ? '#f59e0b'
              : '#22c55e',
        ],
      );
    });
    const polTable = dataTable(
      ['Policy', 'Provider', 'Coverage', 'Premium', 'Renewal', 'Status'],
      polRows,
      ['left', 'left', 'right', 'right', 'left', 'center'],
    );

    // Insurance payments
    const recentPay = [...insurancePayments]
      .sort((a, b) => (b.paidAt || '').localeCompare(a.paidAt || ''))
      .slice(0, 6);
    const ipRows = recentPay.length
      ? recentPay.map((p) =>
          dataRow(
            [
              shortDate(p.paidAt),
              esc((policyMapById[p.policyId]?.policyName) || 'Policy').slice(0, 24),
              fmt(p.amount || 0),
              esc(p.note || '—').slice(0, 20),
            ],
            ['left', 'left', 'right', 'left'],
            ['#94a3b8', '#cbd5e1', '#22c55e', '#64748b'],
          ),
        )
      : [noRecords('No insurance payment history recorded')];
    const ipTable = dataTable(
      ['Paid', 'Policy', 'Amount', 'Note'],
      ipRows,
      ['left', 'left', 'right', 'left'],
    );

    const summary = [
      ['Total Policies', `${insurancePolicies.length}`, '#e2e8f0'],
      ['Total Coverage', fmt(totalCoverage), '#a78bfa'],
      ['Yearly Premium Est.', fmt(yearlyPremium), '#94a3b8'],
      ['Monthly Equivalent', fmt(yearlyPremium / 12), '#64748b'],
    ];
    if (monthPrem > 0)
      summary.push([`Premiums Paid — ${monthLbl}`, fmt(monthPrem), '#22c55e']);
    if (expiringSoon.length > 0)
      summary.push([
        `⏰ Renewing Soon (≤30 days)`,
        `${expiringSoon.length}`,
        '#f59e0b',
      ]);
    if (expired.length > 0)
      summary.push([`🔴 Expired Policies`, `${expired.length}`, '#ef4444']);

    sections.push(
      section(
        `🛡 Insurance (${insurancePolicies.length} policies)`,
        '#a78bfa',
        `<table style="width:100%;border-collapse:collapse;margin-bottom:16px">${tableRows(summary)}</table>` +
          `<div style="margin-bottom:18px">
            <div style="color:#64748b;font-size:12px;font-weight:600;margin-bottom:6px">📋 Policy Details</div>
            ${polTable}
          </div>` +
          `<div>
            <div style="color:#64748b;font-size:12px;font-weight:600;margin-bottom:6px">💳 Recent Premium Payments</div>
            ${ipTable}
          </div>`,
        'insurance',
      ),
    );
  }

  // ── 10. SIP Plan ────────────────────────────────────────────────────────────
  if (sipPlanDocs.length > 0) {
    const budgetDoc = sipPlanDocs.find((d) => d.type === 'budget');
    const instruments = sipPlanDocs.filter((d) => d.type === 'instrument');
    const budget = budgetDoc?.budget || 0;
    const totalPct = instruments.reduce((s, i) => s + (i.percentage || 0), 0);
    if (budget > 0 || instruments.length > 0) {
      const sipRows = [];
      if (budget > 0) sipRows.push(['Monthly SIP Budget', fmt(budget), '#22c55e']);
      if (instruments.length > 0)
        sipRows.push(['Instruments Planned', `${instruments.length}`, '#e2e8f0']);
      if (budget > 0)
        sipRows.push([
          'Allocated Amount',
          fmt((budget * totalPct) / 100),
          '#22c55e',
        ]);
      if (totalPct > 0)
        sipRows.push([
          'Allocation %',
          `${totalPct.toFixed(0)}%`,
          totalPct > 100 ? '#ef4444' : totalPct < 100 ? '#f59e0b' : '#22c55e',
        ]);
      if (budget > 0 && totalPct < 100)
        sipRows.push([
          'Unallocated (remaining)',
          fmt(budget - (budget * totalPct) / 100),
          '#f59e0b',
        ]);

      const instrTableRows = instruments.map((inst) => {
        const amt = budget > 0 ? (budget * (inst.percentage || 0)) / 100 : 0;
        return dataRow(
          [
            esc(inst.name || 'Instrument'),
            `${inst.percentage || 0}%`,
            budget > 0 ? fmt(amt) : `${inst.percentage || 0}%`,
          ],
          ['left', 'right', 'right'],
          ['#cbd5e1', '#06b6d4', '#e2e8f0'],
        );
      });
      const instTable = instrTableRows.length
        ? dataTable(
            ['Instrument', 'Allocation %', 'Amount / Month'],
            instrTableRows,
            ['left', 'right', 'right'],
          )
        : `<table style="width:100%"><tbody>${noRecords('No SIP instruments planned yet')}</tbody></table>`;

      sections.push(
        section(
          '📅 Monthly SIP Plan',
          '#06b6d4',
          `<table style="width:100%;border-collapse:collapse;margin-bottom:16px">${tableRows(sipRows)}</table>` +
            `<div>
              <div style="color:#64748b;font-size:12px;font-weight:600;margin-bottom:6px">📋 Planned Allocation</div>
              ${instTable}
            </div>`,
          'sip-plan',
        ),
      );
    }
  }

  // ── 11. Lending ─────────────────────────────────────────────────────────────
  if (lendingBorrowers.length > 0) {
    const validIds = new Set(lendingBorrowers.map((b) => b.id));
    let tGiven = 0,
      tReturned = 0,
      tInterest = 0;
    lendingTransactions.forEach((t) => {
      if (!validIds.has(t.borrowerId)) return;
      if (t.type === 'principal_given') tGiven += t.amount || 0;
      if (t.type === 'principal_returned') tReturned += t.amount || 0;
      if (t.type === 'interest_paid') tInterest += t.amount || 0;
    });
    const active = lendingBorrowers.filter((b) => b.status === 'active');

    const borrowerRows = active.slice(0, 6).map((b) => {
      const given = lendingTransactions
        .filter((t) => t.borrowerId === b.id && t.type === 'principal_given')
        .reduce((s, t) => s + (t.amount || 0), 0);
      const returned = lendingTransactions
        .filter((t) => t.borrowerId === b.id && t.type === 'principal_returned')
        .reduce((s, t) => s + (t.amount || 0), 0);
      const interest = lendingTransactions
        .filter((t) => t.borrowerId === b.id && t.type === 'interest_paid')
        .reduce((s, t) => s + (t.amount || 0), 0);
      const due = b.nextDueDate ? shortDate(b.nextDueDate) : '—';
      const days = b.nextDueDate
        ? Math.ceil((new Date(b.nextDueDate) - new Date(dateStr())) / 86400000)
        : null;
      return dataRow(
        [
          esc(b.name || 'Borrower'),
          b.interestRate ? `${b.interestRate}%` : '—',
          fmt(given - returned),
          interest > 0 ? fmt(interest) : '—',
          due,
          days !== null && days < 0 ? `🔴 ${-days}d` : b.status === 'active' ? '🟢 Active' : '⚪ Closed',
        ],
        ['left', 'right', 'right', 'right', 'left', 'center'],
        [
          '#cbd5e1',
          '#64748b',
          '#f59e0b',
          '#22c55e',
          '#94a3b8',
          days !== null && days < 0 ? '#ef4444' : '#22c55e',
        ],
      );
    });
    const bTableRows = borrowerRows.length
      ? borrowerRows
      : [noRecords('No active borrowers')];
    const bTable = dataTable(
      ['Borrower', 'Rate', 'Due', 'Interest Earned', 'Next Due', 'Status'],
      bTableRows,
      ['left', 'right', 'right', 'right', 'left', 'center'],
    );

    const summary = [
      ['Total Borrowers', `${lendingBorrowers.length}`, '#e2e8f0'],
      ['Active Accounts', `${active.length}`, '#22c55e'],
      ['Total Principal Given', fmt(tGiven), '#94a3b8'],
      ['Principal Returned', fmt(tReturned), '#22c55e'],
      ['Outstanding Balance', fmt(tGiven - tReturned), '#f59e0b'],
      ['Total Interest Earned', fmt(tInterest), '#22c55e'],
    ];

    sections.push(
      section(
        `🤝 Lending & Financing (${lendingBorrowers.length} borrowers)`,
        '#6366f1',
        `<table style="width:100%;border-collapse:collapse;margin-bottom:16px">${tableRows(summary)}</table>` +
          `<div>
            <div style="color:#64748b;font-size:12px;font-weight:600;margin-bottom:6px">📋 Active Borrowers</div>
            ${bTable}
          </div>`,
        'lending',
      ),
    );
  }

  // ── 12. Credentials (Secure summary, NO secrets) ────────────────────────────
  if (credentials.length > 0) {
    const catCounts = {};
    credentials.forEach((c) => {
      const cat = c.category || 'other';
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    });
    const staleCount = credentials.filter((c) => {
      if (!c.updatedAt) return false;
      const days = Math.floor(
        (Date.now() - new Date(c.updatedAt).getTime()) / 86400000,
      );
      return days > 365;
    }).length;

    const listRows = credentials.slice(0, 12).map((c) =>
      dataRow(
        [
          esc(c.title || 'Item').slice(0, 30),
          esc((c.category || 'other').toUpperCase()).slice(0, 8),
          c.identifier ? '✓ Recorded' : '—',
          c.updatedAt ? shortDate(c.updatedAt) : '—',
        ],
        ['left', 'left', 'center', 'left'],
        ['#cbd5e1', '#64748b', '#22c55e', '#94a3b8'],
      ),
    );
    const crTable = dataTable(
      ['Item', 'Category', 'Identifier', 'Updated'],
      listRows.length ? listRows : [noRecords()],
      ['left', 'left', 'center', 'left'],
    );

    const catSummary = Object.entries(catCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, n]) => [
        `${cat.charAt(0).toUpperCase() + cat.slice(1)}`,
        `${n} item${n > 1 ? 's' : ''}`,
        '#94a3b8',
      ]);

    const summary = [
      ['Total Stored', `${credentials.length}`, '#e2e8f0'],
      ...catSummary,
    ];
    if (staleCount > 0)
      summary.push([
        `Stale (>1yr since update)`,
        `${staleCount}`,
        '#f59e0b',
      ]);

    sections.push(
      section(
        `🔐 Credentials Vault (${credentials.length} items)`,
        '#0ea5e9',
        `<div style="background:#082f49;border:1px solid #0ea5e930;border-radius:10px;padding:12px 14px;margin-bottom:14px">
          <p style="color:#38bdf8;font-size:11.5px;margin:0;font-weight:500">🔒 For your security, passwords/secrets are never shown in email reports. Export JSON for full backup.</p>
        </div>` +
          `<table style="width:100%;border-collapse:collapse;margin-bottom:16px">${tableRows(summary)}</table>` +
          `<div>
            <div style="color:#64748b;font-size:12px;font-weight:600;margin-bottom:6px">📋 Stored Items (Summary)</div>
            ${crTable}
          </div>`,
        'credentials',
      ),
    );
  }

  // ── 13. Net Worth & Portfolio Snapshots ─────────────────────────────────────
  if (networthSnapshots.length > 0 || snapshots.length > 0) {
    const nwRows = [];
    if (networthSnapshots.length > 0) {
      const sortedNw = [...networthSnapshots].sort((a, b) =>
        (a.createdAt || '').localeCompare(b.createdAt || ''),
      );
      const latest = sortedNw[sortedNw.length - 1];
      const first = sortedNw[0];
      const nwChange =
        sortedNw.length > 1 ? latest.netWorth - first.netWorth : 0;
      nwRows.push([
        'Latest Net Worth',
        fmt(latest.netWorth || 0),
        '#14b8a6',
      ]);
      nwRows.push(['Total Assets', fmt(latest.totalAssets || 0), '#22c55e']);
      nwRows.push([
        'Total Liabilities',
        fmt(latest.totalLiabilities || 0),
        '#ef4444',
      ]);
      nwRows.push([
        'Snapshots Recorded',
        `${sortedNw.length}`,
        '#94a3b8',
      ]);
      if (sortedNw.length > 1) {
        nwRows.push([
          'Change Since First',
          `${nwChange >= 0 ? '+' : ''}${fmt(nwChange)}`,
          nwChange >= 0 ? '#22c55e' : '#ef4444',
        ]);
        nwRows.push([
          'First Snapshot',
          first.createdAt?.slice(0, 10) || '—',
          '#64748b',
        ]);
      }
      nwRows.push([
        'Latest Snapshot',
        latest.createdAt?.slice(0, 10) || '—',
        '#64748b',
      ]);

      // Snapshot history table
      const histRows = sortedNw
        .slice(-8)
        .reverse()
        .map((s) =>
          dataRow(
            [
              s.createdAt?.slice(0, 10) || '—',
              s.label ? esc(s.label).slice(0, 18) : '—',
              fmt(s.totalAssets || 0),
              fmt(s.totalLiabilities || 0),
              fmt(s.netWorth || 0),
            ],
            ['left', 'left', 'right', 'right', 'right'],
            ['#94a3b8', '#64748b', '#22c55e', '#ef4444', '#14b8a6'],
          ),
        );
      const histTable = dataTable(
        ['Date', 'Label', 'Assets', 'Liabilities', 'Net Worth'],
        histRows,
        ['left', 'left', 'right', 'right', 'right'],
      );
      nwRows.push(['', '', '#00000000']);

      sections.push(
        section(
          `📜 Net Worth History (${sortedNw.length} snapshots)`,
          '#14b8a6',
          `<table style="width:100%;border-collapse:collapse;margin-bottom:16px">${tableRows(nwRows)}</table>` +
            `<div>
              <div style="color:#64748b;font-size:12px;font-weight:600;margin-bottom:6px">📈 Recent Snapshots</div>
              ${histTable}
            </div>`,
          'net-worth',
        ),
      );
    }

    // Portfolio snapshots
    if (snapshots.length > 0 && networthSnapshots.length === 0) {
      const sorted = [...snapshots].sort((a, b) =>
        (a.date || '').localeCompare(b.date || ''),
      );
      const latest = sorted[sorted.length - 1];
      sections.push(
        section(
          `📈 Portfolio Value Snapshots (${sorted.length})`,
          '#0ea5e9',
          tableRows([
            ['Latest Value', fmt(latest?.totalValue || 0), '#3b82f6'],
            [
              'Latest Date',
              latest?.date || '—',
              '#64748b',
            ],
          ]),
        ),
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP D — AGRICULTURE & FARM
  // ═══════════════════════════════════════════════════════════════════════════
  // hasAgriData is pre-computed above near allData

  if (hasAgriData) {
    sections.push(sectionGroup('Agriculture & Farm', '🌾', '#4ade80'));

    const agriRows = [];
    let cropIncomeMonth = 0;
    let produceIncomeMonth = 0;
    let milkIncomeMonth = 0;
    let coconutIncomeMonth = 0;
    let farmExpMonth = 0;

    if (agriFields.length > 0) {
      const totalAcres = agriFields.reduce((s, f) => s + (f.areAcres || 0), 0);
      agriRows.push([
        'Total Fields',
        `${agriFields.length} (${totalAcres.toFixed(1)} acres)`,
        '#4ade80',
      ]);
    }

    if (agriLivestock.length > 0) {
      const totalLivestock = agriLivestock.reduce((s, l) => s + (l.count || 0), 0);
      const liveValue = agriLivestock.reduce(
        (s, l) => s + (l.currentValue || 0),
        0,
      );
      agriRows.push([
        'Livestock Count',
        `${totalLivestock} animals`,
        '#f59e0b',
      ]);
      agriRows.push(['Livestock Value', fmt(liveValue), '#a78bfa']);

      // Livestock detail table
      const liveRows = agriLivestock.slice(0, 8).map((l) =>
        dataRow(
          [
            l.type?.toUpperCase() || '—',
            esc(l.name || 'Herd').slice(0, 18),
            `${l.count || 0}`,
            fmt(l.currentValue || 0),
          ],
          ['left', 'left', 'right', 'right'],
          ['#22c55e', '#cbd5e1', '#f59e0b', '#a78bfa'],
        ),
      );
      const liveTable = dataTable(
        ['Type', 'Name/Herd', 'Count', 'Value'],
        liveRows,
        ['left', 'left', 'right', 'right'],
      );
      sections.push(
        section(
          `🐄 Livestock Inventory (${agriLivestock.length})`,
          '#22c55e',
          `<div>${liveTable}</div>`,
        ),
      );
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
      cropIncomeMonth = harvestedCrops
        .filter((c) =>
          (c.actualHarvestDate || c.expectedHarvestDate || '').startsWith(month),
        )
        .reduce((s, c) => s + (c.harvestIncome || 0), 0);
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
      if (cropIncomeMonth > 0)
        agriRows.push([
          `Crop Income — ${monthLbl}`,
          fmt(cropIncomeMonth),
          '#22c55e',
        ]);
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

      // Crops table
      const cropRows = agriCropCycles.slice(0, 8).map((c) => {
        const isHarvested = !!c.actualHarvestDate;
        return dataRow(
          [
            esc(c.cropName || 'Crop'),
            esc(c.fieldName || '—').slice(0, 14),
            shortDate(c.startDate),
            isHarvested ? `✅ ${shortDate(c.actualHarvestDate)}` : `🌱 ${shortDate(c.expectedHarvestDate)}`,
            fmt(c.investedAmount || 0),
            isHarvested ? fmt(c.harvestIncome || 0) : '—',
            isHarvested
              ? `${(c.harvestIncome || 0) - (c.investedAmount || 0) >= 0 ? '+' : ''}${fmt((c.harvestIncome || 0) - (c.investedAmount || 0))}`
              : '🌱 Growing',
          ],
          ['left', 'left', 'left', 'left', 'right', 'right', 'right'],
          [
            '#cbd5e1',
            '#64748b',
            '#94a3b8',
            isHarvested ? '#22c55e' : '#f59e0b',
            '#ef4444',
            isHarvested ? '#22c55e' : '#64748b',
            isHarvested
              ? (c.harvestIncome || 0) - (c.investedAmount || 0) >= 0
                ? '#22c55e'
                : '#ef4444'
              : '#f59e0b',
          ],
        );
      });
      const cropTable = dataTable(
        ['Crop', 'Field', 'Planted', 'Harvest', 'Invested', 'Income', 'P&L'],
        cropRows,
        ['left', 'left', 'left', 'left', 'right', 'right', 'right'],
      );
      sections.push(
        section(
          `🌱 Crop Cycles (${activeCrops.length} active · ${harvestedCrops.length} harvested)`,
          '#4ade80',
          `<div>${cropTable}</div>`,
        ),
      );
    }

    if (agriExpenses.length > 0) {
      const allFarmExp = agriExpenses.reduce((s, e) => s + (e.amount || 0), 0);
      farmExpMonth = agriExpenses
        .filter((e) => (e.date || '').startsWith(month))
        .reduce((s, e) => s + (e.amount || 0), 0);
      agriRows.push(['Farm Expenses (all time)', fmt(allFarmExp), '#ef4444']);
      if (farmExpMonth > 0)
        agriRows.push([
          `Farm Expenses — ${monthLbl}`,
          fmt(farmExpMonth),
          '#ef4444',
        ]);
    }

    if (agriMilkRecords.length > 0) {
      const milkMonth = agriMilkRecords.filter((m) =>
        (m.date || '').startsWith(month),
      );
      const milkLiters = milkMonth.reduce((s, m) => s + (m.liters || 0), 0);
      milkIncomeMonth = milkMonth.reduce(
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
          fmt(milkIncomeMonth),
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
      coconutIncomeMonth = agriCoconut
        .filter((c) => (c.date || '').startsWith(month))
        .reduce((s, c) => s + (c.harvestIncome || 0), 0);
      agriRows.push([
        `Coconut Harvests (${totalCoconuts.toLocaleString()} nuts)`,
        fmt(cocIncome),
        '#f59e0b',
      ]);
      if (coconutIncomeMonth > 0)
        agriRows.push([
          `Coconut — ${monthLbl}`,
          fmt(coconutIncomeMonth),
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
      produceIncomeMonth = produceMonth.reduce(
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

      // Produce table
      const produceRows = [...agriProduceSales]
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
        .slice(0, 8)
        .map((p) =>
          dataRow(
            [
              shortDate(p.date),
              esc(p.produceName || 'Produce').slice(0, 18),
              `${p.quantity || 0} ${p.unit || ''}`,
              fmt(p.totalAmount || 0),
              esc(p.soldTo || '—').slice(0, 14),
            ],
            ['left', 'left', 'right', 'right', 'left'],
            ['#94a3b8', '#cbd5e1', '#f59e0b', '#22c55e', '#64748b'],
          ),
        );
      const produceTable = dataTable(
        ['Date', 'Produce', 'Qty', 'Amount', 'Sold To'],
        produceRows,
        ['left', 'left', 'right', 'right', 'left'],
      );
      sections.push(
        section(
          `🥬 Produce Sales (${agriProduceSales.length} lots)`,
          '#22c55e',
          `<div>${produceTable}</div>`,
        ),
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
        agriRows.push(['Total Livestock (Events)', `${total} animals`, '#94a3b8']);
        Object.entries(counts).forEach(([type, cnt]) =>
          agriRows.push([
            `  ${type.charAt(0).toUpperCase() + type.slice(1)}`,
            `${cnt}`,
            '#64748b',
          ]),
        );
      }
    }

    // Month total farm income
    const farmIncomeMonth =
      cropIncomeMonth + produceIncomeMonth + milkIncomeMonth + coconutIncomeMonth;
    if (farmIncomeMonth > 0 || farmExpMonth > 0) {
      agriRows.unshift([
        '',
        '',
        '#00000000',
      ]);
      agriRows.unshift([
        `Net Farm — ${monthLbl}`,
        farmIncomeMonth - farmExpMonth >= 0
          ? `+${fmt(farmIncomeMonth - farmExpMonth)}`
          : `-${fmt(farmExpMonth - farmIncomeMonth)}`,
        farmIncomeMonth - farmExpMonth >= 0 ? '#22c55e' : '#ef4444',
      ]);
      if (farmIncomeMonth > 0)
        agriRows.unshift([
          `Farm Income — ${monthLbl}`,
          fmt(farmIncomeMonth),
          '#22c55e',
        ]);
    }

    if (agriRows.length > 0)
      sections.push(
        section(
          '🌾 Agriculture — Summary',
          '#4ade80',
          `<table style="width:100%;border-collapse:collapse">${tableRows(agriRows)}</table>`,
          'agriculture',
        ),
      );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP E — WORKFORCE / ATTENDANCE
  // ═══════════════════════════════════════════════════════════════════════════
  if (attEmployees.length > 0) {
    sections.push(sectionGroup('Farm Workers & Attendance', '👷', '#60a5fa'));

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

    // Per-worker attendance table
    const workerRows = attEmployees.slice(0, 10).map((emp) => {
      const empAtt = monthAtt.filter((r) => r.employeeId === emp.id);
      const empPresent = empAtt.filter((r) => r.present).length;
      const empAbsent = empAtt.filter((r) => !r.present).length;
      const empWages = empAtt.reduce(
        (s, r) => s + (r.present ? (r.wage || 0) + (r.extraWork || 0) : 0),
        0,
      );
      const empAdv = attTransactions
        .filter(
          (t) =>
            t.employeeId === emp.id &&
            t.type === 'advance' &&
            (t.date || '').startsWith(month),
        )
        .reduce((s, t) => s + (t.amount || 0), 0);
      return dataRow(
        [
          esc(emp.name || 'Worker'),
          `${empPresent}d`,
          `${empAbsent}d`,
          fmt(empWages),
          empAdv > 0 ? fmt(empAdv) : '—',
          emp.phone ? esc(emp.phone).slice(0, 12) : '—',
        ],
        ['left', 'right', 'right', 'right', 'right', 'left'],
        [
          '#cbd5e1',
          '#22c55e',
          '#ef4444',
          '#e2e8f0',
          '#f59e0b',
          '#64748b',
        ],
      );
    });
    const wTable = dataTable(
      ['Worker', 'Present', 'Absent', 'Wages', 'Advance', 'Phone'],
      workerRows,
      ['left', 'right', 'right', 'right', 'right', 'left'],
    );

    // Salary / Payment summary table
    const salaryRows = attSalary
      .filter((s) => s.month === month)
      .slice(0, 8)
      .map((s) => {
        const payStatus =
          s.paymentStatus === 'paid'
            ? '✅ Paid'
            : s.paymentStatus === 'partially_paid'
              ? '🟡 Partial'
              : '🔴 Unpaid';
        const payColor =
          s.paymentStatus === 'paid'
            ? '#22c55e'
            : s.paymentStatus === 'partially_paid'
              ? '#f59e0b'
              : '#ef4444';
        return dataRow(
          [
            esc(empMap[s.employeeId] || 'Worker'),
            `${s.daysWorked || 0}d`,
            fmt(s.baseSalary || 0),
            fmt(s.extraWork || 0),
            s.advance ? `-${fmt(s.advance)}` : '—',
            fmt(s.netPayable || s.finalSalary || 0),
            payStatus,
          ],
          ['left', 'right', 'right', 'right', 'right', 'right', 'center'],
          [
            '#cbd5e1',
            '#94a3b8',
            '#e2e8f0',
            '#22c55e',
            '#f59e0b',
            payColor,
            payColor,
          ],
        );
      });
    const sTableRows = salaryRows.length
      ? salaryRows
      : [noRecords('No salary records for this month yet')];
    const sTable = dataTable(
      ['Worker', 'Days', 'Base', 'Extra', 'Advance', 'Net Payable', 'Status'],
      sTableRows,
      ['left', 'right', 'right', 'right', 'right', 'right', 'center'],
    );

    const summary = [
      ['Total Workers', `${attEmployees.length}`, '#e2e8f0'],
      ['Days Present This Month', `${present}`, '#22c55e'],
      ['Days Absent This Month', `${absent}`, '#ef4444'],
      ['Wages Earned — This Month', fmt(wages), '#22c55e'],
    ];
    if (advances > 0)
      summary.push(['Advances Given — This Month', fmt(advances), '#f59e0b']);
    if (allAdv > 0)
      summary.push(['Total Advances (all time)', fmt(allAdv), '#64748b']);
    if (unpaid.length > 0) {
      summary.push([
        `⚠ Pending Salary (${monthLbl})`,
        `${unpaid.length} worker(s)`,
        '#ef4444',
      ]);
      const unpaidAmt = unpaid.reduce(
        (s, u) => s + (u.netPayable || u.finalSalary || 0),
        0,
      );
      summary.push(['Pending Salary Amount', fmt(unpaidAmt), '#f59e0b']);
    }

    sections.push(
      section(
        `👷 Farm Workers — ${monthLbl}`,
        '#60a5fa',
        `<table style="width:100%;border-collapse:collapse;margin-bottom:18px">${tableRows(summary)}</table>` +
          `<div style="margin-bottom:18px">
            <div style="color:#64748b;font-size:12px;font-weight:600;margin-bottom:6px">📋 Attendance This Month</div>
            ${wTable}
          </div>` +
          `<div>
            <div style="color:#64748b;font-size:12px;font-weight:600;margin-bottom:6px">💰 Salary Summary — ${monthLbl}</div>
            ${sTable}
          </div>`,
        'workers',
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Empty state
  // ═══════════════════════════════════════════════════════════════════════════
  if (sections.length <= 3) {
    // Nothing beyond header/TCC rendered
    sections.push(`<div style="text-align:center;padding:30px 16px"><div style="font-size:38px;margin-bottom:14px">👋</div>
      <p style="color:#94a3b8;font-size:15px;margin:0 0 6px;font-weight:500">Your FinTrackly account is active.</p>
      <p style="color:#64748b;font-size:13px;margin:0">Start adding investments, cashflows, goals, and farm records to see your comprehensive monthly summary here.</p></div>`);
  }

  // Build overview section content
  const overviewCards = [
    summaryCard('Net Worth', fmt(netWorth), '#f8fafc', 'Assets − Liabilities'),
    summaryCard(
      'Month Savings',
      fmtSigned(mNet),
      mNet >= 0 ? '#22c55e' : '#ef4444',
      `${monthLbl}`,
    ),
    summaryCard(
      'Investments',
      fmt(totalCurrent),
      '#3b82f6',
      `${investments.length} holdings`,
    ),
    summaryCard('Cash in Bank', fmt(totalAccountBal), '#a78bfa', `${accounts.length} accounts`),
  ];
  const overviewContent =
    `<div style="background:#1e293b;border:1px solid #334155;border-radius:16px;padding:22px 20px;margin-bottom:22px">
      <h2 style="color:#f1f5f9;font-size:16px;margin:0 0 14px;font-weight:600">💡 This Month At a Glance</h2>
      <div style="display:flex;flex-wrap:wrap;margin:-4px">${overviewCards.join('')}</div>
    </div>`;

  return { sections, allData, settingsDoc, monthLbl, overview: overviewContent };
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

      const { sections, allData, settingsDoc, monthLbl, overview } =
        await buildReportAndData(user.uid);

      // In test mode, warn but still send so you can preview the empty state
      if (!hasAnyData(allData)) {
        console.log('  ⚠️  Warning: this user has no data — sending empty report preview anyway (test mode).');
      }

      // Build attachments
      const attachments = [];
      let attachmentSummary = null;

      if (!skipAttachments) {
        // JSON backup — exact same format as Settings → Export JSON
        const jsonPayload = buildBackupJSON(allData, settingsDoc);
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

      const html = emailTemplate(sections, monthLbl, attachmentSummary, overview);

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
      const { sections, allData, settingsDoc, monthLbl, overview } =
        await buildReportAndData(user.uid);

      // ── Skip users with no data at all ─────────────────────────────────────
      if (!hasAnyData(allData)) {
        console.log(`  ↳ skipped (no data) → ${user.email}`);
        continue;
      }

      const attachments = [];
      let attachmentSummary = null;

      if (!skipAttachments) {
        // JSON backup — exact same format as Settings → Export JSON
        const jsonPayload = buildBackupJSON(allData, settingsDoc);
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

      const html = emailTemplate(sections, monthLbl, attachmentSummary, overview);
      await transporter.sendMail({
        from: `"${FROM_NAME}" <${process.env.GMAIL_USER}>`,
        to: user.email,
        subject: `📊 Your FinTrackly Monthly Report — ${currentMonthLabel()}`,
        html,
        attachments,
      });
      console.log(`✓ sent → ${user.email}`);
      sent++;
      await new Promise((r) => setTimeout(r, 800));
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
