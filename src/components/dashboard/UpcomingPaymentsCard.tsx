// src/components/dashboard/UpcomingPaymentsCard.tsx
//
// Actionable upcoming / overdue bills on the shared card shell. Reuses
// computePaymentStats (the same source of truth as the Payments module) — no
// duplicated bill math. Full management stays in the Payments module.

import { useMemo } from 'react';
import { FiCalendar, FiCheck } from 'react-icons/fi';

import { computePaymentStats } from '../../utils/paymentTracker';
import { formatINR } from '../../utils/format';
import { usePortfolioStore } from '../../store/portfolioStore';
import { ACCENT, CardGo, DashboardCard } from './DashboardCard';

function dueLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days}d`;
}

function computeDays(dateStr: string): number {
  if (!dateStr) return 999;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

export function UpcomingPaymentsCard() {
  const trackedPayments = usePortfolioStore((s) => s.trackedPayments);

  const { overdue, upcoming, dueThisMonthTotal, dueThisMonthCount } = useMemo(
    () => computePaymentStats(trackedPayments),
    [trackedPayments],
  );

  const rows = useMemo(() => {
    const list = [
      ...overdue.map((p) => ({ p, kind: 'overdue' as const })),
      ...upcoming.map((p) => ({ p, kind: 'upcoming' as const })),
    ];
    return list.slice(0, 6);
  }, [overdue, upcoming]);

  return (
    <DashboardCard
      icon={<FiCalendar className='h-5 w-5' />}
      accent={ACCENT.rose}
      title='Upcoming Payments'
      subtitle='Bills due in the next 14 days'
      action={<CardGo to='/payments' />}
    >
      <div className='mb-4 rounded-2xl bg-slate-50/80 px-4 py-3 dark:bg-slate-800/40'>
        <p className='text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500'>
          Due this month
        </p>
        <p className='mt-1 text-2xl font-black tracking-tight text-slate-800 tabular-nums dark:text-slate-100'>
          {formatINR(dueThisMonthTotal)}
        </p>
        <p className='text-[11px] font-medium text-slate-400 dark:text-slate-500'>
          {dueThisMonthCount} bill{dueThisMonthCount !== 1 ? 's' : ''}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className='flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 py-8 text-center dark:border-slate-700'>
          <FiCheck className='h-6 w-6 text-emerald-500' />
          <p className='text-sm font-medium text-slate-500 dark:text-slate-400'>
            No bills due in the next 14 days.
          </p>
        </div>
      ) : (
        <div className='flex flex-col gap-1.5'>
          {rows.map(({ p, kind }) => {
            const days = computeDays(p.dueDate);
            return (
              <div
                key={p.id}
                className='flex items-center justify-between gap-3 rounded-2xl bg-slate-50/80 px-3.5 py-2.5 dark:bg-slate-800/40'
              >
                <div className='min-w-0'>
                  <p className='truncate text-sm font-bold text-slate-800 dark:text-slate-100'>
                    {p.title}
                  </p>
                  <p
                    className={`mt-0.5 text-[11px] font-bold ${
                      kind === 'overdue'
                        ? 'text-rose-600 dark:text-rose-400'
                        : days <= 3
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {dueLabel(days)} · {p.dueDate}
                  </p>
                </div>
                <p className='shrink-0 text-sm font-black tabular-nums text-slate-800 dark:text-slate-100'>
                  {formatINR(p.amount)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </DashboardCard>
  );
}
