// src/pages/InsightsPage.tsx
// Full corrected Insights page — drop this into your pages/ folder.

import { useMemo, useState } from 'react'
import { usePortfolioStore } from '../../store/portfolioStore'
import { summarizePortfolio } from '../../utils/calculations'
import { formatINR, formatNumber } from '../../utils/format'
import type { Investment, Liability, CashflowEntry } from '../../types/investmentTypes'

// ─── Helper: monthly average ───────────────────────────────────────────────
function calcMonthlyAvg(entries: CashflowEntry[], type: 'income' | 'expense'): number {
  const filtered = entries.filter(e => e.type === type)
  if (filtered.length === 0) return 0
  const total = filtered.reduce((acc, e) => acc + e.amount, 0)
  const months = new Set(filtered.map(e => e.date.substring(0, 7))).size || 1
  return total / months
}

// ─── Helper: liquid assets ─────────────────────────────────────────────────
function calcLiquidAssets(investments: Investment[]): number {
  return investments
    .filter(i => i.type === 'fixed_deposit' || i.type === 'other')
    .reduce((acc, i) => {
      if (i.type === 'fixed_deposit') return acc + (i.investedAmount ?? 0)
      if (i.type === 'other') return acc + (i.currentValue ?? 0)
      return acc
    }, 0)
}

// ─── Helper: equity allocation % ──────────────────────────────────────────
function calcEquityPct(investments: Investment[], totalValue: number): number {
  if (totalValue === 0) return 0
  const equityValue = investments
    .filter(i => i.type === 'stock' || i.type === 'mutual_fund')
    .reduce((acc, i) => {
      if (i.type === 'stock') return acc + (i.quantity ?? 0) * (i.currentPrice ?? 0)
      if (i.type === 'mutual_fund') return acc + (i.units ?? 0) * (i.nav ?? 0)
      return acc
    }, 0)
  return (equityValue / totalValue) * 100
}

// ─── Helper: tax-loss potential ────────────────────────────────────────────
function calcTaxLossPotential(investments: Investment[]): number {
  return investments
    .filter(i => i.type === 'stock')
    .reduce((acc, i) => {
      if (i.type !== 'stock') return acc
      const loss = (i.buyPrice - i.currentPrice) * i.quantity
      return loss > 0 ? acc + loss : acc
    }, 0)
}

// ─── Helper: top debt priority (highest interest rate) ────────────────────
function getTopDebtId(liabilities: Liability[]): string | undefined {
  if (liabilities.length === 0) return undefined
  return [...liabilities].sort(
    (a, b) => (b.interestRate ?? 0) - (a.interestRate ?? 0)
  )[0]?.id
}

// ─── Financial Health Score ────────────────────────────────────────────────
function calcHealthScore(
  investments: Investment[],
  liabilities: Liability[],
  cashflows: CashflowEntry[]
) {
  const { totalValue } = summarizePortfolio(investments)
  const totalLiabilities = liabilities.reduce((acc, l) => acc + (l.outstanding ?? 0), 0)

  // 1. Debt score (30 pts)
  const debtRatio = totalValue > 0 ? totalLiabilities / totalValue : 0
  const debtScore = Math.max(0, 30 - debtRatio * 60)

  // 2. Emergency fund score (20 pts)
  const avgExpense = calcMonthlyAvg(cashflows, 'expense')
  const liquid = calcLiquidAssets(investments)
  const runway = avgExpense > 0 ? liquid / avgExpense : 0
  const emergencyScore = Math.min(20, (runway / 6) * 20)

  // 3. Savings rate score (25 pts)
  const income = calcMonthlyAvg(cashflows, 'income')
  const savingsRate = income > 0 ? ((income - avgExpense) / income) * 100 : 0
  const savingsScore = Math.min(25, (savingsRate / 30) * 25)

  // 4. Diversification score (25 pts)
  const assetTypes = new Set(investments.map(i => i.type)).size
  const divScore = Math.min(25, (assetTypes / 5) * 25)

  return {
    total: Math.round(debtScore + emergencyScore + savingsScore + divScore),
    debtScore: Math.round(debtScore),
    emergencyScore: Math.round(emergencyScore),
    savingsScore: Math.round(savingsScore),
    divScore: Math.round(divScore),
    debtRatio,
    runway,
    savingsRate,
    assetTypes,
  }
}

// ─── FIRE Projection ───────────────────────────────────────────────────────
function calcFIRE(netWorth: number, monthlySavings: number, monthlyExpense: number, expectedReturn = 10) {
  const annualExpense = monthlyExpense > 0 ? monthlyExpense * 12 : 600000
  const target = annualExpense * 25 // 4% rule
  const monthlyRate = expectedReturn / 12 / 100
  let current = netWorth
  let months = 0
  while (current < target && months < 600) {
    current = (current + monthlySavings) * (1 + monthlyRate)
    months++
  }
  return {
    target,
    yearsToFIRE: months < 600 ? Math.round(months / 12) : null,
    achievable: months < 600,
  }
}

