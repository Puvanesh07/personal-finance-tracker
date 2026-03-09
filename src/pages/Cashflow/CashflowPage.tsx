import { useMemo, useState } from 'react'
import { format, subMonths } from 'date-fns'
import { usePortfolioStore } from '../../store/portfolioStore'
import { formatINR } from '../../utils/format'
import { monthKey, summarizeMonth } from '../../utils/cashflow'
import { UpsertCashflowModal } from '../../components/cashflow/UpsertCashflowModal'
import type { CashflowEntry } from '../../types/investmentTypes'
import { FiActivity, FiPlus, FiEdit2, FiTrash2, FiCalendar } from 'react-icons/fi'

function MonthPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const options = Array.from({ length: 12 }).map((_, i) => {
    const d = subMonths(new Date(), i)
    return { key: format(d, 'yyyy-MM'), label: format(d, 'MMMM yyyy') }
  })
  return (
    <div className="relative group">
      <FiCalendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-emerald-500" />
      <select
        className="appearance-none rounded-xl border border-slate-200/80 bg-white/80 py-2.5 pl-9 pr-10 text-sm font-medium text-slate-700 shadow-sm outline-none transition-all focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 backdrop-blur-sm dark:border-slate-800/80 dark:bg-slate-900/80 dark:text-slate-100"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
        <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" fillRule="evenodd"></path></svg>
      </div>
    </div>
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
    <div className="flex flex-col gap-6 pb-8">
      {/* Premium Gradient Header */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent p-6 border border-emerald-500/20 dark:from-emerald-500/20 dark:via-teal-500/10 dark:border-emerald-500/30 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-500/30">
            <FiActivity className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Cashflow</h1>
            <p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-300">
              Track monthly income, expenses, and savings rate.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <MonthPicker value={month} onChange={setMonth} />
          <button
            className="group relative flex items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-emerald-500/25 transition-all hover:-translate-y-0.5 hover:shadow-emerald-500/40"
            onClick={() => setOpen(true)}
            type="button"
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full transition-transform group-hover:translate-y-0" />
            <FiPlus className="relative h-4 w-4" />
            <span className="relative">Add Entry</span>
          </button>
        </div>
      </header>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative overflow-hidden rounded-2xl border border-emerald-200/60 bg-white/80 p-5 shadow-sm backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:border-emerald-500/20 dark:bg-slate-900/50">
          <div className="text-sm font-medium tracking-wide text-slate-500 dark:text-slate-400">Total Income</div>
          <div className="mt-3 text-2xl font-bold tabular-nums tracking-tight text-emerald-600 dark:text-emerald-400">
            {formatINR(monthSummary.income)}
          </div>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-rose-200/60 bg-white/80 p-5 shadow-sm backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:border-rose-500/20 dark:bg-slate-900/50">
          <div className="text-sm font-medium tracking-wide text-slate-500 dark:text-slate-400">Total Expenses</div>
          <div className="mt-3 text-2xl font-bold tabular-nums tracking-tight text-rose-600 dark:text-rose-400">
            {formatINR(monthSummary.expense)}
          </div>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white/80 p-5 shadow-sm backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:border-slate-800/60 dark:bg-slate-900/50">
          <div className="text-sm font-medium tracking-wide text-slate-500 dark:text-slate-400">Net Savings</div>
          <div className="mt-3 text-2xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-slate-50">
            {formatINR(monthSummary.savings)}
          </div>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/60 bg-gradient-to-br from-indigo-500 to-indigo-700 p-5 shadow-sm backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:border-indigo-500/20">
          <div className="text-sm font-medium tracking-wide text-indigo-100">Savings Rate</div>
          <div className="mt-3 text-2xl font-bold tabular-nums tracking-tight text-white">
            {monthSummary.savingsRate.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Glassmorphism Data Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white/80 shadow-lg backdrop-blur-md dark:border-slate-800/60 dark:bg-slate-900/50">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="min-w-full text-left text-sm whitespace-nowrap">
            <thead className="border-b border-slate-200/60 bg-slate-50/50 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800/60 dark:bg-slate-800/30 dark:text-slate-400">
              <tr>
                <th className="px-5 py-4">Date</th>
                <th className="px-5 py-4">Type</th>
                <th className="px-5 py-4">Category</th>
                <th className="px-5 py-4">Notes</th>
                <th className="px-5 py-4 text-right">Amount</th>
                <th className="px-5 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/60 dark:divide-slate-800/60">
              {monthRows.length === 0 ? (
                <tr>
                  <td className="px-5 py-10 text-center text-slate-500" colSpan={6}>
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="rounded-full bg-slate-100 p-3 dark:bg-slate-800">
                        <FiActivity className="h-6 w-6 text-slate-400" />
                      </div>
                      <p>No transactions logged for this month.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                monthRows.map((e) => (
                  <tr key={e.id} className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-4 font-medium text-slate-600 dark:text-slate-300">{e.date}</td>
                    <td className="px-5 py-4">
                      <span
                        className={
                          e.type === 'income'
                            ? 'inline-flex items-center rounded-full border border-emerald-200/60 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400'
                            : 'inline-flex items-center rounded-full border border-rose-200/60 bg-rose-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400'
                        }
                      >
                        {e.type}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-bold text-slate-900 dark:text-slate-50">{e.category}</td>
                    <td className="px-5 py-4 text-slate-500 dark:text-slate-400 max-w-xs truncate">{e.notes ?? '—'}</td>
                    <td className={`px-5 py-4 text-right font-bold tabular-nums ${e.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-50'}`}>
                      {e.type === 'income' ? '+' : '-'}{formatINR(e.amount)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-center gap-2">
                        <button
                          type="button"
                          title="Edit"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400"
                          onClick={() => setEdit(e)}
                        >
                          <FiEdit2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Delete"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this transaction?')) void deleteCashflow(e.id)
                          }}
                        >
                          <FiTrash2 className="h-4 w-4" />
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