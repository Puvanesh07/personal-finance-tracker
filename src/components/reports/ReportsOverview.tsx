import { useEffect, useMemo, useState } from 'react'
import { usePortfolioStore } from '../../store/portfolioStore'
import { useExportPresetsStore } from '../../store/exportPresetsStore'
import { summarizePortfolio, typeLabel } from '../../utils/calculations'
import {
  ensureCsvExtension,
  ensureXlsxExtension,
  expandExportFilenamePattern,
} from '../../utils/exportFilename'
import { formatINR } from '../../utils/format'
import { exportExcel, exportInvestmentsCSV } from '../../utils/exportUtils'
import { Card } from '../ui/Card'
import { FiBookmark, FiDownload, FiPieChart, FiTrendingUp, FiDollarSign } from 'react-icons/fi'

const SCOPE_CSV = 'reports-investments-csv' as const
const SCOPE_XLSX = 'reports-investments-xlsx' as const

export function ReportsOverview() {
  const investments = usePortfolioStore((s) => s.investments)
  const presets = useExportPresetsStore((s) => s.presets)
  const addPreset = useExportPresetsStore((s) => s.addPreset)
  const removePreset = useExportPresetsStore((s) => s.removePreset)
  const rememberFilename = useExportPresetsStore((s) => s.rememberFilename)

  const [csvPattern, setCsvPattern] = useState('investments-{date}')
  const [xlsxPattern, setXlsxPattern] = useState('portfolio-{date}')

  useEffect(() => {
    const st = useExportPresetsStore.getState()
    const c = st.getLastFilename(SCOPE_CSV)
    const x = st.getLastFilename(SCOPE_XLSX)
    if (c) setCsvPattern(c)
    if (x) setXlsxPattern(x)
  }, [])

  const csvPresets = useMemo(
    () => presets.filter((p) => p.scope === SCOPE_CSV),
    [presets],
  )
  const xlsxPresets = useMemo(
    () => presets.filter((p) => p.scope === SCOPE_XLSX),
    [presets],
  )

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
        <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-4">
          Download your complete investment dataset for external analysis. Includes computed invested, current, and P&L fields. Use <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">{'{date}'}</code>, <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">{'{datetime}'}</code> in filenames.
        </div>
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/80 dark:bg-slate-800/40 p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">CSV filename</span>
              {csvPresets.map((p) => (
                <div
                  key={p.id}
                  className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 overflow-hidden"
                >
                  <button
                    type="button"
                    title={p.pattern}
                    onClick={() => setCsvPattern(p.pattern)}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-emerald-500/10"
                  >
                    <FiBookmark className="h-3 w-3 text-emerald-500" />
                    {p.label}
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove preset ${p.label}`}
                    onClick={() => removePreset(p.id)}
                    className="px-1.5 py-1 text-slate-400 hover:bg-rose-500/15 hover:text-rose-500 text-xs font-bold"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <input
              value={csvPattern}
              onChange={(e) => setCsvPattern(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-mono text-slate-800 dark:text-slate-100"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  const label = window.prompt('Name this CSV filename preset')
                  if (!label?.trim()) return
                  addPreset(SCOPE_CSV, label.trim(), csvPattern)
                }}
                className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                Save CSV preset
              </button>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/80 dark:bg-slate-800/40 p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Excel filename</span>
              {xlsxPresets.map((p) => (
                <div
                  key={p.id}
                  className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 overflow-hidden"
                >
                  <button
                    type="button"
                    title={p.pattern}
                    onClick={() => setXlsxPattern(p.pattern)}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-indigo-500/10"
                  >
                    <FiBookmark className="h-3 w-3 text-indigo-500" />
                    {p.label}
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove preset ${p.label}`}
                    onClick={() => removePreset(p.id)}
                    className="px-1.5 py-1 text-slate-400 hover:bg-rose-500/15 hover:text-rose-500 text-xs font-bold"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <input
              value={xlsxPattern}
              onChange={(e) => setXlsxPattern(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-mono text-slate-800 dark:text-slate-100"
            />
            <button
              type="button"
              onClick={() => {
                const label = window.prompt('Name this Excel filename preset')
                if (!label?.trim()) return
                addPreset(SCOPE_XLSX, label.trim(), xlsxPattern)
              }}
              className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Save Excel preset
            </button>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              className="group flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200/80 bg-white/50 px-4 py-3 text-sm font-semibold text-slate-600 dark:text-slate-700 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-sm dark:border-slate-700/80 dark:bg-slate-900/50 dark:text-slate-200 dark:hover:bg-slate-800"
              onClick={() => {
                const fn = ensureCsvExtension(expandExportFilenamePattern(csvPattern))
                exportInvestmentsCSV(investments, fn)
                rememberFilename(SCOPE_CSV, csvPattern)
              }}
            >
              <FiDownload className="h-4 w-4 text-slate-500 dark:text-slate-400 group-hover:text-emerald-500 transition-colors" />
              <span>Export as CSV</span>
            </button>
            <button
              type="button"
              className="group flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200/80 bg-white/50 px-4 py-3 text-sm font-semibold text-slate-600 dark:text-slate-700 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-sm dark:border-slate-700/80 dark:bg-slate-900/50 dark:text-slate-200 dark:hover:bg-slate-800"
              onClick={() => {
                const fn = ensureXlsxExtension(expandExportFilenamePattern(xlsxPattern))
                exportExcel(investments, fn)
                rememberFilename(SCOPE_XLSX, xlsxPattern)
              }}
            >
              <FiDownload className="h-4 w-4 text-slate-500 dark:text-slate-400 group-hover:text-emerald-500 transition-colors" />
              <span>Export as Excel</span>
            </button>
          </div>
        </div>
      </Card>

      <Card title={<div className="flex items-center gap-2"><FiPieChart className="text-purple-500"/> Asset Allocation</div>}>
        {allocation.length === 0 ? (
          <div className="flex h-32 items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <span className="text-sm font-medium text-slate-900 dark:text-slate-500">Add investments to see allocation breakdown.</span>
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