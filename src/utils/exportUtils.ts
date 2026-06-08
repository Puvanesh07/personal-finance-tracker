// src/utils/exportUtils.ts
//
// UPDATED v8:
//  • Goals CSV: now includes Status, Completed At columns
//  • Goal Contributions CSV: new section — date, amount, note per goal
//  • Liabilities CSV: now includes Status, Returned At columns
//  • Investments CSV: EPF shows as "EPF / PF" in the Type column
//  • All other sections unchanged

import type {
  Account,
  Goal,
  Investment,
  Liability,
} from '../types/investmentTypes';
import {
  currentValue,
  investedValue,
  profitLoss,
  typeLabel,
} from './calculations';

import ExcelJS from 'exceljs';
import autoTable from 'jspdf-autotable';
import jsPDF from 'jspdf';
import { saveAs } from 'file-saver';

// ── Investment row flattening ────────────────────────────────────────────────

function assetTypeLabel(assetType?: string): string {
  const map: Record<string, string> = {
    gold: 'Gold',
    silver: 'Silver',
    crypto: 'Crypto',
    real_estate: 'Real Estate',
    ppf: 'PPF',
    nps: 'NPS',
    epf: 'EPF / PF', // ← NEW
    international_equity: 'Intl. Equity',
    other: 'Other',
  };
  return assetType ? (map[assetType] ?? assetType) : '';
}

export function toFlatInvestmentRows(investments: Investment[]) {
  return investments.map((inv) => ({
    Type: typeLabel(inv.type),
    'Asset Sub-Type': (inv as any).assetType
      ? assetTypeLabel((inv as any).assetType)
      : '',
    Name: inv.name,
    Symbol: (inv as any).symbol ?? '',
    Platform: (inv as any).platform ?? '',
    Invested: investedValue(inv),
    'Current Value': currentValue(inv),
    'P&L': profitLoss(inv),
    'Updated At': inv.updatedAt,
  }));
}

// ── Account row flattening ────────────────────────────────────────────────────

function toFlatAccountRows(accounts: Account[]) {
  return accounts.map((a) => ({
    Name: a.name,
    Type: a.type === 'bank' ? 'Bank Account' : 'Credit Card',
    Balance: a.balance,
    'Created At': a.createdAt,
  }));
}

// ── Cashflow row flattening (resolves account name) ─────────────────────────

function toFlatCashflowRows(cashflows: any[], accounts: Account[]) {
  const accountMap: Record<string, string> = {};
  for (const a of accounts) accountMap[a.id] = a.name;

  return cashflows.map((cf) => ({
    Date: cf.date,
    Type: cf.type,
    Category: cf.category,
    Account: cf.accountId ? (accountMap[cf.accountId] ?? cf.accountId) : '',
    Amount: cf.amount,
    Notes: cf.notes ?? '',
  }));
}

// ── Generic CSV exporter ─────────────────────────────────────────────────────

/** CSV for a subset of investments (same columns as full portfolio export). */
export function exportInvestmentsCSV(
  investments: Investment[],
  filename = 'investments-selection.csv',
) {
  const rows = toFlatInvestmentRows(investments);
  if (rows.length === 0) return;
  exportCSV(rows, filename);
}

/** CSV for cashflow rows with account names resolved. */
export function exportCashflowsCSV(
  cashflows: any[],
  accounts: Account[],
  filename = 'cashflow-selection.csv',
) {
  const rows = toFlatCashflowRows(cashflows, accounts);
  if (rows.length === 0) return;
  exportCSV(rows, filename);
}

export function exportGoalsCSV(
  goals: Goal[],
  filename = 'goals-selection.csv',
) {
  if (!goals?.length) return;
  exportCSV(
    goals.map((g) => ({
      Name: g.name,
      'Target (₹)': g.targetAmount,
      'Current (₹)': g.currentAmount,
      'Due Date': g.dueDate ?? '',
      Status: g.status ?? '',
      'Completed At': g.completedAt ?? '',
    })),
    filename,
  );
}

export function exportTrackedPaymentsCSV(
  rows: import('../types/investmentTypes').TrackedPayment[],
  filename = 'payment-tracker.csv',
) {
  if (!rows?.length) return;
  exportCSV(
    rows.map((p) => ({
      Title: p.title,
      Type: p.paymentType,
      Amount: p.amount,
      'Due Date': p.dueDate,
      Status: p.status,
      'Paid At': p.paidAt ?? '',
      Recurrence: p.recurrence,
      'Reminder Days': p.reminderDays.join(', '),
      Notes: p.notes ?? '',
    })),
    filename,
  );
}

