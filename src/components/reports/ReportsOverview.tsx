import { useMemo } from 'react'
import { usePortfolioStore } from '../../store/portfolioStore'
import { summarizePortfolio, typeLabel } from '../../utils/calculations'
import { formatINR } from '../../utils/format'
import { exportCSV, exportExcel } from '../../utils/exportUtils'
import { Card } from '../ui/Card'
import { FiDownload, FiPieChart, FiTrendingUp, FiDollarSign } from 'react-icons/fi'

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
      <Card title={<div className="flex items-center gap-2"><FiTrendingUp className="text-emerald-500"/> Portfolio Summary</div>}>
        <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-5">
          A high-level overview of your current portfolio value and total performance metrics.
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
            <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Total Asset Value</span>
            <span className="text-lg font-bold tabular-nums text-slate-900 dark:text-slate-50">{formatINR(summary.totalValue)}</span>
          </div>
          <div className="flex justify-between items-center rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
            <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Total Invested Capital</span>
            <span className="text-lg font-bold tabular-nums text-slate-900 dark:text-slate-50">{formatINR(summary.investedTotal)}</span>
          </div>
          <div className="flex justify-between items-center rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
            <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Net Profit / Loss</span>
            <span className={`text-lg font-bold tabular-nums ${summary.profitLossTotal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {summary.profitLossTotal >= 0 ? '+' : ''}
              {formatINR(summary.profitLossTotal)}
            </span>
          </div>
        </div>
      </Card>

      <Card title={<div className="flex items-center gap-2"><FiDownload className="text-indigo-500"/> Data Exports</div>}>
        <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-5">
          Download your complete investment dataset for external analysis. Includes computed invested, current, and P&L fields.
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            className="group flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200/80 bg-white/50 px-4 py-3 text-sm font-semibold text-slate-700 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-sm dark:border-slate-700/80 dark:bg-slate-900/50 dark:text-slate-200 dark:hover:bg-slate-800"
            onClick={() => exportCSV(investments)}
          >
            <FiDownload className="h-4 w-4 text-slate-400 group-hover:text-emerald-500 transition-colors" />
            <span>Export as CSV</span>
          </button>
          <button
            type="button"
            className="group flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200/80 bg-white/50 px-4 py-3 text-sm font-semibold text-slate-700 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-sm dark:border-slate-700/80 dark:bg-slate-900/50 dark:text-slate-200 dark:hover:bg-slate-800"
            onClick={() => exportExcel(investments)}
          >
            <FiDownload className="h-4 w-4 text-slate-400 group-hover:text-emerald-500 transition-colors" />
            <span>Export as Excel</span>
          </button>
        </div>
      </Card>

      <Card title={<div className="flex items-center gap-2"><FiPieChart className="text-purple-500"/> Asset Allocation</div>}>
        {allocation.length === 0 ? (
          <div className="flex h-32 items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <span className="text-sm font-medium text-slate-500">Add investments to see allocation breakdown.</span>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {allocation.map((a) => (
              <div key={a.type} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-3 transition-colors hover:bg-slate-50 dark:border-slate-800/50 dark:bg-slate-800/30 dark:hover:bg-slate-800/80">
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">{typeLabel(a.type as any)}</div>
                <div className="font-bold tabular-nums text-slate-900 dark:text-slate-50">{formatINR(a.current)}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title={<div className="flex items-center gap-2"><FiDollarSign className="text-amber-500"/> Interest Earnings</div>}>
         <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-5">
          Expected fixed-income returns based on your current bond and FD holdings.
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
            <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Bonds Expected Interest</span>
            <span className="font-bold tabular-nums text-slate-900 dark:text-slate-50">{formatINR(summary.expectedInterest.bonds)}</span>
          </div>
          <div className="flex justify-between items-center rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
            <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">FDs Expected Interest</span>
            <span className="font-bold tabular-nums text-slate-900 dark:text-slate-50">{formatINR(summary.expectedInterest.fds)}</span>
          </div>
          <div className="flex justify-between items-center rounded-xl bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/20 p-4 mt-2 dark:from-amber-500/20 dark:border-amber-500/30">
            <span className="text-sm font-bold text-amber-700 dark:text-amber-400">Total Expected Interest</span>
            <span className="text-lg font-black tabular-nums text-amber-600 dark:text-amber-400">{formatINR(summary.expectedInterest.total)}</span>
          </div>
        </div>
      </Card>
    </div>
  )
}