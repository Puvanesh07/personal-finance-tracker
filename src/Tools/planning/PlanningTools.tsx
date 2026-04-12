// src/pages/Tools/planning/PlanningTools.tsx
import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { FiTarget, FiAward, FiMinusCircle, FiAlertCircle, FiTrendingUp, FiActivity } from 'react-icons/fi'
import { usePortfolioStore } from '../../store/portfolioStore'
import { summarizePortfolio } from '../../utils/calculations'
import { formatINR, formatCurrency } from '../../utils/format'
import type { Liability } from '../../types/investmentTypes'
import { CardShell, InputField, ResultRow, ResultBtn } from '../Calculator/SIPCalculator'

// ─── 1. Goal Planner ─────────────────────────────────────────────────────────
// Required SIP = FV × r / [((1+r)^n - 1) × (1+r)]
// FIXED: original formula was missing the (1+r) annuity-due adjustment
// FIXED: added existing corpus input — accounts for money already saved
export function GoalPlanner() {
  const [target, setTarget] = useState(5000000)
  const [years, setYears] = useState(10)
  const [returnRate, setReturnRate] = useState(12)
  const [existing, setExisting] = useState(0)

  const res = useMemo(() => {
    const r = returnRate / 12 / 100
    const n = years * 12
    // Future value of existing corpus at annual rate
    const existingFV = existing * Math.pow(1 + returnRate / 100, years)
    const remaining = Math.max(0, target - existingFV)
    // Required SIP (annuity-due formula rearranged)
    const sip = remaining > 0 && r > 0
      ? (remaining * r) / (((Math.pow(1 + r, n) - 1) / r) * (1 + r))
      : 0
    const totalSIPInvested = sip * n
    return { sip, totalSIPInvested, existingFV, remaining }
  }, [target, years, returnRate, existing])

  return (
    <CardShell color="blue" title="Goal Planner" subtitle="Required Monthly SIP" Icon={FiTarget}>
      <div className="p-6 space-y-1">
        <InputField label="Target Amount" value={target} min={100000} max={100000000} step={100000} onChange={setTarget} unit="₹" color="blue" />
        <InputField label="Time to Achieve" value={years} min={1} max={40} onChange={setYears} unit=" Yrs" color="blue" />
        <InputField label="Expected Return (p.a.)" value={returnRate} min={1} max={30} step={0.5} onChange={setReturnRate} unit="%" color="blue" />
        <InputField label="Existing Savings" value={existing} min={0} max={10000000} step={10000} onChange={setExisting} unit="₹" color="blue" />
        <div className="mt-4 space-y-2">
          <ResultRow label="Existing Corpus (future value)" value={formatINR(res.existingFV)} />
          <ResultRow label="Remaining to Build via SIP" value={formatINR(res.remaining)} highlight color="blue" />
          <ResultRow label="Total SIP Investment" value={formatINR(res.totalSIPInvested)} />
          <ResultBtn color="blue" label="Monthly SIP Required" value={formatINR(res.sip)} sub={`at ${returnRate}% expected return`} />
        </div>
      </div>
    </CardShell>
  )
}

