import {
  FiAlertCircle,
  FiCheck,
  FiChevronDown,
  FiChevronUp,
  FiClock,
  FiEdit2,
  FiPercent,
  FiPlus,
  FiTrash2,
} from 'react-icons/fi';
import { differenceInDays, parseISO } from 'date-fns';
import { useMemo, useState } from 'react';

import type { PendingPayment } from '../../types/investmentTypes';
import { Modal } from '../ui/Modal';
import { UpsertPendingPaymentModal } from './UpsertPendingPaymentModal';
import {
  buildYearlyAmortization,
  summarizeAmortization,
} from '../../utils/calculations';
import { formatINR } from '../../utils/format';
import { usePortfolioStore } from '../../store/portfolioStore';
import { useAsyncAction } from '../../hooks/useAsyncAction';
import { AsyncButton } from '../ui/AsyncButton';

type FilterTab = 'pending' | 'received' | 'all';

function getDaysUntilDue(expectedPaymentDate: string) {
  return differenceInDays(parseISO(expectedPaymentDate), new Date());
}

function DueBadge({ payment }: { payment: PendingPayment }) {
  if (payment.status === 'received') {
    return (
      <span className='inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'>
        Received
      </span>
    );
  }

  const days = getDaysUntilDue(payment.expectedPaymentDate);
  if (days < 0) {
    return (
      <span className='inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400 border border-rose-500/20'>
        <FiAlertCircle className='h-3 w-3' />
        {Math.abs(days)}d overdue
      </span>
    );
  }
  if (days === 0) {
    return (
      <span className='inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 border border-amber-500/20'>
        <FiClock className='h-3 w-3' />
        Due today
      </span>
    );
  }
  if (days <= 5) {
    return (
      <span className='inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 border border-amber-500/20'>
        <FiClock className='h-3 w-3' />
        Due in {days}d
      </span>
    );
  }
  return (
    <span className='inline-flex items-center rounded-md bg-slate-500/10 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-400 border border-slate-500/20'>
      Due {new Date(payment.expectedPaymentDate).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
      })}
    </span>
  );
}

