// src/components/dashboard/DashboardReceivablesSummary.tsx
import { FiDollarSign, FiPercent, FiTrendingUp } from 'react-icons/fi';
import { differenceInDays, parseISO } from 'date-fns';
import { useMemo } from 'react';

import type { PendingPayment } from '../../types/investmentTypes';
import { formatINR } from '../../utils/format';
import { getReceivablesTotals } from '../../utils/calculations';
import { usePortfolioStore } from '../../store/portfolioStore';
import { ACCENT, CardGo, DashboardCard } from './DashboardCard';

export function DashboardReceivablesSummary() {
  const pendingPayments = usePortfolioStore((s) => s.pendingPayments) ?? [];

  const active: PendingPayment[] = useMemo(
    () => pendingPayments.filter((p) => p.status !== 'received'),
    [pendingPayments],
  );

  const totals = useMemo(() => getReceivablesTotals(pendingPayments), [pendingPayments]);

  const { loansCount, overdueCount, dueSoonCount } = useMemo(() => {
    let loans = 0;
    let overdue = 0;
    let soon = 0;
    for (const p of active) {
      if (p.isLoan) loans++;
      const d = differenceInDays(parseISO(p.expectedPaymentDate), new Date());
      if (d < 0) overdue++;
      else if (d <= 7) soon++;
    }
    return { loansCount: loans, overdueCount: overdue, dueSoonCount: soon };
  }, [active]);

  const topItems = useMemo(
    () => [...active].sort((a, b) => b.amount - a.amount).slice(0, 3),
    [active],
  );

  return (
    <DashboardCard
      icon={<FiTrendingUp className='h-5 w-5' />}
      accent={ACCENT.indigo}
      title='Money Owed To Me'
      subtitle='Receivables & loans given'
      action={<CardGo to='/wealth?tab=liabilities&section=pending_payments' />}
    >
      {active.length === 0 ? (
        <div className='flex h-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 py-8 text-center dark:border-slate-700'>
          <FiDollarSign className='h-6 w-6 text-slate-300 dark:text-slate-600' />
          <p className='text-sm text-slate-500 dark:text-slate-400'>
            {pendingPayments.length > 0 ? 'All receivables collected!' : 'No money owed recorded'}
          </p>
        </div>
      ) : (
        <>
          <div className='mb-5'>
            <p className='text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500'>
              Receivable Total
            </p>
            <p className='mt-1 text-3xl font-black tracking-tight text-indigo-600 tabular-nums dark:text-indigo-400'>
              {formatINR(totals.total)}
            </p>
            {totals.interest > 0 && (
              <div className='mt-2 flex items-center gap-2 text-[11px] font-semibold'>
                <span className='rounded-lg bg-slate-500/10 px-2 py-0.5 text-slate-600 dark:text-slate-300'>
                  Prin. {formatINR(totals.principal)}
                </span>
                <span className='rounded-lg bg-rose-500/10 px-2 py-0.5 text-rose-600 dark:text-rose-400'>
                  +Int. {formatINR(totals.interest)}
                </span>
              </div>
            )}
          </div>

          <div className='flex flex-col gap-1.5'>
            {topItems.map((p) => (
              <div
                key={p.id}
                className='flex items-center justify-between gap-2 rounded-2xl bg-slate-50/80 px-3.5 py-2.5 dark:bg-slate-800/40'
              >
                <div className='min-w-0'>
                  <p className='truncate text-sm font-bold text-slate-800 dark:text-slate-100'>{p.buyerName}</p>
                  <p className='truncate text-[10px] font-medium text-slate-400 dark:text-slate-500'>
                    {p.isLoan ? `Loan @ ${p.interestRate}%` : p.itemDescription}
                  </p>
                </div>
                <p className='shrink-0 text-sm font-black tabular-nums text-indigo-600 dark:text-indigo-400'>
                  {formatINR(p.isLoan && p.principal ? p.principal + (p.interestAccruedToDate ?? 0) : p.amount)}
                </p>
              </div>
            ))}
          </div>

          <div className='mt-4 flex flex-wrap items-center gap-2 border-t border-slate-200/60 pt-3 text-[11px] font-semibold dark:border-slate-800/60'>
            <span className='inline-flex items-center gap-1 text-slate-500 dark:text-slate-400'>
              <FiDollarSign className='h-3.5 w-3.5' /> {active.length} open
              {loansCount > 0 && <span className='text-indigo-500'> · {loansCount} loans</span>}
            </span>
            {overdueCount > 0 && (
              <span className='inline-flex items-center gap-1 text-rose-500'>
                <FiPercent className='h-3.5 w-3.5' /> {overdueCount} overdue
              </span>
            )}
            {dueSoonCount > 0 && (
              <span className='inline-flex items-center gap-1 text-amber-600 dark:text-amber-400'>
                {dueSoonCount} due in 7d
              </span>
            )}
          </div>
        </>
      )}
    </DashboardCard>
  );
}
