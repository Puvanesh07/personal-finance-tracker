import { useMemo, useState } from 'react'
import { format, subMonths } from 'date-fns'
import { usePortfolioStore } from '../../store/portfolioStore'
import { formatINR } from '../../utils/format'
import { monthKey, summarizeMonth } from '../../utils/cashflow'
import { UpsertCashflowModal } from '../../components/cashflow/UpsertCashflowModal'
import type { CashflowEntry } from '../../types/investmentTypes'
import { FiActivity, FiPlus } from 'react-icons/fi'

function MonthPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const options = Array.from({ length: 12 }).map((_, i) => {
    const d = subMonths(new Date(), i)
    return { key: format(d, 'yyyy-MM'), label: format(d, 'MMM yyyy') }
  })
  return (
    <select
      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o.key} value={o.key}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function CashflowPage() {
  const cashflows = usePortfolioStore((s) => s.cashflows)
  const deleteCashflow = usePortfolioStore((s) => s.deleteCashflow)

  const [month, setMonth] = useState(() => format(new Date(), 'yyyy-MM'))
  const [open, setOpen] = useState(false)
  const [edit, setEdit] = useState<CashflowEntry | null>(null)

  const monthSummary = useMemo(() => summarizeMonth(cashflows, month), [cashflows, month])

  const monthRows = useMemo(
    () => cashflows.filter((e) => monthKey(e.date) === month).sort((a, b) => b.date.localeCompare(a.date)),
    [cashflows, month],
  )

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FiActivity className="h-6 w-6 text-emerald-500" />
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Income &amp; Expenses</h1>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Track monthly cashflow, savings rate, and top expenses.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MonthPicker value={month} onChange={setMonth} />
          <button
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 dark:bg-emerald-400 dark:text-slate-900 dark:hover:bg-emerald-300"
            onClick={() => setOpen(true)}
            type="button"
          >
            <FiPlus className="h-4 w-4" />
            <span>Add entry</span>
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Income</div>
          <div className="mt-2 text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-50">
            {formatINR(monthSummary.income)}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Expenses</div>
          <div className="mt-2 text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-50">
            {formatINR(monthSummary.expense)}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Savings</div>
          <div className="mt-2 text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-50">
            {formatINR(monthSummary.savings)}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Savings rate</div>
          <div className="mt-2 text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-50">
            {monthSummary.savingsRate.toFixed(0)}%
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-300">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Notes</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {monthRows.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-600" colSpan={6}>
                    No entries for this month.
                  </td>
                </tr>
              ) : (
                monthRows.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 text-slate-700">{e.date}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          e.type === 'income'
                            ? 'rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700'
                            : 'rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700'
                        }
                      >
                        {e.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{e.category}</td>
                    <td className="px-4 py-3 text-slate-700">{e.notes ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatINR(e.amount)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          onClick={() => setEdit(e)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                          onClick={() => {
                            if (confirm('Delete this entry?')) void deleteCashflow(e.id)
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <UpsertCashflowModal open={open} onClose={() => setOpen(false)} mode="create" />
      {edit ? <UpsertCashflowModal open={!!edit} onClose={() => setEdit(null)} mode="edit" entry={edit} /> : null}
    </div>
  )
}

