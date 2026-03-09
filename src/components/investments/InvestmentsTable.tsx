import { useMemo, useState } from 'react'
import type { Investment } from '../../types/investmentTypes'
import { currentValue, investedValue, typeLabel } from '../../utils/calculations'
import { formatINR } from '../../utils/format'
import { usePortfolioStore } from '../../store/portfolioStore'
import { UpsertInvestmentModal } from './UpsertInvestmentModal'
import { useStockMetadata } from '../../hooks/useStockMetadata'
import type { MarketCapCategory } from '../../services/stockMetadataService'
import { FiEdit2, FiSearch, FiTrash2 } from 'react-icons/fi'

const CAP_STYLE: Record<MarketCapCategory | string, string> = {
  'Large Cap':       'bg-indigo-50 text-indigo-700 border-indigo-200/60 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/20',
  'Mid Cap':         'bg-sky-50 text-sky-700 border-sky-200/60 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/20',
  'Small Cap':       'bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20',
  'Large & Mid Cap': 'bg-orange-50 text-orange-700 border-orange-200/60 dark:bg-orange-500/10 dark:text-orange-300 dark:border-orange-500/20',
  'Multi Cap':       'bg-pink-50 text-pink-700 border-pink-200/60 dark:bg-pink-500/10 dark:text-pink-300 dark:border-pink-500/20',
  'Hybrid':          'bg-teal-50 text-teal-700 border-teal-200/60 dark:bg-teal-500/10 dark:text-teal-300 dark:border-teal-500/20',
  'Debt':            'bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20',
  'Unknown':         'bg-slate-50 text-slate-500 border-slate-200/60 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20',
}

function Badge({ text, cls }: { text: string; cls: string }) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${cls}`}>{text}</span>
}

export function InvestmentsTable({ investments }: { investments: Investment[] }) {
  const deleteInvestment = usePortfolioStore((s) => s.deleteInvestment)
  const [edit, setEdit] = useState<Investment | null>(null)

  const { metadata, isLoading } = useStockMetadata(investments)

  const rows = useMemo(() => investments.map((inv) => {
    const invested = investedValue(inv)
    const current  = currentValue(inv)
    const pl       = current - invested
    const plPct    = invested > 0 ? (pl / invested) * 100 : 0
    return { inv, invested, current, pl, plPct }
  }), [investments])

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white/80 shadow-lg backdrop-blur-md dark:border-slate-800/60 dark:bg-slate-900/50">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="min-w-full text-left text-sm whitespace-nowrap">
            <thead className="border-b border-slate-200/60 bg-slate-50/50 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800/60 dark:bg-slate-800/30 dark:text-slate-400">
              <tr>
                <th className="px-5 py-4">Type</th>
                <th className="px-5 py-4">Asset Name</th>
                <th className="px-5 py-4">Platform</th>
                <th className="px-5 py-4">Sector / Cap</th>
                <th className="px-5 py-4 text-right">Invested</th>
                <th className="px-5 py-4 text-right">Current Value</th>
                <th className="px-5 py-4 text-right">Returns (P/L)</th>
                <th className="px-5 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/60 dark:divide-slate-800/60">
              {rows.length === 0 ? (
                <tr>
                  <td className="px-5 py-10 text-center text-slate-500" colSpan={8}>
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="rounded-full bg-slate-100 p-3 dark:bg-slate-800">
                        <FiSearch className="h-6 w-6 text-slate-400" />
                      </div>
                      <p>No investments found matching your criteria.</p>
                    </div>
                  </td>
                </tr>
              ) : rows.map(({ inv, invested, current, pl, plPct }) => {
                const meta = metadata.get(inv.id)
                const showMeta = inv.type !== 'fixed_deposit' && inv.type !== 'bond' && inv.type !== 'other'
                const sectorLabel = (inv.type === 'stock' && (inv.sector ?? '').trim())
                  ? inv.sector!
                  : (meta?.sector && meta.sector !== 'Unknown' ? meta.sector : '')
                const capCat = meta?.marketCapCategory

                return (
                  <tr key={inv.id} className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-4">
                      <span className="font-medium text-slate-600 dark:text-slate-300">{typeLabel(inv.type)}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-bold text-slate-900 dark:text-slate-50">{inv.name}</div>
                      {inv.symbol ? <div className="mt-0.5 text-xs font-medium text-slate-400">{inv.symbol}</div> : null}
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {inv.platform ?? 'Unknown'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {showMeta && isLoading && !meta ? (
                        <div className="flex gap-2">
                          <span className="h-5 w-16 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
                          <span className="h-5 w-20 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
                        </div>
                      ) : showMeta ? (
                        <div className="flex flex-wrap gap-1.5">
                          {sectorLabel && <Badge text={sectorLabel} cls="bg-violet-50 text-violet-700 border-violet-200/60 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/20" />}
                          {capCat && capCat !== 'Unknown' && <Badge text={capCat} cls={CAP_STYLE[capCat] ?? CAP_STYLE['Unknown']} />}
                          {!sectorLabel && (!capCat || capCat === 'Unknown') && <span className="text-slate-400 text-sm">—</span>}
                        </div>
                      ) : <span className="text-slate-400 text-sm">—</span>}
                    </td>
                    <td className="px-5 py-4 text-right font-semibold tabular-nums text-slate-700 dark:text-slate-200">{formatINR(invested)}</td>
                    <td className="px-5 py-4 text-right font-bold tabular-nums text-slate-900 dark:text-slate-50">{formatINR(current)}</td>
                    <td className="px-5 py-4 text-right tabular-nums">
                      <div className={pl >= 0 ? 'font-bold text-emerald-600 dark:text-emerald-400' : 'font-bold text-rose-600 dark:text-rose-400'}>
                        {pl >= 0 ? '+' : ''}{formatINR(pl)}
                      </div>
                      <div className={`mt-0.5 text-xs font-semibold ${plPct >= 0 ? 'text-emerald-600/70 dark:text-emerald-400/70' : 'text-rose-600/70 dark:text-rose-400/70'}`}>
                        {plPct >= 0 ? '↑' : '↓'} {Math.abs(plPct).toFixed(2)}%
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-center gap-2">
                        <button 
                          type="button" 
                          title="Edit"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400" 
                          onClick={() => setEdit(inv)}
                        >
                          <FiEdit2 className="h-4 w-4" />
                        </button>
                        <button 
                          type="button" 
                          title="Delete"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400" 
                          onClick={() => { if (confirm('Are you sure you want to delete this investment? This action cannot be undone.')) void deleteInvestment(inv.id) }}
                        >
                          <FiTrash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      {edit && <UpsertInvestmentModal open={!!edit} onClose={() => setEdit(null)} mode="edit" investment={edit} />}
    </>
  )
}