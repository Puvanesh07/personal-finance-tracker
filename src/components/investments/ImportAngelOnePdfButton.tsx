import {
  FiBriefcase,
  FiChevronDown,
  FiChevronUp,
  FiInfo,
  FiX,
} from 'react-icons/fi';
import { useRef, useState } from 'react';

import { ISIN_TO_SYMBOL } from '../../data/nseStockdata';
import { fetchStockMetadata } from '../../services/stockMetadataService';
import toast from 'react-hot-toast';
import { usePortfolioStore } from '../../store/portfolioStore';

export function ImportAngelOnePdfButton() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const importInvestments = usePortfolioStore((s) => s.importInvestments);
  const [busy, setBusy] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  async function onPickFile(file: File) {
    setBusy(true);
    try {
      const lower = file.name.toLowerCase();
      const rawDrafts: any[] = [];

      // ── 1. Parse CSV ──
      if (lower.endsWith('.csv')) {
        const text = await file.text();
        const lines = text.split(/\r?\n/).map((l) => l.trim());
        let type: 'stock' | 'mutual_fund' | null = null;
        let headerIdx = -1;

        // Auto-detect if it's the Equity CSV or Mutual Fund CSV based on the headers
        for (let i = 0; i < lines.length; i++) {
          if (
            lines[i].includes('Company Name') &&
            lines[i].includes('Total Quantity')
          ) {
            type = 'stock';
            headerIdx = i;
            break;
          } else if (
            lines[i].includes('Fund Name') &&
            lines[i].includes('Units')
          ) {
            type = 'mutual_fund';
            headerIdx = i;
            break;
          }
        }

        if (headerIdx !== -1 && type) {
          // Robust CSV splitting that ignores commas inside quotes
          const parseCsvLine = (line: string) =>
            line
              .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
              .map((c) => c.replace(/^"|"$/g, '').trim());

          const headers = parseCsvLine(lines[headerIdx]);
          const nameIdx = headers.indexOf(
            type === 'stock' ? 'Company Name' : 'Fund Name',
          );
          const isinIdx = headers.indexOf('ISIN');
          const qtyIdx = headers.indexOf(
            type === 'stock' ? 'Total Quantity' : 'Units',
          );

          // Dynamic matching for volatile column names
          const ltpIdx = headers.findIndex(
            (h) => h === 'LTP' || h.toLowerCase().startsWith('nav as on'),
          );
          const investedIdx = headers.indexOf('Invested Value');
          const marketValIdx = headers.findIndex(
            (h) =>
              h === 'Market Value' ||
              h.toLowerCase().startsWith('market value as on'),
          );

          for (let i = headerIdx + 1; i < lines.length; i++) {
            if (!lines[i]) continue;
            const cols = parseCsvLine(lines[i]);

            // Skip empty rows or summary rows
            if (cols.length < Math.max(nameIdx, qtyIdx, investedIdx)) continue;

            const name = cols[nameIdx];
            if (!name || name.includes('Total') || name.includes('Summary'))
              continue;

            const isin = isinIdx !== -1 ? cols[isinIdx] : '';
            const qty = Number(cols[qtyIdx]) || 0;

            // Grab EXACT values from Angel One
            const rawInvested =
              investedIdx !== -1 ? Number(cols[investedIdx]) : 0;
            const rawMarketVal =
              marketValIdx !== -1 ? Number(cols[marketValIdx]) : 0;
            const rawLtp = ltpIdx !== -1 ? Number(cols[ltpIdx]) : 0;

            // Only add if there is a valid quantity or invested amount
            if (qty > 0 || rawInvested > 0) {
              // Perfect math: Calculate exact per-unit price to avoid rounding bugs
              const buyPrice = qty > 0 ? rawInvested / qty : 0;
              const currentPrice =
                rawMarketVal > 0 && qty > 0 ? rawMarketVal / qty : rawLtp;

              rawDrafts.push({
                type,
                name,
                isin,
                qty,
                buyPrice,
                currentPrice,
                investedAmount: rawInvested,
              });
            }
          }
        }
      } else {
        toast.error(
          'Angel One XLSX files are password protected. Please upload the extracted CSV files instead!',
        );
        setBusy(false);
        if (inputRef.current) inputRef.current.value = '';
        return;
      }

      if (rawDrafts.length === 0) {
        toast.error(
          'No holdings found. Make sure you uploaded the correct Angel One Equity or Mutual Fund CSV.',
          { id: 'angel-import' },
        );
        return;
      }

      toast.loading(`Importing ${rawDrafts.length} assets...`, {
        id: 'angel-import',
      });

      // ── 2. Identify Symbols and Save to Portfolio ──
      const finalDrafts: any[] = [];

      for (const d of rawDrafts) {
        let sym = d.isin ? ISIN_TO_SYMBOL[d.isin] : undefined;
        if (!sym) {
          const cleaned = d.name
            .replace(/\b(Ltd|Limited|Corp|Corporation|Inc|Company)\b/gi, '')
            .trim();
          sym = cleaned
            .split(' ')
            .slice(0, 2)
            .join('')
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '');
        }

        let symbol = sym;
        let sector = undefined;

        if (symbol) {
          try {
            const meta = await fetchStockMetadata({
              symbol,
              isin: d.isin,
              name: d.name,
            });
            if (meta) {
              if (meta.sector && meta.sector !== 'Unknown')
                sector = meta.sector;
              if (meta.symbol && meta.symbol !== 'Unknown')
                symbol = meta.symbol;
            }
          } catch (e) {
            // Silent catch
          }
        }

        if (d.type === 'mutual_fund') {
          finalDrafts.push({
            type: 'mutual_fund',
            name: d.name,
            symbol: symbol,
            platform: 'angel_one',
            units: d.qty,
            nav: d.currentPrice,
            investedAmount: d.investedAmount, // MFs use investedAmount directly
          });
        } else {
          finalDrafts.push({
            type: 'stock',
            name: d.name,
            symbol: symbol,
            platform: 'angel_one',
            quantity: d.qty,
            buyPrice: d.buyPrice,
            currentPrice: d.currentPrice,
            sector: sector,
          });
        }
      }

      const result = await importInvestments(finalDrafts);
      toast.success(
        `Angel One: ${result.added} added, ${result.updated} updated, ${result.skipped} skipped.`,
        { id: 'angel-import' },
      );
    } catch (e: any) {
      toast.error(e?.message ?? 'Angel One import failed.', {
        id: 'angel-import',
      });
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

      {/* Instructions Panel */}
      {showInstructions && (
        <div className='mb-3 rounded-xl border border-indigo-200/80 bg-indigo-50/60 p-4 dark:border-indigo-500/20 dark:bg-indigo-500/10'>
          <div className='flex items-start justify-between gap-2'>
            <div className='flex items-center gap-2 text-sm font-bold text-indigo-700 dark:text-indigo-300'>
              <FiInfo className='h-4 w-4 shrink-0' />
              How to Export from Angel One
            </div>
            <button
              type='button'
              onClick={() => setShowInstructions(false)}
              className='text-indigo-400 hover:text-indigo-600 dark:text-indigo-500 dark:hover:text-indigo-300'
            >
              <FiX className='h-4 w-4' />
            </button>
          </div>

          <ol className='mt-3 space-y-1.5 text-xs text-indigo-700 dark:text-indigo-300'>
            <li>
              1. Open the <strong>Angel One app or website</strong> and log in
            </li>
            <li>
              2. Go to <strong>Portfolio</strong>
            </li>
            <li>
              3. Select the segment (<strong>Equity</strong> or{' '}
              <strong>Mutual Funds</strong>)
            </li>
            <li>
              4. Click the <strong>download icon</strong> (top right) to
              download your statement
            </li>
            <li>
              5. Upload the downloaded <strong>CSV file</strong> below
            </li>
          </ol>

          <p className='mt-2 text-[11px] text-indigo-500 dark:text-indigo-400 italic'>
            Upload Equity CSV and Mutual Fund CSV separately — each is imported
            individually.
          </p>

          <div className='mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-500/20 dark:bg-amber-500/10'>
            <p className='text-[11px] text-amber-700 dark:text-amber-300'>
              <strong>Password-protected file?</strong> Angel One may
              password-protect the download. Open the file in Excel or Google
              Sheets, enter the password, then re-save it as a new CSV file
              without a password before uploading.
            </p>
          </div>
        </div>
      )}

      <div className='inline-flex items-center gap-1'>
        <button
          type='button'
          className='inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-indigo-600 transition-colors hover:bg-indigo-100/80 disabled:opacity-50 dark:text-indigo-400 dark:hover:bg-indigo-500/20'
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          title='Imports Angel One CSV holdings statement'
        >
          <FiBriefcase className='h-3.5 w-3.5' />
          <span>{busy ? 'Importing…' : 'Angel One'}</span>
        </button>

        {/* Info toggle button */}
        <button
          type='button'
          onClick={() => setShowInstructions((v) => !v)}
          title='How to export from Angel One'
          className='inline-flex items-center gap-0.5 rounded-lg px-1.5 py-1.5 text-xs text-indigo-400 transition-colors hover:bg-indigo-100/80 dark:text-indigo-500 dark:hover:bg-indigo-500/20'
        >
          {showInstructions ? (
            <FiChevronUp className='h-3.5 w-3.5' />
          ) : (
            <FiInfo className='h-3.5 w-3.5' />
          )}
        </button>
      </div>
    </>
  );
}
