import { useState } from 'react'
import { usePortfolioStore } from '../../store/portfolioStore'
import { formatINR } from '../../utils/format'
import type { NetWorthSnapshot } from '../../types/investmentTypes'

export function SnapshotsPage() {
  const snapshots = usePortfolioStore((s) => s.networthSnapshots)
  const takeNetWorthSnapshot = usePortfolioStore((s) => s.takeNetWorthSnapshot)

  const [label, setLabel] = useState('')

  async function handleTakeSnapshot() {
    await takeNetWorthSnapshot(label)
    setLabel('')
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Net worth snapshots</h1>
          <p className="text-sm text-slate-600">Freeze your net worth at key moments and review history.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="w-48 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400"
            placeholder="Label (optional)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <button
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            type="button"
            onClick={() => void handleTakeSnapshot()}
          >
            Take snapshot
          </button>
        </div>
      </header>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Taken at</th>
                <th className="px-4 py-3">Label</th>
                <th className="px-4 py-3 text-right">Assets</th>
                <th className="px-4 py-3 text-right">Liabilities</th>
                <th className="px-4 py-3 text-right">Net worth</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {snapshots.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-600" colSpan={5}>
                    No snapshots yet. Take your first snapshot to start history.
                  </td>
                </tr>
              ) : (
                snapshots.map((s: NetWorthSnapshot) => (
                  <tr key={s.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 text-slate-700">{new Date(s.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3 text-slate-700">{s.label ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      {formatINR(s.totalAssets)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      {formatINR(s.totalLiabilities)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">
                      {formatINR(s.netWorth)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

