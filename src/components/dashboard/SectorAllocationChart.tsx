// src/components/dashboard/SectorAllocationChart.tsx
import { useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { usePortfolioStore } from '../../store/portfolioStore'
import { useStockMetadata } from '../../hooks/useStockMetadata'
import { currentValue } from '../../utils/calculations'
import { formatINR } from '../../utils/format'
import { Card } from '../ui/Card'
import { FiRefreshCw } from 'react-icons/fi'

const COLORS = ['#6366F1','#22C55E','#0EA5E9','#F97316','#EC4899','#14B8A6','#F59E0B','#4ADE80','#A78BFA','#FB7185','#34D399','#60A5FA']

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const { name, value, pct } = payload[0].payload
  return (
    <div style={{ borderRadius: 12, border: '1px solid #334155', backgroundColor: '#0F172A', color: '#E5E7EB', padding: '8px 12px', fontSize: 13 }}>
      <div style={{ fontWeight: 600, marginBottom: 2 }}>{name}</div>
      <div>{formatINR(value)}</div>
      <div style={{ color: '#6366F1', fontWeight: 500 }}>{pct}%</div>
    </div>
  )
}

export function SectorAllocationChart() {
  const investments = usePortfolioStore((s) => s.investments)
  // Pass ALL investments — hook handles stocks, mutual funds, ETFs
  const { metadata, isLoading, refresh } = useStockMetadata(investments)

  const data = useMemo(() => {
    const bySector = new Map<string, number>()
    for (const inv of investments) {
      if (inv.type === 'fixed_deposit' || inv.type === 'bond') continue
      // Manual sector wins first
      let sector = inv.type === 'stock' ? (inv.sector ?? '').trim() : ''
      // Then fetched metadata (keyed by investment id)
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
      title="Sector allocation"
      right={
        <button type="button" onClick={refresh}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-500 hover:text-emerald-500 transition-colors">
          <FiRefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? `Fetching ${pendingCount}…` : 'Refresh'}
        </button>
      }
    >
      {data.length === 0 ? (
        <div className="grid h-72 place-items-center text-sm text-slate-500 dark:text-slate-400">
          {isLoading ? 'Fetching sector data…' : 'Add investments to see sector allocation.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[220px_1fr]">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2} isAnimationActive animationDuration={700}>
                  {data.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-900/40 overflow-y-auto max-h-56">
            {data.map((d, idx) => (
              <div key={d.name} className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: COLORS[idx % COLORS.length] }} />
                  <span className="truncate font-medium text-slate-900 dark:text-slate-100">{d.name}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2 tabular-nums">
                  <span className="text-xs text-slate-500">{d.pct}%</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-50">{formatINR(d.value)}</span>
                </div>
              </div>
            ))}
            {isLoading && pendingCount > 0 && (
              <p className="text-xs text-slate-400 animate-pulse">{pendingCount} more loading…</p>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}