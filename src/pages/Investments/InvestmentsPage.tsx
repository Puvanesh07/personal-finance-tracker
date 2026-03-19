// src/pages/Investments/InvestmentsPage.tsx
//
// UPDATED: Added "Monthly SIP Plan" tab beside the main investments view
//          Tab strip shown in header — "Investments" | "Monthly SIP Plan"

import {
  FiBox,
  FiBriefcase,
  FiCheck,
  FiChevronDown,
  FiFilter,
  FiGlobe,
  FiHome,
  FiMonitor,
  FiPercent,
  FiPieChart,
  FiPlus,
  FiSearch,
  FiShield,
  FiTrendingUp,
} from 'react-icons/fi';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { BsBank2 } from 'react-icons/bs';
import { ImportAngelOnePdfButton } from '../../components/investments/ImportAngelOnePdfButton';
import { ImportCsvButton } from '../../components/investments/ImportCsvButton';
import { ImportGrowwButton } from '../../components/investments/ImportGrowButton';
import { ImportIndmoneyButton } from '../../components/investments/ImportIndmoneyButton';
import { InvestmentsSkeleton } from '../../components/loader/skeletons';
import { InvestmentsTable } from '../../components/investments/InvestmentsTable';
import { MonthlySipPlanPage } from './MonthlySipPlanPage';
import { UpsertInvestmentModal } from '../../components/investments/UpsertInvestmentModal';
import { createPortal } from 'react-dom';
import { usePortfolioStore } from '../../store/portfolioStore';
import { useStockMetadata } from '../../hooks/useStockMetadata';

// ── Asset Type Filter Categories ───────────────────────────────────────────
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

// ── Broker Filter Options ──────────────────────────────────────────────────
const BROKER_FILTERS = [
  { id: 'all', label: 'All Brokers', icon: BsBank2 },
  { id: 'zerodha', label: 'Zerodha', icon: BsBank2 },
  { id: 'angel_one', label: 'Angel One', icon: BsBank2 },
  { id: 'groww', label: 'Groww', icon: BsBank2 },
  { id: 'indmoney', label: 'INDmoney', icon: BsBank2 },
  { id: 'upstox', label: 'Upstox', icon: BsBank2 },
  { id: 'manual', label: 'Direct / Manual', icon: BsBank2 },
];

// ── Generic Portalled Dropdown ─────────────────────────────────────────────
function FilterDropdown<T extends { id: string; label: string; icon: any }>({
  options,
  value,
  onChange,
  accentColor = 'emerald',
}: {
  options: T[];
  value: string;
  onChange: (v: string) => void;
  accentColor?: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  const selected = options.find((o) => o.id === value) || options[0];
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
      )
        setOpen(false);
    };
    document.addEventListener('mousedown', onMouse);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      document.removeEventListener('mousedown', onMouse);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [open, updatePos]);

  const ringColor =
    accentColor === 'blue'
      ? 'border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.15)] ring-2 ring-blue-500/20'
      : 'border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)] ring-2 ring-emerald-500/20';
  const iconActive =
    accentColor === 'blue' ? 'text-blue-400' : 'text-emerald-400';
  const selectedBg =
    accentColor === 'blue'
      ? 'bg-blue-500/10 text-blue-400'
      : 'bg-emerald-500/10 text-emerald-400';

  return (
    <>
      <button
        ref={triggerRef}
        type='button'
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium transition-all duration-300 outline-none backdrop-blur-md ${
          open
            ? `border-emerald-500/50 bg-slate-800 ${ringColor} text-slate-100`
            : 'border-slate-800 bg-slate-900/40 hover:bg-slate-800/60 text-slate-200'
        }`}
      >
        <div className='flex items-center gap-3'>
          <Icon className={`h-4 w-4 ${open ? iconActive : 'text-slate-500'}`} />
          <span>{selected.label}</span>
        </div>
        <FiChevronDown
          className={`h-4 w-4 transition-transform duration-300 text-slate-500 ${open ? `rotate-180 ${iconActive}` : ''}`}
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
            {options.map((opt) => {
              const OptIcon = opt.icon;
              const isSelected = opt.id === value;
              return (
                <button
                  key={opt.id}
                  type='button'
                  onClick={() => {
                    onChange(opt.id);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium transition-colors ${
                    isSelected
                      ? selectedBg
                      : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                  }`}
                >
                  <div className='flex items-center gap-3'>
                    <OptIcon
                      className={`h-4 w-4 ${isSelected ? iconActive : 'text-slate-400'}`}
                    />
                    <span>{opt.label}</span>
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

