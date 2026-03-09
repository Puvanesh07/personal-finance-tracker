import { useState } from 'react'
import { usePortfolioStore } from '../../store/portfolioStore'
import { formatINR } from '../../utils/format'
import type { Goal } from '../../types/investmentTypes'
import { UpsertGoalModal } from '../../components/goals/UpsertGoalModal'
import { FiPlus } from 'react-icons/fi'

export function GoalsPage() {
  const goals = usePortfolioStore((s) => s.goals)
  const deleteGoal = usePortfolioStore((s) => s.deleteGoal)

  const [open, setOpen] = useState(false)
  const [edit, setEdit] = useState<Goal | null>(null)

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Goals</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Set and track long-term financial goals.
          </p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 dark:bg-emerald-400 dark:text-slate-900 dark:hover:bg-emerald-300"
          onClick={() => setOpen(true)}
          type="button"
        >
          <FiPlus className="h-4 w-4" />
          <span>Add goal</span>
        </button>
      </header>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3 text-right">Progress</th>
                <th className="px-4 py-3 text-right">Target</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {goals.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-600" colSpan={4}>
                    No goals yet.
                  </td>
                </tr>
              ) : (
                goals.map((g) => {
                  const pct = g.targetAmount > 0 ? Math.min(100, (g.currentAmount / g.targetAmount) * 100) : 0
                  return (
                    <tr key={g.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{g.name}</div>
                        {g.dueDate ? <div className="text-xs text-slate-500">Due by {g.dueDate}</div> : null}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between text-xs text-slate-500">
                            <span>{formatINR(g.currentAmount)}</span>
                            <span>{pct.toFixed(0)}%</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        {formatINR(g.targetAmount)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            onClick={() => setEdit(g)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                            onClick={() => {
                              if (confirm('Delete this goal?')) void deleteGoal(g.id)
                            }}
                          >
                            Delete
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

