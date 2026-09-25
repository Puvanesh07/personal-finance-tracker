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
  FiCalendar,
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
import { useEffect, useMemo, useState } from 'react';
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
import { getSubcategoryOptions, subcategoryIcon } from '../../utils/cashflowCategories';
import { exportCashflowsCSV } from '../../utils/exportUtils';
import { formatINR } from '../../utils/format';
import { useAsyncAction } from '../../hooks/useAsyncAction';
import { useExportPresetsStore } from '../../store/exportPresetsStore';
import { usePortfolioStore } from '../../store/portfolioStore';
import { FeatureInfo } from '../../components/ui/FeatureInfo';
import { usePremiumActions } from '../../hooks/usePremiumActions';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import {
  CategoryFilterButton,
  CASHFLOW_PERIOD_KEY,
  EXPENSE_COLORS,
  getFYOptions,
  INCOME_COLORS,
  InvDropdown,
  loadSavedCashflowPeriod,
  RecurringBanner,
  ROW_PAGE,
  SegmentedControl,
  SortableHeader,
  SortButton,
  SubcategoryFilterButton,
  SummaryCard,
  TypeFilterTabs,
  type SavedCashflowPeriod,
  type SortKey,
  type TypeFilter,
} from './cashflowComponents';

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

  // One layout, not two. The desktop <table> and the mobile card list used to
  // both be rendered on every screen and swapped with `hidden md:block`, so a
  // 400-row history mounted ~800 row trees on a phone.
  const isDesktopTable = useMediaQuery('(min-width: 768px)');

  // …and only the first window of rows is mounted; "Show more" pages in.
  const [rowWindow, setRowWindow] = useState(ROW_PAGE);
  useEffect(() => setRowWindow(ROW_PAGE), [filteredRows]);
  const visibleRows = useMemo(
    () => filteredRows.slice(0, rowWindow),
    [filteredRows, rowWindow],
  );

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
                  <label className='text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 px-1'>
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
                  <span className='text-sm font-bold text-slate-900 dark:text-slate-400 select-none'>
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
                <span className='text-sm font-medium text-slate-400 dark:text-slate-400'>
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
              <span className='text-xs font-medium text-slate-900 dark:text-slate-400 hidden xl:inline ml-1'>
                Sort by:
              </span>
              <SortButton value={sortKey} onChange={setSortKey} />
              <span className='text-xs text-slate-900 dark:text-slate-400 font-medium ml-1 hidden md:inline'>
                {filteredRows.length} row
                {filteredRows.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {isDesktopTable && (<div className='overflow-x-auto rounded-b-2xl'>
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
                  visibleRows.map((e) => (
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
          </div>)}

          {!isDesktopTable && (<div>
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
                {visibleRows.map((e) => (
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
                        className='flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs cursor-pointer font-bold text-slate-900 dark:text-slate-400 transition-colors hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400'
                      >
                        <FiEdit2 className='h-3.5 w-3.5' /> Edit
                      </button>
                      <button
                        type='button'
                        onClick={() => openDeleteModal(e.id)}
                        className='flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs cursor-pointer font-bold text-slate-900 dark:text-slate-400 transition-colors hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400'
                      >
                        <FiTrash2 className='h-3.5 w-3.5' /> Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>)}

          {filteredRows.length > visibleRows.length && (
            <div className='flex items-center justify-center gap-3 border-t border-slate-100 dark:border-slate-800/60 px-5 py-3'>
              <span className='text-xs font-medium text-slate-500 dark:text-slate-400'>
                Showing {visibleRows.length} of {filteredRows.length}
              </span>
              <button
                type='button'
                onClick={() => setRowWindow((n) => n + ROW_PAGE)}
                className='fx-chip cursor-pointer rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200'
              >
                Show {Math.min(ROW_PAGE, filteredRows.length - visibleRows.length)} more
              </button>
            </div>
          )}
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
