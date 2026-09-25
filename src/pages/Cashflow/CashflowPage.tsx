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
  FiDollarSign,
  FiDownload,
  FiEdit2,
  FiFilter,
  FiPieChart,
  FiPlus,
  FiTrash2,
  FiTrendingDown,
  FiTrendingUp,
  FiUpload,
  FiX,
} from 'react-icons/fi';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import {
  ensureCsvExtension,
  expandExportFilenamePattern,
} from '../../utils/exportFilename';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { AccountsPage } from '../Accounts/AccountsPage';
import BudgetPage from '../Budget/BudgetPage';
import InsightsPage from '../Insights/InsightsPage';

import { AsyncButton } from '../../components/ui/AsyncButton';
import type { CashflowEntry } from '../../types/investmentTypes';
import { CashflowSkeleton } from '../../components/loader/skeletons';
import { ImportCashflowModal } from '../../components/cashflow/ImportCashflowModal';
import { Modal } from '../../components/ui/Modal';
import { CalendarPicker } from '../../components/ui/CalendarPicker';
import { SavedViewsMenu } from '../../components/ui/SavedViewsMenu';
import { UpsertCashflowModal } from '../../components/cashflow/UpsertCashflowModal';
import { buildCashflowAdvancedInsights } from '../../utils/advancedInsights';
import { Popover } from '../../components/ui/Popover';
import { getSubcategoryOptions, subcategoryIcon } from '../../utils/cashflowCategories';
import { exportCashflowsCSV } from '../../utils/exportUtils';
import { formatINR } from '../../utils/format';
import { useAsyncAction } from '../../hooks/useAsyncAction';
import { useExportPresetsStore } from '../../store/exportPresetsStore';
import { usePortfolioStore } from '../../store/portfolioStore';
import { FeatureInfo } from '../../components/ui/FeatureInfo';
import { usePremiumActions } from '../../hooks/usePremiumActions';

import { useRecurringDetection } from '../../hooks/useRecurringDetection';

// ── Recurring detection banner ─────────────────────────────────────────────

