// src/components/investments/InvestmentsTable.tsx
import { useMemo, useState } from 'react'
import type { Investment } from '../../types/investmentTypes'
import { currentValue, investedValue, typeLabel } from '../../utils/calculations'
import { formatINR } from '../../utils/format'
import { usePortfolioStore } from '../../store/portfolioStore'
import { UpsertInvestmentModal } from './UpsertInvestmentModal'
import { useStockMetadata } from '../../hooks/useStockMetadata'
import type { MarketCapCategory } from '../../services/stockMetadataService'

const CAP_STYLE: Record<MarketCapCategory | string, string> = {
  'Large Cap':       'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  'Mid Cap':         'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  'Small Cap':       'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  'Large & Mid Cap': 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  'Multi Cap':       'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
  'Hybrid':          'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  'Debt':            'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'Unknown':         'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
}

function Badge({ text, cls }: { text: string; cls: string }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`}>{text}</span>
}

export function InvestmentsTable({ investments }: { investments: Investment[] }) {
  const deleteInvestment = usePortfolioStore((s) => s.deleteInvestment)
  const [edit, setEdit] = useState<Investment | null>(null)

  // Pass full investments — hook handles all types by inv.id
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
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-300">
              <tr>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Platform</th>
                <th className="px-4 py-3">Sector / Cap</th>
                <th className="px-4 py-3 text-right">Invested</th>
                <th className="px-4 py-3 text-right">Current</th>
                <th className="px-4 py-3 text-right">P/L</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.length === 0 ? (
                <tr><td className="px-4 py-6 text-center text-slate-500" colSpan={8}>No investments found.</td></tr>
              ) : rows.map(({ inv, invested, current, pl, plPct }) => {
                const meta = metadata.get(inv.id)
                const showMeta = inv.type !== 'fixed_deposit' && inv.type !== 'bond' && inv.type !== 'other'
                // Manual sector for stocks wins over API
                const sectorLabel = (inv.type === 'stock' && (inv.sector ?? '').trim())
                  ? inv.sector!
                  : (meta?.sector && meta.sector !== 'Unknown' ? meta.sector : '')
                const capCat = meta?.marketCapCategory

                return (
                  <tr key={inv.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/60">
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{typeLabel(inv.type)}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900 dark:text-slate-50">{inv.name}</div>
                      {inv.symbol ? <div className="text-xs text-slate-400">{inv.symbol}</div> : null}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{inv.platform ?? '—'}</td>
                    <td className="px-4 py-3">
                      {showMeta && isLoading && !meta ? (
                        <span className="inline-flex gap-1">
                          <span className="h-4 w-16 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
                        </span>
                      ) : showMeta ? (
                        <div className="flex flex-wrap gap-1">
                          {sectorLabel && <Badge text={sectorLabel} cls="bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" />}
                          {capCat && capCat !== 'Unknown' && <Badge text={capCat} cls={CAP_STYLE[capCat] ?? CAP_STYLE['Unknown']} />}
                          {!sectorLabel && (!capCat || capCat === 'Unknown') && <span className="text-slate-400 text-xs">—</span>}
                        </div>
                      ) : <span className="text-slate-400 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-slate-900 dark:text-slate-50">{formatINR(invested)}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-slate-900 dark:text-slate-50">{formatINR(current)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <div className={pl >= 0 ? 'font-semibold text-emerald-600' : 'font-semibold text-rose-600'}>{pl >= 0 ? '+' : ''}{formatINR(pl)}</div>
                      <div className="text-xs text-slate-400">{plPct >= 0 ? '+' : ''}{plPct.toFixed(2)}%</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" onClick={() => setEdit(inv)}>Edit</button>
                        <button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 dark:border-slate-700 dark:bg-slate-800" onClick={() => { if (confirm('Delete this investment?')) void deleteInvestment(inv.id) }}>Delete</button>
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