// ─── Score ring SVG ────────────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const r = 52
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  const color = score >= 75 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444'

  return (
    <div style={{ position: 'relative', width: 136, height: 136, flexShrink: 0 }}>
      <svg width="136" height="136" viewBox="0 0 136 136">
        <circle cx="68" cy="68" r={r} fill="none" stroke="#1e293b" strokeWidth="12" />
        <circle
          cx="68" cy="68" r={r}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 68 68)"
          style={{ transition: 'stroke-dasharray 1s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 28, fontWeight: 700, color, fontFamily: "'DM Mono', monospace" }}>{score}</span>
        <span style={{ fontSize: 11, color: '#64748b', letterSpacing: '0.1em' }}>/ 100</span>
      </div>
    </div>
  )
}

// ─── Mini bar ─────────────────────────────────────────────────────────────
function MiniBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>
        <span>{label}</span>
        <span style={{ color, fontFamily: "'DM Mono', monospace" }}>{value}/{max}</span>
      </div>
      <div style={{ height: 6, background: '#1e293b', borderRadius: 99 }}>
        <div style={{
          height: '100%', borderRadius: 99,
          width: `${(value / max) * 100}%`,
          background: color,
          transition: 'width 1s ease',
        }} />
      </div>
    </div>
  )
}

// ─── Metric card ──────────────────────────────────────────────────────────
function MetricCard({
  icon, label, value, sub, status,
}: {
  icon: string; label: string; value: string; sub?: string
  status?: 'good' | 'warning' | 'critical' | 'neutral'
}) {
  const statusColors = {
    good: '#22c55e', warning: '#f59e0b', critical: '#ef4444', neutral: '#64748b',
  }
  const border = status ? statusColors[status] : '#1e293b'

  return (
    <div style={{
      background: '#0f172a',
      border: `1px solid ${border}22`,
      borderTop: `2px solid ${border}`,
      borderRadius: 12,
      padding: '18px 20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontSize: 12, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', fontFamily: "'DM Mono', monospace" }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────
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

    return {
      totalValue, totalLiabilities, netWorth, health,
      income, expense, monthlySavings,
      equityPct, taxLoss, topDebtId, topDebt, fire,
    }
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
      topDebtPriorityId: metrics.topDebtId,
      rebalanceRequired: metrics.equityPct > 80 || metrics.equityPct < 20,
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (!ready) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#64748b' }}>
        Loading insights…
      </div>
    )
  }

  const noData = investments.length === 0

  return (
    <div style={{
      minHeight: '100vh',
      background: '#020817',
      color: '#f1f5f9',
      fontFamily: "'DM Sans', sans-serif",
      padding: '32px 24px',
      maxWidth: 900,
      margin: '0 auto',
    }}>

      {/* Google Font */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: '#f8fafc' }}>Financial Insights</h1>
          <p style={{ fontSize: 14, color: '#64748b', margin: '6px 0 0' }}>
            {latestInsight
              ? `Last saved ${new Date(latestInsight.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
              : 'No snapshot saved yet'}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || noData}
          style={{
            padding: '10px 20px',
            borderRadius: 8,
            border: 'none',
            background: saved ? '#22c55e' : '#3b82f6',
            color: '#fff',
            fontWeight: 600,
            fontSize: 14,
            cursor: noData ? 'not-allowed' : 'pointer',
            opacity: noData ? 0.4 : 1,
            transition: 'background 0.3s',
          }}
        >
          {saving ? 'Saving…' : saved ? '✓ Saved' : '💾 Save Snapshot'}
        </button>
      </div>

      {noData ? (
        <div style={{
          background: '#0f172a', border: '1px dashed #1e293b',
          borderRadius: 16, padding: 48, textAlign: 'center',
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
          <div style={{ fontSize: 16, color: '#94a3b8' }}>Add investments to see insights</div>
        </div>
      ) : (
        <>
          {/* Health Score + breakdown */}
          <div style={{
            background: '#0f172a', border: '1px solid #1e293b',
            borderRadius: 16, padding: 24, marginBottom: 20,
            display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'center',
          }}>
            <ScoreRing score={health.total} />
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9' }}>Health Score</span>
                <span style={{
                  fontSize: 12, fontWeight: 600, padding: '3px 10px',
                  borderRadius: 99, background: `${healthColor}22`, color: healthColor,
                }}>{healthLabel}</span>
              </div>
              <MiniBar label="Debt Management" value={health.debtScore} max={30} color="#60a5fa" />
              <MiniBar label="Emergency Fund" value={health.emergencyScore} max={20} color="#a78bfa" />
              <MiniBar label="Savings Rate" value={health.savingsScore} max={25} color="#34d399" />
              <MiniBar label="Diversification" value={health.divScore} max={25} color="#f59e0b" />
            </div>
          </div>

          {/* Key metrics grid */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 14, marginBottom: 20,
          }}>
            <MetricCard
              icon="💰" label="Net Worth"
              value={formatINR(metrics.netWorth)}
              status={metrics.netWorth > 0 ? 'good' : 'critical'}
            />
            <MetricCard
              icon="🏦" label="Total Assets"
              value={formatINR(metrics.totalValue)}
              status="neutral"
            />
            <MetricCard
              icon="📉" label="Total Liabilities"
              value={formatINR(metrics.totalLiabilities)}
              status={metrics.totalLiabilities === 0 ? 'good' : metrics.health.debtRatio > 0.5 ? 'critical' : 'warning'}
            />
            <MetricCard
              icon="📊" label="Debt-to-Asset"
              value={`${formatNumber(health.debtRatio * 100, 1)}%`}
              sub={health.debtRatio < 0.3 ? 'Healthy' : health.debtRatio < 0.6 ? 'Moderate' : 'High'}
              status={health.debtRatio < 0.3 ? 'good' : health.debtRatio < 0.6 ? 'warning' : 'critical'}
            />
            <MetricCard
              icon="🛡️" label="Emergency Runway"
              value={`${formatNumber(health.runway, 1)} mo`}
              sub={health.runway >= 6 ? 'Well covered' : health.runway >= 3 ? 'Partial cover' : 'Build fund'}
              status={health.runway >= 6 ? 'good' : health.runway >= 3 ? 'warning' : 'critical'}
            />
            <MetricCard
              icon="💹" label="Monthly Savings"
              value={formatINR(metrics.monthlySavings)}
              sub={metrics.income > 0 ? `${formatNumber((metrics.monthlySavings / metrics.income) * 100, 0)}% rate` : undefined}
              status={metrics.monthlySavings > 0 ? 'good' : 'critical'}
            />
            <MetricCard
              icon="📈" label="Equity Allocation"
              value={`${formatNumber(metrics.equityPct, 1)}%`}
              sub={metrics.equityPct > 80 ? 'Over-concentrated' : metrics.equityPct < 20 ? 'Under-allocated' : 'Balanced'}
              status={metrics.equityPct > 80 || metrics.equityPct < 20 ? 'warning' : 'good'}
            />
            <MetricCard
              icon="🧾" label="Tax-Loss Potential"
              value={formatINR(metrics.taxLoss)}
              sub={metrics.taxLoss > 0 ? 'Consider harvesting' : 'No loss positions'}
              status={metrics.taxLoss > 0 ? 'warning' : 'good'}
            />
          </div>

          {/* FIRE Projection */}
          <div style={{
            background: '#0f172a', border: '1px solid #1e293b',
            borderRadius: 16, padding: 24, marginBottom: 20,
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
              🔥 FIRE Projection
              <span style={{ fontSize: 12, color: '#64748b', fontWeight: 400 }}>Financial Independence / Retire Early</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14 }}>
              <div style={{ background: '#020817', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Target Corpus</div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: '#f1f5f9' }}>{formatINR(fire.target)}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>25× annual expenses</div>
              </div>
              <div style={{ background: '#020817', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Years to FIRE</div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: fire.achievable ? '#22c55e' : '#ef4444' }}>
                  {fire.achievable ? `${fire.yearsToFIRE} yrs` : '50+ yrs'}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>at 10% annual return</div>
              </div>
              <div style={{ background: '#020817', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Monthly Savings</div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: '#f1f5f9' }}>{formatINR(metrics.monthlySavings)}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>contributed monthly</div>
              </div>
              <div style={{ background: '#020817', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Current Progress</div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: '#60a5fa' }}>
                  {fire.target > 0 ? `${formatNumber((metrics.netWorth / fire.target) * 100, 1)}%` : '0%'}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>of FIRE target</div>
              </div>
            </div>
          </div>

          {/* Top Priority Debt */}
          {metrics.topDebt && (
            <div style={{
              background: '#0f172a', border: '1px solid #ef444422',
              borderLeft: '3px solid #ef4444',
              borderRadius: 16, padding: 20, marginBottom: 20,
              display: 'flex', gap: 16, alignItems: 'center',
            }}>
              <span style={{ fontSize: 28 }}>⚠️</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>
                  Priority Debt: {metrics.topDebt.name}
                </div>
                <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
                  Outstanding {formatINR(metrics.topDebt.outstanding)} at {metrics.topDebt.interestRate ?? 0}% p.a.
                  — highest interest rate liability, pay this down first.
                </div>
              </div>
            </div>
          )}

          {/* Rebalance alert */}
          {(metrics.equityPct > 80 || metrics.equityPct < 20) && (
            <div style={{
              background: '#0f172a', border: '1px solid #f59e0b22',
              borderLeft: '3px solid #f59e0b',
              borderRadius: 16, padding: 20,
              display: 'flex', gap: 16, alignItems: 'center',
            }}>
              <span style={{ fontSize: 28 }}>⚖️</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>Rebalancing Recommended</div>
                <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
                  Equity is at {formatNumber(metrics.equityPct, 1)}% of portfolio.
                  {metrics.equityPct > 80
                    ? ' Consider moving some funds to debt/fixed income instruments.'
                    : ' Consider increasing equity exposure for better long-term returns.'}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}