import { useMemo } from 'react';
import { usePortfolioStore } from '../../../store/portfolioStore';
import { computePassiveIncome } from '../../../utils/passiveIncome';
import { formatINR, formatNumber } from '../../../utils/format';

export function PassiveIncomeCard() {
  const { cashflows, investments, essentials } = usePortfolioStore();

  const avgMonthlyExpense = useMemo(() => {
    const exp    = cashflows.filter(e => e.type === 'expense');
    const months = new Set(exp.map(e => e.date.slice(0, 7))).size || 1;
    return exp.reduce((a, e) => a + e.amount, 0) / months;
  }, [cashflows]);

  const result = useMemo(
    () => computePassiveIncome(cashflows, investments, avgMonthlyExpense),
    [cashflows, investments, avgMonthlyExpense],
  );

  void essentials;

  if (result.streams.length === 0) {
    return (
      <div className='rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-5'>
        <h3 className='text-sm font-bold text-slate-800 dark:text-slate-100 mb-1'>💤 Passive Income</h3>
        <p className='text-xs text-slate-400'>No passive income detected yet. Add dividend, interest or rental income entries.</p>
      </div>
    );
  }

  const coverageColor = result.coverageOfExpensesPct >= 100 ? 'text-emerald-600 dark:text-emerald-400' : result.coverageOfExpensesPct >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-200';

  return (
    <div className='rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 overflow-hidden'>
      <div className='px-5 py-4 border-b border-slate-100 dark:border-slate-800'>
        <h3 className='text-sm font-bold text-slate-800 dark:text-slate-100'>💤 Passive Income Dashboard</h3>
      </div>

      {/* Summary */}
      <div className='grid grid-cols-3 gap-px bg-slate-100 dark:bg-slate-800'>
        {[
          { label: 'Monthly Passive', value: formatINR(result.totalMonthly), color: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Annual Total',    value: formatINR(result.totalAnnual),   color: 'text-slate-900 dark:text-slate-100' },
          { label: 'Expense Cover',   value: `${formatNumber(result.coverageOfExpensesPct, 0)}%`, color: coverageColor },
        ].map(({ label, value, color }) => (
          <div key={label} className='bg-white dark:bg-slate-900/60 px-3 py-3 text-center'>
            <p className='text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1'>{label}</p>
            <p className={`text-sm font-black tabular-nums ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Expense coverage bar */}
      <div className='px-5 py-3 border-b border-slate-100 dark:border-slate-800'>
        <div className='flex justify-between text-[10px] text-slate-500 mb-1'>
          <span>Passive income covers {formatNumber(result.coverageOfExpensesPct, 0)}% of expenses</span>
          <span>FI Progress: {formatNumber(result.passiveTowardFIPct, 1)}%</span>
        </div>
        <div className='h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden'>
          <div className='h-full rounded-full bg-emerald-500 transition-all' style={{ width: `${Math.min(100, result.coverageOfExpensesPct)}%` }} />
        </div>
        {result.fiNumber > 0 && (
          <p className='text-[10px] text-slate-400 mt-1'>FI corpus needed: {formatINR(result.fiNumber)}</p>
        )}
      </div>

      {/* Streams */}
      <div className='divide-y divide-slate-50 dark:divide-slate-800/60'>
        {result.streams.map((s, i) => (
          <div key={i} className='flex items-center justify-between px-5 py-3'>
            <div className='flex items-center gap-3'>
              <span className='text-lg'>{s.emoji}</span>
              <div>
                <p className='text-sm font-semibold text-slate-800 dark:text-slate-200'>{s.label}</p>
                <p className='text-[10px] text-slate-400'>Last: {s.lastDate}</p>
              </div>
            </div>
            <div className='text-right'>
              <p className='text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums'>{formatINR(s.monthlyAvg)}/mo</p>
              <p className='text-[10px] text-slate-400'>{formatINR(s.annualTotal)}/yr</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
