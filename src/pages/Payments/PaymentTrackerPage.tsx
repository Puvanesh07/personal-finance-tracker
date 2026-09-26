import {
  FiAlertCircle,
  FiCalendar,
  FiCheck,
  FiChevronRight,
  FiClock,
  FiDownload,
  FiEdit2,
  FiList,
  FiPlus,
  FiTrash2,
} from 'react-icons/fi';
import { format, parseISO } from 'date-fns';
import { useMemo, useState } from 'react';

import { usePremiumActions } from '../../hooks/usePremiumActions';
import type { TrackedPayment } from '../../types/investmentTypes';
import { Modal } from '../../components/ui/Modal';
import { UpsertTrackedPaymentModal } from '../../components/payments/UpsertTrackedPaymentModal';
import {
  computePaymentStats,
  daysUntilDue,
  paymentTypeLabel,
  RECURRENCE_LABELS,
  seriesSummary,
} from '../../utils/paymentTracker';
import { formatINR } from '../../utils/format';
import { exportTrackedPaymentsCSV } from '../../utils/exportUtils';
import { usePortfolioStore } from '../../store/portfolioStore';
import { useAsyncAction } from '../../hooks/useAsyncAction';
import { AsyncButton } from '../../components/ui/AsyncButton';
import { ButtonSpinner } from '../../components/ui/ButtonSpinner';
import { FeatureInfo } from '../../components/ui/FeatureInfo';
import { GoalsSkeleton } from '../../components/loader/skeletons';
import {
  buildMarkPaidPrompt,
  confirmAutoSync,
} from '../../utils/autoSyncConfirm';

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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className='flex items-start justify-between gap-4 py-2.5'>
      <dt className='shrink-0 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'>
        {label}
      </dt>
      <dd className='min-w-0 text-right text-sm font-semibold text-slate-900 dark:text-slate-100'>
        {value}
      </dd>
    </div>
  );
}