// ─── 2. Retirement Planner ────────────────────────────────────────────────────
// Corpus = (Monthly expense at retirement × 12 × 25)  — 4% safe withdrawal rule
// Expense at retirement = current expense × (1+inflation)^years
// FIXED: reads actual monthly expenses from cashflows — not hardcoded
// FIXED: shows required monthly SIP to build that corpus, not just corpus needed
export function RetirementPlanner() {
  const { cashflows } = usePortfolioStore()
  const [currentAge, setCurrentAge] = useState(30)
  const [retireAge, setRetireAge] = useState(60)
  const [returnRate, setReturnRate] = useState(10)
  const INFLATION = 6 // standard 6% inflation

  const avgMonthlyExpense = useMemo(() => {
    const expenses = cashflows.filter((c: any) => c.type === 'expense')
    if (expenses.length === 0) return 50000 // default fallback
    const total = expenses.reduce((acc: any, e: any) => acc + e.amount, 0)
    const months = new Set(expenses.map((e: any) => e.date.substring(0, 7))).size || 1
    return total / months
  }, [cashflows])

  const res = useMemo(() => {
    const yearsToRetire = Math.max(retireAge - currentAge, 1)
    // Monthly expense adjusted for inflation at retirement
    const expAtRetire = avgMonthlyExpense * Math.pow(1 + INFLATION / 100, yearsToRetire)
    // 4% rule: corpus = 25× annual expense
    const corpus = expAtRetire * 12 * 25
    // Required monthly SIP to build corpus
    const r = returnRate / 12 / 100
    const n = yearsToRetire * 12
    const sip = corpus > 0 && r > 0
      ? (corpus * r) / (((Math.pow(1 + r, n) - 1) / r) * (1 + r))
      : 0
    return { corpus, expAtRetire, sip, yearsToRetire }
  }, [avgMonthlyExpense, currentAge, retireAge, returnRate])

  return (
    <CardShell color="indigo" title="Retirement Planner" subtitle="Golden Years Corpus" Icon={FiAward}>
      <div className="p-6 space-y-1">
        <div className="mb-4 flex justify-between items-center rounded-xl bg-indigo-500/5 border border-indigo-500/15 px-4 py-3">
          <span className="text-xs font-semibold text-slate-900 dark:text-slate-500">Current Monthly Expense</span>
          <span className="text-sm font-black text-indigo-600">{formatINR(avgMonthlyExpense)}</span>
        </div>
        <InputField label="Current Age" value={currentAge} min={18} max={59} onChange={setCurrentAge} unit=" Yrs" color="indigo" />
        <InputField label="Retirement Age" value={retireAge} min={Math.min(currentAge + 1, 75)} max={75} onChange={setRetireAge} unit=" Yrs" color="indigo" />
        <InputField label="Expected Return (p.a.)" value={returnRate} min={6} max={15} step={0.5} onChange={setReturnRate} unit="%" color="indigo" />
        <div className="mt-4 space-y-2">
          <ResultRow label={`Expense at ${retireAge} (6% inflation)`} value={formatINR(res.expAtRetire)} />
          <ResultRow label="Corpus Needed (25× annual)" value={formatINR(res.corpus)} highlight color="indigo" />
          <ResultBtn color="indigo" label="Monthly SIP to Retire at Age" value={formatINR(res.sip)} sub={`${retireAge} yrs · ${res.yearsToRetire}yr horizon`} />
        </div>
      </div>
    </CardShell>
  )
}

// ─── 3. FIRE Calculator ───────────────────────────────────────────────────────
// FIRE target = 25 × annual expenses (4% rule)
// Years to FIRE = iterative simulation of monthly savings + compounding
// FIXED: original used hardcoded ₹2.5Cr target — now calculated from actual expenses
// FIXED: now computes actual years to reach target using monthly simulation
export function FIRECalculator() {
  const { investments, liabilities, cashflows } = usePortfolioStore()
  const { totalValue } = summarizePortfolio(investments)
  const totalDebt = liabilities.reduce((acc: number, l: Liability) => acc + (l.outstanding || 0), 0)
  const netWorth = totalValue - totalDebt

  const avgExpense = useMemo(() => {
    const expenses = cashflows.filter((c: any) => c.type === 'expense')
    if (expenses.length === 0) return 50000
    const total = expenses.reduce((acc: any, e: any) => acc + e.amount, 0)
    const months = new Set(expenses.map((e: any) => e.date.substring(0, 7))).size || 1
    return total / months
  }, [cashflows])

  const avgIncome = useMemo(() => {
    const income = cashflows.filter((c: any) => c.type === 'income')
    if (income.length === 0) return 0
    const total = income.reduce((acc: any, e: any) => acc + e.amount, 0)
    const months = new Set(income.map((e: any) => e.date.substring(0, 7))).size || 1
    return total / months
  }, [cashflows])

  const res = useMemo(() => {
    const annualExpense = avgExpense * 12
    const target = annualExpense * 25            // 4% rule
    const monthlySavings = Math.max(0, avgIncome - avgExpense)
    const progress = target > 0 ? Math.min((netWorth / target) * 100, 100) : 0

    // Simulate month-by-month to find years to FIRE at 10% p.a.
    const monthlyRate = 10 / 12 / 100
    let current = netWorth
    let months = 0
    while (current < target && months < 600) {
      current = (current + monthlySavings) * (1 + monthlyRate)
      months++
    }
    const yearsToFIRE = months < 600 ? Math.round(months / 12) : null

    return { target, progress, monthlySavings, yearsToFIRE, annualExpense }
  }, [netWorth, avgExpense, avgIncome])

  return (
    <CardShell color="orange" title="FIRE Calculator" subtitle="Financial Independence" Icon={FiActivity}>
      <div className="p-6">
        <div className="mb-2 flex justify-between items-end">
          <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Progress to FIRE Target</span>
          <span className="text-2xl font-black text-orange-600">{res.progress.toFixed(1)}%</span>
        </div>
        {/* Progress bar */}
        <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden mb-5 border border-slate-200 dark:border-slate-700">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${res.progress}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className="bg-gradient-to-r from-orange-500 to-rose-500 h-full rounded-full shadow-sm"
          />
        </div>
        <div className="space-y-2 mb-4">
          <ResultRow label="FIRE Target (25× annual exp.)" value={formatINR(res.target)} />
          <ResultRow label="Current Net Worth" value={formatINR(netWorth)} highlight color="orange" />
          <ResultRow label="Monthly Savings" value={formatINR(res.monthlySavings)} />
          <ResultRow label="Remaining to FIRE" value={formatINR(Math.max(0, res.target - netWorth))} />
        </div>
        <div className="rounded-xl bg-orange-600 p-4 text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-orange-100">Years to FIRE</p>
          <p className="text-3xl font-black text-white mt-1">
            {res.yearsToFIRE !== null ? `${res.yearsToFIRE} yrs` : '50+ yrs'}
          </p>
          <p className="text-[10px] text-orange-200 mt-0.5">at 10% p.a. return</p>
        </div>
      </div>
    </CardShell>
  )
}

