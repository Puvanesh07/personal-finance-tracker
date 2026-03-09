import { useMemo } from 'react'
import { usePortfolioStore } from '../../store/portfolioStore'
import { summarizePortfolio, typeLabel } from '../../utils/calculations'
import { formatINR } from '../../utils/format'
import { exportCSV, exportExcel } from '../../utils/exportUtils'
import { Card } from '../ui/Card'

export function ReportsOverview() {
  const investments = usePortfolioStore((s) => s.investments)
  const summary = useMemo(() => summarizePortfolio(investments), [investments])

  const allocation = useMemo(
    () =>
      (Object.keys(summary.byType) as Array<keyof typeof summary.byType>)
        .map((t) => ({ type: t, current: summary.byType[t].current }))
        .filter((x) => x.current > 0)
        .sort((a, b) => b.current - a.current),
    [summary.byType],
  )

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card title="Monthly summary (basic)">
        <div className="text-sm text-slate-600">
          This frontend-only version stores snapshots daily. As you use the app over time, you can extend this card into
          true month-by-month reporting.
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-slate-600">Total value</span>
            <span className="font-semibold tabular-nums">{formatINR(summary.totalValue)}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-slate-600">Invested</span>
            <span className="font-semibold tabular-nums">{formatINR(summary.investedTotal)}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-slate-600">Profit / Loss</span>
            <span className={summary.profitLossTotal >= 0 ? 'font-semibold text-emerald-600' : 'font-semibold text-rose-600'}>
              {summary.profitLossTotal >= 0 ? '+' : ''}
              {formatINR(summary.profitLossTotal)}
            </span>
          </div>
        </div>
      </Card>

      <Card title="Exports">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => exportCSV(investments)}
          >
            Export CSV
          </button>
          <button
            type="button"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => exportExcel(investments)}
          >
            Export Excel
          </button>
        </div>
        <div className="mt-4 text-xs text-slate-500">Includes investments + computed invested/current/P&amp;L fields.</div>
      </Card>

      <Card title="Asset allocation report">
        {allocation.length === 0 ? (
          <div className="text-sm text-slate-600">Add investments to see allocation.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {allocation.map((a) => (
              <div key={a.type} className="flex items-center justify-between gap-3 text-sm">
                <div className="text-slate-700">{typeLabel(a.type as any)}</div>
                <div className="font-semibold tabular-nums">{formatINR(a.current)}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Interest earnings report">
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-slate-600">Bond expected interest</span>
            <span className="font-semibold tabular-nums">{formatINR(summary.expectedInterest.bonds)}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-slate-600">FD interest earned</span>
            <span className="font-semibold tabular-nums">{formatINR(summary.expectedInterest.fds)}</span>
          </div>
          <div className="flex justify-between gap-3 border-t border-slate-100 pt-2">
            <span className="text-slate-700">Total</span>
            <span className="font-semibold tabular-nums">{formatINR(summary.expectedInterest.total)}</span>
          </div>
        </div>
      </Card>
    </div>
  )
}

