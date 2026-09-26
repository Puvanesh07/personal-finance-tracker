// src/components/dashboard/DashboardLiabilitiesSummary.tsx
import { FiTrendingDown } from 'react-icons/fi';
import { formatINR } from '../../utils/format';
import { usePortfolioStore } from '../../store/portfolioStore';
import { useMemo } from 'react';
import { ACCENT, CardGo, DashboardCard } from './DashboardCard';

export function DashboardLiabilitiesSummary() {
  const liabilities = usePortfolioStore((s) => s.liabilities) ?? [];

  const active = liabilities.filter(
    (l) => l.status !== 'paid' && l.status !== 'returned',
  );

  const { totalOutstanding, totalEmiMonthly, overdueCount } = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    let outstanding = 0;
    let emi = 0;
    let overdue = 0;
    for (const l of active) {
      outstanding += l.outstanding || 0;
      emi += l.emiAmount || 0;
      if (l.endDate && l.endDate < today) overdue++;
    }
    return { totalOutstanding: outstanding, totalEmiMonthly: emi, overdueCount: overdue };
  }, [active]);

  return (
    <DashboardCard
      icon={<FiTrendingDown className='h-5 w-5' />}
      accent={ACCENT.rose}
      title='Liabilities'
      subtitle='Loans & outstanding debt'
      action={<CardGo to='/wealth?tab=liabilities' />}
    >
      {active.length === 0 ? (
        <div className='flex h-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-200 py-5 text-center dark:border-slate-700'>
          <FiTrendingDown className='h-5 w-5 text-slate-300 dark:text-slate-600' />
          <p className='text-xs text-slate-500 dark:text-slate-400'>
            {liabilities.length > 0 ? 'All liabilities cleared!' : 'No liabilities recorded'}
          </p>
        </div>
      ) : (
        <>
          <div className='mb-3'>
            <p className='text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500'>
              Total Outstanding
            </p>
            <p className='mt-0.5 text-xl font-black tracking-tight text-rose-600 tabular-nums dark:text-rose-400'>
              {formatINR(totalOutstanding)}
            </p>
          </div>

          <div className='grid grid-cols-2 gap-2'>
            <div className='rounded-xl bg-slate-50/80 px-3 py-2 dark:bg-slate-800/40'>
              <p className='text-[11px] font-medium text-slate-500 dark:text-slate-400'>Active Loans</p>
              <p className='mt-0.5 text-sm font-black text-slate-800 dark:text-slate-100'>{active.length}</p>
            </div>
            <div className='rounded-xl bg-slate-50/80 px-3 py-2 dark:bg-slate-800/40'>
              <p className='text-[11px] font-medium text-slate-500 dark:text-slate-400'>Monthly EMI</p>
              <p className='mt-0.5 text-sm font-black text-rose-600 tabular-nums dark:text-rose-400'>
                {formatINR(totalEmiMonthly)}
              </p>
            </div>
            {overdueCount > 0 && (
              <div className='col-span-2 rounded-xl border border-rose-500/20 bg-rose-500/5 px-3 py-2'>
                <p className='text-xs font-bold text-rose-600 dark:text-rose-400'>
                  ⚠ {overdueCount} loan{overdueCount !== 1 ? 's' : ''} past due
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </DashboardCard>
  );
}
