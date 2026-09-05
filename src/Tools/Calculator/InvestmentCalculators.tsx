// src/pages/Tools/Calculator/InvestmentCalculators.tsx
import { useState, useMemo } from 'react'
import {
  FiWind, FiTrendingUp, FiHome,
  FiCalendar, FiActivity, FiBriefcase, FiShield,
} from 'react-icons/fi'
import { formatCurrency, formatINR } from '../../utils/format'
import { CardShell, InputField, ResultRow, ResultBtn } from './SIPCalculator'

// ─── 1. Lumpsum ───────────────────────────────────────────────────────────────
// FV = PV × (1 + r)^n  — annual compounding
export function LumpsumCalculator() {
  const [amt, setAmt] = useState(100000)
  const [rate, setRate] = useState(12)
  const [years, setYears] = useState(10)

  const res = useMemo(() => {
    const maturity = amt * Math.pow(1 + rate / 100, years)
    const gains = maturity - amt
    const absReturn = amt > 0 ? (gains / amt) * 100 : 0
    return { maturity, gains, absReturn }
  }, [amt, rate, years])

  return (
    <CardShell color="blue" title="Lumpsum" subtitle="One-Time Investment" Icon={FiTrendingUp}>
      <div className="p-6 space-y-1">
        <InputField label="Investment Amount" value={amt} min={5000} max={10000000} step={5000} onChange={setAmt} unit="₹" color="blue" />
        <InputField label="Expected Return (p.a.)" value={rate} min={1} max={30} step={0.5} onChange={setRate} unit="%" color="blue" />
        <InputField label="Time Period" value={years} min={1} max={40} onChange={setYears} unit=" Yrs" color="blue" />
        <div className="mt-4 space-y-2">
          <ResultRow label="Amount Invested" value={formatINR(amt)} />
          <ResultRow label="Wealth Gained" value={formatINR(res.gains)} highlight color="blue" />
          <ResultRow label="Absolute Return" value={`${res.absReturn.toFixed(1)}%`} />
          <ResultBtn color="blue" label="Future Value" value={formatINR(res.maturity)} />
        </div>
      </div>
    </CardShell>
  )
}

// ─── 2. FD Calculator ────────────────────────────────────────────────────────
// Quarterly compounding: A = P × (1 + r/4)^(4×t)
// FIXED: was simple interest P + PRT/100 — wrong for FDs
export function FDCalculator() {
  const [principal, setPrincipal] = useState(100000)
  const [rate, setRate] = useState(7)
  const [years, setYears] = useState(5)

  const res = useMemo(() => {
    const maturity = principal * Math.pow(1 + rate / (4 * 100), 4 * years)
    const interest = maturity - principal
    // Effective annual rate from quarterly compounding
    const effectiveRate = (Math.pow(1 + rate / (4 * 100), 4) - 1) * 100
    return { maturity, interest, effectiveRate }
  }, [principal, rate, years])

  return (
    <CardShell color="teal" title="Fixed Deposit" subtitle="Quarterly Compounding" Icon={FiCalendar}>
      <div className="p-6 space-y-1">
        <InputField label="Principal Amount" value={principal} min={10000} max={10000000} step={10000} onChange={setPrincipal} unit="₹" color="teal" />
        <InputField label="Interest Rate (p.a.)" value={rate} min={3} max={10} step={0.1} onChange={setRate} unit="%" color="teal" />
        <InputField label="Tenure" value={years} min={1} max={20} onChange={setYears} unit=" Yrs" color="teal" />
        <div className="mt-4 space-y-2">
          <ResultRow label="Principal" value={formatINR(principal)} />
          <ResultRow label="Interest Earned" value={formatINR(res.interest)} highlight color="teal" />
          <ResultRow label="Effective Annual Rate" value={`${res.effectiveRate.toFixed(2)}%`} />
          <ResultBtn color="teal" label="Maturity Amount" value={formatINR(res.maturity)} />
        </div>
      </div>
    </CardShell>
  )
}

