import { useMemo } from 'react'
import { Pie, PieChart, ResponsiveContainer, Tooltip, Cell } from 'recharts'
import { usePortfolioStore } from '../../store/portfolioStore'
import { summarizePortfolio, typeLabel } from '../../utils/calculations'
import { Card } from '../ui/Card'
import { formatINR } from '../../utils/format'

const COLORS = ['#0f172a', '#1d4ed8', '#0ea5e9', '#10b981', '#f97316']

export function AllocationCharts() {
  const investments = usePortfolioStore((s) => s.investments)
  const summary = useMemo(() => summarizePortfolio(investments), [investments])

  const data = useMemo(() => {
    const entries = Object.entries(summary.byType).map(([type, v]) => ({
      type,
      name: typeLabel(type as any),
      value: v.current,
    }))
    return entries.filter((x) => x.value > 0)
  }, [summary.byType])

  return (
    <Card title="Portfolio distribution">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[220px_1fr]">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                {data.map((_, idx) => (
                  <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: any) => formatINR(Number(value))}
                contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="flex flex-col gap-2">
          {data.length === 0 ? (
            <div className="text-sm text-slate-600">Add investments to see allocation.</div>
          ) : (
            data.map((d, idx) => (
              <div key={d.type} className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ background: COLORS[idx % COLORS.length] }}
                  />
                  <span className="text-slate-700">{d.name}</span>
                </div>
                <div className="font-medium tabular-nums">{formatINR(d.value)}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </Card>
  )
}

