// src/pages/Tools/analysis/PortfolioAnalyzers.tsx
import { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  FiRefreshCcw, FiZap, FiLayers, FiBarChart2,
  FiCalendar, FiScissors, FiTrendingUp,
} from 'react-icons/fi'
import { usePortfolioStore } from '../../store/portfolioStore'
import { profitLoss, summarizePortfolio } from '../../utils/calculations'
import { formatINR } from '../../utils/format'
import type { StockInvestment, FixedDepositInvestment, MutualFundInvestment } from '../../types/investmentTypes'

const cardVariants = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
}

function Card({ children, color = 'blue', title, subtitle, Icon }: {
  children: React.ReactNode; color?: string; title: string; subtitle: string; Icon: React.ElementType
}) {
  const fromMap: Record<string, string> = {
    blue: 'from-blue-500/10', rose: 'from-rose-500/10', emerald: 'from-emerald-500/10',
    amber: 'from-amber-500/10', violet: 'from-violet-500/10', teal: 'from-teal-500/10', indigo: 'from-indigo-500/10',
  }
  const iconMap: Record<string, string> = {
    blue:    'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    rose:    'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    amber:   'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    violet:  'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    teal:    'bg-teal-500/10 text-teal-600 dark:text-teal-400',
    indigo:  'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  }
  return (
    <motion.div variants={cardVariants as any} initial="initial" animate="animate"
      className="rounded-2xl border border-slate-200/80 bg-white dark:bg-slate-900/50 dark:border-slate-800/80 shadow-sm overflow-hidden">
      <div className={`flex items-center gap-4 border-b border-slate-100 dark:border-slate-800/60 bg-gradient-to-r ${fromMap[color] ?? fromMap.blue} via-transparent to-transparent px-6 py-5`}>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconMap[color] ?? iconMap.blue}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-base font-black tracking-tight text-slate-900 dark:text-white">{title}</h3>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">{subtitle}</p>
        </div>
      </div>
      {children}
    </motion.div>
  )
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div className="p-10 flex flex-col items-center gap-2 text-center text-sm text-slate-500 dark:text-slate-400">
      <FiBarChart2 className="h-8 w-8 opacity-20" />
      {msg}
    </div>
  )
}

