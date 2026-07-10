import {
  FiAlertCircle,
  FiCalendar,
  FiCheck,
  FiClock,
  FiDownload,
  FiEdit2,
  FiList,
  FiPlus,
  FiTrash2,
} from 'react-icons/fi';
import { format, parseISO } from 'date-fns';
import { useMemo, useState } from 'react';

import type { TrackedPayment } from '../../types/investmentTypes';
import { Modal } from '../../components/ui/Modal';
import { UpsertTrackedPaymentModal } from '../../components/payments/UpsertTrackedPaymentModal';
import {
  computePaymentStats,
  daysUntilDue,
  paymentTypeLabel,
} from '../../utils/paymentTracker';
import { formatINR } from '../../utils/format';
import { exportTrackedPaymentsCSV } from '../../utils/exportUtils';
import { usePortfolioStore } from '../../store/portfolioStore';
import { useAsyncAction } from '../../hooks/useAsyncAction';
import { AsyncButton } from '../../components/ui/AsyncButton';
import { ButtonSpinner } from '../../components/ui/ButtonSpinner';

type FilterTab = 'pending' | 'paid' | 'all';
type ViewMode = 'list' | 'calendar';

function StatusBadge({ payment }: { payment: TrackedPayment }) {
  if (payment.status === 'paid') {
    return (
      <span className='inline-flex rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'>
        Paid
      </span>
    );
  }
  const days = daysUntilDue(payment.dueDate);
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
        Due today
      </span>
    );
  }
  if (days <= 7) {
    return (
      <span className='inline-flex items-center gap-1 rounded-md bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-600 dark:text-sky-400 border border-sky-500/20'>
        <FiClock className='h-3 w-3' />
        In {days}d
      </span>
    );
  }
  return (
    <span className='inline-flex rounded-md bg-slate-500/10 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-400 border border-slate-500/20'>
      Pending
    </span>
  );
}

