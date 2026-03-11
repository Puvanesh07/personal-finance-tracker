// src/components/investments/ImportAngelOnePdfButton.tsx

import { useRef, useState } from 'react';

import { FiBriefcase } from 'react-icons/fi';
import { ISIN_TO_SYMBOL } from '../../data/nseStockdata';
import { fetchStockMetadata } from '../../services/stockMetadataService';
import toast from 'react-hot-toast';
import { usePortfolioStore } from '../../store/portfolioStore';

export function ImportAngelOnePdfButton() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const addInvestment = usePortfolioStore((s) => s.addInvestment);
  const [busy, setBusy] = useState(false);

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
      let ok = 0;

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
          await addInvestment({
            type: 'mutual_fund',
            name: d.name,
            symbol: symbol,
            platform: 'angel_one',
            units: d.qty,
            nav: d.currentPrice,
            investedAmount: d.investedAmount, // MFs use investedAmount directly
          } as any);
        } else {
          await addInvestment({
            type: 'stock',
            name: d.name,
            symbol: symbol,
            platform: 'angel_one',
            quantity: d.qty,
            buyPrice: d.buyPrice,
            currentPrice: d.currentPrice,
            sector: sector,
          } as any);
        }
        ok++;
      }

      toast.success(`Successfully imported ${ok} Angel One holding(s)!`, {
        id: 'angel-import',
      });
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
    </>
  );
}
