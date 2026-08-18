import { FiArrowUpRight, FiBell } from 'react-icons/fi';

import { computePaymentStats } from '../../utils/paymentTracker';
import { formatINR } from '../../utils/format';
import { useNavigate } from 'react-router-dom';
import { usePortfolioStore } from '../../store/portfolioStore';

export function DashboardPaymentsSummary() {
  const trackedPayments = usePortfolioStore((s) => s.trackedPayments);
  const navigate = useNavigate();
  const stats = computePaymentStats(trackedPayments);

  return (
    <div className='rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-6 shadow-sm flex flex-col h-full'>
      <div className='mb-4 flex items-center justify-between'>
        <h2 className='flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-100'>
          <FiBell className='text-sky-400' />
          Payment Reminders
        </h2>
        <button
          onClick={() => navigate('/payments')}
          title='Go to Payment Tracker'
          className='flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-sky-400 transition-colors'
        >
          <FiArrowUpRight className='h-4 w-4' />
        </button>
      </div>

      <div className='mb-4'>
        <p className='text-xs font-medium text-slate-500 uppercase tracking-wider'>
          Due This Month
        </p>
        <p className='text-2xl font-bold text-sky-400 tabular-nums'>
          {formatINR(stats.dueThisMonthTotal)}
        </p>
      </div>

      <div className='mt-auto grid grid-cols-2 gap-4 border-t border-slate-200/70 dark:border-slate-800/60 pt-4'>
        <div>
          <p className='text-xs font-medium text-slate-500 mb-1'>Upcoming</p>
          <p className='text-sm font-semibold text-amber-400'>
            {stats.upcoming.length}
          </p>
        </div>
        <div>
          <p className='text-xs font-medium text-slate-500 mb-1'>Overdue</p>
          <p
            className={`text-sm font-semibold ${stats.overdue.length > 0 ? 'text-rose-400' : 'text-emerald-400'}`}
          >
            {stats.overdue.length > 0
              ? `${stats.overdue.length} (${formatINR(stats.overdueTotal)})`
              : 'None'}
          </p>
        </div>
      </div>
    </div>
  );
}