export function PaymentTrackerPage() {
  const { premiumActionProps } = usePremiumActions();
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
  /** Open bill in the read-only detail sheet (calendar view). */
  const [detailId, setDetailId] = useState<string | null>(null);

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

  // Read straight from the store so the detail sheet refreshes itself when the
  // bill is marked paid / edited underneath it.
  const detailPayment = detailId
    ? trackedPayments.find((p) => p.id === detailId) ?? null
    : null;

  const openEdit = (p: TrackedPayment) => {
    setDetailId(null);
    setEditPayment(p);
    setModalOpen(true);
  };

  const markPaidNow = (p: TrackedPayment) =>
    void run(async () => {
      // Auto-sync confirmation gate: paying this bill also writes a Cashflow
      // expense (and for recurring bills, generates the next one + advances
      // the linked insurance policy). Let the user veto the cascade.
      if (
        !confirmAutoSync(
          buildMarkPaidPrompt({
            title: p.title,
            amount: p.amount,
            recurrence: p.recurrence ?? 'none',
            isLinkedToInsurance: !!p.insurancePolicyId,
          }),
        )
      ) {
        return;
      }
      setPayingId(p.id);
      try {
        await markPaid(p.id);
      } finally {
        setPayingId(null);
      }
    });

  const tabCls = (tab: FilterTab) =>
    `px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
      filterTab === tab
        ? 'bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/30'
        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-transparent'
    }`;
if (!ready) return <GoalsSkeleton />;

  return (
    <div className='flex flex-col gap-6 pb-8'>
      <header className='flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-sky-500/10 via-blue-500/5 to-transparent p-6 border border-sky-500/20 shadow-sm'>
        <div className='flex items-start gap-4'>
          <div className='flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-sky-600 text-white shadow-lg shadow-sky-500/30'>
            <FiCalendar className='h-6 w-6' />
          </div>
          <div>
            <h1 className='text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2'>
              Payment Tracker
              <FeatureInfo feature='payments' />
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
            {...premiumActionProps}
            type='button'
            onClick={() => {
              setEditPayment(null);
              setModalOpen(true);
            }}
            className='flex items-center gap-2 rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-sky-500/25 hover:bg-sky-500 transition-colors disabled:cursor-not-allowed disabled:opacity-45'
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
                      {seriesSummary(p) && (
                        <span className='mt-0.5 block text-[10px] font-semibold text-slate-400 dark:text-slate-400'>
                          {seriesSummary(p)}
                        </span>
                      )}
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
                            onClick={() => markPaidNow(p)}
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
                          onClick={() => openEdit(p)}
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
                  <button
                    key={p.id}
                    type='button'
                    onClick={() => setDetailId(p.id)}
                    aria-label={`View details for ${p.title}`}
                    className='flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/70 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-900/40 px-4 py-3 text-left transition-colors hover:border-sky-400/60 hover:bg-sky-500/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40'
                  >
                    <div className='min-w-0'>
                      <p className='truncate font-semibold text-slate-900 dark:text-slate-100'>
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
                      <FiChevronRight className='h-4 w-4 shrink-0 text-slate-400' />
                    </div>
                  </button>
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

      {/* ── Bill detail — opened from the calendar view ── */}
      <Modal
        open={!!detailPayment}
        onClose={() => setDetailId(null)}
        title={detailPayment?.title ?? 'Payment details'}
        subtitle={
          detailPayment
            ? `${paymentTypeLabel(detailPayment.paymentType)} · due ${format(
                parseISO(detailPayment.dueDate),
                'dd MMM yyyy',
              )}`
            : undefined
        }
      >
        {detailPayment && (
          <div className='space-y-4'>
            <div className='flex items-center justify-between gap-3 rounded-2xl border border-sky-500/20 bg-sky-500/5 px-4 py-3'>
              <span className='text-2xl font-black tabular-nums text-sky-600 dark:text-sky-400'>
                {formatINR(detailPayment.amount)}
              </span>
              <StatusBadge payment={detailPayment} />
            </div>

            <dl className='divide-y divide-slate-200/70 text-slate-900 dark:divide-slate-800/60 dark:text-slate-100'>
              <DetailRow
                label='Due date'
                value={format(parseISO(detailPayment.dueDate), 'dd MMM yyyy')}
              />
              <DetailRow
                label='Recurrence'
                value={RECURRENCE_LABELS[detailPayment.recurrence] ?? 'One-time'}
              />
              {seriesSummary(detailPayment) && (
                <DetailRow label='Series' value={seriesSummary(detailPayment)!} />
              )}
              <DetailRow
                label='Reminders'
                value={
                  detailPayment.reminderDays.length
                    ? `${detailPayment.reminderDays.join(', ')} day(s) before`
                    : 'None'
                }
              />
              {detailPayment.status === 'paid' && detailPayment.paidAt && (
                <DetailRow
                  label='Paid on'
                  value={format(parseISO(detailPayment.paidAt), 'dd MMM yyyy')}
                />
              )}
              {detailPayment.endDate && (
                <DetailRow
                  label='Series ends'
                  value={format(parseISO(detailPayment.endDate), 'dd MMM yyyy')}
                />
              )}
              {detailPayment.notes && (
                <DetailRow label='Notes' value={detailPayment.notes} />
              )}
              {detailPayment.insurancePolicyId && (
                <DetailRow label='Linked to' value='Insurance policy premium' />
              )}
            </dl>

            {detailPayment.status === 'pending' && (
              <p className='text-xs font-medium text-slate-500 dark:text-slate-400'>
                {(() => {
                  const d = daysUntilDue(detailPayment.dueDate);
                  if (d < 0) return `Overdue by ${Math.abs(d)} day(s).`;
                  if (d === 0) return 'Due today.';
                  return `Due in ${d} day(s).`;
                })()}
              </p>
            )}

            <div className='grid grid-cols-2 gap-2 border-t border-slate-200/70 pt-4 dark:border-slate-800/60 sm:flex sm:justify-end'>
              {detailPayment.status === 'pending' && (
                <button
                  type='button'
                  disabled={actionBusy || payingId === detailPayment.id}
                  onClick={() => markPaidNow(detailPayment)}
                  className='inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50'
                >
                  {payingId === detailPayment.id ? (
                    <ButtonSpinner className='h-4 w-4' />
                  ) : (
                    <FiCheck className='h-4 w-4' />
                  )}
                  Mark as Paid
                </button>
              )}
              <button
                type='button'
                onClick={() => openEdit(detailPayment)}
                className='inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
              >
                <FiEdit2 className='h-4 w-4' /> Edit
              </button>
              <button
                type='button'
                onClick={() => {
                  const id = detailPayment.id;
                  setDetailId(null);
                  setDeleteId(id);
                }}
                className='inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-bold text-rose-600 transition-colors hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-400 dark:hover:bg-rose-900/20'
              >
                <FiTrash2 className='h-4 w-4' /> Delete
              </button>
              <button
                type='button'
                onClick={() => setDetailId(null)}
                className='inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

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
