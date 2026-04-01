// src/pages/Cashflow/CashflowPage.tsx

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
  FiArrowDown,
  FiArrowUp,
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
import LendingDashboard from './LendingDashboard'; // NEW import for lending tab
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

type SortKey = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';
type TypeFilter = 'all' | 'income' | 'expense';

// ── Components ───────────────────────────────────────────────────────────
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
          className={`relative px-4 py-1.5 cursor-pointer text-xs font-bold rounded-lg transition-all duration-200 ${
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

function TypeFilterTabs({
  value,
  onChange,
  counts,
}: {
  value: TypeFilter;
  onChange: (v: TypeFilter) => void;
  counts: { all: number; income: number; expense: number };
}) {
  const tabs: { value: TypeFilter; label: string; color: string }[] = [
    { value: 'all', label: 'All', color: 'text-slate-400' },
    { value: 'income', label: 'Income', color: 'text-emerald-400' },
    { value: 'expense', label: 'Expense', color: 'text-rose-400' },
  ];
  return (
    <div className='flex items-center gap-1 rounded-xl bg-slate-800/60 p-1 border border-slate-700/60 overflow-x-auto no-scrollbar'>
      {tabs.map((t) => (
        <button
          key={t.value}
          type='button'
          onClick={() => onChange(t.value)}
          className={`flex items-center gap-1.5 px-3 py-1.5 cursor-pointer text-xs font-bold rounded-lg transition-all duration-200 whitespace-nowrap ${
            value === t.value
              ? 'bg-slate-700 text-slate-100 shadow-sm'
              : 'text-slate-500 hover:text-slate-200'
          }`}
        >
          <span className={value === t.value ? '' : t.color}>{t.label}</span>
          <span className='rounded-md bg-slate-600/60 px-1.5 py-0.5 text-[9px] font-bold text-slate-300'>
            {counts[t.value]}
          </span>
        </button>
      ))}
    </div>
  );
}

function CategoryFilterButton({
  value,
  onChange,
  categories,
}: {
  value: string;
  onChange: (v: string) => void;
  categories: string[];
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 208 });

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const panelW = 208;
    let left = r.left + window.scrollX;
    if (left + panelW > window.innerWidth)
      left = window.innerWidth - panelW - 16;
    setPos({
      top: r.bottom + 6 + window.scrollY,
      left: Math.max(8, left),
      width: panelW,
    });
  }, []);

  useEffect(() => {
    if (open) updatePos();
  }, [open, updatePos]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      document.removeEventListener('mousedown', handler);
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [open, updatePos]);

  return (
    <>
      <button
        ref={triggerRef}
        type='button'
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 rounded-xl cursor-pointer border px-3 py-2 text-xs font-bold transition-all ${
          open || value !== 'all'
            ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
            : 'border-slate-700 bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-slate-100'
        }`}
      >
        <FiFilter className='h-3 w-3 shrink-0' />
        <span className='max-w-[80px] sm:max-w-[120px] truncate'>
          {value === 'all' ? 'All Categories' : value}
        </span>
        <FiChevronDown
          className={`h-3 w-3 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
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
            className='max-h-64 overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 shadow-2xl'
          >
            <button
              type='button'
              onClick={() => {
                onChange('all');
                setOpen(false);
              }}
              className={`flex w-full items-center cursor-pointer justify-between px-4 py-3 text-xs font-semibold transition-colors ${value === 'all' ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}`}
            >
              All Categories
              {value === 'all' && <FiCheck className='h-3 w-3 shrink-0' />}
            </button>
            <div className='h-[1px] w-full bg-slate-800' />
            {categories.map((c) => (
              <button
                key={c}
                type='button'
                onClick={() => {
                  onChange(c);
                  setOpen(false);
                }}
                className={`flex w-full items-center cursor-pointer justify-between px-4 py-3 text-xs font-semibold transition-colors ${value === c ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}`}
              >
                <span className='truncate'>{c}</span>
                {value === c && <FiCheck className='shrink-0 h-3 w-3 ml-2' />}
              </button>
            ))}
            {categories.length === 0 && (
              <div className='px-4 py-3 text-xs text-slate-500 text-center italic'>
                No categories
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

function SortButton({
  value,
  onChange,
}: {
  value: SortKey;
  onChange: (v: SortKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 192 });

  const options: { value: SortKey; label: string; icon: React.ReactNode }[] = [
    {
      value: 'date-desc',
      label: 'Date: Newest first',
      icon: <FiArrowDown className='h-3 w-3' />,
    },
    {
      value: 'date-asc',
      label: 'Date: Oldest first',
      icon: <FiArrowUp className='h-3 w-3' />,
    },
    {
      value: 'amount-desc',
      label: 'Amount: High → Low',
      icon: <FiArrowDown className='h-3 w-3 text-emerald-400' />,
    },
    {
      value: 'amount-asc',
      label: 'Amount: Low → High',
      icon: <FiArrowUp className='h-3 w-3 text-rose-400' />,
    },
  ];

  const selected = options.find((o) => o.value === value)!;

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const panelW = 192;
    let left = r.right + window.scrollX - panelW;
    if (left < 8) left = 8;
    setPos({ top: r.bottom + 6 + window.scrollY, left: left, width: panelW });
  }, []);

  useEffect(() => {
    if (open) updatePos();
  }, [open, updatePos]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      document.removeEventListener('mousedown', handler);
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [open, updatePos]);

  return (
    <>
      <button
        ref={triggerRef}
        type='button'
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 rounded-xl cursor-pointer border px-3 py-2 text-xs font-bold transition-all ${open ? 'border-emerald-500/50 bg-slate-800 text-emerald-400' : 'border-slate-700 bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-slate-100'}`}
      >
        {selected.icon}
        <span className='hidden lg:inline'>{selected.label}</span>
        <span className='lg:hidden'>Sort</span>
        <FiChevronDown
          className={`h-3 w-3 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
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
            className='rounded-xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden'
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                type='button'
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-xs cursor-pointer font-semibold transition-colors ${value === opt.value ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}`}
              >
                {opt.icon}
                {opt.label}
                {value === opt.value && (
                  <FiCheck className='ml-auto h-3 w-3 shrink-0' />
                )}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

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
        className={`flex w-full items-center justify-between rounded-xl cursor-pointer border px-4 py-3 text-sm transition-all duration-300 ${open ? 'border-emerald-500/50 bg-slate-800 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'border-slate-800 bg-slate-900/40 hover:bg-slate-800/60'}`}
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
                  className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm cursor-pointer transition-all ${value === opt.key ? 'bg-emerald-500/10 text-emerald-400 font-semibold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-100'}`}
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

function CalendarPicker({
  value,
  onChange,
  label,
}: {
  value: string;
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
      <button
        ref={triggerRef}
        type='button'
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer text-sm font-medium transition-all duration-300 min-w-[160px] ${open ? 'border-emerald-500/50 bg-slate-800 shadow-[0_0_15px_rgba(16,185,129,0.1)] text-emerald-400' : 'border-slate-800 bg-slate-900/40 hover:bg-slate-800/60 text-slate-200'}`}
      >
        <FiCalendar
          className={`h-4 w-4 shrink-0 transition-colors ${open ? 'text-emerald-400' : 'text-slate-500'}`}
        />
        <span>{displayLabel}</span>
        <FiChevronDown
          className={`ml-auto h-3.5 w-3.5 transition-transform duration-300 text-slate-500 ${open ? 'rotate-180' : ''}`}
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
              zIndex: 9999,
              width: 280,
            }}
            className='rounded-xl border border-slate-700 bg-slate-900 shadow-2xl backdrop-blur-xl overflow-hidden'
          >
            <div className='flex items-center justify-between px-4 py-3 border-b border-slate-800'>
              <button
                type='button'
                onClick={() => setViewDate((d) => addMonths(d, -1))}
                className='flex h-7 w-7 items-center cursor-pointer justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors'
              >
                <FiChevronLeft className='h-4 w-4' />
              </button>
              <span className='text-sm font-bold text-slate-200'>
                {format(viewDate, 'MMMM yyyy')}
              </span>
              <button
                type='button'
                onClick={() => setViewDate((d) => addMonths(d, 1))}
                className='flex h-7 w-7 items-center cursor-pointer justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors'
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
                const isCurrentMonth = isSameMonth(day, viewDate);
                const isTodayDay = isToday(day);
                return (
                  <button
                    key={day.toISOString()}
                    type='button'
                    onClick={() => selectDay(day)}
                    className={`flex h-8 w-8 mx-auto items-center cursor-pointer justify-center rounded-lg text-xs font-medium transition-all ${isSelected ? 'bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-500/30' : isTodayDay ? 'border border-emerald-500/40 text-emerald-400' : isCurrentMonth ? 'text-slate-300 hover:bg-slate-800 hover:text-slate-100' : 'text-slate-600 hover:bg-slate-800/50'}`}
                  >
                    {format(day, 'd')}
                  </button>
                );
              })}
            </div>
            <div className='px-3 pb-3 flex justify-between gap-2 border-t border-slate-800 pt-2'>
              <button
                type='button'
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
                className='text-xs font-bold text-slate-500 cursor-pointer hover:text-slate-300 transition-colors px-2 py-1'
              >
                Clear
              </button>
              <button
                type='button'
                onClick={() => selectDay(new Date())}
                className='text-xs font-bold text-emerald-400 cursor-pointer hover:text-emerald-300 transition-colors px-2 py-1'
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

