// src/components/dashboard/DashboardLiabilitiesSummary.tsx
import { FiArrowUpRight, FiTrendingDown } from 'react-icons/fi';
import { formatINR } from '../../utils/format';
import { useNavigate } from 'react-router-dom';
import { usePortfolioStore } from '../../store/portfolioStore';
import { useMemo } from 'react';

export function DashboardLiabilitiesSummary() {
  const liabilities = usePortfolioStore((s) => s.liabilities) ?? [];
  const navigate = useNavigate();

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
    <div className='rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-6 shadow-sm flex flex-col h-full'>
      <div className='mb-4 flex items-center justify-between'>
        <h2 className='flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100'>
          <FiTrendingDown className='text-rose-400' />
          Liabilities
        </h2>
        <button
          onClick={() => navigate('/liabilities')}
          title='Go to Liabilities'
          className='flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-rose-400 transition-colors'
        >
          <FiArrowUpRight className='h-4 w-4' />
        </button>
      </div>

      {active.length === 0 ? (
        <div className='flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 py-8 text-center'>
          <FiTrendingDown className='h-6 w-6 text-slate-300 dark:text-slate-600' />
          <p className='text-xs text-slate-400 dark:text-slate-500'>
            {liabilities.length > 0 ? 'All liabilities cleared!' : 'No liabilities recorded'}
          </p>
        </div>
      ) : (
        <>
          <div className='mb-4'>
            <p className='text-xs font-medium text-slate-500 uppercase tracking-wider'>Total Outstanding</p>
            <p className='text-2xl font-bold text-rose-400 tabular-nums'>{formatINR(totalOutstanding)}</p>
          </div>

          <div className='mt-auto grid grid-cols-2 gap-3 border-t border-slate-200/70 dark:border-slate-800/60 pt-4'>
            <div>
              <p className='text-xs font-medium text-slate-500 mb-1'>Active Loans</p>
              <p className='text-sm font-bold text-slate-700 dark:text-slate-200'>{active.length}</p>
            </div>
            <div>
              <p className='text-xs font-medium text-slate-500 mb-1'>Monthly EMI</p>
              <p className='text-sm font-bold text-rose-400 tabular-nums'>{formatINR(totalEmiMonthly)}</p>
            </div>
            {overdueCount > 0 && (
              <div className='col-span-2'>
                <p className='text-xs font-medium text-rose-500 mb-1'>Overdue</p>
                <p className='text-sm font-bold text-rose-400'>
                  {overdueCount} loan{overdueCount !== 1 ? 's' : ''} past due
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
