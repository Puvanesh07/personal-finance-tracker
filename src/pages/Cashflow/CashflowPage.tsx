import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import {
  FiActivity,
  FiCalendar,
  FiCheck,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiDollarSign,
  FiEdit2,
  FiFilter,
  FiPieChart,
  FiPlus,
  FiTrash2,
  FiTrendingDown,
  FiTrendingUp,
} from 'react-icons/fi';
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
  subMonths,
} from 'date-fns';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { CashflowEntry } from '../../types/investmentTypes';
import { CashflowSkeleton } from '../../components/loader/skeletons';
import { ImportDividendCsvButton } from '../../components/cashflow/ImportDividendCsvButton';
import { Modal } from '../../components/ui/Modal';
import { UpsertCashflowModal } from '../../components/cashflow/UpsertCashflowModal';
import { createPortal } from 'react-dom';
import { formatINR } from '../../utils/format';
import { usePortfolioStore } from '../../store/portfolioStore';

// ── Utilities ─────────────────────────────────────────────────────────────
function getFYOptions() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const latestStartYear = currentMonth < 3 ? currentYear - 1 : currentYear;
  return Array.from({ length: 5 }).map((_, i) => {
    const start = latestStartYear - i;
    return {
      key: `${start}-${start + 1}`,
      label: `FY ${start}–${(start + 1).toString().slice(2)}`,
    };
  });
}

// Separate color palettes for Income and Expense charts
const INCOME_COLORS = [
  '#10b981',
  '#3b82f6',
  '#06b6d4',
  '#8b5cf6',
  '#a855f7',
  '#6366f1',
  '#14b8a6',
  '#84cc16',
];
const EXPENSE_COLORS = [
  '#f43f5e',
  '#f97316',
  '#f59e0b',
  '#eab308',
  '#ef4444',
  '#ec4899',
  '#d946ef',
  '#8b5cf6',
];

