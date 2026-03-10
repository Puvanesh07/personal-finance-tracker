import { useState } from 'react'
import { usePortfolioStore } from '../../store/portfolioStore'
import { formatINR } from '../../utils/format'
import { UpsertLiabilityModal } from '../../components/liabilities/UpsertLiabilityModal'
import { Modal } from '../../components/ui/Modal'
import { FiCreditCard, FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi'

export function LiabilitiesPage() {

  const liabilities = usePortfolioStore((s) => s.liabilities)
  const deleteLiability = usePortfolioStore((s) => s.deleteLiability)

  const totalOutstanding = liabilities.reduce((a, l) => a + (l.outstanding || 0), 0)

  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  const edit = liabilities.find((l) => l.id === editId) ?? null

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const openDeleteModal = (id: string) => {
    setSelectedId(id)
    setDeleteOpen(true)
  }

  const confirmDelete = () => {
    if (selectedId) {
      deleteLiability(selectedId)
    }
    setDeleteOpen(false)
    setSelectedId(null)
  }

  return (
    <div className="flex flex-col gap-6 pb-8">

      {/* Header */}

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent p-6 border border-emerald-500/20 dark:from-emerald-500/20 dark:via-teal-500/10 dark:border-emerald-500/30 shadow-sm">

        <div className="flex items-center gap-4">

          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-500/30">
            <FiCreditCard className="h-6 w-6" />
          </div>

          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Liabilities
            </h1>

            <p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-300">
              Track loans, mortgages, and other outstanding debts.
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
          <span className="relative">Add Liability</span>
        </button>

      </header>


      {/* Total Outstanding Card */}

      <div className="relative overflow-hidden rounded-2xl border border-rose-600 bg-gradient-to-br from-rose-500 to-rose-700 p-5 shadow-lg shadow-rose-500/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl sm:w-80">

        <div className="text-sm font-medium tracking-wide text-rose-100">
          Total Outstanding Debt
        </div>

        <div className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-white">
          {formatINR(totalOutstanding)}
        </div>

        <FiCreditCard className="absolute -bottom-4 -right-4 h-24 w-24 text-rose-400/30" />

      </div>


      {/* Table */}

      <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white/80 shadow-lg backdrop-blur-md dark:border-slate-800/60 dark:bg-slate-900/50">

        <div className="overflow-x-auto custom-scrollbar">

          <table className="min-w-full text-left text-sm whitespace-nowrap">

            <thead className="border-b border-slate-200/60 bg-slate-50/50 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800/60 dark:bg-slate-800/30 dark:text-slate-400">
              <tr>
                <th className="px-5 py-4">Type</th>
                <th className="px-5 py-4">Liability Name</th>
                <th className="px-5 py-4 text-right">Outstanding Amount</th>
                <th className="px-5 py-4 text-right">Interest Rate</th>
                <th className="px-5 py-4 text-center">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100/60 dark:divide-slate-800/60">

              {liabilities.length === 0 ? (

                <tr>
                  <td className="px-5 py-10 text-center text-slate-500" colSpan={5}>
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="rounded-full bg-slate-100 p-3 dark:bg-slate-800">
                        <FiCreditCard className="h-6 w-6 text-slate-400" />
                      </div>
                      <p>No liabilities tracked yet.</p>
                    </div>
                  </td>
                </tr>

              ) : (

                liabilities.map((l) => (

                  <tr
                    key={l.id}
                    className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                  >

                    <td className="px-5 py-4">
                      <span className="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {l.type}
                      </span>
                    </td>

                    <td className="px-5 py-4 font-bold text-slate-900 dark:text-slate-50">
                      {l.name}
                    </td>

                    <td className="px-5 py-4 text-right font-bold tabular-nums text-rose-600 dark:text-rose-400">
                      {formatINR(l.outstanding)}
                    </td>

                    <td className="px-5 py-4 text-right font-medium tabular-nums text-slate-700 dark:text-slate-200">
                      {l.interestRate ? `${l.interestRate}%` : '—'}
                    </td>

                    <td className="px-5 py-4">

                      <div className="flex justify-center gap-2">

                        <button
                          type="button"
                          title="Edit"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400"
                          onClick={() => setEditId(l.id)}
                        >
                          <FiEdit2 className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          title="Delete"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                          onClick={() => openDeleteModal(l.id)}
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


      {/* Create Modal */}

      <UpsertLiabilityModal
        open={open}
        onClose={() => setOpen(false)}
        mode="create"
      />

      {/* Edit Modal */}

      {edit ? (

        <UpsertLiabilityModal
          open={!!edit}
          onClose={() => setEditId(null)}
          mode="edit"
          liability={edit}
        />

      ) : null}


      {/* Delete Confirmation Modal */}

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="⚠ Confirm Data Deletion"
      >

        <div className="space-y-6">

          <p className="text-sm text-slate-400">
            This will delete the liability permanently.
          </p>

          <div className="flex justify-end gap-3 border-t border-slate-800 pt-5">

            <button
              onClick={() => setDeleteOpen(false)}
              className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-400 hover:bg-slate-800"
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