import { useMemo, useState } from 'react'
import type { Investment } from '../../types/investmentTypes'
import { currentValue, investedValue, typeLabel } from '../../utils/calculations'
import { formatINR } from '../../utils/format'
import { usePortfolioStore } from '../../store/portfolioStore'
import { UpsertInvestmentModal } from './UpsertInvestmentModal'

export function InvestmentsTable({ investments }: { investments: Investment[] }) {
  const deleteInvestment = usePortfolioStore((s) => s.deleteInvestment)
  const [edit, setEdit] = useState<Investment | null>(null)

  const rows = useMemo(() => {
    return investments.map((inv) => {
      const invested = investedValue(inv)
      const current = currentValue(inv)
      const pl = current - invested
      const plPct = invested > 0 ? (pl / invested) * 100 : 0
      return { inv, invested, current, pl, plPct }
    })
  }, [investments])

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-300">
              <tr>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Platform</th>
                <th className="px-4 py-3 text-right">Invested</th>
                <th className="px-4 py-3 text-right">Current</th>
                <th className="px-4 py-3 text-right">P/L</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-600 dark:text-slate-400" colSpan={7}>
                    No investments found.
                  </td>
                </tr>
              ) : (
                rows.map(({ inv, invested, current, pl, plPct }) => (
                  <tr key={inv.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/60">
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{typeLabel(inv.type)}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900 dark:text-slate-50">{inv.name}</div>
                      {inv.symbol ? <div className="text-xs text-slate-500 dark:text-slate-400">{inv.symbol}</div> : null}
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{inv.platform ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-slate-900 dark:text-slate-50">
                      {formatINR(invested)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-slate-900 dark:text-slate-50">
                      {formatINR(current)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <div className={pl >= 0 ? 'font-semibold text-emerald-600' : 'font-semibold text-rose-600'}>
                        {pl >= 0 ? '+' : ''}
                        {formatINR(pl)}
                      </div>
                      <div className="text-xs text-slate-500">{plPct >= 0 ? '+' : ''}{plPct.toFixed(2)}%</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          onClick={() => setEdit(inv)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                          onClick={() => {
                            if (confirm('Delete this investment?')) void deleteInvestment(inv.id)
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

      {edit ? (
        <UpsertInvestmentModal open={!!edit} onClose={() => setEdit(null)} mode="edit" investment={edit} />
      ) : null}
    </>
  )
}

