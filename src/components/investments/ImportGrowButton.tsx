import { parseCSV, rowToInvestmentDraft } from '../../utils/csvImport';
import { useRef, useState } from 'react';

import { FiUserCheck } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { usePortfolioStore } from '../../store/portfolioStore';

export function ImportGrowwButton() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const importInvestments = usePortfolioStore((s) => s.importInvestments);
  const [busy, setBusy] = useState(false);

  async function onPickFile(file: File) {
    setBusy(true);
    try {
      const text = await file.text();
      const rows = parseCSV(text);

      const drafts = rows
        .map((row) => rowToInvestmentDraft(row))
        .filter(Boolean)
        .map((draft) => ({ ...draft, platform: 'groww' })); // Explicitly tag as groww for deduplication

      const result = await importInvestments(drafts as any[]);
      toast.success(
        `Groww: ${result.added} added, ${result.updated} updated, ${result.skipped} skipped.`,
      );
    } catch (e: any) {
      toast.error(e?.message ?? 'Groww import failed.');
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
        accept='.csv,text/csv'
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
        title='Supports Groww holdings export CSV'
      >
        <FiUserCheck className='h-3.5 w-3.5' />
        <span>{busy ? 'Importing…' : 'Groww'}</span>
      </button>
    </>
  );
}
