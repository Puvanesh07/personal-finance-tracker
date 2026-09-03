/**
 * src/components/dashboard/CashflowForecastCard.tsx
 *
 * Cashflow Forecast Card — shows available cash after obligations
 * and upcoming in/out for 7/30/90 days.
 * Used on Dashboard and /forecast page.
 */

import { useMemo, useState } from 'react';
import { FiArrowDown, FiArrowUp, FiTrendingUp, FiAlertTriangle, FiChevronRight } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { usePortfolioStore } from '../../store/portfolioStore';
import { computeForecast } from '../../utils/cashflowForecast';
import { formatINR } from '../../utils/format';

type Period = 7 | 30 | 90;

export function CashflowForecastCard({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate();
  const { accounts, trackedPayments, liabilities, cashflows, sipPlans } = usePortfolioStore();
  const [period, setPeriod] = useState<Period>(30);

  const forecast = useMemo(
    () => computeForecast(accounts, trackedPayments, liabilities, cashflows, sipPlans),
    [accounts, trackedPayments, liabilities, cashflows, sipPlans],
  );

  const fp = period === 7 ? forecast.forecast7 : period === 30 ? forecast.forecast30 : forecast.forecast90;

  const balanceColor =
    forecast.availableAfterObligations > 50_000 ? 'text-emerald-600 dark:text-emerald-400'
    : forecast.availableAfterObligations > 10_000 ? 'text-amber-600 dark:text-amber-400'
    : 'text-rose-600 dark:text-rose-400';

  const projColor =
    fp.projectedBalance > forecast.currentCash ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';

  return (
    <div className='rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 overflow-hidden'>
      {/* Header */}
      <div className='flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800'>
        <div className='flex items-center gap-2'>
          <FiTrendingUp className='h-4 w-4 text-emerald-500' />
          <span className='text-sm font-bold text-slate-900 dark:text-slate-100'>Cash Forecast</span>
        </div>
        {!compact && (
          <button
            type='button'
            onClick={() => navigate('/forecast')}
            className='flex items-center gap-0.5 text-[10px] font-bold text-violet-600 dark:text-violet-400 hover:underline'
          >
            Full view <FiChevronRight className='h-3 w-3' />
          </button>
        )}
      </div>

      {/* Available cash */}
      <div className='px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20'>
        <p className='text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1'>
          Available After Obligations (30d)
        </p>
        <p className={`text-2xl font-black tabular-nums ${balanceColor}`}>
          {formatINR(forecast.availableAfterObligations)}
        </p>
        <p className='text-[11px] text-slate-400 dark:text-slate-500 mt-0.5'>
          Bank balance {formatINR(forecast.currentCash)} − upcoming bills {formatINR(forecast.forecast30.totalOut)}
        </p>
      </div>

      {/* Period toggle */}
      <div className='flex gap-1 p-2 bg-slate-50 dark:bg-slate-800/30'>
        {([7, 30, 90] as Period[]).map((p) => (
          <button
            key={p}
            type='button'
            onClick={() => setPeriod(p)}
            className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all ${
              period === p
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            {p}d
          </button>
        ))}
      </div>

      {/* In / Out / Net */}
      <div className='grid grid-cols-3 gap-px bg-slate-100 dark:bg-slate-800'>
        {[
          { label: 'In',  value: fp.totalIn,  icon: FiArrowUp,   color: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Out', value: fp.totalOut, icon: FiArrowDown, color: 'text-rose-600 dark:text-rose-400' },
          { label: 'Net', value: fp.netFlow,  icon: FiTrendingUp, color: fp.netFlow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className='bg-white dark:bg-slate-900/60 px-3 py-2.5 text-center'>
            <div className='flex items-center justify-center gap-1 mb-0.5'>
              <Icon className={`h-3 w-3 ${color}`} />
              <p className='text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500'>{label}</p>
            </div>
            <p className={`text-sm font-black tabular-nums ${color}`}>
              {value >= 0 ? '' : '-'}{formatINR(Math.abs(value))}
            </p>
          </div>
        ))}
      </div>

      {/* Projected balance */}
      <div className='px-4 py-2.5 flex items-center justify-between border-t border-slate-100 dark:border-slate-800'>
        <span className='text-xs text-slate-500 dark:text-slate-400'>Projected in {period}d</span>
        <span className={`text-sm font-black tabular-nums ${projColor}`}>
          {formatINR(fp.projectedBalance)}
        </span>
      </div>

      {/* Low balance warning */}
      {fp.lowBalanceDate && (
        <div className='mx-3 mb-3 flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 px-3 py-2'>
          <FiAlertTriangle className='h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5' />
          <p className='text-[11px] text-amber-700 dark:text-amber-400'>
            Balance may drop to {formatINR(fp.lowBalanceAmount ?? 0)} around {fp.lowBalanceDate}
          </p>
        </div>
      )}

      {/* Upcoming events (compact: top 3) */}
      {!compact && fp.events.length > 0 && (
        <div className='border-t border-slate-100 dark:border-slate-800'>
          <p className='text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-4 pt-3 pb-1'>
            Upcoming ({fp.events.length})
          </p>
          <div className='divide-y divide-slate-50 dark:divide-slate-800/60 max-h-48 overflow-y-auto'>
            {fp.events.slice(0, 8).map((ev, i) => (
              <div key={i} className='flex items-center justify-between px-4 py-2'>
                <div className='flex items-center gap-2 min-w-0'>
                  <span className='text-sm shrink-0'>{ev.direction === 'in' ? '💰' : ev.category === 'emi' ? '🏦' : ev.category === 'sip' ? '📈' : '💳'}</span>
                  <div className='min-w-0'>
                    <p className='text-xs font-medium text-slate-700 dark:text-slate-300 truncate'>{ev.label}</p>
                    <p className='text-[9px] text-slate-400 dark:text-slate-500'>{ev.date}</p>
                  </div>
                </div>
                <span className={`text-xs font-bold tabular-nums shrink-0 ${ev.direction === 'in' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {ev.direction === 'in' ? '+' : '-'}{formatINR(ev.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
