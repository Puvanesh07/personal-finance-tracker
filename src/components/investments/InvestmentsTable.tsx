// src/components/investments/InvestmentsTable.tsx

import {
  FiBox,
  FiBriefcase,
  FiCheck,
  FiCheckSquare,
  FiChevronDown,
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
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// ── Custom Dropdown for Bulk Edit ──────────────────────────────────────────
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
        className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-semibold transition-all outline-none ${open ? 'border-emerald-500/50 bg-slate-800 shadow-[0_0_15px_rgba(16,185,129,0.15)] ring-2 ring-emerald-500/20 text-slate-100' : 'border-slate-700/80 bg-slate-900/80 hover:border-slate-600 hover:bg-slate-800/80 text-slate-200'}`}
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
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium transition-colors ${isSelected ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'}`}
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

// ── Inline Classification Editor Popover ──────────────────────────────────
function ClassificationPopover({
  inv,
  currentCap,
  onClose,
  onSave,
}: {
  inv: any;
  currentCap?: string;
  onClose: () => void;
  onSave: (id: string, sector: string, cap: string) => void;
}) {
  const [sector, setSector] = useState(inv.sector || '');
  const [cap, setCap] = useState(currentCap || '');
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', onMouse);
    return () => document.removeEventListener('mousedown', onMouse);
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      className='absolute z-50 top-full mt-2 left-0 w-[240px] p-3 rounded-xl border border-slate-700 bg-slate-800 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-2 cursor-default'
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
            onClick={onClose}
            className='px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-white transition-colors'
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(inv.id, sector, cap)}
            className='px-3 py-1.5 rounded-lg bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-500 transition-colors'
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Asset Chip Components ───────────────────────────────────────────────────

