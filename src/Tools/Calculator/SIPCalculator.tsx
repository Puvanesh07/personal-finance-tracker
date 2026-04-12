// src/pages/Tools/Calculator/SIPCalculator.tsx
import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { FiRepeat } from 'react-icons/fi'
import { formatINR } from '../../utils/format'

const cardVariants = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
}

// ─── Shared primitives — also used by InvestmentCalculators ──────────────────
export function InputField({
  label, value, onChange, unit = '', min, max, step = 1, color = 'blue',
}: {
  label: string; value: number; onChange: (v: number) => void
  unit?: string; min: number; max: number; step?: number; color?: string
}) {
  const accentMap: Record<string, string> = {
    emerald: 'accent-emerald-500', blue: 'accent-blue-500', rose: 'accent-rose-500',
    amber: 'accent-amber-500', violet: 'accent-violet-500', teal: 'accent-teal-500',
    indigo: 'accent-indigo-500', orange: 'accent-orange-500',
  }
  const badgeMap: Record<string, string> = {
    emerald: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10',
    blue:    'text-blue-600 dark:text-blue-400 bg-blue-500/10',
    rose:    'text-rose-600 dark:text-rose-400 bg-rose-500/10',
    amber:   'text-amber-600 dark:text-amber-400 bg-amber-500/10',
    violet:  'text-violet-600 dark:text-violet-400 bg-violet-500/10',
    teal:    'text-teal-600 dark:text-teal-400 bg-teal-500/10',
    indigo:  'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10',
    orange:  'text-orange-600 dark:text-orange-400 bg-orange-500/10',
  }
  return (
    <div className="mb-5">
      <div className="mb-2 flex items-center justify-between">
        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{label}</label>
        <span className={`rounded-lg px-2.5 py-1 text-xs font-black tabular-nums ${badgeMap[color] ?? badgeMap.blue}`}>
          {unit === '₹' ? `₹${value.toLocaleString('en-IN')}` : `${value.toLocaleString()}${unit}`}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className={`h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 dark:bg-slate-700 ${accentMap[color] ?? accentMap.blue}`}
      />
      <div className="mt-1 flex justify-between text-[9px] text-slate-500 dark:text-slate-400">
        <span>{unit === '₹' ? `₹${Number(min).toLocaleString('en-IN')}` : `${min}${unit}`}</span>
        <span>{unit === '₹' ? `₹${Number(max).toLocaleString('en-IN')}` : `${max}${unit}`}</span>
      </div>
    </div>
  )
}

export function ResultRow({ label, value, highlight = false, color = 'blue' }: {
  label: string; value: string; highlight?: boolean; color?: string
}) {
  const hlMap: Record<string, string> = {
    emerald: 'bg-emerald-500/5 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400',
    blue:    'bg-blue-500/5 border border-blue-500/20 text-blue-600 dark:text-blue-400',
    rose:    'bg-rose-500/5 border border-rose-500/20 text-rose-600 dark:text-rose-400',
    amber:   'bg-amber-500/5 border border-amber-500/20 text-amber-600 dark:text-amber-400',
    violet:  'bg-violet-500/5 border border-violet-500/20 text-violet-600 dark:text-violet-400',
    teal:    'bg-teal-500/5 border border-teal-500/20 text-teal-600 dark:text-teal-400',
    indigo:  'bg-indigo-500/5 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400',
    orange:  'bg-orange-500/5 border border-orange-500/20 text-orange-600 dark:text-orange-400',
  }
  return (
    <div className={`flex items-center justify-between rounded-xl px-4 py-3 ${highlight ? (hlMap[color] ?? hlMap.blue) : 'bg-slate-50 dark:bg-slate-800/40'}`}>
      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</span>
      <span className={`text-sm font-black tabular-nums ${highlight ? '' : 'text-slate-900 dark:text-white'}`}>{value}</span>
    </div>
  )
}

export function ResultBtn({ color = 'blue', label, value, sub }: { color?: string; label: string; value: string; sub?: string }) {
  const btnMap: Record<string, string> = {
    emerald: 'bg-emerald-600', blue: 'bg-blue-600', rose: 'bg-rose-600',
    amber: 'bg-amber-600', violet: 'bg-violet-600', teal: 'bg-teal-600',
    indigo: 'bg-indigo-600', orange: 'bg-orange-600',
  }
  return (
    <div className={`rounded-xl ${btnMap[color] ?? btnMap.blue} p-4 text-center mt-2`}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">{label}</p>
      <p className="text-2xl font-black text-white mt-1">{value}</p>
      {sub && <p className="text-[10px] text-white/60 mt-0.5">{sub}</p>}
    </div>
  )
}

export function CardShell({ children, color = 'blue', title, subtitle, Icon }: {
  children: React.ReactNode; color?: string; title: string; subtitle: string; Icon: React.ElementType
}) {
  const fromMap: Record<string, string> = {
    emerald: 'from-emerald-500/10', blue: 'from-blue-500/10', rose: 'from-rose-500/10',
    amber: 'from-amber-500/10', violet: 'from-violet-500/10', teal: 'from-teal-500/10',
    indigo: 'from-indigo-500/10', orange: 'from-orange-500/10',
  }
  const iconMap: Record<string, string> = {
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    blue:    'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    rose:    'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    amber:   'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    violet:  'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    teal:    'bg-teal-500/10 text-teal-600 dark:text-teal-400',
    indigo:  'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    orange:  'bg-orange-500/10 text-orange-600 dark:text-orange-400',
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

// ─── SIP Calculator ──────────────────────────────────────────────────────────
// FV = P × [((1+r)^n - 1) / r] × (1+r)   r = monthly rate, n = total months
export function SIPCalculator() {
  const [monthly, setMonthly] = useState(10000)
  const [rate, setRate] = useState(12)
  const [years, setYears] = useState(10)

  const res = useMemo(() => {
    const r = rate / 12 / 100       // monthly rate — FIXED: was using annual rate directly
    const n = years * 12             // total months
    const invested = monthly * n
    const maturity = monthly * ((Math.pow(1 + r, n) - 1) / r) * (1 + r)
    const gains = maturity - invested
    const absReturn = invested > 0 ? (gains / invested) * 100 : 0
    return { invested, maturity, gains, absReturn }
  }, [monthly, rate, years])

  return (
    <CardShell color="emerald" title="SIP Calculator" subtitle="Monthly Investment Growth" Icon={FiRepeat}>
      <div className="p-6 space-y-1">
        <InputField label="Monthly SIP" value={monthly} min={500} max={500000} step={500} onChange={setMonthly} unit="₹" color="emerald" />
        <InputField label="Expected Return (p.a.)" value={rate} min={1} max={30} step={0.5} onChange={setRate} unit="%" color="emerald" />
        <InputField label="Time Period" value={years} min={1} max={40} onChange={setYears} unit=" Yrs" color="emerald" />
        <div className="mt-4 space-y-2">
          <ResultRow label="Total Invested" value={formatINR(res.invested)} />
          <ResultRow label="Gains Earned" value={formatINR(res.gains)} highlight color="emerald" />
          <ResultRow label="Absolute Return" value={`${res.absReturn.toFixed(1)}%`} />
          <ResultBtn color="emerald" label="Maturity Value" value={formatINR(res.maturity)} />
        </div>
      </div>
    </CardShell>
  )
}