// src/pages/Investments/InvestmentsPage.tsx

import {
  FiBox,
  FiBriefcase,
  FiCheck,
  FiChevronDown,
  FiFilter,
  FiGlobe,
  FiHome,
  FiMonitor,
  FiPieChart,
  FiPlus,
  FiSearch,
  FiShield,
  FiTrendingUp,
} from 'react-icons/fi';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ImportAngelOnePdfButton } from '../../components/investments/ImportAngelOnePdfButton';
import { ImportCsvButton } from '../../components/investments/ImportCsvButton';
import { ImportGrowwButton } from '../../components/investments/ImportGrowButton';
import { ImportIndmoneyButton } from '../../components/investments/ImportIndmoneyButton';
import { InvestmentsTable } from '../../components/investments/InvestmentsTable';
import { UpsertInvestmentModal } from '../../components/investments/UpsertInvestmentModal';
import { createPortal } from 'react-dom';
import { usePortfolioStore } from '../../store/portfolioStore';

// ── Extended Category Definitions ──────────────────────────────────────────
const FILTER_CATEGORIES = [
  { id: 'all', label: 'All Assets', type: 'all', icon: FiFilter },
  { id: 'stock', label: 'Indian Stocks', type: 'stock', icon: FiTrendingUp },
  {
    id: 'international_equity',
    label: 'Intl. Equity',
    type: 'other',
    icon: FiGlobe,
  },
  {
    id: 'mutual_fund',
    label: 'Mutual Funds',
    type: 'mutual_fund',
    icon: FiPieChart,
  },
  {
    id: 'fixed_deposit',
    label: 'Fixed Deposits',
    type: 'fixed_deposit',
    icon: FiShield,
  },
  { id: 'bond', label: 'Bonds & SGBs', type: 'bond', icon: FiBriefcase },
  { id: 'ppf', label: 'PPF', type: 'other', icon: FiBox },
  { id: 'nps', label: 'NPS', type: 'other', icon: FiBox },
  { id: 'gold', label: 'Physical Gold', type: 'other', icon: FiBox },
  { id: 'silver', label: 'Physical Silver', type: 'other', icon: FiBox },
  { id: 'real_estate', label: 'Real Estate', type: 'other', icon: FiHome },
  { id: 'crypto', label: 'Crypto', type: 'other', icon: FiMonitor },
  { id: 'other', label: 'Other Asset', type: 'other', icon: FiBox },
];

// ── Custom Filter Dropdown (Portalled) ───────────────────────────────────
function CategoryFilterDropdown({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  const selected =
    FILTER_CATEGORIES.find((c) => c.id === value) || FILTER_CATEGORIES[0];
  const Icon = selected.icon;

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setPos({
      top: r.bottom + 8 + window.scrollY,
      left: r.left + window.scrollX,
      width: r.width,
    });
  }, []);

  useEffect(() => {
    if (open) updatePos();
  }, [open, updatePos]);

  useEffect(() => {
    if (!open) return;
    const onMouse = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouse);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      document.removeEventListener('mousedown', onMouse);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [open, updatePos]);

  return (
    <>
      <button
        ref={triggerRef}
        type='button'
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium transition-all duration-300 outline-none backdrop-blur-md ${
          open
            ? 'border-emerald-500/50 bg-slate-800 shadow-[0_0_15px_rgba(16,185,129,0.15)] text-slate-100 ring-2 ring-emerald-500/20'
            : 'border-slate-800 bg-slate-900/40 hover:bg-slate-800/60 text-slate-200'
        }`}
      >
        <div className='flex items-center gap-3'>
          <Icon
            className={`h-4 w-4 ${open ? 'text-emerald-400' : 'text-slate-500'}`}
          />
          <span>{selected.label}</span>
        </div>
        <FiChevronDown
          className={`h-4 w-4 transition-transform duration-300 text-slate-500 ${open ? 'rotate-180 text-emerald-400' : ''}`}
        />
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: 'absolute',
              top: pos.top,
              left: pos.left,
              width: pos.width,
              zIndex: 99999,
            }}
            className='max-h-[350px] overflow-y-auto rounded-xl border border-slate-700 bg-slate-800 shadow-2xl custom-scrollbar py-1.5 animate-in fade-in zoom-in-95 duration-200'
          >
            {FILTER_CATEGORIES.map((cat) => {
              const CatIcon = cat.icon;
              const isSelected = cat.id === value;
              return (
                <button
                  key={cat.id}
                  type='button'
                  onClick={() => {
                    onChange(cat.id);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium transition-colors ${
                    isSelected
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                  }`}
                >
                  <div className='flex items-center gap-3'>
                    <CatIcon
                      className={`h-4 w-4 ${isSelected ? 'text-emerald-400' : 'text-slate-400'}`}
                    />
                    <span>{cat.label}</span>
                  </div>
                  {isSelected && <FiCheck className='h-4 w-4 shrink-0' />}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}

