import { useState } from 'react'
import { usePortfolioStore } from '../../store/portfolioStore'
import { formatINR } from '../../utils/format'
import { UpsertLiabilityModal } from '../../components/liabilities/UpsertLiabilityModal'

export function LiabilitiesPage() {
  const liabilities = usePortfolioStore((s) => s.liabilities)
  const deleteLiability = usePortfolioStore((s) => s.deleteLiability)
  const totalOutstanding = liabilities.reduce((a, l) => a + (l.outstanding || 0), 0)

  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const edit = liabilities.find((l) => l.id === editId) ?? null

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Liabilities</h1>
          <p className="text-sm text-slate-600">Track loans and other outstanding amounts.</p>
        </div>
        <button
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          onClick={() => setOpen(true)}
          type="button"
        >
          Add liability
        </button>
      </header>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-xs font-medium text-slate-500">Total outstanding</div>
        <div className="mt-2 text-lg font-semibold tabular-nums">{formatINR(totalOutstanding)}</div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3 text-right">Outstanding</th>
                <th className="px-4 py-3 text-right">Interest</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {liabilities.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-600" colSpan={5}>
                    No liabilities yet.
                  </td>
                </tr>
              ) : (
                liabilities.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 text-slate-700">{l.type}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{l.name}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatINR(l.outstanding)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{l.interestRate ? `${l.interestRate}%` : '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          onClick={() => setEditId(l.id)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                          onClick={() => {
                            if (confirm('Delete this liability?')) void deleteLiability(l.id)
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

      <UpsertLiabilityModal open={open} onClose={() => setOpen(false)} mode="create" />
      {edit ? (
        <UpsertLiabilityModal
          open={!!edit}
          onClose={() => setEditId(null)}
          mode="edit"
          liability={edit}
        />
      ) : null}
    </div>
  )
}

