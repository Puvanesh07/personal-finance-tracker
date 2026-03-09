// src/components/investments/InvestmentsTable.tsx
import { useMemo, useState } from 'react'
import { FiEdit2, FiTrash2, FiSearch, FiMoreVertical } from 'react-icons/fi'
import { usePortfolioStore } from '../../store/portfolioStore'
import { useStockMetadata } from '../../hooks/useStockMetadata'
import { formatINR } from '../../utils/format'
import { currentValue, investedValue, typeLabel } from '../../utils/calculations'
import { UpsertInvestmentModal } from './UpsertInvestmentModal'

export function InvestmentsTable({ investments }: { investments: any[] }) {
  const deleteInvestment = usePortfolioStore((s) => s.deleteInvestment)
  const [edit, setEdit] = useState<any | null>(null)
  const { metadata } = useStockMetadata(investments)

  const rows = useMemo(() => investments.map((inv) => ({
    inv,
    invested: investedValue(inv),
    current: currentValue(inv),
    pl: currentValue(inv) - investedValue(inv),
    plPct: investedValue(inv) > 0 ? ((currentValue(inv) - investedValue(inv)) / investedValue(inv)) * 100 : 0
  })), [investments])

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 rounded-2xl border border-dashed border-slate-800 bg-slate-900/20 text-slate-500">
        <FiSearch className="h-8 w-8 mb-2 opacity-20" />
        <p className="text-sm font-medium">No assets found</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* MOBILE VIEW: Card List (Hidden on md+) */}
      <div className="flex flex-col gap-3 md:hidden">
        {rows.map(({ inv, invested, current, pl, plPct }) => (
          <div key={inv.id} className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl flex flex-col gap-3">
            <div className="flex justify-between items-start">
              <div className="max-w-[70%]">
                {/* Tooltip implementation for truncated names */}
                <h3 className="font-semibold text-slate-50 truncate text-sm" title={inv.name}>
                  {inv.name}
                </h3>
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">{inv.platform || 'Direct'}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEdit(inv)} className="p-2 text-slate-400 bg-slate-800 rounded-lg"><FiEdit2 size={14}/></button>
                <button onClick={() => deleteInvestment(inv.id)} className="p-2 text-rose-400 bg-rose-500/10 rounded-lg"><FiTrash2 size={14}/></button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/50">
              <div>
                <p className="text-[10px] text-slate-500 font-medium">Current Value</p>
                <p className="text-sm font-bold text-white">{formatINR(current)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-slate-500 font-medium">Returns</p>
                <p className={`text-sm font-bold ${pl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {pl >= 0 ? '+' : ''}{plPct.toFixed(2)}%
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* DESKTOP VIEW: Table (Hidden on small screens) */}
      <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-800/50 text-[11px] font-bold uppercase text-slate-500 tracking-wider">
              <tr>
                <th className="px-6 py-4">Asset</th>
                <th className="px-6 py-4">Platform</th>
                <th className="px-6 py-4 text-right">Invested</th>
                <th className="px-6 py-4 text-right">Current</th>
                <th className="px-6 py-4 text-right">P/L</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {rows.map(({ inv, invested, current, pl, plPct }) => (
                <tr key={inv.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4 max-w-[200px]">
                    <div className="font-semibold text-white truncate" title={inv.name}>{inv.name}</div>
                    <div className="text-[10px] text-slate-500 font-bold">{inv.symbol}</div>
                  </td>
                  <td className="px-6 py-4 text-slate-400 text-xs">{inv.platform}</td>
                  <td className="px-6 py-4 text-right text-slate-300 tabular-nums">{formatINR(invested)}</td>
                  <td className="px-6 py-4 text-right font-semibold text-white tabular-nums">{formatINR(current)}</td>
                  <td className={`px-6 py-4 text-right tabular-nums ${pl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    <div className="font-bold">{formatINR(pl)}</div>
                    <div className="text-[10px] opacity-80">{plPct.toFixed(2)}%</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center gap-2">
                      <button onClick={() => setEdit(inv)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"><FiEdit2 size={14}/></button>
                      <button onClick={() => deleteInvestment(inv.id)} className="p-2 hover:bg-rose-500/10 rounded-lg text-slate-400 hover:text-rose-400 transition-colors"><FiTrash2 size={14}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {edit && <UpsertInvestmentModal open={!!edit} onClose={() => setEdit(null)} mode="edit" investment={edit} />}
    </div>
  )
}