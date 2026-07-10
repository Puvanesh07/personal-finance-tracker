import { useMemo } from 'react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { usePortfolioStore } from '../../store/portfolioStore'
import { Card } from '../ui/Card'
import { formatINR } from '../../utils/format'
import { FiTrendingUp, FiCamera } from 'react-icons/fi'
import { useAsyncAction } from '../../hooks/useAsyncAction'
import { AsyncButton } from '../ui/AsyncButton'

export function GrowthChart() {
  const snapshots = usePortfolioStore((s) => s.snapshots)
  const recordSnapshotNow = usePortfolioStore((s) => s.recordSnapshotNow)
  const { busy, run } = useAsyncAction()

  const data = useMemo(() => snapshots.map((s) => ({ date: s.date, value: s.totalValue })), [snapshots])

  return (
    <Card
      title={<div className="flex items-center gap-2"><FiTrendingUp className="text-emerald-500"/> Portfolio Growth History</div>}
      right={
        <AsyncButton
          type="button"
          busy={busy}
          loadingLabel="Recording…"
          className="group flex items-center gap-1.5 rounded-lg border border-emerald-200/80 bg-emerald-50/50 px-3 py-1.5 text-xs font-bold text-emerald-700 transition-all hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20"
          onClick={() => void run(() => recordSnapshotNow())}
        >
          <FiCamera className="h-3.5 w-3.5" />
          <span>Record Snapshot</span>
        </AsyncButton>
      }
    >
      <div className="h-80 w-full pt-4">
        {data.length === 0 ? (
          <div className="grid h-full place-items-center rounded-xl bg-slate-50/50 text-sm font-medium text-slate-900 dark:text-slate-500 dark:bg-slate-800/30 dark:text-slate-400">
            Add investments to start tracking daily portfolio snapshots.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94A3B8', fontWeight: 500 }} axisLine={false} tickLine={false} dy={10} />
              <YAxis
                tick={{ fontSize: 11, fill: '#94A3B8', fontWeight: 500 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`}
                dx={-10}
              />
              <Tooltip
                formatter={(v: any) => formatINR(Number(v))}
                labelFormatter={(l: any) => `Date: ${String(l)}`}
                contentStyle={{
                  borderRadius: 16,
                  border: '1px solid rgba(255,255,255,0.1)',
                  backgroundColor: 'rgba(15, 23, 42, 0.9)',
                  backdropFilter: 'blur(8px)',
                  color: '#F8FAFC',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                }}
                itemStyle={{ color: '#10B981', fontWeight: 'bold' }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#10B981"
                strokeWidth={3}
                dot={{ r: 0 }}
                activeDot={{ r: 6, fill: '#10B981', stroke: '#fff', strokeWidth: 2 }}
                isAnimationActive
                animationDuration={1500}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  )
}