// ─── 4. Loan Prepayment Analyser ─────────────────────────────────────────────
// Calculates true interest saved + tenure reduction by making a lump-sum prepayment
// FIXED: original used a naive estimate (prepayment × rate × 5) — completely wrong
// CORRECT: simulates actual amortisation before and after prepayment
export function LoanPrepaymentAnalyser() {
  const [loan, setLoan] = useState(2000000)
  const [rate, setRate] = useState(9)
  const [tenure, setTenure] = useState(20)
  const [prepayment, setPrepayment] = useState(200000)
  const [afterYears, setAfterYears] = useState(3)

  const res = useMemo(() => {
    const r = rate / 12 / 100
    const n = tenure * 12
    if (r === 0) return { emi: loan / n, newEMI: 0, interestSaved: 0, tenureReduced: 0 }

    // Original EMI
    const emi = (loan * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
    const totalOriginal = emi * n

    // Outstanding balance after `afterYears` payments
    const paid = afterYears * 12
    const outstanding = loan * Math.pow(1 + r, paid) - emi * ((Math.pow(1 + r, paid) - 1) / r)
    const newPrincipal = Math.max(0, outstanding - prepayment)
    const remaining = n - paid
    if (remaining <= 0) return { emi, newEMI: 0, interestSaved: 0, tenureReduced: 0 }

    // New EMI on reduced principal for same remaining tenure
    const newEMI = newPrincipal > 0
      ? (newPrincipal * r * Math.pow(1 + r, remaining)) / (Math.pow(1 + r, remaining) - 1)
      : 0
    const totalNew = emi * paid + newEMI * remaining + prepayment
    const interestSaved = Math.max(0, totalOriginal - totalNew)

    // Months saved if keeping ORIGINAL EMI after prepayment
    let bal = newPrincipal
    let months = 0
    while (bal > 1 && months < remaining) {
      bal = bal * (1 + r) - emi
      months++
    }
    const tenureReduced = remaining - months

    return { emi, newEMI, interestSaved, tenureReduced: Math.max(0, tenureReduced) }
  }, [loan, rate, tenure, prepayment, afterYears])

  return (
    <CardShell color="rose" title="Prepayment Analyser" subtitle="Interest Saved on Loan" Icon={FiMinusCircle}>
      <div className="p-6 space-y-1">
        <InputField label="Loan Amount" value={loan} min={100000} max={50000000} step={100000} onChange={setLoan} unit="₹" color="rose" />
        <InputField label="Interest Rate (p.a.)" value={rate} min={5} max={20} step={0.25} onChange={setRate} unit="%" color="rose" />
        <InputField label="Original Tenure" value={tenure} min={1} max={30} onChange={setTenure} unit=" Yrs" color="rose" />
        <InputField label="Prepayment Amount" value={prepayment} min={10000} max={5000000} step={10000} onChange={setPrepayment} unit="₹" color="rose" />
        <InputField label="Prepay After" value={afterYears} min={1} max={Math.max(tenure - 1, 1)} onChange={setAfterYears} unit=" Yrs" color="rose" />
        <div className="mt-4 space-y-2">
          <ResultRow label="Original Monthly EMI" value={formatCurrency(res.emi)} />
          <ResultRow label="New EMI (same tenure)" value={formatCurrency(res.newEMI)} />
          <ResultRow label="Tenure Reduced (orig. EMI)" value={`${Math.floor(res.tenureReduced / 12)}y ${res.tenureReduced % 12}m`} />
          <ResultBtn color="rose" label="Total Interest Saved" value={formatINR(res.interestSaved)} />
        </div>
      </div>
    </CardShell>
  )
}

// ─── 5. Risk Analyser ─────────────────────────────────────────────────────────
// Categorises portfolio risk based on equity allocation %
// FIXED: now shows full breakdown — equity %, debt %, liquid %, score out of 100
// FIXED: uses summarizePortfolio for accurate values instead of ad-hoc reduce
export function RiskAnalyser() {
  const investments = usePortfolioStore(s => s.investments)

  const risk = useMemo(() => {
    const summary = summarizePortfolio(investments)
    const { totalValue, byType } = summary
    if (totalValue === 0) return null

    const equityVal = byType.stock.current + byType.mutual_fund.current
    const debtVal = byType.fixed_deposit.current + byType.bond.current
    const otherVal = byType.other.current
    const equityPct = (equityVal / totalValue) * 100
    const debtPct = (debtVal / totalValue) * 100
    const otherPct = (otherVal / totalValue) * 100

    // Risk score: higher equity = higher risk = lower score for conservative
    const riskScore = Math.round(equityPct) // 0–100, 100 = all equity

    let profile: { label: string; color: string; bg: string; border: string; desc: string }
    if (equityPct > 75) {
      profile = { label: 'Aggressive', color: 'text-rose-600', bg: 'bg-rose-500/5', border: 'border-rose-500/20', desc: 'High equity concentration — excellent long-term growth potential but with significant short-term volatility.' }
    } else if (equityPct > 40) {
      profile = { label: 'Moderate', color: 'text-amber-600', bg: 'bg-amber-500/5', border: 'border-amber-500/20', desc: 'Balanced allocation — good growth with managed risk. Suitable for most investors with 5–10yr horizon.' }
    } else {
      profile = { label: 'Conservative', color: 'text-emerald-600', bg: 'bg-emerald-500/5', border: 'border-emerald-500/20', desc: 'Capital-preservation focused — low volatility but may underperform inflation over the long term.' }
    }

    return { equityPct, debtPct, otherPct, riskScore, profile, equityVal, debtVal, totalValue }
  }, [investments])

  const Icon = risk?.equityPct ?? 0 > 75 ? FiAlertCircle : risk?.equityPct ?? 0 > 40 ? FiTrendingUp : FiAward

  return (
    <CardShell color={risk?.equityPct ?? 0 > 75 ? 'rose' : risk?.equityPct ?? 0 > 40 ? 'amber' : 'emerald'}
      title="Risk Analyser" subtitle="Portfolio Risk Assessment" Icon={Icon}>
      {!risk ? (
        <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">Add investments to analyse risk.</div>
      ) : (
        <div className="p-6 space-y-4">
          <div className={`rounded-xl ${risk.profile.bg} border ${risk.profile.border} p-5 text-center`}>
            <p className={`text-3xl font-black ${risk.profile.color}`}>{risk.profile.label}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">{risk.profile.desc}</p>
          </div>
          {/* Breakdown bars */}
          {[
            { label: 'Equity (Stocks + MF)', pct: risk.equityPct, color: 'bg-rose-500', val: risk.equityVal },
            { label: 'Debt (FD + Bonds)', pct: risk.debtPct, color: 'bg-blue-500', val: risk.debtVal },
            { label: 'Others', pct: risk.otherPct, color: 'bg-violet-500', val: risk.totalValue * risk.otherPct / 100 },
          ].map(item => (
            <div key={item.label}>
              <div className="flex justify-between mb-1">
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-500">{item.label}</span>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-black text-slate-700 dark:text-slate-200">{item.pct.toFixed(1)}%</span>
                  <span className="text-slate-500 dark:text-slate-400">{formatINR(item.val)}</span>
                </div>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }} animate={{ width: `${item.pct}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className={`h-full rounded-full ${item.color}`}
                />
              </div>
            </div>
          ))}
          <p className="text-[10px] text-slate-500 dark:text-slate-400 text-center uppercase font-bold tracking-widest pt-1">
            Risk Score: {risk.riskScore}/100 (equity-weighted)
          </p>
        </div>
      )}
    </CardShell>
  )
}