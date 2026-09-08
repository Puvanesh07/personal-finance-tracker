// src/components/dashboard/DashboardReceivablesSummary.tsx
import { FiArrowUpRight, FiDollarSign, FiPercent, FiTrendingUp } from 'react-icons/fi';
import { differenceInDays, parseISO } from 'date-fns';
import { useMemo } from 'react';

import type { PendingPayment } from '../../types/investmentTypes';
import { formatINR } from '../../utils/format';
import { getReceivablesTotals } from '../../utils/calculations';
import { useNavigate } from 'react-router-dom';
import { usePortfolioStore } from '../../store/portfolioStore';

export function DashboardReceivablesSummary() {
  const pendingPayments = usePortfolioStore((s) => s.pendingPayments) ?? [];
  const navigate = useNavigate();

  const active: PendingPayment[] = useMemo(
    () => pendingPayments.filter((p) => p.status !== 'received'),
    [pendingPayments],
  );

  const totals = useMemo(() => getReceivablesTotals(pendingPayments), [pendingPayments]);

  const { loansCount, overdueCount, dueSoonCount, avgDaysToMaturity } = useMemo(() => {
    let loans = 0;
    let overdue = 0;
    let soon = 0;
    let daysSum = 0;
    for (const p of active) {
      if (p.isLoan) loans++;
      const d = differenceInDays(parseISO(p.expectedPaymentDate), new Date());
      daysSum += d;
      if (d < 0) overdue++;
      else if (d <= 7) soon++;
    }
    return {
      loansCount: loans,
      overdueCount: overdue,
      dueSoonCount: soon,
      avgDaysToMaturity: active.length ? Math.round(daysSum / active.length) : 0,
    };
  }, [active, totals]);

  const topItems = useMemo(
    () => [...active].sort((a, b) => b.amount - a.amount).slice(0, 2),
    [active],
  );

  return (
    <div className='rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-6 shadow-sm flex flex-col h-full'>
      <div className='mb-4 flex items-center justify-between'>
        <h2 className='flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100'>
          <FiTrendingUp className='text-indigo-500' />
          Money Owed To Me
        </h2>
        <button
          onClick={() => navigate('/liabilities?section=pending_payments')}
          title='Go to Money Owed To Me'
          className='flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-indigo-500 transition-colors'
        >
          <FiArrowUpRight className='h-4 w-4' />
        </button>
      </div>

      {active.length === 0 ? (
        <div className='flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 py-8 text-center'>
          <FiDollarSign className='h-6 w-6 text-slate-300 dark:text-slate-600' />
          <p className='text-xs text-slate-400 dark:text-slate-500'>
            {pendingPayments.length > 0 ? 'All receivables collected!' : 'No money owed recorded'}
          </p>
        </div>
      ) : (
        <>
          <div className='mb-4'>
            <p className='text-xs font-medium text-slate-500 uppercase tracking-wider'>
              Receivable Total
            </p>
            <p className='text-2xl font-bold text-indigo-600 dark:text-indigo-400 tabular-nums'>
              {formatINR(totals.total)}
            </p>
            {totals.interest > 0 && (
              <div className='mt-2 flex items-center gap-3 text-[11px]'>
                <span className='inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 font-bold text-slate-700 dark:text-slate-200'>
                  <FiDollarSign className='h-3 w-3' /> Prin. {formatINR(totals.principal)}
                </span>
                <span className='inline-flex items-center gap-1 rounded-md bg-rose-500/10 dark:bg-rose-500/10 px-2 py-0.5 font-bold text-rose-600 dark:text-rose-400 border border-rose-500/20'>
                  <FiPercent className='h-3 w-3' /> +Int. {formatINR(totals.interest)}
                </span>
              </div>
            )}
          </div>

          {topItems.length > 0 && (
            <div className='mb-4 flex flex-col gap-2 border-t border-slate-200/70 dark:border-slate-800/60 pt-4'>
              {topItems.map((p) => (
                <div
                  key={p.id}
                  className='flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-white dark:hover:bg-slate-800/50 transition-colors'
                >
                  <div className='min-w-0'>
                    <p className='truncate text-xs font-bold text-slate-800 dark:text-slate-100'>{p.buyerName}</p>
                    <p className='truncate text-[10px] text-slate-500 dark:text-slate-400'>
                      {p.isLoan ? `Loan @ ${p.interestRate}%` : p.itemDescription}
                    </p>
                  </div>
                  <p className='shrink-0 text-xs font-black text-indigo-600 dark:text-indigo-400 tabular-nums'>
                    {formatINR(
                      p.isLoan && p.principal
                        ? p.principal + (p.interestAccruedToDate ?? 0)
                        : p.amount,
                    )}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className='mt-auto grid grid-cols-2 gap-3 border-t border-slate-200/70 dark:border-slate-800/60 pt-4'>
            <div>
              <p className='text-xs font-medium text-slate-500 mb-1'>Open Items</p>
              <p className='text-sm font-bold text-slate-700 dark:text-slate-200'>
                {active.length}
                {loansCount > 0 && (
                  <span className='ml-1 text-[10px] font-black text-indigo-600 dark:text-indigo-400'>
                    ({loansCount} loans)
                  </span>
                )}
              </p>
            </div>
            <div>
              <p className='text-xs font-medium text-slate-500 mb-1'>Avg Days Due</p>
              <p className='text-sm font-bold text-slate-700 dark:text-slate-200'>
                {avgDaysToMaturity > 0 ? `${avgDaysToMaturity}d` : avgDaysToMaturity < 0 ? `${-avgDaysToMaturity}d overdue` : '—'}
              </p>
            </div>
            {(dueSoonCount > 0 || overdueCount > 0) && (
              <div className='col-span-2'>
                {overdueCount > 0 ? (
                  <p className='text-xs font-medium text-rose-500 mb-1'>
                    ⚠ {overdueCount} overdue
                    {dueSoonCount > 0 && <span className='text-slate-500'> · {dueSoonCount} due in 7d</span>}
                  </p>
                ) : (
                  <p className='text-xs font-medium text-amber-600 dark:text-amber-400 mb-1'>
                    {dueSoonCount} due within 7 days
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