function TypeChip({ type, assetType }: { type: string; assetType?: string }) {
  let label = type.replace('_', ' ');
  let color = 'border-slate-500/30 bg-slate-500/10 text-slate-300';
  let Icon = FiBox;

  if (type === 'stock') {
    label = 'Equity';
    color = 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400';
    Icon = FiTrendingUp;
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
  } else if (type === 'other') {
    if (assetType) {
      label = assetType.replace('_', ' ');
      if (assetType === 'international_equity') {
        Icon = FiGlobe;
        color = 'border-blue-500/30 bg-blue-500/10 text-blue-400';
      } else if (assetType === 'gold') {
        color = 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400';
      } else if (assetType === 'silver') {
        color = 'border-slate-500/30 bg-slate-500/10 text-slate-300';
      } else if (assetType === 'real_estate') {
        Icon = FiHome;
        color = 'border-orange-500/30 bg-orange-500/10 text-orange-400';
      } else if (assetType === 'crypto') {
        Icon = FiMonitor;
        color = 'border-rose-500/30 bg-rose-500/10 text-rose-400';
      }
    } else {
      label = 'Other';
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

// ── Live Price Flash Cell ──────────────────────────────────────────────────
function PriceCell({
  inv,
  flashState,
}: {
  inv: any;
  flashState: 'up' | 'down' | 'none';
}) {
  let price: number | null = null;
  let label = '';

  if (inv.type === 'stock') {
    price = inv.currentPrice ?? null;
    label = '';
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

  if (price === null || price === undefined) {
    return <span className='text-slate-600 text-xs font-medium'>—</span>;
  }

  const flashClass =
    flashState === 'up'
      ? 'animate-pulse text-emerald-300 bg-emerald-500/20 rounded px-1'
      : flashState === 'down'
        ? 'animate-pulse text-rose-300 bg-rose-500/20 rounded px-1'
        : '';

  const at = (inv.assetType || '').toLowerCase();
  const isUS = inv.type === 'other' && at === 'international_equity';

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

// ── Helper: build the symbol string for each investment type ───────────────
function getLivePriceSymbol(inv: any): string | null {
  const type = inv.type;
  const assetType = (inv.assetType || '').toLowerCase();

  if (type === 'stock') {
    return inv.symbol ? inv.symbol.toUpperCase() : null;
  }

  if (type === 'mutual_fund') {
    if (inv.schemeCode && /^\d{5,6}$/.test(String(inv.schemeCode).trim())) {
      return `MF:${inv.schemeCode}`;
    }
    if (inv.amfiCode && /^\d{5,6}$/.test(String(inv.amfiCode).trim())) {
      return `MF:${inv.amfiCode}`;
    }
    if (inv.symbol && /^\d{5,6}$/.test(String(inv.symbol).trim())) {
      return `MF:${inv.symbol}`;
    }
    const name = inv.name || inv.symbol;
    return name ? `MF_NAME:${name}` : null;
  }

  if (type === 'other') {
    if (assetType === 'gold') return 'GOLD';
    if (assetType === 'silver') return 'SILVER';
    if (assetType === 'international_equity') {
      return inv.symbol ? `US:${inv.symbol.toUpperCase()}` : null;
    }
  }

  return null;
}

// ── Valid cap category values ──────────────────────────────────────────────
const KNOWN_CAPS = [
  'Large Cap',
  'Mid Cap',
  'Small Cap',
  'Micro Cap',
  'Large & Mid Cap',
];

export function InvestmentsTable({ investments }: { investments: any[] }) {
  const deleteInvestment = usePortfolioStore((s) => s.deleteInvestment);
  const updateInvestment = usePortfolioStore((s) => s.updateInvestment);

  // ── Live Price State ───────────────────────────────────────────────────
  const [refreshing, setRefreshing] = useState(false);
  const [fetchProgress, setFetchProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [flashMap, setFlashMap] = useState<
    Record<string, 'up' | 'down' | 'none'>
  >({});

  const handleRefreshLivePrices = async () => {
    const liveAssets = investments
      .map((inv) => ({ inv, sym: getLivePriceSymbol(inv) }))
      .filter(({ sym }) => sym !== null) as { inv: any; sym: string }[];

    if (liveAssets.length === 0) {
      setRefreshError(
        'No assets with live price support found. Add NSE symbol / MF scheme code / US ticker to your assets.',
      );
      setTimeout(() => setRefreshError(null), 5000);
      return;
    }

    setRefreshing(true);
    setRefreshError(null);

    try {
      const mfNameAssets = liveAssets.filter(({ sym }) =>
        sym.startsWith('MF_NAME:'),
      );

      if (mfNameAssets.length > 0) {
        const names = mfNameAssets.map(({ sym }) =>
          sym.slice('MF_NAME:'.length),
        );
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
        setRefreshError(
          'Could not resolve any MF scheme codes. Check fund names or add scheme codes manually.',
        );
        setTimeout(() => setRefreshError(null), 6000);
        return;
      }

      const symbols = [...new Set(fetchableAssets.map((a) => a.sym))];
      setFetchProgress({ done: 0, total: symbols.length });
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
          oldPrice = inv.currentPrice ?? 0;
          patch = { currentPrice: newPrice };
        } else if (type === 'mutual_fund') {
          oldPrice = inv.nav ?? 0;
          patch = { nav: newPrice };
        } else if (type === 'other') {
          if (
            assetType === 'gold' ||
            assetType === 'silver' ||
            assetType === 'international_equity'
          ) {
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

      setFlashMap(newFlash);
      setFetchProgress(null);
      setLastUpdated(
        new Date().toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      );

      setTimeout(() => setFlashMap({}), 2000);

      const updatedCount = Object.keys(newFlash).length;
      const failedSymbols = symbols.filter(
        (s) =>
          !result.prices[s.toUpperCase()] ||
          result.prices[s.toUpperCase()].price === null,
      );

      if (failedSymbols.length > 0 && updatedCount === 0) {
        setRefreshError(`Could not fetch: ${failedSymbols.join(', ')}`);
        setTimeout(() => setRefreshError(null), 5000);
      }
    } catch (e: any) {
      setRefreshError('Failed to fetch live prices. Please try again.');
      setTimeout(() => setRefreshError(null), 4000);
    } finally {
      setFetchProgress(null);
      setRefreshing(false);
    }
  };

  // ── Cap classification: load from store first, then fetch from API ─────
  const [extendedData, setExtendedData] = useState<
    Record<string, { cap?: string }>
  >({});

  // Tracks symbols already dispatched this session to avoid duplicate API calls
  const fetchedSymbols = useRef<Set<string>>(new Set());

  useEffect(() => {
    investments.forEach(async (inv) => {
      if (inv.type !== 'stock' || !inv.symbol) return;

      // ── Priority 1: investment already has a valid cap stored in the DB ──
      const storedCap = inv.marketCap as string | undefined;
      if (storedCap && KNOWN_CAPS.includes(storedCap)) {
        setExtendedData((prev) => {
          if (prev[inv.id]?.cap === storedCap) return prev; // no-op if already set
          return { ...prev, [inv.id]: { cap: storedCap } };
        });
        return; // nothing more to do — skip API call
      }

      // ── Priority 2: already fetched this symbol this session ──────────
      const symbolKey = inv.symbol.toUpperCase();
      if (fetchedSymbols.current.has(symbolKey)) return;
      fetchedSymbols.current.add(symbolKey);

      // ── Priority 3: fetch from Worker → NSE API ───────────────────────
      try {
        const meta = await fetchStockMetadata({ symbol: inv.symbol });
        const cap = meta?.marketCapCategory;
        if (cap && cap !== 'Unknown') {
          // Show in UI immediately
          setExtendedData((prev) => ({ ...prev, [inv.id]: { cap } }));
          // Persist to store so next page load skips the API call entirely
          updateInvestment(inv.id, { marketCap: cap } as any).catch(() => {});
        }
      } catch {
        /* silent — chip just won't show */
      }
    });
  }, [investments, updateInvestment]);

  const [edit, setEdit] = useState<any | null>(null);
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
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

        // Resolve cap: stored value on inv takes priority, then extendedData from API
        const storedCap = inv.marketCap as string | undefined;
        const resolvedCap =
          storedCap && KNOWN_CAPS.includes(storedCap)
            ? storedCap
            : extendedData[inv.id]?.cap;

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
          marketCap: resolvedCap,
          qty,
        };
      }),
    [investments, extendedData],
  );

  const isAllSelected = rows.length > 0 && selectedIds.length === rows.length;

  const toggleSelectAll = () => {
    if (isAllSelected) setSelectedIds([]);
    else setSelectedIds(rows.map((r) => r.inv.id));
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
        patch.buyPrice =
          existing.buyPrice || existing.nav || existing.investedAmount || 0;
        patch.currentPrice =
          existing.currentPrice || existing.nav || existing.currentValue || 0;
      } else if (cat.type === 'mutual_fund') {
        patch.units = existing.units || existing.quantity || 1;
        patch.nav = existing.nav || existing.buyPrice || 0;
        patch.investedAmount =
          existing.investedAmount || existing.quantity * existing.buyPrice || 0;
      } else if (cat.type === 'bond' || cat.type === 'fixed_deposit') {
        patch.investedAmount =
          existing.investedAmount || existing.quantity * existing.buyPrice || 0;
        patch.interestRate = existing.interestRate || 0;
        patch.durationMonths = existing.durationMonths || 12;
        patch.startDate = existing.startDate || todayISO();
        patch.maturityDate = existing.maturityDate || todayISO();
      } else if (cat.type === 'other') {
        patch.investedAmount =
          existing.investedAmount || existing.quantity * existing.buyPrice || 0;
        patch.currentValue =
          existing.currentValue ||
          existing.quantity * existing.currentPrice ||
          0;
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
    // Also update local extendedData so chip refreshes immediately without reload
    if (cap) {
      setExtendedData((prev) => ({ ...prev, [id]: { cap } }));
    }
    setInlineEditId(null);
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
      {/* ── Header ── */}
      <div className='flex items-center justify-between mb-2 px-1 flex-wrap gap-3'>
        <div className='flex items-center gap-2'>
          <FiList className='h-4 w-4 text-emerald-500' />
          <h2 className='text-xs font-bold uppercase tracking-widest text-slate-400'>
            Showing <span className='text-white'>{rows.length}</span> Asset
            {rows.length !== 1 ? 's' : ''}
          </h2>
        </div>

        <div className='flex items-center gap-3 flex-wrap'>
          {lastUpdated && !refreshError && (
            <span className='text-[10px] font-semibold text-slate-500 hidden sm:block'>
              Updated {lastUpdated}
            </span>
          )}
          {refreshError && (
            <span className='text-[10px] font-semibold text-rose-400 max-w-[220px] text-right leading-tight'>
              {refreshError}
            </span>
          )}
          <button
            onClick={handleRefreshLivePrices}
            disabled={refreshing}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all border shadow-lg
              ${
                refreshing
                  ? 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-400/60 hover:shadow-emerald-500/20 active:scale-95'
              }`}
            title='Fetch latest prices for Stocks, MF NAV, Gold, Silver, US Stocks'
          >
            {refreshing ? (
              <FiRefreshCw size={13} className='animate-spin' />
            ) : (
              <FiZap size={13} />
            )}
            <span>
              {refreshing && fetchProgress
                ? `Fetching ${fetchProgress.done}/${fetchProgress.total}…`
                : refreshing
                  ? 'Preparing…'
                  : 'Refresh Live Price'}
            </span>
          </button>

          {refreshing && fetchProgress && fetchProgress.total > 20 && (
            <div className='w-full mt-1.5'>
              <div className='h-1 w-full bg-slate-800 rounded-full overflow-hidden'>
                <div
                  className='h-1 bg-emerald-500 rounded-full transition-all duration-300'
                  style={{
                    width: `${Math.round((fetchProgress.done / fetchProgress.total) * 100)}%`,
                  }}
                />
              </div>
              <p className='text-[9px] text-slate-500 font-semibold mt-0.5 text-right'>
                {Math.round((fetchProgress.done / fetchProgress.total) * 100)}%
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Legend ── */}
      <div className='flex flex-wrap gap-2 px-1 mb-1'>
        {[
          {
            label: 'NSE Stocks',
            color: 'text-emerald-400',
            dot: 'bg-emerald-500',
          },
          {
            label: 'Mutual Funds',
            color: 'text-indigo-400',
            dot: 'bg-indigo-500',
          },
          {
            label: 'Gold/Silver',
            color: 'text-yellow-400',
            dot: 'bg-yellow-500',
          },
          { label: 'US Stocks', color: 'text-blue-400', dot: 'bg-blue-500' },
        ].map((item) => (
          <span
            key={item.label}
            className={`flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider ${item.color}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${item.dot}`} />
            {item.label}
          </span>
        ))}
        <span className='text-[9px] text-slate-600 font-medium'>
          auto-updated on refresh
        </span>
      </div>

      {/* MOBILE VIEW */}
      <div className='flex flex-col gap-3 md:hidden'>
        <div className='flex items-center gap-3 px-2 py-1'>
          <button
            onClick={toggleSelectAll}
            className='flex items-center gap-2 text-sm text-slate-400 font-semibold hover:text-emerald-400'
          >
            {isAllSelected ? (
              <FiCheckSquare size={18} className='text-emerald-500' />
            ) : (
              <FiSquare size={18} />
            )}
            Select All
          </button>
        </div>

        {rows.map(({ inv, current, pl, plPct, marketCap, qty }) => {
          const isSelected = selectedIds.includes(inv.id);
          return (
            <div
              key={inv.id}
              className={`border p-4 rounded-2xl flex flex-col gap-4 transition-colors ${isSelected ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-slate-900/50 border-slate-800'}`}
            >
              <div className='flex justify-between items-start gap-3'>
                <div className='flex items-start gap-3 min-w-0 flex-1'>
                  <button
                    onClick={() => toggleRow(inv.id)}
                    className='mt-0.5 text-slate-400 hover:text-emerald-400 transition-colors shrink-0'
                  >
                    {isSelected ? (
                      <FiCheckSquare size={18} className='text-emerald-500' />
                    ) : (
                      <FiSquare size={18} />
                    )}
                  </button>
                  <div className='flex flex-col gap-1.5 relative min-w-0 flex-1'>
                    <div className='min-w-0'>
                      <h3
                        className='font-bold text-slate-50 truncate text-sm'
                        title={inv.name}
                      >
                        {inv.name}
                      </h3>
                      <div className='flex items-center flex-wrap gap-2 mt-1'>
                        <TypeChip
                          type={inv.type}
                          assetType={(inv as any).assetType}
                        />
                        <span className='text-[10px] text-slate-500 font-bold uppercase tracking-wide whitespace-nowrap'>
                          {formatPlatformName(inv.platform)}
                          {qty !== null && qty !== undefined
                            ? ` • QTY: ${Number(qty).toLocaleString('en-IN', { maximumFractionDigits: 4 })}`
                            : ''}
                        </span>
                      </div>
                    </div>
                    {inv.type === 'stock' && (
                      <div
                        className='flex flex-wrap items-center gap-1.5 mt-1 cursor-pointer group'
                        onClick={() =>
                          setInlineEditId(
                            inlineEditId === inv.id ? null : inv.id,
                          )
                        }
                      >
                        <SectorChip sector={inv.sector} />
                        <MarketCapChip cap={marketCap} />
                        {!inv.sector && !marketCap && (
                          <span className='inline-flex items-center gap-1 rounded-md border border-dashed border-slate-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500 group-hover:border-emerald-500/50 group-hover:text-emerald-400 transition-colors'>
                            <FiTag size={10} /> Add Tags
                          </span>
                        )}
                      </div>
                    )}
                    {inlineEditId === inv.id && (
                      <ClassificationPopover
                        inv={inv}
                        currentCap={marketCap}
                        onClose={() => setInlineEditId(null)}
                        onSave={handleSaveClassification}
                      />
                    )}
                  </div>
                </div>
                <div className='flex gap-1.5 shrink-0'>
                  <button
                    onClick={() => setEdit(inv)}
                    className='p-2 text-slate-400 bg-slate-800 rounded-lg transition-colors hover:text-white'
                  >
                    <FiEdit2 size={14} />
                  </button>
                  <button
                    onClick={() => setDeleteId(inv.id)}
                    className='p-2 text-rose-400 bg-rose-500/10 rounded-lg transition-colors hover:bg-rose-500/20'
                  >
                    <FiTrash2 size={14} />
                  </button>
                </div>
              </div>

              <div
                className={`grid grid-cols-2 gap-2 pt-3 border-t ${isSelected ? 'border-emerald-500/20' : 'border-slate-800/50'}`}
              >
                <div>
                  <p className='text-[10px] text-slate-500 font-bold uppercase tracking-wider'>
                    Current Value
                  </p>
                  <p className='text-base font-bold text-white mt-0.5'>
                    {formatINR(current)}
                  </p>
                  <PriceCell
                    inv={inv}
                    flashState={flashMap[inv.id] ?? 'none'}
                  />
                </div>
                <div className='text-right'>
                  <p className='text-[10px] text-slate-500 font-bold uppercase tracking-wider'>
                    Returns
                  </p>
                  <p
                    className={`text-base font-bold mt-0.5 ${pl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                  >
                    {pl >= 0 ? '+' : ''}
                    {plPct.toFixed(2)}%
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* DESKTOP VIEW */}
      <div className='hidden md:block overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40 shadow-xl'>
        <div className='overflow-x-auto pb-2'>
          <table className='w-full text-left text-sm'>
            <thead className='bg-slate-800/80 text-[10px] font-bold uppercase text-slate-400 tracking-widest border-b border-slate-700/50'>
              <tr>
                <th className='px-4 py-4 w-12 text-center'>
                  <button
                    onClick={toggleSelectAll}
                    className='text-slate-400 hover:text-emerald-400 transition-colors pt-1'
                  >
                    {isAllSelected ? (
                      <FiCheckSquare size={16} className='text-emerald-500' />
                    ) : (
                      <FiSquare size={16} />
                    )}
                  </button>
                </th>
                <th className='px-4 py-4 w-64'>Asset Name</th>
                <th className='px-4 py-4 whitespace-nowrap'>Broker</th>
                <th className='px-4 py-4'>Classification</th>
                <th className='px-4 py-4 text-right'>Qty</th>
                <th className='px-6 py-4 text-right'>Invested</th>
                <th className='px-6 py-4 text-right'>Current Val</th>
                <th className='px-6 py-4 text-right'>Live Price</th>
                <th className='px-6 py-4 text-right'>P/L (%)</th>
                <th className='px-4 py-4 text-center'>Actions</th>
              </tr>
            </thead>
            <tbody className='divide-y divide-slate-800/60'>
              {rows.map(
                ({ inv, invested, current, pl, plPct, marketCap, qty }) => {
                  const isSelected = selectedIds.includes(inv.id);
                  return (
                    <tr
                      key={inv.id}
                      className={`transition-colors group ${isSelected ? 'bg-emerald-500/10' : 'hover:bg-slate-800/40'}`}
                    >
                      <td className='px-4 py-4 text-center'>
                        <button
                          onClick={() => toggleRow(inv.id)}
                          className='text-slate-400 hover:text-emerald-400 transition-colors pt-1'
                        >
                          {isSelected ? (
                            <FiCheckSquare
                              size={16}
                              className='text-emerald-500'
                            />
                          ) : (
                            <FiSquare size={16} />
                          )}
                        </button>
                      </td>
                      <td className='px-4 py-4'>
                        <div className='flex flex-col gap-1.5'>
                          <div
                            className='font-bold text-slate-100 truncate max-w-[220px]'
                            title={inv.name}
                          >
                            {inv.name}
                          </div>
                          <div className='flex items-center gap-2'>
                            <TypeChip
                              type={inv.type}
                              assetType={(inv as any).assetType}
                            />
                            {inv.symbol && (
                              <span className='text-[10px] font-bold text-slate-500'>
                                {inv.symbol}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className='px-4 py-4'>
                        <span className='inline-flex items-center rounded-md bg-slate-800 px-2 py-1 text-[10px] font-bold text-slate-300 uppercase tracking-widest border border-slate-700/50 whitespace-nowrap'>
                          {formatPlatformName(inv.platform)}
                        </span>
                      </td>
                      <td className='px-4 py-4 relative group/class'>
                        {inv.type === 'stock' ? (
                          <div
                            className='flex flex-wrap gap-1.5 cursor-pointer min-h-[24px] items-center'
                            onClick={() =>
                              setInlineEditId(
                                inlineEditId === inv.id ? null : inv.id,
                              )
                            }
                          >
                            <SectorChip sector={inv.sector} />
                            <MarketCapChip cap={marketCap} />
                            {!inv.sector && !marketCap && (
                              <span className='inline-flex items-center gap-1 rounded-md border border-dashed border-slate-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500 group-hover/class:border-emerald-500/50 group-hover/class:text-emerald-400 transition-colors'>
                                <FiTag size={10} /> Add
                              </span>
                            )}
                            {(inv.sector || marketCap) && (
                              <FiEdit2
                                size={12}
                                className='text-slate-500 opacity-0 group-hover/class:opacity-100 transition-opacity ml-1'
                              />
                            )}
                          </div>
                        ) : (
                          <span className='text-xs text-slate-600 font-medium'>
                            —
                          </span>
                        )}
                        {inlineEditId === inv.id && (
                          <ClassificationPopover
                            inv={inv}
                            currentCap={marketCap}
                            onClose={() => setInlineEditId(null)}
                            onSave={handleSaveClassification}
                          />
                        )}
                      </td>
                      <td className='px-4 py-4 text-right text-slate-300 font-medium tabular-nums'>
                        {qty !== null && qty !== undefined
                          ? Number(qty).toLocaleString('en-IN', {
                              maximumFractionDigits: 4,
                            })
                          : '—'}
                      </td>
                      <td className='px-6 py-4 text-right text-slate-300 font-medium tabular-nums'>
                        {formatINR(invested)}
                      </td>
                      <td className='px-6 py-4 text-right font-bold text-white tabular-nums'>
                        {formatINR(current)}
                      </td>
                      <td className='px-6 py-4 text-right tabular-nums'>
                        <PriceCell
                          inv={inv}
                          flashState={flashMap[inv.id] ?? 'none'}
                        />
                      </td>
                      <td
                        className={`px-6 py-4 text-right tabular-nums ${pl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                      >
                        <div className='font-bold'>
                          {pl >= 0 ? '+' : ''}
                          {formatINR(pl)}
                        </div>
                        <div className='text-[10px] font-semibold opacity-80 mt-0.5'>
                          {pl >= 0 ? '+' : ''}
                          {plPct.toFixed(2)}%
                        </div>
                      </td>
                      <td className='px-4 py-4'>
                        <div className='flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity'>
                          <button
                            onClick={() => setEdit(inv)}
                            className='p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors'
                          >
                            <FiEdit2 size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteId(inv.id)}
                            className='p-2 hover:bg-rose-500/20 rounded-lg text-slate-400 hover:text-rose-400 transition-colors'
                          >
                            <FiTrash2 size={14} />
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

      {/* FLOATING BULK ACTION BAR */}
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
            onClick={() => setBulkEditOpen(true)}
            className='flex items-center gap-2 text-sm font-bold text-slate-200 hover:text-emerald-400 transition-colors'
          >
            <FiFolder size={16} />{' '}
            <span className='hidden sm:block'>Edit Category</span>
          </button>
          <button
            onClick={() => setBulkDeleteOpen(true)}
            className='flex items-center gap-2 text-sm font-bold text-rose-400 hover:text-rose-300 transition-colors'
          >
            <FiTrash2 size={16} />{' '}
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

      {/* MODALS */}
      {edit && (
        <UpsertInvestmentModal
          open={!!edit}
          onClose={() => setEdit(null)}
          mode='edit'
          investment={edit}
        />
      )}

      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title='⚠ Confirm Deletion'
      >
        <div className='space-y-6'>
          <p className='text-sm text-slate-400'>
            Are you sure you want to permanently delete this asset? This action
            cannot be undone.
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
            . This action cannot be undone.
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
