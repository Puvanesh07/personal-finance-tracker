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
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          onClick={() => void recordSnapshotNow()}
        >
          Take snapshot
        </button>
      }
    >
      <div className="h-72">
        {data.length === 0 ? (
          <div className="grid h-full place-items-center text-sm text-slate-600">
            Add investments to start tracking daily portfolio snapshots.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
              <Tooltip
                formatter={(v: any) => formatINR(Number(v))}
                labelFormatter={(l: any) => `Date: ${String(l)}`}
                contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0' }}
              />
              <Line type="monotone" dataKey="value" stroke="#1d4ed8" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  )
}

