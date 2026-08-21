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
  FiPercent,
  FiPieChart,
  FiPlus,
  FiSearch,
  FiShield,
  FiTrendingDown,
  FiTrendingUp,
} from 'react-icons/fi';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { usePremiumActions } from '../../hooks/usePremiumActions';
import { SavedViewsMenu } from '../../components/ui/SavedViewsMenu';
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
import {
  buildPortfolioCashflows,
  calculateCAGR,
  calculateXIRR,
  currentValue,
  earliestInvestmentDate,
  investedValue,
  summarizePortfolio,
} from '../../utils/calculations';
import { formatINR } from '../../utils/format';

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
        className={`flex w-full items-center justify-between cursor-pointer rounded-xl border px-4 py-3 text-sm font-medium transition-all duration-300 outline-none backdrop-blur-md ${
          open
            ? `border-emerald-500/50 bg-slate-200 dark:bg-slate-800 ${ringColor} text-slate-900 dark:text-slate-100`
            : 'border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/40 hover:bg-slate-200/70 dark:hover:bg-slate-800/60 text-slate-900 dark:text-slate-200'
        }`}
      >
        <div className='flex items-center gap-3'>
          <Icon className={`h-4 w-4 ${open ? iconActive : 'text-slate-900 dark:text-slate-500'}`} />
          <span>{selected.label}</span>
        </div>
        <FiChevronDown
          className={`h-4 w-4 transition-transform duration-300 text-slate-900 dark:text-slate-500 ${open ? `rotate-180 ${iconActive}` : ''}`}
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
            className='max-h-[350px] overflow-y-auto rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-200 dark:bg-slate-800 shadow-2xl custom-scrollbar py-1.5 animate-in fade-in zoom-in-95 duration-200'
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
                  className={`w-full flex items-center cursor-pointer justify-between px-4 py-2.5 text-sm font-medium transition-colors ${
                    isSelected
                      ? selectedBg
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <div className='flex items-center gap-3'>
                    <OptIcon
                      className={`h-4 w-4 ${isSelected ? iconActive : 'text-slate-500 dark:text-slate-400'}`}
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
      return 'bg-slate-300 dark:bg-slate-700/40 border-slate-300 dark:border-slate-600/40 text-slate-500 dark:text-slate-400';
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

// ── Small stat card ────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  sub,
  color = 'default',
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: 'default' | 'green' | 'red' | 'amber';
  icon?: React.ReactNode;
}) {
  const valueColor =
    color === 'green'
      ? 'text-emerald-600 dark:text-emerald-400'
      : color === 'red'
        ? 'text-rose-600 dark:text-rose-400'
        : color === 'amber'
          ? 'text-amber-600 dark:text-amber-400'
          : 'text-slate-900 dark:text-slate-100';

  return (
    <div className='flex flex-col gap-1 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/50 p-3 md:p-4'>
      <div className='flex items-center gap-1.5'>
        {icon && <span className='text-slate-400 dark:text-slate-500'>{icon}</span>}
        <p className='text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'>
          {label}
        </p>
      </div>
      <p className={`text-base font-black tabular-nums leading-tight ${valueColor}`}>
        {value}
      </p>
      {sub && (
        <p className='text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-tight'>
          {sub}
        </p>
      )}
    </div>
  );
}

// ── Allocation bar ─────────────────────────────────────────────────────────
const ALLOC_COLORS = [
  'bg-emerald-500',
  'bg-indigo-500',
  'bg-amber-500',
  'bg-sky-500',
  'bg-violet-500',
];

function AllocationBar({
  alloc,
  total,
}: {
  alloc: { label: string; value: number }[];
  total: number;
}) {
  if (alloc.length === 0 || total <= 0) return null;

  return (
    <div className='rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/50 p-3 md:p-4'>
      <p className='text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2'>
        Asset Allocation
      </p>
      {/* Bar */}
      <div className='h-2.5 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800 flex'>
        {alloc.map((a, idx) => (
          <div
            key={a.label}
            className={`${ALLOC_COLORS[idx % ALLOC_COLORS.length]} transition-all duration-500`}
            style={{ width: `${(a.value / total) * 100}%` }}
            title={`${a.label}: ${((a.value / total) * 100).toFixed(1)}%`}
          />
        ))}
      </div>
      {/* Legend */}
      <div className='mt-2.5 flex flex-wrap gap-x-3 gap-y-1.5'>
        {alloc.map((a, idx) => (
          <div key={a.label} className='flex items-center gap-1.5'>
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${ALLOC_COLORS[idx % ALLOC_COLORS.length]}`}
            />
            <span className='text-[11px] font-semibold text-slate-600 dark:text-slate-300'>
              {a.label}
            </span>
            <span className='text-[11px] text-slate-500 dark:text-slate-400'>
              {((a.value / total) * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export function InvestmentsPage() {
  const { premiumActionProps } = usePremiumActions();
  const ready = usePortfolioStore((s) => s.ready);
  const investments = usePortfolioStore((s) => s.investments);
  const [initializingView, setInitializingView] = useState(true);

  const [activeTab, setActiveTab] = useState<'investments' | 'sip'>('investments');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [brokerFilter, setBrokerFilter] = useState<string>('all');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [quickFilter, setQuickFilter] = useState<
    'all' | 'stocks' | 'mfs' | 'profit' | 'loss'
  >('all');
  const [marketCapFilter, setMarketCapFilter] = useState<string>('all');
  const { metadata } = useStockMetadata(investments);

  useEffect(() => {
    const saved = sessionStorage.getItem('inv_marketcap_filter');
    if (saved) {
      setMarketCapFilter(saved);
      sessionStorage.removeItem('inv_marketcap_filter');
    }
  }, []);

  useEffect(() => {
    const onFocus = () => searchInputRef.current?.focus();
    window.addEventListener('fintrackly:focus-investments-search', onFocus);
    return () =>
      window.removeEventListener('fintrackly:focus-investments-search', onFocus);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setInitializingView(false));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const activeBrokers = useMemo(() => {
    const ids = new Set(investments.map((inv) => normalisePlatform(inv.platform)));
    return BROKER_FILTERS.filter((b) => b.id === 'all' || ids.has(b.id));
  }, [investments]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return investments.filter((inv) => {
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
      if (marketCapFilter !== 'all') {
        const meta = metadata.get(inv.id);
        const cap = meta?.marketCapCategory ?? 'Unknown';
        if (cap !== marketCapFilter) return false;
      }
      if (brokerFilter !== 'all') {
        if (normalisePlatform(inv.platform) !== brokerFilter) return false;
      }
      if (quickFilter === 'stocks' && inv.type !== 'stock') return false;
      if (quickFilter === 'mfs' && inv.type !== 'mutual_fund') return false;
      if (quickFilter === 'profit' && currentValue(inv) - investedValue(inv) < 0) return false;
      if (quickFilter === 'loss' && currentValue(inv) - investedValue(inv) >= 0) return false;
      if (!q) return true;
      return (
        inv.name.toLowerCase().includes(q) ||
        (inv.symbol ?? '').toLowerCase().includes(q) ||
        (inv.platform ?? '').toLowerCase().includes(q)
      );
    });
  }, [investments, query, typeFilter, brokerFilter, marketCapFilter, metadata, quickFilter]);

  // ── Analytics (correct formulas) ──────────────────────────────────────────
  const analytics = useMemo(() => {
    const summary = summarizePortfolio(filtered);
    const totalInvested = summary.investedTotal;
    const totalCurrent = summary.totalValue;
    const absoluteReturn = totalCurrent - totalInvested;
    const absoluteReturnPct = totalInvested > 0
      ? (absoluteReturn / totalInvested) * 100
      : 0;

    // XIRR — uses lot-level cashflows when available
    const xirrFlows = buildPortfolioCashflows(filtered);
    const xirr = calculateXIRR(xirrFlows);

    // CAGR — from earliest investment date in the filtered set
    const oldestDate = filtered.length > 0
      ? filtered
          .map((i) => earliestInvestmentDate(i))
          .reduce((min, d) => (d < min ? d : min))
      : null;
    const holdingYears = oldestDate
      ? (Date.now() - oldestDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      : 0;
    const cagr = calculateCAGR(totalInvested, totalCurrent, holdingYears);

    // 1-day P&L — stocks only (requires previousClose to be meaningful)
    const hasAnyPrevClose = filtered.some(
      (inv) => inv.type === 'stock' && inv.previousClose != null && inv.previousClose !== inv.currentPrice,
    );
    const dayChange = hasAnyPrevClose
      ? filtered.reduce((acc, inv) => {
          if (inv.type !== 'stock') return acc;
          const prev = inv.previousClose ?? inv.currentPrice;
          return acc + (inv.currentPrice - prev) * inv.quantity;
        }, 0)
      : null;

    // Asset allocation
    const alloc = [
      { label: 'Stocks', value: summary.byType.stock.current },
      { label: 'Mutual Funds', value: summary.byType.mutual_fund.current },
      {
        label: 'Debt',
        value: summary.byType.bond.current + summary.byType.fixed_deposit.current,
      },
      { label: 'Other', value: summary.byType.other.current },
    ].filter((x) => x.value > 0);

    return {
      totalInvested,
      totalCurrent,
      absoluteReturn,
      absoluteReturnPct,
      xirr,
      cagr,
      holdingYears,
      dayChange,
      alloc,
    };
  }, [filtered]);

  const activeBrokerLabel =
    BROKER_FILTERS.find((b) => b.id === brokerFilter)?.label ?? 'All Brokers';
  const showBrokerBadge = brokerFilter !== 'all';

  if (!ready || initializingView) {
    return <InvestmentsSkeleton />;
  }

  const returnColor =
    analytics.absoluteReturn >= 0 ? 'green' : 'red';
  const xirrColor =
    analytics.xirr == null ? 'default' : analytics.xirr >= 0 ? 'green' : 'red';
  const cagrColor =
    analytics.cagr == null ? 'default' : analytics.cagr >= 0 ? 'green' : 'red';
  const dayColor =
    analytics.dayChange == null || analytics.dayChange === 0
      ? 'default'
      : analytics.dayChange > 0
        ? 'green'
        : 'red';

  return (
    <div className='flex flex-col gap-4 md:gap-5 pb-20 md:pb-8'>
      {/* ── Header ── */}
      <header className='flex flex-col gap-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-slate-100/80 dark:to-slate-900/50 p-4 md:p-6 border border-emerald-500/20 shadow-xl'>
        <div className='flex items-center justify-between w-full'>
          <div className='flex items-center gap-3'>
            <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'>
              <FiTrendingUp className='h-5 w-5' />
            </div>
            <div>
              <h1 className='text-xl font-semibold leading-tight text-slate-900 md:text-2xl dark:text-white'>
                Investments
              </h1>
              <p className='text-[11px] md:text-sm text-slate-500 dark:text-slate-400 font-medium'>
                Manage your asset portfolio
              </p>
            </div>
          </div>

          {activeTab === 'investments' && (
            <button
              {...premiumActionProps}
              onClick={() => setIsAddOpen(true)}
              disabled={isAddOpen || premiumActionProps.disabled}
              className='flex h-10 w-10 items-center justify-center gap-2 rounded-xl bg-emerald-500 text-white font-medium shadow-lg shadow-emerald-500/20 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60 md:w-auto md:px-4'
            >
              <FiPlus className='h-5 w-5' />
              <span className='hidden md:inline'>Add Asset</span>
            </button>
          )}
        </div>

        {/* Tab strip */}
        <div className='flex items-center gap-2'>
          <button
            onClick={() => setActiveTab('investments')}
            className={`px-4 py-2 rounded-xl cursor-pointer text-sm font-bold transition-all duration-200 ${
              activeTab === 'investments'
                ? 'bg-slate-300 dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/70 dark:bg-slate-800/60'
            }`}
          >
            Investments
          </button>
          <button
            onClick={() => setActiveTab('sip')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl cursor-pointer text-sm font-bold transition-all duration-200 ${
              activeTab === 'sip'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25'
                : 'text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/70 dark:bg-slate-800/60'
            }`}
          >
            <FiPercent className='h-3.5 w-3.5' />
            Monthly SIP Plan
          </button>
        </div>

        {/* Import buttons */}
        {activeTab === 'investments' && (
          <div className='flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 no-scrollbar'>
            <div className='flex items-center gap-2 rounded-xl bg-slate-100 dark:bg-slate-800/50 p-1 border border-slate-300/60 dark:border-slate-700/50'>
              <ImportAngelOnePdfButton />
              <ImportCsvButton />
              <ImportIndmoneyButton />
              <ImportGrowwButton />
            </div>
          </div>
        )}
      </header>

      {/* ── Tab Content ── */}
      {activeTab === 'sip' ? (
        <MonthlySipPlanPage />
      ) : (
        <>
          {/* Quick filters + saved views */}
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <div className='flex flex-wrap items-center gap-1.5'>
              {[
                { id: 'all', label: 'All' },
                { id: 'stocks', label: 'Stocks' },
                { id: 'mfs', label: 'Mutual Funds' },
                { id: 'profit', label: 'In Profit' },
                { id: 'loss', label: 'In Loss' },
              ].map((qf) => (
                <button
                  key={qf.id}
                  type='button'
                  onClick={() => setQuickFilter(qf.id as any)}
                  className={`rounded-full px-3 py-1 text-xs font-bold transition-colors border ${
                    quickFilter === qf.id
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                      : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {qf.label}
                </button>
              ))}
            </div>
            <SavedViewsMenu
              pageId='investments'
              getState={() => ({
                activeTab,
                query,
                typeFilter,
                brokerFilter,
                marketCapFilter,
                quickFilter,
              })}
              applyState={(s: Record<string, unknown>) => {
                if (s.activeTab === 'investments' || s.activeTab === 'sip')
                  setActiveTab(s.activeTab as 'investments' | 'sip');
                if (typeof s.query === 'string') setQuery(s.query);
                if (typeof s.typeFilter === 'string') setTypeFilter(s.typeFilter);
                if (typeof s.brokerFilter === 'string') setBrokerFilter(s.brokerFilter);
                if (typeof s.marketCapFilter === 'string') setMarketCapFilter(s.marketCapFilter);
                const qf = s.quickFilter;
                if (qf === 'all' || qf === 'stocks' || qf === 'mfs' || qf === 'profit' || qf === 'loss')
                  setQuickFilter(qf);
              }}
            />
          </div>

          {/* ── Analytics Cards ── */}
          {filtered.length > 0 && (
            <div className='flex flex-col gap-3'>
              {/* Row 1: Portfolio totals (always visible) */}
              <div className='grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3'>
                <StatCard
                  label='Invested'
                  value={formatINR(analytics.totalInvested)}
                  color='default'
                />
                <StatCard
                  label='Current Value'
                  value={formatINR(analytics.totalCurrent)}
                  color='default'
                />
                <StatCard
                  label='Total Return'
                  value={`${analytics.absoluteReturn >= 0 ? '+' : ''}${formatINR(analytics.absoluteReturn)}`}
                  sub={`${analytics.absoluteReturnPct >= 0 ? '+' : ''}${analytics.absoluteReturnPct.toFixed(2)}%`}
                  color={returnColor}
                  icon={
                    analytics.absoluteReturn >= 0
                      ? <FiTrendingUp size={12} />
                      : <FiTrendingDown size={12} />
                  }
                />
                {analytics.dayChange !== null ? (
                  <StatCard
                    label='Today P&L'
                    value={`${analytics.dayChange >= 0 ? '+' : ''}${formatINR(analytics.dayChange)}`}
                    sub='Based on prev. close'
                    color={dayColor}
                  />
                ) : (
                  <StatCard
                    label='Assets'
                    value={`${filtered.length}`}
                    sub={`${FILTER_CATEGORIES.find(c => c.id === typeFilter)?.label ?? 'All types'}`}
                    color='default'
                  />
                )}
              </div>

              {/* Row 2: XIRR + CAGR */}
              <div className='grid grid-cols-2 gap-2 md:gap-3'>
                <StatCard
                  label='XIRR'
                  value={
                    analytics.xirr == null
                      ? '—'
                      : `${(analytics.xirr * 100).toFixed(2)}%`
                  }
                  sub={
                    analytics.xirr == null
                      ? 'Need ≥2 cashflows with different dates'
                      : 'Annualised return on actual cash invested'
                  }
                  color={xirrColor}
                />
                <StatCard
                  label='CAGR'
                  value={
                    analytics.cagr == null
                      ? '—'
                      : `${(analytics.cagr * 100).toFixed(2)}%`
                  }
                  sub={
                    analytics.cagr == null
                      ? 'Need invested > 0 and holding period > 0'
                      : `Since earliest investment (${analytics.holdingYears.toFixed(1)}y ago)`
                  }
                  color={cagrColor}
                />
              </div>

              {/* Row 3: Allocation bar (full width) */}
              <AllocationBar alloc={analytics.alloc} total={analytics.totalCurrent} />
            </div>
          )}

          {/* ── Search + Filters ── */}
          <div className='flex flex-col gap-3'>
            <div className='relative group'>
              <FiSearch className='absolute left-4 top-1/2 -translate-y-1/2 text-slate-900 dark:text-slate-500 group-focus-within:text-emerald-500 transition-colors' />
              <input
                ref={searchInputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className='w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 py-3 pl-11 pr-4 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 transition-all'
                placeholder='Search by name, symbol, or broker…'
              />
            </div>

            <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
              <div>
                <p className='text-[10px] font-bold uppercase tracking-widest text-slate-900 dark:text-slate-500 mb-1.5 ml-1'>
                  Asset Type
                </p>
                <FilterDropdown
                  options={FILTER_CATEGORIES}
                  value={typeFilter}
                  onChange={setTypeFilter}
                  accentColor='emerald'
                />
              </div>
              <div>
                <p className='text-[10px] font-bold uppercase tracking-widest text-slate-900 dark:text-slate-500 mb-1.5 ml-1'>
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
            {(showBrokerBadge || typeFilter !== 'all' || marketCapFilter !== 'all') && (
              <div className='flex items-center gap-2 flex-wrap'>
                <span className='text-[10px] text-slate-500 font-semibold uppercase tracking-widest'>
                  Active:
                </span>
                {typeFilter !== 'all' && (
                  <button
                    onClick={() => setTypeFilter('all')}
                    className='flex items-center gap-1.5 rounded-full cursor-pointer border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400 hover:bg-emerald-500/20 transition-colors'
                  >
                    {FILTER_CATEGORIES.find((c) => c.id === typeFilter)?.label}
                    <span className='ml-0.5'>✕</span>
                  </button>
                )}
                {showBrokerBadge && (
                  <button
                    onClick={() => setBrokerFilter('all')}
                    className={`flex items-center gap-1.5 rounded-full cursor-pointer border px-3 py-1 text-xs font-bold hover:opacity-80 transition-opacity ${getBrokerBadgeStyle(brokerFilter)}`}
                  >
                    {activeBrokerLabel}
                    <span className='ml-0.5'>✕</span>
                  </button>
                )}
                {marketCapFilter !== 'all' && (
                  <button
                    onClick={() => setMarketCapFilter('all')}
                    className='flex items-center gap-1.5 rounded-full cursor-pointer border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-bold text-indigo-400 hover:bg-indigo-500/20 transition-colors'
                  >
                    {marketCapFilter}
                    <span className='ml-0.5'>✕</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setTypeFilter('all');
                    setBrokerFilter('all');
                    setMarketCapFilter('all');
                    setQuery('');
                  }}
                  className='text-xs cursor-pointer text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-semibold transition-colors ml-1'
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
