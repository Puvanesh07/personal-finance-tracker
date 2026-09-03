import { useMemo } from 'react';
import { usePortfolioStore } from '../../../store/portfolioStore';
import { detectLifestyleInflation } from '../../../utils/lifestyleInflation';
import { formatINR, formatNumber } from '../../../utils/format';

export function LifestyleInflationCard() {
  const cashflows = usePortfolioStore(s => s.cashflows);
  const result    = useMemo(() => detectLifestyleInflation(cashflows), [cashflows]);

  const verdictColor =
    result.verdict === 'creep'   ? 'text-rose-600 dark:text-rose-400'
    : result.verdict === 'watch' ? 'text-amber-600 dark:text-amber-400'
    : 'text-emerald-600 dark:text-emerald-400';

  const verdictBg =
    result.verdict === 'creep'   ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-700/40'
    : result.verdict === 'watch' ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700/40'
    : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700/40';

  const emoji = result.verdict === 'creep' ? '📈' : result.verdict === 'watch' ? '⚠️' : '✅';

  if (result.months.length < 3) {
    return (
      <div className='rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-5'>
        <h3 className='text-sm font-bold text-slate-800 dark:text-slate-100 mb-1'>🧬 Lifestyle Inflation</h3>
        <p className='text-xs text-slate-400'>Need 3+ months of cashflow data.</p>
      </div>
    );
  }

  return (
    <div className='rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 overflow-hidden'>
      <div className='px-5 py-4 border-b border-slate-100 dark:border-slate-800'>
        <h3 className='text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2'>
          🧬 Lifestyle Inflation Detector
        </h3>
      </div>

      {/* Verdict banner */}
      <div className={`mx-4 mt-4 rounded-xl border px-4 py-3 ${verdictBg}`}>
        <div className='flex items-center gap-2'>
          <span className='text-xl'>{emoji}</span>
          <div>
            <p className={`text-sm font-bold ${verdictColor}`}>
              {result.verdict === 'creep' ? 'Lifestyle Creep Detected' : result.verdict === 'watch' ? 'Watch Your Spending' : 'Healthy Pattern'}
            </p>
            <p className={`text-[11px] mt-0.5 ${verdictColor} opacity-80`}>{result.message}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className='grid grid-cols-3 gap-px bg-slate-100 dark:bg-slate-800 mx-4 my-4 rounded-xl overflow-hidden'>
        {[
          { label: 'Income Growth', value: `${result.incomeGrowthPct >= 0 ? '+' : ''}${formatNumber(result.incomeGrowthPct, 1)}%`, color: result.incomeGrowthPct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500' },
          { label: 'Expense Growth', value: `${result.expenseGrowthPct >= 0 ? '+' : ''}${formatNumber(result.expenseGrowthPct, 1)}%`, color: result.expenseGrowthPct >= 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-500' },
          { label: 'Creep Gap', value: `${result.creepGapPct >= 0 ? '+' : ''}${formatNumber(result.creepGapPct, 1)}%`, color: result.creepGapPct > 10 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-200' },
        ].map(({ label, value, color }) => (
          <div key={label} className='bg-white dark:bg-slate-900/60 px-3 py-2.5 text-center'>
            <p className='text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1'>{label}</p>
            <p className={`text-sm font-black tabular-nums ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Month-by-month mini bars */}
      <div className='px-5 pb-4'>
        <p className='text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2'>Monthly Trend</p>
        <div className='flex items-end gap-1.5'>
          {result.months.slice(-6).map((m, i) => {
            const maxInc = Math.max(...result.months.map(x => x.income), 1);
            const maxExp = Math.max(...result.months.map(x => x.expense), 1);
            const incH = Math.max(4, (m.income / maxInc) * 60);
            const expH = Math.max(4, (m.expense / maxExp) * 60);
            return (
              <div key={i} className='flex-1 flex flex-col items-center gap-0.5'>
                <div className='flex items-end gap-0.5 w-full justify-center'>
                  <div className='w-2 rounded-t-sm bg-emerald-400 dark:bg-emerald-500' style={{ height: `${incH}px` }} title={`Income: ${formatINR(m.income)}`} />
                  <div className='w-2 rounded-t-sm bg-rose-400 dark:bg-rose-500' style={{ height: `${expH}px` }} title={`Expense: ${formatINR(m.expense)}`} />
                </div>
                <span className='text-[8px] text-slate-400'>{m.month.slice(5)}</span>
              </div>
            );
          })}
        </div>
        <div className='flex items-center gap-3 mt-2'>
          <span className='flex items-center gap-1 text-[10px] text-slate-400'><span className='h-2 w-2 rounded-sm bg-emerald-400 inline-block'/>Income</span>
          <span className='flex items-center gap-1 text-[10px] text-slate-400'><span className='h-2 w-2 rounded-sm bg-rose-400 inline-block'/>Expense</span>
        </div>
      </div>
    </div>
  );
}
