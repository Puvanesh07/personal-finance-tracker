// src/components/dashboard/DashboardAccountsSummary.tsx
//
// FIX: Dashboard now shows LIVE balance (opening balance ± cashflow entries)
//      instead of the raw stored balance. This matches what AccountsPage shows.

import { FiArrowUpRight, FiCreditCard } from 'react-icons/fi';

import { calcLiveAccountBalances } from '../../utils/calculations';
import { formatCurrency } from '../../utils/format';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortfolioStore } from '../../store/portfolioStore';

export function DashboardAccountsSummary() {
  const accounts = usePortfolioStore((s) => s.accounts);
  const cashflows = usePortfolioStore((s) => s.cashflows);
  const navigate = useNavigate();

  // ✅ Live balance = opening balance ± cashflows — shared helper, same rule
  //    as AccountsPage and the Net Worth calculation (single source of truth).
  const liveBalances = useMemo(
    () => calcLiveAccountBalances(accounts, cashflows),
    [accounts, cashflows],
  );

  const totalBalance = useMemo(
    () =>
      accounts.reduce(
        (sum, a) => sum + (liveBalances[a.id] ?? a.balance ?? 0),
        0,
      ),
    [accounts, liveBalances],
  );

  return (
    <div className='rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-6 shadow-sm flex flex-col h-full'>
      <div className='mb-4 flex items-center justify-between'>
        <h2 className='flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-100'>
          <FiCreditCard className='text-blue-400' />
          Liquid Accounts
        </h2>
        {/* ✅ FIX: Redirect icon to navigate to Accounts page */}
        <button
          onClick={() => navigate('/cashflow?tab=accounts')}
          title='Go to Accounts'
          className='flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:bg-slate-800 hover:text-blue-400 transition-colors'
        >
          <FiArrowUpRight className='h-4 w-4' />
        </button>
      </div>

      <div className='mb-4'>
        <p className='text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider'>
          Total Live Balance
        </p>
        <p className='text-2xl font-bold text-blue-600 dark:text-blue-400'>
          {formatCurrency(totalBalance)}
        </p>
      </div>

      <div className='flex-1 space-y-3 mt-2 overflow-y-auto custom-scrollbar max-h-32'>
        {accounts.length === 0 ? (
          <p className='text-sm text-slate-500 dark:text-slate-400'>No accounts added.</p>
        ) : (
          accounts.map((acc) => {
            const liveBalance = liveBalances[acc.id] ?? acc.balance ?? 0;
            return (
              <div
                key={acc.id}
                className='flex justify-between items-center border-t border-slate-200/70 dark:border-slate-800/60 pt-2'
              >
                <div>
                  <p className='text-sm font-medium text-slate-900 dark:text-slate-100'>
                    {acc.name}
                  </p>
                  <p className='text-[10px] text-slate-500 dark:text-slate-400 uppercase'>
                    {acc.type}
                  </p>
                </div>
                <p className='text-sm font-semibold text-slate-700 dark:text-slate-200'>
                  {formatCurrency(liveBalance)}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