// ───────────────────────────────────────────────────────────────────────────

export function InvestmentsPage() {
  const investments = usePortfolioStore((s) => s.investments);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Advanced Filtering Logic
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return investments.filter((inv) => {
      // 1. Check Category Match
      if (typeFilter !== 'all') {
        const cat = FILTER_CATEGORIES.find((c) => c.id === typeFilter);
        if (cat) {
          // Verify base type matches (e.g. stock === stock)
          if (inv.type !== cat.type) return false;

          // For extended "other" types (gold, ppf, nps), verify the sub-type matches
          if (cat.type === 'other') {
            const invAssetType = (inv as any).assetType || 'other';
            if (invAssetType !== cat.id) return false;
          }
        }
      }

      // 2. Check Search Match
      if (!q) return true;
      return (
        inv.name.toLowerCase().includes(q) ||
        (inv.symbol ?? '').toLowerCase().includes(q) ||
        (inv.platform ?? '').toLowerCase().includes(q)
      );
    });
  }, [investments, query, typeFilter]);

  return (
    <div className='flex flex-col gap-4 md:gap-6 pb-20 md:pb-8'>
      {/* Responsive Header */}
      <header className='flex flex-col gap-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-slate-900/50 p-4 md:p-6 border border-emerald-500/20 shadow-xl'>
        <div className='flex items-center justify-between w-full'>
          <div className='flex items-center gap-3'>
            <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'>
              <FiTrendingUp className='h-5 w-5' />
            </div>
            <div>
              <h1 className='text-xl md:text-2xl font-semibold text-white leading-tight'>
                Investments
              </h1>
              <p className='text-[11px] md:text-sm text-slate-400 font-medium'>
                Manage your asset portfolio
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsAddOpen(true)}
            className='flex h-10 w-10 md:w-auto md:px-4 items-center justify-center gap-2 rounded-xl bg-emerald-500 text-white font-medium shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-colors'
          >
            <FiPlus className='h-5 w-5' />
            <span className='hidden md:inline'>Add Asset</span>
          </button>
        </div>

        <div className='flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 no-scrollbar'>
          <div className='flex items-center gap-2 rounded-xl bg-slate-800/50 p-1 border border-slate-700/50'>
            <ImportAngelOnePdfButton />
            <ImportCsvButton />
            <ImportIndmoneyButton />
            <ImportGrowwButton />
          </div>
        </div>
      </header>

      {/* Search and Filters Section */}
      <div className='flex flex-col md:grid md:grid-cols-[1fr_240px] gap-3'>
        {/* Search Bar */}
        <div className='relative group'>
          <FiSearch className='absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-500 transition-colors' />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className='w-full rounded-xl border border-slate-800 bg-slate-900/50 py-3 pl-11 pr-4 text-sm text-slate-100 outline-none focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 transition-all'
            placeholder='Search assets...'
          />
        </div>

        {/* Custom Icon Filter Dropdown */}
        <div className='relative'>
          <CategoryFilterDropdown value={typeFilter} onChange={setTypeFilter} />
        </div>
      </div>

      <InvestmentsTable investments={filtered} />
      <UpsertInvestmentModal
        open={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        mode='create'
      />
    </div>
  );
}
