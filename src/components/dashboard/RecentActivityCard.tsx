// src/components/dashboard/RecentActivityCard.tsx
//
// Latest money movement (income / expense / transfer) on the shared card shell.
// Reads the reactive cashflows list — no new calculation, just a compact feed.
// Full editing lives in the Cash & Flow module.

import { useMemo } from 'react';
import { FiArrowDownLeft, FiArrowUpRight, FiActivity, FiRepeat } from 'react-icons/fi';

import type { CashflowEntry } from '../../types/investmentTypes';
import { formatINR } from '../../utils/format';
import { usePortfolioStore } from '../../store/portfolioStore';
import { ACCENT, CardGo, DashboardCard } from './DashboardCard';

function typeMeta(t: CashflowEntry['type']) {
  switch (t) {
    case 'income':
      return { Icon: FiArrowDownLeft, cls: 'text-emerald-600 bg-emerald-500/10 dark:text-emerald-400', sign: '+' };
    case 'expense':
      return { Icon: FiArrowUpRight, cls: 'text-rose-600 bg-rose-500/10 dark:text-rose-400', sign: '-' };
    default:
      return { Icon: FiRepeat, cls: 'text-sky-600 bg-sky-500/10 dark:text-sky-400', sign: '' };
  }
}

export function RecentActivityCard() {
  const cashflows = usePortfolioStore((s) => s.cashflows);

  const recent = useMemo(
    () =>
      [...cashflows]
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
        .slice(0, 7),
    [cashflows],
  );

  return (
    <DashboardCard
      icon={<FiActivity className='h-5 w-5' />}
      accent={ACCENT.sky}
      title='Recent Activity'
      subtitle='Latest money in and out'
      action={<CardGo to='/cashflow' />}
    >
      {recent.length === 0 ? (
        <div className='flex h-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-200 py-5 text-center dark:border-slate-700'>
          <FiActivity className='h-5 w-5 text-slate-300 dark:text-slate-600' />
          <p className='text-xs text-slate-500 dark:text-slate-400'>No transactions yet.</p>
        </div>
      ) : (
        <div className='flex flex-col gap-0.5'>
          {recent.map((c) => {
            const { Icon, cls, sign } = typeMeta(c.type);
            return (
              <div
                key={c.id}
                className='flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${cls}`}>
                  <Icon className='h-3.5 w-3.5' />
                </span>
                <div className='min-w-0 flex-1'>
                  <p className='truncate text-[13px] font-bold text-slate-800 dark:text-slate-100'>
                    {c.notes || c.category}
                  </p>
                  <p className='truncate text-[10px] font-medium text-slate-400 dark:text-slate-500'>
                    {[c.category, c.subcategory, c.date].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <p
                  className={`shrink-0 text-[13px] font-black tabular-nums ${
                    c.type === 'income'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : c.type === 'expense'
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {sign}
                  {formatINR(c.amount)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </DashboardCard>
  );
}