export function exportLiabilitiesCSV(
  rows: Liability[],
  filename = 'liabilities-selection.csv',
) {
  if (!rows?.length) return;
  exportCSV(
    rows.map((l) => ({
      Type: l.type,
      Name: l.name,
      Principal: l.principal,
      Outstanding: l.outstanding,
      'Interest %': l.interestRate ?? '',
      'Start Date': l.startDate ?? '',
      'End Date': l.endDate ?? '',
      Status: l.status ?? '',
      'Returned At': l.returnedAt ?? '',
    })),
    filename,
  );
}

export function exportCSV(data: any[], filename = 'data.csv') {
  if (!data || data.length === 0) return;

  const headers = Object.keys(data[0]);

  const escapeCell = (v: unknown) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };

  const csvContent =
    [
      headers.join(','),
      ...data.map((row) => headers.map((h) => escapeCell(row[h])).join(',')),
    ].join('\n') + '\n';

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, filename);
}

// ── Build all CSV blobs in memory (for email attachment / ZIP) ────────────────

export type CsvAttachment = { filename: string; content: string };

export function buildAllCSVBlobs(
  state: any,
  agriState?: any,
  attState?: any,
): CsvAttachment[] {
  const attachments: CsvAttachment[] = [];
  const accounts: Account[] = state.accounts ?? [];

  const toCSVString = (data: any[]): string => {
    if (!data || data.length === 0) return '';
    const headers = Object.keys(data[0]);
    const escapeCell = (v: unknown) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
    };
    return (
      [
        headers.join(','),
        ...data.map((row) => headers.map((h) => escapeCell(row[h])).join(',')),
      ].join('\n') + '\n'
    );
  };

  // ── Investments ──────────────────────────────────────────────────────────
  if (state.investments?.length) {
    attachments.push({
      filename: 'investments.csv',
      content: toCSVString(toFlatInvestmentRows(state.investments)),
    });
  }

  // ── Sold Trades / Profits ────────────────────────────────────────────────
  if (state.soldTrades?.length) {
    attachments.push({
      filename: 'profits.csv',
      content: toCSVString(
        state.soldTrades.map((t: any) => ({
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

  // ── Liabilities — UPDATED: includes Status and Returned At ──────────────
  if (state.liabilities?.length) {
    attachments.push({
      filename: 'liabilities.csv',
      content: toCSVString(
        state.liabilities.map((l: any) => ({
          Name: l.name,
          Type:
            l.type === 'loan'
              ? 'Bank Loan'
              : l.type === 'credit_card'
                ? 'Credit Card'
                : 'Personal / Hand Loan',
          Principal: l.principal,
          Outstanding: l.outstanding,
          'Interest Rate (%)': l.interestRate ?? '',
          'Start Date': l.startDate ?? '',
          'Due Date': l.endDate ?? '',
          'EMI Amount': l.emiAmount ?? '',
          'EMI Day': l.emiDay ?? '',
          Status: l.status ?? 'active', // ← NEW
          'Returned At': l.returnedAt ?? '', // ← NEW
        })),
      ),
    });
  }

  // ── Cashflows ────────────────────────────────────────────────────────────
  if (state.cashflows?.length) {
    attachments.push({
      filename: 'cashflows.csv',
      content: toCSVString(toFlatCashflowRows(state.cashflows, accounts)),
    });
  }

  // ── Goals — UPDATED: includes Status, Completed At ──────────────────────
  if (state.goals?.length) {
    attachments.push({
      filename: 'goals.csv',
      content: toCSVString(
        state.goals.map((g: any) => ({
          Name: g.name,
          'Target Amount': g.targetAmount,
          'Current Amount': g.currentAmount,
          Progress:
            g.targetAmount > 0
              ? `${Math.round((g.currentAmount / g.targetAmount) * 100)}%`
              : '0%',
          'Due Date': g.dueDate ?? '',
          Status: g.status ?? 'active', // ← NEW
          'Completed At': g.completedAt ?? '', // ← NEW
        })),
      ),
    });
  }

  // ── Goal Contributions — NEW v8 ──────────────────────────────────────────
  if (state.goalContributions?.length) {
    // Build a map of goalId → goalName for readable output
    const goalNameMap: Record<string, string> = {};
    (state.goals ?? []).forEach((g: any) => {
      goalNameMap[g.id] = g.name;
    });

    attachments.push({
      filename: 'goal-contributions.csv',
      content: toCSVString(
        state.goalContributions.map((c: any) => ({
          'Goal Name': goalNameMap[c.goalId] ?? c.goalId,
          Date: c.date,
          'Amount (₹)': c.amount,
          Note: c.note ?? '',
          'Added At': c.createdAt ?? '',
        })),
      ),
    });
  }

  // ── Accounts ─────────────────────────────────────────────────────────────
  if (accounts.length) {
    attachments.push({
      filename: 'accounts.csv',
      content: toCSVString(toFlatAccountRows(accounts)),
    });
  }

  // ── Insurance ────────────────────────────────────────────────────────────
  if (state.insurancePolicies?.length) {
    attachments.push({
      filename: 'insurance-policies.csv',
      content: toCSVString(
        state.insurancePolicies.map((p: any) => ({
          Type: p.type,
          Provider: p.provider,
          'Policy Name': p.policyName,
          'Coverage Amount': p.coverageAmount,
          'Premium Amount': p.premiumAmount,
          'Premium Frequency': p.premiumFrequency,
          'Renewal Date': p.renewalDate,
          'Policy Number': p.policyNumber ?? '',
          Nominee: p.nominee ?? '',
        })),
      ),
    });
  }

  if (state.insurancePayments?.length) {
    attachments.push({
      filename: 'insurance-payments.csv',
      content: toCSVString(
        state.insurancePayments.map((p: any) => ({
          'Policy ID': p.policyId,
          'Paid At': p.paidAt,
          'Amount (₹)': p.amount,
          Note: p.note ?? '',
        })),
      ),
    });
  }

  // ── Lending / Financier ───────────────────────────────────────────────────
  if (state.lendingBorrowers?.length) {
    const bMap = new Map<string, string>();
    state.lendingBorrowers.forEach((b: any) => bMap.set(b.id, b.name));

    attachments.push({
      filename: 'lending-borrowers.csv',
      content: toCSVString(
        state.lendingBorrowers.map((b: any) => ({
          Name: b.name,
          Phone: b.phone ?? '',
          Status: b.status,
          'Interest Rate (%)': b.interestRate ?? '',
          'Due Date': b.nextDueDate ?? '',
          Notes: b.notes ?? '',
        })),
      ),
    });

    if (state.lendingTransactions?.length) {
      attachments.push({
        filename: 'lending-transactions.csv',
        content: toCSVString(
          state.lendingTransactions.map((tx: any) => ({
            Date: tx.date,
            Borrower: bMap.get(tx.borrowerId) || 'Unknown',
            Type: tx.type,
            'Amount (₹)': tx.amount,
            Notes: tx.notes ?? '',
          })),
        ),
      });
    }
  }

  // ── SIP Plans ────────────────────────────────────────────────────────────
  if (state.sipPlans?.length) {
    attachments.push({
      filename: 'sip-plans.csv',
      content: toCSVString(
        state.sipPlans.map((s: any) => ({
          Name: s.name ?? '',
          'Monthly Amount': s.monthlyAmount ?? '',
          'Started At': s.startedAt ?? '',
          Notes: s.notes ?? '',
        })),
      ),
    });
  }

  // ── Agriculture ──────────────────────────────────────────────────────────
  if (agriState) {
    if (agriState.fields?.length) {
      attachments.push({
        filename: 'agri-fields.csv',
        content: toCSVString(
          agriState.fields.map((f: any) => ({
            Name: f.name,
            'Area (Acres)': f.areAcres,
            Location: f.location ?? '',
            'Soil Type': f.soilType ?? '',
            'Created At': f.createdAt,
          })),
        ),
      });
    }
    if (agriState.cropCycles?.length) {
      attachments.push({
        filename: 'agri-crops.csv',
        content: toCSVString(
          agriState.cropCycles.map((c: any) => ({
            'Crop Name': c.cropName,
            Field: c.fieldName ?? c.fieldId ?? '',
            Season: c.season,
            'Start Date': c.startDate,
            'Harvest Date': c.actualHarvestDate ?? c.expectedHarvestDate ?? '',
            'Invested Amount': c.investedAmount,
            'Harvest Income': c.harvestIncome,
            'Profit/Loss': c.harvestIncome - c.investedAmount,
            Notes: c.notes ?? '',
          })),
        ),
      });
    }
    if (agriState.agriExpenses?.length) {
      attachments.push({
        filename: 'agri-expenses.csv',
        content: toCSVString(
          agriState.agriExpenses.map((e: any) => ({
            Date: e.date,
            Category: e.category,
            'Amount (₹)': e.amount,
            Notes: e.notes ?? '',
          })),
        ),
      });
    }
    if (agriState.milkRecords?.length) {
      attachments.push({
        filename: 'agri-milk.csv',
        content: toCSVString(
          agriState.milkRecords.map((m: any) => ({
            Date: m.date,
            Liters: m.liters,
            'Price/Liter': m.pricePerLiter,
            Income: m.liters * m.pricePerLiter,
            'Sold To': m.soldTo ?? '',
          })),
        ),
      });
    }
    if (agriState.coconutRecords?.length) {
      attachments.push({
        filename: 'agri-coconut.csv',
        content: toCSVString(
          agriState.coconutRecords.map((c: any) => ({
            Date: c.date,
            Trees: c.numberOfTrees,
            'Total Coconuts': c.totalCoconuts,
            'Sell Method': c.sellMethod,
            'Price/Coconut': c.pricePerCoconut ?? '',
            'Total Tons': c.totalTons ?? '',
            'Price/Ton': c.pricePerTon ?? '',
            'Harvest Income': c.harvestIncome,
            Investment: c.investmentAmount,
            Profit: c.harvestIncome - c.investmentAmount,
            Notes: c.notes ?? '',
          })),
        ),
      });
    }
    if (agriState.produceSales?.length) {
      attachments.push({
        filename: 'agri-produce-sales.csv',
        content: toCSVString(
          agriState.produceSales.map((p: any) => ({
            Date: p.date,
            'Produce Name': p.produceName,
            Category: p.category,
            Unit: p.unit,
            Quantity: p.quantity,
            'Price/Unit': p.pricePerUnit,
            'Commission (₹)': p.commissionAmount ?? 0,
            'Total Amount (₹)': p.totalAmount,
            'Sold To': p.soldTo ?? '',
            Notes: p.notes ?? '',
          })),
        ),
      });
    }
    if (agriState.livestockEvents?.length) {
      attachments.push({
        filename: 'agri-livestock-events.csv',
        content: toCSVString(
          agriState.livestockEvents.map((e: any) => ({
            Date: e.date,
            Animal: e.animalType,
            'Event Type': e.eventType,
            Count: e.count,
            'Price (₹)': e.price ?? '',
            Notes: e.notes ?? '',
          })),
        ),
      });
    }
  }

  // ── Attendance ────────────────────────────────────────────────────────────
  if (attState?.employees?.length) {
    const empMap: Record<string, string> = {};
    attState.employees.forEach((e: any) => {
      empMap[e.id] = e.name;
    });

    attachments.push({
      filename: 'attendance-workers.csv',
      content: toCSVString(
        attState.employees.map((e: any) => ({
          Name: e.name,
          Phone: e.phone ?? '',
          'Daily Wage (₹)': e.dailyWage,
          Notes: e.notes ?? '',
          'Created At': e.createdAt,
        })),
      ),
    });

    if (attState.attendanceRecords?.length) {
      attachments.push({
        filename: 'attendance-records.csv',
        content: toCSVString(
          attState.attendanceRecords.map((r: any) => ({
            Date: r.date,
            Worker: empMap[r.employeeId] ?? r.employeeId,
            Present: r.present ? 'Yes' : 'No',
            'Daily Wage (₹)': r.wage,
            'Extra Work (₹)': r.extraWork ?? 0,
            'Total (₹)': r.present ? r.wage + (r.extraWork ?? 0) : 0,
            Note: r.note ?? '',
          })),
        ),
      });
    }

    if (attState.transactions?.length) {
      attachments.push({
        filename: 'attendance-advances-deductions.csv',
        content: toCSVString(
          attState.transactions.map((t: any) => ({
            Date: t.date,
            Worker: empMap[t.employeeId] ?? t.employeeId,
            Type: t.type,
            'Amount (₹)': t.amount,
            Note: t.note ?? '',
          })),
        ),
      });
    }

    if (attState.salaryRecords?.length) {
      attachments.push({
        filename: 'attendance-salary.csv',
        content: toCSVString(
          attState.salaryRecords.map((s: any) => ({
            Month: s.month,
            Worker: empMap[s.employeeId] ?? s.employeeId,
            'Days Worked': s.daysWorked,
            'Base Salary (₹)': s.baseSalary,
            'Extra Work (₹)': s.extraWork,
            'Total Salary (₹)': s.totalSalary,
            'Advance (₹)': s.advance,
            'Deductions (₹)': s.deductions,
            'Net Payable (₹)': s.netPayable ?? s.finalSalary,
            Status: s.paymentStatus,
          })),
        ),
      });
    }
  }

  return attachments;
}

// ── Export all sections as separate CSV file downloads ────────────────────────

export function exportAllSectionsAsCSV(
  state: any,
  agriState?: any,
  attState?: any,
) {
  const attachments = buildAllCSVBlobs(state, agriState, attState);
  attachments.forEach(({ filename, content }) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, filename);
  });
}

// ── Export all CSVs as a single ZIP ──────────────────────────────────────────

export async function exportAllCSVAsZip(
  state: any,
  agriState?: any,
  attState?: any,
  filename?: string,
): Promise<void> {
  const attachments = buildAllCSVBlobs(state, agriState, attState);
  if (!attachments.length) return;

  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const folder = zip.folder('fintrackly-data');
  attachments.forEach(({ filename: fn, content }) => folder?.file(fn, content));

  const blob = await zip.generateAsync({ type: 'blob' });
  const dateStr = new Date().toISOString().split('T')[0];
  saveAs(blob, filename ?? `fintrackly-data-${dateStr}.zip`);
}

// ── Attendance CSV export (legacy standalone) ──────────────────────────────

export function exportAttendanceCSV(attState: {
  employees: any[];
  attendanceRecords: any[];
  transactions: any[];
  salaryRecords: any[];
}) {
  const { employees, attendanceRecords, transactions, salaryRecords } =
    attState;
  const blobs = buildAllCSVBlobs({}, undefined, {
    employees,
    attendanceRecords,
    transactions,
    salaryRecords,
  });
  blobs.forEach(({ filename, content }) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, filename);
  });
}

// ── Portfolio Excel export ───────────────────────────────────────────────────

export function exportExcel(
  investments: Investment[],
  filename = 'portfolio.xlsx',
) {
  const rows = toFlatInvestmentRows(investments);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Investments');

  const headers = rows.length
    ? Object.keys(rows[0])
    : [
        'Type',
        'Asset Sub-Type',
        'Name',
        'Symbol',
        'Platform',
        'Invested',
        'Current Value',
        'P&L',
        'Updated At',
      ];

  sheet.columns = headers.map((h) => ({
    header: h,
    key: h,
    width: Math.max(12, Math.min(32, h.length + 6)),
  }));

  rows.forEach((r) => sheet.addRow(r));
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'F2F2F2' },
  };

  void workbook.xlsx.writeBuffer().then((buf) => {
    const blob = new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    saveAs(blob, filename);
  });
}

