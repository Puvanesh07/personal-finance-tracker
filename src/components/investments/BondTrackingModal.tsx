// src/components/investments/BondTrackingModal.tsx

import {
  FiAlertCircle,
  FiBriefcase,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiTrendingUp,
} from 'react-icons/fi';
import { useMemo } from 'react';

import type { BondInvestment } from '../../types/investmentTypes';
import { Modal } from '../ui/Modal';
import {
  PAYOUT_FREQUENCY_LABELS,
  summarizeBond,
  type BondPaymentStatus,
} from '../../utils/bondSchedule';
import { formatBusinessDateLabel } from '../../services/dateService';
import { formatCurrency } from '../../utils/format';
import { usePortfolioStore } from '../../store/portfolioStore';

// ── Small stat tile ────────────────────────────────────────────────────────
function Stat({
  label,
  value,
  accent = 'default',
}: {
  label: string;
  value: string;
  accent?: 'default' | 'violet' | 'green' | 'amber';
}) {
  const color =
    accent === 'violet'
      ? 'text-violet-500 dark:text-violet-300'
      : accent === 'green'
        ? 'text-emerald-500 dark:text-emerald-400'
        : accent === 'amber'
          ? 'text-amber-500 dark:text-amber-400'
          : 'text-slate-900 dark:text-slate-100';
  return (
    <div className='rounded-xl border border-slate-200 dark:border-slate-700/70 bg-white/70 dark:bg-slate-900/40 p-3'>
      <p className='text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1'>
        {label}
      </p>
      <p className={`text-sm font-black tabular-nums leading-tight ${color}`}>
        {value}
      </p>
    </div>
  );
}

