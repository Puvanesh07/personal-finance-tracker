// src/utils/cashflowImport.ts
//
// Cash Flow CSV / Excel import pipeline.
// Handles:
//   1. Parsing raw .csv and .xlsx/.xls files into generic rows + headers.
//   2. Suggesting a column mapping (source header -> Cashflow field).
//   3. Normalising dates / amounts / type values from many common formats.
//   4. Validating every row and producing a preview of valid + invalid rows.
//
// Reuses the same data shape as the rest of the app (`CashflowEntry`) so the
// resulting drafts can be passed straight into `usePortfolioStore().addCashflow`.

import { isValid as isValidDateFns, parse as parseDateFns } from 'date-fns';

import type { CashflowType } from '../types/investmentTypes';
import ExcelJS from 'exceljs';

// ── Generic row/sheet types ─────────────────────────────────────────────

export type ImportRow = Record<string, string>;

export type ParsedSheet = {
  name: string;
  headers: string[];
  rows: ImportRow[];
};

export type ParsedFile = {
  kind: 'csv' | 'xlsx';
  sheets: ParsedSheet[];
};

// ── CSV parsing (quote-aware, self-contained) ───────────────────────────

function parseDelimitedLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function detectDelimiter(headerLine: string): string {
  const candidates = [',', ';', '\t'];
  let best = ',';
  let bestCount = -1;
  for (const d of candidates) {
    const count = parseDelimitedLine(headerLine, d).length;
    if (count > bestCount) {
      bestCount = count;
      best = d;
    }
  }
  return best;
}

function dedupeHeaders(headers: string[]): string[] {
  const seen = new Map<string, number>();
  return headers.map((h, i) => {
    const clean = h.replace(/^\uFEFF/, '').trim() || `Column ${i + 1}`;
    const count = seen.get(clean) ?? 0;
    seen.set(clean, count + 1);
    return count === 0 ? clean : `${clean} (${count + 1})`;
  });
}

export function parseCsvText(text: string): ParsedSheet {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { name: 'CSV', headers: [], rows: [] };

  const delimiter = detectDelimiter(lines[0]);
  const headers = dedupeHeaders(parseDelimitedLine(lines[0], delimiter));

  const rows: ImportRow[] = lines.slice(1).map((line) => {
    const values = parseDelimitedLine(line, delimiter);
    const row: ImportRow = {};
    headers.forEach((h, i) => {
      row[h] = (values[i] ?? '').trim();
    });
    return row;
  });

  return { name: 'CSV', headers, rows };
}

export async function parseCsvFile(file: File): Promise<ParsedFile> {
  const text = await file.text();
  return { kind: 'csv', sheets: [parseCsvText(text)] };
}

// ── XLSX parsing (via exceljs, already a project dependency) ────────────

function excelCellToString(value: ExcelJS.CellValue): string {
  if (value == null) return '';
  if (value instanceof Date) {
    // Keep as ISO yyyy-MM-dd; downstream date parser understands this.
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof value === 'object') {
    // Formula result / rich text / hyperlink cell shapes.
    const anyVal = value as any;
    if ('result' in anyVal) return excelCellToString(anyVal.result);
    if ('text' in anyVal) return String(anyVal.text);
    if (Array.isArray(anyVal.richText)) {
      return anyVal.richText.map((r: any) => r.text).join('');
    }
    return '';
  }
  return String(value).trim();
}

