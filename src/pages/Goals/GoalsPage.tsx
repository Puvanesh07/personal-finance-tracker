// src/pages/Goals/GoalsPage.tsx

import {
  FiCheckCircle,
  FiEdit2,
  FiFlag,
  FiPlus,
  FiTarget,
  FiTrash2,
} from 'react-icons/fi';

import type { Goal } from '../../types/investmentTypes';
import { GoalsSkeleton } from '../../components/loader/skeletons';
import { Modal } from '../../components/ui/Modal';
import { UpsertGoalModal } from '../../components/goals/UpsertGoalModal';
import { formatINR } from '../../utils/format';
import { usePortfolioStore } from '../../store/portfolioStore';
import { useState } from 'react';

export function GoalsPage() {
  const ready = usePortfolioStore((s) => s.ready);
  const goals = usePortfolioStore((s) => s.goals);
  const deleteGoal = usePortfolioStore((s) => s.deleteGoal);

  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Goal | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const openDeleteModal = (id: string) => {
    setSelectedGoalId(id);
    setDeleteOpen(true);
  };

  const confirmDelete = () => {
    if (selectedGoalId) {
      deleteGoal(selectedGoalId);
    }
    setDeleteOpen(false);
    setSelectedGoalId(null);
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(goals.map((g) => g.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const confirmBulkDelete = () => {
    selectedIds.forEach((id) => deleteGoal(id));
    setSelectedIds(new Set());
    setBulkDeleteOpen(false);
  };

  if (!ready) return <GoalsSkeleton />;

  return (
    <div className='flex flex-col gap-6 pb-8 animate-in fade-in duration-500'>
      <header className='flex flex-col md:flex-row md:items-center justify-between gap-6 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent p-6 border border-emerald-500/20 dark:from-emerald-500/20 dark:via-teal-500/10 dark:border-emerald-500/30 shadow-sm'>
        <div className='flex items-center gap-4'>
          <div className='flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-500/30'>
            <FiFlag className='h-6 w-6' />
          </div>

          <div>
            <h1 className='text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white'>
              Financial Goals
            </h1>

            <p className='mt-1 text-sm font-medium text-slate-600 dark:text-slate-300'>
              Set, track, and achieve your long-term milestones.
            </p>
          </div>
        </div>

        <button
          className='group relative flex cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 px-5 py-3 md:py-2.5 text-sm font-medium text-white shadow-lg shadow-emerald-500/25 transition-all hover:-translate-y-0.5 hover:shadow-emerald-500/40'
          onClick={() => setOpen(true)}
          type='button'
        >
          <div className='absolute inset-0 bg-white/20 translate-y-full transition-transform group-hover:translate-y-0' />
          <FiPlus className='relative h-4 w-4' />
          <span className='relative font-bold'>Add Goal</span>
        </button>
      </header>

      {goals.length === 0 ? (
        <div className='rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 p-10 text-center'>
          <div className='mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/20'>
            <FiTarget className='h-6 w-6 text-emerald-600 dark:text-emerald-400' />
          </div>
          <p className='mt-4 text-sm font-bold text-slate-600 dark:text-slate-400'>
            No goals set yet. Start planning your future!
          </p>
        </div>
      ) : (
        <>
          {selectedIds.size > 0 && (
            <div className='flex justify-end'>
              <button
                type='button'
                onClick={() => setBulkDeleteOpen(true)}
                className='flex items-center cursor-pointer gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-rose-700 shadow-sm'
              >
                <FiTrash2 className='h-4 w-4' /> Delete Selected (
                {selectedIds.size})
              </button>
            </div>
          )}

          {/* 📱 Mobile Card View */}
          <div className='block md:hidden space-y-4'>
            {goals.map((g) => {
              const pct =
                g.targetAmount > 0
                  ? Math.min(100, (g.currentAmount / g.targetAmount) * 100)
                  : 0;
              const isCompleted = pct >= 100 || g.status === 'completed';

              return (
                <div
                  key={g.id}
                  className={`relative flex flex-col gap-4 rounded-2xl border bg-white/80 p-5 shadow-sm backdrop-blur-md dark:bg-slate-900/60 transition-all ${
                    isCompleted
                      ? 'border-emerald-500/30 dark:border-emerald-500/30'
                      : 'border-slate-200/60 dark:border-slate-800/60'
                  }`}
                >
                  <div className='flex items-start justify-between gap-4'>
                    <div className='flex items-center gap-3'>
                      <input
                        type='checkbox'
                        checked={selectedIds.has(g.id)}
                        onChange={() => handleSelect(g.id)}
                        className='h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600 dark:border-slate-600 dark:bg-slate-700 dark:ring-offset-slate-800'
                      />
                      <div className='min-w-0 flex-1'>
                        <h3 className='truncate text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2'>
                          {g.name}
                          {isCompleted && (
                            <span className='inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'>
                              <FiCheckCircle /> Success
                            </span>
                          )}
                        </h3>
                        {g.dueDate && (
                          <div className='mt-1 text-xs font-medium text-slate-500 dark:text-slate-400'>
                            Due by{' '}
                            <span className='text-slate-700 dark:text-slate-300'>
                              {g.dueDate}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className='flex shrink-0 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/50'>
                      <button
                        type='button'
                        className='flex h-8 w-8 items-center cursor-pointer justify-center rounded-lg text-slate-500 transition-colors hover:bg-white hover:text-indigo-600 hover:shadow-sm dark:hover:bg-slate-700 dark:hover:text-indigo-400'
                        onClick={() => setEdit(g)}
                      >
                        <FiEdit2 className='h-4 w-4' />
                      </button>
                      <button
                        type='button'
                        className='flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white hover:text-rose-600 hover:shadow-sm dark:hover:bg-slate-700 dark:hover:text-rose-400'
                        onClick={() => openDeleteModal(g.id)}
                      >
                        <FiTrash2 className='h-4 w-4' />
                      </button>
                    </div>
                  </div>

                  <div className='flex flex-col gap-2'>
                    <div className='flex items-center justify-between text-xs font-bold'>
                      <span className='text-slate-500 uppercase tracking-wider text-[10px]'>
                        Progress
                      </span>
                      <span
                        className={
                          isCompleted
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-slate-500 dark:text-slate-400'
                        }
                      >
                        {isCompleted ? '100%' : `${pct.toFixed(1)}%`}
                      </span>
                    </div>
                    <div className='h-2.5 w-full overflow-hidden rounded-full bg-slate-100 shadow-inner dark:bg-slate-800'>
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ${
                          isCompleted
                            ? 'bg-gradient-to-r from-emerald-400 to-emerald-600'
                            : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                        }`}
                        style={{ width: isCompleted ? '100%' : `${pct}%` }}
                      />
                    </div>
                  </div>

                  <div className='flex justify-between items-end border-t border-slate-100 pt-3 dark:border-slate-800'>
                    <div>
                      <p className='text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'>
                        Current
                      </p>
                      <p className='mt-0.5 text-sm font-bold text-slate-900 dark:text-slate-100'>
                        {formatINR(g.currentAmount)}
                      </p>
                    </div>
                    <div className='text-right'>
                      <p className='text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'>
                        Target
                      </p>
                      <p className='mt-0.5 text-base font-black tabular-nums text-slate-900 dark:text-slate-50'>
                        {formatINR(g.targetAmount)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 💻 Desktop Table View */}
          <div className='hidden md:block overflow-hidden rounded-2xl border border-slate-200/60 bg-white/80 shadow-lg backdrop-blur-md dark:border-slate-800/60 dark:bg-slate-900/50'>
            <div className='overflow-x-auto custom-scrollbar'>
              <table className='min-w-full text-left text-sm whitespace-nowrap'>
                <thead className='border-b border-slate-200/60 bg-slate-50/50 text-xs font-black uppercase tracking-widest text-slate-500 dark:border-slate-800/60 dark:bg-slate-800/50 dark:text-slate-400'>
                  <tr>
                    <th className='px-5 py-4 w-12'>
                      <input
                        type='checkbox'
                        checked={
                          goals.length > 0 && selectedIds.size === goals.length
                        }
                        onChange={handleSelectAll}
                        className='h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600 dark:border-slate-600 dark:bg-slate-700 dark:ring-offset-slate-800'
                      />
                    </th>
                    <th className='px-5 py-4 w-1/4'>Goal Details</th>
                    <th className='px-5 py-4 w-2/4'>Progress Track</th>
                    <th className='px-5 py-4 text-right'>Target Amount</th>
                    <th className='px-5 py-4 text-center'>Actions</th>
                  </tr>
                </thead>
                <tbody className='divide-y divide-slate-100/60 dark:divide-slate-800/60'>
                  {goals.map((g) => {
                    const pct =
                      g.targetAmount > 0
                        ? Math.min(
                            100,
                            (g.currentAmount / g.targetAmount) * 100,
                          )
                        : 0;
                    const isCompleted = pct >= 100 || g.status === 'completed';

                    return (
                      <tr
                        key={g.id}
                        className='transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                      >
                        <td className='px-5 py-5'>
                          <input
                            type='checkbox'
                            checked={selectedIds.has(g.id)}
                            onChange={() => handleSelect(g.id)}
                            className='h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600 dark:border-slate-600 dark:bg-slate-700 dark:ring-offset-slate-800'
                          />
                        </td>
                        <td className='px-5 py-5'>
                          <div className='font-bold text-slate-900 dark:text-slate-50 flex items-center gap-2'>
                            {g.name}
                            {isCompleted && (
                              <span className='inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'>
                                Success
                              </span>
                            )}
                          </div>
                          {g.dueDate ? (
                            <div className='mt-1 text-xs font-medium text-slate-500 dark:text-slate-400'>
                              Due by{' '}
                              <span className='text-slate-700 dark:text-slate-300'>
                                {g.dueDate}
                              </span>
                            </div>
                          ) : null}
                        </td>
                        <td className='px-5 py-5'>
                          <div className='flex flex-col gap-2'>
                            <div className='flex items-center justify-between text-xs font-bold'>
                              <span className='text-slate-700 dark:text-slate-300'>
                                {formatINR(g.currentAmount)}
                              </span>
                              <span
                                className={
                                  isCompleted
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-slate-500'
                                }
                              >
                                {isCompleted ? '100%' : `${pct.toFixed(1)}%`}
                              </span>
                            </div>
                            <div className='h-2.5 w-full overflow-hidden rounded-full bg-slate-100 shadow-inner dark:bg-slate-800'>
                              <div
                                className={`h-full rounded-full transition-all duration-1000 ${
                                  isCompleted
                                    ? 'bg-gradient-to-r from-emerald-400 to-emerald-600'
                                    : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                                }`}
                                style={{
                                  width: isCompleted ? '100%' : `${pct}%`,
                                }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className='px-5 py-5 text-right text-base font-black tabular-nums text-slate-900 dark:text-slate-50'>
                          {formatINR(g.targetAmount)}
                        </td>
                        <td className='px-5 py-5'>
                          <div className='flex justify-center gap-2'>
                            <button
                              type='button'
                              className='flex h-9 w-9 items-center cursor-pointer justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 transition-all hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-500/20 dark:hover:text-indigo-400'
                              onClick={() => setEdit(g)}
                            >
                              <FiEdit2 className='h-4 w-4' />
                            </button>
                            <button
                              type='button'
                              className='flex h-9 w-9 items-center justify-center cursor-pointer rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 transition-all hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/20 dark:hover:text-rose-400'
                              onClick={() => openDeleteModal(g.id)}
                            >
                              <FiTrash2 className='h-4 w-4' />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <UpsertGoalModal
        open={open}
        onClose={() => setOpen(false)}
        mode='create'
      />

      {edit ? (
        <UpsertGoalModal
          open={!!edit}
          onClose={() => setEdit(null)}
          mode='edit'
          goal={edit}
        />
      ) : null}

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title='⚠ Confirm Data Deletion'
      >
        <div className='space-y-6'>
          <p className='text-sm text-slate-400'>
            This will delete the goal permanently.
          </p>
          <div className='flex justify-end gap-3 border-t border-slate-800 pt-5'>
            <button
              onClick={() => setDeleteOpen(false)}
              className='rounded-xl px-5 py-2.5 text-sm cursor-pointer font-bold text-slate-400 hover:bg-slate-800 transition-colors'
            >
              Cancel
            </button>
            <button
              onClick={confirmDelete}
              className='rounded-xl cursor-pointer bg-rose-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-rose-700 transition-colors'
            >
              Yes, Delete
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        title='⚠ Confirm Bulk Deletion'
      >
        <div className='space-y-6'>
          <p className='text-sm text-slate-400'>
            This will permanently delete {selectedIds.size} selected goals.
          </p>
          <div className='flex justify-end gap-3 border-t border-slate-800 pt-5'>
            <button
              onClick={() => setBulkDeleteOpen(false)}
              className='rounded-xl px-5 py-2.5 text-sm cursor-pointer font-bold text-slate-400 hover:bg-slate-800 transition-colors'
            >
              Cancel
            </button>
            <button
              onClick={confirmBulkDelete}
              className='rounded-xl bg-rose-600 hover:bg-rose-700 cursor-pointer px-6 py-2.5 text-sm font-bold text-white transition-colors'
            >
              Yes, Delete {selectedIds.size} Records
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
