// src/pages/Profits/ProfitsPage.tsx

import {
  FiArrowDown,
  FiArrowUp,
  FiAward,
  FiDollarSign,
  FiEdit2,
  FiFilter,
  FiPercent,
  FiPlus,
  FiSave,
  FiTarget,
  FiTrash2,
  FiTrendingDown,
  FiTrendingUp,
  FiX,
} from 'react-icons/fi';
import { FiCalendar, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  isValid,
  parse,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { useCallback, useEffect, useRef } from 'react';
import { useMemo, useState } from 'react';

import { Modal } from '../../components/ui/Modal';
import { NumericInput } from '../../components/ui/NumericInput';
import type { SoldTrade } from '../../types/investmentTypes';
import { createPortal } from 'react-dom';
import { formatINR } from '../../utils/format';
import { todayISO } from '../../utils/dateUtils';
import { usePortfolioStore } from '../../store/portfolioStore';

// ── Inline Calendar Picker ────────────────────────────────────────────────
function CalendarPicker({
  value,
  onChange,
  placeholder = 'Pick a date',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [viewDate, setViewDate] = useState<Date>(() => {
    const d = value ? parse(value, 'yyyy-MM-dd', new Date()) : new Date();
    return isValid(d) ? d : new Date();
  });

  const selectedDate = useMemo(() => {
    if (!value) return null;
    const d = parse(value, 'yyyy-MM-dd', new Date());
    return isValid(d) ? d : null;
  }, [value]);

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const panelW = 280;
    const panelH = panelRef.current ? panelRef.current.offsetHeight : 340;
    const rawLeft = r.left + window.scrollX;
    const clampedLeft = Math.min(
      rawLeft,
      window.innerWidth + window.scrollX - panelW - 16,
    );
    const spaceBelow = window.innerHeight - r.bottom;
    let top = r.bottom + 8 + window.scrollY;
    if (spaceBelow < panelH && r.top > spaceBelow)
      top = r.top - panelH - 8 + window.scrollY;
    setPos({ top, left: Math.max(8, clampedLeft) });
  }, []);

  useEffect(() => {
    if (open) {
      updatePos();
      setTimeout(updatePos, 10);
    }
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

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewDate), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(viewDate), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [viewDate]);

  const selectDay = (d: Date) => {
    onChange(format(d, 'yyyy-MM-dd'));
    setOpen(false);
  };
  const inputCls = `flex w-full items-center gap-3 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all duration-200 ${open ? 'border-emerald-500/50 bg-slate-800 text-emerald-400' : 'border-slate-700/80 bg-slate-900/50 hover:bg-slate-800/60 text-slate-100'}`;

  return (
    <>
      <button
        ref={triggerRef}
        type='button'
        onClick={() => setOpen((v) => !v)}
        className={inputCls}
      >
        <FiCalendar
          className={`h-4 w-4 shrink-0 ${open ? 'text-emerald-400' : 'text-slate-500'}`}
        />
        <span
          className={`flex-1 text-left ${!selectedDate ? 'text-slate-500' : ''}`}
        >
          {selectedDate ? format(selectedDate, 'dd MMM yyyy') : placeholder}
        </span>
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: 'absolute',
              top: pos.top,
              left: pos.left,
              zIndex: 99999,
              width: 280,
            }}
            className='rounded-xl border border-slate-700 bg-slate-900 shadow-2xl backdrop-blur-xl overflow-hidden'
          >
            <div className='flex items-center justify-between px-4 py-3 border-b border-slate-800'>
              <button
                type='button'
                onClick={() => setViewDate((d) => addMonths(d, -1))}
                className='flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800'
              >
                <FiChevronLeft className='h-4 w-4' />
              </button>
              <span className='text-sm font-bold text-slate-200'>
                {format(viewDate, 'MMMM yyyy')}
              </span>
              <button
                type='button'
                onClick={() => setViewDate((d) => addMonths(d, 1))}
                className='flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800'
              >
                <FiChevronRight className='h-4 w-4' />
              </button>
            </div>
            <div className='grid grid-cols-7 px-3 pt-3 pb-1'>
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                <div
                  key={d}
                  className='text-center text-[10px] font-bold text-slate-500 pb-1'
                >
                  {d}
                </div>
              ))}
            </div>
            <div className='grid grid-cols-7 px-3 pb-3 gap-y-0.5'>
              {days.map((day) => {
                const isSelected = selectedDate
                  ? isSameDay(day, selectedDate)
                  : false;
                const isCurMonth = isSameMonth(day, viewDate);
                const isTodayDay = isToday(day);
                return (
                  <button
                    key={day.toISOString()}
                    type='button'
                    onClick={() => selectDay(day)}
                    className={`flex h-8 w-8 mx-auto items-center justify-center rounded-lg text-xs font-medium transition-all
                    ${isSelected ? 'bg-emerald-500 text-white font-bold' : isTodayDay ? 'border border-emerald-500/40 text-emerald-400' : isCurMonth ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600'}`}
                  >
                    {format(day, 'd')}
                  </button>
                );
              })}
            </div>
            <div className='px-3 pb-3 flex justify-between border-t border-slate-800 pt-2'>
              <button
                type='button'
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
                className='text-xs font-bold text-slate-500 hover:text-slate-300 px-2 py-1'
              >
                Clear
              </button>
              <button
                type='button'
                onClick={() => selectDay(new Date())}
                className='text-xs font-bold text-emerald-400 hover:text-emerald-300 px-2 py-1'
              >
                Today
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

