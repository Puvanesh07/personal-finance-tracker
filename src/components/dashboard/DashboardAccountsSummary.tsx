// src/components/dashboard/DashboardAccountsSummary.tsx
//
// FIX: Dashboard now shows LIVE balance (opening balance ± cashflow entries)
//      instead of the raw stored balance. This matches what AccountsPage shows.

import { FiArrowUpRight, FiCreditCard } from 'react-icons/fi';

import { formatCurrency } from '../../utils/format';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortfolioStore } from '../../store/portfolioStore';

export function DashboardAccountsSummary() {
  const accounts = usePortfolioStore((s) => s.accounts);
  const cashflows = usePortfolioStore((s) => s.cashflows);
  const navigate = useNavigate();

  // ✅ FIX: Compute live balance = opening balance ± cashflows (matching AccountsPage logic)
  const accountStats = useMemo(() => {
    const stats: Record<string, { liveBalance: number }> = {};

    for (const acc of accounts) {
      stats[acc.id] = {
        liveBalance: acc.openingBalance ?? acc.balance,
      };
    }

    for (const cf of cashflows) {
      if (!cf.accountId) continue;
      const acc = accounts.find((a) => a.id === cf.accountId);
      if (!acc || !stats[acc.id]) continue;

      // Only count cashflows on or after the account's opening balance date
      const cutoff = acc.openingBalanceDate ?? '1900-01-01';
      if (cf.date < cutoff) continue;

      if (cf.type === 'income') {
        stats[acc.id].liveBalance += cf.amount;
      } else {
        stats[acc.id].liveBalance -= cf.amount;
      }
    }

    return stats;
  }, [accounts, cashflows]);

  const totalBalance = useMemo(
    () =>
      accounts.reduce(
        (sum, a) => sum + (accountStats[a.id]?.liveBalance ?? a.balance),
        0,
      ),
    [accounts, accountStats],
  );

  return (
    <div className='rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm flex flex-col h-full'>
      <div className='mb-4 flex items-center justify-between'>
        <h2 className='flex items-center gap-2 text-lg font-bold text-slate-100'>
          <FiCreditCard className='text-blue-400' />
          Liquid Accounts
        </h2>
        {/* ✅ FIX: Redirect icon to navigate to Accounts page */}
        <button
          onClick={() => navigate('/accounts')}
          title='Go to Accounts'
          className='flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-blue-400 transition-colors'
        >
          <FiArrowUpRight className='h-4 w-4' />
        </button>
      </div>

      <div className='mb-4'>
        <p className='text-xs font-medium text-slate-400 uppercase tracking-wider'>
          Total Live Balance
        </p>
        <p className='text-2xl font-bold text-blue-400'>
          {formatCurrency(totalBalance)}
        </p>
      </div>

      <div className='flex-1 space-y-3 mt-2 overflow-y-auto custom-scrollbar max-h-32'>
        {accounts.length === 0 ? (
          <p className='text-sm text-slate-500'>No accounts added.</p>
        ) : (
          accounts.map((acc) => {
            const liveBalance =
              accountStats[acc.id]?.liveBalance ?? acc.balance;
            return (
              <div
                key={acc.id}
                className='flex justify-between items-center border-t border-slate-800/60 pt-2'
              >
                <div>
                  <p className='text-sm font-medium text-slate-200'>
                    {acc.name}
                  </p>
                  <p className='text-[10px] text-slate-500 uppercase'>
                    {acc.type}
                  </p>
                </div>
                <p className='text-sm font-semibold text-slate-300'>
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
