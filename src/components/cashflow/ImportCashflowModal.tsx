// src/components/cashflow/ImportCashflowModal.tsx
//
// Cash Flow CSV / Excel import wizard.
//
// Flow: Upload file → (pick sheet, for multi-sheet Excel files) → Map columns
// → Preview & validate → Confirm import.
//
// Reuses the existing Cashflow data structure (`CashflowEntry`), the same
// default category lists used in `UpsertCashflowModal`, and writes through
// `usePortfolioStore().addCashflow` so imported rows go through the exact
// same persistence path as manually-added entries.

import {
  FiAlertTriangle,
  FiArrowLeft,
  FiArrowRight,
  FiCheckCircle,
  FiChevronDown,
  FiFile,
  FiUpload,
  FiX,
} from 'react-icons/fi';
import { useEffect, useMemo, useRef, useState } from 'react';

import toast from 'react-hot-toast';
import { usePortfolioStore } from '../../store/portfolioStore';
import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
} from './UpsertCashflowModal';
import {
  collectDistinctTypeValues,
  parseImportFile,
  suggestMapping,
  validateImportRows,
  type AmountMode,
  type ColumnMapping,
  type ImportRow,
  type ImportRowResult,
  type ParsedFile,
  type TypeValueAssignment,
  type TypeValueMap,
} from '../../utils/cashflowImport';

type Step = 'upload' | 'sheet' | 'map' | 'preview';

const STEPS: { key: Step; label: string }[] = [
  { key: 'upload', label: 'Upload' },
  { key: 'map', label: 'Map columns' },
  { key: 'preview', label: 'Preview & confirm' },
];

const NONE = '__none__';

function emptyMapping(): ColumnMapping {
  return {
    date: null,
    amountMode: 'single',
    type: null,
    amount: null,
    credit: null,
    debit: null,
    category: null,
    notes: null,
    account: null,
  };
}

