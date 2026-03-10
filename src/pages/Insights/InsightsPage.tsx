// src/pages/InsightsPage.tsx
import { useMemo, useState } from 'react'
import { FiSave, FiZap } from 'react-icons/fi'
import { usePortfolioStore } from '../../store/portfolioStore'
import { summarizePortfolio } from '../../utils/calculations'
import { formatINR, formatNumber } from '../../utils/format'
import type { Investment, Liability, CashflowEntry } from '../../types/investmentTypes'

// ─── Helpers ───────────────────────────────────────────────────────────────

function calcMonthlyAvg(entries: CashflowEntry[], type: 'income' | 'expense'): number {
  const filtered = entries.filter(e => e.type === type)
  if (!filtered.length) return 0
  const total = filtered.reduce((acc, e) => acc + e.amount, 0)
  const months = new Set(filtered.map(e => e.date.substring(0, 7))).size || 1
  return total / months
}

function calcLiquidAssets(investments: Investment[]): number {
  return investments
    .filter(i => i.type === 'fixed_deposit' || i.type === 'other')
    .reduce((acc, i) => {
      if (i.type === 'fixed_deposit') return acc + (i.investedAmount ?? 0)
      if (i.type === 'other') return acc + (i.currentValue ?? 0)
      return acc
    }, 0)
}

function calcEquityPct(investments: Investment[], totalValue: number): number {
  if (!totalValue) return 0
  const eq = investments
    .filter(i => i.type === 'stock' || i.type === 'mutual_fund')
    .reduce((acc, i) => {
      if (i.type === 'stock') return acc + (i.quantity ?? 0) * (i.currentPrice ?? 0)
      if (i.type === 'mutual_fund') return acc + (i.units ?? 0) * (i.nav ?? 0)
      return acc
    }, 0)
  return (eq / totalValue) * 100
}

function calcTaxLossPotential(investments: Investment[]): number {
  return investments
    .filter(i => i.type === 'stock')
    .reduce((acc, i) => {
      if (i.type !== 'stock') return acc
      const loss = (i.buyPrice - i.currentPrice) * i.quantity
      return loss > 0 ? acc + loss : acc
    }, 0)
}

function getTopDebtId(liabilities: Liability[]): string | undefined {
  if (!liabilities.length) return undefined
  return [...liabilities].sort((a, b) => (b.interestRate ?? 0) - (a.interestRate ?? 0))[0]?.id
}

function calcHealthScore(
  investments: Investment[], liabilities: Liability[], cashflows: CashflowEntry[]
) {
  const { totalValue } = summarizePortfolio(investments)
  const totalLiabilities = liabilities.reduce((acc, l) => acc + (l.outstanding ?? 0), 0)
  const debtRatio = totalValue > 0 ? totalLiabilities / totalValue : 0
  const debtScore = Math.max(0, 30 - debtRatio * 60)
  const avgExpense = calcMonthlyAvg(cashflows, 'expense')
  const liquid = calcLiquidAssets(investments)
  const runway = avgExpense > 0 ? liquid / avgExpense : 0
  const emergencyScore = Math.min(20, (runway / 6) * 20)
  const income = calcMonthlyAvg(cashflows, 'income')
  const savingsRate = income > 0 ? ((income - avgExpense) / income) * 100 : 0
  const savingsScore = Math.min(25, (savingsRate / 30) * 25)
  const assetTypes = new Set(investments.map(i => i.type)).size
  const divScore = Math.min(25, (assetTypes / 5) * 25)
  return {
    total: Math.round(debtScore + emergencyScore + savingsScore + divScore),
    debtScore: Math.round(debtScore), emergencyScore: Math.round(emergencyScore),
    savingsScore: Math.round(savingsScore), divScore: Math.round(divScore),
    debtRatio, runway, savingsRate, assetTypes,
  }
}

function calcFIRE(netWorth: number, monthlySavings: number, monthlyExpense: number, expectedReturn = 10) {
  const annualExpense = monthlyExpense > 0 ? monthlyExpense * 12 : 600000
  const target = annualExpense * 25
  const monthlyRate = expectedReturn / 12 / 100
  let current = netWorth, months = 0
  while (current < target && months < 600) {
    current = (current + monthlySavings) * (1 + monthlyRate)
    months++
  }
  return { target, yearsToFIRE: months < 600 ? Math.round(months / 12) : null, achievable: months < 600 }
}

// ─── Sub-components ────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const r = 44
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  const color = score >= 75 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444'
  return (
    <div className="relative" style={{ width: 112, height: 112, flexShrink: 0 }}>
      <svg width="112" height="112" viewBox="0 0 112 112">
        <circle cx="56" cy="56" r={r} fill="none" stroke="#1e293b" strokeWidth="10" />
        <circle cx="56" cy="56" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 56 56)"
          style={{ transition: 'stroke-dasharray 1s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold" style={{ color, fontFamily: 'monospace' }}>{score}</span>
        <span className="text-[10px] text-slate-500">/100</span>
      </div>
    </div>
  )
}

function MiniBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="mb-2.5">
      <div className="flex justify-between text-[11px] text-slate-400 mb-1">
        <span>{label}</span>
        <span style={{ color, fontFamily: 'monospace' }}>{value}/{max}</span>
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${(value / max) * 100}%`, background: color }} />
      </div>
    </div>
  )
}

function MetricCard({ icon, label, value, sub, color }: {
  icon: string; label: string; value: string; sub?: string; color: string
}) {
  return (
    <div className="rounded-xl p-3.5 flex flex-col gap-1"
      style={{ background: '#0f172a', border: `1px solid ${color}22`, borderTop: `2px solid ${color}` }}>
      <div className="flex items-center gap-1.5">
        <span className="text-base">{icon}</span>
        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{label}</span>
      </div>
      <div className="text-base font-bold text-slate-100" style={{ fontFamily: 'monospace' }}>{value}</div>
      {sub && <div className="text-[11px] text-slate-500">{sub}</div>}
    </div>
  )
}

function FireCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="rounded-xl p-3.5 bg-slate-950">
      <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1.5">{label}</div>
      <div className="text-base font-bold" style={{ color, fontFamily: 'monospace' }}>{value}</div>
      <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>
    </div>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────

export default function InsightsPage() {
  const { investments, liabilities, cashflows, latestInsight, saveInsightSnapshot, ready } = usePortfolioStore()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const metrics = useMemo(() => {
    const { totalValue } = summarizePortfolio(investments)
    const totalLiabilities = liabilities.reduce((acc: number, l: Liability) => acc + (l.outstanding ?? 0), 0)
    const netWorth = totalValue - totalLiabilities
    const health = calcHealthScore(investments, liabilities, cashflows)
    const income = calcMonthlyAvg(cashflows, 'income')
    const expense = calcMonthlyAvg(cashflows, 'expense')
    const monthlySavings = income - expense
    const equityPct = calcEquityPct(investments, totalValue)
    const taxLoss = calcTaxLossPotential(investments)
    const topDebtId = getTopDebtId(liabilities)
    const fire = calcFIRE(netWorth, monthlySavings, expense)
    const topDebt = liabilities.find((l: Liability) => l.id === topDebtId)
    return { totalValue, totalLiabilities, netWorth, health, income, expense, monthlySavings, equityPct, taxLoss, topDebtId, topDebt, fire }
  }, [investments, liabilities, cashflows])

  const { health, fire } = metrics
  const healthLabel = health.total >= 75 ? 'Excellent' : health.total >= 50 ? 'Fair' : 'Needs Attention'
  const healthColor = health.total >= 75 ? '#22c55e' : health.total >= 50 ? '#f59e0b' : '#ef4444'

  async function handleSave() {
    setSaving(true)
    await saveInsightSnapshot({
      debtToAssetRatio: health.debtRatio,
      emergencyRunwayMonths: health.runway,
      totalTaxLossPotential: metrics.taxLoss,
      equityAllocationPct: metrics.equityPct,
      ...(metrics.topDebtId ? { topDebtPriorityId: metrics.topDebtId } : {}),
      rebalanceRequired: metrics.equityPct > 80 || metrics.equityPct < 20,
    })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (!ready) return (
    <div className="flex items-center justify-center h-60 text-slate-500">Loading insights…</div>
  )

  const noData = investments.length === 0

  return (
    <div className="max-w-full mx-auto pb-4">

      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent p-6 border border-emerald-500/20 dark:from-emerald-500/20 dark:via-teal-500/10 dark:border-emerald-500/30 shadow-sm mb-6">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-500/30">
            <FiZap className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Financial Insights</h1>
            <p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-300">
              {latestInsight
                ? `Last saved ${new Date(latestInsight.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
                : 'Analyse your portfolio health and track FIRE progress.'}
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || noData}
          className="group relative flex items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-emerald-500/25 transition-all hover:-translate-y-0.5 hover:shadow-emerald-500/40 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          type="button"
        >
          <div className="absolute inset-0 bg-white/20 translate-y-full transition-transform group-hover:translate-y-0" />
          <FiSave className="relative h-4 w-4" />
          <span className="relative whitespace-nowrap">
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Snapshot'}
          </span>
        </button>
      </header>

      {noData ? (
        <div className="bg-slate-900 border border-dashed border-slate-700 rounded-2xl p-12 text-center">
          <div className="text-4xl mb-3">📊</div>
          <div className="text-sm text-slate-400">Add investments to see insights</div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">

          {/* ── Health Score ────────────────────────────────────── */}
          <div className="bg-slate-900 max-w-2xl mx-auto w-full border border-slate-800 rounded-2xl p-4">
            <div className="flex gap-4 items-center flex-wrap">
              <ScoreRing score={health.total} />
              <div className="flex-1 min-w-[160px]">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-bold text-slate-100">Health Score</span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: `${healthColor}22`, color: healthColor }}>
                    {healthLabel}
                  </span>
                </div>
                <MiniBar label="Debt Management" value={health.debtScore} max={30} color="#60a5fa" />
                <MiniBar label="Emergency Fund" value={health.emergencyScore} max={20} color="#a78bfa" />
                <MiniBar label="Savings Rate" value={health.savingsScore} max={25} color="#34d399" />
                <MiniBar label="Diversification" value={health.divScore} max={25} color="#f59e0b" />
              </div>
            </div>
          </div>

          {/* ── Metrics Grid ─────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <MetricCard icon="💰" label="Net Worth" value={formatINR(metrics.netWorth)}
              color={metrics.netWorth > 0 ? '#22c55e' : '#ef4444'} />
            <MetricCard icon="🏦" label="Total Assets" value={formatINR(metrics.totalValue)} color="#64748b" />
            <MetricCard icon="📉" label="Liabilities" value={formatINR(metrics.totalLiabilities)}
              color={metrics.totalLiabilities === 0 ? '#22c55e' : health.debtRatio > 0.5 ? '#ef4444' : '#f59e0b'} />
            <MetricCard icon="📊" label="Debt/Asset"
              value={`${formatNumber(health.debtRatio * 100, 1)}%`}
              sub={health.debtRatio < 0.3 ? 'Healthy' : health.debtRatio < 0.6 ? 'Moderate' : 'High'}
              color={health.debtRatio < 0.3 ? '#22c55e' : health.debtRatio < 0.6 ? '#f59e0b' : '#ef4444'} />
            <MetricCard icon="🛡️" label="Emergency"
              value={`${formatNumber(health.runway, 1)} mo`}
              sub={health.runway >= 6 ? 'Well covered' : health.runway >= 3 ? 'Partial' : 'Build fund'}
              color={health.runway >= 6 ? '#22c55e' : health.runway >= 3 ? '#f59e0b' : '#ef4444'} />
            <MetricCard icon="💹" label="Savings/mo" value={formatINR(metrics.monthlySavings)}
              sub={metrics.income > 0 ? `${formatNumber((metrics.monthlySavings / metrics.income) * 100, 0)}% rate` : undefined}
              color={metrics.monthlySavings > 0 ? '#22c55e' : '#ef4444'} />
            <MetricCard icon="📈" label="Equity"
              value={`${formatNumber(metrics.equityPct, 1)}%`}
              sub={metrics.equityPct > 80 ? 'Over-weight' : metrics.equityPct < 20 ? 'Under-weight' : 'Balanced'}
              color={metrics.equityPct > 80 || metrics.equityPct < 20 ? '#f59e0b' : '#22c55e'} />
            <MetricCard icon="🧾" label="Tax Loss"
              value={formatINR(metrics.taxLoss)}
              sub={metrics.taxLoss > 0 ? 'Harvest now' : 'No losses'}
              color={metrics.taxLoss > 0 ? '#f59e0b' : '#22c55e'} />
          </div>

          {/* ── FIRE Projection ──────────────────────────────────── */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-bold text-slate-100">🔥 FIRE Projection</span>
              <span className="text-[11px] text-slate-500">Financial Independence</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <FireCard label="Target Corpus" value={formatINR(fire.target)}
                sub="25× annual expenses" color="#f1f5f9" />
              <FireCard label="Years to FIRE"
                value={fire.achievable ? `${fire.yearsToFIRE} yrs` : '50+ yrs'}
                sub="at 10% return" color={fire.achievable ? '#22c55e' : '#ef4444'} />
              <FireCard label="Monthly Savings" value={formatINR(metrics.monthlySavings)}
                sub="contributed" color="#f1f5f9" />
              <FireCard label="Progress"
                value={fire.target > 0 ? `${formatNumber((metrics.netWorth / fire.target) * 100, 1)}%` : '0%'}
                sub="of FIRE target" color="#60a5fa" />
            </div>
          </div>

          {/* ── Priority Debt Alert ───────────────────────────────── */}
          {metrics.topDebt && (
            <div className="bg-slate-900 rounded-2xl p-4 flex gap-3 items-start"
              style={{ border: '1px solid #ef444422', borderLeft: '3px solid #ef4444' }}>
              <span className="text-2xl">⚠️</span>
              <div>
                <div className="text-sm font-semibold text-slate-100">Priority Debt: {metrics.topDebt.name}</div>
                <div className="text-[12px] text-slate-400 mt-1">
                  {formatINR(metrics.topDebt.outstanding)} outstanding at {metrics.topDebt.interestRate ?? 0}% p.a. — pay this down first.
                </div>
              </div>
            </div>
          )}

          {/* ── Rebalance Alert ───────────────────────────────────── */}
          {(metrics.equityPct > 80 || metrics.equityPct < 20) && (
            <div className="bg-slate-900 rounded-2xl p-4 flex gap-3 items-start"
              style={{ border: '1px solid #f59e0b22', borderLeft: '3px solid #f59e0b' }}>
              <span className="text-2xl">⚖️</span>
              <div>
                <div className="text-sm font-semibold text-slate-100">Rebalancing Recommended</div>
                <div className="text-[12px] text-slate-400 mt-1">
                  Equity is at {formatNumber(metrics.equityPct, 1)}%.{' '}
                  {metrics.equityPct > 80
                    ? 'Consider shifting some to debt/fixed income.'
                    : 'Consider increasing equity for better long-term growth.'}
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}