// ── Summary Card ──────────────────────────────────────────────────────────
function SummaryCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
  trend,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  accent: string;
  trend?: 'up' | 'down' | 'neutral';
}) {
  const trendColor =
    trend === 'up'
      ? 'text-emerald-400'
      : trend === 'down'
        ? 'text-rose-400'
        : 'text-slate-100';
  return (
    <div className='relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 p-5 hover:-translate-y-0.5 transition-all duration-200 shadow-sm'>
      <div className='flex items-start justify-between mb-3'>
        <p className='text-xs font-bold uppercase tracking-widest text-slate-500'>
          {label}
        </p>
        <div
          className='flex h-8 w-8 shrink-0 items-center justify-center rounded-xl'
          style={{ background: `${accent}18` }}
        >
          <Icon className='h-4 w-4' style={{ color: accent }} />
        </div>
      </div>
      <p className={`text-2xl font-bold tabular-nums ${trendColor}`}>{value}</p>
      {sub && <p className='mt-1 text-xs font-medium text-slate-500'>{sub}</p>}
      <div
        className='absolute bottom-0 left-0 h-[2px] w-full'
        style={{
          background: `linear-gradient(90deg, ${accent}60, transparent)`,
        }}
      />
    </div>
  );
}

// ── Edit Trade Modal ──────────────────────────────────────────────────────
function EditTradeModal({
  trade,
  onClose,
}: {
  trade: SoldTrade;
  onClose: () => void;
}) {
  const updateSoldTrade = usePortfolioStore((s) => s.updateSoldTrade);
  const [buyTotal, setBuyTotal] = useState(String(trade.buyPrice));
  const [sellTotal, setSellTotal] = useState(String(trade.sellPrice));
  const [soldDate, setSoldDate] = useState(trade.soldDate);
  const [notes, setNotes] = useState(trade.notes ?? '');
  const [saving, setSaving] = useState(false);

  const buy = parseFloat(buyTotal) || 0;
  const sell = parseFloat(sellTotal) || 0;
  const profit = sell - buy;
  const profitPct = buy > 0 ? (profit / buy) * 100 : 0;
  const isProfit = profit >= 0;

  async function handleSave() {
    setSaving(true);
    try {
      await updateSoldTrade(trade.id, {
        buyPrice: buy,
        sellPrice: sell,
        soldDate,
        notes: notes.trim() || undefined,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    'w-full rounded-xl border border-slate-700/80 bg-slate-900/50 px-4 py-2.5 text-sm font-medium text-slate-100 outline-none transition-all focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 placeholder:text-slate-600';
  const labelCls =
    'text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 block ml-1';

  return (
    <Modal open onClose={onClose} title='Edit Trade Record'>
      <div className='space-y-5'>
        <div className='rounded-xl border border-slate-700/60 bg-slate-800/40 px-4 py-3'>
          <p className='font-bold text-slate-100 text-sm'>
            {trade.investmentName}
          </p>
          <p className='text-[11px] text-slate-500 mt-0.5 capitalize'>
            {trade.investmentType.replace('_', ' ')}
          </p>
        </div>
        <div className='grid grid-cols-2 gap-4'>
          <div>
            <label className={labelCls}>Buy Cost (₹)</label>
            <NumericInput
              className={inputCls}
              value={buyTotal}
              onChange={setBuyTotal}
            />
          </div>
          <div>
            <label className={labelCls}>Sell Value (₹)</label>
            <NumericInput
              className={inputCls}
              value={sellTotal}
              onChange={setSellTotal}
            />
          </div>
        </div>

        {/* Live preview */}
        <div
          className={`rounded-xl border p-3 flex items-center gap-3 ${isProfit ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-rose-500/20 bg-rose-500/5'}`}
        >
          {isProfit ? (
            <FiTrendingUp className='h-4 w-4 text-emerald-400 shrink-0' />
          ) : (
            <FiTrendingDown className='h-4 w-4 text-rose-400 shrink-0' />
          )}
          <span
            className={`font-bold text-sm ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}
          >
            {isProfit ? '+' : ''}
            {formatINR(profit)}
          </span>
          <span
            className={`text-xs font-semibold ${isProfit ? 'text-emerald-500' : 'text-rose-500'}`}
          >
            ({isProfit ? '▲' : '▼'} {Math.abs(profitPct).toFixed(2)}%)
          </span>
        </div>

        <div>
          <label className={labelCls}>Date of Sale</label>
          <CalendarPicker value={soldDate} onChange={setSoldDate} />
        </div>
        <div>
          <label className={labelCls}>Notes (optional)</label>
          <textarea
            className={`${inputCls} resize-none h-16`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder='Add notes...'
          />
        </div>
        <div className='flex justify-end gap-3 border-t border-slate-800 pt-4'>
          <button
            onClick={onClose}
            disabled={saving}
            className='rounded-xl px-5 py-2.5 text-sm font-bold text-slate-400 hover:bg-slate-800 transition-colors disabled:opacity-50'
          >
            Cancel
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className='inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 disabled:opacity-60'
          >
            <FiSave className='h-4 w-4' />
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Add Trade Modal (manual entry without an existing investment) ──────────
function AddTradeModal({ onClose }: { onClose: () => void }) {
  const addSoldTrade = usePortfolioStore((s) => s.addSoldTrade);
  const [name, setName] = useState('');
  const [type, setType] = useState<SoldTrade['investmentType']>('stock');
  const [buyTotal, setBuyTotal] = useState('');
  const [sellTotal, setSellTotal] = useState('');
  const [soldDate, setSoldDate] = useState(todayISO());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const buy = parseFloat(buyTotal) || 0;
  const sell = parseFloat(sellTotal) || 0;
  const profit = sell - buy;
  const profitPct = buy > 0 ? (profit / buy) * 100 : 0;
  const isProfit = profit >= 0;

  async function handleSave() {
    if (!name.trim() || buy <= 0 || sell <= 0) return;
    setSaving(true);
    try {
      await addSoldTrade({
        investmentName: name.trim(),
        investmentType: type,
        buyPrice: buy,
        sellPrice: sell,
        soldDate,
        notes: notes.trim() || undefined,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    'w-full rounded-xl border border-slate-700/80 bg-slate-900/50 px-4 py-2.5 text-sm font-medium text-slate-100 outline-none transition-all focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 placeholder:text-slate-600';
  const labelCls =
    'text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 block ml-1';

  return (
    <Modal open onClose={onClose} title='Add Trade Manually'>
      <div className='space-y-5'>
        <div className='grid grid-cols-2 gap-4'>
          <div>
            <label className={labelCls}>Asset Name</label>
            <input
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='e.g. RELIANCE, HDFC MF'
            />
          </div>
          <div>
            <label className={labelCls}>Type</label>
            <select
              className={`${inputCls} appearance-none`}
              value={type}
              onChange={(e) => setType(e.target.value as any)}
            >
              <option value='stock'>Stock</option>
              <option value='mutual_fund'>Mutual Fund</option>
              <option value='bond'>Bond</option>
              <option value='fixed_deposit'>Fixed Deposit</option>
              <option value='other'>Other</option>
            </select>
          </div>
        </div>
        <div className='grid grid-cols-2 gap-4'>
          <div>
            <label className={labelCls}>Total Buy Cost (₹)</label>
            <NumericInput
              className={inputCls}
              value={buyTotal}
              onChange={setBuyTotal}
            />
          </div>
          <div>
            <label className={labelCls}>Total Sell Value (₹)</label>
            <NumericInput
              className={inputCls}
              value={sellTotal}
              onChange={setSellTotal}
            />
          </div>
        </div>

        {buy > 0 && sell > 0 && (
          <div
            className={`rounded-xl border p-3 flex items-center gap-3 ${isProfit ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-rose-500/20 bg-rose-500/5'}`}
          >
            {isProfit ? (
              <FiTrendingUp className='h-4 w-4 text-emerald-400' />
            ) : (
              <FiTrendingDown className='h-4 w-4 text-rose-400' />
            )}
            <span
              className={`font-bold text-sm ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}
            >
              {isProfit ? '+' : ''}
              {formatINR(profit)}
            </span>
            <span
              className={`text-xs font-semibold ${isProfit ? 'text-emerald-500' : 'text-rose-500'}`}
            >
              ({isProfit ? '▲' : '▼'} {Math.abs(profitPct).toFixed(2)}%)
            </span>
          </div>
        )}

        <div>
          <label className={labelCls}>Date of Sale</label>
          <CalendarPicker value={soldDate} onChange={setSoldDate} />
        </div>
        <div>
          <label className={labelCls}>Notes (optional)</label>
          <textarea
            className={`${inputCls} resize-none h-16`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder='e.g. Target reached, booked profits...'
          />
        </div>
        <div className='flex justify-end gap-3 border-t border-slate-800 pt-4'>
          <button
            onClick={onClose}
            className='rounded-xl px-5 py-2.5 text-sm font-bold text-slate-400 hover:bg-slate-800 transition-colors'
          >
            Cancel
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={saving || !name.trim() || buy <= 0 || sell <= 0}
            className='inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 disabled:opacity-60'
          >
            <FiPlus className='h-4 w-4' />
            {saving ? 'Saving…' : 'Add Trade'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Type chip ─────────────────────────────────────────────────────────────
function TypeBadge({ type }: { type: SoldTrade['investmentType'] }) {
  const map: Record<string, { label: string; cls: string }> = {
    stock: {
      label: 'Stock',
      cls: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
    },
    mutual_fund: {
      label: 'MF',
      cls: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-400',
    },
    bond: {
      label: 'Bond',
      cls: 'border-violet-500/30 bg-violet-500/10 text-violet-400',
    },
    fixed_deposit: {
      label: 'FD',
      cls: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
    },
    other: {
      label: 'Other',
      cls: 'border-slate-500/30 bg-slate-500/10 text-slate-400',
    },
  };
  const { label, cls } = map[type] ?? map.other;
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${cls}`}
    >
      {label}
    </span>
  );
}

// ── Sort icon ─────────────────────────────────────────────────────────────
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
    return <FiArrowUp size={11} className='text-slate-600' />;
  if (sortDir === 'asc')
    return <FiArrowUp size={11} className='text-emerald-400' />;
  return <FiArrowDown size={11} className='text-amber-400' />;
}

// ── Main Page ─────────────────────────────────────────────────────────────
export function ProfitsPage() {
  const soldTrades = usePortfolioStore((s) => s.soldTrades);
  const deleteSoldTrade = usePortfolioStore((s) => s.deleteSoldTrade);

  const [editTrade, setEditTrade] = useState<SoldTrade | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [resultFilter, setResultFilter] = useState<'all' | 'profit' | 'loss'>(
    'all',
  );
  const [sortCol, setSortCol] = useState<
    'date' | 'profit' | 'profitPct' | 'name' | null
  >('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleSort = (col: 'date' | 'profit' | 'profitPct' | 'name') => {
    if (sortCol !== col) {
      setSortCol(col);
      setSortDir('desc');
    } else if (sortDir === 'desc') setSortDir('asc');
    else {
      setSortCol(null);
      setSortDir('desc');
    }
  };

  // ── Computed summary stats ──────────────────────────────────────────────
  const stats = useMemo(() => {
    if (soldTrades.length === 0)
      return {
        totalProfit: 0,
        totalTrades: 0,
        winRate: 0,
        bestTrade: null as SoldTrade | null,
        worstTrade: null as SoldTrade | null,
        totalInvested: 0,
      };
    const totalProfit = soldTrades.reduce((s, t) => s + t.profit, 0);
    const totalInvested = soldTrades.reduce((s, t) => s + t.buyPrice, 0);
    const wins = soldTrades.filter((t) => t.profit >= 0).length;
    const winRate = (wins / soldTrades.length) * 100;
    const bestTrade = [...soldTrades].sort((a, b) => b.profit - a.profit)[0];
    const worstTrade = [...soldTrades].sort((a, b) => a.profit - b.profit)[0];
    return {
      totalProfit,
      totalTrades: soldTrades.length,
      winRate,
      bestTrade,
      worstTrade,
      totalInvested,
    };
  }, [soldTrades]);

  // ── Filtered + sorted rows ──────────────────────────────────────────────
  const filteredTrades = useMemo(() => {
    let rows = [...soldTrades];
    if (typeFilter !== 'all')
      rows = rows.filter((t) => t.investmentType === typeFilter);
    if (resultFilter === 'profit') rows = rows.filter((t) => t.profit >= 0);
    if (resultFilter === 'loss') rows = rows.filter((t) => t.profit < 0);
    if (sortCol) {
      rows.sort((a, b) => {
        let av: string | number = 0,
          bv: string | number = 0;
        if (sortCol === 'date') {
          av = a.soldDate;
          bv = b.soldDate;
        }
        if (sortCol === 'profit') {
          av = a.profit;
          bv = b.profit;
        }
        if (sortCol === 'profitPct') {
          av = a.profitPct;
          bv = b.profitPct;
        }
        if (sortCol === 'name') {
          av = a.investmentName.toLowerCase();
          bv = b.investmentName.toLowerCase();
        }
        if (av < bv) return sortDir === 'asc' ? -1 : 1;
        if (av > bv) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return rows;
  }, [soldTrades, typeFilter, resultFilter, sortCol, sortDir]);

  const overallReturn =
    stats.totalInvested > 0
      ? (stats.totalProfit / stats.totalInvested) * 100
      : 0;

  return (
    <div className='flex flex-col gap-6 pb-10'>
      {/* ── Header ── */}
      <header className='flex flex-col gap-3 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent p-4 md:p-6 border border-emerald-500/20'>
        <div className='flex items-center justify-between gap-4 flex-wrap'>
          <div className='flex items-center gap-3 md:gap-4'>
            <div className='flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-500/20'>
              <FiDollarSign className='h-5 w-5 md:h-6 md:w-6' />
            </div>
            <div>
              <h1 className='text-xl md:text-2xl font-semibold tracking-tight text-white leading-tight'>
                Realized Profits
              </h1>
              <p className='mt-0.5 text-[11px] md:text-sm font-medium text-slate-400'>
                Track every sale — buy cost vs sell value = actual profit.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className='flex items-center gap-2 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 hover:-translate-y-0.5 transition-all active:scale-95'
          >
            <FiPlus className='h-4 w-4' />
            Add Trade
          </button>
        </div>
      </header>

      {/* ── Summary Cards ── */}
      <div className='grid grid-cols-2 gap-3 lg:grid-cols-4'>
        <SummaryCard
          label='Total Realized P&L'
          value={`${stats.totalProfit >= 0 ? '+' : ''}${formatINR(stats.totalProfit)}`}
          sub={`${overallReturn >= 0 ? '▲' : '▼'} ${Math.abs(overallReturn).toFixed(2)}% overall return`}
          icon={stats.totalProfit >= 0 ? FiTrendingUp : FiTrendingDown}
          accent={stats.totalProfit >= 0 ? '#10b981' : '#f43f5e'}
          trend={stats.totalProfit >= 0 ? 'up' : 'down'}
        />
        <SummaryCard
          label='Total Trades'
          value={String(stats.totalTrades)}
          sub={`${formatINR(stats.totalInvested)} total invested`}
          icon={FiTarget}
          accent='#6366f1'
        />
        <SummaryCard
          label='Win Rate'
          value={`${stats.winRate.toFixed(1)}%`}
          sub={`${soldTrades.filter((t) => t.profit >= 0).length} profitable trades`}
          icon={FiPercent}
          accent='#f59e0b'
          trend={stats.winRate >= 50 ? 'up' : 'down'}
        />
        <SummaryCard
          label='Best Trade'
          value={
            stats.bestTrade ? `+${formatINR(stats.bestTrade.profit)}` : '—'
          }
          sub={stats.bestTrade?.investmentName ?? 'No trades yet'}
          icon={FiAward}
          accent='#3b82f6'
          trend={
            stats.bestTrade && stats.bestTrade.profit > 0 ? 'up' : 'neutral'
          }
        />
      </div>

      {/* ── Filters ── */}
      {soldTrades.length > 0 && (
        <div className='flex flex-wrap items-center gap-3'>
          <div className='flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest'>
            <FiFilter size={12} /> Filters
          </div>
          {/* Type filter */}
          <div className='flex items-center gap-1.5 flex-wrap'>
            {[
              { id: 'all', label: 'All Types' },
              { id: 'stock', label: 'Stocks' },
              { id: 'mutual_fund', label: 'MF' },
              { id: 'bond', label: 'Bonds' },
              { id: 'fixed_deposit', label: 'FD' },
              { id: 'other', label: 'Other' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setTypeFilter(f.id)}
                className={`rounded-lg px-3 py-1 text-xs font-bold transition-all ${typeFilter === f.id ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-slate-200'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className='w-px h-5 bg-slate-700' />
          {/* Result filter */}
          <div className='flex items-center gap-1.5'>
            {[
              { id: 'all' as const, label: 'All Results' },
              { id: 'profit' as const, label: '🟢 Profits Only' },
              { id: 'loss' as const, label: '🔴 Losses Only' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setResultFilter(f.id)}
                className={`rounded-lg px-3 py-1 text-xs font-bold transition-all ${resultFilter === f.id ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-slate-200'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {soldTrades.length === 0 && (
        <div className='flex flex-col items-center justify-center py-20 rounded-2xl border border-dashed border-slate-800 bg-slate-900/20 text-center gap-4'>
          <div className='flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400'>
            <FiDollarSign className='h-8 w-8' />
          </div>
          <div>
            <p className='text-lg font-bold text-slate-200'>
              No sales recorded yet
            </p>
            <p className='text-sm text-slate-500 mt-1 max-w-sm'>
              When you sell a stock, go to{' '}
              <strong className='text-slate-300'>
                Investments → Sell button (💰)
              </strong>{' '}
              on any row, or add a trade manually here.
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className='flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 transition-colors'
          >
            <FiPlus className='h-4 w-4' /> Add Your First Trade
          </button>
        </div>
      )}

      {/* ── Trades Table ── */}
      {filteredTrades.length > 0 && (
        <>
          {/* ── MOBILE VIEW ── */}
          <div className='flex flex-col gap-3 md:hidden'>
            {filteredTrades.map((trade) => {
              const isProfit = trade.profit >= 0;
              return (
                <div
                  key={trade.id}
                  className={`relative rounded-2xl border overflow-hidden ${isProfit ? 'border-slate-800 bg-slate-900/60' : 'border-slate-800 bg-slate-900/60'}`}
                >
                  <div
                    className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-l-2xl ${isProfit ? 'bg-emerald-500' : 'bg-rose-500'}`}
                  />
                  <div className='pl-4 pr-3 pt-3 pb-3'>
                    <div className='flex items-start justify-between gap-2'>
                      <div className='flex-1 min-w-0'>
                        <p className='font-bold text-[14px] text-slate-100 truncate leading-tight'>
                          {trade.investmentName}
                        </p>
                        <div className='flex items-center gap-1.5 mt-1 flex-wrap'>
                          <TypeBadge type={trade.investmentType} />
                          <span className='text-[10px] text-slate-500'>
                            {trade.soldDate}
                          </span>
                        </div>
                        {trade.notes && (
                          <p className='text-[11px] text-slate-600 mt-1 italic truncate'>
                            {trade.notes}
                          </p>
                        )}
                      </div>
                      <div className='flex items-center gap-1 shrink-0'>
                        <button
                          onClick={() => setEditTrade(trade)}
                          className='flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white'
                        >
                          <FiEdit2 size={12} />
                        </button>
                        <button
                          onClick={() => setDeleteId(trade.id)}
                          className='flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400'
                        >
                          <FiTrash2 size={12} />
                        </button>
                      </div>
                    </div>
                    <div className='mt-3 pt-3 border-t border-slate-800/60 grid grid-cols-3 gap-0'>
                      <div className='flex flex-col gap-0.5'>
                        <span className='text-[9px] font-bold uppercase tracking-wider text-slate-600'>
                          Buy Cost
                        </span>
                        <span className='text-[13px] font-semibold text-slate-400'>
                          {formatINR(trade.buyPrice)}
                        </span>
                      </div>
                      <div className='flex flex-col gap-0.5 items-center'>
                        <span className='text-[9px] font-bold uppercase tracking-wider text-slate-600'>
                          Sell Value
                        </span>
                        <span className='text-[13px] font-bold text-white'>
                          {formatINR(trade.sellPrice)}
                        </span>
                      </div>
                      <div className='flex flex-col gap-0.5 items-end'>
                        <span className='text-[9px] font-bold uppercase tracking-wider text-slate-600'>
                          Profit / Loss
                        </span>
                        <span
                          className={`text-[13px] font-bold tabular-nums ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}
                        >
                          {isProfit ? '+' : ''}
                          {formatINR(trade.profit)}
                        </span>
                        <span
                          className={`text-[10px] font-semibold ${isProfit ? 'text-emerald-500' : 'text-rose-500'}`}
                        >
                          {isProfit ? '▲' : '▼'}{' '}
                          {Math.abs(trade.profitPct).toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── DESKTOP TABLE ── */}
          <div className='hidden md:block overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40 shadow-xl'>
            <div className='overflow-x-auto'>
              <table className='w-full text-sm border-separate border-spacing-0'>
                <thead>
                  <tr className='whitespace-nowrap'>
                    {[
                      { col: 'name', label: 'Asset', align: 'left' },
                      { col: null, label: 'Type', align: 'left' },
                      { col: null, label: 'Date', align: 'left' },
                      { col: null, label: 'Buy Cost', align: 'right' },
                      { col: null, label: 'Sell Value', align: 'right' },
                      { col: 'profit', label: 'P&L', align: 'right' },
                      { col: 'profitPct', label: '%', align: 'right' },
                      { col: null, label: '', align: 'right' },
                    ].map((h, i) => (
                      <th
                        key={i}
                        className='sticky top-0 z-10 bg-slate-900 px-4 py-2.5 border-b border-slate-700/60'
                      >
                        {h.col ? (
                          <button
                            onClick={() => handleSort(h.col as any)}
                            className={`flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500 hover:text-slate-200 transition-colors ${h.align === 'right' ? 'justify-end w-full' : ''}`}
                          >
                            {h.align === 'right' && (
                              <SortIcon
                                col={h.col}
                                sortCol={sortCol}
                                sortDir={sortDir}
                              />
                            )}
                            {h.label}
                            {h.align !== 'right' && (
                              <SortIcon
                                col={h.col}
                                sortCol={sortCol}
                                sortDir={sortDir}
                              />
                            )}
                          </button>
                        ) : (
                          <span
                            className={`text-[10px] font-semibold uppercase tracking-widest text-slate-500 ${h.align === 'right' ? 'block text-right' : ''}`}
                          >
                            {h.label}
                          </span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredTrades.map((trade, rowIdx) => {
                    const isProfit = trade.profit >= 0;
                    const isLast = rowIdx === filteredTrades.length - 1;
                    const bdClass = !isLast
                      ? 'border-b border-slate-800/70'
                      : '';
                    return (
                      <tr
                        key={trade.id}
                        className='group hover:bg-slate-800/50 transition-colors'
                      >
                        {/* Asset */}
                        <td className={`pl-4 pr-3 py-3.5 ${bdClass}`}>
                          <div className='flex flex-col gap-0.5 min-w-[160px]'>
                            <span className='font-semibold text-[13px] text-slate-100 leading-tight'>
                              {trade.investmentName}
                            </span>
                            {trade.notes && (
                              <span className='text-[10px] text-slate-600 italic truncate max-w-[160px]'>
                                {trade.notes}
                              </span>
                            )}
                          </div>
                        </td>
                        {/* Type */}
                        <td className={`px-4 py-3.5 ${bdClass}`}>
                          <TypeBadge type={trade.investmentType} />
                        </td>
                        {/* Date */}
                        <td className={`px-4 py-3.5 ${bdClass}`}>
                          <span className='text-[12px] text-slate-400 tabular-nums'>
                            {(() => {
                              try {
                                return format(
                                  parse(
                                    trade.soldDate,
                                    'yyyy-MM-dd',
                                    new Date(),
                                  ),
                                  'dd MMM yyyy',
                                );
                              } catch {
                                return trade.soldDate;
                              }
                            })()}
                          </span>
                        </td>
                        {/* Buy */}
                        <td
                          className={`px-4 py-3.5 text-right tabular-nums ${bdClass}`}
                        >
                          <span className='text-[13px] text-slate-400'>
                            {formatINR(trade.buyPrice)}
                          </span>
                        </td>
                        {/* Sell */}
                        <td
                          className={`px-4 py-3.5 text-right tabular-nums ${bdClass}`}
                        >
                          <span className='text-[13px] font-bold text-white'>
                            {formatINR(trade.sellPrice)}
                          </span>
                        </td>
                        {/* P&L */}
                        <td
                          className={`px-4 py-3.5 text-right tabular-nums ${bdClass}`}
                        >
                          <span
                            className={`text-[13px] font-bold ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}
                          >
                            {isProfit ? '+' : ''}
                            {formatINR(trade.profit)}
                          </span>
                        </td>
                        {/* % */}
                        <td
                          className={`px-4 py-3.5 text-right tabular-nums ${bdClass}`}
                        >
                          <span
                            className={`text-[12px] font-semibold ${isProfit ? 'text-emerald-500' : 'text-rose-500'}`}
                          >
                            {isProfit ? '▲' : '▼'}{' '}
                            {Math.abs(trade.profitPct).toFixed(2)}%
                          </span>
                        </td>
                        {/* Actions */}
                        <td className={`px-3 py-3.5 ${bdClass}`}>
                          <div className='flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity'>
                            <button
                              onClick={() => setEditTrade(trade)}
                              className='flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700/60 transition-all'
                            >
                              <FiEdit2 size={12} />
                            </button>
                            <button
                              onClick={() => setDeleteId(trade.id)}
                              className='flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700/60 transition-all'
                            >
                              <FiTrash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Footer totals row */}
                <tfoot>
                  <tr className='bg-slate-900/80 border-t border-slate-700/60'>
                    <td colSpan={3} className='px-4 py-3'>
                      <span className='text-[11px] font-bold uppercase tracking-wider text-slate-500'>
                        {filteredTrades.length} trades
                      </span>
                    </td>
                    <td className='px-4 py-3 text-right'>
                      <span className='text-[13px] font-bold text-slate-400 tabular-nums'>
                        {formatINR(
                          filteredTrades.reduce((s, t) => s + t.buyPrice, 0),
                        )}
                      </span>
                    </td>
                    <td className='px-4 py-3 text-right'>
                      <span className='text-[13px] font-bold text-white tabular-nums'>
                        {formatINR(
                          filteredTrades.reduce((s, t) => s + t.sellPrice, 0),
                        )}
                      </span>
                    </td>
                    <td className='px-4 py-3 text-right' colSpan={3}>
                      {(() => {
                        const total = filteredTrades.reduce(
                          (s, t) => s + t.profit,
                          0,
                        );
                        const isPos = total >= 0;
                        return (
                          <span
                            className={`text-[14px] font-bold tabular-nums ${isPos ? 'text-emerald-400' : 'text-rose-400'}`}
                          >
                            {isPos ? '+' : ''}
                            {formatINR(total)}
                          </span>
                        );
                      })()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}

      {/* No filter results */}
      {soldTrades.length > 0 && filteredTrades.length === 0 && (
        <div className='flex flex-col items-center justify-center py-12 rounded-2xl border border-dashed border-slate-800 text-slate-500 gap-2'>
          <FiFilter size={24} className='opacity-30' />
          <p className='text-sm font-medium'>
            No trades match the current filters
          </p>
          <button
            onClick={() => {
              setTypeFilter('all');
              setResultFilter('all');
            }}
            className='text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1'
          >
            <FiX size={12} /> Clear filters
          </button>
        </div>
      )}

      {/* ── Modals ── */}
      {showAddModal && <AddTradeModal onClose={() => setShowAddModal(false)} />}
      {editTrade && (
        <EditTradeModal trade={editTrade} onClose={() => setEditTrade(null)} />
      )}

      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title='⚠ Delete Trade Record'
      >
        <div className='space-y-6'>
          <p className='text-sm text-slate-400'>
            Are you sure you want to permanently delete this trade record? This
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
              onClick={async () => {
                if (deleteId) {
                  await deleteSoldTrade(deleteId);
                  setDeleteId(null);
                }
              }}
              className='rounded-xl bg-red-600/90 px-6 py-2.5 text-sm font-bold text-white hover:bg-red-600 transition-colors'
            >
              Yes, Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
