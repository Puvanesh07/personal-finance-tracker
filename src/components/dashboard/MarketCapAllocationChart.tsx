// src/components/dashboard/MarketCapAllocationChart.tsx
import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { usePortfolioStore } from '../../store/portfolioStore'
import { useStockMetadata } from '../../hooks/useStockMetadata'
import { currentValue } from '../../utils/calculations'
import { formatINR } from '../../utils/format'
import { Card } from '../ui/Card'
import { FiRefreshCw } from 'react-icons/fi'
import type { MarketCapCategory } from '../../services/stockMetadataService'

const CAP_COLORS: Record<string, string> = {
  'Large Cap':       '#6366F1',
  'Mid Cap':         '#0EA5E9',
  'Small Cap':       '#22C55E',
  'Large & Mid Cap': '#F97316',
  'Multi Cap':       '#EC4899',
  'Hybrid':          '#14B8A6',
  'Debt':            '#F59E0B',
  'Unknown':         '#94A3B8',
}

const CAP_BG: Record<string, string> = {
  'Large Cap':       'rgba(99,102,241,0.12)',
  'Mid Cap':         'rgba(14,165,233,0.12)',
  'Small Cap':       'rgba(34,197,94,0.12)',
  'Large & Mid Cap': 'rgba(249,115,22,0.12)',
  'Multi Cap':       'rgba(236,72,153,0.12)',
  'Hybrid':          'rgba(20,184,166,0.12)',
  'Debt':            'rgba(245,158,11,0.12)',
  'Unknown':         'rgba(148,163,184,0.08)',
}

const PILL_CATS: MarketCapCategory[] = ['Large Cap', 'Mid Cap', 'Small Cap']

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const { name, value, pct, stocks } = payload[0].payload
  return (
    <div style={{ borderRadius: 12, border: '1px solid #334155', backgroundColor: '#0F172A', color: '#E5E7EB', padding: '8px 12px', fontSize: 13 }}>
      <div style={{ fontWeight: 600, marginBottom: 2 }}>{name}</div>
      <div>{formatINR(value)}</div>
      <div style={{ color: CAP_COLORS[name] ?? '#6366F1', fontWeight: 500 }}>{pct}%</div>
      <div style={{ color: '#94A3B8', fontSize: 11 }}>{stocks} holding{stocks !== 1 ? 's' : ''}</div>
    </div>
  )
}

export function MarketCapAllocationChart() {
  const investments = usePortfolioStore((s) => s.investments)
  const { metadata, isLoading, refresh } = useStockMetadata(investments)

  const { chartData, pills } = useMemo(() => {
    const capMap = new Map<string, { value: number; count: number }>()

    for (const inv of investments) {
      if (inv.type === 'fixed_deposit' || inv.type === 'bond') continue
      const meta = metadata.get(inv.id)
      const cat  = meta?.marketCapCategory ?? 'Unknown'
      const prev = capMap.get(cat) ?? { value: 0, count: 0 }
      capMap.set(cat, { value: prev.value + currentValue(inv), count: prev.count + 1 })
    }

    const total = Array.from(capMap.values()).reduce((a, b) => a + b.value, 0)
    const allData = Array.from(capMap.entries())
      .filter(([, v]) => v.value > 0)
      .map(([cat, { value, count }]) => ({
        name: cat, value, stocks: count,
        pct: total > 0 ? ((value / total) * 100).toFixed(1) : '0.0',
      }))
      .sort((a, b) => b.value - a.value)

    const pillsData = PILL_CATS.map((cat) => {
      const d = allData.find((x) => x.name === cat)
      return { cat, pct: d?.pct ?? '0.0', stocks: d?.stocks ?? 0 }
    })

    return { chartData: allData, pills: pillsData }
  }, [investments, metadata])

  const pendingCount = investments.filter(
    (inv) => inv.type !== 'fixed_deposit' && inv.type !== 'bond' && !metadata.has(inv.id)
  ).length

  return (
    <Card
      title="Market cap allocation"
      right={
        <button type="button" onClick={refresh}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-500 hover:text-emerald-500 transition-colors">
          <FiRefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? `Fetching ${pendingCount}…` : 'Refresh'}
        </button>
      }
    >
      {investments.length === 0 ? (
        <div className="grid h-40 place-items-center text-sm text-slate-500">Add investments to see market cap breakdown.</div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Summary pills */}
          <div className="grid grid-cols-3 gap-2">
            {pills.map(({ cat, pct, stocks }) => (
              <div key={cat} className="rounded-xl p-3 flex flex-col gap-0.5"
                style={{ backgroundColor: CAP_BG[cat], border: `1px solid ${CAP_COLORS[cat]}33` }}>
                <span className="text-[11px] font-semibold" style={{ color: CAP_COLORS[cat] }}>{cat}</span>
                <span className="text-xl font-bold text-slate-900 dark:text-slate-50 tabular-nums">{pct}%</span>
                <span className="text-xs text-slate-500">{stocks} holding{stocks !== 1 ? 's' : ''}</span>
              </div>
            ))}
          </div>

          {/* Bar chart */}
          {chartData.length > 0 && (
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barCategoryGap="30%">
                  <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {chartData.map((e) => <Cell key={e.name} fill={CAP_COLORS[e.name] ?? '#94A3B8'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Breakdown list */}
          <div className="flex flex-col gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
            {chartData.map((e) => (
              <div key={e.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: CAP_COLORS[e.name] ?? '#94A3B8' }} />
                  <span className="text-slate-700 dark:text-slate-300">{e.name}</span>
                  <span className="text-xs text-slate-400">({e.stocks})</span>
                </div>
                <div className="flex items-center gap-3 tabular-nums">
                  <span className="text-slate-500 text-xs">{formatINR(e.value)}</span>
                  <span className="font-semibold text-sm" style={{ color: CAP_COLORS[e.name] ?? '#94A3B8' }}>{e.pct}%</span>
                </div>
              </div>
            ))}
          </div>

          {isLoading && pendingCount > 0 && (
            <p className="text-xs text-slate-400 animate-pulse text-center">{pendingCount} holdings still loading…</p>
          )}
        </div>
      )}
    </Card>
  )
}