export function ImportCashflowModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const addCashflow = usePortfolioStore((s) => s.addCashflow);
  const accounts = usePortfolioStore((s) => s.accounts);

  const inputRef = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState<string>('');
  const [parsedFile, setParsedFile] = useState<ParsedFile | null>(null);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [mapping, setMapping] = useState<ColumnMapping>(emptyMapping());
  const [typeValueMap, setTypeValueMap] = useState<TypeValueMap>({});
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [excludedRows, setExcludedRows] = useState<Set<number>>(new Set());

  const accountsByName = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of accounts) m.set(a.name.trim().toLowerCase(), a.id);
    return m;
  }, [accounts]);

  const activeSheet = parsedFile?.sheets[sheetIndex] ?? null;

  // Reset everything whenever the modal is (re)opened.
  useEffect(() => {
    if (open) {
      setStep('upload');
      setFileName('');
      setParsedFile(null);
      setSheetIndex(0);
      setMapping(emptyMapping());
      setTypeValueMap({});
      setExcludedRows(new Set());
      setImporting(false);
      setImportProgress(0);
    }
  }, [open]);

  async function handleFile(file: File) {
    const lower = file.name.toLowerCase();
    if (
      !lower.endsWith('.csv') &&
      !lower.endsWith('.xlsx') &&
      !lower.endsWith('.xls')
    ) {
      toast.error('Please upload a .csv or .xlsx file.');
      return;
    }
    setParsing(true);
    try {
      const parsed = await parseImportFile(file);
      const usableSheets = parsed.sheets.filter((s) => s.headers.length > 0);
      if (usableSheets.length === 0) {
        toast.error('No readable data found in this file.');
        return;
      }
      setParsedFile({ ...parsed, sheets: usableSheets });
      setFileName(file.name);
      setSheetIndex(0);
      const suggested = suggestMapping(usableSheets[0].headers);
      setMapping(suggested);
      setTypeValueMap(
        buildInitialTypeValueMap(usableSheets[0].rows, suggested),
      );
      setStep(usableSheets.length > 1 ? 'sheet' : 'map');
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not read this file.');
    } finally {
      setParsing(false);
    }
  }

  function buildInitialTypeValueMap(
    rows: ImportRow[],
    m: ColumnMapping,
  ): TypeValueMap {
    if (m.amountMode !== 'single' || !m.type) return {};
    const distinct = collectDistinctTypeValues(rows, m.type);
    const map: TypeValueMap = {};
    for (const d of distinct) map[d.value] = d.guess;
    return map;
  }

  function chooseSheet(idx: number) {
    if (!parsedFile) return;
    setSheetIndex(idx);
    const sheet = parsedFile.sheets[idx];
    const suggested = suggestMapping(sheet.headers);
    setMapping(suggested);
    setTypeValueMap(buildInitialTypeValueMap(sheet.rows, suggested));
    setStep('map');
  }

  function updateMapping(patch: Partial<ColumnMapping>) {
    setMapping((prev) => {
      const next = { ...prev, ...patch };
      // Recompute type-value map if the type column or mode changed.
      if (
        activeSheet &&
        (patch.type !== undefined || patch.amountMode !== undefined)
      ) {
        if (next.amountMode === 'single' && next.type) {
          const distinct = collectDistinctTypeValues(
            activeSheet.rows,
            next.type,
          );
          const map: TypeValueMap = {};
          for (const d of distinct) map[d.value] = d.guess;
          setTypeValueMap(map);
        } else {
          setTypeValueMap({});
        }
      }
      return next;
    });
  }

  const distinctTypeValues = useMemo(() => {
    if (!activeSheet || mapping.amountMode !== 'single' || !mapping.type)
      return [];
    return collectDistinctTypeValues(activeSheet.rows, mapping.type);
  }, [activeSheet, mapping.amountMode, mapping.type]);

  const mappingComplete =
    !!mapping.date &&
    (mapping.amountMode === 'split'
      ? !!(mapping.credit || mapping.debit)
      : !!mapping.type && !!mapping.amount);

  const results: ImportRowResult[] = useMemo(() => {
    if (!activeSheet || step !== 'preview') return [];
    const defaultIncomeCategory =
      DEFAULT_INCOME_CATEGORIES.find((c: any) => c.key === 'Other Income')
        ?.key ??
      DEFAULT_INCOME_CATEGORIES[0]?.key ??
      'Other Income';
    const defaultExpenseCategory =
      DEFAULT_EXPENSE_CATEGORIES.find((c: any) => c.key === 'Other Expense')
        ?.key ??
      DEFAULT_EXPENSE_CATEGORIES[0]?.key ??
      'Other Expense';
    return validateImportRows(activeSheet.rows, {
      mapping,
      typeValueMap,
      defaultIncomeCategory,
      defaultExpenseCategory,
      accountsByName,
    });
  }, [activeSheet, step, mapping, typeValueMap, accountsByName]);

  const validResults = results.filter((r) => r.valid);
  const invalidResults = results.filter((r) => !r.valid);
  const selectedForImport = validResults.filter(
    (r) => !excludedRows.has(r.rowNumber),
  );

  function toggleRowExcluded(rowNumber: number) {
    setExcludedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowNumber)) next.delete(rowNumber);
      else next.add(rowNumber);
      return next;
    });
  }

  function goToPreview() {
    if (!mappingComplete) {
      toast.error('Please map all required fields before continuing.');
      return;
    }
    if (mapping.amountMode === 'single') {
      const unassigned = distinctTypeValues.filter(
        (d) => !typeValueMap[d.value] || typeValueMap[d.value] === 'ignore',
      );
      if (unassigned.length > 0) {
        toast.error('Please assign every Type value to Income or Expense.');
        return;
      }
    }
    setExcludedRows(new Set());
    setStep('preview');
  }

  async function confirmImport() {
    if (selectedForImport.length === 0) {
      toast.error('No valid rows selected to import.');
      return;
    }
    setImporting(true);
    setImportProgress(0);
    let ok = 0;
    let failed = 0;
    for (let i = 0; i < selectedForImport.length; i++) {
      const draft = selectedForImport[i].draft!;
      try {
        await addCashflow(draft as any);
        ok++;
      } catch {
        failed++;
      }
      setImportProgress(i + 1);
    }
    setImporting(false);
    if (ok > 0) {
      toast.success(
        `Imported ${ok} transaction${ok !== 1 ? 's' : ''}${failed ? ` (${failed} failed)` : ''}.`,
      );
      onClose();
    } else {
      toast.error('Import failed. Please try again.');
    }
  }

  if (!open) return null;

  const stepIndex = STEPS.findIndex(
    (s) => s.key === (step === 'sheet' ? 'upload' : step),
  );
  const labelCls =
    'text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 block';

  return (
    <div
      className='fixed inset-0 z-[200] flex items-start justify-center overflow-x-hidden overflow-y-auto bg-slate-100/90 dark:bg-slate-950/80 backdrop-blur-md p-3 sm:p-4 [scrollbar-gutter:stable]'
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !importing) onClose();
      }}
      role='dialog'
      aria-modal='true'
    >
      <div className='my-2 flex w-full max-w-4xl flex-col rounded-2xl border border-slate-300/80 bg-white shadow-2xl dark:border-slate-700/80 dark:bg-slate-900/95 sm:my-6'>
        {/* Header */}
        <header className='flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/70 dark:border-slate-800/60 bg-slate-100/80 dark:bg-slate-800/30 px-5 py-4 rounded-t-2xl'>
          <div>
            <div className='text-base font-bold tracking-tight text-slate-900 dark:text-slate-100'>
              Import CSV / Excel
            </div>
            <div className='mt-1 flex items-center gap-2'>
              {STEPS.map((s, i) => (
                <div key={s.key} className='flex items-center gap-2'>
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wider ${
                      i === stepIndex
                        ? 'text-emerald-500'
                        : i < stepIndex
                          ? 'text-slate-400 dark:text-slate-500'
                          : 'text-slate-300 dark:text-slate-700'
                    }`}
                  >
                    {i + 1}. {s.label}
                  </span>
                  {i < STEPS.length - 1 && (
                    <span className='h-px w-4 bg-slate-300 dark:bg-slate-700' />
                  )}
                </div>
              ))}
            </div>
          </div>
          <button
            type='button'
            className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors hover:bg-rose-500/20 hover:text-rose-400 disabled:opacity-40'
            onClick={onClose}
            disabled={importing}
            title='Close'
          >
            <FiX className='h-4 w-4' />
          </button>
        </header>

        {/* Body */}
        <div className='max-h-[75dvh] overflow-y-auto overscroll-contain p-5 sm:p-6'>
          {/* ── Step: Upload ── */}
          {step === 'upload' && (
            <div className='flex flex-col gap-4'>
              <p className='text-sm text-slate-600 dark:text-slate-300'>
                Import your income and expense history from a bank statement,
                spreadsheet, or export from another app. We support{' '}
                <span className='font-semibold'>.csv</span> and{' '}
                <span className='font-semibold'>.xlsx</span> files.
              </p>

              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) void handleFile(file);
                }}
                className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
                  dragOver
                    ? 'border-emerald-500 bg-emerald-500/5'
                    : 'border-slate-300 dark:border-slate-700 hover:border-emerald-400 hover:bg-emerald-500/5'
                }`}
              >
                <input
                  ref={inputRef}
                  type='file'
                  accept='.csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel'
                  className='hidden'
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleFile(file);
                  }}
                />
                <div className='flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500'>
                  <FiUpload className='h-6 w-6' />
                </div>
                <div>
                  <p className='text-sm font-bold text-slate-900 dark:text-slate-100'>
                    {parsing
                      ? 'Reading file…'
                      : 'Click to choose a file, or drag it here'}
                  </p>
                  <p className='mt-1 text-xs text-slate-500 dark:text-slate-400'>
                    CSV or Excel (.xlsx) — your data stays in your browser until
                    you confirm the import.
                  </p>
                </div>
              </label>

              <div className='rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-4'>
                <p className='text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2'>
                  What you'll need
                </p>
                <ul className='list-disc pl-5 text-xs text-slate-600 dark:text-slate-300 space-y-1'>
                  <li>
                    A <span className='font-semibold'>Date</span> column for
                    each transaction.
                  </li>
                  <li>
                    Either a <span className='font-semibold'>Type</span> column
                    (Income/Expense, Credit/Debit, etc.) with an{' '}
                    <span className='font-semibold'>Amount</span> column, or
                    separate <span className='font-semibold'>Credit</span> /{' '}
                    <span className='font-semibold'>Debit</span> columns.
                  </li>
                  <li>
                    Column names don't need to match ours — you'll map them
                    next.
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* ── Step: Sheet selection (multi-sheet Excel) ── */}
          {step === 'sheet' && parsedFile && (
            <div className='flex flex-col gap-4'>
              <p className='text-sm text-slate-600 dark:text-slate-300'>
                <span className='font-semibold'>{fileName}</span> has multiple
                sheets. Choose the one that contains your transactions.
              </p>
              <div className='flex flex-col gap-2'>
                {parsedFile.sheets.map((s, i) => (
                  <button
                    key={s.name + i}
                    type='button'
                    onClick={() => chooseSheet(i)}
                    className='flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 px-4 py-3 text-left transition-colors hover:border-emerald-400 hover:bg-emerald-500/5'
                  >
                    <div className='flex items-center gap-3'>
                      <FiFile className='h-4 w-4 text-emerald-500' />
                      <span className='text-sm font-semibold text-slate-900 dark:text-slate-100'>
                        {s.name}
                      </span>
                    </div>
                    <span className='text-xs text-slate-500 dark:text-slate-400'>
                      {s.rows.length} row{s.rows.length !== 1 ? 's' : ''} ·{' '}
                      {s.headers.length} column
                      {s.headers.length !== 1 ? 's' : ''}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Step: Column mapping ── */}
          {step === 'map' && activeSheet && (
            <div className='flex flex-col gap-5'>
              <div className='flex items-center justify-between'>
                <p className='text-sm text-slate-600 dark:text-slate-300'>
                  Match your file's columns to the fields Fintrackly needs.
                  {activeSheet.rows.length > 0 && (
                    <>
                      {' '}
                      <span className='font-semibold'>
                        {activeSheet.rows.length}
                      </span>{' '}
                      rows detected.
                    </>
                  )}
                </p>
                {parsedFile && parsedFile.sheets.length > 1 && (
                  <button
                    type='button'
                    onClick={() => setStep('sheet')}
                    className='text-xs font-bold text-emerald-500 hover:text-emerald-400'
                  >
                    Change sheet
                  </button>
                )}
              </div>

              {/* Amount mode toggle */}
              <div>
                <label className={labelCls}>
                  How is Income/Expense represented?
                </label>
                <div className='flex gap-2'>
                  <button
                    type='button'
                    onClick={() =>
                      updateMapping({ amountMode: 'single' as AmountMode })
                    }
                    className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-bold transition-all ${
                      mapping.amountMode === 'single'
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-500'
                        : 'border-slate-300/80 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    One Type column + one Amount column
                  </button>
                  <button
                    type='button'
                    onClick={() =>
                      updateMapping({ amountMode: 'split' as AmountMode })
                    }
                    className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-bold transition-all ${
                      mapping.amountMode === 'split'
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-500'
                        : 'border-slate-300/80 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    Separate Credit / Debit columns
                  </button>
                </div>
              </div>

              {/* Required mapping fields */}
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                <FieldSelect
                  label='Date *'
                  headers={activeSheet.headers}
                  value={mapping.date}
                  onChange={(v) => updateMapping({ date: v })}
                />

                {mapping.amountMode === 'single' ? (
                  <>
                    <FieldSelect
                      label='Type (Income / Expense) *'
                      headers={activeSheet.headers}
                      value={mapping.type}
                      onChange={(v) => updateMapping({ type: v })}
                    />
                    <FieldSelect
                      label='Amount *'
                      headers={activeSheet.headers}
                      value={mapping.amount}
                      onChange={(v) => updateMapping({ amount: v })}
                    />
                  </>
                ) : (
                  <>
                    <FieldSelect
                      label='Credit / Income column'
                      headers={activeSheet.headers}
                      value={mapping.credit}
                      onChange={(v) => updateMapping({ credit: v })}
                    />
                    <FieldSelect
                      label='Debit / Expense column'
                      headers={activeSheet.headers}
                      value={mapping.debit}
                      onChange={(v) => updateMapping({ debit: v })}
                    />
                  </>
                )}

                <FieldSelect
                  label='Category (optional)'
                  headers={activeSheet.headers}
                  value={mapping.category}
                  onChange={(v) => updateMapping({ category: v })}
                />
                <FieldSelect
                  label='Notes / Description (optional)'
                  headers={activeSheet.headers}
                  value={mapping.notes}
                  onChange={(v) => updateMapping({ notes: v })}
                />
                <FieldSelect
                  label='Account (optional, matched by name)'
                  headers={activeSheet.headers}
                  value={mapping.account}
                  onChange={(v) => updateMapping({ account: v })}
                />
              </div>

              {/* Type value assignment table (only for single mode) */}
              {mapping.amountMode === 'single' &&
                mapping.type &&
                distinctTypeValues.length > 0 && (
                  <div className='rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden'>
                    <div className='px-4 py-3 bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800'>
                      <p className='text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'>
                        Assign each value found in "{mapping.type}"
                      </p>
                    </div>
                    <div className='divide-y divide-slate-100 dark:divide-slate-800'>
                      {distinctTypeValues.map((d) => (
                        <div
                          key={d.value}
                          className='flex items-center justify-between gap-3 px-4 py-2.5'
                        >
                          <div className='flex items-center gap-2 min-w-0'>
                            <span className='truncate text-sm font-semibold text-slate-900 dark:text-slate-100'>
                              {d.value}
                            </span>
                            <span className='shrink-0 text-[10px] font-bold text-slate-400 dark:text-slate-500'>
                              ({d.count} row{d.count !== 1 ? 's' : ''})
                            </span>
                          </div>
                          <div className='flex gap-1 shrink-0'>
                            {(
                              [
                                'income',
                                'expense',
                                'ignore',
                              ] as TypeValueAssignment[]
                            ).map((opt) => (
                              <button
                                key={opt}
                                type='button'
                                onClick={() =>
                                  setTypeValueMap((prev) => ({
                                    ...prev,
                                    [d.value]: opt,
                                  }))
                                }
                                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide transition-colors ${
                                  typeValueMap[d.value] === opt
                                    ? opt === 'income'
                                      ? 'bg-emerald-500/20 text-emerald-500'
                                      : opt === 'expense'
                                        ? 'bg-rose-500/20 text-rose-500'
                                        : 'bg-slate-300 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'
                                }`}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          )}

          {/* ── Step: Preview & confirm ── */}
          {step === 'preview' && (
            <div className='flex flex-col gap-4'>
              <div className='grid grid-cols-3 gap-3'>
                <div className='rounded-xl border border-emerald-200/60 dark:border-emerald-500/20 bg-emerald-50/60 dark:bg-emerald-500/10 p-3 text-center'>
                  <p className='text-2xl font-black text-emerald-600 dark:text-emerald-400'>
                    {selectedForImport.length}
                  </p>
                  <p className='text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400'>
                    Ready to import
                  </p>
                </div>
                <div className='rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-3 text-center'>
                  <p className='text-2xl font-black text-slate-700 dark:text-slate-200'>
                    {validResults.length - selectedForImport.length}
                  </p>
                  <p className='text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'>
                    Excluded (valid)
                  </p>
                </div>
                <div className='rounded-xl border border-rose-200/60 dark:border-rose-500/20 bg-rose-50/60 dark:bg-rose-500/10 p-3 text-center'>
                  <p className='text-2xl font-black text-rose-600 dark:text-rose-400'>
                    {invalidResults.length}
                  </p>
                  <p className='text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400'>
                    Invalid rows
                  </p>
                </div>
              </div>

              {invalidResults.length > 0 && (
                <div className='rounded-xl border border-rose-200/60 dark:border-rose-500/20 overflow-hidden'>
                  <div className='flex items-center gap-2 px-4 py-2.5 bg-rose-50/60 dark:bg-rose-500/10 border-b border-rose-200/60 dark:border-rose-500/20'>
                    <FiAlertTriangle className='h-4 w-4 text-rose-500' />
                    <p className='text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400'>
                      Rows that need fixing (won't be imported)
                    </p>
                  </div>
                  <div className='max-h-40 overflow-y-auto divide-y divide-rose-100 dark:divide-rose-500/10'>
                    {invalidResults.map((r) => (
                      <div key={r.rowNumber} className='px-4 py-2 text-xs'>
                        <span className='font-bold text-slate-700 dark:text-slate-300'>
                          Row {r.rowNumber + 1}:
                        </span>{' '}
                        <span className='text-rose-600 dark:text-rose-400'>
                          {r.errors.join(' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className='rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden'>
                <div className='px-4 py-2.5 bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between'>
                  <p className='text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'>
                    Preview ({validResults.length} valid rows)
                  </p>
                </div>
                <div className='max-h-72 overflow-y-auto'>
                  <table className='min-w-full text-left text-xs'>
                    <thead className='sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800'>
                      <tr>
                        <th className='px-3 py-2 w-8'></th>
                        <th className='px-3 py-2 font-bold text-slate-500 dark:text-slate-400'>
                          Date
                        </th>
                        <th className='px-3 py-2 font-bold text-slate-500 dark:text-slate-400'>
                          Type
                        </th>
                        <th className='px-3 py-2 font-bold text-slate-500 dark:text-slate-400'>
                          Category
                        </th>
                        <th className='px-3 py-2 font-bold text-slate-500 dark:text-slate-400'>
                          Notes
                        </th>
                        <th className='px-3 py-2 font-bold text-slate-500 dark:text-slate-400 text-right'>
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody className='divide-y divide-slate-100 dark:divide-slate-800'>
                      {validResults.map((r) => {
                        const excluded = excludedRows.has(r.rowNumber);
                        return (
                          <tr
                            key={r.rowNumber}
                            className={excluded ? 'opacity-40' : ''}
                          >
                            <td className='px-3 py-2'>
                              <input
                                type='checkbox'
                                checked={!excluded}
                                onChange={() => toggleRowExcluded(r.rowNumber)}
                                className='h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600'
                              />
                            </td>
                            <td className='px-3 py-2 text-slate-600 dark:text-slate-300'>
                              {r.draft!.date}
                            </td>
                            <td className='px-3 py-2'>
                              <span
                                className={
                                  r.draft!.type === 'income'
                                    ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                                    : 'text-rose-600 dark:text-rose-400 font-bold'
                                }
                              >
                                {r.draft!.type}
                              </span>
                            </td>
                            <td className='px-3 py-2 text-slate-700 dark:text-slate-200'>
                              {r.draft!.category}
                            </td>
                            <td className='px-3 py-2 max-w-[160px] truncate text-slate-500 dark:text-slate-400'>
                              {r.draft!.notes ?? '—'}
                            </td>
                            <td className='px-3 py-2 text-right font-bold text-slate-900 dark:text-slate-100'>
                              {r.draft!.amount.toLocaleString('en-IN')}
                            </td>
                          </tr>
                        );
                      })}
                      {validResults.length === 0 && (
                        <tr>
                          <td
                            colSpan={6}
                            className='px-3 py-8 text-center text-slate-400'
                          >
                            No valid rows to preview.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {importing && (
                <div className='rounded-xl border border-emerald-200/60 dark:border-emerald-500/20 bg-emerald-50/60 dark:bg-emerald-500/10 p-3'>
                  <div className='flex items-center justify-between text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-1.5'>
                    <span>Importing…</span>
                    <span>
                      {importProgress} / {selectedForImport.length}
                    </span>
                  </div>
                  <div className='h-2 w-full rounded-full bg-emerald-500/15 overflow-hidden'>
                    <div
                      className='h-full bg-emerald-500 transition-all'
                      style={{
                        width: `${
                          selectedForImport.length
                            ? Math.round(
                                (importProgress / selectedForImport.length) *
                                  100,
                              )
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className='flex items-center justify-between gap-3 border-t border-slate-200/70 dark:border-slate-800/60 px-5 py-4 rounded-b-2xl'>
          <div>
            {step === 'map' && (
              <button
                type='button'
                onClick={() =>
                  setStep(
                    parsedFile && parsedFile.sheets.length > 1
                      ? 'sheet'
                      : 'upload',
                  )
                }
                className='inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              >
                <FiArrowLeft className='h-4 w-4' /> Back
              </button>
            )}
            {step === 'preview' && !importing && (
              <button
                type='button'
                onClick={() => setStep('map')}
                className='inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              >
                <FiArrowLeft className='h-4 w-4' /> Back to mapping
              </button>
            )}
          </div>
          <div className='flex items-center gap-3'>
            <button
              type='button'
              onClick={onClose}
              disabled={importing}
              className='rounded-xl px-4 py-2.5 text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50'
            >
              Cancel
            </button>
            {step === 'map' && (
              <button
                type='button'
                onClick={goToPreview}
                disabled={!mappingComplete}
                className='inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0'
              >
                Preview <FiArrowRight className='h-4 w-4' />
              </button>
            )}
            {step === 'preview' && (
              <button
                type='button'
                onClick={confirmImport}
                disabled={importing || selectedForImport.length === 0}
                className='inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0'
              >
                <FiCheckCircle className='h-4 w-4' />
                {importing
                  ? 'Importing…'
                  : `Import ${selectedForImport.length} transaction${selectedForImport.length !== 1 ? 's' : ''}`}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────

function FieldSelect({
  label,
  headers,
  value,
  onChange,
}: {
  label: string;
  headers: string[];
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <div>
      <label className='text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 block'>
        {label}
      </label>
      <div className='relative'>
        <select
          value={value ?? NONE}
          onChange={(e) =>
            onChange(e.target.value === NONE ? null : e.target.value)
          }
          className='w-full appearance-none rounded-xl border border-slate-300/80 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-900/50 px-3 py-2.5 pr-8 text-sm font-medium text-slate-900 dark:text-slate-100 shadow-sm outline-none transition-all focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20'
        >
          <option value={NONE}>— Not mapped —</option>
          {headers.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
        <FiChevronDown className='pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400' />
      </div>
    </div>
  );
}
