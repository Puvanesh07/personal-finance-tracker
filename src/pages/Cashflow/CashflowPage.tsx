import { useMemo, useState } from 'react'
import { format, subMonths } from 'date-fns'
import { usePortfolioStore } from '../../store/portfolioStore'
import { formatINR } from '../../utils/format'
import { monthKey, summarizeMonth } from '../../utils/cashflow'
import { UpsertCashflowModal } from '../../components/cashflow/UpsertCashflowModal'
import type { CashflowEntry } from '../../types/investmentTypes'
import { FiActivity, FiPlus, FiEdit2, FiTrash2, FiCalendar } from 'react-icons/fi'
import { Modal } from '../../components/ui/Modal'

function MonthPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const options = Array.from({ length: 12 }).map((_, i) => {
    const d = subMonths(new Date(), i)
    return { key: format(d, 'yyyy-MM'), label: format(d, 'MMMM yyyy') }
  })

  return (
    <div className="relative group">
      <FiCalendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

      <select
        className="appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-10 text-sm font-medium text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

export function CashflowPage() {

  const cashflows = usePortfolioStore((s) => s.cashflows)
  const deleteCashflow = usePortfolioStore((s) => s.deleteCashflow)

  const [month, setMonth] = useState(() => format(new Date(), 'yyyy-MM'))
  const [open, setOpen] = useState(false)
  const [edit, setEdit] = useState<CashflowEntry | null>(null)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedDeleteId, setSelectedDeleteId] = useState<string | null>(null)

  const monthSummary = useMemo(() => summarizeMonth(cashflows, month), [cashflows, month])

  const monthRows = useMemo(
    () => cashflows.filter((e) => monthKey(e.date) === month).sort((a, b) => b.date.localeCompare(a.date)),
    [cashflows, month],
  )

  const openDeleteModal = (id: string) => {
    setSelectedDeleteId(id)
    setDeleteOpen(true)
  }

  const confirmDelete = () => {
    if (selectedDeleteId) {
      deleteCashflow(selectedDeleteId)
    }
    setDeleteOpen(false)
    setSelectedDeleteId(null)
  }

  return (
    <div className="flex flex-col gap-6 pb-8">

      {/* Header */}

      <header className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-emerald-500/10 to-transparent p-6 border border-emerald-500/20">

        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-white">
            <FiActivity className="h-6 w-6" />
          </div>

          <div>
            <h1 className="text-2xl font-bold">Cashflow</h1>
            <p className="text-sm text-slate-500">Track monthly income and expenses</p>
          </div>
        </div>

        <div className="flex items-center gap-3">

          <MonthPicker value={month} onChange={setMonth} />

          <button
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-white"
            onClick={() => setOpen(true)}
          >
            <FiPlus className="h-4 w-4" />
            Add Entry
          </button>

        </div>
      </header>

      {/* Summary */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

        <div className="rounded-xl border p-5">
          <div className="text-sm text-slate-500">Income</div>
          <div className="text-xl font-bold text-emerald-600">{formatINR(monthSummary.income)}</div>
        </div>

        <div className="rounded-xl border p-5">
          <div className="text-sm text-slate-500">Expense</div>
          <div className="text-xl font-bold text-rose-600">{formatINR(monthSummary.expense)}</div>
        </div>

        <div className="rounded-xl border p-5">
          <div className="text-sm text-slate-500">Savings</div>
          <div className="text-xl font-bold">{formatINR(monthSummary.savings)}</div>
        </div>

      </div>

      {/* Table */}

      <div className="overflow-hidden rounded-xl border">

        <table className="min-w-full text-sm">

          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Notes</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>

          <tbody>

            {monthRows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-slate-500">
                  No transactions this month
                </td>
              </tr>
            )}

            {monthRows.map((e) => (

              <tr key={e.id} className="border-t">

                <td className="px-4 py-3">{e.date}</td>

                <td className="px-4 py-3">{e.type}</td>

                <td className="px-4 py-3">{e.category}</td>

                <td className="px-4 py-3">{e.notes ?? '-'}</td>

                <td className="px-4 py-3 text-right font-bold">
                  {e.type === 'income' ? '+' : '-'}{formatINR(e.amount)}
                </td>

                <td className="px-4 py-3">

                  <div className="flex justify-center gap-2">

                    <button
                      className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-indigo-50"
                      onClick={() => setEdit(e)}
                    >
                      <FiEdit2 />
                    </button>

                    <button
                      className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-rose-50"
                      onClick={() => openDeleteModal(e.id)}
                    >
                      <FiTrash2 />
                    </button>

                  </div>

                </td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

      {/* Create Modal */}

      <UpsertCashflowModal
        open={open}
        onClose={() => setOpen(false)}
        mode="create"
      />

      {/* Edit Modal */}

      {edit && (
        <UpsertCashflowModal
          open={!!edit}
          onClose={() => setEdit(null)}
          mode="edit"
          entry={edit}
        />
      )}

      {/* Delete Confirmation Modal */}

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="⚠ Confirm Data Deletion"
      >
        <div className="space-y-6">

          <p className="text-sm text-slate-400">
            This will delete the transaction permanently.
          </p>

          <div className="flex justify-end gap-3 border-t pt-5">

            <button
              onClick={() => setDeleteOpen(false)}
              className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-400 hover:bg-slate-100"
            >
              Cancel
            </button>

            <button
              onClick={confirmDelete}
              className="rounded-xl bg-red-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-red-700"
            >
              Yes, Delete
            </button>

          </div>

        </div>
      </Modal>

    </div>
  )
}