// src/pages/Cashflow/cashflowComponents.tsx
//
// Presentational pieces of the Cashflow page (audit Y1 — extracted verbatim
// from CashflowPage.tsx, behaviour unchanged): the recurring-detection banner,
// period/filter/sort controls, summary card, sortable table header, the
// palette arrays and the shared filter types. The page owns state; these are
// dumb props-in/JSX-out components.

import { useRef, useState } from 'react';
import {
  FiArrowDown,
  FiArrowUp,
  FiCheck,
  FiChevronDown,
  FiFilter,
} from 'react-icons/fi';

import { Popover } from '../../components/ui/Popover';
import { useRecurringDetection } from '../../hooks/useRecurringDetection';

/** Rows mounted at a time in the transactions list (see `rowWindow`). */
export const ROW_PAGE = 50;

export function RecurringBanner() {
  const candidates = useRecurringDetection();
  const [dismissed, setDismissed] = useState(false);
  if (!candidates.length || dismissed) return null;
  return (
    <div className='rounded-xl border border-violet-200 dark:border-violet-700/40 bg-violet-50 dark:bg-violet-900/10 px-4 py-3'>
      <div className='flex items-start justify-between gap-3'>
        <div className='flex items-center gap-2'>
          <span className='text-lg'>🔁</span>
          <div>
            <p className='text-sm font-bold text-violet-800 dark:text-violet-300'>
              {candidates.length} recurring transaction{candidates.length > 1 ? 's' : ''} detected
            </p>
            <p className='text-[11px] text-violet-600 dark:text-violet-400 mt-0.5'>
              These look like regular monthly entries. Consider converting them to payment reminders.
            </p>
          </div>
        </div>
        <button
          type='button'
          onClick={() => setDismissed(true)}
          className='text-violet-400 hover:text-violet-600 text-lg leading-none shrink-0'
        >
          ×
        </button>
      </div>
      <div className='mt-3 flex flex-wrap gap-2'>
        {candidates.slice(0, 5).map((c) => (
          <span
            key={`${c.type}_${c.category}`}
            className='flex items-center gap-1.5 rounded-full bg-violet-100 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-700/40 px-3 py-1 text-[11px] font-semibold text-violet-700 dark:text-violet-300'
          >
            <span className={`h-1.5 w-1.5 rounded-full ${c.type === 'income' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            {c.category}
            <span className='font-normal opacity-70'>×{c.occurrences}</span>
            {c.confidence === 'high' && <span className='text-amber-500'>★</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

export function getFYOptions() {
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
export const CASHFLOW_PERIOD_KEY = 'fintrackly-cashflow-period';
export type SavedCashflowPeriod = {
  filterMode: 'fy' | 'custom' | 'all';
  fy: string;
  customStart: string;
  customEnd: string;
};
export function loadSavedCashflowPeriod(): Partial<SavedCashflowPeriod> | null {
  try {
    const raw = localStorage.getItem(CASHFLOW_PERIOD_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<SavedCashflowPeriod>;
  } catch {
    return null;
  }
}
export const INCOME_COLORS = [
  '#10b981',
  '#3b82f6',
  '#06b6d4',
  '#8b5cf6',
  '#a855f7',
  '#6366f1',
  '#14b8a6',
  '#84cc16',
];
export const EXPENSE_COLORS = [
  '#f43f5e',
  '#f97316',
  '#f59e0b',
  '#eab308',
  '#ef4444',
  '#ec4899',
  '#d946ef',
  '#8b5cf6',
];
export type SortKey = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';
export type TypeFilter = 'all' | 'income' | 'expense';
// ── Components ───────────────────────────────────────────────────────────
export function SegmentedControl({
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
export function TypeFilterTabs({
  value,
  onChange,
  counts,
}: {
  value: TypeFilter;
  onChange: (v: TypeFilter) => void;
  counts: { all: number; income: number; expense: number };
}) {
  const tabs: { value: TypeFilter; label: string; color: string }[] = [
    { value: 'all', label: 'All', color: '' },
    { value: 'income', label: 'Income', color: 'text-emerald-500 dark:text-emerald-400' },
    { value: 'expense', label: 'Expense', color: 'text-rose-500 dark:text-rose-400' },
  ];
  return (
    <div className='flex items-center gap-1 rounded-xl border border-slate-200/70 bg-slate-100 p-1 dark:border-slate-700/60 dark:bg-slate-800/70 overflow-x-auto no-scrollbar'>
      {tabs.map((t) => (
        <button
          key={t.value}
          type='button'
          onClick={() => onChange(t.value)}
          aria-pressed={value === t.value}
          className={`fx-tab flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold ${
            value === t.value ? 'is-active' : ''
          }`}
        >
          <span className={value === t.value ? '' : t.color}>{t.label}</span>
          <span className='fx-chip rounded-md px-1.5 py-0.5 text-[9px] font-bold'>
            {counts[t.value]}
          </span>
        </button>
      ))}
    </div>
  );
}
/** Trigger + menu for a single-choice filter with per-option counts. */
export function FilterDropdown({
  value,
  onChange,
  options,
  counts,
  label,
  title,
  allLabel,
  width = 208,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  counts: Record<string, number>;
  label: string;
  title: string;
  allLabel: string;
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const active = value !== 'all';
  return (
    <>
      <button
        ref={triggerRef}
        type='button'
        onClick={() => setOpen((v) => !v)}
        aria-pressed={active}
        className={`fx-chip flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold dark:border-slate-700 ${
          active ? 'is-active' : ''
        }`}
      >
        <FiFilter className='h-3 w-3 shrink-0' />
        <span className='max-w-[90px] truncate sm:max-w-[140px]'>
          {active ? value : label}
        </span>
        {active && (
          <span className='shrink-0 tabular-nums opacity-80'>— {counts[value] ?? 0}</span>
        )}
        <FiChevronDown
          className={`h-3 w-3 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={triggerRef}
        width={width}
        minWidth={width}
        maxHeight={300}
        title={title}
      >
        <button
          type='button'
          onClick={() => {
            onChange('all');
            setOpen(false);
          }}
          className={`fx-menu-item flex w-full cursor-pointer items-center justify-between gap-2 px-4 py-3 text-xs font-semibold ${
            value === 'all' ? 'is-selected' : ''
          }`}
        >
          <span className='truncate'>{allLabel}</span>
          <span className='shrink-0 tabular-nums opacity-70'>{counts.all ?? 0}</span>
          {value === 'all' && <FiCheck className='h-3 w-3 shrink-0' />}
        </button>
        <div className='h-[1px] w-full bg-slate-200 dark:bg-slate-800' />
        {options.map((c) => (
          <button
            key={c}
            type='button'
            onClick={() => {
              onChange(c);
              setOpen(false);
            }}
            className={`fx-menu-item flex w-full cursor-pointer items-center justify-between gap-2 px-4 py-3 text-xs font-semibold ${
              value === c ? 'is-selected' : ''
            }`}
          >
            <span className='truncate'>{c}</span>
            <span className='shrink-0 tabular-nums opacity-70'>{counts[c] ?? 0}</span>
            {value === c && <FiCheck className='ml-1 h-3 w-3 shrink-0' />}
          </button>
        ))}
        {options.length === 0 && (
          <div className='px-4 py-3 text-center text-xs italic text-slate-500 dark:text-slate-400'>
            Nothing to filter yet
          </div>
        )}
      </Popover>
    </>
  );
}
/** Backwards-compatible wrapper — the category filter is one FilterDropdown. */
export function CategoryFilterButton({
  value,
  onChange,
  categories,
  counts,
}: {
  value: string;
  onChange: (v: string) => void;
  categories: string[];
  counts: Record<string, number>;
}) {
  return (
    <FilterDropdown
      value={value}
      onChange={onChange}
      options={categories}
      counts={counts}
      label='All Categories'
      allLabel='All Categories'
      title='Filter by category'
    />
  );
}
/** Subcategory filter — only rendered for categories that define subcategories. */
export function SubcategoryFilterButton({
  value,
  onChange,
  subcategories,
  counts,
  category,
}: {
  value: string;
  onChange: (v: string) => void;
  subcategories: string[];
  counts: Record<string, number>;
  category: string;
}) {
  return (
    <FilterDropdown
      value={value}
      onChange={onChange}
      options={subcategories}
      counts={counts}
      label='All Subcategories'
      allLabel='All Subcategories'
      title={`Filter by subcategory · ${category}`}
      width={220}
    />
  );
}
export function SortButton({
  value,
  onChange,
}: {
  value: SortKey;
  onChange: (v: SortKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
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
  return (
    <>
      <button
        ref={triggerRef}
        type='button'
        onClick={() => setOpen((v) => !v)}
        className={`fx-chip flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold dark:border-slate-700 ${
          open ? 'is-active' : ''
        }`}
      >
        {selected.icon}
        <span className='hidden lg:inline'>{selected.label}</span>
        <span className='lg:hidden'>Sort</span>
        <FiChevronDown
          className={`h-3 w-3 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={triggerRef}
        align='right'
        width={192}
        minWidth={192}
        maxHeight={240}
        title='Sort by'
      >
            {options.map((opt) => (
              <button
                key={opt.value}
                type='button'
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`fx-menu-item flex w-full cursor-pointer items-center gap-2.5 px-4 py-2.5 text-xs font-semibold ${
                  value === opt.value ? 'is-selected' : ''
                }`}
              >
                {opt.icon}
                {opt.label}
                {value === opt.value && (
                  <FiCheck className='ml-auto h-3 w-3 shrink-0' />
                )}
              </button>
            ))}
      </Popover>
    </>
  );
}
export function InvDropdown({
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
  const selected = options.find((o) => o.key === value);
  return (
    <>
      <button
        ref={triggerRef}
        type='button'
        onClick={() => setOpen((v) => !v)}
        className={`fx-control flex w-full cursor-pointer items-center justify-between rounded-xl border px-4 py-3 text-sm ${
          open ? 'is-active' : ''
        }`}
      >
        <div className='flex items-center gap-3'>
          <FiFilter className='h-3.5 w-3.5 shrink-0 opacity-70' />
          <span className='font-medium'>
            {selected?.label ?? label}
          </span>
        </div>
        <FiChevronDown
          className={`h-3.5 w-3.5 shrink-0 opacity-70 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={triggerRef}
        minWidth={180}
        maxHeight={300}
        title={label}
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
                  className={`fx-menu-item flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm ${
                    value === opt.key ? 'is-selected font-semibold' : ''
                  }`}
                >
                  <span>{opt.label}</span>
                  {value === opt.key && (
                    <FiCheck className='h-4 w-4 shrink-0' />
                  )}
                </button>
              ))}
            </div>
      </Popover>
    </>
  );
}
export function SummaryCard({
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
            <p className='mt-1 text-xs font-medium text-slate-400 dark:text-slate-400'>
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
export function SortableHeader({
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
        className={`flex items-center gap-1.5 text-slate-500 dark:text-slate-400 ${
          isActive
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'group-hover:text-slate-900 dark:group-hover:text-slate-100'
        }`}
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
