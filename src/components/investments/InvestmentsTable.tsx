// src/components/investments/InvestmentsTable.tsx

import {
  FiArrowDown,
  FiArrowUp,
  FiBox,
  FiBriefcase,
  FiCheck,
  FiCheckSquare,
  FiChevronDown,
  FiDollarSign,
  FiEdit2,
  FiFolder,
  FiGlobe,
  FiHome,
  FiList,
  FiMonitor,
  FiPieChart,
  FiRefreshCw,
  FiSearch,
  FiShield,
  FiSquare,
  FiTag,
  FiTrash2,
  FiTrendingUp,
  FiX,
  FiZap,
} from 'react-icons/fi';
import type {
  FolioSyncResult,
  FundamentalData,
} from '../../utils/folioSyncEngine';
import { currentValue, investedValue } from '../../utils/calculations';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { FolioSyncCell } from './FolioSyncScore';
import { Modal } from '../ui/Modal';
import { SellInvestmentModal } from './SellInvestmentModal';
import { UpsertInvestmentModal } from './UpsertInvestmentModal';
import { createPortal } from 'react-dom';
import { fetchLivePrices } from '../../services/livePriceService';
import { fetchStockMetadata } from '../../services/stockMetadataService';
import { formatINR } from '../../utils/format';
import { resolveAmfiCodes } from '../../services/amfiLookupService';
import toast from 'react-hot-toast';
import { todayISO } from '../../utils/dateUtils';
import { usePortfolioStore } from '../../store/portfolioStore';

const BULK_CATEGORIES = [
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

const MONTHS = [
  { val: '0', label: 'January' },
  { val: '1', label: 'February' },
  { val: '2', label: 'March' },
  { val: '3', label: 'April' },
  { val: '4', label: 'May' },
  { val: '5', label: 'June' },
  { val: '6', label: 'July' },
  { val: '7', label: 'August' },
  { val: '8', label: 'September' },
  { val: '9', label: 'October' },
  { val: '10', label: 'November' },
  { val: '11', label: 'December' },
];

// ── UI Helpers ─────────────────────────────────────────────────────────────

function formatPlatformName(platformStr?: string) {
  if (!platformStr) return 'Direct';
  const str = platformStr.toLowerCase();
  if (str === 'zerodha') return 'Zerodha';
  if (str === 'angel_one' || str === 'angelone') return 'Angel One';
  if (str === 'groww') return 'Groww';
  if (str === 'indmoney') return 'INDmoney';
  if (str === 'upstox') return 'Upstox';
  if (str === 'manual') return 'Direct';
  return str
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function getFinancialYear(dateString: string) {
  const d = new Date(dateString);
  const year = d.getFullYear();
  const month = d.getMonth(); // 0 = Jan, 3 = Apr
  // In India, FY starts April 1st
  if (month >= 3) {
    return `FY ${year}-${(year + 1).toString().slice(-2)}`;
  } else {
    return `FY ${year - 1}-${year.toString().slice(-2)}`;
  }
}

// ── Bulk Edit Category Dropdown ────────────────────────────────────────────
function BulkCategoryDropdown({
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
    BULK_CATEGORIES.find((c) => c.id === value) || BULK_CATEGORIES[0];
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

  return (
    <>
      <button
        ref={triggerRef}
        type='button'
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-semibold transition-all outline-none ${
          open
            ? 'border-emerald-500/50 bg-slate-800 shadow-[0_0_15px_rgba(16,185,129,0.15)] ring-2 ring-emerald-500/20 text-slate-100'
            : 'border-slate-700/80 bg-slate-900/80 hover:border-slate-600 hover:bg-slate-800/80 text-slate-200'
        }`}
      >
        <div className='flex items-center gap-3'>
          <Icon
            className={`h-4 w-4 ${open ? 'text-emerald-400' : 'text-slate-400'}`}
          />
          <span>{selected.label}</span>
        </div>
        <FiChevronDown
          className={`h-4 w-4 transition-transform text-slate-400 ${open ? 'rotate-180 text-emerald-400' : ''}`}
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
            className='max-h-60 overflow-y-auto rounded-xl border border-slate-700 bg-slate-800 shadow-2xl custom-scrollbar py-1.5'
          >
            {BULK_CATEGORIES.map((cat) => {
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

// ── Smart Inline Sector/Cap Cell (Using Portals) ─────────────────────────
function SectorCapCell({
  inv,
  marketCap,
  onSave,
}: {
  inv: any;
  marketCap?: string;
  onSave: (id: string, sector: string, cap: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const [sector, setSector] = useState(inv.sector || '');
  const [cap, setCap] = useState(marketCap || '');

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const panelWidth = 240;

    let left = r.left + window.scrollX;
    if (left + panelWidth > window.innerWidth) {
      left = window.innerWidth - panelWidth - 16;
    }

    setPos({
      top: r.bottom + 8 + window.scrollY,
      left: Math.max(8, left),
    });
  }, []);

  useEffect(() => {
    if (open) {
      setSector(inv.sector || '');
      setCap(marketCap || '');
      updatePos();
    }
  }, [open, inv.sector, marketCap, updatePos]);

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

  if (inv.type !== 'stock') {
    return <span className='text-[11px] text-slate-600'>—</span>;
  }

  const hasTags = inv.sector || marketCap;

  return (
    <>
      <div
        ref={triggerRef}
        className='flex items-center gap-1.5 cursor-pointer whitespace-nowrap group/class'
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        {hasTags ? (
          <>
            {inv.sector ? (
              <SectorChip sector={inv.sector} />
            ) : (
              <span className='text-[10px] text-slate-600 italic'>—</span>
            )}
            {marketCap ? (
              <MarketCapChip cap={marketCap} />
            ) : (
              <span className='text-[10px] text-slate-600 italic'>—</span>
            )}
          </>
        ) : (
          <span className='inline-flex items-center gap-1 rounded-md border border-dashed border-slate-700 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-600 hover:text-emerald-400 hover:border-emerald-500/50 transition-colors'>
            <FiTag size={9} /> Add Tags
          </span>
        )}
        <FiEdit2
          size={10}
          className={`text-slate-600 transition-opacity shrink-0 ml-0.5 ${hasTags ? 'opacity-0 group-hover/class:opacity-100' : 'opacity-100'}`}
        />
      </div>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: 'absolute',
              top: pos.top,
              left: pos.left,
              zIndex: 99999,
            }}
            className='w-[240px] p-3 rounded-xl border border-slate-700 bg-slate-800 shadow-2xl backdrop-blur-xl animate-in fade-in cursor-default'
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className='flex flex-col gap-3'>
              <div>
                <label className='text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1 block'>
                  Sector
                </label>
                <input
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                  placeholder='e.g. Railway, IT, Defence'
                  className='w-full rounded-lg border border-slate-600 bg-slate-900/50 px-3 py-2 text-xs text-white outline-none focus:border-emerald-500'
                />
              </div>
              <div>
                <label className='text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1 block'>
                  Market Cap
                </label>
                <select
                  value={cap}
                  onChange={(e) => setCap(e.target.value)}
                  className='w-full appearance-none rounded-lg border border-slate-600 bg-slate-900/50 px-3 py-2 text-xs text-white outline-none focus:border-emerald-500'
                >
                  <option value=''>Select Cap...</option>
                  <option value='Large Cap'>Large Cap</option>
                  <option value='Mid Cap'>Mid Cap</option>
                  <option value='Small Cap'>Small Cap</option>
                  <option value='Micro Cap'>Micro Cap</option>
                </select>
              </div>
              <div className='flex items-center justify-end gap-2 pt-2'>
                <button
                  type='button'
                  onClick={() => setOpen(false)}
                  className='px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-white transition-colors'
                >
                  Cancel
                </button>
                <button
                  type='button'
                  onClick={() => {
                    onSave(inv.id, sector, cap);
                    setOpen(false);
                  }}
                  className='px-3 py-1.5 rounded-lg bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-500 transition-colors'
                >
                  Save
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

// ── Investment Category Helpers ────────────────────────────────────────────

/**
 * Returns true for stocks & mutual funds — assets that have live prices,
 * quantities, dividends, and benefit from FolioSync analysis.
 */
function isEquityLike(inv: any): boolean {
  if (inv.type === 'stock' || inv.type === 'mutual_fund') return true;
  return false;
}

/**
 * Returns true for fixed-income / government instruments:
 * bonds, FDs, PPF, NPS, EPF, physical gold/silver, real estate, crypto, other.
 * These show maturity date, interest rate, duration instead of qty/live price/dividend/FolioSync.
 */
function isFixedIncome(inv: any): boolean {
  return !isEquityLike(inv);
}

// ── Chip Components ────────────────────────────────────────────────────────

function TypeChip({ inv }: { inv: any }) {
  const type = inv.type;
  const assetType = inv.assetType;
  let label = type.replace('_', ' ');
  let color = 'border-slate-500/30 bg-slate-500/10 text-slate-300';
  let Icon = FiBox;

  if (type === 'stock') {
    if (inv.usdPrice || inv.usdToInr || inv.buyPriceUsd) {
      label = 'Intl Equity';
      color = 'border-blue-500/30 bg-blue-500/10 text-blue-400';
      Icon = FiGlobe;
    } else {
      label = 'Equity';
      color = 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400';
      Icon = FiTrendingUp;
    }
  } else if (type === 'mutual_fund') {
    label = 'Mutual Fund';
    color = 'border-indigo-500/30 bg-indigo-500/10 text-indigo-400';
    Icon = FiPieChart;
  } else if (type === 'bond') {
    label = 'Bond';
    color = 'border-violet-500/30 bg-violet-500/10 text-violet-400';
    Icon = FiBriefcase;
  } else if (type === 'fixed_deposit') {
    label = 'Fixed Deposit';
    color = 'border-amber-500/30 bg-amber-500/10 text-amber-400';
    Icon = FiShield;
  } else if (type === 'other' && assetType) {
    label = assetType.replace('_', ' ');
    if (assetType === 'international_equity') {
      Icon = FiGlobe;
      color = 'border-blue-500/30 bg-blue-500/10 text-blue-400';
    } else if (assetType === 'gold') {
      color = 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400';
    } else if (assetType === 'real_estate') {
      Icon = FiHome;
      color = 'border-orange-500/30 bg-orange-500/10 text-orange-400';
    } else if (assetType === 'crypto') {
      Icon = FiMonitor;
      color = 'border-rose-500/30 bg-rose-500/10 text-rose-400';
    }
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider shadow-sm ${color}`}
    >
      <Icon size={10} />
      {label}
    </span>
  );
}

function SectorChip({ sector }: { sector?: string }) {
  if (!sector) return null;
  return (
    <span className='inline-flex items-center rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-cyan-300 shadow-sm'>
      {sector}
    </span>
  );
}

function MarketCapChip({ cap }: { cap?: string }) {
  if (!cap) return null;
  let color = 'border-slate-500/30 bg-slate-500/10 text-slate-300';
  const c = cap.toLowerCase();
  if (c.includes('large'))
    color = 'border-blue-500/30 bg-blue-500/10 text-blue-300';
  if (c.includes('mid'))
    color = 'border-orange-500/30 bg-orange-500/10 text-orange-300';
  if (c.includes('small') || c.includes('micro'))
    color = 'border-pink-500/30 bg-pink-500/10 text-pink-300';
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider shadow-sm ${color}`}
    >
      {cap}
    </span>
  );
}

// ── Price Cell ─────────────────────────────────────────────────────────────
function PriceCell({
  inv,
  flashState,
  isRefreshing,
}: {
  inv: any;
  flashState: 'up' | 'down' | 'none';
  isRefreshing?: boolean;
}) {
  let price: number | null = null;
  let label = '';

  if (inv.type === 'stock') {
    if (inv.usdPrice) {
      price = inv.usdPrice;
      label = 'USD';
    } else if (inv.usdToInr && inv.currentPrice) {
      price = inv.currentPrice / inv.usdToInr;
      label = 'USD';
    } else {
      price = inv.currentPrice ?? null;
    }
  } else if (inv.type === 'mutual_fund') {
    price = inv.nav ?? null;
    label = 'NAV';
  } else if (inv.type === 'other') {
    const at = (inv.assetType || '').toLowerCase();
    if (at === 'international_equity') {
      price = inv.currentPrice ?? null;
      label = 'USD';
    } else if (at === 'gold') {
      price = inv.currentPrice ?? null;
      label = '/10g';
    } else if (at === 'silver') {
      price = inv.currentPrice ?? null;
      label = '/kg';
    }
  }

  if (isRefreshing) {
    return (
      <span className='inline-flex items-center gap-1 text-xs text-slate-500'>
        <FiRefreshCw size={10} className='animate-spin' />…
      </span>
    );
  }

  if (price === null || price === undefined) {
    return <span className='text-slate-600 text-xs font-medium'>—</span>;
  }

  const flashClass =
    flashState === 'up'
      ? 'text-emerald-300 bg-emerald-500/20 rounded px-1'
      : flashState === 'down'
        ? 'text-rose-300 bg-rose-500/20 rounded px-1'
        : '';

  const isUS =
    (inv.type === 'stock' &&
      (!!inv.usdPrice || !!inv.buyPriceUsd || !!inv.usdToInr)) ||
    (inv.type === 'other' &&
      (inv.assetType || '').toLowerCase() === 'international_equity');

  return (
    <span
      className={`tabular-nums font-semibold transition-all duration-500 text-xs ${flashClass}`}
    >
      {isUS ? '$' : '₹'}
      {Number(price).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
      {label && (
        <span className='text-[9px] text-slate-400 ml-0.5'>{label}</span>
      )}
    </span>
  );
}

// ── Fixed Income Detail Cell ───────────────────────────────────────────────
/**
 * Shows relevant details for bonds, FDs, PPF, NPS, EPF, real estate, gold etc.
 * Replaces Qty / Live Price / Dividend / FolioSync for these asset types.
 */
function FixedIncomeDetails({ inv }: { inv: any }) {
  const rows: { label: string; value: string; highlight?: boolean }[] = [];

  if (inv.type === 'bond' || inv.type === 'fixed_deposit') {
    if (inv.bankName) rows.push({ label: 'Bank', value: inv.bankName });
    if (inv.interestRate)
      rows.push({
        label: 'Rate',
        value: `${inv.interestRate}% p.a.`,
        highlight: true,
      });
    if (inv.maturityDate)
      rows.push({ label: 'Matures', value: inv.maturityDate });
    if (inv.durationMonths)
      rows.push({
        label: 'Duration',
        value:
          `${inv.durationMonths >= 12 ? `${Math.floor(inv.durationMonths / 12)}y ${inv.durationMonths % 12 > 0 ? `${inv.durationMonths % 12}m` : ''}` : `${inv.durationMonths}m`}`.trim(),
      });
  } else if (inv.type === 'other') {
    const assetType = inv.assetType || 'other';
    if (assetType === 'ppf') {
      rows.push({ label: 'Type', value: 'PPF' });
      rows.push({ label: 'Rate', value: '7.1% p.a.', highlight: true });
    } else if (assetType === 'nps') {
      rows.push({ label: 'Type', value: 'NPS' });
    } else if (assetType === 'epf') {
      rows.push({ label: 'Type', value: 'EPF / PF' });
      rows.push({ label: 'Rate', value: '8.25% p.a.', highlight: true });
    } else if (assetType === 'gold' || assetType === 'silver') {
      rows.push({
        label: 'Asset',
        value: assetType === 'gold' ? 'Physical Gold' : 'Physical Silver',
      });
    } else if (assetType === 'real_estate') {
      rows.push({ label: 'Asset', value: 'Real Estate' });
    } else if (assetType === 'crypto') {
      rows.push({ label: 'Asset', value: 'Crypto' });
    }
  }

  if (rows.length === 0)
    return <span className='text-[12px] text-slate-600'>—</span>;

  return (
    <div className='flex flex-col gap-0.5'>
      {rows.map((r) => (
        <div key={r.label} className='flex items-center gap-1.5'>
          <span className='text-[9px] text-slate-600 uppercase tracking-wider w-12 shrink-0'>
            {r.label}
          </span>
          <span
            className={`text-[11px] font-semibold ${r.highlight ? 'text-amber-400' : 'text-slate-300'}`}
          >
            {r.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Per-row refresh button ─────────────────────────────────────────────────
function RowRefreshButton({
  onClick,
  refreshing,
}: {
  onClick: () => void;
  refreshing: boolean;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      disabled={refreshing}
      title='Refresh live price for this row'
      className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold transition-all border ${
        refreshing
          ? 'border-slate-700 bg-slate-800 text-slate-600 cursor-not-allowed'
          : 'border-emerald-500/25 bg-emerald-500/8 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-400/50 active:scale-95'
      }`}
    >
      <FiRefreshCw size={10} className={refreshing ? 'animate-spin' : ''} />
      {!refreshing && <span>Live</span>}
    </button>
  );
}

