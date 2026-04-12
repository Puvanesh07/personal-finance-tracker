// src/components/dashboard/DashboardCashflowSummary.tsx
//
// FIX: Added redirect icon so clicking navigates to the Cashflow page

import { FiActivity, FiArrowDownRight, FiArrowUpRight } from 'react-icons/fi';
import { isSameMonth, parseISO } from 'date-fns';

import { formatCurrency } from '../../utils/format';
import { useNavigate } from 'react-router-dom';
import { usePortfolioStore } from '../../store/portfolioStore';

export function DashboardCashflowSummary() {
  const cashflows = usePortfolioStore((s) => s.cashflows);
  const navigate = useNavigate();

  // Calculate current month's cashflow
  const now = new Date();
  const thisMonthCashflows = cashflows.filter((cf) => {
    try {
      return isSameMonth(parseISO(cf.date), now);
    } catch {
      return false;
    }
  });

  const income = thisMonthCashflows
    .filter((c) => c.type === 'income')
    .reduce((sum, c) => sum + c.amount, 0);

  const expense = thisMonthCashflows
    .filter((c) => c.type === 'expense')
    .reduce((sum, c) => sum + c.amount, 0);

  const savings = income - expense;

  return (
    <div className='rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-6 shadow-sm flex flex-col h-full'>
      <div className='mb-4 flex items-center justify-between'>
        <h2 className='flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-100'>
          <FiActivity className='text-purple-400' />
          This Month's Cashflow
        </h2>
        {/* ✅ FIX: Redirect icon to navigate to Cashflow page */}
        <button
          onClick={() => navigate('/cashflow')}
          title='Go to Cashflow'
          className='flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:bg-slate-800 hover:text-purple-400 transition-colors'
        >
          <FiArrowUpRight className='h-4 w-4' />
        </button>
      </div>

      <div className='mb-5'>
        <p className='text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider'>
          Net Savings
        </p>
        <p
          className={`text-2xl font-bold ${savings >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
        >
          {savings >= 0 ? '+' : ''}
          {formatCurrency(savings)}
        </p>
      </div>

      <div className='mt-auto grid grid-cols-2 gap-4 border-t border-slate-200/70 dark:border-slate-800/60 pt-4'>
        <div>
          <p className='flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 mb-1'>
            <FiArrowUpRight className='text-emerald-500' /> Income
          </p>
          <p className='text-sm font-semibold text-slate-900 dark:text-slate-800 dark:text-slate-200'>
            {formatCurrency(income)}
          </p>
        </div>
        <div>
          <p className='flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 mb-1'>
            <FiArrowDownRight className='text-rose-500' /> Expense
          </p>
          <p className='text-sm font-semibold text-slate-900 dark:text-slate-800 dark:text-slate-200'>
            {formatCurrency(expense)}
          </p>
        </div>
      </div>
    </div>
  );
}
