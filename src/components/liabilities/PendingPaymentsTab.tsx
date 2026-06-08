import {
  FiAlertCircle,
  FiCheck,
  FiClock,
  FiEdit2,
  FiPlus,
  FiTrash2,
} from 'react-icons/fi';
import { differenceInDays, parseISO } from 'date-fns';
import { useMemo, useState } from 'react';

import type { PendingPayment } from '../../types/investmentTypes';
import { Modal } from '../ui/Modal';
import { UpsertPendingPaymentModal } from './UpsertPendingPaymentModal';
import { formatINR } from '../../utils/format';
import { usePortfolioStore } from '../../store/portfolioStore';

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
  const updatePendingPayment = usePortfolioStore((s) => s.updatePendingPayment);
  const deletePendingPayment = usePortfolioStore((s) => s.deletePendingPayment);

  const [filterTab, setFilterTab] = useState<FilterTab>('pending');
  const [modalOpen, setModalOpen] = useState(false);
  const [editPayment, setEditPayment] = useState<PendingPayment | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const active = pendingPayments.filter((p) => p.status === 'pending');
  const received = pendingPayments.filter((p) => p.status === 'received');

  const stats = useMemo(() => {
    const totalPending = active.reduce((s, p) => s + p.amount, 0);
    const overdue = active.filter(
      (p) => getDaysUntilDue(p.expectedPaymentDate) < 0,
    ).length;
    const dueSoon = active.filter((p) => {
      const d = getDaysUntilDue(p.expectedPaymentDate);
      return d >= 0 && d <= 5;
    }).length;
    return { totalPending, overdue, dueSoon };
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
    await updatePendingPayment(p.id, {
      status: 'received',
      receivedAt: new Date().toISOString().split('T')[0],
    });
  };

  const confirmDelete = async () => {
    if (deleteId) await deletePendingPayment(deleteId);
    setDeleteId(null);
  };

  return (
    <div className='flex flex-col gap-6'>
      <header className='flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-violet-500/5 to-transparent p-6 border border-indigo-500/20 dark:from-indigo-500/20 dark:via-violet-500/10 dark:border-indigo-500/30 shadow-sm'>
        <div>
          <h2 className='text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-white'>
            Pending Payments
          </h2>
          <p className='mt-1 text-sm text-slate-600 dark:text-slate-300'>
            Track sales awaiting payment from buyers and vendors.
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
          Add Pending Payment
        </button>
      </header>

      <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
        <div className='rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-5'>
          <p className='text-[10px] font-bold uppercase tracking-wider text-slate-500'>
            Total Pending
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
            All
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className='rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 p-12 text-center'>
          <p className='text-sm font-bold text-slate-600 dark:text-slate-400'>
            {filterTab === 'received'
              ? 'No received payments yet.'
              : 'No pending payments. Record a sale awaiting payment from a buyer.'}
          </p>
          {filterTab !== 'received' && (
            <button
              type='button'
              onClick={() => setModalOpen(true)}
              className='mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-500 transition-colors'
            >
              <FiPlus className='h-4 w-4' />
              Add first payment
            </button>
          )}
        </div>
      ) : (
        <div className='overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/50 shadow-sm'>
          <div className='overflow-x-auto'>
            <table className='w-full text-left text-sm'>
              <thead>
                <tr className='border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80'>
                  <th className='px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500'>
                    Buyer / Vendor
                  </th>
                  <th className='px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500'>
                    Item
                  </th>
                  <th className='px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500'>
                    Amount
                  </th>
                  <th className='px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500'>
                    Sale Date
                  </th>
                  <th className='px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500'>
                    Payment Due
                  </th>
                  <th className='px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500'>
                    Status
                  </th>
                  <th className='px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-center'>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    className='row-hover border-b border-slate-100 dark:border-slate-800/60 last:border-0'
                  >
                    <td className='px-4 py-3'>
                      <p className='font-semibold text-slate-900 dark:text-slate-100'>
                        {p.buyerName}
                      </p>
                      {p.buyerPhone && (
                        <p className='text-xs text-slate-500'>{p.buyerPhone}</p>
                      )}
                    </td>
                    <td className='px-4 py-3 text-slate-700 dark:text-slate-300 max-w-[180px] truncate'>
                      {p.itemDescription}
                    </td>
                    <td className='px-4 py-3 font-bold text-indigo-600 dark:text-indigo-400 tabular-nums whitespace-nowrap'>
                      {formatINR(p.amount)}
                    </td>
                    <td className='px-4 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap'>
                      {new Date(p.saleDate).toLocaleDateString('en-IN')}
                    </td>
                    <td className='px-4 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap'>
                      {new Date(p.expectedPaymentDate).toLocaleDateString(
                        'en-IN',
                      )}
                    </td>
                    <td className='px-4 py-3'>
                      <DueBadge payment={p} />
                    </td>
                    <td className='px-4 py-3'>
                      <div className='flex justify-center gap-1.5'>
                        {p.status === 'pending' && (
                          <button
                            type='button'
                            title='Mark as received'
                            className='btn-icon btn-icon-edit h-8 w-8 text-emerald-600 dark:text-emerald-400'
                            onClick={() => void markReceived(p)}
                          >
                            <FiCheck className='h-4 w-4' />
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
        title='Delete Pending Payment?'
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
            <button
              type='button'
              onClick={() => void confirmDelete()}
              className='rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-500 transition-colors'
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