// ── Segmented Control ──────────────────────────────────────────────────────
function SegmentedControl({
  value,
  onChange,
}: {
  value: 'fy' | 'custom' | 'all';
  onChange: (v: 'fy' | 'custom' | 'all') => void;
}) {
  const opts: { value: 'fy' | 'custom' | 'all'; label: string }[] = [
    { value: 'fy', label: 'Fin. Year' },
    { value: 'custom', label: 'Custom' },
    { value: 'all', label: 'All Time' },
  ];
  return (
    <div className='flex items-center gap-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 p-1 border border-slate-200/60 dark:border-slate-700/60'>
      {opts.map((o) => (
        <button
          key={o.value}
          type='button'
          onClick={() => onChange(o.value)}
          className={`relative px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 ${
            value === o.value
              ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── Portal Dropdown (FY selector) ─────────────────────────────────────────
function InvDropdown({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { key: string; label: string }[];
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.key === value);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

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
        className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm transition-all duration-300 ${
          open
            ? 'border-emerald-500/50 bg-slate-800 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
            : 'border-slate-800 bg-slate-900/40 hover:bg-slate-800/60'
        }`}
      >
        <div className='flex items-center gap-3'>
          <FiFilter
            className={`transition-colors ${open ? 'text-emerald-400' : 'text-slate-500'}`}
          />
          <span className='text-slate-200 font-medium'>
            {selected?.label ?? label}
          </span>
        </div>
        <FiChevronDown
          className={`transition-transform duration-300 text-slate-500 ${open ? 'rotate-180' : ''}`}
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
              zIndex: 9999,
            }}
            className='overflow-hidden rounded-xl border border-slate-800 bg-slate-900/95 shadow-2xl backdrop-blur-xl'
          >
            <div className='p-1.5 flex flex-col'>
              {options.map((opt) => (
                <button
                  key={opt.key}
                  type='button'
                  onClick={() => {
                    onChange(opt.key);
                    setOpen(false);
                  }}
                  className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-all ${
                    value === opt.key
                      ? 'bg-emerald-500/10 text-emerald-400 font-semibold'
                      : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-100'
                  }`}
                >
                  <span>{opt.label}</span>
                  {value === opt.key && (
                    <FiCheck className='h-4 w-4 shrink-0' />
                  )}
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

// ── Custom Calendar Picker (portalled) ────────────────────────────────────
function CalendarPicker({
  value,
  onChange,
  label,
}: {
  value: string; // yyyy-MM-dd
  onChange: (v: string) => void;
  label: string;
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

  const displayLabel = selectedDate
    ? format(selectedDate, 'dd MMM yyyy')
    : 'Pick a date';

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    // Prefer opening downward; if near bottom flip up
    const spaceBelow = window.innerHeight - r.bottom;
    const panelH = 320;
    const top =
      spaceBelow > panelH
        ? r.bottom + 8 + window.scrollY
        : r.top - panelH - 8 + window.scrollY;
    setPos({ top, left: r.left + window.scrollX });
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

  // Build calendar grid
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewDate), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(viewDate), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [viewDate]);

  const selectDay = (d: Date) => {
    onChange(format(d, 'yyyy-MM-dd'));
    setOpen(false);
  };

  return (
    <div className='flex flex-col gap-1'>
      <label className='text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1'>
        {label}
      </label>

      {/* Trigger */}
      <button
        ref={triggerRef}
        type='button'
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-all duration-300 min-w-[160px] ${
          open
            ? 'border-emerald-500/50 bg-slate-800 shadow-[0_0_15px_rgba(16,185,129,0.1)] text-emerald-400'
            : 'border-slate-800 bg-slate-900/40 hover:bg-slate-800/60 text-slate-200'
        }`}
      >
        <FiCalendar
          className={`h-4 w-4 shrink-0 transition-colors ${open ? 'text-emerald-400' : 'text-slate-500'}`}
        />
        <span>{displayLabel}</span>
        <FiChevronDown
          className={`ml-auto h-3.5 w-3.5 transition-transform duration-300 text-slate-500 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Calendar panel portalled to body */}
      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: 'absolute',
              top: pos.top,
              left: pos.left,
              zIndex: 9999,
              width: 280,
            }}
            className='rounded-xl border border-slate-700 bg-slate-900 shadow-2xl backdrop-blur-xl overflow-hidden'
          >
            {/* Month nav */}
            <div className='flex items-center justify-between px-4 py-3 border-b border-slate-800'>
              <button
                type='button'
                onClick={() => setViewDate((d) => addMonths(d, -1))}
                className='flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors'
              >
                <FiChevronLeft className='h-4 w-4' />
              </button>
              <span className='text-sm font-bold text-slate-200'>
                {format(viewDate, 'MMMM yyyy')}
              </span>
              <button
                type='button'
                onClick={() => setViewDate((d) => addMonths(d, 1))}
                className='flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors'
              >
                <FiChevronRight className='h-4 w-4' />
              </button>
            </div>

            {/* Day-of-week headers */}
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

            {/* Days grid */}
            <div className='grid grid-cols-7 px-3 pb-3 gap-y-0.5'>
              {days.map((day) => {
                const isSelected = selectedDate
                  ? isSameDay(day, selectedDate)
                  : false;
                const isCurrentMonth = isSameMonth(day, viewDate);
                const isTodayDay = isToday(day);
                return (
                  <button
                    key={day.toISOString()}
                    type='button'
                    onClick={() => selectDay(day)}
                    className={`
                    flex h-8 w-8 mx-auto items-center justify-center rounded-lg text-xs font-medium transition-all
                    ${
                      isSelected
                        ? 'bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-500/30'
                        : isTodayDay
                          ? 'border border-emerald-500/40 text-emerald-400'
                          : isCurrentMonth
                            ? 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'
                            : 'text-slate-600 hover:bg-slate-800/50'
                    }
                  `}
                  >
                    {format(day, 'd')}
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div className='px-3 pb-3 flex justify-between gap-2 border-t border-slate-800 pt-2'>
              <button
                type='button'
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
                className='text-xs font-bold text-slate-500 hover:text-slate-300 transition-colors px-2 py-1'
              >
                Clear
              </button>
              <button
                type='button'
                onClick={() => {
                  selectDay(new Date());
                }}
                className='text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors px-2 py-1'
              >
                Today
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

// ── Summary Card ──────────────────────────────────────────────────────────
function SummaryCard({
  label,
  value,
  sub,
  icon,
  colorClass,
  borderColor,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  colorClass: string;
  borderColor: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border bg-white/80 p-5 shadow-sm backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-900/50 ${borderColor}`}
    >
      <div className='flex items-start justify-between'>
        <div>
          <p className='text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'>
            {label}
          </p>
          <p
            className={`mt-2 text-2xl font-bold tabular-nums tracking-tight ${colorClass}`}
          >
            {value}
          </p>
          {sub && (
            <p className='mt-1 text-xs font-medium text-slate-400 dark:text-slate-500'>
              {sub}
            </p>
          )}
        </div>
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${colorClass.replace('text-', 'bg-').replace('600', '100').replace('400', '500/10')} dark:bg-opacity-10`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────

export function CashflowPage() {
  const ready = usePortfolioStore((s) => s.ready);
  const cashflows = usePortfolioStore((s) => s.cashflows);
  const deleteCashflow = usePortfolioStore((s) => s.deleteCashflow);
  const accounts = usePortfolioStore((s) => s.accounts);

  const accountMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const a of accounts) m[a.id] = a.name;
    return m;
  }, [accounts]);

  const [filterMode, setFilterMode] = useState<'fy' | 'custom' | 'all'>('fy');
  const [fy, setFy] = useState(() => getFYOptions()[0].key);
  const [customStart, setCustomStart] = useState(() =>
    format(subMonths(new Date(), 6), 'yyyy-MM-dd'),
  );
  const [customEnd, setCustomEnd] = useState(() =>
    format(new Date(), 'yyyy-MM-dd'),
  );
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<CashflowEntry | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedDeleteId, setSelectedDeleteId] = useState<string | null>(null);

  const filteredRows = useMemo(() => {
    let rows = [...cashflows];
    if (filterMode === 'fy') {
      const [startYear, endYear] = fy.split('-');
      rows = rows.filter(
        (e) => e.date >= `${startYear}-04-01` && e.date <= `${endYear}-03-31`,
      );
    } else if (filterMode === 'custom') {
      if (customStart) rows = rows.filter((e) => e.date >= customStart);
      if (customEnd) rows = rows.filter((e) => e.date <= customEnd);
    }
    return rows.sort((a, b) => b.date.localeCompare(a.date));
  }, [cashflows, filterMode, fy, customStart, customEnd]);

  const summary = useMemo(() => {
    let income = 0,
      expense = 0;
    for (const r of filteredRows) {
      if (r.type === 'income') income += r.amount;
      else expense += r.amount;
    }
    return { income, expense, savings: income - expense };
  }, [filteredRows]);

  // --- Grouped Data for Charts ---
  const incomeByCategory = useMemo(() => {
    const grouped: Record<string, number> = {};
    filteredRows.forEach((r) => {
      if (r.type === 'income')
        grouped[r.category] = (grouped[r.category] || 0) + r.amount;
    });
    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredRows]);

  const expenseByCategory = useMemo(() => {
    const grouped: Record<string, number> = {};
    filteredRows.forEach((r) => {
      if (r.type === 'expense')
        grouped[r.category] = (grouped[r.category] || 0) + r.amount;
    });
    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredRows]);

  const openDeleteModal = (id: string) => {
    setSelectedDeleteId(id);
    setDeleteOpen(true);
  };
  const confirmDelete = () => {
    if (selectedDeleteId) deleteCashflow(selectedDeleteId);
    setDeleteOpen(false);
    setSelectedDeleteId(null);
  };

  if (!ready) {
    return <CashflowSkeleton />;
  }

  return (
    <div className='flex flex-col gap-6 pb-8'>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className='flex flex-col lg:flex-row lg:items-center justify-between gap-6 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent p-6 border border-emerald-500/20 dark:from-emerald-500/20 dark:via-teal-500/10 dark:border-emerald-500/30 shadow-sm'>
        <div className='flex items-center gap-4'>
          <div className='flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-500/30'>
            <FiActivity className='h-6 w-6' />
          </div>
          <div>
            <h1 className='text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white'>
              Cashflow
            </h1>
            <p className='mt-1 text-sm font-medium text-slate-600 dark:text-slate-300'>
              Track your income sources and expenses over time.
            </p>
          </div>
        </div>
        <div className='flex flex-wrap items-center gap-3'>
          <ImportDividendCsvButton />
          <button
            className='group relative flex items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-emerald-500/25 transition-all hover:-translate-y-0.5 hover:shadow-emerald-500/40'
            onClick={() => setOpen(true)}
            type='button'
          >
            <div className='absolute inset-0 bg-white/20 translate-y-full transition-transform group-hover:translate-y-0' />
            <FiPlus className='relative h-4 w-4' />
            <span className='relative'>Add Entry</span>
          </button>
        </div>
      </header>

      {/* ── Filter Bar ─────────────────────────────────────────────── */}
      <div className='rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-white/60 dark:bg-slate-900/40 backdrop-blur-md shadow-sm'>
        {/* Top row */}
        <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-100 dark:border-slate-800/60 rounded-t-2xl'>
          <div className='flex items-center gap-2'>
            <div className='flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 dark:bg-emerald-500/15'>
              <FiFilter className='h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400' />
            </div>
            <span className='text-sm font-bold text-slate-700 dark:text-slate-200'>
              Filter Period
            </span>
          </div>
          <SegmentedControl value={filterMode} onChange={setFilterMode} />
        </div>

        {/* Bottom row */}
        <div className='px-5 py-4 flex flex-wrap items-end gap-3 min-h-[76px]'>
          {filterMode === 'fy' && (
            <>
              <div className='flex flex-col gap-1 min-w-[200px]'>
                <label className='text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1'>
                  Financial Year
                </label>
                <InvDropdown
                  value={fy}
                  onChange={setFy}
                  options={getFYOptions()}
                  label='Select year'
                />
              </div>
              <div className='ml-auto flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10 px-4 py-2.5 self-end'>
                <span className='h-1.5 w-1.5 rounded-full bg-emerald-400 ' />
                <span className='text-xs font-bold text-emerald-600 dark:text-emerald-400'>
                  {filteredRows.length} transaction
                  {filteredRows.length !== 1 ? 's' : ''}
                </span>
              </div>
            </>
          )}

          {filterMode === 'custom' && (
            <>
              <CalendarPicker
                value={customStart}
                onChange={setCustomStart}
                label='From'
              />
              <div className='self-end pb-3'>
                <span className='text-sm font-bold text-slate-500 select-none'>
                  →
                </span>
              </div>
              <CalendarPicker
                value={customEnd}
                onChange={setCustomEnd}
                label='To'
              />
              <div className='ml-auto flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10 px-4 py-2.5 self-end'>
                <span className='h-1.5 w-1.5 rounded-full bg-emerald-400 ' />
                <span className='text-xs font-bold text-emerald-600 dark:text-emerald-400'>
                  {filteredRows.length} transaction
                  {filteredRows.length !== 1 ? 's' : ''}
                </span>
              </div>
            </>
          )}

          {filterMode === 'all' && (
            <div className='flex items-center gap-3'>
              <span className='text-sm font-medium text-slate-400 dark:text-slate-500'>
                Showing all transactions
              </span>
              <div className='flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10 px-4 py-2'>
                <span className='h-1.5 w-1.5 rounded-full bg-emerald-400' />
                <span className='text-xs font-bold text-emerald-600 dark:text-emerald-400'>
                  {filteredRows.length} total
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Analytics Grid (3 Columns) ─────────────────────────────────────────── */}
      <div className='grid grid-cols-1 lg:grid-cols-3 gap-5'>
        {/* Column 1: Summary Cards */}
        <div className='flex flex-col gap-4'>
          <SummaryCard
            label='Total Income'
            value={formatINR(summary.income)}
            icon={
              <FiTrendingUp className='h-5 w-5 text-emerald-600 dark:text-emerald-400' />
            }
            colorClass='text-emerald-600 dark:text-emerald-400'
            borderColor='border-emerald-200/60 dark:border-emerald-500/20'
          />
          <SummaryCard
            label='Total Expenses'
            value={formatINR(summary.expense)}
            icon={
              <FiTrendingDown className='h-5 w-5 text-rose-600 dark:text-rose-400' />
            }
            colorClass='text-rose-600 dark:text-rose-400'
            borderColor='border-rose-200/60 dark:border-rose-500/20'
          />
          <SummaryCard
            label='Net Savings'
            value={formatINR(summary.savings)}
            sub={
              summary.income > 0
                ? `${Math.round((summary.savings / summary.income) * 100)}% savings rate`
                : undefined
            }
            icon={
              <FiDollarSign className='h-5 w-5 text-slate-600 dark:text-slate-300' />
            }
            colorClass='text-slate-900 dark:text-slate-50'
            borderColor='border-slate-200/60 dark:border-slate-700/60'
          />
        </div>

        {/* Column 2: Income Breakdown */}
        <div className='overflow-hidden rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-white/80 dark:bg-slate-900/50 p-5 shadow-sm backdrop-blur-md'>
          <div className='flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300 mb-4'>
            <div className='flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10'>
              <FiPieChart className='h-3.5 w-3.5 text-emerald-500' />
            </div>
            Income Breakdown
          </div>
          {incomeByCategory.length > 0 ? (
            <div className='h-[250px] w-full'>
              <ResponsiveContainer width='100%' height='100%'>
                <PieChart>
                  <Pie
                    data={incomeByCategory}
                    dataKey='value'
                    nameKey='name'
                    cx='50%'
                    cy='50%'
                    innerRadius={65}
                    outerRadius={95}
                    paddingAngle={3}
                  >
                    {incomeByCategory.map((_, i) => (
                      <Cell
                        key={`cell-${i}`}
                        fill={INCOME_COLORS[i % INCOME_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => formatINR(val as number)}
                    contentStyle={{
                      borderRadius: '12px',
                      border: 'none',
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
                      backgroundColor: 'rgba(15,23,42,0.95)',
                      color: '#f1f5f9',
                    }}
                  />
                  <Legend
                    verticalAlign='bottom'
                    height={36}
                    iconType='circle'
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className='flex h-[250px] flex-col items-center justify-center text-slate-400'>
              <FiPieChart className='h-10 w-10 mb-2 opacity-20' />
              <p className='text-sm font-medium'>No income data.</p>
            </div>
          )}
        </div>

        {/* Column 3: Expense Breakdown */}
        <div className='overflow-hidden rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-white/80 dark:bg-slate-900/50 p-5 shadow-sm backdrop-blur-md'>
          <div className='flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300 mb-4'>
            <div className='flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/10'>
              <FiPieChart className='h-3.5 w-3.5 text-rose-500' />
            </div>
            Expense Breakdown
          </div>
          {expenseByCategory.length > 0 ? (
            <div className='h-[250px] w-full'>
              <ResponsiveContainer width='100%' height='100%'>
                <PieChart>
                  <Pie
                    data={expenseByCategory}
                    dataKey='value'
                    nameKey='name'
                    cx='50%'
                    cy='50%'
                    innerRadius={65}
                    outerRadius={95}
                    paddingAngle={3}
                  >
                    {expenseByCategory.map((_, i) => (
                      <Cell
                        key={`cell-${i}`}
                        fill={EXPENSE_COLORS[i % EXPENSE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => formatINR(val as number)}
                    contentStyle={{
                      borderRadius: '12px',
                      border: 'none',
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
                      backgroundColor: 'rgba(15,23,42,0.95)',
                      color: '#f1f5f9',
                    }}
                  />
                  <Legend
                    verticalAlign='bottom'
                    height={36}
                    iconType='circle'
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className='flex h-[250px] flex-col items-center justify-center text-slate-400'>
              <FiPieChart className='h-10 w-10 mb-2 opacity-20' />
              <p className='text-sm font-medium'>No expense data.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Data Table ─────────────────────────────────────────────── */}
      <div className='overflow-hidden rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-white/80 dark:bg-slate-900/50 shadow-lg backdrop-blur-md'>
        <div className='overflow-x-auto'>
          <table className='min-w-full text-left text-sm whitespace-nowrap'>
            <thead className='border-b border-slate-200/60 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-800/30'>
              <tr>
                {[
                  'Date',
                  'Type',
                  'Category',
                  'Account',
                  'Notes',
                  'Amount',
                  'Actions',
                ].map((h, i) => (
                  <th
                    key={h}
                    className={`px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 ${i === 5 ? 'text-right' : i === 6 ? 'text-center' : ''}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className='divide-y divide-slate-100/60 dark:divide-slate-800/60'>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className='px-5 py-14 text-center'>
                    <FiActivity className='h-10 w-10 mx-auto mb-3 text-slate-300 dark:text-slate-600' />
                    <p className='text-sm font-medium text-slate-400'>
                      No transactions found for the selected period.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredRows.map((e) => (
                  <tr
                    key={e.id}
                    className='group transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                  >
                    <td className='px-5 py-4 font-medium text-slate-600 dark:text-slate-300'>
                      {e.date}
                    </td>
                    <td className='px-5 py-4'>
                      <span
                        className={
                          e.type === 'income'
                            ? 'inline-flex items-center rounded-full border border-emerald-200/60 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400'
                            : 'inline-flex items-center rounded-full border border-rose-200/60 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-700 dark:text-rose-400'
                        }
                      >
                        {e.type}
                      </span>
                    </td>
                    <td className='px-5 py-4 font-bold text-slate-900 dark:text-slate-50'>
                      {e.category}
                    </td>
                    <td className='px-5 py-4 text-slate-500 dark:text-slate-400'>
                      {e.accountId && accountMap[e.accountId] ? (
                        <span className='inline-flex items-center gap-1.5 rounded-lg border border-violet-200/60 dark:border-violet-500/20 bg-violet-50 dark:bg-violet-500/10 px-2.5 py-0.5 text-[10px] font-bold text-violet-700 dark:text-violet-400'>
                          {accountMap[e.accountId]}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className='px-5 py-4 max-w-xs truncate text-slate-500 dark:text-slate-400'>
                      {e.notes ?? '—'}
                    </td>
                    <td
                      className={`px-5 py-4 text-right font-bold tabular-nums ${e.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-50'}`}
                    >
                      {e.type === 'income' ? '+' : '-'}
                      {formatINR(e.amount)}
                    </td>
                    <td className='px-5 py-4'>
                      <div className='flex justify-center gap-2'>
                        <button
                          type='button'
                          onClick={() => setEdit(e)}
                          className='flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400'
                        >
                          <FiEdit2 className='h-4 w-4' />
                        </button>
                        <button
                          type='button'
                          onClick={() => openDeleteModal(e.id)}
                          className='flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400'
                        >
                          <FiTrash2 className='h-4 w-4' />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modals ─────────────────────────────────────────────────── */}
      <UpsertCashflowModal
        open={open}
        onClose={() => setOpen(false)}
        mode='create'
      />
      {edit && (
        <UpsertCashflowModal
          open={!!edit}
          onClose={() => setEdit(null)}
          mode='edit'
          entry={edit}
        />
      )}

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title='⚠ Confirm Deletion'
      >
        <div className='space-y-6'>
          <p className='text-sm text-slate-400'>
            This will permanently delete the transaction.
          </p>
          <div className='flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800 pt-5'>
            <button
              onClick={() => setDeleteOpen(false)}
              className='rounded-xl px-5 py-2.5 text-sm font-bold text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            >
              Cancel
            </button>
            <button
              onClick={confirmDelete}
              className='rounded-xl bg-red-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-red-700'
            >
              Yes, Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
