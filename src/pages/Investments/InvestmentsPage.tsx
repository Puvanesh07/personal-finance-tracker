import { InvestmentsTable } from '../../components/investments/InvestmentsTable'
import { ImportCsvButton } from '../../components/investments/ImportCsvButton'
import { ImportAngelOnePdfButton } from '../../components/investments/ImportAngelOnePdfButton'
import { ImportIndmoneyButton } from '../../components/investments/ImportIndmoneyButton'
import { UpsertInvestmentModal } from '../../components/investments/UpsertInvestmentModal'
import { usePortfolioStore } from '../../store/portfolioStore'
import { useMemo, useState } from 'react'
import type { InvestmentType } from '../../types/investmentTypes'

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
          <h1 className="text-xl font-semibold">Investments</h1>
          <p className="text-sm text-slate-600">Add, edit, delete, search, and filter.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ImportAngelOnePdfButton />
          <ImportCsvButton />
          <ImportIndmoneyButton />
          <button
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            onClick={() => setIsAddOpen(true)}
            type="button"
          >
            Add investment
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_200px]">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400"
          placeholder="Search by name, symbol, platform…"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as InvestmentType | 'all')}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400"
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

