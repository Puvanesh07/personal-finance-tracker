// src/utils/exportUtils.ts

import type { Account, Investment } from '../types/investmentTypes';
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
function toFlatInvestmentRows(investments: Investment[]) {
  return investments.map((inv) => ({
    Type: typeLabel(inv.type),
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

// ── Export all sections as separate CSV files ────────────────────────────────
export function exportAllSectionsAsCSV(state: any, agriState?: any) {
  const accounts: Account[] = state.accounts ?? [];

  if (state.investments?.length) {
    exportCSV(toFlatInvestmentRows(state.investments), 'investments.csv');
  }

  // ADDED PROFIT (SOLD TRADES) EXPORT
  if (state.soldTrades?.length) {
    exportSoldTradesCSV(state.soldTrades, 'profits.csv');
  }

  if (state.liabilities?.length) {
    exportCSV(
      state.liabilities.map((l: any) => ({
        Name: l.name,
        Type: l.type,
        Principal: l.principal,
        Outstanding: l.outstanding,
        'Interest Rate': l.interestRate ?? '',
        'Start Date': l.startDate ?? '',
        'End Date': l.endDate ?? '',
      })),
      'liabilities.csv',
    );
  }
  if (state.cashflows?.length) {
    exportCSV(toFlatCashflowRows(state.cashflows, accounts), 'cashflows.csv');
  }
  if (state.goals?.length) {
    exportCSV(
      state.goals.map((g: any) => ({
        Name: g.name,
        'Target Amount': g.targetAmount,
        'Current Amount': g.currentAmount,
        'Due Date': g.dueDate ?? '',
      })),
      'goals.csv',
    );
  }
  if (accounts.length) {
    exportCSV(toFlatAccountRows(accounts), 'accounts.csv');
  }

  if (state.lendingBorrowers?.length) {
    const bMap = new Map();
    state.lendingBorrowers.forEach((b: any) => bMap.set(b.id, b.name));

    // Export Borrowers
    exportCSV(
      state.lendingBorrowers.map((b: any) => ({
        Name: b.name,
        Phone: b.phone ?? '',
        Status: b.status,
        'Interest Rate (%)': b.interestRate ?? '',
        'Due Date': b.nextDueDate ?? '',
      })),
      'lending-borrowers.csv',
    );

    // Export TXNS
    if (state.lendingTransactions?.length) {
      exportCSV(
        state.lendingTransactions.map((tx: any) => ({
          Date: tx.date,
          Borrower: bMap.get(tx.borrowerId) || 'Unknown',
          Type: tx.type,
          Amount: tx.amount,
          Notes: tx.notes ?? '',
        })),
        'lending-transactions.csv',
      );
    }
  }

  // ── Agriculture CSV exports ─────────────────────────────────────────────
  if (agriState) {
    if (agriState.fields?.length) {
      exportCSV(
        agriState.fields.map((f: any) => ({
          Name: f.name,
          'Area (Acres)': f.areAcres,
          Location: f.location ?? '',
          'Soil Type': f.soilType ?? '',
          'Created At': f.createdAt,
        })),
        'agri-fields.csv',
      );
    }
    if (agriState.cropCycles?.length) {
      exportCSV(
        agriState.cropCycles.map((c: any) => ({
          'Crop Name': c.cropName,
          Field: c.fieldId ?? '',
          Season: c.season,
          'Start Date': c.startDate,
          'End Date': c.endDate ?? '',
          'Invested Amount': c.investedAmount,
          'Harvest Income': c.harvestIncome,
          'Profit/Loss': c.harvestIncome - c.investedAmount,
          Notes: c.notes ?? '',
        })),
        'agri-crops.csv',
      );
    }
    if (agriState.agriExpenses?.length) {
      exportCSV(
        agriState.agriExpenses.map((e: any) => ({
          Date: e.date,
          Category: e.category,
          Amount: e.amount,
          Notes: e.notes ?? '',
        })),
        'agri-expenses.csv',
      );
    }
    if (agriState.livestockEvents?.length) {
      exportCSV(
        agriState.livestockEvents.map((e: any) => ({
          Date: e.date,
          Animal: e.animalType,
          'Event Type': e.eventType,
          Count: e.count,
          Price: e.price ?? '',
          Notes: e.notes ?? '',
        })),
        'agri-livestock-events.csv',
      );
    }
    if (agriState.milkRecords?.length) {
      exportCSV(
        agriState.milkRecords.map((m: any) => ({
          Date: m.date,
          Liters: m.liters,
          'Price/Liter': m.pricePerLiter,
          Income: m.liters * m.pricePerLiter,
          'Sold To': m.soldTo ?? '',
        })),
        'agri-milk.csv',
      );
    }
    if (agriState.coconutRecords?.length) {
      exportCSV(
        agriState.coconutRecords.map((c: any) => ({
          Date: c.date,
          Trees: c.numberOfTrees,
          'Total Coconuts': c.totalCoconuts,
          'Sell Method': c.sellMethod,
          'Price/Coconut': c.pricePerCoconut ?? '',
          'Total Tons': c.totalTons ?? '',
          'Price/Ton': c.pricePerTon ?? '',
          Income: c.harvestIncome,
          Investment: c.investmentAmount,
          Profit: c.harvestIncome - c.investmentAmount,
          Notes: c.notes ?? '',
        })),
        'agri-coconut.csv',
      );
    }
  }
}

// ── Attendance CSV export ─────────────────────────────────────────────────────
export function exportAttendanceCSV(attState: {
  employees: any[];
  attendanceRecords: any[];
  transactions: any[];
  salaryRecords: any[];
}) {
  const { employees, attendanceRecords, transactions, salaryRecords } =
    attState;

  if (employees.length) {
    exportCSV(
      employees.map((e: any) => ({
        Name: e.name,
        Phone: e.phone ?? '',
        'Daily Wage (₹)': e.dailyWage,
        Notes: e.notes ?? '',
        'Created At': e.createdAt,
      })),
      'attendance-workers.csv',
    );
  }

  if (attendanceRecords.length) {
    const empMap: Record<string, string> = {};
    employees.forEach((e: any) => {
      empMap[e.id] = e.name;
    });
    exportCSV(
      attendanceRecords.map((r: any) => ({
        Date: r.date,
        Worker: empMap[r.employeeId] ?? r.employeeId,
        Present: r.present ? 'Yes' : 'No',
        'Daily Wage (₹)': r.wage,
        'Extra Work (₹)': r.extraWork ?? 0,
        'Total (₹)': r.present ? r.wage + (r.extraWork ?? 0) : 0,
        Note: r.note ?? '',
      })),
      'attendance-records.csv',
    );
  }

  if (transactions.length) {
    const empMap: Record<string, string> = {};
    employees.forEach((e: any) => {
      empMap[e.id] = e.name;
    });
    exportCSV(
      transactions.map((t: any) => ({
        Date: t.date,
        Worker: empMap[t.employeeId] ?? t.employeeId,
        Type: t.type,
        'Amount (₹)': t.amount,
        Note: t.note ?? '',
      })),
      'attendance-advances-deductions.csv',
    );
  }

  if (salaryRecords.length) {
    const empMap: Record<string, string> = {};
    employees.forEach((e: any) => {
      empMap[e.id] = e.name;
    });
    exportCSV(
      salaryRecords.map((s: any) => ({
        Month: s.month,
        Worker: empMap[s.employeeId] ?? s.employeeId,
        'Days Worked': s.daysWorked,
        'Base Salary (₹)': s.baseSalary,
        'Extra Work (₹)': s.extraWork,
        'Total Salary (₹)': s.totalSalary,
        'Advance (₹)': s.advance,
        'Deductions (₹)': s.deductions,
        'Final Salary (₹)': s.finalSalary,
        'Paid (₹)': s.paidAmount,
        'Remaining (₹)': s.finalSalary - s.paidAmount,
        Status: s.paymentStatus,
      })),
      'attendance-salary.csv',
    );
  }
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
  const rows = soldTrades.map((t) => ({
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
  }));
  exportCSV(rows, filename);
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
    accounts: state.accounts ?? [],
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  saveAs(blob, filename);
}

// ── Import portfolio JSON (returns parsed data for the caller to handle) ─────
export async function parseImportedPortfolioJSON(file: File): Promise<any> {
  const text = await file.text();
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

export function exportPDF(
  title: string,
  headers: string[],
  data: any[][],
  filename = 'report.pdf',
) {
  const doc = new jsPDF();

  // Add Title
  doc.setFontSize(16);
  doc.text(title, 14, 15);

  // Add Timestamp
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);

  // Generate Table
  autoTable(doc, {
    startY: 28,
    head: [headers],
    body: data,
    theme: 'grid',
    headStyles: { fillColor: [16, 185, 129] }, // Emerald Green header
    styles: { fontSize: 9 },
  });

  doc.save(filename);
}
