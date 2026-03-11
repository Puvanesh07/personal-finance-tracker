import { useRef, useState } from 'react';

import { FiBriefcase } from 'react-icons/fi';
import { fetchStockMetadata } from '../../services/stockMetadataService';
import { resolveIsins } from '../../services/isinService';
import toast from 'react-hot-toast';
import { usePortfolioStore } from '../../store/portfolioStore';

// ← dynamic API, replaces manual ISIN_TO_SYMBOL

export function ImportAngelOnePdfButton() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const importInvestments = usePortfolioStore((s) => s.importInvestments);
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
            if (cols.length < Math.max(nameIdx, qtyIdx, investedIdx)) continue;
            const name = cols[nameIdx];
            if (!name || name.includes('Total') || name.includes('Summary'))
              continue;

            const isin = isinIdx !== -1 ? cols[isinIdx] : '';
            const qty = Number(cols[qtyIdx]) || 0;
            const rawInvested =
              investedIdx !== -1 ? Number(cols[investedIdx]) : 0;
            const rawMarketVal =
              marketValIdx !== -1 ? Number(cols[marketValIdx]) : 0;
            const rawLtp = ltpIdx !== -1 ? Number(cols[ltpIdx]) : 0;

            if (qty > 0 || rawInvested > 0) {
              rawDrafts.push({
                type,
                name,
                isin,
                qty,
                buyPrice: qty > 0 ? rawInvested / qty : 0,
                currentPrice:
                  rawMarketVal > 0 && qty > 0 ? rawMarketVal / qty : rawLtp,
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

      // ── 2. Resolve ALL ISINs dynamically via Worker → NSE API ─────────────
      // Replaces the entire manual ISIN_TO_SYMBOL map.
      // Worker tries: NSE search → NSE quote → OpenFIGI (3 fallbacks)
      // Results cached in localStorage for 30 days → instant on re-import
      toast.loading(`Resolving ${rawDrafts.length} ISINs via NSE API…`, {
        id: 'angel-import',
      });
      const allIsins = rawDrafts.map((d) => d.isin).filter(Boolean);
      const isinMap = await resolveIsins(allIsins);

      toast.loading(`Importing ${rawDrafts.length} assets...`, {
        id: 'angel-import',
      });

      // ── 3. Build final drafts ─────────────────────────────────────────────
      const finalDrafts: any[] = [];

      for (const d of rawDrafts) {
        // Symbol from NSE API — always correct, not overrideable
        let symbol = d.isin
          ? (isinMap[d.isin.toUpperCase()] ?? undefined)
          : undefined;

        // Fallback only if NSE API couldn't resolve (rare — e.g. delisted)
        if (!symbol) {
          const cleaned = d.name
            .replace(/\b(Ltd|Limited|Corp|Corporation|Inc|Company)\b/gi, '')
            .trim();
          symbol = cleaned
            .split(' ')
            .slice(0, 2)
            .join('')
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '');
          console.warn(
            `[AngelOneImport] ISIN ${d.isin} unresolved for "${d.name}" — name fallback: ${symbol}`,
          );
        }

        // Get sector from static DB — but NEVER let it override the NSE-resolved symbol
        let sector: string | undefined = undefined;
        try {
          const meta = await fetchStockMetadata({
            symbol,
            isin: d.isin,
            name: d.name,
          });
          if (meta?.sector && meta.sector !== 'Unknown') sector = meta.sector;
        } catch {
          /* silent */
        }

        if (d.type === 'mutual_fund') {
          finalDrafts.push({
            type: 'mutual_fund',
            name: d.name,
            symbol,
            platform: 'angel_one',
            units: d.qty,
            nav: d.currentPrice,
            investedAmount: d.investedAmount,
          });
        } else {
          finalDrafts.push({
            type: 'stock',
            name: d.name,
            symbol,
            platform: 'angel_one',
            quantity: d.qty,
            buyPrice: d.buyPrice,
            currentPrice: d.currentPrice,
            sector,
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
