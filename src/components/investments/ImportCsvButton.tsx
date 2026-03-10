// src/components/investments/ImportCsvButton.tsx

import {
  parseCSV,
  parseZerodhaHoldingsXlsx,
  rowToInvestmentDraft,
} from '../../utils/csvImport';
import { useRef, useState } from 'react';

import { FiTrendingUp } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { usePortfolioStore } from '../../store/portfolioStore';

export function ImportCsvButton() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const addInvestment = usePortfolioStore((s) => s.addInvestment);
  const [busy, setBusy] = useState(false);

  async function onPickFile(file: File) {
    setBusy(true);
    try {
      const lower = file.name.toLowerCase();
      let ok = 0;
      let skipped = 0;

      // Route to the new XLSX parser if Excel
      if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
        const drafts = await parseZerodhaHoldingsXlsx(file);
        for (const d of drafts) {
          await addInvestment(d);
          ok++;
        }
      } else {
        // Fallback to legacy CSV parser
        const text = await file.text();
        const rows = parseCSV(text);
        for (const row of rows) {
          const draft = rowToInvestmentDraft(row);
          if (!draft) {
            skipped++;
            continue;
          }
          await addInvestment(draft as any);
          ok++;
        }
      }

      toast.success(
        `Imported ${ok} asset(s).${skipped > 0 ? ` Skipped ${skipped}.` : ''}`,
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
        // Force the OS file picker to show Excel files alongside CSVs
        accept='.csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel'
        className='hidden'
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onPickFile(file);
        }}
      />
      <button
        type='button'
        className='inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-sky-600 transition-colors hover:bg-sky-100/80 disabled:opacity-50 dark:text-sky-400 dark:hover:bg-sky-500/20'
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        title='Supports Zerodha Holdings (.xlsx / .csv)'
      >
        <FiTrendingUp className='h-3.5 w-3.5' />
        <span>{busy ? 'Importing…' : 'Zerodha'}</span>
      </button>
    </>
  );
}