// ── Export sold trades as CSV ─────────────────────────────────────────────────

export function exportSoldTradesCSV(
  soldTrades: any[],
  filename = 'profits.csv',
) {
  if (!soldTrades || soldTrades.length === 0) return;
  exportCSV(
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
    filename,
  );
}

// ── Export full portfolio state as JSON ──────────────────────────────────────

export function exportPortfolioJSON(
  state: any,
  filename = 'portfolio-data.json',
) {
  const data = {
    exportedAt: new Date().toISOString(),
    version: '1.0',
    investments: state.investments ?? [],
    soldTrades: state.soldTrades ?? [],
    liabilities: state.liabilities ?? [],
    cashflows: state.cashflows ?? [],
    goals: state.goals ?? [],
    goalContributions: state.goalContributions ?? [], // ← NEW
    accounts: state.accounts ?? [],
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  saveAs(blob, filename);
}

// ── Import portfolio JSON ─────────────────────────────────────────────────────

export async function parseImportedPortfolioJSON(file: File): Promise<any> {
  const text = await file.text();
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

// ── PDF export ───────────────────────────────────────────────────────────────

export function exportPDF(
  title: string,
  headers: string[],
  data: any[][],
  filename = 'report.pdf',
) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(title, 14, 15);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);
  autoTable(doc, {
    startY: 28,
    head: [headers],
    body: data,
    theme: 'grid',
    headStyles: { fillColor: [16, 185, 129] },
    styles: { fontSize: 9 },
  });
  doc.save(filename);
}