// ── Broker badge colors ────────────────────────────────────────────────────
function getBrokerBadgeStyle(brokerId: string) {
  switch (brokerId) {
    case 'zerodha':
      return 'bg-sky-500/10 border-sky-500/30 text-sky-400';
    case 'angel_one':
      return 'bg-orange-500/10 border-orange-500/30 text-orange-400';
    case 'groww':
      return 'bg-purple-500/10 border-purple-500/30 text-purple-400';
    case 'indmoney':
      return 'bg-rose-500/10 border-rose-500/30 text-rose-400';
    case 'upstox':
      return 'bg-amber-500/10 border-amber-500/30 text-amber-400';
    default:
      return 'bg-slate-700/40 border-slate-600/40 text-slate-400';
  }
}

// ── Helper: normalise platform string to broker id ─────────────────────────
function normalisePlatform(platform?: string): string {
  if (!platform) return 'manual';
  const s = platform.toLowerCase().replace(/\s+/g, '_');
  if (s === 'angel_one' || s === 'angelone') return 'angel_one';
  if (s === 'zerodha') return 'zerodha';
  if (s === 'groww') return 'groww';
  if (s === 'indmoney') return 'indmoney';
  if (s === 'upstox') return 'upstox';
  if (s === 'direct' || s === 'manual') return 'manual';
  return 'manual';
}

