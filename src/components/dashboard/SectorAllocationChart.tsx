import { useMemo } from 'react'
import { Pie, PieChart, ResponsiveContainer, Tooltip, Cell } from 'recharts'
import { usePortfolioStore } from '../../store/portfolioStore'
import { Card } from '../ui/Card'
import { currentValue } from '../../utils/calculations'
import { formatINR } from '../../utils/format'

const COLORS = ['#6366F1', '#22C55E', '#0EA5E9', '#F97316', '#EC4899', '#14B8A6', '#F59E0B', '#4ADE80']

export function SectorAllocationChart() {
  const investments = usePortfolioStore((s) => s.investments)

  const data = useMemo(() => {
    const bySector = new Map<string, number>()
    for (const inv of investments) {
      if (inv.type !== 'stock') continue
      const sector = (inv.sector ?? '').trim() || 'Uncategorized'
      bySector.set(sector, (bySector.get(sector) ?? 0) + currentValue(inv))
    }
    return Array.from(bySector.entries())
      .map(([sector, value]) => ({ sector, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12)
  }, [investments])

  return (
    <Card title="Equity sector allocation">
      <div className="h-72">
        {data.length === 0 ? (
          <div className="grid h-full place-items-center text-sm text-slate-600 dark:text-slate-400">
            Add stock sectors (Edit investment → Sector) or import from brokers with sector data to see this chart.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="sector"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                isAnimationActive
                animationDuration={700}
              >
                {data.map((_, idx) => (
                  <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: any) => formatINR(Number(v))}
                labelFormatter={(l: any) => `Sector: ${String(l)}`}
                contentStyle={{
                  borderRadius: 12,
                  borderColor: '#CBD5F5',
                  backgroundColor: '#0F172A',
                  color: '#E5E7EB',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  )
}