// ─── 3. EMI Calculator ────────────────────────────────────────────────────────
// EMI = P × r × (1+r)^n / ((1+r)^n - 1)   r = monthly rate, n = months
// FIXED: was missing interest rate slider in original
export function EMICalculator() {
  const [loan, setLoan] = useState(1000000)
  const [rate, setRate] = useState(9)
  const [tenure, setTenure] = useState(15)

  const res = useMemo(() => {
    const r = rate / 12 / 100
    const n = tenure * 12
    const emi = (loan * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
    const totalPayable = emi * n
    const totalInterest = totalPayable - loan
    const interestPct = totalPayable > 0 ? (totalInterest / totalPayable) * 100 : 0
    return { emi, totalPayable, totalInterest, interestPct }
  }, [loan, rate, tenure])

  return (
    <CardShell color="amber" title="EMI Calculator" subtitle="Loan Repayment" Icon={FiHome}>
      <div className="p-6 space-y-1">
        <InputField label="Loan Amount" value={loan} min={100000} max={50000000} step={50000} onChange={setLoan} unit="₹" color="amber" />
        <InputField label="Interest Rate (p.a.)" value={rate} min={5} max={24} step={0.25} onChange={setRate} unit="%" color="amber" />
        <InputField label="Loan Tenure" value={tenure} min={1} max={30} onChange={setTenure} unit=" Yrs" color="amber" />
        <div className="mt-4 space-y-2">
          <ResultRow label="Total Interest" value={formatINR(res.totalInterest)} highlight color="amber" />
          <ResultRow label="Total Payable" value={formatINR(res.totalPayable)} />
          <ResultRow label="Interest % of Total" value={`${res.interestPct.toFixed(1)}%`} />
          <ResultBtn color="amber" label="Monthly EMI" value={formatCurrency(res.emi)} />
        </div>
      </div>
    </CardShell>
  )
}

// ─── 4. PPF Calculator ────────────────────────────────────────────────────────
// Annuity-due (deposit at START of year): FV = P × [((1+r)^n - 1) / r] × (1+r)
// FIXED: PPF rate is govt-fixed at 7.1% — removed editable rate slider
// FIXED: min tenure 15 yrs, extensions in blocks of 5
export function PPFCalculator() {
  const [yearly, setYearly] = useState(150000)
  const [years, setYears] = useState(15)
  const RATE = 7.1 // Government-mandated, not user-editable

  const res = useMemo(() => {
    const r = RATE / 100
    const maturity = yearly * ((Math.pow(1 + r, years) - 1) / r) * (1 + r)
    const invested = yearly * years
    const gains = maturity - invested
    return { maturity, invested, gains }
  }, [yearly, years])

  return (
    <CardShell color="emerald" title="PPF Calculator" subtitle="Public Provident Fund" Icon={FiShield}>
      <div className="p-6 space-y-1">
        <div className="mb-4 flex items-center justify-between rounded-xl bg-emerald-500/5 border border-emerald-500/15 px-4 py-3">
          <span className="text-xs font-semibold text-slate-900 dark:text-slate-500">Govt. Fixed PPF Rate</span>
          <span className="text-sm font-black text-emerald-600">7.1% p.a.</span>
        </div>
        <InputField label="Yearly Deposit (max ₹1.5L)" value={yearly} min={500} max={150000} step={500} onChange={setYearly} unit="₹" color="emerald" />
        <InputField label="Tenure (min 15, +5 blocks)" value={years} min={15} max={50} step={5} onChange={setYears} unit=" Yrs" color="emerald" />
        <div className="mt-4 space-y-2">
          <ResultRow label="Total Deposited" value={formatINR(res.invested)} />
          <ResultRow label="Interest Earned" value={formatINR(res.gains)} highlight color="emerald" />
          <ResultRow label="80C Benefit/yr" value={`Up to ${formatINR(Math.min(yearly, 150000))}`} />
          <ResultBtn color="emerald" label="Maturity Amount" value={formatINR(res.maturity)} />
        </div>
      </div>
    </CardShell>
  )
}

// ─── 5. NPS Calculator ───────────────────────────────────────────────────────
// Corpus via monthly SIP formula to age 60
// 40% mandatory annuity → pension; 60% tax-free lump sum
// FIXED: original showed pension from full corpus — must use only 40% annuity portion
export function NPSCalculator() {
  const [monthly, setMonthly] = useState(10000)
  const [age, setAge] = useState(30)
  const [returnRate, setReturnRate] = useState(10)

  const res = useMemo(() => {
    const r = returnRate / 12 / 100
    const n = (60 - age) * 12
    if (n <= 0) return { corpus: 0, lumpsum: 0, pension: 0, invested: 0, annuity: 0 }
    const corpus = monthly * ((Math.pow(1 + r, n) - 1) / r) * (1 + r)
    const invested = monthly * n
    const annuity = corpus * 0.4              // 40% mandatory — goes to annuity
    const lumpsum = corpus * 0.6             // 60% tax-free withdrawal
    const pension = (annuity * 0.06) / 12    // 6% annuity rate, monthly
    return { corpus, lumpsum, pension, invested, annuity }
  }, [monthly, age, returnRate])

  return (
    <CardShell color="blue" title="NPS Calculator" subtitle="National Pension Scheme" Icon={FiBriefcase}>
      <div className="p-6 space-y-1">
        <InputField label="Monthly Contribution" value={monthly} min={500} max={100000} step={500} onChange={setMonthly} unit="₹" color="blue" />
        <InputField label="Current Age" value={age} min={18} max={59} onChange={setAge} unit=" Yrs" color="blue" />
        <InputField label="Expected Return (p.a.)" value={returnRate} min={6} max={14} step={0.5} onChange={setReturnRate} unit="%" color="blue" />
        <div className="mt-4 space-y-2">
          <ResultRow label="Total Invested" value={formatINR(res.invested)} />
          <ResultRow label="Total Corpus at 60" value={formatINR(res.corpus)} highlight color="blue" />
          <ResultRow label="Lump Sum (60%)" value={formatINR(res.lumpsum)} />
          <ResultRow label="Annuity Corpus (40%)" value={formatINR(res.annuity)} />
          <ResultBtn color="blue" label="Est. Monthly Pension" value={formatINR(res.pension)} sub="at 6% annuity rate" />
        </div>
      </div>
    </CardShell>
  )
}

// ─── 6. Inflation Adjuster ────────────────────────────────────────────────────
// Real value = Amount / (1+r)^n  (what today's money buys in future)
// Future cost = Amount × (1+r)^n  (how much same thing costs in future)
// FIXED: original only showed eroded value — added future cost calculation
export function InflationAdjuster() {
  const [amount, setAmount] = useState(100000)
  const [rate, setRate] = useState(6)
  const [years, setYears] = useState(10)

  const res = useMemo(() => {
    const realValue = amount / Math.pow(1 + rate / 100, years)
    const futureCost = amount * Math.pow(1 + rate / 100, years)
    const erosion = amount > 0 ? ((amount - realValue) / amount) * 100 : 0
    return { realValue, futureCost, erosion }
  }, [amount, rate, years])

  return (
    <CardShell color="rose" title="Inflation Adjuster" subtitle="Purchasing Power" Icon={FiWind}>
      <div className="p-6 space-y-1">
        <InputField label="Today's Amount" value={amount} min={10000} max={10000000} step={10000} onChange={setAmount} unit="₹" color="rose" />
        <InputField label="Inflation Rate (p.a.)" value={rate} min={1} max={15} step={0.5} onChange={setRate} unit="%" color="rose" />
        <InputField label="Years Ahead" value={years} min={1} max={40} onChange={setYears} unit=" Yrs" color="rose" />
        <div className="mt-4 space-y-2">
          <ResultRow label={`₹${amount.toLocaleString('en-IN')} feels like in ${years}yr`} value={formatINR(res.realValue)} highlight color="rose" />
          <ResultRow label="Future cost of same item" value={formatINR(res.futureCost)} />
          <ResultRow label="Purchasing Power Eroded" value={`${res.erosion.toFixed(1)}%`} />
          <ResultBtn color="rose" label={`Need in ${years} yrs (same lifestyle)`} value={formatINR(res.futureCost)} />
        </div>
      </div>
    </CardShell>
  )
}

// ─── 7. CAGR Calculator ───────────────────────────────────────────────────────
// CAGR = (Final/Initial)^(1/years) - 1
// FIXED: original used range sliders — too imprecise for rupee values
// FIXED: added divide-by-zero guard
export function CAGRCalculator() {
  const [initial, setInitial] = useState('100000')
  const [final, setFinal] = useState('250000')
  const [years, setYears] = useState(5)

  const res = useMemo(() => {
    const i = parseFloat(initial) || 0
    const f = parseFloat(final) || 0
    if (i <= 0 || f <= 0 || years <= 0) return { cagr: 0, multiple: 0, absReturn: 0 }
    return {
      cagr: (Math.pow(f / i, 1 / years) - 1) * 100,
      multiple: f / i,
      absReturn: ((f - i) / i) * 100,
    }
  }, [initial, final, years])

  const inputCls = 'w-full rounded-xl border border-slate-200/80 bg-slate-50 dark:bg-slate-800/50 dark:border-slate-700/80 px-4 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500'

  return (
    <CardShell color="emerald" title="CAGR Calculator" subtitle="Compounded Annual Growth" Icon={FiActivity}>
      <div className="p-6">
        <div className="space-y-4 mb-5">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 block mb-1.5">Initial Value (₹)</label>
            <input type="number" className={inputCls} value={initial} onChange={e => setInitial(e.target.value)} placeholder="e.g. 100000" min="0" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 block mb-1.5">Final Value (₹)</label>
            <input type="number" className={inputCls} value={final} onChange={e => setFinal(e.target.value)} placeholder="e.g. 250000" min="0" />
          </div>
          <InputField label="Time Period" value={years} min={1} max={40} onChange={setYears} unit=" Yrs" color="emerald" />
        </div>
        <div className="space-y-2">
          <ResultRow label="Absolute Return" value={`${res.absReturn.toFixed(1)}%`} />
          <ResultRow label="Investment Multiple" value={`${res.multiple.toFixed(2)}x`} />
          <ResultBtn color="emerald" label="CAGR" value={`${res.cagr.toFixed(2)}%`} sub="per annum" />
        </div>
      </div>
    </CardShell>
  )
}