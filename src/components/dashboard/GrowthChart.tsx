import { useMemo } from 'react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { usePortfolioStore } from '../../store/portfolioStore'
import { Card } from '../ui/Card'
import { formatINR } from '../../utils/format'

export function GrowthChart() {
  const snapshots = usePortfolioStore((s) => s.snapshots)
  const recordSnapshotNow = usePortfolioStore((s) => s.recordSnapshotNow)

  const data = useMemo(() => snapshots.map((s) => ({ date: s.date, value: s.totalValue })), [snapshots])

  return (
    <Card
      title="Portfolio growth"
      right={
        <button
          type="button"
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          onClick={() => void recordSnapshotNow()}
        >
          Take snapshot
        </button>
      }
    >
      <div className="h-72">
        {data.length === 0 ? (
          <div className="grid h-full place-items-center text-sm text-slate-600 dark:text-slate-400">
            Add investments to start tracking daily portfolio snapshots.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6B7280' }} />
              <YAxis
                tick={{ fontSize: 12, fill: '#6B7280' }}
                tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`}
              />
              <Tooltip
                formatter={(v: any) => formatINR(Number(v))}
                labelFormatter={(l: any) => `Date: ${String(l)}`}
                contentStyle={{
                  borderRadius: 12,
                  borderColor: '#CBD5F5',
                  backgroundColor: '#0F172A',
                  color: '#E5E7EB',
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#6366F1"
                strokeWidth={2}
                dot={false}
                isAnimationActive
                animationDuration={700}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  )
}