export async function parseXlsxFile(file: File): Promise<ParsedFile> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());

  const sheets: ParsedSheet[] = [];

  workbook.eachSheet((sheet) => {
    // Find the most plausible header row: the first row with >= 2
    // non-empty text-ish cells within the first 10 rows.
    let headerRowNumber = -1;
    let maxRowToScan = Math.min(sheet.rowCount, 10);
    for (let r = 1; r <= maxRowToScan; r++) {
      const row = sheet.getRow(r);
      const nonEmpty = row.values
        ? (row.values as unknown[]).filter(
            (v) => v != null && String(v).trim() !== '',
          )
        : [];
      if (nonEmpty.length >= 2) {
        headerRowNumber = r;
        break;
      }
    }
    if (headerRowNumber === -1) return;

    const headerRow = sheet.getRow(headerRowNumber);
    const colCount = sheet.columnCount || headerRow.cellCount;
    const rawHeaders: string[] = [];
    for (let c = 1; c <= colCount; c++) {
      rawHeaders.push(excelCellToString(headerRow.getCell(c).value));
    }
    // Trim trailing empty columns
    while (
      rawHeaders.length > 0 &&
      rawHeaders[rawHeaders.length - 1] === ''
    ) {
      rawHeaders.pop();
    }
    if (rawHeaders.length === 0) return;
    const headers = dedupeHeaders(rawHeaders);

    const rows: ImportRow[] = [];
    for (let r = headerRowNumber + 1; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      const values = headers.map((_, i) =>
        excelCellToString(row.getCell(i + 1).value),
      );
      if (values.every((v) => v === '')) continue; // skip blank rows
      const rowObj: ImportRow = {};
      headers.forEach((h, i) => {
        rowObj[h] = values[i] ?? '';
      });
      rows.push(rowObj);
    }

    sheets.push({ name: sheet.name || `Sheet`, headers, rows });
  });

  return { kind: 'xlsx', sheets: sheets.filter((s) => s.rows.length > 0 || s.headers.length > 0) };
}

export async function parseImportFile(file: File): Promise<ParsedFile> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    return parseXlsxFile(file);
  }
  return parseCsvFile(file);
}

// ── Column mapping ───────────────────────────────────────────────────────

export type AmountMode = 'single' | 'split';

export type ColumnMapping = {
  date: string | null;
  amountMode: AmountMode;
  // single mode
  type: string | null;
  amount: string | null;
  // split mode (e.g. bank statements with separate Credit / Debit columns)
  credit: string | null;
  debit: string | null;
  // optional
  category: string | null;
  notes: string | null;
  account: string | null;
};

export const REQUIRED_FIELD_LABELS: Record<string, string> = {
  date: 'Date',
  type: 'Type (Income/Expense)',
  amount: 'Amount',
};

function normHeader(h: string) {
  return h.trim().toLowerCase().replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ');
}

function bestMatch(headers: string[], candidates: string[]): string | null {
  const normed = headers.map((h) => ({ h, n: normHeader(h) }));
  // exact match first
  for (const c of candidates) {
    const hit = normed.find((x) => x.n === c);
    if (hit) return hit.h;
  }
  // contains match second
  for (const c of candidates) {
    const hit = normed.find((x) => x.n.includes(c));
    if (hit) return hit.h;
  }
  return null;
}

export function suggestMapping(headers: string[]): ColumnMapping {
  const date = bestMatch(headers, [
    'date',
    'transaction date',
    'txn date',
    'value date',
    'posting date',
    'entry date',
  ]);
  const credit = bestMatch(headers, [
    'credit',
    'credit amount',
    'deposit',
    'deposits',
    'cr',
    'money in',
  ]);
  const debit = bestMatch(headers, [
    'debit',
    'debit amount',
    'withdrawal',
    'withdrawals',
    'dr',
    'money out',
  ]);
  const amount = bestMatch(headers, [
    'amount',
    'transaction amount',
    'txn amount',
    'value',
  ]);
  const type = bestMatch(headers, [
    'type',
    'transaction type',
    'txn type',
    'cr/dr',
    'dr/cr',
  ]);
  const category = bestMatch(headers, [
    'category',
    'sub category',
    'subcategory',
    'label',
    'tag',
  ]);
  const notes = bestMatch(headers, [
    'notes',
    'note',
    'description',
    'narration',
    'remarks',
    'particulars',
    'memo',
    'details',
  ]);
  const account = bestMatch(headers, [
    'account',
    'account name',
    'bank',
    'wallet',
    'source',
  ]);

  // Prefer split (Credit/Debit) mode when both columns exist and there's no
  // clearly-better single amount/type pair.
  const amountMode: AmountMode = credit && debit && !(amount && type) ? 'split' : 'single';

  return {
    date,
    amountMode,
    type: amountMode === 'single' ? type : null,
    amount: amountMode === 'single' ? amount ?? (credit || debit) : null,
    credit: amountMode === 'split' ? credit : credit,
    debit: amountMode === 'split' ? debit : debit,
    category,
    notes,
    account,
  };
}