export function PendingPaymentsTab() {
  const pendingPayments = usePortfolioStore((s) => s.pendingPayments);
  const deletePendingPayment = usePortfolioStore((s) => s.deletePendingPayment);
  const markPendingPaymentReceived = usePortfolioStore((s) => s.markPendingPaymentReceived);

  const [filterTab, setFilterTab] = useState<FilterTab>('pending');
  const [modalOpen, setModalOpen] = useState(false);
  const [editPayment, setEditPayment] = useState<PendingPayment | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { busy: deleteBusy, run: runDelete } = useAsyncAction();

  const active = pendingPayments.filter((p) => p.status === 'pending');
  const received = pendingPayments.filter((p) => p.status === 'received');

  const stats = useMemo(() => {
    const totalPending = active.reduce((s, p) => {
      if (p.isLoan && p.interestAccruedToDate != null && p.principal) {
        return s + p.principal + p.interestAccruedToDate;
      }
      return s + p.amount;
    }, 0);
    const overdue = active.filter(
      (p) => getDaysUntilDue(p.expectedPaymentDate) < 0,
    ).length;
    const dueSoon = active.filter((p) => {
      const d = getDaysUntilDue(p.expectedPaymentDate);
      return d >= 0 && d <= 5;
    }).length;
    const totalPrincipalPending = active.reduce((s, p) => {
      return s + (p.isLoan && p.principal ? p.principal : p.amount);
    }, 0);
    const totalInterestPending = active.reduce((s, p) => {
      return s + (p.isLoan && p.interestAccruedToDate ? p.interestAccruedToDate : 0);
    }, 0);
    return { totalPending, overdue, dueSoon, totalPrincipalPending, totalInterestPending };
  }, [active]);

  const filtered = pendingPayments.filter((p) => {
    if (filterTab === 'pending') return p.status === 'pending';
    if (filterTab === 'received') return p.status === 'received';
    return true;
  });

  const tabCls = (tab: FilterTab) =>
    `px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
      filterTab === tab
        ? 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30'
        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-800 dark:hover:text-slate-100 border border-transparent'
    }`;

  const markReceived = async (p: PendingPayment) => {
    await markPendingPaymentReceived(p.id);
  };

  const confirmDelete = () => {
    if (!deleteId) return;
    void runDelete(async () => {
      await deletePendingPayment(deleteId);
      setDeleteId(null);
    });
  };

  return (
    <div className='flex flex-col gap-6'>
      <header className='flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-violet-500/5 to-transparent p-6 border border-indigo-500/20 dark:from-indigo-500/20 dark:via-violet-500/10 dark:border-indigo-500/30 shadow-sm'>
        <div>
          <h2 className='text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-white'>
            Money Owed To Me
          </h2>
          <p className='mt-1 text-sm text-slate-600 dark:text-slate-300'>
            Track receivables — money from buyers, vendors, or friends that hasn't come in yet.
          </p>
        </div>
        <button
          type='button'
          onClick={() => {
            setEditPayment(null);
            setModalOpen(true);
          }}
          className='flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 hover:-translate-y-0.5 transition-all'
        >
          <FiPlus className='h-4 w-4' />
          Add Expected Receipt
        </button>
      </header>

      <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
        <div className='rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-5'>
          <p className='text-[10px] font-bold uppercase tracking-wider text-slate-500'>
            Total Pending (incl. interest)
          </p>
          <p className='mt-1 text-2xl font-black text-indigo-600 dark:text-indigo-400 tabular-nums'>
            {formatINR(stats.totalPending)}
          </p>
          <p className='mt-1 text-xs text-slate-500'>{active.length} open</p>
        </div>
        <div className='rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5'>
          <p className='text-[10px] font-bold uppercase tracking-wider text-slate-500'>
            Due Within 5 Days
          </p>
          <p className='mt-1 text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums'>
            {stats.dueSoon}
          </p>
        </div>
        <div className='rounded-2xl border border-rose-500/20 bg-rose-500/5 p-5'>
          <p className='text-[10px] font-bold uppercase tracking-wider text-slate-500'>
            Overdue
          </p>
          <p className='mt-1 text-2xl font-black text-rose-600 dark:text-rose-400 tabular-nums'>
            {stats.overdue}
          </p>
        </div>
      </div>

      {stats.totalInterestPending > 0 && (
        <div className='grid grid-cols-2 gap-4'>
          <div className='rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-4'>
            <p className='text-[10px] font-bold uppercase tracking-wider text-slate-500'>
              Pending Principal
            </p>
            <p className='mt-1 text-xl font-black text-slate-800 dark:text-slate-100 tabular-nums'>
              {formatINR(stats.totalPrincipalPending)}
            </p>
          </div>
          <div className='rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-4'>
            <p className='text-[10px] font-bold uppercase tracking-wider text-slate-500'>
              Accrued Interest (receivable)
            </p>
            <p className='mt-1 text-xl font-black text-rose-600 dark:text-rose-400 tabular-nums'>
              {formatINR(stats.totalInterestPending)}
            </p>
          </div>
        </div>
      )}

      {pendingPayments.length > 0 && (
        <div className='flex flex-wrap gap-2'>
          <button
            type='button'
            className={tabCls('pending')}
            onClick={() => setFilterTab('pending')}
          >
            Pending ({active.length})
          </button>
          <button
            type='button'
            className={tabCls('received')}
            onClick={() => setFilterTab('received')}
          >
            Received ({received.length})
          </button>
          <button
            type='button'
            className={tabCls('all')}
            onClick={() => setFilterTab('all')}
          >
            All ({pendingPayments.length})
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className='rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 p-12 text-center'>
          <p className='text-sm font-bold text-slate-600 dark:text-slate-400'>
            {filterTab === 'received'
              ? 'No received receivables yet.'
              : 'No money owed to you yet. Record when someone owes you (sale, loan, etc.).'}
          </p>
          {filterTab !== 'received' && (
            <button
              type='button'
              onClick={() => setModalOpen(true)}
              className='mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-500 transition-colors'
            >
              <FiPlus className='h-4 w-4' />
              Add first receivable
            </button>
          )}
        </div>
      ) : (
        <div className='space-y-3'>
          {filtered.map((p) => {
            const isExpanded = expandedId === p.id;
            const hasLoan = !!p.isLoan && (p.interestRate ?? 0) > 0;
            const amort = hasLoan && p.principal && p.loanTenureYears
              ? summarizeAmortization(
                  buildYearlyAmortization({
                    principal: p.principal,
                    annualRatePct: p.interestRate!,
                    startDate: p.saleDate,
                    tenureYears: p.loanTenureYears!,
                  }),
                )
              : null;

            return (
              <div
                key={p.id}
                className='overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 shadow-sm'
              >
                <div className='flex flex-col gap-4 p-4 md:p-5 md:flex-row md:items-start md:justify-between'>
                  <div className='flex items-start gap-4 min-w-0 flex-1'>
                    <button
                      type='button'
                      onClick={() => setExpandedId(isExpanded ? null : p.id)}
                      disabled={!hasLoan}
                      className={`mt-0.5 h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors flex ${
                        hasLoan
                          ? 'border-indigo-500/30 bg-indigo-500/5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 cursor-pointer'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 text-slate-400 cursor-default'
                      }`}
                      title={hasLoan ? 'Toggle amortization schedule' : ''}
                    >
                      {isExpanded ? (
                        <FiChevronUp className='h-4 w-4' />
                      ) : (
                        <FiChevronDown className='h-4 w-4' />
                      )}
                    </button>

                    <div className='min-w-0 flex-1'>
                      <div className='flex flex-wrap items-center gap-2'>
                        {hasLoan && (
                          <span className='inline-flex items-center gap-1 rounded-lg bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider'>
                            <FiPercent className='h-3 w-3' /> Loan @ {p.interestRate}%
                          </span>
                        )}
                        <DueBadge payment={p} />
                      </div>
                      <h3 className='mt-2 truncate text-base font-bold text-slate-900 dark:text-slate-100'>
                        {p.buyerName}
                      </h3>
                      <p className='mt-0.5 truncate text-sm text-slate-600 dark:text-slate-400'>
                        {p.itemDescription}
                      </p>
                      <div className='mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400'>
                        <span>
                          {new Date(p.saleDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {' → '}
                          {new Date(p.expectedPaymentDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                        {hasLoan && p.loanTenureYears && (
                          <span>{p.loanTenureYears}y tenure</span>
                        )}
                      </div>

                      {hasLoan && amort && (
                        <div className='mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 dark:bg-slate-800/30 p-3 border border-slate-200/60 dark:border-slate-800'>
                          <div>
                            <p className='text-[10px] font-bold uppercase tracking-wider text-slate-500'>Principal</p>
                            <p className='text-sm font-black text-slate-800 dark:text-slate-100 tabular-nums'>
                              {formatINR(p.principal || p.amount)}
                            </p>
                          </div>
                          <div>
                            <p className='text-[10px] font-bold uppercase tracking-wider text-slate-500'>Interest</p>
                            <p className='text-sm font-black text-rose-600 dark:text-rose-400 tabular-nums'>
                              +{formatINR(amort.totalInterest)}
                            </p>
                          </div>
                          <div>
                            <p className='text-[10px] font-bold uppercase tracking-wider text-slate-500'>Maturity</p>
                            <p className='text-sm font-black text-emerald-700 dark:text-emerald-400 tabular-nums'>
                              {formatINR(amort.totalRepayment)}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className='flex items-center justify-between md:flex-col md:items-end md:justify-start gap-3'>
                    <div className='text-right'>
                      <p className='text-[10px] font-bold uppercase tracking-wider text-slate-500'>
                        Amount
                      </p>
                      <p className='text-xl font-black tabular-nums text-indigo-600 dark:text-indigo-400'>
                        {formatINR(
                          hasLoan && amort
                            ? amort.totalRepayment
                            : p.amount,
                        )}
                      </p>
                    </div>
                    <div className='flex shrink-0 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/50'>
                      {p.status === 'pending' && (
                        <button
                          type='button'
                          title='Mark as received'
                          className='flex h-8 w-8 items-center cursor-pointer justify-center rounded-lg text-slate-900 dark:text-slate-500 transition-colors hover:bg-white hover:text-emerald-600 hover:shadow-sm dark:hover:bg-slate-700 dark:hover:text-emerald-400'
                          onClick={() => void markReceived(p)}
                        >
                          <FiCheck className='h-4 w-4' />
                        </button>
                      )}
                      <button
                        type='button'
                        title='Edit'
                        className='flex h-8 w-8 items-center cursor-pointer justify-center rounded-lg text-slate-900 dark:text-slate-500 transition-colors hover:bg-white hover:text-indigo-600 hover:shadow-sm dark:hover:bg-slate-700 dark:hover:text-indigo-400'
                        onClick={() => {
                          setEditPayment(p);
                          setModalOpen(true);
                        }}
                      >
                        <FiEdit2 className='h-4 w-4' />
                      </button>
                      <button
                        type='button'
                        title='Delete'
                        className='flex h-8 w-8 items-center cursor-pointer justify-center rounded-lg text-slate-900 dark:text-slate-500 transition-colors hover:bg-white hover:text-rose-600 hover:shadow-sm dark:hover:bg-slate-700 dark:hover:text-rose-400'
                        onClick={() => setDeleteId(p.id)}
                      >
                        <FiTrash2 className='h-4 w-4' />
                      </button>
                    </div>
                  </div>
                </div>

                {hasLoan && isExpanded && amort && amort.rows.length > 0 && (
                  <div className='border-t border-slate-200 dark:border-slate-800 bg-gradient-to-b from-indigo-500/5 to-transparent p-4 md:p-5'>
                    <div className='text-xs font-black uppercase tracking-wider text-slate-500 mb-3'>
                      Year-by-Year Amortization
                    </div>
                    <div className='overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800'>
                      <table className='w-full text-xs md:text-sm'>
                        <thead className='bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400'>
                          <tr>
                            <th className='px-3 py-2 text-left font-black'>Year</th>
                            <th className='px-3 py-2 text-left font-black'>Period</th>
                            <th className='px-3 py-2 text-right font-black'>Opening Balance</th>
                            <th className='px-3 py-2 text-right font-black'>Interest for Year</th>
                            <th className='px-3 py-2 text-right font-black'>Closing Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {amort.rows.map((r) => (
                            <tr key={r.year} className='border-t border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/30'>
                              <td className='px-3 py-2 font-black text-indigo-700 dark:text-indigo-400'>
                                Year {r.year}
                              </td>
                              <td className='px-3 py-2 text-slate-600 dark:text-slate-400 whitespace-nowrap'>
                                {new Date(r.startDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                                {' → '}
                                {new Date(r.endDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                              </td>
                              <td className='px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300'>
                                {formatINR(r.opening)}
                              </td>
                              <td className='px-3 py-2 text-right tabular-nums text-rose-600 dark:text-rose-400 font-bold'>
                                +{formatINR(r.interest)}
                              </td>
                              <td className='px-3 py-2 text-right tabular-nums font-black text-emerald-700 dark:text-emerald-400'>
                                {formatINR(r.closing)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className='bg-slate-50 dark:bg-slate-800/40 text-xs md:text-sm'>
                          <tr className='border-t-2 border-slate-300 dark:border-slate-700'>
                            <td className='px-3 py-2 font-black text-slate-900 dark:text-slate-100' colSpan={3}>
                              Total over {amort.rows.length} year{amort.rows.length > 1 ? 's' : ''}
                            </td>
                            <td className='px-3 py-2 text-right tabular-nums font-black text-rose-700 dark:text-rose-400'>
                              {formatINR(amort.totalInterest)}
                            </td>
                            <td className='px-3 py-2 text-right tabular-nums font-black text-emerald-800 dark:text-emerald-300'>
                              {formatINR(amort.totalRepayment)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <UpsertPendingPaymentModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditPayment(null);
        }}
        {...(editPayment
          ? { mode: 'edit' as const, payment: editPayment }
          : { mode: 'create' as const })}
      />

      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title='Delete Money Owed Entry?'
      >
        <div className='space-y-4'>
          <p className='text-sm text-slate-500 dark:text-slate-400'>
            This record will be permanently removed.
          </p>
          <div className='flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800 pt-4'>
            <button
              type='button'
              onClick={() => setDeleteId(null)}
              className='rounded-xl px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors'
            >
              Cancel
            </button>
            <AsyncButton
              type='button'
              onClick={confirmDelete}
              busy={deleteBusy}
              loadingLabel='Deleting…'
              className='rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-500 transition-colors'
            >
              Delete
            </AsyncButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
