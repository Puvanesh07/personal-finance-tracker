import { FiArrowUpRight, FiSun } from 'react-icons/fi';

import { useMemo } from 'react';
import { computeAgriSummary } from '../../utils/agriCalculations';
import { formatCurrency } from '../../utils/format';
import { useAgriStore } from '../../store/agricultureStore';
import { useNavigate } from 'react-router-dom';
import { useEnsureAgriHydrated } from '../../hooks/useDeferredStoreHydration';

export function DashboardAgriSummary() {
  const agriReady = useEnsureAgriHydrated();
  const cropCycles = useAgriStore((s) => s.cropCycles);
  const agriExpenses = useAgriStore((s) => s.agriExpenses);
  const milkRecords = useAgriStore((s) => s.milkRecords);
  const coconutRecords = useAgriStore((s) => s.coconutRecords);
  const livestockEvents = useAgriStore((s) => s.livestockEvents);
  const produceSales = useAgriStore((s) => s.produceSales);
  const navigate = useNavigate();

  const summary = useMemo(
    () =>
      agriReady
        ? computeAgriSummary({
            cropCycles,
            agriExpenses,
            milkRecords,
            coconutRecords,
            livestockEvents,
            produceSales,
          })
        : null,
    [
      agriReady,
      cropCycles,
      agriExpenses,
      milkRecords,
      coconutRecords,
      livestockEvents,
      produceSales,
    ],
  );

  if (!agriReady || !summary) {
    return (
      <div className='rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-6 shadow-sm flex flex-col h-full animate-pulse'>
        <div className='h-4 w-40 rounded bg-slate-200 dark:bg-slate-800 mb-4' />
        <div className='h-8 w-32 rounded bg-slate-200 dark:bg-slate-800' />
      </div>
    );
  }

  return (
    <div className='rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-6 shadow-sm flex flex-col h-full'>
      <div className='mb-4 flex items-center justify-between'>
        <h2 className='flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-100'>
          <FiSun className='text-amber-400' />
          Agriculture Overview
        </h2>
        <button
          onClick={() => navigate('/agriculture')}
          title='Go to Agriculture'
          className='flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-amber-400 transition-colors'
        >
          <FiArrowUpRight className='h-4 w-4' />
        </button>
      </div>

      <div className='mb-5 flex justify-between items-end'>
        <div>
          <p className='text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider'>
            All-Time Net Profit
          </p>
          <p
            className={`text-2xl font-bold ${summary.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
          >
            {summary.netProfit >= 0 ? '+' : ''}
            {formatCurrency(summary.netProfit)}
          </p>
        </div>
        <div className='text-right'>
          <span className='inline-flex items-center rounded-md bg-amber-500/10 px-2 py-1 text-xs font-bold text-amber-400 border border-amber-500/20'>
            {summary.activeCrops} Active Crops
          </span>
        </div>
      </div>

      <div className='mt-auto grid grid-cols-2 gap-4 border-t border-slate-200/70 dark:border-slate-800/60 pt-4'>
        <div>
          <p className='text-xs font-medium text-slate-500 dark:text-slate-400 mb-1'>
            Total Revenue
          </p>
          <p className='text-sm font-semibold text-emerald-400'>
            {formatCurrency(summary.totalIncome)}
          </p>
        </div>
        <div>
          <p className='text-xs font-medium text-slate-500 dark:text-slate-400 mb-1'>
            Total Expenses
          </p>
          <p className='text-sm font-semibold text-rose-400'>
            {formatCurrency(summary.totalExpenses)}
          </p>
        </div>
      </div>
    </div>
  );
}
