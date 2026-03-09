import { useMemo } from 'react'
import { Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { usePortfolioStore } from '../../store/portfolioStore'
import { summarizePortfolio, typeLabel } from '../../utils/calculations'
import { Card } from '../ui/Card'
import { formatINR } from '../../utils/format'

const COLORS = ['#6366F1', '#22C55E', '#F97316', '#0EA5E9', '#EC4899']

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
    <Card title="Portfolio distribution">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[220px_1fr]">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={2}
                isAnimationActive
                animationDuration={700}
              />
              <Tooltip
                formatter={(value: any) => formatINR(Number(value))}
                contentStyle={{
                  borderRadius: 12,
                  borderColor: '#CBD5F5',
                  backgroundColor: '#0F172A',
                  color: '#222222',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-900/40">
          {data.length === 0 ? (
            <div className="text-sm text-slate-600 dark:text-slate-400">Add investments to see allocation.</div>
          ) : (
            data.map((d) => (
              <div key={d.type} className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ background: d.fill }}
                  />
                  <span className="font-medium text-slate-900 dark:text-slate-100">{d.name}</span>
                </div>
                <div className="font-semibold tabular-nums text-slate-900 dark:text-slate-50">
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

