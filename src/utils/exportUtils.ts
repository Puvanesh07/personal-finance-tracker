import {
  currentValue,
  investedValue,
  profitLoss,
  typeLabel,
} from './calculations';

import ExcelJS from 'exceljs';
import type { Investment } from '../types/investmentTypes';
// src/utils/exportUtils.ts
import { saveAs } from 'file-saver';

/**
 * Helper to transform investment objects into a flat structure for spreadsheets
 */
function toFlatRows(investments: Investment[]) {
  return investments.map((inv) => ({
    Type: typeLabel(inv.type),
    Name: inv.name,
    Symbol: inv.symbol ?? '',
    Platform: inv.platform ?? '',
    Invested: investedValue(inv),
    Current: currentValue(inv),
    ProfitLoss: profitLoss(inv),
    UpdatedAt: inv.updatedAt,
  }));
}

/**
 * Generic CSV Exporter that handles special characters and escaping
 */
export function exportCSV(data: any[], filename = 'data.csv') {
  if (!data || data.length === 0) return;

  // Use keys from the first object as headers
  const headers = Object.keys(data[0]);

  const escapeCell = (v: unknown) => {
    const s = String(v ?? '');
    // If value contains quotes, commas, or newlines, wrap in quotes and escape internal quotes
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

/**
 * Exports all primary financial categories as separate CSV files
 */
export function exportAllSectionsAsCSV(state: any) {
  // Use specialized flattening for investments
  if (state.investments?.length) {
    const flatInvestments = toFlatRows(state.investments);
    exportCSV(flatInvestments, 'investments.csv');
  }

  // Export other sections as-is
  if (state.liabilities?.length)
    exportCSV(state.liabilities, 'liabilities.csv');
  if (state.cashflows?.length) exportCSV(state.cashflows, 'cashflows.csv');
  if (state.goals?.length) exportCSV(state.goals, 'goals.csv');
}

/**
 * Proper Excel (.xlsx) exporter using ExcelJS
 */
export function exportExcel(
  investments: Investment[],
  filename = 'portfolio.xlsx',
) {
  const rows = toFlatRows(investments);
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
        'Current',
        'ProfitLoss',
        'UpdatedAt',
      ];

  // Setup columns with automatic width adjustment
  sheet.columns = headers.map((h) => ({
    header: h,
    key: h,
    width: Math.max(12, Math.min(32, h.length + 6)),
  }));

  // Add data rows
  rows.forEach((r) => sheet.addRow(r));

  // Style the header row
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'F2F2F2' },
  };

  // Generate and save the file
  void workbook.xlsx.writeBuffer().then((buf) => {
    const blob = new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    saveAs(blob, filename);
  });
}