function SortableHeader({
  label,
  sortKey,
  currentSort,
  onSort,
  className = '',
}: {
  label: string;
  sortKey: 'date' | 'amount';
  currentSort: SortKey;
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const isActive = currentSort.startsWith(sortKey);
  const isDesc = currentSort === `${sortKey}-desc`;
  const toggle = () => {
    if (!isActive) onSort(`${sortKey}-desc` as SortKey);
    else onSort((isDesc ? `${sortKey}-asc` : `${sortKey}-desc`) as SortKey);
  };
  return (
    <th
      className={`px-5 py-4 text-xs font-bold uppercase tracking-wider cursor-pointer select-none group ${className}`}
      onClick={toggle}
    >
      <span
        className={`flex items-center gap-1.5 ${isActive ? 'text-emerald-400' : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-300'}`}
      >
        {label}
        <span className='flex flex-col gap-0.5'>
          <FiArrowUp
            className={`h-2.5 w-2.5 transition-opacity ${isActive && !isDesc ? 'opacity-100' : 'opacity-30'}`}
          />
          <FiArrowDown
            className={`h-2.5 w-2.5 transition-opacity ${isActive && isDesc ? 'opacity-100' : 'opacity-30'}`}
          />
        </span>
      </span>
    </th>
  );
}

// ─────────────────────────────────────────────────────────────────────────

export function CashflowPage() {
  const [activeTab, setActiveTab] = useState<'personal' | 'lending'>(
    'personal',
  );

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
  const [sortKey, setSortKey] = useState<SortKey>('date-desc');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Bulk Delete State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const handlePieClick = (data: any) => {
    if (data && data.name) {
      setCategoryFilter(data.name);
      document
        .getElementById('transactions-table-section')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const periodFilteredRows = useMemo(() => {
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
    return rows;
  }, [cashflows, filterMode, fy, customStart, customEnd]);

  const uniqueCategories = useMemo(() => {
    const cats = new Set<string>();
    periodFilteredRows.forEach((r) => {
      if (typeFilter === 'all' || r.type === typeFilter) cats.add(r.category);
    });
    return Array.from(cats).sort();
  }, [periodFilteredRows, typeFilter]);

  useEffect(() => {
    if (categoryFilter !== 'all' && !uniqueCategories.includes(categoryFilter))
      setCategoryFilter('all');
  }, [uniqueCategories, categoryFilter]);

  const typeCounts = useMemo(
    () => ({
      all: periodFilteredRows.length,
      income: periodFilteredRows.filter((r) => r.type === 'income').length,
      expense: periodFilteredRows.filter((r) => r.type === 'expense').length,
    }),
    [periodFilteredRows],
  );

  const filteredRows = useMemo(() => {
    let rows = [...periodFilteredRows];
    if (typeFilter !== 'all') rows = rows.filter((r) => r.type === typeFilter);
    if (categoryFilter !== 'all')
      rows = rows.filter((r) => r.category === categoryFilter);
    rows.sort((a, b) => {
      if (sortKey === 'date-desc') return b.date.localeCompare(a.date);
      if (sortKey === 'date-asc') return a.date.localeCompare(b.date);
      if (sortKey === 'amount-desc') return b.amount - a.amount;
      if (sortKey === 'amount-asc') return a.amount - b.amount;
      return 0;
    });
    return rows;
  }, [periodFilteredRows, typeFilter, categoryFilter, sortKey]);

  const summary = useMemo(() => {
    let income = 0,
      expense = 0;
    for (const r of periodFilteredRows) {
      if (r.type === 'income') income += r.amount;
      else expense += r.amount;
    }
    return { income, expense, savings: income - expense };
  }, [periodFilteredRows]);

  const incomeByCategory = useMemo(() => {
    const grouped: Record<string, number> = {};
    periodFilteredRows.forEach((r) => {
      if (r.type === 'income')
        grouped[r.category] = (grouped[r.category] || 0) + r.amount;
    });
    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [periodFilteredRows]);

  const expenseByCategory = useMemo(() => {
    const grouped: Record<string, number> = {};
    periodFilteredRows.forEach((r) => {
      if (r.type === 'expense')
        grouped[r.category] = (grouped[r.category] || 0) + r.amount;
    });
    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [periodFilteredRows]);

  const openDeleteModal = (id: string) => {
    setSelectedDeleteId(id);
    setDeleteOpen(true);
  };
  const confirmDelete = () => {
    if (selectedDeleteId) deleteCashflow(selectedDeleteId);
    setDeleteOpen(false);
    setSelectedDeleteId(null);
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked)
      setSelectedIds(new Set(filteredRows.map((r) => r.id)));
    else setSelectedIds(new Set());
  };

  const handleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const confirmBulkDelete = () => {
    selectedIds.forEach((id) => deleteCashflow(id));
    setSelectedIds(new Set());
    setBulkDeleteOpen(false);
  };

  if (!ready) return <CashflowSkeleton />;

  return (
    <div className='flex flex-col gap-6 pb-8'>
      {/* ── Tabs Top ── */}
      <div className='flex bg-slate-100 dark:bg-slate-800/60 p-1.5 rounded-2xl w-fit mb-2 border border-slate-200/60 dark:border-slate-700/60'>
        <button
          onClick={() => setActiveTab('personal')}
          className={`px-5 py-2 text-sm font-bold cursor-pointer rounded-xl transition-all duration-300 ${activeTab === 'personal' ? 'bg-white dark:bg-slate-700 text-emerald-500 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
        >
          Personal Cashflow
        </button>
        <button
          onClick={() => setActiveTab('lending')}
          className={`px-5 py-2 text-sm font-bold cursor-pointer rounded-xl transition-all duration-300 ${activeTab === 'lending' ? 'bg-white dark:bg-slate-700 text-indigo-500 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
        >
          Financier / Lending
        </button>
      </div>

      {activeTab === 'lending' ? (
        <LendingDashboard />
      ) : (
        <>
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
                className='group relative flex items-center gap-2 cursor-pointer overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-emerald-500/25 transition-all hover:-translate-y-0.5 hover:shadow-emerald-500/40'
                onClick={() => setOpen(true)}
                type='button'
              >
                <div className='absolute inset-0 bg-white/20 translate-y-full transition-transform group-hover:translate-y-0' />
                <FiPlus className='relative h-4 w-4' />
                <span className='relative cursor-pointer'>Add Entry</span>
              </button>
            </div>
          </header>

          {/* ── Period Filter Bar ────────────────────────────────────────── */}
          <div className='rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-white/60 dark:bg-slate-900/40 backdrop-blur-md shadow-sm'>
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
                    <span className='h-1.5 w-1.5 rounded-full bg-emerald-400' />
                    <span className='text-xs font-bold text-emerald-600 dark:text-emerald-400'>
                      {periodFilteredRows.length} transaction
                      {periodFilteredRows.length !== 1 ? 's' : ''}
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
                    <span className='h-1.5 w-1.5 rounded-full bg-emerald-400' />
                    <span className='text-xs font-bold text-emerald-600 dark:text-emerald-400'>
                      {periodFilteredRows.length} transaction
                      {periodFilteredRows.length !== 1 ? 's' : ''}
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
                      {periodFilteredRows.length} total
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Analytics Grid ────────────────────────────────────────────── */}
          <div className='grid grid-cols-1 lg:grid-cols-3 gap-5'>
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

            <div className='overflow-hidden rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-white/80 dark:bg-slate-900/50 p-5 shadow-sm backdrop-blur-md'>
              <div className='flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300 mb-4'>
                <div className='flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10'>
                  <FiPieChart className='h-3.5 w-3.5 text-emerald-500' />
                </div>{' '}
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
                        onClick={handlePieClick}
                        className='cursor-pointer outline-none'
                      >
                        {incomeByCategory.map((_, i) => (
                          <Cell
                            key={`cell-${i}`}
                            fill={INCOME_COLORS[i % INCOME_COLORS.length]}
                            className='hover:opacity-80 transition-opacity outline-none'
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

            <div className='overflow-hidden rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-white/80 dark:bg-slate-900/50 p-5 shadow-sm backdrop-blur-md'>
              <div className='flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300 mb-4'>
                <div className='flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/10'>
                  <FiPieChart className='h-3.5 w-3.5 text-rose-500' />
                </div>{' '}
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
                        onClick={handlePieClick}
                        className='cursor-pointer outline-none'
                      >
                        {expenseByCategory.map((_, i) => (
                          <Cell
                            key={`cell-${i}`}
                            fill={EXPENSE_COLORS[i % EXPENSE_COLORS.length]}
                            className='hover:opacity-80 transition-opacity outline-none'
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

          {/* ── Action bar for Bulk Delete ── */}
          {selectedIds.size > 0 && (
            <div className='flex justify-end mt-4'>
              <button
                onClick={() => setBulkDeleteOpen(true)}
                className='flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-sm cursor-pointer font-bold text-white transition-colors hover:bg-rose-700 shadow-sm'
              >
                <FiTrash2 className='h-4 w-4' /> Delete Selected (
                {selectedIds.size})
              </button>
            </div>
          )}

          {/* ── Data Table ─────────────────────────────────────────────── */}
          <div
            id='transactions-table-section'
            className='rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-white/80 dark:bg-slate-900/50 shadow-lg backdrop-blur-md scroll-mt-24 mt-4'
          >
            <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3 border-b border-slate-100 dark:border-slate-800/60'>
              <TypeFilterTabs
                value={typeFilter}
                onChange={setTypeFilter}
                counts={typeCounts}
              />
              <div className='flex flex-wrap items-center gap-2'>
                <CategoryFilterButton
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                  categories={uniqueCategories}
                />
                <span className='text-xs font-medium text-slate-500 hidden xl:inline ml-1'>
                  Sort by:
                </span>
                <SortButton value={sortKey} onChange={setSortKey} />
                <span className='text-xs text-slate-500 font-medium ml-1 hidden md:inline'>
                  {filteredRows.length} row
                  {filteredRows.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            <div className='hidden md:block overflow-x-auto rounded-b-2xl'>
              <table className='min-w-full text-left text-sm whitespace-nowrap'>
                <thead className='border-b border-slate-200/60 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-800/30'>
                  <tr>
                    <th className='px-5 py-4 w-12'>
                      <input
                        type='checkbox'
                        checked={
                          filteredRows.length > 0 &&
                          selectedIds.size === filteredRows.length
                        }
                        onChange={handleSelectAll}
                        className='h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600 dark:border-slate-600 dark:bg-slate-700 dark:ring-offset-slate-800'
                      />
                    </th>
                    <SortableHeader
                      label='Date'
                      sortKey='date'
                      currentSort={sortKey}
                      onSort={setSortKey}
                      className='px-5 py-4'
                    />
                    <th className='px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'>
                      Type
                    </th>
                    <th className='px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'>
                      Category
                    </th>
                    <th className='px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'>
                      Account
                    </th>
                    <th className='px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'>
                      Notes
                    </th>
                    <SortableHeader
                      label='Amount'
                      sortKey='amount'
                      currentSort={sortKey}
                      onSort={setSortKey}
                      className='px-5 py-4 text-right'
                    />
                    <th className='px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center'>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className='divide-y divide-slate-100/60 dark:divide-slate-800/60'>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className='px-5 py-14 text-center'>
                        <FiActivity className='h-10 w-10 mx-auto mb-3 text-slate-300 dark:text-slate-600' />
                        <p className='text-sm font-medium text-slate-400'>
                          No transactions found for the selected filters.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((e) => (
                      <tr
                        key={e.id}
                        className='group transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                      >
                        <td className='px-5 py-4'>
                          <input
                            type='checkbox'
                            checked={selectedIds.has(e.id)}
                            onChange={() => handleSelect(e.id)}
                            className='h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600 dark:border-slate-600 dark:bg-slate-700 dark:ring-offset-slate-800'
                          />
                        </td>
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
                              className='flex h-8 w-8 items-center justify-center rounded-lg cursor-pointer text-slate-400 transition-colors hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400'
                            >
                              <FiEdit2 className='h-4 w-4' />
                            </button>
                            <button
                              type='button'
                              onClick={() => openDeleteModal(e.id)}
                              className='flex h-8 w-8 items-center justify-center rounded-lg cursor-pointer text-slate-400 transition-colors hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400'
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

            <div className='block md:hidden'>
              {filteredRows.length === 0 ? (
                <div className='px-5 py-14 text-center'>
                  <FiActivity className='h-10 w-10 mx-auto mb-3 text-slate-300 dark:text-slate-600' />
                  <p className='text-sm font-medium text-slate-400'>
                    No transactions found for the selected filters.
                  </p>
                </div>
              ) : (
                <div className='flex flex-col gap-3 p-4'>
                  {filteredRows.map((e) => (
                    <div
                      key={e.id}
                      className='flex flex-col gap-3 rounded-xl border border-slate-200/60 dark:border-slate-700/60 bg-white/50 dark:bg-slate-800/40 p-4 shadow-sm'
                    >
                      <div className='flex justify-between items-start gap-2'>
                        <div className='flex items-start gap-3 flex-1 min-w-0'>
                          <input
                            type='checkbox'
                            checked={selectedIds.has(e.id)}
                            onChange={() => handleSelect(e.id)}
                            className='mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600 dark:border-slate-600 dark:bg-slate-700 dark:ring-offset-slate-800'
                          />
                          <div className='flex flex-col gap-1'>
                            <span className='text-xs font-semibold text-slate-500 dark:text-slate-400'>
                              {e.date}
                            </span>
                            <span className='text-base font-bold text-slate-900 dark:text-slate-50'>
                              {e.category}
                            </span>
                            <div className='flex flex-wrap items-center gap-2 mt-1'>
                              <span
                                className={
                                  e.type === 'income'
                                    ? 'inline-flex items-center rounded-full border border-emerald-200/60 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400'
                                    : 'inline-flex items-center rounded-full border border-rose-200/60 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-700 dark:text-rose-400'
                                }
                              >
                                {e.type}
                              </span>
                              {e.accountId && accountMap[e.accountId] && (
                                <span className='inline-flex items-center gap-1.5 rounded-lg border border-violet-200/60 dark:border-violet-500/20 bg-violet-50 dark:bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold text-violet-700 dark:text-violet-400'>
                                  {accountMap[e.accountId]}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className='flex flex-col items-end text-right'>
                          <span
                            className={`text-lg font-bold tabular-nums ${e.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-50'}`}
                          >
                            {e.type === 'income' ? '+' : '-'}
                            {formatINR(e.amount)}
                          </span>
                        </div>
                      </div>
                      {e.notes && (
                        <div className='text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800/60'>
                          {e.notes}
                        </div>
                      )}
                      <div className='flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700/50 mt-1'>
                        <button
                          type='button'
                          onClick={() => setEdit(e)}
                          className='flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs cursor-pointer font-bold text-slate-500 transition-colors hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400'
                        >
                          <FiEdit2 className='h-3.5 w-3.5' /> Edit
                        </button>
                        <button
                          type='button'
                          onClick={() => openDeleteModal(e.id)}
                          className='flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs cursor-pointer font-bold text-slate-500 transition-colors hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400'
                        >
                          <FiTrash2 className='h-3.5 w-3.5' /> Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
                  className='rounded-xl px-5 py-2.5 text-sm cursor-pointer font-bold text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className='rounded-xl bg-red-600 px-6 py-2.5 text-sm cursor-pointer font-bold text-white hover:bg-red-700'
                >
                  Yes, Delete
                </button>
              </div>
            </div>
          </Modal>

          <Modal
            open={bulkDeleteOpen}
            onClose={() => setBulkDeleteOpen(false)}
            title='⚠ Confirm Bulk Deletion'
          >
            <div className='space-y-6'>
              <p className='text-sm text-slate-400'>
                This will permanently delete {selectedIds.size} selected
                transactions.
              </p>
              <div className='flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800 pt-5'>
                <button
                  onClick={() => setBulkDeleteOpen(false)}
                  className='rounded-xl px-5 py-2.5 text-sm cursor-pointer font-bold text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                >
                  Cancel
                </button>
                <button
                  onClick={confirmBulkDelete}
                  className='rounded-xl bg-red-600 px-6 py-2.5 text-sm cursor-pointer font-bold text-white hover:bg-red-700'
                >
                  Yes, Delete {selectedIds.size} Records
                </button>
              </div>
            </div>
          </Modal>
        </>
      )}
    </div>
  );
}
