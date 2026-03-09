import { useMemo } from 'react'
import { usePortfolioStore } from '../../store/portfolioStore'
import { summarizePortfolio } from '../../utils/calculations'
import { formatINR } from '../../utils/format'

function MetricCard({ 
  label, 
  value, 
  variant = 'default',
  trend
}: { 
  label: string; 
  value: string;
  variant?: 'default' | 'primary' | 'danger';
  trend?: 'up' | 'down' | 'neutral';
}) {
  let bgClass = "bg-white/80 dark:bg-slate-900/50 border-slate-200/60 dark:border-slate-800/60"
  let textClass = "text-slate-900 dark:text-slate-50"
  let labelClass = "text-slate-500 dark:text-slate-400"

  if (variant === 'primary') {
    bgClass = "bg-gradient-to-br from-emerald-500 to-emerald-700 border-emerald-600 shadow-emerald-500/20"
    textClass = "text-white"
    labelClass = "text-emerald-50"
  } else if (variant === 'danger') {
    bgClass = "bg-gradient-to-br from-rose-500 to-rose-700 border-rose-600 shadow-rose-500/20"
    textClass = "text-white"
    labelClass = "text-rose-50"
  }

  let trendColor = ""
  if (trend === 'up') trendColor = "text-emerald-500 dark:text-emerald-400"
  if (trend === 'down') trendColor = "text-rose-500 dark:text-rose-400"

  return (
    <div className={`relative overflow-hidden rounded-2xl border p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg backdrop-blur-sm ${bgClass}`}>
      <div className={`text-sm font-medium tracking-wide ${labelClass}`}>{label}</div>
      <div className={`mt-3 text-2xl font-bold tabular-nums tracking-tight ${variant === 'default' && trendColor ? trendColor : textClass}`}>
        {value}
      </div>
    </div>
  )
}

export function SummaryCards() {
  const investments = usePortfolioStore((s) => s.investments)
  const liabilities = usePortfolioStore((s) => s.liabilities)
  const networthSnapshots = usePortfolioStore((s) => s.networthSnapshots)
  
  const summary = useMemo(() => summarizePortfolio(investments), [investments])
  const liabilitiesTotal = useMemo(
    () => liabilities.reduce((acc, l) => acc + (l.outstanding || 0), 0),
    [liabilities],
  )
  const netWorth = summary.totalValue - liabilitiesTotal
  const isProfit = summary.profitLossTotal >= 0

  return (
    <div className="flex flex-col gap-6">
      {/* Top Level Metrics (Hero Cards) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label="Total Assets" value={formatINR(summary.totalValue)} />
        <MetricCard 
          label="Liabilities" 
          value={formatINR(liabilitiesTotal)} 
          variant={liabilitiesTotal > 0 ? 'danger' : 'default'} 
        />
        <MetricCard label="Net Worth" value={formatINR(netWorth)} variant="primary" />
      </div>

      {/* Secondary Metrics Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Stocks Value" value={formatINR(summary.byType.stock.current)} />
        <MetricCard label="Mutual Funds" value={formatINR(summary.byType.mutual_fund.current)} />
        <MetricCard label="Bonds Investment" value={formatINR(summary.byType.bond.invested)} />
        <MetricCard label="Fixed Deposits" value={formatINR(summary.byType.fixed_deposit.current)} />
        
        <MetricCard label="Invested Total" value={formatINR(summary.investedTotal)} />
        <MetricCard 
          label="Total Profit / Loss" 
          value={`${isProfit ? '+' : ''}${formatINR(summary.profitLossTotal)}`} 
          trend={isProfit ? 'up' : 'down'}
        />
        <MetricCard label="Expected Interest" value={formatINR(summary.expectedInterest.total)} />
        <MetricCard label="Snapshots Taken" value={String(networthSnapshots.length)} />
      </div>
    </div>
  )
}