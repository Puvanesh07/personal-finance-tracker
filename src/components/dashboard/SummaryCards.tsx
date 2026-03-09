import { useMemo } from 'react'
import { usePortfolioStore } from '../../store/portfolioStore'
import { summarizePortfolio } from '../../utils/calculations'
import { formatINR } from '../../utils/format'

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-2 text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-50">{value}</div>
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

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard label="Total assets" value={formatINR(summary.totalValue)} />
      <MetricCard label="Liabilities" value={formatINR(liabilitiesTotal)} />
      <MetricCard label="Net worth" value={formatINR(netWorth)} />
      <MetricCard label="Stocks value" value={formatINR(summary.byType.stock.current)} />
      <MetricCard label="Mutual funds value" value={formatINR(summary.byType.mutual_fund.current)} />
      <MetricCard label="Bonds investment" value={formatINR(summary.byType.bond.invested)} />
      <MetricCard label="Fixed deposits value" value={formatINR(summary.byType.fixed_deposit.current)} />
      <MetricCard label="Expected interest (Bonds + FD)" value={formatINR(summary.expectedInterest.total)} />
      <MetricCard
        label="Profit / Loss"
        value={`${summary.profitLossTotal >= 0 ? '+' : ''}${formatINR(summary.profitLossTotal)}`}
      />
      <MetricCard label="Invested total" value={formatINR(summary.investedTotal)} />
      <MetricCard label="Snapshots taken" value={String(networthSnapshots.length)} />
    </div>
  )
}

