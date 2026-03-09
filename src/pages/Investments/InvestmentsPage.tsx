import { InvestmentsTable } from '../../components/investments/InvestmentsTable'
import { ImportCsvButton } from '../../components/investments/ImportCsvButton'
import { ImportAngelOnePdfButton } from '../../components/investments/ImportAngelOnePdfButton'
import { ImportIndmoneyButton } from '../../components/investments/ImportIndmoneyButton'
import { UpsertInvestmentModal } from '../../components/investments/UpsertInvestmentModal'
import { usePortfolioStore } from '../../store/portfolioStore'
import { useMemo, useState } from 'react'
import type { InvestmentType } from '../../types/investmentTypes'
import { FiTrendingUp, FiPlus, FiSearch, FiFilter } from 'react-icons/fi'

export function InvestmentsPage() {
  const investments = usePortfolioStore((s) => s.investments)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<InvestmentType | 'all'>('all')
  const [isAddOpen, setIsAddOpen] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return investments.filter((inv) => {
      if (typeFilter !== 'all' && inv.type !== typeFilter) return false
      if (!q) return true
      return (
        inv.name.toLowerCase().includes(q) ||
        (inv.symbol ?? '').toLowerCase().includes(q) ||
        (inv.platform ?? '').toLowerCase().includes(q)
      )
    })
  }, [investments, query, typeFilter])

  return (
    <div className="flex flex-col gap-6 pb-8">
      {/* Premium Gradient Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent p-6 border border-emerald-500/20 dark:from-emerald-500/20 dark:via-teal-500/10 dark:border-emerald-500/30 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-500/30">
            <FiTrendingUp className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Investments</h1>
            <p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-300">
              Manage, track, and analyze your asset portfolio.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/50 p-1.5 backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-900/50 shadow-sm">
            
            <ImportAngelOnePdfButton />
            <ImportCsvButton />
            <ImportIndmoneyButton />
          </div>
          <button
            className="group relative flex items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-emerald-500/25 transition-all hover:-translate-y-0.5 hover:shadow-emerald-500/40"
            onClick={() => setIsAddOpen(true)}
            type="button"
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full transition-transform group-hover:translate-y-0" />
            <FiPlus className="relative h-4 w-4" />
            <span className="relative">Add Investment</span>
          </button>
        </div>
      </header>

      {/* Search and Filters */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_240px]">
        <div className="relative group">
          <FiSearch className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-emerald-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200/80 bg-white/80 py-3 pl-11 pr-4 text-sm shadow-sm outline-none transition-all focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 backdrop-blur-sm dark:border-slate-800/80 dark:bg-slate-900/80 dark:text-slate-100 dark:focus:border-emerald-500"
            placeholder="Search by asset name, symbol, or platform…"
          />
        </div>
        <div className="relative group">
          <FiFilter className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-emerald-500" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as InvestmentType | 'all')}
            className="w-full appearance-none rounded-xl border border-slate-200/80 bg-white/80 py-3 pl-11 pr-10 text-sm shadow-sm outline-none transition-all focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 backdrop-blur-sm dark:border-slate-800/80 dark:bg-slate-900/80 dark:text-slate-100 dark:focus:border-emerald-500"
          >
            <option value="all">All Asset Types</option>
            <option value="stock">Stocks</option>
            <option value="mutual_fund">Mutual Funds</option>
            <option value="bond">Bonds</option>
            <option value="fixed_deposit">Fixed Deposits</option>
            <option value="other">Other</option>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
            <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" fillRule="evenodd"></path></svg>
          </div>
        </div>
      </div>

      {/* Data Table Wrapper */}
      <InvestmentsTable investments={filtered} />

      <UpsertInvestmentModal open={isAddOpen} onClose={() => setIsAddOpen(false)} mode="create" />
    </div>
  )
}