import { useState } from 'react'
import { usePortfolioStore } from '../../store/portfolioStore'
import { formatINR } from '../../utils/format'
import type { Goal } from '../../types/investmentTypes'
import { UpsertGoalModal } from '../../components/goals/UpsertGoalModal'
import { FiFlag, FiPlus, FiEdit2, FiTrash2, FiTarget } from 'react-icons/fi'

export function GoalsPage() {
  const goals = usePortfolioStore((s) => s.goals)
  const deleteGoal = usePortfolioStore((s) => s.deleteGoal)

  const [open, setOpen] = useState(false)
  const [edit, setEdit] = useState<Goal | null>(null)

  return (
    <div className="flex flex-col gap-6 pb-8">
      {/* Premium Gradient Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent p-6 border border-emerald-500/20 dark:from-emerald-500/20 dark:via-teal-500/10 dark:border-emerald-500/30 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-500/30">
            <FiFlag className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Financial Goals</h1>
            <p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-300">
              Set, track, and achieve your long-term milestones.
            </p>
          </div>
        </div>
        <button
          className="group relative flex items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-emerald-500/25 transition-all hover:-translate-y-0.5 hover:shadow-emerald-500/40"
          onClick={() => setOpen(true)}
          type="button"
        >
          <div className="absolute inset-0 bg-white/20 translate-y-full transition-transform group-hover:translate-y-0" />
          <FiPlus className="relative h-4 w-4" />
          <span className="relative">Add Goal</span>
        </button>
      </header>

      {/* Glassmorphism Data Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white/80 shadow-lg backdrop-blur-md dark:border-slate-800/60 dark:bg-slate-900/50">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="min-w-full text-left text-sm whitespace-nowrap">
            <thead className="border-b border-slate-200/60 bg-slate-50/50 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800/60 dark:bg-slate-800/30 dark:text-slate-400">
              <tr>
                <th className="px-5 py-4 w-1/4">Goal Details</th>
                <th className="px-5 py-4 w-2/4">Progress Track</th>
                <th className="px-5 py-4 text-right">Target Amount</th>
                <th className="px-5 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/60 dark:divide-slate-800/60">
              {goals.length === 0 ? (
                <tr>
                  <td className="px-5 py-10 text-center text-slate-500" colSpan={4}>
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="rounded-full bg-slate-100 p-3 dark:bg-slate-800">
                        <FiTarget className="h-6 w-6 text-slate-400" />
                      </div>
                      <p>No goals set yet. Start planning your future!</p>
                    </div>
                  </td>
                </tr>
              ) : (
                goals.map((g) => {
                  const pct = g.targetAmount > 0 ? Math.min(100, (g.currentAmount / g.targetAmount) * 100) : 0
                  const isCompleted = pct >= 100
                  
                  return (
                    <tr key={g.id} className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-5">
                        <div className="font-bold text-slate-900 dark:text-slate-50">{g.name}</div>
                        {g.dueDate ? (
                          <div className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                            Due by <span className="text-slate-700 dark:text-slate-300">{g.dueDate}</span>
                          </div>
                        ) : null}
                      </td>
                      <td className="px-5 py-5">
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span className="text-slate-700 dark:text-slate-300">{formatINR(g.currentAmount)}</span>
                            <span className={isCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}>
                              {pct.toFixed(1)}%
                            </span>
                          </div>
                          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 shadow-inner dark:bg-slate-800">
                            <div
                              className={`h-full rounded-full transition-all duration-1000 ${
                                isCompleted 
                                  ? 'bg-gradient-to-r from-emerald-400 to-emerald-600 shadow-[0_0_10px_rgba(16,185,129,0.5)]' 
                                  : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-5 text-right font-bold tabular-nums text-slate-900 dark:text-slate-50">
                        {formatINR(g.targetAmount)}
                      </td>
                      <td className="px-5 py-5">
                        <div className="flex justify-center gap-2">
                          <button
                            type="button"
                            title="Edit"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400"
                            onClick={() => setEdit(g)}
                          >
                            <FiEdit2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            title="Delete"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this goal?')) void deleteGoal(g.id)
                            }}
                          >
                            <FiTrash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <UpsertGoalModal open={open} onClose={() => setOpen(false)} mode="create" />
      {edit ? <UpsertGoalModal open={!!edit} onClose={() => setEdit(null)} mode="edit" goal={edit} /> : null}
    </div>
  )
}