// ── Symbol resolver ────────────────────────────────────────────────────────
function getLivePriceSymbol(inv: any): string | null {
  const type = inv.type;
  const assetType = (inv.assetType || '').toLowerCase();

  if (type === 'stock') {
    if (!inv.symbol) return null;
    const isUS = !!inv.usdPrice || !!inv.buyPriceUsd || !!inv.usdToInr;
    return isUS ? `US:${inv.symbol.toUpperCase()}` : inv.symbol.toUpperCase();
  }

  if (type === 'mutual_fund') {
    if (inv.schemeCode && /^\d{5,6}$/.test(String(inv.schemeCode).trim()))
      return `MF:${inv.schemeCode}`;
    if (inv.amfiCode && /^\d{5,6}$/.test(String(inv.amfiCode).trim()))
      return `MF:${inv.amfiCode}`;
    if (inv.symbol && /^\d{5,6}$/.test(String(inv.symbol).trim()))
      return `MF:${inv.symbol}`;
    const name = inv.name || inv.symbol;
    return name ? `MF_NAME:${name}` : null;
  }

  if (type === 'other') {
    if (assetType === 'gold') return 'GOLD';
    if (assetType === 'silver') return 'SILVER';
    if (assetType === 'international_equity')
      return inv.symbol ? `US:${inv.symbol.toUpperCase()}` : null;
  }

  return null;
}

// ── Sort Icon ───────────────────────────────────────────────────────────────
function SortIcon({
  col,
  sortCol,
  sortDir,
}: {
  col: string;
  sortCol: string | null;
  sortDir: 'asc' | 'desc';
}) {
  if (sortCol !== col)
    return (
      <FiArrowUp
        size={11}
        className='text-slate-600 group-hover/th:text-slate-400 transition-colors'
      />
    );
  if (sortDir === 'asc')
    return <FiArrowUp size={11} className='text-emerald-400' />;
  return <FiArrowDown size={11} className='text-amber-400' />;
}

