import { FiInfo, FiTrendingUp, FiX } from 'react-icons/fi';
import { useRef, useState } from 'react';

import { parseZerodhaHoldingsXlsx } from '../../utils/csvImport';
import toast from 'react-hot-toast';
import { usePortfolioStore } from '../../store/portfolioStore';

export function ImportCsvButton() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const importInvestments = usePortfolioStore((s) => s.importInvestments);
  const [busy, setBusy] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  async function onPickFile(file: File) {
    setBusy(true);
    try {
      const lower = file.name.toLowerCase();

      if (!lower.endsWith('.xlsx') && !lower.endsWith('.xls')) {
        toast.error(
          'Please upload a Zerodha XLSX file from Console (console.zerodha.com).',
        );
        return;
      }

      const drafts = await parseZerodhaHoldingsXlsx(file);
      const result = await importInvestments(drafts);
      toast.success(
        `Zerodha: ${result.added} added, ${result.updated} updated, ${result.skipped} skipped.`,
      );
    } catch (e: any) {
      toast.error(e?.message ?? 'Import failed.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type='file'
        accept='.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel'
        className='hidden'
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onPickFile(file);
        }}
      />

      {/* Instructions Panel */}
      {showInstructions && (
        <div className='mb-3 rounded-xl border border-sky-200/80 bg-sky-50/60 p-4 dark:border-sky-500/20 dark:bg-sky-500/10'>
          <div className='flex items-start justify-between gap-2'>
            <div className='flex items-center gap-2 text-sm font-bold text-sky-700 dark:text-sky-300'>
              <FiInfo className='h-4 w-4 shrink-0' />
              How to Export from Zerodha
            </div>
            <button
              type='button'
              onClick={() => setShowInstructions(false)}
              className='text-sky-400 hover:text-sky-600 dark:text-sky-500 dark:hover:text-sky-300'
            >
              <FiX className='h-4 w-4' />
            </button>
          </div>

          <p className='mt-1 text-[11px] text-sky-500 dark:text-sky-400'>
            Via <strong>Console</strong> — downloads as{' '}
            <span className='rounded bg-emerald-100 px-1.5 py-0.5 font-mono text-[10px] text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'>
              XLSX
            </span>
          </p>

          <ol className='mt-2.5 space-y-1.5 text-xs text-sky-700 dark:text-sky-300'>
            <li>
              1. Login to{' '}
              <a
                href='https://console.zerodha.com'
                target='_blank'
                rel='noreferrer'
                className='underline underline-offset-2 hover:text-sky-900 dark:hover:text-sky-100'
              >
                console.zerodha.com
              </a>
            </li>
            <li>
              2. Go to <strong>Portfolio → Holdings</strong>
            </li>
            <li>
              3. Click the <strong>download icon</strong> (top right) to
              download the XLSX file
            </li>
            <li>4. Upload the downloaded XLSX file below</li>
          </ol>

          <p className='mt-3 text-[11px] text-sky-500 dark:text-sky-400 italic'>
            Supports both equity and mutual fund holdings.
          </p>
        </div>
      )}

      <div className='inline-flex items-center gap-1'>
        <button
          type='button'
          className='inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-sky-600 transition-colors hover:bg-sky-100/80 disabled:opacity-50 dark:text-sky-400 dark:hover:bg-sky-500/20'
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          title='Supports Zerodha Holdings (.xlsx) from Console'
        >
          <FiTrendingUp className='h-3.5 w-3.5' />
          <span>{busy ? 'Importing…' : 'Zerodha'}</span>
        </button>

        {/* Info toggle */}
        <button
          type='button'
          onClick={() => setShowInstructions((v) => !v)}
          title='How to export from Zerodha'
          className='inline-flex items-center rounded-lg px-1.5 py-1.5 text-xs text-sky-400 transition-colors hover:bg-sky-100/80 dark:text-sky-500 dark:hover:bg-sky-500/20'
        >
          {showInstructions ? (
            <FiX className='h-3.5 w-3.5' />
          ) : (
            <FiInfo className='h-3.5 w-3.5' />
          )}
        </button>
      </div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void onPickFile(file);
        }}
        className={`mt-2 rounded-lg border px-3 py-2 text-[11px] font-medium transition-colors ${
          dragOver
            ? 'border-sky-500 bg-sky-500/10 text-sky-600 dark:text-sky-300'
            : 'border-slate-300/70 dark:border-slate-700/70 text-slate-500 dark:text-slate-400'
        }`}
      >
        Drag & drop Zerodha XLSX here
      </div>
    </>
  );
}
