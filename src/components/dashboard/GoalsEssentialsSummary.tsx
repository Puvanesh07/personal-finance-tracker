import { usePortfolioStore } from '../../store/portfolioStore'
import { Card } from '../ui/Card'
import { formatINR } from '../../utils/format'

export function GoalsEssentialsSummary() {
  const goals = usePortfolioStore((s) => s.goals)
  const essentials = usePortfolioStore((s) => s.essentials)

  const activeGoals = goals.slice(0, 3)

  const emergencyCurrent = essentials.emergencyFundCurrent ?? 0
  const emergencyTarget = essentials.emergencyFundTarget ?? 0
  const emergencyPct = emergencyTarget > 0 ? Math.min(100, (emergencyCurrent / emergencyTarget) * 100) : 0

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card title="Goals (top 3)">
        {activeGoals.length === 0 ? (
          <div className="text-sm text-slate-600">No goals yet. Add them in the Goals page.</div>
        ) : (
          <div className="flex flex-col gap-3">
            {activeGoals.map((g) => {
              const pct = g.targetAmount > 0 ? Math.min(100, (g.currentAmount / g.targetAmount) * 100) : 0
              return (
                <div key={g.id} className="space-y-1 rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-slate-900">{g.name}</span>
                    <span className="text-xs text-slate-600">{pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>{formatINR(g.currentAmount)} saved</span>
                    <span>Target {formatINR(g.targetAmount)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <Card title="Essentials check">
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-700">Emergency fund</span>
            {emergencyTarget > 0 ? (
              <span className="tabular-nums">
                {formatINR(emergencyCurrent)} / {formatINR(emergencyTarget)} ({emergencyPct.toFixed(0)}%)
              </span>
            ) : (
              <span className="text-slate-500 text-xs">Set target in Settings → Essentials</span>
            )}
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-700">Term insurance cover</span>
            <span className="tabular-nums">
              {essentials.termInsuranceCover ? formatINR(essentials.termInsuranceCover) : 'Not set'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-700">Health cover</span>
            <span className="tabular-nums">
              {essentials.healthCover ? formatINR(essentials.healthCover) : 'Not set'}
            </span>
          </div>
        </div>
      </Card>
    </div>
  )
}

