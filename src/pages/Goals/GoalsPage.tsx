// src/pages/Goals/GoalsPage.tsx
//
// UPDATED:
//  • Status badge shown on each goal card/row
//  • "Add Contribution" button on each goal → opens GoalContributeModal
//  • Contributions update currentAmount in Firestore via updateGoal
//  • Completed/Success goals shown with a special badge and can be filtered
//  • Filter tabs: All | Active | Completed

import {
  FiDownload,
  FiEdit2,
  FiFlag,
  FiPlus,
  FiTarget,
  FiTrash2,
  FiTrendingUp,
} from 'react-icons/fi';
import type { Goal, GoalStatus } from '../../types/investmentTypes';
import {
  GoalContributeModal,
  UpsertGoalModal,
} from '../../components/goals/UpsertGoalModal';

import { GoalsSkeleton } from '../../components/loader/skeletons';
import { SavedViewsMenu } from '../../components/ui/SavedViewsMenu';
import { Modal } from '../../components/ui/Modal';
import { formatINR } from '../../utils/format';
import { exportGoalsCSV } from '../../utils/exportUtils';
import { usePortfolioStore } from '../../store/portfolioStore';
import { useState } from 'react';

// ── Status Badge ──────────────────────────────────────────────────────────
function StatusBadge({ status }: { status?: GoalStatus }) {
  if (!status || status === 'active') return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-black uppercase tracking-wider border ${
        status === 'success'
          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
          : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
      }`}
    >
      {status === 'success' ? '🏆 Success' : '✅ Completed'}
    </span>
  );
}

type FilterTab = 'all' | 'active' | 'done';

export function GoalsPage() {
  const ready = usePortfolioStore((s) => s.ready);
  const goals = usePortfolioStore((s) => s.goals);
  const deleteGoal = usePortfolioStore((s) => s.deleteGoal);
  const updateGoal = usePortfolioStore((s) => s.updateGoal);

  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Goal | null>(null);

  // Contribute modal state
  const [contributeGoal, setContributeGoal] = useState<Goal | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);

  // Bulk Delete State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // Filter tab
  const [filterTab, setFilterTab] = useState<FilterTab>('all');

  const openDeleteModal = (id: string) => {
    setSelectedGoalId(id);
    setDeleteOpen(true);
  };

  const confirmDelete = () => {
    if (selectedGoalId) deleteGoal(selectedGoalId);
    setDeleteOpen(false);
    setSelectedGoalId(null);
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(filteredGoals.map((g) => g.id)));
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

  const handleExportSelected = () => {
    const list = goals.filter((g) => selectedIds.has(g.id));
    exportGoalsCSV(list, 'goals-selection.csv');
  };

  // Handle contribution: add amount to currentAmount and save contribution record
  async function handleContribute(amount: number, date: string) {
    if (!contributeGoal) return;
    const newAmount = contributeGoal.currentAmount + amount;
    // Update the goal's currentAmount in Firestore
    await updateGoal(contributeGoal.id, {
      currentAmount: newAmount,
      // Auto-mark as success if target reached
      ...(newAmount >= contributeGoal.targetAmount
        ? {
            status: 'success' as GoalStatus,
            completedAt: date,
          }
        : {}),
    } as any);
    // Optionally: also save a GoalContribution sub-doc via addGoalContribution store action
    // await addGoalContribution({ goalId: contributeGoal.id, amount, note, date })
  }

  const filteredGoals = goals.filter((g) => {
    if (filterTab === 'active') return !g.status || g.status === 'active';
    if (filterTab === 'done')
      return g.status === 'completed' || g.status === 'success';
    return true;
  });

  if (!ready) return <GoalsSkeleton />;

  const tabCls = (tab: FilterTab) =>
    `px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
      filterTab === tab
        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
        : 'text-slate-900 dark:text-slate-500 hover:text-slate-600 dark:text-slate-700 dark:hover:text-slate-600 dark:text-slate-700 dark:text-slate-300 border border-transparent'
    }`;

  return (
    <div className='flex flex-col gap-6 pb-8 animate-in fade-in duration-500'>
      {/* Header */}
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

      {/* Filter Tabs */}
      {goals.length > 0 && (
        <div className='flex flex-wrap items-center gap-2'>
          <SavedViewsMenu
            pageId='goals'
            getState={() => ({ filterTab })}
            applyState={(s) => {
              if (s.filterTab === 'all' || s.filterTab === 'active' || s.filterTab === 'done')
                setFilterTab(s.filterTab);
            }}
          />
          <button className={tabCls('all')} onClick={() => setFilterTab('all')}>
            All ({goals.length})
          </button>
          <button
            className={tabCls('active')}
            onClick={() => setFilterTab('active')}
          >
            🎯 Active (
            {goals.filter((g) => !g.status || g.status === 'active').length})
          </button>
          <button
            className={tabCls('done')}
            onClick={() => setFilterTab('done')}
          >
            🏆 Done (
            {
              goals.filter(
                (g) => g.status === 'completed' || g.status === 'success',
              ).length
            }
            )
          </button>
        </div>
      )}

      {/* Content Area */}
      {filteredGoals.length === 0 ? (
        <div className='rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 p-10 text-center'>
          <div className='mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/20'>
            <FiTarget className='h-6 w-6 text-emerald-600 dark:text-emerald-400' />
          </div>
          <p className='mt-4 text-sm font-bold text-slate-600 dark:text-slate-400'>
            {filterTab === 'done'
              ? 'No completed goals yet. Keep going!'
              : 'No goals set yet. Start planning your future!'}
          </p>
        </div>
      ) : (
        <>
          {/* Action Bar for Bulk Delete */}
          {selectedIds.size > 0 && (
            <div className='flex flex-wrap justify-end gap-2'>
              <button
                type='button'
                onClick={handleExportSelected}
                className='flex items-center cursor-pointer gap-2 rounded-xl border border-slate-200/80 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
              >
                <FiDownload className='h-4 w-4' /> Export selected (
                {selectedIds.size})
              </button>
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
            {filteredGoals.map((g) => {
              const pct =
                g.targetAmount > 0
                  ? Math.min(100, (g.currentAmount / g.targetAmount) * 100)
                  : 0;
              const isCompleted = pct >= 100;
              const isDone = g.status === 'completed' || g.status === 'success';

              return (
                <div
                  key={g.id}
                  className={`relative flex flex-col gap-4 rounded-2xl border p-5 shadow-sm backdrop-blur-md ${
                    isDone
                      ? 'border-amber-500/20 bg-amber-500/5 dark:bg-amber-500/5'
                      : 'border-slate-200/60 bg-white/80 dark:border-slate-800/60 dark:bg-slate-900/60'
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
                        <div className='flex items-center gap-2 flex-wrap'>
                          <h3 className='truncate text-base font-bold text-slate-900 dark:text-slate-100'>
                            {g.name}
                          </h3>
                          <StatusBadge status={g.status} />
                        </div>
                        {g.dueDate && (
                          <div className='mt-1 text-xs font-medium text-slate-500 dark:text-slate-400'>
                            Due by{' '}
                            <span className='text-slate-700 dark:text-slate-300'>
                              {g.dueDate}
                            </span>
                          </div>
                        )}
                        {g.completedAt && (
                          <div className='mt-1 text-xs font-medium text-teal-500'>
                            Achieved on {g.completedAt}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Action Buttons */}
                    <div className='flex shrink-0 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/50'>
                      {/* Contribute button — only for active goals */}
                      {(!g.status || g.status === 'active') && (
                        <button
                          type='button'
                          title='Add Contribution'
                          className='flex h-8 w-8 items-center cursor-pointer justify-center rounded-lg text-slate-900 dark:text-slate-500 transition-colors hover:bg-white hover:text-emerald-600 hover:shadow-sm dark:hover:bg-slate-700 dark:hover:text-emerald-400'
                          onClick={() => setContributeGoal(g)}
                        >
                          <FiTrendingUp className='h-4 w-4' />
                        </button>
                      )}
                      <button
                        type='button'
                        title='Edit'
                        className='flex h-8 w-8 items-center cursor-pointer justify-center rounded-lg text-slate-900 dark:text-slate-500 transition-colors hover:bg-white hover:text-indigo-600 hover:shadow-sm dark:hover:bg-slate-700 dark:hover:text-indigo-400'
                        onClick={() => setEdit(g)}
                      >
                        <FiEdit2 className='h-4 w-4' />
                      </button>
                      <button
                        type='button'
                        title='Delete'
                        className='flex h-8 w-8 items-center justify-center rounded-lg text-slate-900 dark:text-slate-500 transition-colors hover:bg-white hover:text-rose-600 hover:shadow-sm dark:hover:bg-slate-700 dark:hover:text-rose-400'
                        onClick={() => openDeleteModal(g.id)}
                      >
                        <FiTrash2 className='h-4 w-4' />
                      </button>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className='flex flex-col gap-2'>
                    <div className='flex items-center justify-between text-xs font-bold'>
                      <span className='text-slate-900 dark:text-slate-500 uppercase tracking-wider text-[10px]'>
                        Progress
                      </span>
                      <span
                        className={
                          isCompleted
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-slate-500 dark:text-slate-400'
                        }
                      >
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                    <div className='h-2.5 w-full overflow-hidden rounded-full bg-slate-100 shadow-inner dark:bg-slate-800'>
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ${
                          isCompleted
                            ? 'bg-gradient-to-r from-emerald-400 to-emerald-600'
                            : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Financials */}
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
                <thead className='border-b border-slate-200/60 bg-slate-50/50 text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-500 dark:border-slate-800/60 dark:bg-slate-800/50 dark:text-slate-400'>
                  <tr>
                    <th className='px-5 py-4 w-12'>
                      <input
                        type='checkbox'
                        checked={
                          filteredGoals.length > 0 &&
                          selectedIds.size === filteredGoals.length
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
                  {filteredGoals.map((g) => {
                    const pct =
                      g.targetAmount > 0
                        ? Math.min(
                            100,
                            (g.currentAmount / g.targetAmount) * 100,
                          )
                        : 0;
                    const isCompleted = pct >= 100;
                    const isDone =
                      g.status === 'completed' || g.status === 'success';

                    return (
                      <tr
                        key={g.id}
                        className={`transition-colors ${
                          isDone
                            ? 'bg-amber-500/3 hover:bg-amber-500/5'
                            : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                        }`}
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
                          <div className='flex items-center gap-2 flex-wrap'>
                            <span className='font-bold text-slate-900 dark:text-slate-50'>
                              {g.name}
                            </span>
                            <StatusBadge status={g.status} />
                          </div>
                          {g.dueDate ? (
                            <div className='mt-1 text-xs font-medium text-slate-500 dark:text-slate-400'>
                              Due by{' '}
                              <span className='text-slate-700 dark:text-slate-300'>
                                {g.dueDate}
                              </span>
                            </div>
                          ) : null}
                          {g.completedAt && (
                            <div className='mt-0.5 text-xs font-medium text-teal-500'>
                              Achieved {g.completedAt}
                            </div>
                          )}
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
                                    : 'text-slate-900 dark:text-slate-500'
                                }
                              >
                                {pct.toFixed(1)}%
                              </span>
                            </div>
                            <div className='h-2.5 w-full overflow-hidden rounded-full bg-slate-100 shadow-inner dark:bg-slate-800'>
                              <div
                                className={`h-full rounded-full transition-all duration-1000 ${
                                  isCompleted
                                    ? 'bg-gradient-to-r from-emerald-400 to-emerald-600'
                                    : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        <td className='px-5 py-5 text-right text-base font-black tabular-nums text-slate-900 dark:text-slate-50'>
                          {formatINR(g.targetAmount)}
                        </td>

                        <td className='px-5 py-5'>
                          <div className='flex justify-center gap-2'>
                            {/* Contribute — active goals only */}
                            {(!g.status || g.status === 'active') && (
                              <button
                                type='button'
                                title='Add Contribution'
                                className='flex h-9 w-9 items-center cursor-pointer justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 transition-all hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-500/20 dark:hover:text-emerald-400'
                                onClick={() => setContributeGoal(g)}
                              >
                                <FiTrendingUp className='h-4 w-4' />
                              </button>
                            )}
                            <button
                              type='button'
                              title='Edit'
                              className='flex h-9 w-9 items-center cursor-pointer justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 transition-all hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-500/20 dark:hover:text-indigo-400'
                              onClick={() => setEdit(g)}
                            >
                              <FiEdit2 className='h-4 w-4' />
                            </button>
                            <button
                              type='button'
                              title='Delete'
                              className='flex h-9 w-9 items-center justify-center cursor-pointer rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 transition-all hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/20 dark:hover:text-rose-400'
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

      {/* Modals */}
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

      {/* Contribute Modal */}
      {contributeGoal && (
        <GoalContributeModal
          open={!!contributeGoal}
          onClose={() => setContributeGoal(null)}
          goal={contributeGoal}
          onContribute={handleContribute}
        />
      )}

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title='⚠ Confirm Data Deletion'
      >
        <div className='space-y-6'>
          <p className='text-sm text-slate-500 dark:text-slate-400'>
            This will delete the goal permanently.
          </p>
          <div className='flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800 pt-5'>
            <button
              onClick={() => setDeleteOpen(false)}
              className='rounded-xl px-5 py-2.5 text-sm cursor-pointer font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:bg-slate-800 transition-colors'
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
          <p className='text-sm text-slate-500 dark:text-slate-400'>
            This will permanently delete {selectedIds.size} selected goals.
          </p>
          <div className='flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800 pt-5'>
            <button
              onClick={() => setBulkDeleteOpen(false)}
              className='rounded-xl px-5 py-2.5 text-sm cursor-pointer font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:bg-slate-800 transition-colors'
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