// ── Page ───────────────────────────────────────────────────────────────────
export function InvestmentsPage() {
  const ready = usePortfolioStore((s) => s.ready);
  const investments = usePortfolioStore((s) => s.investments);

  // ✅ NEW: Tab state — 'investments' | 'sip'
  const [activeTab, setActiveTab] = useState<'investments' | 'sip'>(
    'investments',
  );

  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [brokerFilter, setBrokerFilter] = useState<string>('all');
  const [isAddOpen, setIsAddOpen] = useState(false);
  // ✅ Market cap filter — reads from sessionStorage (set by MarketCapAllocationChart)
  const [marketCapFilter, setMarketCapFilter] = useState<string>('all');
  const { metadata } = useStockMetadata(investments);

  useEffect(() => {
    const saved = sessionStorage.getItem('inv_marketcap_filter');
    if (saved) {
      setMarketCapFilter(saved);
      sessionStorage.removeItem('inv_marketcap_filter');
    }
  }, []);

  // Derive active brokers from actual data so the dropdown only shows relevant options
  const activeBrokers = useMemo(() => {
    const ids = new Set(
      investments.map((inv) => normalisePlatform(inv.platform)),
    );
    return BROKER_FILTERS.filter((b) => b.id === 'all' || ids.has(b.id));
  }, [investments]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return investments.filter((inv) => {
      // 1. Asset type filter
      if (typeFilter !== 'all') {
        const cat = FILTER_CATEGORIES.find((c) => c.id === typeFilter);
        if (cat) {
          if (inv.type !== cat.type) return false;
          if (cat.type === 'other') {
            const invAssetType = (inv as any).assetType || 'other';
            if (invAssetType !== cat.id) return false;
          }
        }
      }

      // 2. Market Cap filter
      if (marketCapFilter !== 'all') {
        const meta = metadata.get(inv.id);
        const cap = meta?.marketCapCategory ?? 'Unknown';
        if (cap !== marketCapFilter) return false;
      }

      // 3. Broker filter
      if (brokerFilter !== 'all') {
        if (normalisePlatform(inv.platform) !== brokerFilter) return false;
      }

      // 3. Search
      if (!q) return true;
      return (
        inv.name.toLowerCase().includes(q) ||
        (inv.symbol ?? '').toLowerCase().includes(q) ||
        (inv.platform ?? '').toLowerCase().includes(q)
      );
    });
  }, [investments, query, typeFilter, brokerFilter, marketCapFilter, metadata]);

  // Active broker label for the results bar
  const activeBrokerLabel =
    BROKER_FILTERS.find((b) => b.id === brokerFilter)?.label ?? 'All Brokers';
  const showBrokerBadge = brokerFilter !== 'all';

  if (!ready) {
    return <InvestmentsSkeleton />;
  }

  return (
    <div className='flex flex-col gap-4 md:gap-6 pb-20 md:pb-8'>
      {/* Header */}
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

          {/* Only show Add Asset button on investments tab */}
          {activeTab === 'investments' && (
            <button
              onClick={() => setIsAddOpen(true)}
              className='flex h-10 w-10 md:w-auto md:px-4 items-center justify-center gap-2 rounded-xl bg-emerald-500 text-white font-medium shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-colors'
            >
              <FiPlus className='h-5 w-5' />
              <span className='hidden md:inline'>Add Asset</span>
            </button>
          )}
        </div>

        {/* ✅ NEW: Tab strip — Investments | Monthly SIP Plan */}
        <div className='flex items-center gap-2'>
          <button
            onClick={() => setActiveTab('investments')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 ${
              activeTab === 'investments'
                ? 'bg-slate-700 text-slate-100 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            Investments
          </button>
          <button
            onClick={() => setActiveTab('sip')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 ${
              activeTab === 'sip'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <FiPercent className='h-3.5 w-3.5' />
            Monthly SIP Plan
          </button>
        </div>

        {/* Import buttons — only on investments tab */}
        {activeTab === 'investments' && (
          <div className='flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 no-scrollbar'>
            <div className='flex items-center gap-2 rounded-xl bg-slate-800/50 p-1 border border-slate-700/50'>
              <ImportAngelOnePdfButton />
              <ImportCsvButton />
              <ImportIndmoneyButton />
              <ImportGrowwButton />
            </div>
          </div>
        )}
      </header>

      {/* ── Tab Content ─────────────────────────────────────────────── */}

      {activeTab === 'sip' ? (
        /* ✅ Monthly SIP Plan tab */
        <MonthlySipPlanPage />
      ) : (
        /* ── Investments tab (original content) ── */
        <>
          {/* Filters Row */}
          <div className='flex flex-col gap-3'>
            {/* Search */}
            <div className='relative group'>
              <FiSearch className='absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-500 transition-colors' />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className='w-full rounded-xl border border-slate-800 bg-slate-900/50 py-3 pl-11 pr-4 text-sm text-slate-100 outline-none focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 transition-all'
                placeholder='Search by name, symbol, or broker…'
              />
            </div>

            {/* Asset Type + Broker dropdowns side by side */}
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
              <div className='relative'>
                <p className='text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5 ml-1'>
                  Asset Type
                </p>
                <FilterDropdown
                  options={FILTER_CATEGORIES}
                  value={typeFilter}
                  onChange={setTypeFilter}
                  accentColor='emerald'
                />
              </div>

              <div className='relative'>
                <p className='text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5 ml-1'>
                  Broker / Platform
                </p>
                <FilterDropdown
                  options={activeBrokers}
                  value={brokerFilter}
                  onChange={setBrokerFilter}
                  accentColor='blue'
                />
              </div>
            </div>

            {/* Active filter pills */}
            {(showBrokerBadge ||
              typeFilter !== 'all' ||
              marketCapFilter !== 'all') && (
              <div className='flex items-center gap-2 flex-wrap'>
                <span className='text-[10px] text-slate-500 font-semibold uppercase tracking-widest'>
                  Filters:
                </span>
                {typeFilter !== 'all' && (
                  <button
                    onClick={() => setTypeFilter('all')}
                    className='flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400 hover:bg-emerald-500/20 transition-colors'
                  >
                    {FILTER_CATEGORIES.find((c) => c.id === typeFilter)?.label}
                    <span className='text-emerald-300 text-xs ml-0.5'>✕</span>
                  </button>
                )}
                {showBrokerBadge && (
                  <button
                    onClick={() => setBrokerFilter('all')}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold hover:opacity-80 transition-opacity ${getBrokerBadgeStyle(brokerFilter)}`}
                  >
                    {activeBrokerLabel}
                    <span className='text-xs ml-0.5'>✕</span>
                  </button>
                )}
                {marketCapFilter !== 'all' && (
                  <button
                    onClick={() => setMarketCapFilter('all')}
                    className='flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-bold text-indigo-400 hover:bg-indigo-500/20 transition-colors'
                  >
                    {marketCapFilter}
                    <span className='text-indigo-300 text-xs ml-0.5'>✕</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setTypeFilter('all');
                    setBrokerFilter('all');
                    setMarketCapFilter('all');
                    setQuery('');
                  }}
                  className='text-xs text-slate-500 hover:text-slate-300 font-semibold transition-colors ml-1'
                >
                  Clear all
                </button>
              </div>
            )}
          </div>

          <InvestmentsTable investments={filtered} />

          <UpsertInvestmentModal
            open={isAddOpen}
            onClose={() => setIsAddOpen(false)}
            mode='create'
          />
        </>
      )}
    </div>
  );
}