export function PaymentTrackerPage() {
  const ready = usePortfolioStore((s) => s.ready);
  const trackedPayments = usePortfolioStore((s) => s.trackedPayments);
  const markPaid = usePortfolioStore((s) => s.markTrackedPaymentPaid);
  const deletePayment = usePortfolioStore((s) => s.deleteTrackedPayment);
  const { busy: actionBusy, run } = useAsyncAction();
  const [payingId, setPayingId] = useState<string | null>(null);

  const [filterTab, setFilterTab] = useState<FilterTab>('pending');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [modalOpen, setModalOpen] = useState(false);
  const [editPayment, setEditPayment] = useState<TrackedPayment | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const stats = useMemo(
    () => computePaymentStats(trackedPayments),
    [trackedPayments],
  );

  const filtered = useMemo(() => {
    return trackedPayments.filter((p) => {
      if (filterTab === 'pending') return p.status === 'pending';
      if (filterTab === 'paid') return p.status === 'paid';
      return true;
    });
  }, [trackedPayments, filterTab]);

  const groupedByMonth = useMemo(() => {
    const map = new Map<string, TrackedPayment[]>();
    filtered.forEach((p) => {
      const key = format(parseISO(p.dueDate), 'MMMM yyyy');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    });
    return Array.from(map.entries());
  }, [filtered]);

  const tabCls = (tab: FilterTab) =>
    `px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
      filterTab === tab
        ? 'bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/30'
        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-transparent'
    }`;

  if (!ready) {
    return (
      <div className='p-8 text-center text-slate-500'>Loading payments…</div>
    );
  }

  return (
    <div className='flex flex-col gap-6 pb-8'>
      <header className='flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-sky-500/10 via-blue-500/5 to-transparent p-6 border border-sky-500/20 shadow-sm'>
        <div className='flex items-start gap-4'>
          <div className='flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-sky-600 text-white shadow-lg shadow-sky-500/30'>
            <FiCalendar className='h-6 w-6' />
          </div>
          <div>
            <h1 className='text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white'>
              Payment Tracker
            </h1>
            <p className='mt-1 text-sm text-slate-600 dark:text-slate-300'>
              Track upcoming payments and get reminders before due dates.
            </p>
          </div>
        </div>
        <div className='flex flex-wrap gap-2'>
          <button
            type='button'
            onClick={() => exportTrackedPaymentsCSV(trackedPayments)}
            className='flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors'
          >
            <FiDownload className='h-4 w-4' />
            Export
          </button>
          <button
            type='button'
            onClick={() => {
              setEditPayment(null);
              setModalOpen(true);
            }}
            className='flex items-center gap-2 rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-sky-500/25 hover:bg-sky-500 transition-colors'
          >
            <FiPlus className='h-4 w-4' />
            Add Payment
          </button>
        </div>
      </header>

      <div className='grid grid-cols-2 lg:grid-cols-4 gap-4'>
        <div className='rounded-2xl border border-sky-500/20 bg-sky-500/5 p-5'>
          <p className='text-[10px] font-bold uppercase tracking-wider text-slate-500'>
            Due This Month
          </p>
          <p className='mt-1 text-xl font-black text-sky-600 dark:text-sky-400 tabular-nums'>
            {formatINR(stats.dueThisMonthTotal)}
          </p>
          <p className='text-xs text-slate-500'>{stats.dueThisMonthCount} payments</p>
        </div>
        <div className='rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5'>
          <p className='text-[10px] font-bold uppercase tracking-wider text-slate-500'>
            Upcoming (14 days)
          </p>
          <p className='mt-1 text-xl font-black text-amber-600 dark:text-amber-400 tabular-nums'>
            {stats.upcoming.length}
          </p>
        </div>
        <div className='rounded-2xl border border-rose-500/20 bg-rose-500/5 p-5'>
          <p className='text-[10px] font-bold uppercase tracking-wider text-slate-500'>
            Overdue
          </p>
          <p className='mt-1 text-xl font-black text-rose-600 dark:text-rose-400 tabular-nums'>
            {formatINR(stats.overdueTotal)}
          </p>
          <p className='text-xs text-slate-500'>{stats.overdue.length} payments</p>
        </div>
        <div className='rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5'>
          <p className='text-[10px] font-bold uppercase tracking-wider text-slate-500'>
            Paid This Month
          </p>
          <p className='mt-1 text-xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums'>
            {stats.recentlyPaid.length}
          </p>
        </div>
      </div>

      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div className='flex flex-wrap gap-2'>
          <button type='button' className={tabCls('pending')} onClick={() => setFilterTab('pending')}>
            Pending
          </button>
          <button type='button' className={tabCls('paid')} onClick={() => setFilterTab('paid')}>
            Paid
          </button>
          <button type='button' className={tabCls('all')} onClick={() => setFilterTab('all')}>
            All
          </button>
        </div>
        <div className='flex rounded-xl border border-slate-200 dark:border-slate-700 p-1'>
          <button
            type='button'
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
              viewMode === 'list'
                ? 'bg-sky-500/20 text-sky-600 dark:text-sky-400'
                : 'text-slate-500'
            }`}
          >
            <FiList className='h-3.5 w-3.5' /> List
          </button>
          <button
            type='button'
            onClick={() => setViewMode('calendar')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
              viewMode === 'calendar'
                ? 'bg-sky-500/20 text-sky-600 dark:text-sky-400'
                : 'text-slate-500'
            }`}
          >
            <FiCalendar className='h-3.5 w-3.5' /> Calendar
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className='rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-12 text-center'>
          <p className='text-sm font-bold text-slate-600 dark:text-slate-400'>
            No payments yet. Add your first bill, EMI, or chit payment.
          </p>
        </div>
      ) : viewMode === 'list' ? (
        <div className='overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/50 shadow-sm'>
          <div className='overflow-x-auto'>
            <table className='w-full text-left text-sm'>
              <thead>
                <tr className='border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80'>
                  {['Title', 'Type', 'Amount', 'Due Date', 'Status', 'Actions'].map(
                    (h) => (
                      <th
                        key={h}
                        className='px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500'
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    className='row-hover border-b border-slate-100 dark:border-slate-800/60 last:border-0'
                  >
                    <td className='px-4 py-3 font-semibold text-slate-900 dark:text-slate-100'>
                      {p.title}
                    </td>
                    <td className='px-4 py-3 text-slate-600 dark:text-slate-400 text-xs'>
                      {paymentTypeLabel(p.paymentType)}
                    </td>
                    <td className='px-4 py-3 font-bold text-sky-600 dark:text-sky-400 tabular-nums whitespace-nowrap'>
                      {formatINR(p.amount)}
                    </td>
                    <td className='px-4 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap'>
                      {format(parseISO(p.dueDate), 'dd MMM yyyy')}
                    </td>
                    <td className='px-4 py-3'>
                      <StatusBadge payment={p} />
                    </td>
                    <td className='px-4 py-3'>
                      <div className='flex justify-center gap-1.5'>
                        {p.status === 'pending' && (
                          <button
                            type='button'
                            title='Mark paid'
                            disabled={actionBusy}
                            className='btn-icon btn-icon-edit h-8 w-8 text-emerald-600 disabled:opacity-50'
                            onClick={() =>
                              void run(async () => {
                                setPayingId(p.id);
                                try {
                                  await markPaid(p.id);
                                } finally {
                                  setPayingId(null);
                                }
                              })
                            }
                          >
                            {payingId === p.id ? (
                              <ButtonSpinner className='h-4 w-4' />
                            ) : (
                              <FiCheck className='h-4 w-4' />
                            )}
                          </button>
                        )}
                        <button
                          type='button'
                          title='Edit'
                          className='btn-icon btn-icon-edit h-8 w-8'
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
                          className='btn-icon btn-icon-delete h-8 w-8'
                          onClick={() => setDeleteId(p.id)}
                        >
                          <FiTrash2 className='h-4 w-4' />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className='space-y-6'>
          {groupedByMonth.map(([month, items]) => (
            <div
              key={month}
              className='rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/50 p-4 shadow-sm'
            >
              <h3 className='mb-3 text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2'>
                <FiCalendar className='h-4 w-4 text-sky-500' />
                {month}
              </h3>
              <div className='space-y-2'>
                {items.map((p) => (
                  <div
                    key={p.id}
                    className='flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/70 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-900/40 px-4 py-3'
                  >
                    <div>
                      <p className='font-semibold text-slate-900 dark:text-slate-100'>
                        {p.title}
                      </p>
                      <p className='text-xs text-slate-500'>
                        {format(parseISO(p.dueDate), 'dd MMM')} ·{' '}
                        {paymentTypeLabel(p.paymentType)}
                      </p>
                    </div>
                    <div className='flex items-center gap-3'>
                      <span className='font-bold text-sky-600 dark:text-sky-400 tabular-nums'>
                        {formatINR(p.amount)}
                      </span>
                      <StatusBadge payment={p} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <UpsertTrackedPaymentModal
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
        title='Delete Payment?'
      >
        <div className='space-y-4'>
          <p className='text-sm text-slate-500'>This payment record will be permanently removed.</p>
          <div className='flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800 pt-4'>
            <button
              type='button'
              onClick={() => setDeleteId(null)}
              className='rounded-xl px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
            >
              Cancel
            </button>
            <AsyncButton
              type='button'
              onClick={() => {
                if (!deleteId) return;
                void run(async () => {
                  await deletePayment(deleteId);
                  setDeleteId(null);
                });
              }}
              busy={actionBusy}
              loadingLabel='Deleting…'
              className='rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-500'
            >
              Delete
            </AsyncButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