// ── Value normalisation ──────────────────────────────────────────────────

const DATE_FORMATS = [
  'yyyy-MM-dd',
  'yyyy/MM/dd',
  'dd-MM-yyyy',
  'dd/MM/yyyy',
  'MM/dd/yyyy',
  'M/d/yyyy',
  'd/M/yyyy',
  'dd-MMM-yyyy',
  'dd MMM yyyy',
  'dd MMMM yyyy',
  'MMM dd, yyyy',
  'MMMM dd, yyyy',
  'dd.MM.yyyy',
  'yyyy.MM.dd',
];

/** Parses a wide range of date strings and returns an ISO (yyyy-MM-dd) date, or null. */
export function parseFlexibleDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  // Excel serial date numbers (e.g. "45678") that survived as plain text.
  if (/^\d{5}$/.test(s)) {
    const serial = Number(s);
    if (serial > 20000 && serial < 80000) {
      const epoch = new Date(Date.UTC(1899, 11, 30));
      const d = new Date(epoch.getTime() + serial * 86400000);
      if (!isNaN(d.getTime())) return toISO(d);
    }
  }

  // Strip a trailing time component like "2024-05-01 10:23:00"
  const dateOnly = s.split(/[T ]\d{1,2}:\d{2}/)[0].trim();

  for (const fmt of DATE_FORMATS) {
    const d = parseDateFns(dateOnly, fmt, new Date());
    if (isValidDateFns(d)) return toISO(d);
  }

  // Fallback to native parsing (handles e.g. "May 1 2024", full ISO strings)
  const native = new Date(dateOnly);
  if (!isNaN(native.getTime())) return toISO(native);

  return null;
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parses amounts like "1,234.50", "₹1,234", "(500)" (=> -500), "Rs. 99", "+250". */
export function parseFlexibleAmount(raw: string): number | null {
  let s = raw.trim();
  if (!s) return null;

  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (/^-/.test(s.trim())) negative = true;

  // Strip currency symbols, letters (Rs, INR, CR, DR suffixes), commas, spaces
  const cleaned = s.replace(/[^\d.]/g, '');
  if (!cleaned) return null;

  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return negative ? -Math.abs(n) : n;
}

const INCOME_KEYWORDS = [
  'income',
  'credit',
  'cr',
  'in',
  'deposit',
  'receipt',
  'earning',
  'inflow',
  '+',
];
const EXPENSE_KEYWORDS = [
  'expense',
  'debit',
  'dr',
  'out',
  'withdrawal',
  'payment',
  'spend',
  'outflow',
  '-',
];

/** Best-effort guess for whether a raw "type" value means income or expense. */
export function guessTypeFromValue(raw: string): CashflowType | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  if (INCOME_KEYWORDS.includes(s)) return 'income';
  if (EXPENSE_KEYWORDS.includes(s)) return 'expense';
  if (s.includes('income') || s.includes('credit') || s.includes('deposit'))
    return 'income';
  if (s.includes('expense') || s.includes('debit') || s.includes('withdraw'))
    return 'expense';
  return null;
}

export type TypeValueAssignment = 'income' | 'expense' | 'ignore';
export type TypeValueMap = Record<string, TypeValueAssignment>;

/** Collects the distinct raw values in the mapped "type" column, with a best guess assignment. */
export function collectDistinctTypeValues(
  rows: ImportRow[],
  typeColumn: string | null,
): { value: string; guess: TypeValueAssignment; count: number }[] {
  if (!typeColumn) return [];
  const counts = new Map<string, number>();
  for (const row of rows) {
    const v = (row[typeColumn] ?? '').trim();
    if (!v) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([value, count]) => ({
      value,
      count,
      guess: (guessTypeFromValue(value) ?? 'ignore') as TypeValueAssignment,
    }))
    .sort((a, b) => b.count - a.count);
}

// ── Row validation / draft building ─────────────────────────────────────

export type CashflowDraft = {
  type: CashflowType;
  date: string;
  category: string;
  amount: number;
  notes?: string;
  accountId?: string;
};

export type ImportRowResult = {
  rowNumber: number; // 1-based, matches spreadsheet row (excluding header)
  raw: ImportRow;
  valid: boolean;
  errors: string[];
  draft: CashflowDraft | null;
};

