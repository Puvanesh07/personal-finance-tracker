import { useMemo } from 'react'
import { Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { usePortfolioStore } from '../../store/portfolioStore'
import { summarizePortfolio, typeLabel } from '../../utils/calculations'
import { Card } from '../ui/Card'
import { formatINR } from '../../utils/format'
import { FiPieChart } from 'react-icons/fi'

// Updated modern color palette
const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#0EA5E9', '#EC4899']

export function AllocationCharts() {
  const investments = usePortfolioStore((s) => s.investments)
  const summary = useMemo(() => summarizePortfolio(investments), [investments])

  const data = useMemo(() => {
    const entries = Object.entries(summary.byType)
      .map(([type, v]) => ({
        type,
        name: typeLabel(type as any),
        value: v.current,
      }))
      .filter((x) => x.value > 0)

    return entries.map((entry, idx) => ({
      ...entry,
      fill: COLORS[idx % COLORS.length],
    }))
  }, [summary.byType])

  const altAssetsData = useMemo(() => {
    const byAsset: Record<string, number> = {}
    for (const inv of investments) {
      if (inv.type !== 'other') continue
      const key = inv.assetType || 'other'
      byAsset[key] = (byAsset[key] || 0) + (inv.currentValue ?? 0)
    }
    const labels: Record<string, string> = {
      gold: 'Gold',
      silver: 'Silver',
      crypto: 'Crypto',
      real_estate: 'Real estate',
      ppf: 'PPF',
      nps: 'NPS',
      epf: 'EPF/PF',
      international_equity: 'Intl. equity',
      other: 'Other',
    }
    return Object.entries(byAsset)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v], idx) => ({
        key: k,
        name: labels[k] ?? k,
        value: v,
        fill: COLORS[idx % COLORS.length],
      }))
  }, [investments])

  return (
    <Card title={<div className="flex items-center gap-2"><FiPieChart className="text-indigo-500"/> Asset Distribution</div>}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[220px_1fr]">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={60}
                outerRadius={85}
                paddingAngle={3}
                isAnimationActive
                animationDuration={1000}
                stroke="none"
              />
              <Tooltip
                formatter={(value: any) => formatINR(Number(value))}
                contentStyle={{
                  borderRadius: 16,
                  border: '1px solid rgba(255,255,255,0.1)',
                  backgroundColor: 'rgba(15, 23, 42, 0.9)',
                  backdropFilter: 'blur(8px)',
                  color: '#F8FAFC',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                }}
                itemStyle={{ color: '#F8FAFC', fontWeight: 600 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="flex flex-col gap-2 rounded-xl bg-slate-50/50 p-3 dark:bg-slate-800/30">
          {data.length === 0 ? (
            <div className="grid h-full place-items-center text-sm font-medium text-slate-900 dark:text-slate-500">No assets to display.</div>
          ) : (
            data.map((d) => (
              <div key={d.type} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-white dark:hover:bg-slate-800/80">
                <div className="flex items-center gap-2.5">
                  <span
                    className="inline-block h-3 w-3 rounded-full shadow-sm"
                    style={{ background: d.fill }}
                  />
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{d.name}</span>
                </div>
                <div className="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-50">
                  {formatINR(d.value)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      {altAssetsData.length > 0 && (
        <div className='mt-4 rounded-xl border border-slate-200/70 dark:border-slate-700/60 p-3 bg-white/60 dark:bg-slate-900/30'>
          <h4 className='mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'>
            Gold, Silver & Other Asset Classes
          </h4>
          <div className='grid gap-2 sm:grid-cols-2'>
            {altAssetsData.map((a) => (
              <div
                key={a.key}
                className='flex items-center justify-between rounded-lg px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/50'
              >
                <div className='flex items-center gap-2'>
                  <span className='inline-block h-2.5 w-2.5 rounded-full' style={{ background: a.fill }} />
                  <span className='text-xs font-semibold text-slate-700 dark:text-slate-300'>{a.name}</span>
                </div>
                <span className='text-xs font-bold tabular-nums text-slate-900 dark:text-slate-100'>
                  {formatINR(a.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}