// src/components/dashboard/DashboardAccountsSummary.tsx
//
// Live account balances (opening ± linked cashflows) — same source-of-truth
// helper as AccountsPage and Net Worth. Rebuilt on the shared card shell; the
// list now fills the card naturally instead of scrolling in a fixed box.

import { FiCreditCard } from 'react-icons/fi';
import { useMemo } from 'react';

import { calcLiveAccountBalances } from '../../utils/calculations';
import { formatCurrency } from '../../utils/format';
import { usePortfolioStore } from '../../store/portfolioStore';
import { ACCENT, CardGo, DashboardCard } from './DashboardCard';

export function DashboardAccountsSummary() {
  const accounts = usePortfolioStore((s) => s.accounts);
  const cashflows = usePortfolioStore((s) => s.cashflows);

  const liveBalances = useMemo(
    () => calcLiveAccountBalances(accounts, cashflows),
    [accounts, cashflows],
  );

  const totalBalance = useMemo(
    () => accounts.reduce((sum, a) => sum + (liveBalances[a.id] ?? a.balance ?? 0), 0),
    [accounts, liveBalances],
  );

  return (
    <DashboardCard
      icon={<FiCreditCard className='h-5 w-5' />}
      accent={ACCENT.blue}
      title='Cash & Accounts'
      subtitle='Live available balance'
      action={<CardGo to='/cashflow?tab=accounts' />}
    >
      <div className='mb-3'>
        <p className='text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500'>
          Total Live Balance
        </p>
        <p className='mt-0.5 text-xl font-black tracking-tight text-blue-600 tabular-nums dark:text-blue-400'>
          {formatCurrency(totalBalance)}
        </p>
      </div>

      {accounts.length === 0 ? (
        <div className='flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-200 py-5 text-center dark:border-slate-700'>
          <FiCreditCard className='h-5 w-5 text-slate-300 dark:text-slate-600' />
          <p className='text-xs text-slate-500 dark:text-slate-400'>No accounts added yet.</p>
        </div>
      ) : (
        <div className='flex flex-col gap-1'>
          {accounts.map((acc) => {
            const liveBalance = liveBalances[acc.id] ?? acc.balance ?? 0;
            return (
              <div
                key={acc.id}
                className='flex items-center justify-between gap-3 rounded-xl bg-slate-50/80 px-3 py-2 transition-colors hover:bg-slate-100/80 dark:bg-slate-800/40 dark:hover:bg-slate-800/70'
              >
                <div className='min-w-0'>
                  <p className='truncate text-[13px] font-bold text-slate-800 dark:text-slate-100'>
                    {acc.name}
                  </p>
                  <p className='text-[9px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500'>
                    {acc.type}
                  </p>
                </div>
                <p className='shrink-0 text-[13px] font-black tabular-nums text-slate-700 dark:text-slate-200'>
                  {formatCurrency(liveBalance)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </DashboardCard>
  );
}