// ── Main Component ─────────────────────────────────────────────────────────
export function InvestmentsTable({ investments }: { investments: any[] }) {
  const deleteInvestment = usePortfolioStore((s) => s.deleteInvestment);
  const updateInvestment = usePortfolioStore((s) => s.updateInvestment);

  const [refreshingAll, setRefreshingAll] = useState(false);
  const [fetchProgress, setFetchProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [flashMap, setFlashMap] = useState<
    Record<string, 'up' | 'down' | 'none'>
  >({});
  const [rowRefreshingMap, setRowRefreshingMap] = useState<
    Record<string, boolean>
  >({});

  // Establish the Current Financial Year dynamically based on today
  const currentFYLabel = useMemo(
    () => getFinancialYear(todayISO() || new Date().toISOString()),
    [],
  );
  const shortFYLabel = currentFYLabel.replace('FY ', ''); // Output: "25-26"

  const showFailedSymbolsToast = (
    failed: { name: string; symbol: string; reason: string }[],
  ) => {
    if (failed.length === 0) return;
    if (failed.length === 1) {
      const f = failed[0];
      toast.error(
        `❌ Could not fetch price for "${f.name}"\nSymbol: ${f.symbol} — ${f.reason}\nPlease update the symbol and try again.`,
        { duration: 8000, style: { whiteSpace: 'pre-line', maxWidth: 400 } },
      );
    } else {
      const lines = failed
        .slice(0, 10)
        .map((f) => `• ${f.name} (${f.symbol}): ${f.reason}`)
        .join('\n');
      const extra =
        failed.length > 10 ? `\n…and ${failed.length - 10} more` : '';
      toast.error(
        `❌ ${failed.length} asset${failed.length > 1 ? 's' : ''} could not be fetched:\n${lines}${extra}\n\nPlease update their symbols and try again.`,
        { duration: 10000, style: { whiteSpace: 'pre-line', maxWidth: 440 } },
      );
    }
  };

  const refreshPricesForAssets = async (
    targetInvestments: any[],
    onDone?: (updatedCount: number) => void,
  ) => {
    const noSymbolAssets = targetInvestments.filter(
      (inv) => getLivePriceSymbol(inv) === null,
    );

    const liveAssets = targetInvestments
      .map((inv) => ({ inv, sym: getLivePriceSymbol(inv) }))
      .filter(({ sym }) => sym !== null) as { inv: any; sym: string }[];

    if (liveAssets.length === 0) {
      if (noSymbolAssets.length > 0) {
        showFailedSymbolsToast(
          noSymbolAssets.map((inv) => ({
            name: inv.name,
            symbol: inv.symbol || '—',
            reason: 'No symbol set',
          })),
        );
      }
      onDone?.(0);
      return;
    }

    const mfNameAssets = liveAssets.filter(({ sym }) =>
      sym.startsWith('MF_NAME:'),
    );
    if (mfNameAssets.length > 0) {
      const names = mfNameAssets.map(({ sym }) => sym.slice('MF_NAME:'.length));
      const resolved = await resolveAmfiCodes(names);
      for (const asset of mfNameAssets) {
        const name = asset.sym.slice('MF_NAME:'.length);
        const code = resolved[name];
        if (code) {
          asset.sym = `MF:${code}`;
          updateInvestment(asset.inv.id, { schemeCode: code } as any).catch(
            () => {},
          );
        } else {
          asset.sym = '';
        }
      }
    }

    const fetchableAssets = liveAssets.filter(({ sym }) => sym.length > 0);
    if (fetchableAssets.length === 0) {
      onDone?.(0);
      return;
    }

    const symbols = [...new Set(fetchableAssets.map((a) => a.sym))];
    const result = await fetchLivePrices(symbols, (done, total) => {
      setFetchProgress({ done, total });
    });

    const newFlash: Record<string, 'up' | 'down' | 'none'> = {};
    const updates: Promise<void>[] = [];
    const failedAssets: { name: string; symbol: string; reason: string }[] = [];

    for (const { inv, sym } of fetchableAssets) {
      const fetched = result.prices[sym.toUpperCase()];

      if (!fetched || fetched.price === null) {
        const rawSym = inv.symbol || sym.replace(/^(MF:|US:)/, '');
        const reason = !fetched
          ? 'Symbol not found on exchange'
          : 'Price unavailable (market may be closed)';
        failedAssets.push({ name: inv.name, symbol: rawSym, reason });
        continue;
      }

      const newPrice = fetched.price;
      const type = inv.type;
      const assetType = (inv.assetType || '').toLowerCase();
      let oldPrice = 0;
      let patch: Record<string, any> = {};

      if (type === 'stock') {
        const isUS =
          !!inv.usdPrice || !!inv.buyPriceUsd || fetched.type === 'us_stock';
        if (isUS) {
          const rate = inv.usdToInr || 84;
          oldPrice = inv.usdPrice || 0;
          patch = { usdPrice: newPrice, currentPrice: newPrice * rate };
        } else {
          oldPrice = inv.currentPrice ?? 0;
          patch = { currentPrice: newPrice };
        }
      } else if (type === 'mutual_fund') {
        oldPrice = inv.nav ?? 0;
        patch = { nav: newPrice };
      } else if (type === 'other') {
        if (['gold', 'silver', 'international_equity'].includes(assetType)) {
          oldPrice = inv.currentPrice ?? 0;
          patch = { currentPrice: newPrice };
        }
      }

      if (
        Object.keys(patch).length > 0 &&
        Math.abs(newPrice - oldPrice) > 0.001
      ) {
        newFlash[inv.id] = newPrice > oldPrice ? 'up' : 'down';
        updates.push(updateInvestment(inv.id, patch));
      }
    }

    await Promise.allSettled(updates);
    setFlashMap((prev) => ({ ...prev, ...newFlash }));
    setTimeout(
      () =>
        setFlashMap((prev) => {
          const cleared = { ...prev };
          Object.keys(newFlash).forEach((k) => {
            if (cleared[k] === newFlash[k]) delete cleared[k];
          });
          return cleared;
        }),
      2000,
    );

    const allFailed = [
      ...failedAssets,
      ...noSymbolAssets.map((inv: any) => ({
        name: inv.name,
        symbol: inv.symbol || '—',
        reason: 'No symbol set',
      })),
    ];
    if (allFailed.length > 0) {
      showFailedSymbolsToast(allFailed);
    }

    onDone?.(Object.keys(newFlash).length);
  };

  const handleRefreshAll = async () => {
    setRefreshingAll(true);
    setRefreshError(null);
    setFetchProgress({ done: 0, total: investments.length });

    try {
      await refreshPricesForAssets(investments, (count) => {
        setLastUpdated(
          new Date().toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        );
        if (count === 0) {
          setRefreshError('No price updates — check symbols above.');
          setTimeout(() => setRefreshError(null), 6000);
        }
      });
    } catch (e: any) {
      setRefreshError('Failed to fetch live prices. Please try again.');
      setTimeout(() => setRefreshError(null), 6000);
    } finally {
      setFetchProgress(null);
      setRefreshingAll(false);
    }
  };

  const handleRefreshRow = async (inv: any) => {
    const sym = getLivePriceSymbol(inv);
    if (!sym) {
      toast.error(
        `❌ No symbol set for "${inv.name}"\nPlease edit this asset and add a valid symbol, then try again.`,
        { duration: 8000, style: { whiteSpace: 'pre-line', maxWidth: 380 } },
      );
      return;
    }

    setRowRefreshingMap((prev) => ({ ...prev, [inv.id]: true }));

    try {
      await refreshPricesForAssets([inv]);
      setLastUpdated(
        new Date().toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      );
    } catch (e) {
      console.error('[RowRefresh] Failed for', inv.name, e);
      toast.error(
        `Failed to refresh price for "${inv.name}". Please try again.`,
        {
          duration: 7000,
        },
      );
    } finally {
      setRowRefreshingMap((prev) => ({ ...prev, [inv.id]: false }));
    }
  };

  const [refreshingSelected, setRefreshingSelected] = useState(false);

  const handleRefreshSelected = async () => {
    if (selectedIds.length === 0) return;
    const targets = investments.filter((inv) => selectedIds.includes(inv.id));
    const liveable = targets.filter((inv) => getLivePriceSymbol(inv) !== null);

    if (liveable.length === 0) return;

    setRefreshingSelected(true);
    try {
      await refreshPricesForAssets(liveable, (_count) => {
        setLastUpdated(
          new Date().toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        );
      });
    } catch (e) {
      console.error('[BulkRowRefresh] failed', e);
    } finally {
      setRefreshingSelected(false);
    }
  };

  const [extendedData, setExtendedData] = useState<
    Record<string, { cap?: string }>
  >({});

  useEffect(() => {
    investments.forEach(async (inv) => {
      if (inv.type === 'stock' && inv.symbol && !extendedData[inv.id]) {
        try {
          const meta = await fetchStockMetadata({ symbol: inv.symbol });
          if (meta?.marketCapCategory) {
            setExtendedData((prev) => ({
              ...prev,
              [inv.id]: { cap: meta.marketCapCategory },
            }));
          }
        } catch (e) {
          /* silent */
        }
      }
    });
  }, [investments]);

  // ── FolioSync Scores State ────────────────────────────────────────────────
  type FolioSyncStore = Record<
    string,
    { fundamentals: FundamentalData; result: FolioSyncResult }
  >;

  const [folioSyncData, setFolioSyncData] = useState<FolioSyncStore>(() => {
    try {
      const raw = localStorage.getItem('foliosync_scores');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const handleFolioSyncSave = (
    invId: string,
    fundamentals: FundamentalData,
    result: FolioSyncResult,
  ) => {
    setFolioSyncData((prev) => {
      const next = { ...prev, [invId]: { fundamentals, result } };
      try {
        localStorage.setItem('foliosync_scores', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const [bulkFetching, setBulkFetching] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);

  const handleBulkAutoFetch = async () => {
    const { fetchFundamentalsForSymbols, getFundamentalsSymbol } =
      await import('../../services/fundamentalsService');
    const { scoreFundamentals: scoreF } =
      await import('../../utils/folioSyncEngine');

    const eligible = investments
      .map((inv: any) => ({ inv, sym: getFundamentalsSymbol(inv) }))
      .filter(({ sym }: any) => sym !== null) as { inv: any; sym: string }[];

    if (eligible.length === 0) return;

    setBulkFetching(true);
    setBulkProgress({ done: 0, total: eligible.length });

    const symbols = [...new Set(eligible.map((e: any) => e.sym))];
    const results = await fetchFundamentalsForSymbols(
      symbols,
      (done, total) => {
        setBulkProgress({ done, total });
      },
    );

    let saved = 0;
    for (const { inv, sym } of eligible) {
      const data = (results as any)[sym];
      if (!data || data._source === 'error') continue;
      const cleanData: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(data)) {
        if (!k.startsWith('_')) cleanData[k] = v;
      }
      try {
        const assetClass: any =
          inv.type === 'mutual_fund' ? 'mutual_fund' : 'equity';
        const scored = scoreF(cleanData as any, assetClass);
        handleFolioSyncSave(inv.id, cleanData as any, scored);
        saved++;
      } catch {}
    }

    setBulkProgress(null);
    setBulkFetching(false);
    if (saved > 0)
      toast.success(`FolioSync: scored ${saved}/${eligible.length} assets ✓`);
    else
      toast.error(
        'FolioSync: fetch failed. Make sure the Cloudflare worker is deployed.',
      );
  };

  // ── HISTORICAL DIVIDEND DATA FETCHER ───────────────────────────────────────

  type DividendEvent = { date: string; amount: number; total: number };

  const [dividendData, setDividendData] = useState<
    Record<string, { history: DividendEvent[]; totalAllTime: number }>
  >({});

  const [divRefreshingAll, setDivRefreshingAll] = useState(false);
  const [divFetchProgress, setDivFetchProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [divRowRefreshingMap, setDivRowRefreshingMap] = useState<
    Record<string, boolean>
  >({});

  // Dividend Filter State
  const [divDetailsTarget, setDivDetailsTarget] = useState<any | null>(null);
  const [divFilterFY, setDivFilterFY] = useState<string>('All');
  const [divFilterMonth, setDivFilterMonth] = useState<string>('All');

  const fetchDividendsForAssets = async (
    targetInvestments: any[],
    onDone?: (count: number) => void,
  ) => {
    const eligible = targetInvestments.filter((inv) => {
      const isUS =
        !!inv.usdPrice ||
        !!inv.usdToInr ||
        !!inv.buyPriceUsd ||
        (inv.assetType || '').toLowerCase() === 'international_equity';
      return inv.type === 'stock' && !isUS && !!inv.symbol;
    });

    if (eligible.length === 0) {
      onDone?.(0);
      return;
    }

    // Pull the base URL from your .env file
    const baseUrl = import.meta.env.VITE_LIVE_PRICE_WORKER_URL;

    // Append your specific endpoint
    const WORKER_URL = `${baseUrl}/dividends`;

    const fetchedDivs: Record<
      string,
      { history: DividendEvent[]; totalAllTime: number }
    > = {};
    let doneCount = 0;

    for (const inv of eligible) {
      try {
        const symbolForYahoo = `${inv.symbol}.NS`;
        const response = await fetch(`${WORKER_URL}?symbol=${symbolForYahoo}`);

        if (!response.ok) throw new Error('Failed to fetch from worker');

        const data = await response.json();

        const qty = inv.quantity || 0;
        let totalAllTime = 0;
        const history: DividendEvent[] = [];

        if (Array.isArray(data)) {
          data.forEach((item) => {
            const dps = Number(item.amount);
            const eventTotal = dps * qty;
            totalAllTime += eventTotal;

            history.push({
              date: item.date,
              amount: dps,
              total: eventTotal,
            });

            console.log(
              `[Dividend] ${inv.symbol} | Date: ${item.date} | Qty: ${qty} | DPS: ₹${dps} | Total: ₹${eventTotal}`,
            );
          });
        }

        fetchedDivs[inv.id] = { history, totalAllTime };
      } catch (e) {
        console.error(`Failed to fetch dividends for ${inv.symbol}`, e);
        fetchedDivs[inv.id] = { history: [], totalAllTime: 0 };
      }

      doneCount++;
      setDivFetchProgress({ done: doneCount, total: eligible.length });
    }

    setDividendData((prev) => ({ ...prev, ...fetchedDivs }));
    onDone?.(Object.keys(fetchedDivs).length);
  };

  const handleRefreshAllDivs = async () => {
    setDivRefreshingAll(true);
    setDivFetchProgress({ done: 0, total: investments.length });
    await fetchDividendsForAssets(investments);
    setDivRefreshingAll(false);
    setDivFetchProgress(null);
  };

  const handleRefreshRowDiv = async (inv: any) => {
    setDivRowRefreshingMap((prev) => ({ ...prev, [inv.id]: true }));
    await fetchDividendsForAssets([inv]);
    setDivRowRefreshingMap((prev) => ({ ...prev, [inv.id]: false }));
  };

  // ── Selection & Edit State ─────────────────────────────────────────────
  const [edit, setEdit] = useState<any | null>(null);
  const [sellTarget, setSellTarget] = useState<any | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [selectedBulkCat, setSelectedBulkCat] = useState(BULK_CATEGORIES[0].id);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      investments.map((inv) => {
        const qty =
          inv.type === 'stock'
            ? inv.quantity
            : inv.type === 'mutual_fund'
              ? inv.units
              : null;

        const isUS =
          !!inv.usdPrice ||
          !!inv.usdToInr ||
          !!inv.buyPriceUsd ||
          (inv.assetType || '').toLowerCase() === 'international_equity';

        const divInfo = dividendData[inv.id];
        const isDivLoading = !!divRowRefreshingMap[inv.id];
        const canFetchDiv = inv.type === 'stock' && !isUS && !!inv.symbol;

        // Calculate Dividend only for the current Financial Year to display in the main table
        let dividendCurrentFY = null;
        if (divInfo && divInfo.history.length > 0) {
          dividendCurrentFY = divInfo.history
            .filter((h) => getFinancialYear(h.date) === currentFYLabel)
            .reduce((sum, h) => sum + h.total, 0);
        } else if (divInfo) {
          dividendCurrentFY = 0; // Data fetched but empty history
        }

        return {
          inv,
          invested: investedValue(inv),
          current: currentValue(inv),
          pl: currentValue(inv) - investedValue(inv),
          plPct:
            investedValue(inv) > 0
              ? ((currentValue(inv) - investedValue(inv)) /
                  investedValue(inv)) *
                100
              : 0,
          marketCap: inv.marketCap || extendedData[inv.id]?.cap,
          qty,
          dividendCurrentFY,
          isDivLoading,
          canFetchDiv,
        };
      }),
    [
      investments,
      extendedData,
      dividendData,
      divRowRefreshingMap,
      currentFYLabel,
    ],
  );

  // ── Sort ──────────────────────────────────────────────────────────────────
  type SortCol =
    | 'name'
    | 'broker'
    | 'sector'
    | 'qty'
    | 'invested'
    | 'current'
    | 'livePrice'
    | 'dividend'
    | 'pl'
    | 'plPct'
    | 'folioScore';

  const [sortCol, setSortCol] = useState<SortCol | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSort = (col: SortCol) => {
    if (sortCol !== col) {
      setSortCol(col);
      setSortDir(col === 'folioScore' ? 'desc' : 'asc');
    } else if (sortDir === 'asc') setSortDir('desc');
    else {
      setSortCol(null);
      setSortDir('asc');
    }
  };

  const sortedRows = useMemo(() => {
    if (!sortCol) return rows;
    return [...rows].sort((a, b) => {
      let av: string | number = 0;
      let bv: string | number = 0;
      switch (sortCol) {
        case 'name':
          av = a.inv.name.toLowerCase();
          bv = b.inv.name.toLowerCase();
          break;
        case 'broker':
          av = (a.inv.platform || '').toLowerCase();
          bv = (b.inv.platform || '').toLowerCase();
          break;
        case 'sector':
          av = (a.inv.sector || '').toLowerCase();
          bv = (b.inv.sector || '').toLowerCase();
          break;
        case 'qty':
          av = a.qty ?? 0;
          bv = b.qty ?? 0;
          break;
        case 'invested':
          av = a.invested;
          bv = b.invested;
          break;
        case 'current':
          av = a.current;
          bv = b.current;
          break;
        case 'livePrice':
          av = a.inv.currentPrice ?? (a.inv as any).nav ?? 0;
          bv = b.inv.currentPrice ?? (b.inv as any).nav ?? 0;
          break;
        case 'dividend':
          av = a.dividendCurrentFY ?? -1;
          bv = b.dividendCurrentFY ?? -1;
          break;
        case 'pl':
          av = a.pl;
          bv = b.pl;
          break;
        case 'plPct':
          av = a.plPct;
          bv = b.plPct;
          break;
        case 'folioScore':
          av = folioSyncData[a.inv.id]?.result?.composite ?? -1;
          bv = folioSyncData[b.inv.id]?.result?.composite ?? -1;
          break;
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [rows, sortCol, sortDir, folioSyncData]);

  const isAllSelected =
    sortedRows.length > 0 && selectedIds.length === sortedRows.length;
  const toggleSelectAll = () => {
    if (isAllSelected) setSelectedIds([]);
    else setSelectedIds(sortedRows.map((r) => r.inv.id));
  };
  const toggleRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleSingleDelete = async () => {
    if (deleteId) {
      await deleteInvestment(deleteId);
      setSelectedIds((prev) => prev.filter((id) => id !== deleteId));
    }
    setDeleteId(null);
  };

  const handleBulkDelete = async () => {
    setBulkLoading(true);
    for (const id of selectedIds) await deleteInvestment(id);
    setSelectedIds([]);
    setBulkDeleteOpen(false);
    setBulkLoading(false);
  };

  const handleBulkEditCategory = async () => {
    setBulkLoading(true);
    const cat = BULK_CATEGORIES.find((c) => c.id === selectedBulkCat);
    if (!cat) return;

    for (const id of selectedIds) {
      const existing = investments.find((i) => i.id === id);
      if (!existing) continue;
      const patch: any = { type: cat.type };
      if (cat.type === 'other') patch.assetType = cat.id;
      if (cat.type === 'stock') {
        patch.quantity = existing.quantity || existing.units || 1;
        patch.buyPrice = existing.buyPrice || existing.nav || 0;
        patch.currentPrice = existing.currentPrice || existing.nav || 0;
      } else if (cat.type === 'mutual_fund') {
        patch.units = existing.units || existing.quantity || 1;
        patch.nav = existing.nav || existing.buyPrice || 0;
        patch.investedAmount = existing.investedAmount || 0;
      } else if (cat.type === 'bond' || cat.type === 'fixed_deposit') {
        patch.investedAmount = existing.investedAmount || 0;
        patch.interestRate = existing.interestRate || 0;
        patch.durationMonths = existing.durationMonths || 12;
        patch.startDate = existing.startDate || todayISO();
        patch.maturityDate = existing.maturityDate || todayISO();
      } else if (cat.type === 'other') {
        patch.investedAmount = existing.investedAmount || 0;
        patch.currentValue = existing.currentValue || 0;
      }
      await updateInvestment(id, patch);
    }
    setSelectedIds([]);
    setBulkEditOpen(false);
    setBulkLoading(false);
  };

  const handleSaveClassification = async (
    id: string,
    sector: string,
    cap: string,
  ) => {
    const patch: any = {};
    if (sector !== undefined) patch.sector = sector;
    if (cap !== undefined) patch.marketCap = cap;
    await updateInvestment(id, patch);
  };

  if (rows.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center py-12 rounded-2xl border border-dashed border-slate-800 bg-slate-900/20 text-slate-500'>
        <FiSearch className='h-8 w-8 mb-2 opacity-20' />
        <p className='text-sm font-medium'>No assets found</p>
      </div>
    );
  }

  return (
    <div className='space-y-3 relative'>
      {/* ── Single unified header bar ── */}
      <div className='flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 min-w-0'>
        {/* Left: count */}
        <div className='flex items-center gap-2 shrink-0'>
          <FiList className='h-3.5 w-3.5 text-emerald-500' />
          <span className='text-[11px] font-bold text-slate-400 whitespace-nowrap'>
            <span className='text-white'>{rows.length}</span> asset
            {rows.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Divider */}
        <span className='w-px h-4 bg-slate-700 shrink-0' />

        {/* Centre: legend dots */}
        <div className='flex items-center gap-3 overflow-x-auto no-scrollbar flex-1 min-w-0'>
          {[
            { label: 'NSE', color: 'text-emerald-400', dot: 'bg-emerald-500' },
            { label: 'MF', color: 'text-indigo-400', dot: 'bg-indigo-500' },
            {
              label: 'Gold/Silver',
              color: 'text-yellow-400',
              dot: 'bg-yellow-500',
            },
            { label: 'US', color: 'text-blue-400', dot: 'bg-blue-500' },
          ].map((item) => (
            <span
              key={item.label}
              className={`flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider whitespace-nowrap ${item.color}`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.dot}`}
              />
              {item.label}
            </span>
          ))}
          <span className='text-[9px] text-slate-600 whitespace-nowrap hidden sm:block'>
            · hover row → ⚡ Live to refresh one
          </span>
        </div>

        {/* Divider */}
        <span className='w-px h-4 bg-slate-700 shrink-0' />

        {/* Right: Actions */}
        <div className='flex items-center gap-2 shrink-0 overflow-x-auto no-scrollbar'>
          {lastUpdated && !refreshError && (
            <span className='text-[10px] text-slate-500 whitespace-nowrap hidden md:block'>
              Updated {lastUpdated}
            </span>
          )}
          {refreshError && (
            <span className='text-[10px] font-semibold text-rose-400 whitespace-nowrap max-w-[160px] truncate'>
              {refreshError}
            </span>
          )}

          {/* Refresh All Live Prices */}
          <button
            onClick={handleRefreshAll}
            disabled={refreshingAll}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all border whitespace-nowrap ${
              refreshingAll
                ? 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-400/60 active:scale-95'
            }`}
            title='Refresh live prices for all visible assets'
          >
            {refreshingAll ? (
              <FiRefreshCw size={11} className='animate-spin' />
            ) : (
              <FiZap size={11} />
            )}
            {refreshingAll && fetchProgress
              ? `${fetchProgress.done}/${fetchProgress.total}`
              : refreshingAll
                ? '…'
                : 'Refresh All'}
          </button>

          {/* Dividend All */}
          {investments.some((inv) => {
            const isUS =
              !!inv.usdPrice ||
              !!inv.usdToInr ||
              !!inv.buyPriceUsd ||
              (inv.assetType || '').toLowerCase() === 'international_equity';
            return inv.type === 'stock' && !isUS && !!inv.symbol;
          }) && (
            <button
              onClick={handleRefreshAllDivs}
              disabled={divRefreshingAll}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all border whitespace-nowrap ${
                divRefreshingAll
                  ? 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed'
                  : 'bg-indigo-950/60 border-indigo-800/60 text-indigo-400 hover:bg-indigo-900/60 hover:border-indigo-700 hover:text-indigo-300 active:scale-95'
              }`}
              title='Fetch historical dividends for all Indian stocks'
            >
              {divRefreshingAll ? (
                <FiRefreshCw size={11} className='animate-spin' />
              ) : (
                <FiDollarSign size={11} />
              )}
              {divRefreshingAll && divFetchProgress
                ? `Divs ${divFetchProgress.done}/${divFetchProgress.total}…`
                : 'Fetch Divs'}
            </button>
          )}

          {/* FolioSync Score All */}
          {investments.some((inv) => {
            if (
              inv.type === 'stock' &&
              inv.symbol &&
              !(inv as any).usdPrice &&
              !(inv as any).buyPriceUsd
            )
              return true;
            if (inv.type === 'mutual_fund') {
              const c =
                (inv as any).schemeCode || (inv as any).amfiCode || inv.symbol;
              return c && /^\d{5,6}$/.test(String(c));
            }
            return false;
          }) && (
            <button
              onClick={handleBulkAutoFetch}
              disabled={bulkFetching}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all border whitespace-nowrap ${
                bulkFetching
                  ? 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed'
                  : 'bg-emerald-950/60 border-emerald-800/60 text-emerald-500 hover:bg-emerald-900/60 hover:border-emerald-700 hover:text-emerald-300 active:scale-95'
              }`}
              title='Auto-fetch fundamentals from Screener.in for all Indian equity stocks'
            >
              {bulkFetching ? (
                <span className='animate-spin inline-block text-[11px]'>⟳</span>
              ) : (
                <svg
                  className='w-3 h-3'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z'
                  />
                </svg>
              )}
              {bulkFetching && bulkProgress
                ? `Scoring ${bulkProgress.done}/${bulkProgress.total}…`
                : 'Score All'}
            </button>
          )}
        </div>
      </div>

      {/* Progress bar — only for large portfolios */}
      {refreshingAll && fetchProgress && fetchProgress.total > 20 && (
        <div className='h-0.5 w-full bg-slate-800 rounded-full overflow-hidden -mt-1'>
          <div
            className='h-full bg-emerald-500 rounded-full transition-all duration-300'
            style={{
              width: `${Math.round((fetchProgress.done / fetchProgress.total) * 100)}%`,
            }}
          />
        </div>
      )}

      {/* ── FolioSync Summary Banner ── */}
      {(() => {
        const scored = rows.filter((r) => folioSyncData[r.inv.id]?.result);
        const unscored = rows.length - scored.length;
        if (scored.length === 0) return null;

        const dist = {
          aggressiveBuy: scored.filter(
            (r) => folioSyncData[r.inv.id].result.signal === 'AGGRESSIVE_BUY',
          ).length,
          buy: scored.filter(
            (r) => folioSyncData[r.inv.id].result.signal === 'BUY',
          ).length,
          hold: scored.filter(
            (r) => folioSyncData[r.inv.id].result.signal === 'HOLD',
          ).length,
          sell: scored.filter(
            (r) => folioSyncData[r.inv.id].result.signal === 'SELL',
          ).length,
          aggressiveSell: scored.filter(
            (r) => folioSyncData[r.inv.id].result.signal === 'AGGRESSIVE_SELL',
          ).length,
        };
        const avgScore =
          scored.reduce(
            (sum, r) => sum + folioSyncData[r.inv.id].result.composite,
            0,
          ) / scored.length;

        return (
          <div className='flex items-center gap-3 px-3 py-2 rounded-xl bg-emerald-950/40 border border-emerald-900/50 overflow-x-auto no-scrollbar'>
            {/* Label */}
            <span className='text-[10px] font-black uppercase tracking-widest text-emerald-600 shrink-0 flex items-center gap-1.5'>
              <svg
                className='w-3 h-3'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z'
                />
              </svg>
              FolioSync
            </span>

            <span className='w-px h-4 bg-emerald-900/60 shrink-0' />

            {/* Avg score */}
            <div className='flex items-center gap-1 shrink-0'>
              <span className='text-[10px] text-slate-500'>Avg</span>
              <span
                className='text-[13px] font-black tabular-nums'
                style={{
                  color:
                    avgScore >= 7
                      ? '#4ADE80'
                      : avgScore >= 5
                        ? '#FBBF24'
                        : '#F87171',
                }}
              >
                {avgScore.toFixed(1)}
              </span>
              <span className='text-[9px] text-slate-600'>/10</span>
            </div>

            <span className='w-px h-4 bg-emerald-900/60 shrink-0' />

            {/* Signal distribution */}
            <div className='flex items-center gap-2 shrink-0'>
              {dist.aggressiveBuy > 0 && (
                <span className='flex items-center gap-1 text-[10px] font-bold text-teal-300'>
                  <span className='w-1.5 h-1.5 rounded-full bg-teal-400' />
                  {dist.aggressiveBuy} Agg.Buy
                </span>
              )}
              {dist.buy > 0 && (
                <span className='flex items-center gap-1 text-[10px] font-bold text-emerald-400'>
                  <span className='w-1.5 h-1.5 rounded-full bg-emerald-500' />
                  {dist.buy} Buy
                </span>
              )}
              {dist.hold > 0 && (
                <span className='flex items-center gap-1 text-[10px] font-bold text-amber-400'>
                  <span className='w-1.5 h-1.5 rounded-full bg-amber-500' />
                  {dist.hold} Hold
                </span>
              )}
              {dist.sell > 0 && (
                <span className='flex items-center gap-1 text-[10px] font-bold text-red-400'>
                  <span className='w-1.5 h-1.5 rounded-full bg-red-500' />
                  {dist.sell} Sell
                </span>
              )}
              {dist.aggressiveSell > 0 && (
                <span className='flex items-center gap-1 text-[10px] font-bold text-red-500'>
                  <span className='w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse' />
                  {dist.aggressiveSell} Agg.Sell
                </span>
              )}
            </div>

            {/* Unscored nudge */}
            {unscored > 0 && (
              <>
                <span className='w-px h-4 bg-emerald-900/60 shrink-0' />
                <span className='text-[10px] text-slate-600 whitespace-nowrap'>
                  {unscored} unscored
                </span>
              </>
            )}
          </div>
        );
      })()}

      {/* ── MOBILE VIEW ── */}
      <div className='flex flex-col gap-2.5 md:hidden px-1'>
        {/* Select-all bar */}
        <div className='flex items-center justify-between px-1 py-1'>
          <button
            onClick={toggleSelectAll}
            className='flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider hover:text-emerald-400 transition-colors'
          >
            {isAllSelected ? (
              <FiCheckSquare size={15} className='text-emerald-500' />
            ) : (
              <FiSquare size={15} />
            )}
            {isAllSelected ? 'Deselect All' : 'Select All'}
          </button>
          <span className='text-[11px] text-slate-600 font-medium'>
            {sortedRows.length} assets
          </span>
        </div>

        {sortedRows.map(
          ({
            inv,
            invested,
            current,
            pl,
            plPct,
            marketCap,
            qty,
            dividendCurrentFY,
            isDivLoading,
            canFetchDiv,
          }) => {
            const isSelected = selectedIds.includes(inv.id);
            const isRowRefreshing = !!rowRefreshingMap[inv.id];
            const hasLiveSymbol = getLivePriceSymbol(inv) !== null;
            const isProfit = pl >= 0;

            return (
              <div
                key={inv.id}
                className={`relative rounded-2xl border overflow-hidden transition-all duration-150 ${
                  isSelected
                    ? 'border-emerald-500/40 bg-emerald-500/[0.05]'
                    : 'border-slate-800 bg-slate-900/60'
                }`}
              >
                {/* Profit/Loss accent bar on left edge */}
                <div
                  className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-l-2xl ${isProfit ? 'bg-emerald-500' : 'bg-rose-500'}`}
                />

                <div className='pl-3 pr-3 pt-3 pb-3'>
                  {/* ── Row 1: Checkbox + Name + Actions ── */}
                  <div className='flex items-start gap-2.5'>
                    <button
                      onClick={() => toggleRow(inv.id)}
                      className='mt-0.5 shrink-0 text-slate-500 hover:text-emerald-400 transition-colors'
                    >
                      {isSelected ? (
                        <FiCheckSquare size={15} className='text-emerald-500' />
                      ) : (
                        <FiSquare size={15} />
                      )}
                    </button>

                    <div className='flex-1 min-w-0'>
                      <div className='flex items-start justify-between gap-2'>
                        <div className='min-w-0 flex-1'>
                          <h3
                            className='font-bold text-[14px] text-slate-100 truncate leading-tight'
                            title={inv.name}
                          >
                            {inv.name}
                          </h3>
                          <div className='flex items-center gap-1.5 mt-1 flex-wrap'>
                            <TypeChip inv={inv} />
                            <span className='inline-flex items-center rounded-md bg-slate-800 border border-slate-700/50 px-1.5 py-0.5 text-[9px] font-bold text-slate-400 uppercase tracking-wider'>
                              {formatPlatformName(inv.platform)}
                            </span>
                            {qty !== null && qty !== undefined && (
                              <span className='text-[10px] text-slate-600 font-medium'>
                                ×{' '}
                                {Number(qty).toLocaleString('en-IN', {
                                  maximumFractionDigits: 4,
                                })}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className='flex items-center gap-1 shrink-0'>
                          {isEquityLike(inv) && hasLiveSymbol && (
                            <RowRefreshButton
                              onClick={() => handleRefreshRow(inv)}
                              refreshing={isRowRefreshing}
                            />
                          )}
                          {isEquityLike(inv) && (
                            <button
                              onClick={() => setSellTarget(inv)}
                              title='Record sale & track profit'
                              className='flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-all'
                            >
                              <FiDollarSign size={12} />
                            </button>
                          )}
                          <button
                            onClick={() => setEdit(inv)}
                            className='flex items-center justify-center w-7 h-7 rounded-lg bg-slate-800 border border-slate-700/50 text-slate-400 hover:text-white transition-all'
                          >
                            <FiEdit2 size={12} />
                          </button>
                          <button
                            onClick={() => setDeleteId(inv.id)}
                            className='flex items-center justify-center w-7 h-7 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition-all'
                          >
                            <FiTrash2 size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Sector + Cap tags — stocks only */}
                      {inv.type === 'stock' && (
                        <div className='mt-2'>
                          <SectorCapCell
                            inv={inv}
                            marketCap={marketCap}
                            onSave={handleSaveClassification}
                          />
                        </div>
                      )}

                      {/* FolioSync Score (mobile) — equity only */}
                      {isEquityLike(inv) && (
                        <div className='mt-2'>
                          <FolioSyncCell
                            inv={inv}
                            storedFundamentals={
                              folioSyncData[inv.id]?.fundamentals
                            }
                            storedResult={folioSyncData[inv.id]?.result}
                            onSave={handleFolioSyncSave}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Row 2: Stats grid ── */}
                  <div
                    className={`mt-3 pt-3 border-t grid grid-cols-4 gap-1 ${isSelected ? 'border-emerald-500/20' : 'border-slate-800/60'}`}
                  >
                    {/* Invested */}
                    <div className='flex flex-col gap-0.5'>
                      <span className='text-[9px] font-bold uppercase tracking-wider text-slate-600'>
                        Invested
                      </span>
                      <span className='text-[13px] font-semibold text-slate-400 tabular-nums'>
                        {formatINR(invested)}
                      </span>
                    </div>

                    {/* Current Value */}
                    <div className='flex flex-col gap-0.5 items-center'>
                      <span className='text-[9px] font-bold uppercase tracking-wider text-slate-600'>
                        Curr. Value
                      </span>
                      <span className='text-[13px] font-bold text-white tabular-nums'>
                        {formatINR(current)}
                      </span>
                      {isEquityLike(inv) && hasLiveSymbol && (
                        <PriceCell
                          inv={inv}
                          flashState={flashMap[inv.id] ?? 'none'}
                          isRefreshing={isRowRefreshing}
                        />
                      )}
                    </div>

                    {/* Dividend (equity) | Details (fixed income) */}
                    {isEquityLike(inv) ? (
                      <div className='flex flex-col gap-0.5 items-center'>
                        <span className='text-[9px] font-bold uppercase tracking-wider text-slate-600'>
                          Div ({shortFYLabel})
                        </span>
                        {canFetchDiv ? (
                          isDivLoading ? (
                            <span className='text-[10px] text-slate-500 mt-1'>
                              <FiRefreshCw size={10} className='animate-spin' />
                            </span>
                          ) : dividendCurrentFY !== null &&
                            dividendCurrentFY > 0 ? (
                            <div
                              className='flex flex-col items-center gap-0.5 cursor-pointer hover:bg-slate-800 rounded px-1 transition-colors'
                              title='Click to view full history'
                              onClick={() => setDivDetailsTarget(inv)}
                            >
                              <span className='text-[13px] font-bold text-emerald-400 tabular-nums'>
                                {formatINR(dividendCurrentFY)}
                              </span>
                              <span className='text-[9px] text-slate-500 font-medium tabular-nums'>
                                History
                              </span>
                            </div>
                          ) : dividendCurrentFY !== null &&
                            dividendCurrentFY === 0 ? (
                            <div
                              className='flex flex-col items-center gap-0.5 cursor-pointer hover:bg-slate-800 rounded px-1 transition-colors'
                              title='Click to view full history'
                              onClick={() => setDivDetailsTarget(inv)}
                            >
                              <span className='text-[13px] font-medium text-slate-600'>
                                ₹0
                              </span>
                              <span className='text-[9px] text-slate-500 font-medium tabular-nums'>
                                History
                              </span>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRefreshRowDiv(inv);
                              }}
                              className='mt-0.5 inline-flex items-center gap-1 rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-semibold text-slate-400 hover:text-emerald-400 hover:bg-slate-700 transition-colors'
                            >
                              <FiRefreshCw size={8} /> Fetch
                            </button>
                          )
                        ) : (
                          <span className='text-[13px] font-medium text-slate-600'>
                            —
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className='flex flex-col gap-0.5 items-center'>
                        <span className='text-[9px] font-bold uppercase tracking-wider text-slate-600'>
                          Details
                        </span>
                        <FixedIncomeDetails inv={inv} />
                      </div>
                    )}

                    {/* P&L */}
                    <div className='flex flex-col gap-0.5 items-end'>
                      <span className='text-[9px] font-bold uppercase tracking-wider text-slate-600'>
                        P&amp;L
                      </span>
                      <span
                        className={`text-[13px] font-bold tabular-nums ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}
                      >
                        {isProfit ? '+' : ''}
                        {formatINR(pl)}
                      </span>
                      <span
                        className={`text-[10px] font-semibold tabular-nums ${isProfit ? 'text-emerald-500' : 'text-rose-500'}`}
                      >
                        {isProfit ? '▲' : '▼'} {Math.abs(plPct).toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          },
        )}
      </div>

      {/* ── DESKTOP VIEW ── */}
      <div className='hidden md:block overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40 shadow-xl'>
        <div className='overflow-x-auto pb-2'>
          <table className='w-full text-sm border-separate border-spacing-0'>
            {/* ── HEADER ── */}
            <thead>
              <tr className='whitespace-nowrap'>
                {/* Checkbox */}
                <th className='sticky top-0 z-10 bg-slate-900 px-3 py-2.5 w-10 border-b border-slate-700/60'>
                  <button
                    onClick={toggleSelectAll}
                    className='flex items-center justify-center text-slate-500 hover:text-emerald-400 transition-colors'
                  >
                    {isAllSelected ? (
                      <FiCheckSquare size={14} className='text-emerald-500' />
                    ) : (
                      <FiSquare size={14} />
                    )}
                  </button>
                </th>

                {/* Asset */}
                <th className='sticky top-0 z-10 bg-slate-900 pl-2 pr-4 py-2.5 border-b border-slate-700/60'>
                  <button
                    onClick={() => handleSort('name')}
                    className='flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500 hover:text-slate-200 transition-colors group/th'
                  >
                    Asset
                    <SortIcon col='name' sortCol={sortCol} sortDir={sortDir} />
                  </button>
                </th>

                {/* Broker */}
                <th className='sticky top-0 z-10 bg-slate-900 px-4 py-2.5 border-b border-slate-700/60'>
                  <button
                    onClick={() => handleSort('broker')}
                    className='flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500 hover:text-slate-200 transition-colors group/th'
                  >
                    Broker
                    <SortIcon
                      col='broker'
                      sortCol={sortCol}
                      sortDir={sortDir}
                    />
                  </button>
                </th>

                {/* Sector · Cap */}
                <th className='sticky top-0 z-10 bg-slate-900 px-4 py-2.5 border-b border-slate-700/60'>
                  <button
                    onClick={() => handleSort('sector')}
                    className='flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500 hover:text-slate-200 transition-colors group/th'
                  >
                    Sector · Cap
                    <SortIcon
                      col='sector'
                      sortCol={sortCol}
                      sortDir={sortDir}
                    />
                  </button>
                </th>

                {/* Qty */}
                <th className='sticky top-0 z-10 bg-slate-900 px-4 py-2.5 border-b border-slate-700/60'>
                  <button
                    onClick={() => handleSort('qty')}
                    className='flex items-center justify-end gap-1 w-full text-[10px] font-semibold uppercase tracking-widest text-slate-500 hover:text-slate-200 transition-colors group/th'
                  >
                    <SortIcon col='qty' sortCol={sortCol} sortDir={sortDir} />
                    Qty
                  </button>
                </th>

                {/* Invested */}
                <th className='sticky top-0 z-10 bg-slate-900 px-4 py-2.5 border-b border-slate-700/60'>
                  <button
                    onClick={() => handleSort('invested')}
                    className='flex items-center justify-end gap-1 w-full text-[10px] font-semibold uppercase tracking-widest text-slate-500 hover:text-slate-200 transition-colors group/th'
                  >
                    <SortIcon
                      col='invested'
                      sortCol={sortCol}
                      sortDir={sortDir}
                    />
                    Invested
                  </button>
                </th>

                {/* Curr. Value */}
                <th className='sticky top-0 z-10 bg-slate-900 px-4 py-2.5 border-b border-slate-700/60'>
                  <button
                    onClick={() => handleSort('current')}
                    className='flex items-center justify-end gap-1 w-full text-[10px] font-semibold uppercase tracking-widest text-slate-500 hover:text-slate-200 transition-colors group/th'
                  >
                    <SortIcon
                      col='current'
                      sortCol={sortCol}
                      sortDir={sortDir}
                    />
                    Curr. Value
                  </button>
                </th>

                {/* Dividend */}
                <th className='sticky top-0 z-10 bg-slate-900 px-4 py-2.5 border-b border-slate-700/60'>
                  <button
                    onClick={() => handleSort('dividend')}
                    className='flex items-center justify-end gap-1 w-full text-[10px] font-semibold uppercase tracking-widest text-slate-500 hover:text-slate-200 transition-colors group/th'
                  >
                    <SortIcon
                      col='dividend'
                      sortCol={sortCol}
                      sortDir={sortDir}
                    />
                    Div ({shortFYLabel})
                  </button>
                </th>

                {/* Live Price */}
                <th className='sticky top-0 z-10 bg-slate-900 px-4 py-2.5 border-b border-slate-700/60'>
                  <button
                    onClick={() => handleSort('livePrice')}
                    className='flex items-center justify-end gap-1 w-full text-[10px] font-semibold uppercase tracking-widest text-slate-500 hover:text-slate-200 transition-colors group/th'
                  >
                    <SortIcon
                      col='livePrice'
                      sortCol={sortCol}
                      sortDir={sortDir}
                    />
                    Live Price
                  </button>
                </th>

                {/* Refresh */}
                <th className='sticky top-0 z-10 bg-slate-900 px-2 py-2.5 w-10 text-center text-[10px] font-semibold text-slate-600 border-b border-slate-700/60'>
                  ⚡
                </th>

                {/* FolioSync Score */}
                <th className='sticky top-0 z-10 bg-slate-900 px-3 py-2.5 border-b border-slate-700/60 min-w-[140px]'>
                  <button
                    onClick={() => handleSort('folioScore')}
                    className='flex items-center gap-1.5 group/th'
                  >
                    <span
                      className={`text-[10px] font-black uppercase tracking-widest transition-colors ${sortCol === 'folioScore' ? 'text-emerald-400' : 'text-emerald-700 group-hover/th:text-emerald-500'}`}
                    >
                      FolioSync
                    </span>
                    <SortIcon
                      col='folioScore'
                      sortCol={sortCol}
                      sortDir={sortDir}
                    />
                  </button>
                </th>

                {/* P&L */}
                <th className='sticky top-0 z-10 bg-slate-900 px-4 py-2.5 border-b border-slate-700/60 min-w-[120px]'>
                  <div className='flex items-center justify-end gap-2'>
                    <button
                      onClick={() => handleSort('pl')}
                      className={`text-[10px] font-semibold uppercase tracking-widest hover:text-slate-200 transition-colors ${sortCol === 'pl' ? 'text-emerald-400' : 'text-slate-500'}`}
                    >
                      <span className='flex items-center gap-1'>
                        <SortIcon
                          col='pl'
                          sortCol={sortCol}
                          sortDir={sortDir}
                        />{' '}
                        P&amp;L
                      </span>
                    </button>
                    <span className='text-slate-700 text-[10px]'>/</span>
                    <button
                      onClick={() => handleSort('plPct')}
                      className={`text-[10px] font-semibold uppercase tracking-widest hover:text-slate-200 transition-colors ${sortCol === 'plPct' ? 'text-emerald-400' : 'text-slate-500'}`}
                    >
                      <span className='flex items-center gap-1'>
                        %{' '}
                        <SortIcon
                          col='plPct'
                          sortCol={sortCol}
                          sortDir={sortDir}
                        />
                      </span>
                    </button>
                  </div>
                </th>

                {/* Actions */}
                <th className='sticky top-0 z-10 bg-slate-900 px-3 py-2.5 w-16 border-b border-slate-700/60' />
              </tr>
            </thead>

            {/* ── BODY ── */}
            <tbody>
              {sortedRows.map(
                (
                  {
                    inv,
                    invested,
                    current,
                    pl,
                    plPct,
                    marketCap,
                    qty,
                    dividendCurrentFY,
                    isDivLoading,
                    canFetchDiv,
                  },
                  rowIdx,
                ) => {
                  const isSelected = selectedIds.includes(inv.id);
                  const isRowRefreshing = !!rowRefreshingMap[inv.id];
                  const hasLiveSymbol = getLivePriceSymbol(inv) !== null;
                  const isLast = rowIdx === sortedRows.length - 1;
                  const bdClass = !isLast ? 'border-b border-slate-800/70' : '';

                  return (
                    <tr
                      key={inv.id}
                      className={`group transition-colors duration-100 ${isSelected ? 'bg-emerald-500/[0.07]' : 'hover:bg-slate-800/50'}`}
                    >
                      {/* ── Checkbox ── */}
                      <td className={`px-3 py-3.5 ${bdClass}`}>
                        <button
                          onClick={() => toggleRow(inv.id)}
                          className='flex items-center justify-center text-slate-500 hover:text-emerald-400 transition-colors'
                        >
                          {isSelected ? (
                            <FiCheckSquare
                              size={14}
                              className='text-emerald-500'
                            />
                          ) : (
                            <FiSquare size={14} />
                          )}
                        </button>
                      </td>

                      {/* ── Asset ── */}
                      <td className={`pl-2 pr-4 py-3.5 ${bdClass}`}>
                        <div className='flex flex-col gap-1 min-w-[150px] max-w-[210px]'>
                          <span
                            className='font-semibold text-[13px] text-slate-100 truncate leading-tight'
                            title={inv.name}
                          >
                            {inv.name}
                          </span>
                          <div className='flex items-center gap-1.5'>
                            <TypeChip inv={inv} />
                            {inv.symbol && (
                              <span className='text-[10px] font-bold text-slate-600 tracking-wide'>
                                {inv.symbol}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* ── Broker ── */}
                      <td className={`px-4 py-3.5 ${bdClass}`}>
                        <span className='inline-flex items-center rounded-md bg-slate-800 border border-slate-700/50 px-2 py-0.5 text-[10px] font-bold text-slate-300 uppercase tracking-wider whitespace-nowrap'>
                          {formatPlatformName(inv.platform)}
                        </span>
                      </td>

                      {/* ── Sector · Cap ── */}
                      <td className={`px-4 py-3.5 ${bdClass}`}>
                        {inv.type === 'stock' ? (
                          <SectorCapCell
                            inv={inv}
                            marketCap={marketCap}
                            onSave={handleSaveClassification}
                          />
                        ) : isFixedIncome(inv) ? (
                          <FixedIncomeDetails inv={inv} />
                        ) : (
                          <SectorCapCell
                            inv={inv}
                            marketCap={marketCap}
                            onSave={handleSaveClassification}
                          />
                        )}
                      </td>

                      {/* ── Qty — equity only ── */}
                      <td
                        className={`px-4 py-3.5 text-right tabular-nums ${bdClass}`}
                      >
                        {isEquityLike(inv) ? (
                          <span className='text-[13px] font-medium text-slate-300'>
                            {qty !== null && qty !== undefined ? (
                              Number(qty).toLocaleString('en-IN', {
                                maximumFractionDigits: 4,
                              })
                            ) : (
                              <span className='text-slate-600'>—</span>
                            )}
                          </span>
                        ) : (
                          <span className='text-slate-700 text-xs'>—</span>
                        )}
                      </td>

                      {/* ── Invested ── */}
                      <td
                        className={`px-4 py-3.5 text-right tabular-nums ${bdClass}`}
                      >
                        <span className='text-[13px] font-medium text-slate-400'>
                          {formatINR(invested)}
                        </span>
                      </td>

                      {/* ── Current Val ── */}
                      <td
                        className={`px-4 py-3.5 text-right tabular-nums ${bdClass}`}
                      >
                        <span className='text-[13px] font-bold text-white'>
                          {formatINR(current)}
                        </span>
                      </td>

                      {/* ── Dividend — equity only ── */}
                      <td
                        className={`px-4 py-3.5 text-right tabular-nums ${bdClass}`}
                      >
                        {isEquityLike(inv) ? (
                          canFetchDiv ? (
                            isDivLoading ? (
                              <span className='inline-flex items-center justify-end w-full text-[10px] text-slate-500'>
                                <FiRefreshCw
                                  size={10}
                                  className='animate-spin'
                                />
                              </span>
                            ) : dividendCurrentFY !== null &&
                              dividendCurrentFY > 0 ? (
                              <div
                                className='flex flex-col items-end gap-0.5 cursor-pointer hover:bg-slate-800 rounded px-1 -mr-1 transition-colors'
                                title='Click to view full history'
                                onClick={() => setDivDetailsTarget(inv)}
                              >
                                <span className='text-[13px] font-bold text-emerald-400'>
                                  {formatINR(dividendCurrentFY)}
                                </span>
                                <span className='text-[9px] text-slate-500 font-medium'>
                                  History
                                </span>
                              </div>
                            ) : dividendCurrentFY !== null &&
                              dividendCurrentFY === 0 ? (
                              <div
                                className='flex flex-col items-end gap-0.5 cursor-pointer hover:bg-slate-800 rounded px-1 -mr-1 transition-colors'
                                title='Click to view full history'
                                onClick={() => setDivDetailsTarget(inv)}
                              >
                                <span className='text-[13px] font-medium text-slate-600'>
                                  ₹0
                                </span>
                                <span className='text-[9px] text-slate-500 font-medium'>
                                  History
                                </span>
                              </div>
                            ) : (
                              <div className='flex justify-end opacity-0 group-hover:opacity-100 transition-opacity'>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRefreshRowDiv(inv);
                                  }}
                                  className='inline-flex items-center gap-1 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 hover:text-emerald-400 hover:bg-slate-700 transition-colors'
                                >
                                  <FiRefreshCw size={10} /> Get Div
                                </button>
                              </div>
                            )
                          ) : (
                            <span className='text-[13px] font-medium text-slate-600'>
                              —
                            </span>
                          )
                        ) : (
                          <span className='text-slate-700 text-xs'>—</span>
                        )}
                      </td>

                      {/* ── Live Price — equity only ── */}
                      <td
                        className={`px-4 py-3.5 text-right tabular-nums ${bdClass}`}
                      >
                        {isEquityLike(inv) ? (
                          <PriceCell
                            inv={inv}
                            flashState={flashMap[inv.id] ?? 'none'}
                            isRefreshing={isRowRefreshing}
                          />
                        ) : (
                          <span className='text-slate-700 text-xs'>—</span>
                        )}
                      </td>

                      {/* ── Refresh button — equity only ── */}
                      <td className={`px-2 py-3.5 text-center ${bdClass}`}>
                        {isEquityLike(inv) && hasLiveSymbol ? (
                          <span className='opacity-0 group-hover:opacity-100 transition-opacity'>
                            <RowRefreshButton
                              onClick={() => handleRefreshRow(inv)}
                              refreshing={isRowRefreshing}
                            />
                          </span>
                        ) : (
                          <span className='text-slate-700 text-[10px]'>—</span>
                        )}
                      </td>

                      {/* ── FolioSync Score — equity only ── */}
                      <td className={`px-3 py-2.5 ${bdClass}`}>
                        {isEquityLike(inv) ? (
                          <FolioSyncCell
                            inv={inv}
                            storedFundamentals={
                              folioSyncData[inv.id]?.fundamentals
                            }
                            storedResult={folioSyncData[inv.id]?.result}
                            onSave={handleFolioSyncSave}
                          />
                        ) : (
                          <span className='text-slate-700 text-xs'>—</span>
                        )}
                      </td>

                      {/* ── P&L ── */}
                      <td
                        className={`px-4 py-3.5 text-right tabular-nums ${bdClass}`}
                      >
                        <div
                          className={`flex flex-col items-end gap-0.5 ${pl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                        >
                          <span className='text-[13px] font-bold leading-none whitespace-nowrap'>
                            {pl >= 0 ? '+' : ''}
                            {formatINR(pl)}
                          </span>
                          <span className='text-[10px] font-semibold whitespace-nowrap opacity-80'>
                            {pl >= 0 ? '▲' : '▼'} {Math.abs(plPct).toFixed(2)}%
                          </span>
                        </div>
                      </td>

                      {/* ── Actions ── */}
                      <td className={`px-3 py-3.5 ${bdClass}`}>
                        <div className='flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity'>
                          {isEquityLike(inv) && (
                            <button
                              onClick={() => setSellTarget(inv)}
                              title='Record sale & track profit'
                              className='flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-all'
                            >
                              <FiDollarSign size={12} />
                            </button>
                          )}
                          <button
                            onClick={() => setEdit(inv)}
                            className='flex items-center justify-center w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700/60 transition-all'
                          >
                            <FiEdit2 size={12} />
                          </button>
                          <button
                            onClick={() => setDeleteId(inv.id)}
                            className='flex items-center justify-center w-7 h-7 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700/60 transition-all'
                          >
                            <FiTrash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                },
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className='fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-4 z-40 animate-in slide-in-from-bottom-8 fade-in duration-300'>
          <div className='flex items-center gap-2'>
            <span className='flex items-center justify-center bg-emerald-500 text-white text-xs font-bold h-6 w-6 rounded-full'>
              {selectedIds.length}
            </span>
            <span className='text-sm font-semibold text-slate-300 hidden sm:block'>
              selected
            </span>
          </div>
          <div className='w-px h-6 bg-slate-700 mx-1' />

          <button
            onClick={handleRefreshSelected}
            disabled={refreshingSelected}
            className={`flex items-center gap-2 text-sm font-bold transition-colors ${
              refreshingSelected
                ? 'text-slate-500 cursor-not-allowed'
                : 'text-emerald-400 hover:text-emerald-300'
            }`}
            title='Fetch live prices for selected assets'
          >
            {refreshingSelected ? (
              <FiRefreshCw size={15} className='animate-spin' />
            ) : (
              <FiZap size={15} />
            )}
            <span className='hidden sm:block'>
              {refreshingSelected ? 'Fetching…' : 'Refresh Prices'}
            </span>
          </button>
          <div className='w-px h-6 bg-slate-700 mx-1' />

          <button
            onClick={() => setBulkEditOpen(true)}
            className='flex items-center gap-2 text-sm font-bold text-slate-200 hover:text-emerald-400 transition-colors'
          >
            <FiFolder size={16} />
            <span className='hidden sm:block'>Edit Category</span>
          </button>
          <button
            onClick={() => setBulkDeleteOpen(true)}
            className='flex items-center gap-2 text-sm font-bold text-rose-400 hover:text-rose-300 transition-colors'
          >
            <FiTrash2 size={16} />
            <span className='hidden sm:block'>Delete</span>
          </button>
          <div className='w-px h-6 bg-slate-700 mx-1' />
          <button
            onClick={() => setSelectedIds([])}
            className='p-1 text-slate-400 hover:text-white transition-colors'
          >
            <FiX size={18} />
          </button>
        </div>
      )}

      {/* ── Modals ── */}

      {/* Dividend Details Modal */}
      {divDetailsTarget &&
        (() => {
          const inv = divDetailsTarget;
          const dData = dividendData[inv.id];
          const qty = inv.quantity || 0;
          const fullHistory = dData?.history || [];

          // 1. Extract Unique Financial Years from history
          const availableFYs = Array.from(
            new Set(fullHistory.map((h) => getFinancialYear(h.date))),
          )
            .sort()
            .reverse();

          // 2. Apply Filters
          const history = fullHistory.filter((h) => {
            const matchFY =
              divFilterFY === 'All' || getFinancialYear(h.date) === divFilterFY;
            const matchMonth =
              divFilterMonth === 'All' ||
              new Date(h.date).getMonth().toString() === divFilterMonth;
            return matchFY && matchMonth;
          });

          // 3. Calculate Filtered Total
          const filteredTotal = history.reduce((sum, h) => sum + h.total, 0);

          return (
            <Modal
              open={!!divDetailsTarget}
              onClose={() => {
                setDivDetailsTarget(null);
                setDivFilterFY('All');
                setDivFilterMonth('All');
              }}
              title={`Dividend History: ${inv.name}`}
            >
              <div className='space-y-4'>
                <div className='bg-slate-800 p-4 rounded-xl border border-slate-700 flex items-center justify-between'>
                  <div className='flex flex-col'>
                    <span className='text-[10px] text-slate-500 uppercase font-bold tracking-widest'>
                      Current Holdings
                    </span>
                    <span className='text-base font-bold text-slate-200 mt-1'>
                      {qty} Shares
                    </span>
                  </div>
                  <div className='flex flex-col text-right'>
                    <span className='text-[10px] text-slate-500 uppercase font-bold tracking-widest'>
                      {divFilterFY !== 'All' || divFilterMonth !== 'All'
                        ? 'Filtered Earned'
                        : 'Total Earned'}
                    </span>
                    <span className='text-base font-bold text-emerald-400 mt-1'>
                      ₹{filteredTotal.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className='text-sm text-slate-300 pt-2'>
                  <div className='flex items-center justify-between mb-3'>
                    <h4 className='font-bold text-slate-400 uppercase text-[10px] tracking-wider'>
                      Payout Timeline
                    </h4>

                    {/* Filters */}
                    <div className='flex items-center gap-2'>
                      <select
                        value={divFilterFY}
                        onChange={(e) => setDivFilterFY(e.target.value)}
                        className='bg-slate-900 border border-slate-700 text-[11px] font-medium rounded-lg px-2 py-1.5 text-slate-300 outline-none focus:border-emerald-500/50 transition-colors'
                      >
                        <option value='All'>All FYs</option>
                        {availableFYs.map((fy) => (
                          <option key={fy} value={fy}>
                            {fy}
                          </option>
                        ))}
                      </select>

                      <select
                        value={divFilterMonth}
                        onChange={(e) => setDivFilterMonth(e.target.value)}
                        className='bg-slate-900 border border-slate-700 text-[11px] font-medium rounded-lg px-2 py-1.5 text-slate-300 outline-none focus:border-emerald-500/50 transition-colors'
                      >
                        <option value='All'>All Months</option>
                        {MONTHS.map((m) => (
                          <option key={m.val} value={m.val}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {history.length > 0 ? (
                    <div className='space-y-2 max-h-64 overflow-y-auto custom-scrollbar pr-1'>
                      {history.map((h, i) => {
                        const formattedDate = new Date(
                          h.date,
                        ).toLocaleDateString('en-IN', {
                          year: 'numeric',
                          month: 'short',
                        });

                        return (
                          <div
                            key={i}
                            className='flex flex-col sm:flex-row sm:items-center justify-between bg-slate-900/50 p-3 rounded-lg border border-slate-700/50 gap-2 hover:bg-slate-800/40 transition-colors'
                          >
                            <div className='flex flex-col'>
                              <span className='font-semibold text-slate-200'>
                                {formattedDate}
                              </span>
                              <span className='text-[9px] font-bold text-slate-500 mt-0.5'>
                                {getFinancialYear(h.date)}
                              </span>
                            </div>
                            <div className='flex items-center flex-1 justify-between text-xs bg-slate-800/50 rounded px-2 py-1.5 sm:ml-4'>
                              <span className='text-slate-400'>Qty: {qty}</span>
                              <span className='text-slate-400'>
                                ₹{h.amount.toFixed(2)}/sh
                              </span>
                              <span className='font-bold text-emerald-400 ml-2'>
                                Total: ₹{h.total.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className='text-center text-slate-500 py-8 text-xs italic bg-slate-900/30 rounded-xl border border-dashed border-slate-800'>
                      No historical dividend data found for this filter.
                    </p>
                  )}
                </div>
              </div>
            </Modal>
          );
        })()}

      {edit && (
        <UpsertInvestmentModal
          open={!!edit}
          onClose={() => setEdit(null)}
          mode='edit'
          investment={edit}
        />
      )}

      {sellTarget && (
        <SellInvestmentModal
          open={!!sellTarget}
          onClose={() => setSellTarget(null)}
          investment={sellTarget}
        />
      )}

      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title='⚠ Confirm Deletion'
      >
        <div className='space-y-6'>
          <p className='text-sm text-slate-400'>
            Are you sure you want to permanently delete this asset? This cannot
            be undone.
          </p>
          <div className='flex justify-end gap-3 border-t border-slate-800 pt-5'>
            <button
              onClick={() => setDeleteId(null)}
              className='rounded-xl px-5 py-2.5 text-sm font-bold text-slate-400 hover:bg-slate-800 transition-colors'
            >
              Cancel
            </button>
            <button
              onClick={handleSingleDelete}
              className='rounded-xl bg-red-600/90 px-6 py-2.5 text-sm font-bold text-white hover:bg-red-600 transition-colors'
            >
              Yes, Delete
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        title='⚠ Bulk Delete Assets'
      >
        <div className='space-y-6'>
          <p className='text-sm text-slate-400'>
            You are about to delete{' '}
            <span className='text-white font-bold'>
              {selectedIds.length} assets
            </span>
            . This cannot be undone.
          </p>
          <div className='flex justify-end gap-3 border-t border-slate-800 pt-5'>
            <button
              onClick={() => setBulkDeleteOpen(false)}
              disabled={bulkLoading}
              className='rounded-xl px-5 py-2.5 text-sm font-bold text-slate-400 hover:bg-slate-800 transition-colors disabled:opacity-50'
            >
              Cancel
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={bulkLoading}
              className='flex items-center gap-2 rounded-xl bg-red-600/90 px-6 py-2.5 text-sm font-bold text-white hover:bg-red-600 transition-colors disabled:opacity-50'
            >
              {bulkLoading ? 'Deleting...' : 'Delete All'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={bulkEditOpen}
        onClose={() => setBulkEditOpen(false)}
        title='Bulk Edit Category'
      >
        <div className='space-y-5'>
          <p className='text-sm text-slate-400'>
            Move{' '}
            <span className='text-white font-bold'>
              {selectedIds.length} selected assets
            </span>{' '}
            to a new category.
          </p>
          <div>
            <label className='text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2 block ml-1'>
              New Category
            </label>
            <BulkCategoryDropdown
              value={selectedBulkCat}
              onChange={setSelectedBulkCat}
            />
          </div>
          <div className='flex justify-end gap-3 border-t border-slate-800 pt-5'>
            <button
              onClick={() => setBulkEditOpen(false)}
              disabled={bulkLoading}
              className='rounded-xl px-5 py-2.5 text-sm font-bold text-slate-400 hover:bg-slate-800 transition-colors disabled:opacity-50'
            >
              Cancel
            </button>
            <button
              onClick={handleBulkEditCategory}
              disabled={bulkLoading}
              className='flex items-center gap-2 rounded-xl bg-emerald-600/90 px-6 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 transition-colors disabled:opacity-50'
            >
              {bulkLoading ? 'Updating...' : 'Update Category'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