function RecurringBanner() {
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

const CASHFLOW_PERIOD_KEY = 'fintrackly-cashflow-period';

type SavedCashflowPeriod = {
  filterMode: 'fy' | 'custom' | 'all';
  fy: string;
  customStart: string;
  customEnd: string;
};

function loadSavedCashflowPeriod(): Partial<SavedCashflowPeriod> | null {
  try {
    const raw = localStorage.getItem(CASHFLOW_PERIOD_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<SavedCashflowPeriod>;
  } catch {
    return null;
  }
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
function FilterDropdown({
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
function CategoryFilterButton({
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
function SubcategoryFilterButton({
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

function SortButton({
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

// ─────────────────────────────────────────────────────────────────────────

type ShellTab = 'cashflow' | 'accounts' | 'budget' | 'insights';

export function CashflowPage() {
  const { premiumActionProps } = usePremiumActions();

  // ── Tab shell: Cashflow | Accounts | Budget | Insights ──────────────────
  // All four tabs share the same store/data — no duplicate sources or logic.
  const [searchParams, setSearchParams] = useSearchParams();
  const mapShellTab = (v: string | null): ShellTab =>
    v === 'accounts'
      ? 'accounts'
      : v === 'budget'
        ? 'budget'
        : v === 'insights' || v === 'dna' || v === 'overview'
          ? 'insights'
          : 'cashflow';
  const [shellTab, setShellTab] = useState<ShellTab>(() =>
    mapShellTab(searchParams.get('tab')),
  );
  useEffect(() => {
    setShellTab(mapShellTab(searchParams.get('tab')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  const switchShellTab = (next: ShellTab) => {
    setShellTab(next);
    setSearchParams(next === 'cashflow' ? {} : { tab: next }, { replace: true });
  };
  const shellTabCls = (id: ShellTab) =>
    `cursor-pointer border-b-2 px-4 py-2.5 text-sm font-bold transition-colors ${
      shellTab === id
        ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
        : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
    }`;
  const shellTabs = (
    <div className='flex gap-2 overflow-x-auto no-scrollbar border-b border-slate-200 dark:border-slate-800'>
      <button type='button' className={shellTabCls('cashflow')} onClick={() => switchShellTab('cashflow')}>
        Cashflow
      </button>
      <button type='button' className={shellTabCls('accounts')} onClick={() => switchShellTab('accounts')}>
        Accounts
      </button>
      <button type='button' className={shellTabCls('budget')} onClick={() => switchShellTab('budget')}>
        Budget
      </button>
      <button type='button' className={shellTabCls('insights')} onClick={() => switchShellTab('insights')}>
        Insights
      </button>
    </div>
  );

  const ready = usePortfolioStore((s) => s.ready);
  const cashflows = usePortfolioStore((s) => s.cashflows);
  const deleteCashflow = usePortfolioStore((s) => s.deleteCashflow);
  const deleteCashflows = usePortfolioStore((s) => s.deleteCashflows);
  const accounts = usePortfolioStore((s) => s.accounts);
  const customSubcategories = usePortfolioStore((s) => s.customSubcategories);
  const { busy: deleteBusy, run: runDelete } = useAsyncAction();

  const accountMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const a of accounts) m[a.id] = a.name;
    return m;
  }, [accounts]);

  const [filterMode, setFilterMode] = useState<'fy' | 'custom' | 'all'>(() => {
    const saved = loadSavedCashflowPeriod()?.filterMode;
    if (saved === 'fy' || saved === 'custom' || saved === 'all') return saved;
    return 'custom';
  });
  const [fy, setFy] = useState(() => {
    const opts = getFYOptions();
    const saved = loadSavedCashflowPeriod()?.fy;
    if (saved && opts.some((o) => o.key === saved)) return saved;
    return opts[0].key;
  });
  const [customStart, setCustomStart] = useState(() => {
    const saved = loadSavedCashflowPeriod()?.customStart;
    if (saved) return saved;
    return format(startOfMonth(new Date()), 'yyyy-MM-dd');
  });
  const [customEnd, setCustomEnd] = useState(() => {
    const saved = loadSavedCashflowPeriod()?.customEnd;
    if (saved) return saved;
    return format(endOfMonth(new Date()), 'yyyy-MM-dd');
  });
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [edit, setEdit] = useState<CashflowEntry | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedDeleteId, setSelectedDeleteId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('date-desc');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [subcategoryFilter, setSubcategoryFilter] = useState<string>('all');

  // Bulk Delete State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  useEffect(() => {
    const payload: SavedCashflowPeriod = {
      filterMode,
      fy,
      customStart,
      customEnd,
    };
    try {
      localStorage.setItem(CASHFLOW_PERIOD_KEY, JSON.stringify(payload));
    } catch {
      /* ignore quota */
    }
  }, [filterMode, fy, customStart, customEnd]);

  const handlePieClick = (data: any) => {
    if (data && data.name) {
      // The pies break down by subcategory while a single category is
      // filtered, so a slice click drills one level deeper when it can.
      const matching = periodFilteredRows.find(
        (r) =>
          categoryFilter !== 'all' &&
          r.category === categoryFilter &&
          (r.subcategory || r.category) === data.name,
      );
      if (matching?.subcategory) setSubcategoryFilter(matching.subcategory);
      else {
        setCategoryFilter(data.name);
        setSubcategoryFilter('all');
      }
      document
        .getElementById('transactions-table-section')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  /** Choosing a category always re-opens the subcategory scope. */
  const handleCategoryChange = (v: string) => {
    setCategoryFilter(v);
    setSubcategoryFilter('all');
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
    if (categoryFilter !== 'all' && !uniqueCategories.includes(categoryFilter)) {
      setCategoryFilter('all');
      setSubcategoryFilter('all');
    }
  }, [uniqueCategories, categoryFilter]);

  // Every filter feeds the one pipeline: period → category → subcategory →
  // type, so the list, totals, charts, cards and the counts can never drift
  // apart, and clearing a filter restores the full picture.
  const categoryScopedRows = useMemo(() => {
    let rows = periodFilteredRows;
    if (categoryFilter !== 'all')
      rows = rows.filter((r) => r.category === categoryFilter);
    if (subcategoryFilter !== 'all')
      rows = rows.filter((r) => (r.subcategory ?? '') === subcategoryFilter);
    return rows;
  }, [periodFilteredRows, categoryFilter, subcategoryFilter]);

  const typeScopedRows = useMemo(
    () =>
      typeFilter === 'all'
        ? categoryScopedRows
        : categoryScopedRows.filter((r) => r.type === typeFilter),
    [categoryScopedRows, typeFilter],
  );

  /** All / Income / Expense counts always describe the active
   *  category + subcategory scope ("Agriculture · Drumstick — All 6"). */
  const typeCounts = useMemo(
    () => ({
      all: categoryScopedRows.length,
      income: categoryScopedRows.filter((r) => r.type === 'income').length,
      expense: categoryScopedRows.filter((r) => r.type === 'expense').length,
    }),
    [categoryScopedRows],
  );

  const categoryCounts = useMemo(() => {
    const m: Record<string, number> = {};
    periodFilteredRows.forEach((r) => {
      if (typeFilter !== 'all' && r.type !== typeFilter) return;
      m[r.category] = (m[r.category] ?? 0) + 1;
    });
    m.all = Object.values(m).reduce((a, b) => a + b, 0);
    return m;
  }, [periodFilteredRows, typeFilter]);

  /** Defined subcategories first, then anything already recorded, so a
   *  hand-typed or imported value is never invisible to the filter. */
  const subcategoryOptions = useMemo(() => {
    if (categoryFilter === 'all') return [];
    const defined = getSubcategoryOptions(categoryFilter, customSubcategories).map(
      (s) => s.key,
    );
    const recorded = Array.from(
      new Set(
        periodFilteredRows
          .filter((r) => r.category === categoryFilter && r.subcategory)
          .map((r) => r.subcategory as string),
      ),
    );
    return Array.from(new Set([...defined, ...recorded]));
  }, [categoryFilter, customSubcategories, periodFilteredRows]);

  useEffect(() => {
    if (
      subcategoryFilter !== 'all' &&
      !subcategoryOptions.includes(subcategoryFilter)
    )
      setSubcategoryFilter('all');
  }, [subcategoryOptions, subcategoryFilter]);

  const subcategoryCounts = useMemo(() => {
    let rows = periodFilteredRows.filter(
      (r) => categoryFilter === 'all' || r.category === categoryFilter,
    );
    if (typeFilter !== 'all') rows = rows.filter((r) => r.type === typeFilter);
    const m: Record<string, number> = { all: rows.length };
    rows.forEach((r) => {
      if (!r.subcategory) return;
      m[r.subcategory] = (m[r.subcategory] ?? 0) + 1;
    });
    return m;
  }, [periodFilteredRows, categoryFilter, typeFilter]);

  const filtersActive =
    typeFilter !== 'all' || categoryFilter !== 'all' || subcategoryFilter !== 'all';

  const clearFilters = () => {
    setTypeFilter('all');
    setCategoryFilter('all');
    setSubcategoryFilter('all');
  };

  const filteredRows = useMemo(() => {
    const rows = [...typeScopedRows];
    rows.sort((a, b) => {
      if (sortKey === 'date-desc') return b.date.localeCompare(a.date);
      if (sortKey === 'date-asc') return a.date.localeCompare(b.date);
      if (sortKey === 'amount-desc') return b.amount - a.amount;
      if (sortKey === 'amount-asc') return a.amount - b.amount;
      return 0;
    });
    return rows;
  }, [typeScopedRows, sortKey]);

  // SUMMARY LOGIC: every visible stat follows the FULL filter (period +
  // type + category) so totals, counts, charts and the list never disagree.
  const summary = useMemo(() => {
    let income = 0,
      expense = 0;
    for (const r of filteredRows) {
      if (r.type === 'income') income += r.amount;
      else expense += r.amount;
    }

    let months = 1;
    if (filterMode === 'fy') {
      months = 12;
    } else if (filterMode === 'custom' && customStart && customEnd) {
      const d1 = new Date(customStart);
      const d2 = new Date(customEnd);
      if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
        months =
          (d2.getFullYear() - d1.getFullYear()) * 12 +
          (d2.getMonth() - d1.getMonth()) +
          1;
      }
    } else if (filterMode === 'all' && filteredRows.length > 0) {
      let minDate = filteredRows[0].date;
      let maxDate = filteredRows[0].date;
      for (const r of filteredRows) {
        if (r.date < minDate) minDate = r.date;
        if (r.date > maxDate) maxDate = r.date;
      }
      const d1 = new Date(minDate);
      const d2 = new Date(maxDate);
      if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
        months =
          (d2.getFullYear() - d1.getFullYear()) * 12 +
          (d2.getMonth() - d1.getMonth()) +
          1;
      }
    }
    months = Math.max(1, months);

    return {
      income,
      expense,
      savings: income - expense,
      avgMonthlyIncome: income / months,
      monthsCount: months,
    };
  }, [filteredRows, filterMode, customStart, customEnd]);
  const advanced = useMemo(
    () => buildCashflowAdvancedInsights(filteredRows),
    [filteredRows],
  );

  // While a single category is selected the pies break the same money down
  // one level deeper, by subcategory.
  const chartGroupKey = (r: CashflowEntry) =>
    categoryFilter !== 'all' && r.subcategory ? r.subcategory : r.category;

  const incomeByCategory = useMemo(() => {
    const grouped: Record<string, number> = {};
    filteredRows.forEach((r) => {
      if (r.type === 'income')
        grouped[chartGroupKey(r)] = (grouped[chartGroupKey(r)] || 0) + r.amount;
    });
    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredRows, categoryFilter]);

  const expenseByCategory = useMemo(() => {
    const grouped: Record<string, number> = {};
    filteredRows.forEach((r) => {
      if (r.type === 'expense')
        grouped[chartGroupKey(r)] = (grouped[chartGroupKey(r)] || 0) + r.amount;
    });
    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredRows, categoryFilter]);

  // Selection always tracks the visible (filtered) rows: switching filters
  // drops hidden rows from the selection so bulk actions never touch them.
  useEffect(() => {
    if (selectedIds.size === 0) return;
    const visible = new Set(filteredRows.map((r) => r.id));
    const kept = [...selectedIds].filter((id) => visible.has(id));
    if (kept.length !== selectedIds.size) setSelectedIds(new Set(kept));
  }, [filteredRows, selectedIds]);

  const openDeleteModal = (id: string) => {
    setSelectedDeleteId(id);
    setDeleteOpen(true);
  };
  const confirmDelete = () => {
    if (!selectedDeleteId) return;
    void runDelete(async () => {
      await deleteCashflow(selectedDeleteId);
      setDeleteOpen(false);
      setSelectedDeleteId(null);
    });
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
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    void runDelete(async () => {
      await deleteCashflows(ids);
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
    });
  };

  const handleExportSelected = () => {
    const rows = filteredRows.filter((r) => selectedIds.has(r.id));
    const pattern =
      useExportPresetsStore.getState().getLastFilename('cashflow-bulk-csv') ??
      'cashflow-selection-{date}';
    const fn = ensureCsvExtension(expandExportFilenamePattern(pattern));
    exportCashflowsCSV(rows, accounts, fn);
    useExportPresetsStore
      .getState()
      .rememberFilename('cashflow-bulk-csv', pattern);
  };

  if (!ready) return <CashflowSkeleton />;

  if (shellTab !== 'cashflow') {
    return (
      <div className='flex flex-col gap-6 pb-8 animate-in fade-in duration-500'>
        {shellTabs}
        {shellTab === 'accounts' && <AccountsPage />}
        {shellTab === 'budget' && <BudgetPage />}
        {shellTab === 'insights' && (
          <InsightsPage
            embedded
            initialSubTab={searchParams.get('tab') === 'dna' ? 'dna' : 'overview'}
          />
        )}
      </div>
    );
  }

  return (
    <div className='flex flex-col gap-6 pb-8'>
      {shellTabs}
      {/* ── Recurring detection ── */}
      <RecurringBanner />
      {/* ── Tabs Top ── */}
      <>
        {/* ── Header ─────────────────────────────────────────────────── */}
        <header className='flex flex-col lg:flex-row lg:items-center justify-between gap-6 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent p-6 border border-emerald-500/20 dark:from-emerald-500/20 dark:via-teal-500/10 dark:border-emerald-500/30 shadow-sm'>
          <div className='flex items-center gap-4'>
            <div className='flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-500/30'>
              <FiActivity className='h-6 w-6' />
            </div>
            <div>
              <h1 className='text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2'>
                Cashflow
                <FeatureInfo feature='cashflow' />
              </h1>
              <p className='mt-1 text-sm font-medium text-slate-600 dark:text-slate-300'>
                Track your income sources and expenses over time.
              </p>
            </div>
          </div>
          <div className='flex flex-wrap items-center gap-3'>
            <button
              {...premiumActionProps}
              className='flex items-center gap-2 cursor-pointer rounded-xl border border-emerald-200/80 bg-white/50 px-4 py-2.5 text-sm font-semibold text-emerald-700 backdrop-blur-sm transition-all hover:bg-emerald-50 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-45 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20'
              onClick={() => setImportOpen(true)}
              type='button'
            >
              <FiUpload className='h-4 w-4' />
              <span>Import CSV/Excel</span>
            </button>
            <button
              {...premiumActionProps}
              className='group relative flex items-center gap-2 cursor-pointer overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-emerald-500/25 transition-all hover:-translate-y-0.5 hover:shadow-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0'
              onClick={() => setOpen(true)}
              type='button'
            >
              <div className='absolute inset-0 bg-white/20 translate-y-full transition-transform group-hover:translate-y-0' />
              <FiPlus className='relative h-4 w-4' />
              <span className='relative cursor-pointer'>Add Entry</span>
            </button>
          </div>
        </header>

        <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
          <div className='rounded-xl border border-slate-200/70 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4'>
            <p className='text-[10px] font-bold uppercase tracking-wider text-slate-500'>
              Savings rate
            </p>
            <p
              className={`mt-1 text-lg font-black ${advanced.savingsRate >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}
            >
              {advanced.savingsRate.toFixed(1)}%
            </p>
            <p className='mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400'>
              {advanced.savingsRate >= 25
                ? 'Strong'
                : advanced.savingsRate >= 10
                  ? 'Watch'
                  : 'Risk'}
            </p>
          </div>
          <div className='rounded-xl border border-slate-200/70 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4'>
            <p className='text-[10px] font-bold uppercase tracking-wider text-slate-500'>
              Burn rate / month
            </p>
            <p className='mt-1 text-lg font-black text-slate-900 dark:text-slate-100'>
              {formatINR(advanced.burnRateMonthly)}
            </p>
          </div>
          <div className='rounded-xl border border-slate-200/70 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4'>
            <p className='text-[10px] font-bold uppercase tracking-wider text-slate-500'>
              Top expense category
            </p>
            <p className='mt-1 text-sm font-black text-slate-900 dark:text-slate-100'>
              {advanced.topExpenseCategory}
            </p>
          </div>
          <div className='rounded-xl border border-slate-200/70 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4'>
            <p className='text-[10px] font-bold uppercase tracking-wider text-slate-500'>
              Top expense amount
            </p>
            <p className='mt-1 text-lg font-black text-rose-600 dark:text-rose-400'>
              {formatINR(advanced.topExpenseAmount)}
            </p>
          </div>
        </div>

        {/* ── Period Filter Bar ────────────────────────────────────────── */}
        <div className='rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-white/60 dark:bg-slate-900/40 backdrop-blur-md shadow-sm'>
          <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-100 dark:border-slate-800/60 rounded-t-2xl'>
            <div className='flex flex-wrap items-center gap-2'>
              <div className='flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 dark:bg-emerald-500/15'>
                <FiFilter className='h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400' />
              </div>
              <span className='text-sm font-bold text-slate-700 dark:text-slate-200'>
                Filter Period
              </span>
              <SavedViewsMenu
                pageId='cashflow'
                label='Views'
                getState={() => ({
                  filterMode,
                  fy,
                  customStart,
                  customEnd,
                  typeFilter,
                  categoryFilter,
                  subcategoryFilter,
                  sortKey,
                })}
                applyState={(s) => {
                  if (
                    s.filterMode === 'fy' ||
                    s.filterMode === 'custom' ||
                    s.filterMode === 'all'
                  )
                    setFilterMode(s.filterMode);
                  if (typeof s.fy === 'string') setFy(s.fy);
                  if (typeof s.customStart === 'string')
                    setCustomStart(s.customStart);
                  if (typeof s.customEnd === 'string')
                    setCustomEnd(s.customEnd);
                  if (
                    s.typeFilter === 'all' ||
                    s.typeFilter === 'income' ||
                    s.typeFilter === 'expense'
                  )
                    setTypeFilter(s.typeFilter);
                  if (typeof s.categoryFilter === 'string')
                    setCategoryFilter(s.categoryFilter);
                  if (typeof s.subcategoryFilter === 'string')
                    setSubcategoryFilter(s.subcategoryFilter);
                  if (
                    typeof s.sortKey === 'string' &&
                    (s.sortKey === 'date-desc' ||
                      s.sortKey === 'date-asc' ||
                      s.sortKey === 'amount-desc' ||
                      s.sortKey === 'amount-asc')
                  )
                    setSortKey(s.sortKey);
                }}
              />
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
                  fullWidth={false}
                />
                <div className='self-end pb-3'>
                  <span className='text-sm font-bold text-slate-900 dark:text-slate-500 select-none'>
                    →
                  </span>
                </div>
                <CalendarPicker
                  value={customEnd}
                  onChange={setCustomEnd}
                  label='To'
                  fullWidth={false}
                />
                <div className='ml-auto flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10 px-4 py-2.5 self-end'>
                  <span className='h-1.5 w-1.5 rounded-full bg-emerald-400' />
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

        {/* ── Analytics Overview (Redesigned for better UI/UX) ───────────── */}
        <div className='flex flex-col gap-5'>
          {/* TIER 1: The Metrics Row */}
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
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
            <SummaryCard
              label='Avg Monthly Income'
              value={formatINR(summary.avgMonthlyIncome)}
              sub={`Over ${summary.monthsCount} month${summary.monthsCount !== 1 ? 's' : ''}`}
              icon={
                <FiCalendar className='h-5 w-5 text-indigo-600 dark:text-indigo-400' />
              }
              colorClass='text-indigo-600 dark:text-indigo-400'
              borderColor='border-indigo-200/60 dark:border-indigo-500/20'
            />
          </div>

          {/* TIER 2: The Visuals Row (Side-by-Side Pie Charts) */}
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-5'>
            <div className='overflow-hidden rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-white/80 dark:bg-slate-900/50 p-5 shadow-sm backdrop-blur-md'>
              <div className='flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300 mb-4'>
                <div className='flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10'>
                  <FiPieChart className='h-3.5 w-3.5 text-emerald-500' />
                </div>{' '}
                Income Breakdown
              </div>
              {incomeByCategory.length > 0 ? (
                <div className='h-[280px] w-full'>
                  <ResponsiveContainer width='100%' height='100%'>
                    <PieChart>
                      <Pie
                        data={incomeByCategory}
                        dataKey='value'
                        nameKey='name'
                        cx='50%'
                        cy='50%'
                        innerRadius={70}
                        outerRadius={105}
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
                <div className='flex h-[280px] flex-col items-center justify-center text-slate-500 dark:text-slate-400'>
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
                <div className='h-[280px] w-full'>
                  <ResponsiveContainer width='100%' height='100%'>
                    <PieChart>
                      <Pie
                        data={expenseByCategory}
                        dataKey='value'
                        nameKey='name'
                        cx='50%'
                        cy='50%'
                        innerRadius={70}
                        outerRadius={105}
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
                <div className='flex h-[280px] flex-col items-center justify-center text-slate-500 dark:text-slate-400'>
                  <FiPieChart className='h-10 w-10 mb-2 opacity-20' />
                  <p className='text-sm font-medium'>No expense data.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Bulk actions ── */}
        {selectedIds.size > 0 && (
          <div className='flex flex-wrap justify-end gap-2 mt-4'>
            <button
              type='button'
              onClick={handleExportSelected}
              className='flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-5 py-2.5 text-sm cursor-pointer font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
            >
              <FiDownload className='h-4 w-4' /> Export selected (
              {selectedIds.size})
            </button>
            <button
              type='button'
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
                onChange={handleCategoryChange}
                categories={uniqueCategories}
                counts={categoryCounts}
              />
              {categoryFilter !== 'all' && subcategoryOptions.length > 0 && (
                <SubcategoryFilterButton
                  value={subcategoryFilter}
                  onChange={setSubcategoryFilter}
                  subcategories={subcategoryOptions}
                  counts={subcategoryCounts}
                  category={categoryFilter}
                />
              )}
              {filtersActive && (
                <button
                  type='button'
                  onClick={clearFilters}
                  className='fx-chip flex cursor-pointer items-center gap-1 rounded-xl border border-slate-200 px-2.5 py-2 text-xs font-bold dark:border-slate-700'
                >
                  <FiX className='h-3 w-3 shrink-0' />
                  Clear filters
                </button>
              )}
              <span className='text-xs font-medium text-slate-900 dark:text-slate-500 hidden xl:inline ml-1'>
                Sort by:
              </span>
              <SortButton value={sortKey} onChange={setSortKey} />
              <span className='text-xs text-slate-900 dark:text-slate-500 font-medium ml-1 hidden md:inline'>
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
                      <p className='text-sm font-medium text-slate-500 dark:text-slate-400'>
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
                        {e.subcategory && (
                          <span className='ml-2 inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800/70 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300'>
                            {subcategoryIcon(e.subcategory)} {e.subcategory}
                          </span>
                        )}
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
                            className='flex h-8 w-8 items-center justify-center rounded-lg cursor-pointer text-slate-500 dark:text-slate-400 transition-colors hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400'
                          >
                            <FiEdit2 className='h-4 w-4' />
                          </button>
                          <button
                            type='button'
                            onClick={() => openDeleteModal(e.id)}
                            className='flex h-8 w-8 items-center justify-center rounded-lg cursor-pointer text-slate-500 dark:text-slate-400 transition-colors hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400'
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
            <div className='flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/60 px-4 py-2.5'>
              <label className='flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300'>
                <input
                  type='checkbox'
                  checked={
                    filteredRows.length > 0 &&
                    selectedIds.size === filteredRows.length
                  }
                  onChange={handleSelectAll}
                  className='h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600 dark:border-slate-600 dark:bg-slate-700 dark:ring-offset-slate-800'
                />
                Select all ({filteredRows.length})
              </label>
              {selectedIds.size > 0 && (
                <span className='text-xs font-bold text-emerald-600 dark:text-emerald-400'>
                  {selectedIds.size} selected
                </span>
              )}
            </div>
            {filteredRows.length === 0 ? (
              <div className='px-5 py-14 text-center'>
                <FiActivity className='h-10 w-10 mx-auto mb-3 text-slate-300 dark:text-slate-600' />
                <p className='text-sm font-medium text-slate-500 dark:text-slate-400'>
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
                          {e.subcategory && (
                            <span className='inline-flex w-fit items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800/70 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300'>
                              {subcategoryIcon(e.subcategory)} {e.subcategory}
                            </span>
                          )}
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
                        className='flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs cursor-pointer font-bold text-slate-900 dark:text-slate-500 transition-colors hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400'
                      >
                        <FiEdit2 className='h-3.5 w-3.5' /> Edit
                      </button>
                      <button
                        type='button'
                        onClick={() => openDeleteModal(e.id)}
                        className='flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs cursor-pointer font-bold text-slate-900 dark:text-slate-500 transition-colors hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400'
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
        <ImportCashflowModal
          open={importOpen}
          onClose={() => setImportOpen(false)}
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
            <p className='text-sm text-slate-500 dark:text-slate-400'>
              This will permanently delete the transaction.
            </p>
            <div className='flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800 pt-5'>
              <button
                onClick={() => setDeleteOpen(false)}
                className='rounded-xl px-5 py-2.5 text-sm cursor-pointer font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              >
                Cancel
              </button>
              <AsyncButton
                onClick={confirmDelete}
                busy={deleteBusy}
                loadingLabel='Deleting…'
                className='rounded-xl bg-red-600 px-6 py-2.5 text-sm cursor-pointer font-bold text-white hover:bg-red-700'
              >
                Yes, Delete
              </AsyncButton>
            </div>
          </div>
        </Modal>

        <Modal
          open={bulkDeleteOpen}
          onClose={() => setBulkDeleteOpen(false)}
          title='⚠ Confirm Bulk Deletion'
        >
          <div className='space-y-6'>
            <p className='text-sm text-slate-500 dark:text-slate-400'>
              This will permanently delete {selectedIds.size} selected
              transactions.
            </p>
            <div className='flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800 pt-5'>
              <button
                onClick={() => setBulkDeleteOpen(false)}
                className='rounded-xl px-5 py-2.5 text-sm cursor-pointer font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              >
                Cancel
              </button>
              <AsyncButton
                onClick={confirmBulkDelete}
                busy={deleteBusy}
                loadingLabel='Deleting…'
                className='rounded-xl bg-red-600 px-6 py-2.5 text-sm cursor-pointer font-bold text-white hover:bg-red-700'
              >
                Yes, Delete {selectedIds.size} Records
              </AsyncButton>
            </div>
          </div>
        </Modal>
      </>
    </div>
  );
}
