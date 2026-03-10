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
  FiSearch,
  FiShield,
  FiSquare,
  FiTrash2,
  FiTrendingUp,
  FiX,
} from 'react-icons/fi';
import { currentValue, investedValue } from '../../utils/calculations';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Modal } from '../ui/Modal';
import { UpsertInvestmentModal } from './UpsertInvestmentModal';
import { createPortal } from 'react-dom';
import { fetchStockMetadata } from '../../services/stockMetadataService';
import { formatINR } from '../../utils/format';
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
  { id: 'real_estate', label: 'Real Estate', type: 'other', icon: FiHome },
  { id: 'crypto', label: 'Crypto', type: 'other', icon: FiMonitor },
  { id: 'other', label: 'Other Asset', type: 'other', icon: FiBox },
];

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

// ── Asset Chip Components ───────────────────────────────────────────────────
function SectorChip({ sector }: { sector?: string }) {
  if (!sector) return null;
  return (
    <span className='inline-flex items-center rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-indigo-300 shadow-sm'>
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

// ───────────────────────────────────────────────────────────────────────────

export function InvestmentsTable({ investments }: { investments: any[] }) {
  const deleteInvestment = usePortfolioStore((s) => s.deleteInvestment);
  const updateInvestment = usePortfolioStore((s) => s.updateInvestment);

  // Advanced metadata fetching (to get Market Cap automatically for stocks if needed)
  const [extendedData, setExtendedData] = useState<
    Record<string, { cap?: string }>
  >({});

  useEffect(() => {
    // Attempt to fetch missing market cap data for stocks asynchronously
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
          // Ignore errors, we just won't show the chip
        }
      }
    });
  }, [investments]);

  // Row Management
  const [edit, setEdit] = useState<any | null>(null);

  // Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Bulk Modals
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [selectedBulkCat, setSelectedBulkCat] = useState(BULK_CATEGORIES[0].id);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Single Delete Modal
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      investments.map((inv) => ({
        inv,
        invested: investedValue(inv),
        current: currentValue(inv),
        pl: currentValue(inv) - investedValue(inv),
        plPct:
          investedValue(inv) > 0
            ? ((currentValue(inv) - investedValue(inv)) / investedValue(inv)) *
              100
            : 0,
        // Add extended data to the row payload
        marketCap: extendedData[inv.id]?.cap,
      })),
    [investments, extendedData],
  );

  const isAllSelected = rows.length > 0 && selectedIds.length === rows.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(rows.map((r) => r.inv.id));
    }
  };

  const toggleRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  // --- ACTIONS ---

  const handleSingleDelete = async () => {
    if (deleteId) {
      await deleteInvestment(deleteId);
      setSelectedIds((prev) => prev.filter((id) => id !== deleteId));
    }
    setDeleteId(null);
  };

  const handleBulkDelete = async () => {
    setBulkLoading(true);
    for (const id of selectedIds) {
      await deleteInvestment(id);
    }
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
      if (cat.type === 'other') {
        patch.assetType = cat.id;
      }

      // Safe field migrations to prevent crashes when switching shapes
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
      {/* ── Dynamic Asset Count Header ── */}
      <div className='flex items-center gap-2 mb-2 px-1'>
        <FiList className='h-4 w-4 text-emerald-500' />
        <h2 className='text-xs font-bold uppercase tracking-widest text-slate-400'>
          Showing <span className='text-white'>{rows.length}</span> Asset
          {rows.length !== 1 ? 's' : ''}
        </h2>
      </div>

      {/* MOBILE VIEW: Card List */}
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

        {rows.map(({ inv, current, pl, plPct, marketCap }) => {
          const isSelected = selectedIds.includes(inv.id);
          return (
            <div
              key={inv.id}
              className={`border p-4 rounded-2xl flex flex-col gap-3 transition-colors ${
                isSelected
                  ? 'bg-emerald-500/5 border-emerald-500/30'
                  : 'bg-slate-900/50 border-slate-800'
              }`}
            >
              <div className='flex justify-between items-start'>
                <div className='flex items-start gap-3 max-w-[70%]'>
                  <button
                    onClick={() => toggleRow(inv.id)}
                    className='mt-0.5 text-slate-400 hover:text-emerald-400 transition-colors'
                  >
                    {isSelected ? (
                      <FiCheckSquare size={18} className='text-emerald-500' />
                    ) : (
                      <FiSquare size={18} />
                    )}
                  </button>
                  <div className='flex flex-col gap-1.5'>
                    <div>
                      <h3
                        className='font-semibold text-slate-50 truncate text-sm'
                        title={inv.name}
                      >
                        {inv.name}
                      </h3>
                      <p className='text-[10px] text-slate-500 uppercase font-bold tracking-tight'>
                        {inv.platform || 'Direct'}
                      </p>
                    </div>
                    {/* Chips specifically for mobile */}
                    <div className='flex flex-wrap items-center gap-1.5'>
                      <SectorChip sector={inv.sector} />
                      <MarketCapChip cap={marketCap} />
                    </div>
                  </div>
                </div>
                <div className='flex gap-2'>
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
                className={`grid grid-cols-2 gap-2 pt-2 border-t ${isSelected ? 'border-emerald-500/20' : 'border-slate-800/50'}`}
              >
                <div>
                  <p className='text-[10px] text-slate-500 font-medium'>
                    Current Value
                  </p>
                  <p className='text-sm font-bold text-white'>
                    {formatINR(current)}
                  </p>
                </div>
                <div className='text-right'>
                  <p className='text-[10px] text-slate-500 font-medium'>
                    Returns
                  </p>
                  <p
                    className={`text-sm font-bold ${pl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
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

      {/* DESKTOP VIEW: Table */}
      <div className='hidden md:block overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50'>
        <div className='overflow-x-auto'>
          <table className='w-full text-left text-sm'>
            <thead className='bg-slate-800/50 text-[11px] font-bold uppercase text-slate-500 tracking-wider'>
              <tr>
                <th className='px-4 py-4 w-10 text-center'>
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
                <th className='px-4 py-4'>Asset</th>
                <th className='px-6 py-4'>Classification</th>
                <th className='px-6 py-4'>Platform</th>
                <th className='px-6 py-4 text-right'>Invested</th>
                <th className='px-6 py-4 text-right'>Current</th>
                <th className='px-6 py-4 text-right'>P/L</th>
                <th className='px-6 py-4 text-center'>Actions</th>
              </tr>
            </thead>
            <tbody className='divide-y divide-slate-800'>
              {rows.map(({ inv, invested, current, pl, plPct, marketCap }) => {
                const isSelected = selectedIds.includes(inv.id);
                return (
                  <tr
                    key={inv.id}
                    className={`transition-colors ${isSelected ? 'bg-emerald-500/10' : 'hover:bg-slate-800/30'}`}
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
                    <td className='px-4 py-4 max-w-[200px]'>
                      <div
                        className='font-semibold text-white truncate'
                        title={inv.name}
                      >
                        {inv.name}
                      </div>
                      <div className='text-[10px] text-slate-500 font-bold'>
                        {inv.symbol}
                      </div>
                    </td>
                    <td className='px-6 py-4'>
                      <div className='flex flex-wrap gap-1.5'>
                        <SectorChip sector={inv.sector} />
                        <MarketCapChip cap={marketCap} />
                        {/* Fallback if no classification exists for a row */}
                        {!inv.sector && !marketCap && (
                          <span className='text-xs text-slate-600'>—</span>
                        )}
                      </div>
                    </td>
                    <td className='px-6 py-4 text-slate-400 text-xs'>
                      {inv.platform}
                    </td>
                    <td className='px-6 py-4 text-right text-slate-300 tabular-nums'>
                      {formatINR(invested)}
                    </td>
                    <td className='px-6 py-4 text-right font-semibold text-white tabular-nums'>
                      {formatINR(current)}
                    </td>
                    <td
                      className={`px-6 py-4 text-right tabular-nums ${pl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                    >
                      <div className='font-bold'>{formatINR(pl)}</div>
                      <div className='text-[10px] opacity-80'>
                        {plPct.toFixed(2)}%
                      </div>
                    </td>
                    <td className='px-6 py-4'>
                      <div className='flex justify-center gap-2'>
                        <button
                          onClick={() => setEdit(inv)}
                          className='p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors'
                        >
                          <FiEdit2 size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteId(inv.id)}
                          className='p-2 hover:bg-rose-500/10 rounded-lg text-slate-400 hover:text-rose-400 transition-colors'
                        >
                          <FiTrash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
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
            title='Clear selection'
          >
            <FiX size={18} />
          </button>
        </div>
      )}

      {/* INDIVIDUAL EDIT MODAL */}
      {edit && (
        <UpsertInvestmentModal
          open={!!edit}
          onClose={() => setEdit(null)}
          mode='edit'
          investment={edit}
        />
      )}

      {/* INDIVIDUAL DELETE CONFIRMATION MODAL */}
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

      {/* BULK DELETE CONFIRMATION MODAL */}
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

      {/* BULK EDIT CATEGORY MODAL */}
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
