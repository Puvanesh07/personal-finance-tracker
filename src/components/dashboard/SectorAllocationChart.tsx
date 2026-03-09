import { useMemo, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { usePortfolioStore } from '../../store/portfolioStore'
import { useStockMetadata } from '../../hooks/useStockMetadata'
import { currentValue } from '../../utils/calculations'
import { formatINR } from '../../utils/format'
import { Card } from '../ui/Card'
import { FiRefreshCw, FiGrid } from 'react-icons/fi'

const COLORS = ['#6366F1','#10B981','#0EA5E9','#F59E0B','#EC4899','#14B8A6','#8B5CF6','#4ADE80','#F43F5E','#06B6D4','#EAB308','#3B82F6']

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const { name, value, pct } = payload[0].payload
  return (
    <div style={{ borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(8px)', color: '#F8FAFC', padding: '12px', fontSize: 13, boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)' }}>
      <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 14 }}>{name}</div>
      <div style={{ fontWeight: 600 }}>{formatINR(value)}</div>
      <div style={{ color: '#10B981', fontWeight: 800, marginTop: 2 }}>{pct}% of Equities</div>
    </div>
  )
}

export function SectorAllocationChart() {
  const investments = usePortfolioStore((s) => s.investments)
  const { metadata, isLoading, refresh } = useStockMetadata(investments)
  
  const [chartKey, setChartKey] = useState(0)

  const handleRefresh = () => {
    setChartKey(prev => prev + 1)
    refresh() 
  }

  const data = useMemo(() => {
    const bySector = new Map<string, number>()
    for (const inv of investments) {
      if (inv.type === 'fixed_deposit' || inv.type === 'bond') continue
      let sector = inv.type === 'stock' ? (inv.sector ?? '').trim() : ''
      if (!sector) {
        const meta = metadata.get(inv.id)
        sector = (meta?.sector && meta.sector !== 'Unknown') ? meta.sector : ''
      }
      sector = sector || 'Uncategorized'
      bySector.set(sector, (bySector.get(sector) ?? 0) + currentValue(inv))
    }
    const total = Array.from(bySector.values()).reduce((a, b) => a + b, 0)
    return Array.from(bySector.entries())
      .map(([name, value]) => ({ name, value, pct: total > 0 ? ((value / total) * 100).toFixed(1) : '0.0' }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12)
  }, [investments, metadata])

  const pendingCount = investments.filter(
    (inv) => inv.type !== 'fixed_deposit' && inv.type !== 'bond' && !metadata.has(inv.id)
  ).length

  return (
    <Card
      title={<div className="flex items-center gap-2"><FiGrid className="text-pink-500"/> Sector Spread</div>}
      right={
        <button type="button" onClick={handleRefresh}
          className="group flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-white/50 px-3 py-1.5 text-xs font-bold text-slate-600 transition-all hover:bg-slate-50 dark:border-slate-700/80 dark:bg-slate-900/50 dark:text-slate-300 dark:hover:bg-slate-800">
          <FiRefreshCw className={`h-3.5 w-3.5 text-slate-400 group-hover:text-emerald-500 transition-colors ${isLoading ? 'animate-spin text-emerald-500' : ''}`} />
          <span>{isLoading ? `Fetching ${pendingCount}…` : 'Refresh Data'}</span>
        </button>
      }
    >
      {data.length === 0 ? (
        <div className="grid h-72 place-items-center text-sm font-medium text-slate-500 dark:text-slate-400">
          {isLoading ? 'Fetching sector data…' : 'Add equities to see sector allocation.'}
        </div>
      ) : (
        /* Fixed Grid width using minmax(0, 1fr) to prevent horizontal overflow */
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[220px_minmax(0,1fr)] items-center">
          <div className="h-64 sm:h-full min-h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart key={chartKey}>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={3} stroke="none" isAnimationActive animationDuration={1000} animationEasing="ease-out">
                  {data.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          
          {/* Restored max height and vertical scrolling, forced hidden horizontal scroll */}
          <div className="flex flex-col gap-1 rounded-xl bg-slate-50/50 p-2 dark:bg-slate-900/20 w-full max-h-64 overflow-y-auto overflow-x-hidden custom-scrollbar pr-1.5">
            {data.map((d, idx) => (
              <div key={d.name} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-white dark:hover:bg-slate-800/60 transition-colors text-sm min-w-0">
                
                {/* min-w-0 and flex-1 allows the text to truncate without pushing width */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full shadow-sm" style={{ background: COLORS[idx % COLORS.length] }} />
                  <span className="truncate font-semibold text-slate-700 dark:text-slate-300" title={d.name}>{d.name}</span>
                </div>

                <div className="flex shrink-0 items-center gap-2.5 tabular-nums">
                  <span className="text-xs font-bold text-slate-400">{d.pct}%</span>
                  <span className="font-black text-slate-900 dark:text-slate-50">{formatINR(d.value)}</span>
                </div>
              </div>
            ))}
            {isLoading && pendingCount > 0 && (
              <p className="text-xs font-semibold text-emerald-500 animate-pulse text-center mt-2 py-2">{pendingCount} assets still loading…</p>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}