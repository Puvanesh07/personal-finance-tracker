import {
  FiClock,
  FiCreditCard,
  FiEdit2,
  FiPieChart,
  FiPlus,
  FiTrash2,
} from 'react-icons/fi';

import { LiabilitiesSkeleton } from '../../components/loader/skeletons';
import { Modal } from '../../components/ui/Modal';
import { UpsertLiabilityModal } from '../../components/liabilities/UpsertLiabilityModal';
import { formatINR } from '../../utils/format';
import { usePortfolioStore } from '../../store/portfolioStore';
import { useState } from 'react';

export function LiabilitiesPage() {
  const ready = usePortfolioStore((s) => s.ready);
  const liabilities = usePortfolioStore((s) => s.liabilities);
  const deleteLiability = usePortfolioStore((s) => s.deleteLiability);

  const totalOutstanding = liabilities.reduce(
    (a, l) => a + (l.outstanding || 0),
    0,
  );

  // Graph Calculations
  const loanTotal = liabilities
    .filter((l) => l.type === 'loan')
    .reduce((a, l) => a + (l.outstanding || 0), 0);
  const ccTotal = liabilities
    .filter((l) => l.type === 'credit_card')
    .reduce((a, l) => a + (l.outstanding || 0), 0);
  const personalTotal = liabilities
    .filter((l) => l.type === 'other')
    .reduce((a, l) => a + (l.outstanding || 0), 0);

  const loanPct = totalOutstanding ? (loanTotal / totalOutstanding) * 100 : 0;
  const ccPct = totalOutstanding ? (ccTotal / totalOutstanding) * 100 : 0;
  const personalPct = totalOutstanding
    ? (personalTotal / totalOutstanding) * 100
    : 0;

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const edit = liabilities.find((l) => l.id === editId) ?? null;

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const openDeleteModal = (id: string) => {
    setSelectedId(id);
    setDeleteOpen(true);
  };

  const confirmDelete = () => {
    if (selectedId) deleteLiability(selectedId);
    setDeleteOpen(false);
    setSelectedId(null);
  };

  if (!ready) return <LiabilitiesSkeleton />;

  const getTypeLabel = (type: string) => {
    if (type === 'other') return 'Personal';
    if (type === 'loan') return 'Bank Loan';
    if (type === 'credit_card') return 'Credit Card';
    return type;
  };

  return (
    <div className='flex flex-col gap-6 pb-8'>
      {/* Header */}
      <header className='flex flex-col md:flex-row md:items-center justify-between gap-6 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent p-6 border border-emerald-500/20 dark:from-emerald-500/20 dark:via-teal-500/10 dark:border-emerald-500/30 shadow-sm'>
        <div className='flex items-center gap-4'>
          <div className='flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-500/30'>
            <FiCreditCard className='h-6 w-6' />
          </div>
          <div>
            <h1 className='text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white'>
              Borrowed Money (Liabilities)
            </h1>
            <p className='mt-1 text-sm font-medium text-slate-600 dark:text-slate-300'>
              Track money you owe to banks, credit cards, or friends.
            </p>
          </div>
        </div>
        <button
          className='group relative flex items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-emerald-500/25 transition-all hover:-translate-y-0.5 hover:shadow-emerald-500/40'
          onClick={() => setOpen(true)}
          type='button'
        >
          <div className='absolute inset-0 bg-white/20 translate-y-full transition-transform group-hover:translate-y-0' />
          <FiPlus className='relative h-4 w-4' />
          <span className='relative'>Add Record</span>
        </button>
      </header>

      {/* Visual Dashboard Section */}
      <div className='grid grid-cols-1 gap-6 lg:grid-cols-3'>
        {/* Total Outstanding Card */}
        <div className='relative overflow-hidden rounded-2xl border border-rose-600 bg-gradient-to-br from-rose-500 to-rose-700 p-6 shadow-lg shadow-rose-500/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl'>
          <div className='text-sm font-medium tracking-wide text-rose-100'>
            Total Amount Pending to Pay
          </div>
          <div className='mt-3 text-4xl font-bold tabular-nums tracking-tight text-white'>
            {formatINR(totalOutstanding)}
          </div>
          <FiCreditCard className='absolute -bottom-4 -right-4 h-32 w-32 text-rose-400/30' />
        </div>

        {/* Debt Breakdown Graph Card */}
        <div className='lg:col-span-2 overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-800/60 dark:bg-slate-900/50 p-6'>
          <div className='flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4'>
            <FiPieChart className='h-4 w-4' />
            Debt Breakdown
          </div>

          {totalOutstanding === 0 ? (
            <div className='flex h-20 items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800/50 text-sm font-medium text-slate-400'>
              No active debt. Great job!
            </div>
          ) : (
            <div className='space-y-4'>
              {/* Stacked Progress Bar */}
              <div className='flex h-4 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800'>
                {loanPct > 0 && (
                  <div
                    style={{ width: `${loanPct}%` }}
                    className='bg-indigo-500 transition-all duration-1000'
                  />
                )}
                {ccPct > 0 && (
                  <div
                    style={{ width: `${ccPct}%` }}
                    className='bg-rose-500 transition-all duration-1000'
                  />
                )}
                {personalPct > 0 && (
                  <div
                    style={{ width: `${personalPct}%` }}
                    className='bg-emerald-500 transition-all duration-1000'
                  />
                )}
              </div>

              {/* Legend / Stats */}
              <div className='flex flex-wrap items-center gap-6 pt-2'>
                <div className='flex items-center gap-2'>
                  <div className='h-3 w-3 rounded-full bg-indigo-500' />
                  <div>
                    <div className='text-xs font-medium text-slate-500 dark:text-slate-400'>
                      Bank Loans
                    </div>
                    <div className='text-sm font-bold text-slate-900 dark:text-slate-100'>
                      {formatINR(loanTotal)}
                    </div>
                  </div>
                </div>
                <div className='flex items-center gap-2'>
                  <div className='h-3 w-3 rounded-full bg-rose-500' />
                  <div>
                    <div className='text-xs font-medium text-slate-500 dark:text-slate-400'>
                      Credit Cards
                    </div>
                    <div className='text-sm font-bold text-slate-900 dark:text-slate-100'>
                      {formatINR(ccTotal)}
                    </div>
                  </div>
                </div>
                <div className='flex items-center gap-2'>
                  <div className='h-3 w-3 rounded-full bg-emerald-500' />
                  <div>
                    <div className='text-xs font-medium text-slate-500 dark:text-slate-400'>
                      Personal (Friends)
                    </div>
                    <div className='text-sm font-bold text-slate-900 dark:text-slate-100'>
                      {formatINR(personalTotal)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className='overflow-hidden rounded-2xl border border-slate-200/60 bg-white/80 shadow-lg backdrop-blur-md dark:border-slate-800/60 dark:bg-slate-900/50'>
        <div className='overflow-x-auto custom-scrollbar'>
          <table className='min-w-full text-left text-sm whitespace-nowrap'>
            <thead className='border-b border-slate-200/60 bg-slate-50/50 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800/60 dark:bg-slate-800/30 dark:text-slate-400'>
              <tr>
                <th className='px-5 py-4'>Type</th>
                <th className='px-5 py-4'>Name / Description</th>
                <th className='px-5 py-4 text-right'>Pending Amount</th>
                <th className='px-5 py-4 text-right'>Target Date</th>
                <th className='px-5 py-4 text-center'>Actions</th>
              </tr>
            </thead>
            <tbody className='divide-y divide-slate-100/60 dark:divide-slate-800/60'>
              {liabilities.length === 0 ? (
                <tr>
                  <td
                    className='px-5 py-10 text-center text-slate-500'
                    colSpan={5}
                  >
                    <div className='flex flex-col items-center justify-center gap-2'>
                      <div className='rounded-full bg-slate-100 p-3 dark:bg-slate-800'>
                        <FiCreditCard className='h-6 w-6 text-slate-400' />
                      </div>
                      <p>No records found. You're debt free!</p>
                    </div>
                  </td>
                </tr>
              ) : (
                liabilities.map((l) => {
                  let daysLeft = null;
                  if (l.endDate && l.outstanding > 0) {
                    const due = new Date(l.endDate);
                    const today = new Date();
                    const diffTime = due.getTime() - today.getTime();
                    daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                  }

                  return (
                    <tr
                      key={l.id}
                      className='transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                    >
                      <td className='px-5 py-4'>
                        <span
                          className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-bold uppercase tracking-wide
                          ${l.type === 'loan' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400' : ''}
                          ${l.type === 'credit_card' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400' : ''}
                          ${l.type === 'other' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : ''}
                        `}
                        >
                          {getTypeLabel(l.type)}
                        </span>
                      </td>

                      <td className='px-5 py-4 font-bold text-slate-900 dark:text-slate-50'>
                        {l.name}
                        {daysLeft !== null &&
                          daysLeft <= 3 &&
                          daysLeft >= 0 && (
                            <span className='ml-2 inline-flex items-center gap-1 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-500/20 dark:text-rose-400'>
                              <FiClock /> Due in {daysLeft}d
                            </span>
                          )}
                        {daysLeft !== null && daysLeft < 0 && (
                          <span className='ml-2 inline-flex items-center gap-1 rounded bg-red-200 px-1.5 py-0.5 text-[10px] font-bold text-red-800 dark:bg-red-500/30 dark:text-red-400'>
                            <FiClock /> Overdue!
                          </span>
                        )}
                      </td>

                      <td className='px-5 py-4 text-right font-bold tabular-nums text-slate-800 dark:text-slate-200'>
                        {formatINR(l.outstanding)}
                      </td>

                      <td className='px-5 py-4 text-right font-medium tabular-nums text-slate-600 dark:text-slate-400'>
                        {l.endDate
                          ? new Date(l.endDate).toLocaleDateString()
                          : '—'}
                      </td>

                      <td className='px-5 py-4'>
                        <div className='flex justify-center gap-2'>
                          <button
                            type='button'
                            title='Edit'
                            className='flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400'
                            onClick={() => setEditId(l.id)}
                          >
                            <FiEdit2 className='h-4 w-4' />
                          </button>
                          <button
                            type='button'
                            title='Delete'
                            className='flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400'
                            onClick={() => openDeleteModal(l.id)}
                          >
                            <FiTrash2 className='h-4 w-4' />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <UpsertLiabilityModal
        open={open}
        onClose={() => setOpen(false)}
        mode='create'
      />
      {edit ? (
        <UpsertLiabilityModal
          open={!!edit}
          onClose={() => setEditId(null)}
          mode='edit'
          liability={edit}
        />
      ) : null}

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title='⚠ Confirm Deletion'
      >
        <div className='space-y-6'>
          <p className='text-sm text-slate-400'>
            This will permanently remove this record.
          </p>
          <div className='flex justify-end gap-3 border-t border-slate-800 pt-5'>
            <button
              onClick={() => setDeleteOpen(false)}
              className='rounded-xl px-5 py-2.5 text-sm font-bold text-slate-400 hover:bg-slate-800'
            >
              Cancel
            </button>
            <button
              onClick={confirmDelete}
              className='rounded-xl bg-red-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-red-700'
            >
              Yes, Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
