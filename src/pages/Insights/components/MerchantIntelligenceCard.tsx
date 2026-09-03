import { useMemo, useState } from 'react';
import { FiTrendingUp, FiTrendingDown, FiMinus } from 'react-icons/fi';
import { usePortfolioStore } from '../../../store/portfolioStore';
import { computeMerchantIntelligence } from '../../../utils/merchantIntelligence';
import { formatINR, formatNumber } from '../../../utils/format';

export function MerchantIntelligenceCard() {
  const cashflows  = usePortfolioStore(s => s.cashflows);
  const [showAll, setShowAll] = useState(false);
  const intel = useMemo(() => computeMerchantIntelligence(cashflows), [cashflows]);

  const displayed = showAll ? intel.stats : intel.stats.slice(0, 6);

  if (intel.stats.length === 0) {
    return (
      <div className='rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-5'>
        <h3 className='text-sm font-bold text-slate-800 dark:text-slate-100 mb-1'>🏪 Merchant Intelligence</h3>
        <p className='text-xs text-slate-400'>Add cashflow expenses to see spending by category.</p>
      </div>
    );
  }

  return (
    <div className='rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 overflow-hidden'>
      <div className='px-5 py-4 border-b border-slate-100 dark:border-slate-800'>
        <h3 className='text-sm font-bold text-slate-800 dark:text-slate-100'>🏪 Merchant Intelligence</h3>
        <div className='flex gap-4 mt-2 text-[11px] text-slate-500 dark:text-slate-400'>
          <span>Annual projected: <strong className='text-slate-800 dark:text-slate-200'>{formatINR(intel.totalAnnualProjected)}</strong></span>
          {intel.subscriptionCount > 0 && (
            <span>Recurring: <strong className='text-violet-600 dark:text-violet-400'>{intel.subscriptionCount} categories · {formatINR(intel.subscriptionTotal)}/mo</strong></span>
          )}
        </div>
      </div>

      <div className='divide-y divide-slate-50 dark:divide-slate-800/60'>
        {displayed.map((s, i) => (
          <div key={i} className='flex items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors'>
            <span className='text-lg shrink-0'>{s.emoji}</span>
            <div className='flex-1 min-w-0'>
              <div className='flex items-center gap-2'>
                <p className='text-sm font-semibold text-slate-800 dark:text-slate-200 truncate'>{s.category}</p>
                {s.isRecurring && (
                  <span className='text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400'>recurring</span>
                )}
              </div>
              <div className='flex items-center gap-3 mt-0.5'>
                <span className='text-[10px] text-slate-400'>{s.occurrences} entries · {s.months.length} months</span>
                <span className={`flex items-center gap-0.5 text-[10px] font-semibold ${
                  s.trend === 'up' ? 'text-rose-500' : s.trend === 'down' ? 'text-emerald-500' : 'text-slate-400'
                }`}>
                  {s.trend === 'up' ? <FiTrendingUp className='h-3 w-3'/> : s.trend === 'down' ? <FiTrendingDown className='h-3 w-3'/> : <FiMinus className='h-3 w-3'/>}
                  {Math.abs(s.trendPct) > 1 ? `${formatNumber(Math.abs(s.trendPct), 0)}%` : 'stable'}
                </span>
              </div>
            </div>
            <div className='text-right shrink-0'>
              <p className='text-sm font-bold text-slate-800 dark:text-slate-200 tabular-nums'>{formatINR(s.monthlyAvg)}<span className='text-[10px] font-normal text-slate-400'>/mo</span></p>
              <p className='text-[10px] text-slate-400'>{formatINR(s.annualProjected)}/yr</p>
            </div>
          </div>
        ))}
      </div>

      {intel.stats.length > 6 && (
        <div className='px-5 py-3 border-t border-slate-100 dark:border-slate-800 text-center'>
          <button type='button' onClick={() => setShowAll(p => !p)}
            className='text-xs font-bold text-violet-600 dark:text-violet-400 hover:underline'>
            {showAll ? 'Show less' : `Show all ${intel.stats.length} categories`}
          </button>
        </div>
      )}
    </div>
  );
}