export type ValidateOptions = {
  mapping: ColumnMapping;
  typeValueMap: TypeValueMap; // only used in 'single' amountMode
  defaultIncomeCategory: string;
  defaultExpenseCategory: string;
  accountsByName: Map<string, string>; // lowercased name -> accountId
};

export function validateImportRows(
  rows: ImportRow[],
  opts: ValidateOptions,
): ImportRowResult[] {
  const { mapping, typeValueMap, accountsByName } = opts;

  return rows.map((raw, idx) => {
    const errors: string[] = [];
    const rowNumber = idx + 1;

    // ── Date ──
    let isoDate: string | null = null;
    if (!mapping.date) {
      errors.push('No Date column mapped.');
    } else {
      const rawDate = raw[mapping.date] ?? '';
      if (!rawDate.trim()) {
        errors.push('Date is empty.');
      } else {
        isoDate = parseFlexibleDate(rawDate);
        if (!isoDate) errors.push(`Could not understand date "${rawDate}".`);
      }
    }

    // ── Type + Amount ──
    let type: CashflowType | null = null;
    let amount: number | null = null;

    if (mapping.amountMode === 'split') {
      const creditRaw = mapping.credit ? raw[mapping.credit] ?? '' : '';
      const debitRaw = mapping.debit ? raw[mapping.debit] ?? '' : '';
      const creditVal = creditRaw.trim() ? parseFlexibleAmount(creditRaw) : null;
      const debitVal = debitRaw.trim() ? parseFlexibleAmount(debitRaw) : null;

      const hasCredit = creditVal != null && creditVal !== 0;
      const hasDebit = debitVal != null && debitVal !== 0;

      if (hasCredit && hasDebit) {
        errors.push('Both Credit and Debit have values — cannot determine type.');
      } else if (hasCredit) {
        type = 'income';
        amount = Math.abs(creditVal as number);
      } else if (hasDebit) {
        type = 'expense';
        amount = Math.abs(debitVal as number);
      } else {
        errors.push('No Credit or Debit amount found for this row.');
      }
    } else {
      if (!mapping.type) {
        errors.push('No Type column mapped.');
      } else {
        const rawType = (raw[mapping.type] ?? '').trim();
        if (!rawType) {
          errors.push('Type is empty.');
        } else {
          const assignment = typeValueMap[rawType];
          if (!assignment || assignment === 'ignore') {
            errors.push(`Type value "${rawType}" is not mapped to Income or Expense.`);
          } else {
            type = assignment;
          }
        }
      }

      if (!mapping.amount) {
        errors.push('No Amount column mapped.');
      } else {
        const rawAmount = raw[mapping.amount] ?? '';
        if (!rawAmount.trim()) {
          errors.push('Amount is empty.');
        } else {
          const n = parseFlexibleAmount(rawAmount);
          if (n == null) errors.push(`Could not understand amount "${rawAmount}".`);
          else amount = Math.abs(n);
        }
      }
    }

    if (amount != null && amount <= 0) {
      errors.push('Amount must be greater than zero.');
      amount = null;
    }

    // ── Category (optional, default applied) ──
    let category = mapping.category ? (raw[mapping.category] ?? '').trim() : '';
    if (!category && type) {
      category = type === 'income' ? opts.defaultIncomeCategory : opts.defaultExpenseCategory;
    }

    // ── Notes (optional) ──
    const notes = mapping.notes ? (raw[mapping.notes] ?? '').trim() : '';

    // ── Account (optional, matched by name) ──
    let accountId: string | undefined;
    if (mapping.account) {
      const rawAccount = (raw[mapping.account] ?? '').trim();
      if (rawAccount) {
        accountId = accountsByName.get(rawAccount.toLowerCase());
      }
    }

    const valid = errors.length === 0 && !!isoDate && !!type && amount != null;

    const draft: CashflowDraft | null = valid
      ? {
          type: type as CashflowType,
          date: isoDate as string,
          category: category || (type === 'income' ? opts.defaultIncomeCategory : opts.defaultExpenseCategory),
          amount: amount as number,
          ...(notes ? { notes } : {}),
          ...(accountId ? { accountId } : {}),
        }
      : null;

    return { rowNumber, raw, valid, errors, draft };
  });
}