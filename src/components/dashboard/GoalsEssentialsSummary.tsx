import { usePortfolioStore } from '../../store/portfolioStore'
import { Card } from '../ui/Card'
import { formatINR } from '../../utils/format'
import { FiTarget, FiShield } from 'react-icons/fi'

export function GoalsEssentialsSummary() {
  const goals = usePortfolioStore((s) => s.goals)
  const essentials = usePortfolioStore((s) => s.essentials)

  const activeGoals = goals.slice(0, 3)

  const emergencyCurrent = essentials.emergencyFundCurrent ?? 0
  const emergencyTarget = essentials.emergencyFundTarget ?? 0
  const emergencyPct = emergencyTarget > 0 ? Math.min(100, (emergencyCurrent / emergencyTarget) * 100) : 0

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card title={<div className="flex items-center gap-2"><FiTarget className="text-purple-500"/> Active Goals</div>}>
        {activeGoals.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-xl bg-slate-50/50 p-6 text-sm font-medium text-slate-500 dark:bg-slate-800/30">
            No goals yet. Add them in the Goals tab.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {activeGoals.map((g) => {
              const pct = g.targetAmount > 0 ? Math.min(100, (g.currentAmount / g.targetAmount) * 100) : 0
              const isCompleted = pct >= 100
              
              return (
                <div key={g.id} className="rounded-xl border border-slate-100 bg-slate-50/30 p-4 transition-colors hover:bg-slate-50 dark:border-slate-800/60 dark:bg-slate-800/20 dark:hover:bg-slate-800/40">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-bold text-slate-900 dark:text-slate-100">{g.name}</span>
                    <span className={`text-xs font-bold ${isCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>{pct.toFixed(0)}%</span>
                  </div>
                  <div className="my-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-200/60 shadow-inner dark:bg-slate-800">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${
                        isCompleted 
                          ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' 
                          : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <span className="text-slate-700 dark:text-slate-300">{formatINR(g.currentAmount)} saved</span>
                    <span>Target {formatINR(g.targetAmount)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <Card title={<div className="flex items-center gap-2"><FiShield className="text-rose-500"/> Financial Safety Net</div>}>
        <div className="flex flex-col gap-3 h-full justify-between">
          <div className="flex flex-col gap-2 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold text-slate-800 dark:text-slate-200">Emergency Fund</span>
              {emergencyTarget > 0 ? (
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{emergencyPct.toFixed(0)}%</span>
              ) : null}
            </div>
            {emergencyTarget > 0 ? (
              <>
                <div className="h-2 w-full overflow-hidden rounded-full bg-emerald-200/50 dark:bg-emerald-900/40">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${emergencyPct}%` }} />
                </div>
                <div className="flex justify-between text-[11px] font-semibold text-emerald-700/70 dark:text-emerald-400/70">
                  <span>{formatINR(emergencyCurrent)}</span>
                  <span>Target: {formatINR(emergencyTarget)}</span>
                </div>
              </>
            ) : (
              <span className="text-xs font-medium text-emerald-600/70 dark:text-emerald-400/70">Set target in Settings → Essentials</span>
            )}
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800/60 dark:bg-slate-800/20">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Term Insurance Cover</span>
            <span className="text-sm font-black tabular-nums text-slate-900 dark:text-slate-50">
              {essentials.termInsuranceCover ? formatINR(essentials.termInsuranceCover) : <span className="text-slate-400 font-medium">Not set</span>}
            </span>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800/60 dark:bg-slate-800/20">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Health Insurance Cover</span>
            <span className="text-sm font-black tabular-nums text-slate-900 dark:text-slate-50">
              {essentials.healthCover ? formatINR(essentials.healthCover) : <span className="text-slate-400 font-medium">Not set</span>}
            </span>
          </div>
        </div>
      </Card>
    </div>
  )
}