// GrowthChart — uses networthSnapshots (manual, full-detail) instead of the
// old daily auto-write `snapshots` collection. This eliminates 1 Firestore
// write per investment edit while showing richer data.

import { useMemo } from 'react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { usePortfolioStore } from '../../store/portfolioStore'
import { Card } from '../ui/Card'
import { formatINR } from '../../utils/format'
import { FiCamera, FiTrendingUp } from 'react-icons/fi'
import { useAsyncAction } from '../../hooks/useAsyncAction'
import { AsyncButton } from '../ui/AsyncButton'
import { useNavigate } from 'react-router-dom'

export function GrowthChart() {
  // Use networthSnapshots (manual snapshots with full detail) for the chart.
  // These are taken by the user from the Snapshots page or Dashboard quick action.
  const networthSnapshots = usePortfolioStore((s) => s.networthSnapshots)
  const { busy, run } = useAsyncAction()
  const navigate = useNavigate()

  const data = useMemo(() =>
    [...networthSnapshots]
      .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''))
      .map((s) => ({
        date: s.createdAt ? new Date(s.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '',
        value: s.netWorth,
        label: s.label,
      })),
    [networthSnapshots],
  )

  return (
    <Card
      title={<div className="flex items-center gap-2"><FiTrendingUp className="text-emerald-500"/> Net Worth Growth</div>}
      right={
        <AsyncButton
          type="button"
          busy={busy}
          loadingLabel="Going…"
          className="group flex items-center gap-1.5 rounded-lg border border-emerald-200/80 bg-emerald-50/50 px-3 py-1.5 text-xs font-bold text-emerald-700 transition-all hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20"
          onClick={() => void run(() => { navigate('/snapshots'); return Promise.resolve(); })}
        >
          <FiCamera className="h-3.5 w-3.5" />
          <span>Take Snapshot</span>
        </AsyncButton>
      }
    >
      <div className="min-h-0">
      <div className="h-80 min-h-[320px] w-full pt-4">
        {data.length === 0 ? (
          <div className="grid h-full min-h-[320px] place-items-center rounded-xl bg-slate-50/50 text-sm font-medium text-slate-900 dark:text-slate-500 dark:bg-slate-800/30 dark:text-slate-400">
            Take your first snapshot to start tracking net worth growth over time.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94A3B8', fontWeight: 500 }} axisLine={false} tickLine={false} dy={10} />
              <YAxis
                tick={{ fontSize: 11, fill: '#94A3B8', fontWeight: 500 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `₹${Math.round(Number(v) / 100000)}L`}
                dx={-10}
              />
              <Tooltip
                formatter={(v: any) => [formatINR(Number(v)), 'Net Worth']}
                labelFormatter={(l: any) => `${String(l)}`}
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
                dot={{ r: 3, fill: '#10B981', stroke: '#fff', strokeWidth: 1 }}
                activeDot={{ r: 6, fill: '#10B981', stroke: '#fff', strokeWidth: 2 }}
                isAnimationActive
                animationDuration={1500}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
      </div>
    </Card>
  )
}
