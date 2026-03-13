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
import { currentValue, investedValue } from '../../utils/calculations';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Modal } from '../ui/Modal';
import { SellInvestmentModal } from './SellInvestmentModal';
import { UpsertInvestmentModal } from './UpsertInvestmentModal';
import { createPortal } from 'react-dom';
import { fetchLivePrices } from '../../services/livePriceService';
import { fetchStockMetadata } from '../../services/stockMetadataService';
import { formatINR } from '../../utils/format';
import { resolveAmfiCodes } from '../../services/amfiLookupService';
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

    // Prevent the modal from opening off the right edge of the screen
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

// ── Chip Components ────────────────────────────────────────────────────────

function TypeChip({ inv }: { inv: any }) {
  const type = inv.type;
  const assetType = inv.assetType;
  let label = type.replace('_', ' ');
  let color = 'border-slate-500/30 bg-slate-500/10 text-slate-300';
  let Icon = FiBox;

  if (type === 'stock') {
    // Detect US Stock based on the presence of usdPrice
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
    // Show USD Price for US Stocks
    if (inv.usdPrice) {
      price = inv.usdPrice;
      label = 'USD';
    } else if (inv.usdToInr && inv.currentPrice) {
      price = inv.currentPrice / inv.usdToInr; // fallback
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
    if (!inv.symbol) return null; // Protect against missing symbol preventing Live button
    const isUS = !!inv.usdPrice || !!inv.buyPriceUsd || !!inv.usdToInr;
    // Optimize: Pre-tag US stocks so Cloudflare Worker fetches immediately
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
  /* desc — show ↓ in amber to hint "click again to clear" */
  return <FiArrowDown size={11} className='text-amber-400' />;
}

// ── Main Component ─────────────────────────────────────────────────────────
export function InvestmentsTable({ investments }: { investments: any[] }) {
  const deleteInvestment = usePortfolioStore((s) => s.deleteInvestment);
  const updateInvestment = usePortfolioStore((s) => s.updateInvestment);

  // ── Live Price State ───────────────────────────────────────────────────
  // Global refresh state
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

  // ✅ Per-row refresh state: rowId → boolean
  const [rowRefreshingMap, setRowRefreshingMap] = useState<
    Record<string, boolean>
  >({});

  // ── Core refresh logic (shared by both global and per-row) ─────────────
  const refreshPricesForAssets = async (
    targetInvestments: any[],
    onDone?: (updatedCount: number) => void,
  ) => {
    const liveAssets = targetInvestments
      .map((inv) => ({ inv, sym: getLivePriceSymbol(inv) }))
      .filter(({ sym }) => sym !== null) as { inv: any; sym: string }[];

    if (liveAssets.length === 0) return;

    // Resolve MF name codes
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
    if (fetchableAssets.length === 0) return;

    const symbols = [...new Set(fetchableAssets.map((a) => a.sym))];
    const result = await fetchLivePrices(symbols, (done, total) => {
      setFetchProgress({ done, total });
    });

    const newFlash: Record<string, 'up' | 'down' | 'none'> = {};
    const updates: Promise<void>[] = [];

    for (const { inv, sym } of fetchableAssets) {
      const fetched = result.prices[sym.toUpperCase()];
      if (!fetched || fetched.price === null) continue;

      const newPrice = fetched.price;
      const type = inv.type;
      const assetType = (inv.assetType || '').toLowerCase();
      let oldPrice = 0;
      let patch: Record<string, any> = {};

      if (type === 'stock') {
        const isUS =
          !!inv.usdPrice || !!inv.buyPriceUsd || fetched.type === 'us_stock';

        if (isUS) {
          const rate = inv.usdToInr || 84; // Ensure fallback rate is provided
          oldPrice = inv.usdPrice || 0;
          patch = {
            usdPrice: newPrice, // Store raw USD price
            currentPrice: newPrice * rate, // Auto-convert live price to INR for P&L calculation
          };
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

    onDone?.(Object.keys(newFlash).length);
  };

  // ── Refresh ALL visible rows ───────────────────────────────────────────
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
          setRefreshError('No price updates available for current assets.');
          setTimeout(() => setRefreshError(null), 4000);
        }
      });
    } catch (e: any) {
      setRefreshError('Failed to fetch live prices. Please try again.');
      setTimeout(() => setRefreshError(null), 4000);
    } finally {
      setFetchProgress(null);
      setRefreshingAll(false);
    }
  };

  // ── ✅ Refresh SINGLE row ──────────────────────────────────────────────
  const handleRefreshRow = async (inv: any) => {
    const sym = getLivePriceSymbol(inv);
    if (!sym) return;

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
    } finally {
      setRowRefreshingMap((prev) => ({ ...prev, [inv.id]: false }));
    }
  };

  // ── ✅ Refresh SELECTED rows (checkbox-picked) ────────────────────────
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

  // ── Extended data (market cap from metadata) ───────────────────────────
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
        };
      }),
    [investments, extendedData],
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
    | 'pl'
    | 'plPct';
  const [sortCol, setSortCol] = useState<SortCol | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSort = (col: SortCol) => {
    if (sortCol !== col) {
      setSortCol(col);
      setSortDir('asc');
    } // 1st click: asc
    else if (sortDir === 'asc')
      setSortDir('desc'); // 2nd click: desc
    else {
      setSortCol(null);
      setSortDir('asc');
    } // 3rd click: clear
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
          av = a.inv.currentPrice ?? a.inv.nav ?? 0;
          bv = b.inv.currentPrice ?? b.inv.nav ?? 0;
          break;
        case 'pl':
          av = a.pl;
          bv = b.pl;
          break;
        case 'plPct':
          av = a.plPct;
          bv = b.plPct;
          break;
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [rows, sortCol, sortDir]);

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

        {/* Right: last updated + Refresh All button */}
        <div className='flex items-center gap-2 shrink-0'>
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
          ({ inv, invested, current, pl, plPct, marketCap, qty }) => {
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
                          {hasLiveSymbol && (
                            <RowRefreshButton
                              onClick={() => handleRefreshRow(inv)}
                              refreshing={isRowRefreshing}
                            />
                          )}
                          <button
                            onClick={() => setSellTarget(inv)}
                            title='Record sale & track profit'
                            className='flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-all'
                          >
                            <FiDollarSign size={12} />
                          </button>
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

                      {/* Sector + Cap tags */}
                      {inv.type === 'stock' && (
                        <div className='mt-2'>
                          <SectorCapCell
                            inv={inv}
                            marketCap={marketCap}
                            onSave={handleSaveClassification}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Row 2: Stats grid ── */}
                  <div
                    className={`mt-3 pt-3 border-t grid grid-cols-3 gap-0 ${isSelected ? 'border-emerald-500/20' : 'border-slate-800/60'}`}
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
                      {hasLiveSymbol && (
                        <PriceCell
                          inv={inv}
                          flashState={flashMap[inv.id] ?? 'none'}
                          isRefreshing={isRowRefreshing}
                        />
                      )}
                    </div>

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

                {/* Asset — sortable left */}
                <th className='sticky top-0 z-10 bg-slate-900 pl-2 pr-4 py-2.5 border-b border-slate-700/60'>
                  <button
                    onClick={() => handleSort('name')}
                    className='flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500 hover:text-slate-200 transition-colors group/th'
                  >
                    Asset
                    <SortIcon col='name' sortCol={sortCol} sortDir={sortDir} />
                  </button>
                </th>

                {/* Broker — sortable left */}
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

                {/* Sector · Cap — sortable left */}
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

                {/* Qty — sortable right */}
                <th className='sticky top-0 z-10 bg-slate-900 px-4 py-2.5 border-b border-slate-700/60'>
                  <button
                    onClick={() => handleSort('qty')}
                    className='flex items-center justify-end gap-1 w-full text-[10px] font-semibold uppercase tracking-widest text-slate-500 hover:text-slate-200 transition-colors group/th'
                  >
                    <SortIcon col='qty' sortCol={sortCol} sortDir={sortDir} />
                    Qty
                  </button>
                </th>

                {/* Invested — sortable right */}
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

                {/* Curr. Value — sortable right */}
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

                {/* Live Price — sortable right */}
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

                {/* Refresh — not sortable */}
                <th className='sticky top-0 z-10 bg-slate-900 px-2 py-2.5 w-10 text-center text-[10px] font-semibold text-slate-600 border-b border-slate-700/60'>
                  ⚡
                </th>

                {/* P&L — two sort options: abs value or % */}
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
                  { inv, invested, current, pl, plPct, marketCap, qty },
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
                        <SectorCapCell
                          inv={inv}
                          marketCap={marketCap}
                          onSave={handleSaveClassification}
                        />
                      </td>

                      {/* ── Qty ── */}
                      <td
                        className={`px-4 py-3.5 text-right tabular-nums ${bdClass}`}
                      >
                        <span className='text-[13px] font-medium text-slate-300'>
                          {qty !== null && qty !== undefined ? (
                            Number(qty).toLocaleString('en-IN', {
                              maximumFractionDigits: 4,
                            })
                          ) : (
                            <span className='text-slate-600'>—</span>
                          )}
                        </span>
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

                      {/* ── Live Price ── */}
                      <td
                        className={`px-4 py-3.5 text-right tabular-nums ${bdClass}`}
                      >
                        <PriceCell
                          inv={inv}
                          flashState={flashMap[inv.id] ?? 'none'}
                          isRefreshing={isRowRefreshing}
                        />
                      </td>

                      {/* ── Refresh button (separate col) ── */}
                      <td className={`px-2 py-3.5 text-center ${bdClass}`}>
                        {hasLiveSymbol ? (
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
                          <button
                            onClick={() => setSellTarget(inv)}
                            title='Record sale & track profit'
                            className='flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-all'
                          >
                            <FiDollarSign size={12} />
                          </button>
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

          {/* ✅ Bulk Live Price Refresh for selected rows */}
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
