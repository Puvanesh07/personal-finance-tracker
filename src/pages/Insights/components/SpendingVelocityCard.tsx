import { useMemo } from 'react';
import { usePortfolioStore } from '../../../store/portfolioStore';
import { computeSpendingVelocity } from '../../../utils/spendingVelocity';
import { formatINR, formatNumber } from '../../../utils/format';

export function SpendingVelocityCard() {
  const cashflows = usePortfolioStore(s => s.cashflows);
  const v         = useMemo(() => computeSpendingVelocity(cashflows), [cashflows]);

  const barColor =
    v.verdict === 'critical'      ? 'bg-rose-500'
    : v.verdict === 'over'        ? 'bg-orange-500'
    : v.verdict === 'slightly_over' ? 'bg-amber-500'
    : 'bg-emerald-500';

  const textColor =
    v.verdict === 'critical'      ? 'text-rose-600 dark:text-rose-400'
    : v.verdict === 'over'        ? 'text-orange-600 dark:text-orange-400'
    : v.verdict === 'slightly_over' ? 'text-amber-600 dark:text-amber-400'
    : 'text-emerald-600 dark:text-emerald-400';

  const pct = Math.min(150, v.budgetUsedPct);

  return (
    <div className='rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 overflow-hidden'>
      <div className='px-5 py-4 border-b border-slate-100 dark:border-slate-800'>
        <h3 className='text-sm font-bold text-slate-800 dark:text-slate-100'>⚡ Spending Velocity</h3>
        <p className='text-[11px] text-slate-500 dark:text-slate-400 mt-0.5'>{v.message}</p>
      </div>

      {/* Main progress bar */}
      <div className='px-5 py-4'>
        <div className='flex justify-between text-xs mb-2'>
          <span className='text-slate-500 dark:text-slate-400'>Month progress: {v.daysElapsed}/{v.daysInMonth} days</span>
          <span className={`font-bold ${textColor}`}>{formatNumber(v.budgetUsedPct, 0)}% of avg used</span>
        </div>
        <div className='relative h-4 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden'>
          <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${pct * (100 / 150)}%` }} />
          {/* Day progress marker */}
          <div className='absolute top-0 bottom-0 w-0.5 bg-slate-600/40 dark:bg-slate-400/40' style={{ left: `${(v.daysElapsed / v.daysInMonth) * 100}%` }} />
        </div>
        <div className='flex justify-between text-[10px] text-slate-400 mt-1'>
          <span>Day {v.daysElapsed}</span>
          <span>{v.daysRemaining}d left</span>
        </div>
      </div>

      {/* Stats grid */}
      <div className='grid grid-cols-2 sm:grid-cols-4 gap-px bg-slate-100 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-800'>
        {[
          { label: 'Spent So Far',    value: formatINR(v.spentSoFar),            color: 'text-slate-900 dark:text-slate-100' },
          { label: 'Daily Burn Rate', value: `${formatINR(v.dailyBurnRate)}/d`,  color: textColor },
          { label: 'Projected End',   value: formatINR(v.projectedMonthEnd),     color: v.projectedMonthEnd > v.avgMonthlyExpense * 1.1 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-200' },
          { label: 'Monthly Avg',     value: formatINR(v.avgMonthlyExpense),     color: 'text-slate-500 dark:text-slate-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className='bg-white dark:bg-slate-900/60 px-3 py-2.5'>
            <p className='text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1'>{label}</p>
            <p className={`text-sm font-black tabular-nums ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Top categories */}
      {(v.topCategoryThisMonth || v.topCategoryToday) && (
        <div className='px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex gap-4 text-xs text-slate-500 dark:text-slate-400'>
          {v.topCategoryThisMonth && <span>📊 Top this month: <strong className='text-slate-700 dark:text-slate-200'>{v.topCategoryThisMonth}</strong></span>}
          {v.topCategoryToday    && <span>📅 Today: <strong className='text-slate-700 dark:text-slate-200'>{v.topCategoryToday}</strong></span>}
        </div>
      )}
    </div>
  );
}
