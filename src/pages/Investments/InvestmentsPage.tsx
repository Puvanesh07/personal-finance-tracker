// src/pages/Investments/InvestmentsPage.tsx
import { useMemo, useState, useRef, useEffect } from 'react' // Added useRef, useEffect
import { FiTrendingUp, FiPlus, FiSearch, FiFilter, FiChevronDown, FiCheck } from 'react-icons/fi' // Added FiCheck
import { usePortfolioStore } from '../../store/portfolioStore'
import { InvestmentsTable } from '../../components/investments/InvestmentsTable'
import { ImportCsvButton } from '../../components/investments/ImportCsvButton'
import { ImportAngelOnePdfButton } from '../../components/investments/ImportAngelOnePdfButton'
import { ImportIndmoneyButton } from '../../components/investments/ImportIndmoneyButton'
import { ImportGrowwButton } from '../../components/investments/ImportGrowButton' // Assuming this file exists based on your previous turn
import { UpsertInvestmentModal } from '../../components/investments/UpsertInvestmentModal'
import type { InvestmentType } from '../../types/investmentTypes'

export function InvestmentsPage() {
  const investments = usePortfolioStore((s) => s.investments)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<InvestmentType | 'all'>('all')
  const [isAddOpen, setIsAddOpen] = useState(false)
  
  // Custom Dropdown State
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Options for the filter
  const filterOptions: { label: string; value: InvestmentType | 'all' }[] = [
    { label: 'All Assets', value: 'all' },
    { label: 'Stocks', value: 'stock' },
    { label: 'Mutual Funds', value: 'mutual_fund' },
    { label: 'Bonds', value: 'bond' },
    { label: 'Fixed Deposits', value: 'fixed_deposit' },
    { label: 'Other', value: 'other' }
  ]

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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
    <div className="flex flex-col gap-4 md:gap-6 pb-20 md:pb-8">
      {/* Responsive Header */}
      <header className="flex flex-col gap-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-slate-900/50 p-4 md:p-6 border border-emerald-500/20 shadow-xl">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/20">
              <FiTrendingUp className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-semibold text-white leading-tight">Investments</h1>
              <p className="text-[11px] md:text-sm text-slate-400 font-medium">Manage your asset portfolio</p>
            </div>
          </div>
          
          <button
            onClick={() => setIsAddOpen(true)}
            className="flex h-10 w-10 md:w-auto md:px-4 items-center justify-center gap-2 rounded-xl bg-emerald-500 text-white font-medium shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-colors"
          >
            <FiPlus className="h-5 w-5" />
            <span className="hidden md:inline">Add Asset</span>
          </button>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 no-scrollbar">
          <div className="flex items-center gap-2 rounded-xl bg-slate-800/50 p-1 border border-slate-700/50">
            <ImportAngelOnePdfButton />
            <ImportCsvButton />
            <ImportIndmoneyButton />
            <ImportGrowwButton />
          </div>
        </div>
      </header>

      {/* Search and Filters Section */}
      <div className="flex flex-col md:grid md:grid-cols-[1fr_240px] gap-3">
        {/* Search Bar */}
        <div className="relative group">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-500 transition-colors" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-800 bg-slate-900/50 py-3 pl-11 pr-4 text-sm text-slate-100 outline-none focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 transition-all"
            placeholder="Search assets..."
          />
        </div>

        {/* Premium Glassmorphism Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm transition-all duration-300 backdrop-blur-md ${
              isDropdownOpen 
                ? 'border-emerald-500/50 bg-slate-800 shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
                : 'border-slate-800 bg-slate-900/40 hover:bg-slate-800/60'
            }`}
          >
            <div className="flex items-center gap-3">
              <FiFilter className={`transition-colors ${isDropdownOpen ? 'text-emerald-400' : 'text-slate-500'}`} />
              <span className="text-slate-200 font-medium">
                {filterOptions.find(opt => opt.value === typeFilter)?.label}
              </span>
            </div>
            <FiChevronDown className={`transition-transform duration-300 text-slate-500 ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Floating Menu */}
          {isDropdownOpen && (
            <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-900/80 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
              <div className="p-1.5 flex flex-col">
                {filterOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setTypeFilter(option.value)
                      setIsDropdownOpen(false)
                    }}
                    className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-all ${
                      typeFilter === option.value
                        ? 'bg-emerald-500/10 text-emerald-400 font-semibold'
                        : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-100'
                    }`}
                  >
                    <span>{option.label}</span>
                    {typeFilter === option.value && <FiCheck className="h-4 w-4" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <InvestmentsTable investments={filtered} />
      <UpsertInvestmentModal open={isAddOpen} onClose={() => setIsAddOpen(false)} mode="create" />
    </div>
  )
}