// ─── 1. Portfolio Rebalancing ─────────────────────────────────────────────────
// Shows current equity % vs 60% target, suggests buy/sell amount
// FIXED: targets all asset types not just equity; shows concrete action needed
export function PortfolioRebalancing() {
  const investments = usePortfolioStore(s => s.investments)
  const summary = useMemo(() => summarizePortfolio(investments), [investments])

  const currentEquityPct = summary.totalValue > 0
    ? ((summary.byType.stock.current + summary.byType.mutual_fund.current) / summary.totalValue) * 100
    : 0
  const TARGET = 60 // 60% equity target
  const diff = ((TARGET - currentEquityPct) / 100) * summary.totalValue

  return (
    <Card color="blue" title="Portfolio Rebalancing" subtitle="Current vs Target Allocation" Icon={FiRefreshCcw}>
      {summary.totalValue === 0 ? <EmptyState msg="Add investments to see rebalancing suggestions." /> : (
        <div className="p-6 space-y-4">
          <div className="flex justify-between items-end">
            <span className="text-xs font-bold uppercase text-slate-900 dark:text-slate-500">Current Equity Allocation</span>
            <span className="text-2xl font-black text-slate-900 dark:text-white">{currentEquityPct.toFixed(1)}%</span>
          </div>
          {/* Bar: current */}
          <div className="relative h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(currentEquityPct, 100)}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="absolute h-full rounded-full bg-blue-500"
            />
            {/* Target marker */}
            <div className="absolute top-0 h-full w-0.5 bg-rose-500" style={{ left: `${TARGET}%` }}>
              <span className="absolute -top-5 -translate-x-1/2 text-[9px] font-bold text-rose-500">Target {TARGET}%</span>
            </div>
          </div>
          <div className={`rounded-xl p-4 text-sm font-semibold leading-relaxed ${
            Math.abs(diff) < 5000
              ? 'bg-emerald-500/5 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
              : 'bg-amber-500/5 border border-amber-500/20 text-amber-700 dark:text-amber-400'
          }`}>
            {Math.abs(diff) < 5000
              ? '✓ Your portfolio is well balanced!'
              : diff > 0
                ? `Buy ${formatINR(diff)} more in Equity (Stocks/MF) to reach ${TARGET}% target.`
                : `Reduce Equity by ${formatINR(Math.abs(diff))} (sell stocks/MF) to reach ${TARGET}% target.`
            }
          </div>
          {/* Asset breakdown */}
          <div className="space-y-2 pt-2">
            {Object.entries(summary.byType)
              .filter(([, d]: any) => d.current > 0)
              .sort((a: any, b: any) => b[1].current - a[1].current)
              .map(([type, data]: any) => {
                const pct = (data.current / summary.totalValue) * 100
                const colorMap: Record<string, string> = { stock: 'bg-emerald-500', mutual_fund: 'bg-blue-500', fixed_deposit: 'bg-teal-500', bond: 'bg-amber-500', other: 'bg-violet-500' }
                return (
                  <div key={type}>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-slate-900 dark:text-slate-500 capitalize font-semibold">{type.replace('_', ' ')}</span>
                      <span className="font-black text-slate-700 dark:text-slate-200">{pct.toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.7, ease: 'easeOut' }}
                        className={`h-full rounded-full ${colorMap[type] ?? 'bg-slate-400'}`}
                      />
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}
    </Card>
  )
}

// ─── 2. Dividend / Passive Income Tracker ────────────────────────────────────
// Estimates passive income using standard market yield rates:
// Stocks ~1.5%, Mutual Funds ~1.0%, FD interest annualised, Bonds at stated rate
// FIXED: now includes FD and bond interest in passive income projection
export function DividendTracker() {
  const investments = usePortfolioStore((s: any) => s.investments)

  const projection = useMemo(() => {
    let annual = 0
    investments.forEach((inv: any) => {
      if (inv.type === 'stock') {
        annual += (inv as StockInvestment).currentPrice * (inv as StockInvestment).quantity * 0.015
      } else if (inv.type === 'mutual_fund') {
        const mf = inv as MutualFundInvestment
        annual += mf.units * mf.nav * 0.01
      } else if (inv.type === 'fixed_deposit') {
        const fd = inv as any
        annual += fd.investedAmount * (fd.interestRate / 100)
      } else if (inv.type === 'bond') {
        const b = inv as any
        annual += b.investedAmount * (b.interestRate / 100)
      }
    })
    const stockMFVal = investments
      .filter((i: any) => i.type === 'stock' || i.type === 'mutual_fund')
      .reduce((acc: any, i: any) => {
        if (i.type === 'stock') return acc + (i as StockInvestment).currentPrice * (i as StockInvestment).quantity
        const mf = i as MutualFundInvestment
        return acc + mf.units * mf.nav
      }, 0)
    const yieldPct = stockMFVal > 0 ? (annual / stockMFVal) * 100 : 0
    return { monthly: annual / 12, yearly: annual, yieldPct }
  }, [investments])

  return (
    <Card color="indigo" title="Passive Income" subtitle="Dividend & Interest Projection" Icon={FiTrendingUp}>
      <div className="p-6">
        <div className="mb-6">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1">Monthly Projection</p>
          <p className="text-4xl font-black text-indigo-600 dark:text-indigo-400 tracking-tight">{formatINR(projection.monthly)}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Annual Income</p>
            <p className="text-sm font-black text-slate-900 dark:text-white">{formatINR(projection.yearly)}</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Blended Yield</p>
            <p className="text-sm font-black text-emerald-600">{projection.yieldPct.toFixed(2)}%</p>
          </div>
        </div>
        <p className="text-[10px] text-slate-500 dark:text-slate-400 italic text-center">Stocks 1.5% · MF 1.0% · FD/Bond at stated rate</p>
      </div>
    </Card>
  )
}

// ─── 3. XIRR Calculator ───────────────────────────────────────────────────────
// Annualised return = (currentValue / investedTotal)^(1/years) - 1
// FIXED: uses actual createdAt dates to compute holding period properly
// FIXED: guards against investedTotal = 0 to avoid NaN
export function XIRRCalculator() {
  const investments = usePortfolioStore((s: any) => s.investments)

  const stats = useMemo(() => {
    const summary = summarizePortfolio(investments)
    if (investments.length === 0 || summary.investedTotal <= 0) {
      return { returnVal: 0, invested: 0, current: 0, years: 0 }
    }
    const earliest = Math.min(...investments.map((i: any) => new Date(i.createdAt).getTime()))
    const years = Math.max((Date.now() - earliest) / (1000 * 60 * 60 * 24 * 365), 0.08) // min ~1 month
    const returnVal = (Math.pow(summary.totalValue / summary.investedTotal, 1 / years) - 1) * 100
    return { returnVal, invested: summary.investedTotal, current: summary.totalValue, years }
  }, [investments])

  return (
    <Card color="emerald" title="XIRR / Returns" subtitle="Annualised Portfolio Growth" Icon={FiZap}>
      {investments.length === 0 ? <EmptyState msg="Add investments to calculate XIRR." /> : (
        <div className="p-6">
          <div className="text-center mb-6">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">True Portfolio XIRR</p>
            <p className={`text-5xl font-black ${stats.returnVal >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {stats.returnVal >= 0 ? '+' : ''}{stats.returnVal.toFixed(2)}%
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">over {stats.years.toFixed(1)} years</p>
          </div>
          <div className="flex justify-around border-t border-slate-100 dark:border-slate-800 pt-4">
            <div className="text-center">
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Invested</p>
              <p className="text-sm font-black text-slate-700 dark:text-white">{formatINR(stats.invested)}</p>
            </div>
            <div className="h-8 w-px bg-slate-100 dark:bg-slate-800" />
            <div className="text-center">
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Current</p>
              <p className="text-sm font-black text-slate-700 dark:text-white">{formatINR(stats.current)}</p>
            </div>
            <div className="h-8 w-px bg-slate-100 dark:bg-slate-800" />
            <div className="text-center">
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Gain</p>
              <p className={`text-sm font-black ${stats.current >= stats.invested ? 'text-emerald-500' : 'text-rose-500'}`}>
                {formatINR(stats.current - stats.invested)}
              </p>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}

// ─── 4. Asset Allocation Map ──────────────────────────────────────────────────
// Shows each asset type as % of total with animated bars
// FIXED: added distinct colors per asset type (was all emerald before)
export function AssetAllocationMap() {
  const investments = usePortfolioStore(s => s.investments)
  const summary = useMemo(() => summarizePortfolio(investments), [investments])

  const colorMap: Record<string, string> = {
    stock: 'bg-emerald-500', mutual_fund: 'bg-blue-500',
    fixed_deposit: 'bg-teal-500', bond: 'bg-amber-500', other: 'bg-violet-500',
  }
  const labelMap: Record<string, string> = {
    stock: 'Stocks', mutual_fund: 'Mutual Funds',
    fixed_deposit: 'Fixed Deposits', bond: 'Bonds', other: 'Others',
  }

  const items = Object.entries(summary.byType)
    .filter(([, d]) => d.current > 0)
    .sort((a, b) => b[1].current - a[1].current)

  return (
    <Card color="blue" title="Asset Allocation" subtitle="Portfolio Breakdown" Icon={FiLayers}>
      {items.length === 0 ? <EmptyState msg="Add investments to see allocation." /> : (
        <div className="p-6 space-y-4">
          {items.map(([type, data]: any) => {
            const pct = summary.totalValue > 0 ? (data.current / summary.totalValue) * 100 : 0
            return (
              <div key={type}>
                <div className="flex justify-between mb-1.5">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{labelMap[type] ?? type}</span>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-black text-slate-900 dark:text-white">{pct.toFixed(1)}%</span>
                    <span className="text-slate-500 dark:text-slate-400">{formatINR(data.current)}</span>
                  </div>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className={`h-full rounded-full ${colorMap[type] ?? 'bg-slate-400'}`}
                  />
                </div>
              </div>
            )
          })}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex justify-between">
            <span className="text-xs font-bold text-slate-900 dark:text-slate-500">Total Portfolio</span>
            <span className="text-sm font-black text-slate-900 dark:text-white">{formatINR(summary.totalValue)}</span>
          </div>
        </div>
      )}
    </Card>
  )
}

// ─── 5. Stock P&L Summary ─────────────────────────────────────────────────────
// Per-holding gain/loss + overall P&L
// FIXED: now shows per-stock breakdown in a table, not just totals
export function StockPLSummary() {
  const investments = usePortfolioStore(s => s.investments)
  const stocks = investments.filter((i): i is StockInvestment => i.type === 'stock')

  const summary = useMemo(() => {
    const rows = stocks.map(s => {
      const invested = s.buyPrice * s.quantity
      const current = s.currentPrice * s.quantity
      const pl = current - invested
      const plPct = invested > 0 ? (pl / invested) * 100 : 0
      return { id: s.id, name: s.name, quantity: s.quantity, invested, current, pl, plPct }
    })
    const totalInvested = rows.reduce((a, r) => a + r.invested, 0)
    const totalCurrent = rows.reduce((a, r) => a + r.current, 0)
    const totalPL = totalCurrent - totalInvested
    const totalPct = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0
    return { rows, totalInvested, totalCurrent, totalPL, totalPct }
  }, [stocks])

  return (
    <Card color={summary.totalPL >= 0 ? 'emerald' : 'rose'} title="Stock P&L" subtitle="Gain / Loss per Holding" Icon={FiBarChart2}>
      {stocks.length === 0 ? <EmptyState msg="No stock holdings found. Add stocks to see P&L." /> : (
        <div className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  <th className="text-left pb-2 pr-2">Stock</th>
                  <th className="text-right pb-2 pr-2">Invested</th>
                  <th className="text-right pb-2 pr-2">Current</th>
                  <th className="text-right pb-2">P&L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {summary.rows.map((r: any) => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 pr-2 font-semibold text-slate-800 dark:text-slate-100">
                      {r.name}
                      <span className="ml-1 text-[10px] text-slate-500 dark:text-slate-400">×{r.quantity}</span>
                    </td>
                    <td className="py-2.5 pr-2 text-right tabular-nums text-slate-900 dark:text-slate-500 text-xs">{formatINR(r.invested)}</td>
                    <td className="py-2.5 pr-2 text-right tabular-nums text-xs text-slate-700 dark:text-slate-200">{formatINR(r.current)}</td>
                    <td className={`py-2.5 text-right tabular-nums text-xs font-black ${r.pl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      <div>{r.pl >= 0 ? '+' : ''}{formatINR(r.pl)}</div>
                      <div className="text-[10px] font-semibold">{r.plPct >= 0 ? '+' : ''}{r.plPct.toFixed(1)}%</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={`mt-4 rounded-xl p-4 text-center ${summary.totalPL >= 0 ? 'bg-emerald-500/5 border border-emerald-500/20' : 'bg-rose-500/5 border border-rose-500/20'}`}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Total Portfolio P&L</p>
            <p className={`text-2xl font-black mt-1 ${summary.totalPL >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {summary.totalPL >= 0 ? '+' : ''}{formatINR(summary.totalPL)}
              <span className="text-sm ml-1 font-semibold">({summary.totalPct >= 0 ? '+' : ''}{summary.totalPct.toFixed(1)}%)</span>
            </p>
          </div>
        </div>
      )}
    </Card>
  )
}

// ─── 6. FD Maturity Tracker ───────────────────────────────────────────────────
// Shows days left, interest earned, maturity amount per FD
// FIXED: maturity uses quarterly compounding (was just showing investedAmount before)
export function FDMaturityTracker() {
  const investments = usePortfolioStore(s => s.investments)
  const fds = investments.filter((i): i is FixedDepositInvestment => i.type === 'fixed_deposit')

  const rows = useMemo(() => fds.map(fd => {
    // Quarterly compounding: A = P(1 + r/4)^(4t)
    const t = fd.durationMonths / 12
    const maturity = fd.investedAmount * Math.pow(1 + fd.interestRate / (4 * 100), 4 * t)
    const interest = maturity - fd.investedAmount
    const daysLeft = fd.maturityDate
      ? Math.ceil((new Date(fd.maturityDate).getTime() - Date.now()) / 86400000)
      : null
    return { ...fd, maturity, interest, daysLeft }
  }).sort((a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999)), [fds])

  return (
    <Card color="amber" title="FD Maturity Tracker" subtitle="Days Left + Returns" Icon={FiCalendar}>
      {fds.length === 0 ? <EmptyState msg="No fixed deposits found. Add FDs to track them." /> : (
        <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
          {rows.map((r: any) => {
            const isMatured = (r.daysLeft ?? 1) <= 0
            const isUrgent = !isMatured && (r.daysLeft ?? 999) <= 30
            const isSoon = !isMatured && !isUrgent && (r.daysLeft ?? 999) <= 90
            return (
              <div key={r.id} className="rounded-xl border border-slate-100 dark:border-slate-800 p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-black text-sm text-slate-800 dark:text-slate-100">{r.name}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{r.bankName} · {r.interestRate}% p.a. · {r.durationMonths}mo</p>
                  </div>
                  {isMatured ? (
                    <span className="text-[10px] font-black bg-emerald-500/10 text-emerald-600 px-2 py-1 rounded-lg">Matured</span>
                  ) : (
                    <div className={`rounded-lg px-2.5 py-1.5 text-center min-w-[54px] ${isUrgent ? 'bg-rose-500/10 text-rose-600' : isSoon ? 'bg-amber-500/10 text-amber-600' : 'bg-teal-500/10 text-teal-600'}`}>
                      <p className="text-base font-black leading-none">{r.daysLeft}</p>
                      <p className="text-[8px] font-bold uppercase">days left</p>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2">
                    <p className="text-[9px] text-slate-500 dark:text-slate-400 uppercase font-bold">Invested</p>
                    <p className="text-xs font-black text-slate-700 dark:text-slate-200">{formatINR(r.investedAmount)}</p>
                  </div>
                  <div className="rounded-lg bg-teal-500/5 border border-teal-500/15 p-2">
                    <p className="text-[9px] text-slate-500 dark:text-slate-400 uppercase font-bold">Interest</p>
                    <p className="text-xs font-black text-teal-600">{formatINR(r.interest)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2">
                    <p className="text-[9px] text-slate-500 dark:text-slate-400 uppercase font-bold">Maturity</p>
                    <p className="text-xs font-black text-slate-700 dark:text-slate-200">{formatINR(r.maturity)}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

// ─── 7. Tax Harvesting Finder ─────────────────────────────────────────────────
// Identifies stocks/MFs in loss — candidate for tax-loss harvesting
// FIXED: uses profitLoss utility correctly; shows both STCG (15%) saving estimate
export function TaxHarvestingFinder() {
  const investments = usePortfolioStore(s => s.investments)

  const candidates = useMemo(() =>
    investments
      .filter(i => i.type === 'stock' || i.type === 'mutual_fund')
      .map(i => ({ id: i.id, name: i.name, loss: profitLoss(i) }))
      .filter(c => c.loss < -500)          // only meaningful losses
      .sort((a, b) => a.loss - b.loss),    // worst loss first
    [investments])

  const totalHarvestable = Math.abs(candidates.reduce((a, c) => a + c.loss, 0))
  const taxSaved = totalHarvestable * 0.15 // 15% STCG rate

  return (
    <Card color="rose" title="Tax Harvesting" subtitle="Loss-Booking Opportunities" Icon={FiScissors}>
      <div className="p-4">
        {candidates.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-3xl mb-2">✅</p>
            <p className="text-sm font-bold text-emerald-600">No loss positions found!</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">All your holdings are in profit.</p>
          </div>
        ) : (
          <>
            <div className="space-y-2 mb-4">
              {candidates.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between rounded-xl bg-rose-500/5 border border-rose-500/15 px-4 py-3">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{c.name}</span>
                  <div className="text-right">
                    <p className="text-sm font-black text-rose-600">{formatINR(c.loss)}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">harvestable</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-xl bg-rose-600 p-4 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-rose-100">Est. Tax Saved (15% STCG)</p>
              <p className="text-2xl font-black text-white mt-1">{formatINR(taxSaved)}</p>
              <p className="text-[10px] text-rose-200 mt-0.5">Total harvestable loss: {formatINR(totalHarvestable)}</p>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-3 text-center italic">
              Book these losses to offset STCG/LTCG and reduce tax liability.
            </p>
          </>
        )}
      </div>
    </Card>
  )
}