// ── Status pill ────────────────────────────────────────────────────────────
function StatusPill({ status }: { status: BondPaymentStatus }) {
  const map: Record<
    BondPaymentStatus,
    { label: string; cls: string; Icon: typeof FiCheckCircle }
  > = {
    received: {
      label: 'Received',
      cls: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      Icon: FiCheckCircle,
    },
    upcoming: {
      label: 'Upcoming',
      cls: 'border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400',
      Icon: FiClock,
    },
    missed: {
      label: 'Missed',
      cls: 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400',
      Icon: FiAlertCircle,
    },
  };
  const { label, cls, Icon } = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${cls}`}
    >
      <Icon size={10} />
      {label}
    </span>
  );
}

export function BondTrackingModal({
  open,
  onClose,
  bond,
}: {
  open: boolean;
  onClose: () => void;
  bond: BondInvestment;
}) {
  const accounts = usePortfolioStore((s) => s.accounts);

  const summary = useMemo(() => summarizeBond(bond), [bond]);
  const account = accounts.find((a) => a.id === bond.accountId);
  const freq = bond.payoutFrequency ?? 'monthly';

  const progressPct =
    summary.totalExpectedInterest > 0
      ? Math.min(
          100,
          (summary.interestReceived / summary.totalExpectedInterest) * 100,
        )
      : 0;

  return (
    <Modal open={open} onClose={onClose} title='Bond Interest Tracker'>
      <div className='space-y-5'>
        {/* Header */}
        <div className='flex items-center gap-3'>
          <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-500 dark:text-violet-300'>
            <FiBriefcase className='h-5 w-5' />
          </div>
          <div>
            <h2 className='text-base font-bold text-slate-900 dark:text-slate-100 leading-tight'>
              {bond.name}
            </h2>
            <p className='text-[11px] font-medium text-slate-500 dark:text-slate-400'>
              {bond.interestRate}% p.a. · {PAYOUT_FREQUENCY_LABELS[freq]} ·{' '}
              {bond.durationMonths} mo
              {account ? ` · → ${account.name}` : ''}
            </p>
          </div>
        </div>

        {/* Summary stats */}
        <div className='grid grid-cols-2 gap-2.5 md:grid-cols-4'>
          <Stat label='Principal' value={formatCurrency(summary.principal)} />
          <Stat
            label='Per Payout'
            value={formatCurrency(summary.perPeriodInterest)}
            accent='violet'
          />
          <Stat
            label='Total Interest'
            value={formatCurrency(summary.totalExpectedInterest)}
          />
          <Stat
            label='Maturity Amount'
            value={formatCurrency(summary.totalMaturityAmount)}
          />
          <Stat
            label='Interest Received'
            value={formatCurrency(summary.interestReceived)}
            accent='green'
          />
          <Stat
            label='Interest Remaining'
            value={formatCurrency(summary.interestRemaining)}
            accent='amber'
          />
          <Stat
            label='Maturity Date'
            value={formatBusinessDateLabel(summary.maturityDate)}
          />
          <Stat
            label='Payouts'
            value={`${summary.couponsReceived}/${summary.couponCount}`}
          />
        </div>

        {/* Progress */}
        <div>
          <div className='mb-1.5 flex items-center justify-between text-[11px] font-semibold'>
            <span className='text-slate-500 dark:text-slate-400'>
              Interest collected
            </span>
            <span className='text-violet-500 dark:text-violet-300'>
              {progressPct.toFixed(0)}%
            </span>
          </div>
          <div className='h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden'>
            <div
              className='h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-500 transition-all duration-500'
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Next payment callout */}
        {summary.nextPayment && (
          <div className='flex items-center gap-3 rounded-xl border border-sky-500/25 bg-sky-500/5 px-4 py-3'>
            <FiCalendar className='h-4 w-4 shrink-0 text-sky-500 dark:text-sky-400' />
            <div className='flex-1'>
              <p className='text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400'>
                {summary.nextPayment.status === 'missed'
                  ? 'Missed payment'
                  : 'Next payment'}
              </p>
              <p className='text-sm font-bold text-slate-900 dark:text-slate-100'>
                {formatBusinessDateLabel(summary.nextPayment.date)} ·{' '}
                {formatCurrency(summary.nextPayment.amount)}
                {summary.nextPayment.kind === 'maturity' && (
                  <span className='ml-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400'>
                    (incl. principal)
                  </span>
                )}
              </p>
            </div>
            <StatusPill status={summary.nextPayment.status} />
          </div>
        )}

        {summary.isMatured && (
          <div className='flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-2.5 text-xs font-bold text-emerald-600 dark:text-emerald-400'>
            <FiTrendingUp className='h-4 w-4' />
            This bond has matured — principal settled.
          </div>
        )}

        {/* Month-by-month interest received */}
        {summary.byMonth.length > 0 && (
          <div>
            <p className='mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400'>
              Interest received · month by month
            </p>
            <div className='flex flex-wrap gap-2'>
              {summary.byMonth.map((m) => (
                <div
                  key={m.month}
                  className='rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5'
                >
                  <span className='text-[10px] font-bold text-slate-500 dark:text-slate-400'>
                    {m.month}
                  </span>
                  <span className='ml-2 text-xs font-black text-emerald-600 dark:text-emerald-400 tabular-nums'>
                    {formatCurrency(m.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Full schedule */}
        <div>
          <p className='mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400'>
            Payment schedule
          </p>
          <div className='overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700/70'>
            <table className='w-full text-left'>
              <thead className='bg-slate-100 dark:bg-slate-800/60'>
                <tr>
                  <th className='px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'>
                    #
                  </th>
                  <th className='px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'>
                    Date
                  </th>
                  <th className='px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'>
                    Interest
                  </th>
                  <th className='hidden px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 sm:table-cell'>
                    Principal
                  </th>
                  <th className='px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'>
                    Total
                  </th>
                  <th className='px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'>
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className='divide-y divide-slate-200 dark:divide-slate-800'>
                {summary.schedule.map((row, i) => (
                  <tr
                    key={row.id}
                    className={
                      row.kind === 'maturity'
                        ? 'bg-violet-500/5'
                        : i % 2 === 1
                          ? 'bg-slate-50 dark:bg-slate-900/30'
                          : ''
                    }
                  >
                    <td className='px-3 py-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums'>
                      {row.kind === 'maturity' ? 'M' : row.index + 1}
                    </td>
                    <td className='px-3 py-2 text-[11px] font-semibold text-slate-700 dark:text-slate-200'>
                      {formatBusinessDateLabel(row.date)}
                    </td>
                    <td className='px-3 py-2 text-right text-[11px] font-bold text-emerald-600 dark:text-emerald-400 tabular-nums'>
                      {row.interest > 0 ? formatCurrency(row.interest) : '—'}
                    </td>
                    <td className='hidden px-3 py-2 text-right text-[11px] font-semibold text-slate-600 dark:text-slate-300 tabular-nums sm:table-cell'>
                      {row.principal > 0 ? formatCurrency(row.principal) : '—'}
                    </td>
                    <td className='px-3 py-2 text-right text-[11px] font-black text-slate-900 dark:text-slate-100 tabular-nums'>
                      {formatCurrency(row.amount)}
                    </td>
                    <td className='px-3 py-2 text-right'>
                      <StatusPill status={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className='mt-2 text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-snug'>
            Interest is tracked here in the Investments section only. Nothing is
            posted to Cashflow or Accounts automatically — add an entry manually
            if you want a payment reflected there.
          </p>
        </div>
      </div>
    </Modal>
  );
}
