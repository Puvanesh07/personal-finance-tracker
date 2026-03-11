import { parseCSV, rowToInvestmentDraft } from '../../utils/csvImport';
import { useRef, useState } from 'react';

import { FiPieChart } from 'react-icons/fi';
import { parseIndmoneyXlsx } from '../../utils/indmoneyXlsxImport';
import toast from 'react-hot-toast';
import { usePortfolioStore } from '../../store/portfolioStore';

export function ImportIndmoneyButton() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const importInvestments = usePortfolioStore((s) => s.importInvestments);
  const [busy, setBusy] = useState(false);

  async function onPickFile(file: File) {
    setBusy(true);
    try {
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.xlsx')) {
        const drafts = await parseIndmoneyXlsx(file);
        const result = await importInvestments(drafts as any[]);
        toast.success(
          `INDmoney: ${result.added} added, ${result.updated} updated, ${result.skipped} skipped.`,
        );
        return;
      }

      const text = await file.text();
      const rows = parseCSV(text);

      const drafts = rows
        .map((row) => rowToInvestmentDraft(row))
        .filter(Boolean);

      const result = await importInvestments(drafts as any[]);
      toast.success(
        `INDmoney CSV: ${result.added} added, ${result.updated} updated, ${result.skipped} skipped.`,
      );
    } catch (e: any) {
      toast.error(e?.message ?? 'INDmoney import failed.');
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
        accept='.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.csv,text/csv'
        className='hidden'
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onPickFile(file);
        }}
      />
      <button
        type='button'
        className='inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-violet-600 transition-colors hover:bg-violet-100/80 disabled:opacity-50 dark:text-violet-400 dark:hover:bg-violet-500/20'
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        title='INDmoney import (XLSX/CSV). If it doesn’t map correctly, share a sample export and I’ll add INDmoney-specific auto-mapping.'
      >
        <FiPieChart className='h-3.5 w-3.5' />
        <span>{busy ? 'Importing…' : 'INDmoney'}</span>
      </button>
    </>
  );
}
