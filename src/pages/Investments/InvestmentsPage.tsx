import { InvestmentsTable } from '../../components/investments/InvestmentsTable'
import { ImportCsvButton } from '../../components/investments/ImportCsvButton'
import { ImportAngelOnePdfButton } from '../../components/investments/ImportAngelOnePdfButton'
import { ImportIndmoneyButton } from '../../components/investments/ImportIndmoneyButton'
import { UpsertInvestmentModal } from '../../components/investments/UpsertInvestmentModal'
import { usePortfolioStore } from '../../store/portfolioStore'
import { useMemo, useState } from 'react'
import type { InvestmentType } from '../../types/investmentTypes'
import { FiTrendingUp, FiPlus, FiUpload } from 'react-icons/fi'

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
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FiTrendingUp className="h-6 w-6 text-emerald-500" />
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Investments</h1>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Add, edit, delete, search, and filter.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            <FiUpload className="h-3.5 w-3.5" />
            <span>Imports</span>
          </span>
          <ImportAngelOnePdfButton />
          <ImportCsvButton />
          <ImportIndmoneyButton />
          <button
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 dark:bg-emerald-400 dark:text-slate-900 dark:hover:bg-emerald-300"
            onClick={() => setIsAddOpen(true)}
            type="button"
          >
            <FiPlus className="h-4 w-4" />
            <span>Add investment</span>
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          placeholder="Search by name, symbol, platform…"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as InvestmentType | 'all')}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          <option value="all">All types</option>
          <option value="stock">Stocks</option>
          <option value="mutual_fund">Mutual funds</option>
          <option value="bond">Bonds</option>
          <option value="fixed_deposit">Fixed deposits</option>
          <option value="other">Other</option>
        </select>
      </div>

      <InvestmentsTable investments={filtered} />

      <UpsertInvestmentModal open={isAddOpen} onClose={() => setIsAddOpen(false)} mode="create" />
    </div>
  )
}

