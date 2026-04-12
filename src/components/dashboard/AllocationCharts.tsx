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
    </Card>
  )
}