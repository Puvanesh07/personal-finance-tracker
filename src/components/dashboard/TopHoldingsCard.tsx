// src/components/dashboard/TopHoldingsCard.tsx
//
// Top Holdings at a glance on the shared card shell. Reuses source-of-truth
// value helpers (currentValue / investedValue) — no duplicated math. Chip
// filters replace the old native select for a cleaner, touch-friendly control.

import { useMemo, useState } from 'react';
import { FiTrendingUp } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

import type { Investment } from '../../types/investmentTypes';
import { currentValue, investedValue } from '../../utils/calculations';
import {
  classifyInvestmentBucket,
  includeHoldingByFilter,
  type DashboardHoldingFilter,
} from '../../utils/assetClassification';
import { formatINR } from '../../utils/format';
import { usePortfolioStore } from '../../store/portfolioStore';
import { ACCENT, CardGo, DashboardCard } from './DashboardCard';

const FILTERS: { value: DashboardHoldingFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'equity', label: 'Equity' },
  { value: 'stocks', label: 'Stocks' },
  { value: 'mutual_funds', label: 'Mutual Funds' },
  { value: 'etfs', label: 'ETFs' },
  { value: 'gold', label: 'Gold' },
  { value: 'bonds', label: 'Bonds' },
];

function bucketLabel(inv: Investment): string {
  const bucket = classifyInvestmentBucket(inv);
  return (
    {
      stocks: 'Equity',
      mutualFunds: 'MF',
      etfs: 'ETF',
      gold: 'Gold',
      silver: 'Silver',
      bonds: 'Debt',
      other: 'Other',
      receivables: 'Other',
    }[bucket] ?? 'Other'
  );
}

function shortINR(n: number): string {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)}Cr`;
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(2)}L`;
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`;
  return formatINR(n);
}

function HoldingRow({ inv }: { inv: Investment }) {
  const cv = currentValue(inv);
  const iv = investedValue(inv);
  const pl = cv - iv;
  const isProfit = pl >= 0;
  const pct = iv > 0 ? (pl / iv) * 100 : 0;

  return (
    <div className='flex items-center justify-between gap-3 rounded-2xl bg-slate-50/80 px-3.5 py-2.5 transition-colors hover:bg-slate-100/80 dark:bg-slate-800/40 dark:hover:bg-slate-800/70'>
      <div className='min-w-0 flex-1'>
        <div className='flex items-center gap-2'>
          <p className='truncate text-sm font-bold text-slate-800 dark:text-slate-100'>{inv.name}</p>
          <span className='shrink-0 rounded-md bg-slate-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'>
            {bucketLabel(inv)}
          </span>
        </div>
        <p className='mt-0.5 truncate text-[11px] text-slate-400 dark:text-slate-500'>
          Invested {shortINR(iv)}
        </p>
      </div>
      <div className='shrink-0 text-right'>
        <p className='text-sm font-black tabular-nums text-slate-800 dark:text-slate-50'>{shortINR(cv)}</p>
        {iv > 0 && (
          <p
            className={`text-[11px] font-bold tabular-nums ${
              isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {isProfit ? '+' : ''}
            {pct.toFixed(1)}%
          </p>
        )}
      </div>
    </div>
  );
}

export function TopHoldingsCard() {
  const investments = usePortfolioStore((s) => s.investments);
  const navigate = useNavigate();
  const [filter, setFilter] = useState<DashboardHoldingFilter>('all');

  const top = useMemo(
    () =>
      investments
        .filter((inv) => includeHoldingByFilter(inv, filter))
        .slice()
        .sort((a, b) => currentValue(b) - currentValue(a))
        .slice(0, 6),
    [investments, filter],
  );

  return (
    <DashboardCard
      icon={<FiTrendingUp className='h-5 w-5' />}
      accent={ACCENT.emerald}
      title='Top Holdings'
      subtitle='Largest positions by value'
      action={<CardGo to='/wealth?tab=assets' />}
    >
      <div className='mb-4 flex flex-wrap gap-1.5'>
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type='button'
            onClick={() => setFilter(f.value)}
            className={`cursor-pointer rounded-full px-3 py-1 text-[11px] font-bold transition-colors ${
              filter === f.value
                ? 'bg-emerald-500 text-white'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {top.length === 0 ? (
        <div className='flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 py-10 text-center dark:border-slate-700'>
          <FiTrendingUp className='h-7 w-7 text-slate-300 dark:text-slate-600' />
          <p className='text-sm font-medium text-slate-500 dark:text-slate-400'>
            No holdings for this filter.
          </p>
          <button
            onClick={() => navigate('/wealth?tab=assets')}
            className='text-xs font-bold text-emerald-500 hover:text-emerald-400'
          >
            Add your first investment →
          </button>
        </div>
      ) : (
        <div className='flex flex-col gap-2'>
          {top.map((inv) => (
            <HoldingRow key={inv.id} inv={inv} />
          ))}
        </div>
      )}
    </DashboardCard>
  );
}
