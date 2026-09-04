/**
 * src/pages/Budget/BudgetPage.tsx
 *
 * Budget vs Actual — Feature 6.
 * Users set monthly budgets per category. Page shows actual spend vs budget
 * as fill bars with % used, over/under status, and remaining amount.
 * Budgets are persisted in localStorage (no Firestore write needed — purely client-side).
 */

import { useMemo, useState } from 'react';
import {
  FiEdit2, FiCheck, FiX, FiPieChart,
  FiAlertCircle, FiTrendingDown, FiTrendingUp,
} from 'react-icons/fi';
import { usePortfolioStore } from '../../store/portfolioStore';
import { formatINR } from '../../utils/format';
import { FeatureInfo } from '../../components/ui/FeatureInfo';

// ─── Persistence ──────────────────────────────────────────────────────────────

const BUDGET_KEY = 'fintrackly-monthly-budgets-v1';

type BudgetMap = Record<string, number>; // category → monthly budget amount

function loadBudgets(): BudgetMap {
  try {
    const raw = localStorage.getItem(BUDGET_KEY);
    return raw ? (JSON.parse(raw) as BudgetMap) : {};
  } catch { return {}; }
}
function saveBudgets(b: BudgetMap) {
  localStorage.setItem(BUDGET_KEY, JSON.stringify(b));
}

// ─── Category row ─────────────────────────────────────────────────────────────

interface BudgetRowProps {
  category: string;
  actual: number;
  budget: number;
  onSetBudget: (cat: string, val: number) => void;
}

function BudgetRow({ category, actual, budget, onSetBudget }: BudgetRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState('');

  const pct         = budget > 0 ? Math.min(150, (actual / budget) * 100) : 0;
  const over        = actual > budget && budget > 0;
  const remaining   = budget > 0 ? budget - actual : 0;
  const barColor    =
    pct >= 100 ? 'bg-rose-500'
    : pct >= 80 ? 'bg-amber-500'
    : 'bg-emerald-500';

  const commit = () => {
    const val = parseFloat(draft.replace(/,/g, ''));
    if (!isNaN(val) && val >= 0) onSetBudget(category, val);
    setEditing(false);
  };

  return (
    <div className='py-3 px-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors rounded-xl'>
      {/* Top row */}
      <div className='flex items-center justify-between gap-3 mb-2'>
        <div className='flex items-center gap-2 min-w-0'>
          <span className='text-sm font-semibold text-slate-800 dark:text-slate-100 truncate'>{category}</span>
          {over && (
            <span className='shrink-0 flex items-center gap-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400'>
              <FiAlertCircle className='h-3 w-3' /> Over budget
            </span>
          )}
        </div>
        <div className='flex items-center gap-2 shrink-0 text-xs'>
          <span className='font-bold text-slate-900 dark:text-slate-100 tabular-nums'>
            {formatINR(actual)}
          </span>
          <span className='text-slate-400'>/</span>
          {editing ? (
            <div className='flex items-center gap-1'>
              <span className='text-slate-400 text-xs'>₹</span>
              <input
                autoFocus
                type='number'
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
                className='w-24 rounded-lg border border-violet-400 bg-white dark:bg-slate-900 px-2 py-0.5 text-xs text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-violet-500/30 tabular-nums'
                placeholder='Budget'
              />
              <button type='button' onClick={commit} className='text-emerald-500 hover:text-emerald-600'>
                <FiCheck className='h-3.5 w-3.5' />
              </button>
              <button type='button' onClick={() => setEditing(false)} className='text-slate-400 hover:text-rose-500'>
                <FiX className='h-3.5 w-3.5' />
              </button>
            </div>
          ) : (
            <button
              type='button'
              onClick={() => { setDraft(budget > 0 ? String(budget) : ''); setEditing(true); }}
              className='flex items-center gap-1 text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors'
            >
              {budget > 0 ? (
                <span className='tabular-nums'>{formatINR(budget)}</span>
              ) : (
                <span className='text-[11px] italic'>Set budget</span>
              )}
              <FiEdit2 className='h-3 w-3' />
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {budget > 0 && (
        <div className='flex items-center gap-2'>
          <div className='flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden'>
            <div
              className={`h-full rounded-full transition-all duration-500 ${barColor}`}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
          <span className={`text-[10px] font-bold tabular-nums w-10 text-right
            ${over ? 'text-rose-600 dark:text-rose-400' : pct >= 80 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`}>
            {pct.toFixed(0)}%
          </span>
        </div>
      )}

      {/* Remaining / over */}
      {budget > 0 && (
        <p className={`text-[10px] mt-1 ${remaining >= 0 ? 'text-slate-400' : 'text-rose-500 dark:text-rose-400'}`}>
          {remaining >= 0
            ? `${formatINR(remaining)} remaining`
            : `${formatINR(Math.abs(remaining))} over budget`}
        </p>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BudgetPage() {
  const cashflows = usePortfolioStore((s) => s.cashflows);
  const [budgets, setBudgets] = useState<BudgetMap>(loadBudgets);
  const [filterMonth, setFilterMonth] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
  });

  // All expense categories (all time, sorted by total)
  const allCategories = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of cashflows) {
      if (e.type !== 'expense') continue;
      map[e.category] = (map[e.category] ?? 0) + e.amount;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([c]) => c);
  }, [cashflows]);

  // Actual spend per category this month
  const actualByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of cashflows) {
      if (e.type !== 'expense' || !e.date.startsWith(filterMonth)) continue;
      map[e.category] = (map[e.category] ?? 0) + e.amount;
    }
    return map;
  }, [cashflows, filterMonth]);

  // Include categories with a budget but no spend this month
  const categories = useMemo(() => {
    const all = new Set([
      ...allCategories,
      ...Object.keys(budgets).filter((k) => budgets[k] > 0),
    ]);
    return [...all];
  }, [allCategories, budgets]);

  const handleSetBudget = (cat: string, val: number) => {
    const next = { ...budgets, [cat]: val };
    setBudgets(next);
    saveBudgets(next);
  };

  // Summary
  const totalBudgeted = Object.values(budgets).reduce((a, b) => a + b, 0);
  const totalActual   = Object.values(actualByCategory).reduce((a, b) => a + b, 0);
  const totalOver     = categories.filter((c) => {
    const b = budgets[c] ?? 0;
    const a = actualByCategory[c] ?? 0;
    return b > 0 && a > b;
  }).length;
  const totalUnder    = categories.filter((c) => {
    const b = budgets[c] ?? 0;
    const a = actualByCategory[c] ?? 0;
    return b > 0 && a <= b;
  }).length;

  // Month navigation
  const prevMonth = () => {
    const [y, m] = filterMonth.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    setFilterMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  const nextMonth = () => {
    const [y, m] = filterMonth.split('-').map(Number);
    const d = new Date(y, m, 1);
    setFilterMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const monthLabel = new Date(`${filterMonth}-01`).toLocaleDateString('en-IN', {
    month: 'long', year: 'numeric',
  });

  return (
    <div className='flex flex-col gap-6 pb-12'>
      {/* Header */}
      <header className='rounded-2xl bg-gradient-to-r from-teal-500/10 via-emerald-500/5 to-transparent p-6 border border-teal-500/20'>
        <div className='flex items-center gap-4'>
          <div className='flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 text-white shadow-lg'>
            <FiPieChart className='h-6 w-6' />
          </div>
          <div>
            <h1 className='text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2'>Budget vs Actual <FeatureInfo feature='budget' /></h1>
            <p className='text-sm text-slate-500 dark:text-slate-400 mt-0.5'>
              Set monthly category budgets and track actual spending.
            </p>
          </div>
        </div>
      </header>

      {/* Month selector + summary */}
      <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
        <div className='flex items-center gap-2'>
          <button type='button' onClick={prevMonth}
            className='p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors'>
            ‹
          </button>
          <span className='text-sm font-bold text-slate-800 dark:text-slate-100 min-w-[140px] text-center'>{monthLabel}</span>
          <button type='button' onClick={nextMonth}
            className='p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors'>
            ›
          </button>
        </div>

        <div className='flex gap-3'>
          {[
            { icon: FiPieChart,     label: 'Budgeted',  value: formatINR(totalBudgeted),  color: 'text-teal-600 dark:text-teal-400' },
            { icon: FiTrendingDown, label: 'Spent',     value: formatINR(totalActual),    color: totalActual > totalBudgeted ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-200' },
            { icon: FiAlertCircle,  label: 'Over budget', value: `${totalOver} cat`,      color: totalOver > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400' },
            { icon: FiTrendingUp,   label: 'On track',  value: `${totalUnder} cat`,       color: 'text-emerald-600 dark:text-emerald-400' },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className='rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 px-3 py-2 text-center min-w-[80px]'>
              <Icon className='h-3.5 w-3.5 mx-auto text-slate-400 mb-1' />
              <p className={`text-sm font-black tabular-nums ${color}`}>{value}</p>
              <p className='text-[9px] font-bold uppercase tracking-wider text-slate-400'>{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Overall progress bar */}
      {totalBudgeted > 0 && (
        <div className='rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4'>
          <div className='flex justify-between text-xs font-bold mb-2'>
            <span className='text-slate-600 dark:text-slate-300'>Total Spend</span>
            <span className={totalActual > totalBudgeted ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}>
              {formatINR(totalActual)} / {formatINR(totalBudgeted)}
            </span>
          </div>
          <div className='h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden'>
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                totalActual > totalBudgeted ? 'bg-rose-500' : totalActual > totalBudgeted * 0.8 ? 'bg-amber-500' : 'bg-teal-500'
              }`}
              style={{ width: `${Math.min(100, (totalActual / totalBudgeted) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Category rows */}
      <div className='rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800'>
        <div className='px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between'>
          <p className='text-[10px] font-bold uppercase tracking-widest text-slate-400'>Category</p>
          <p className='text-[10px] font-bold uppercase tracking-widest text-slate-400'>Actual / Budget</p>
        </div>
        {categories.length === 0 ? (
          <p className='px-4 py-8 text-center text-sm text-slate-400'>
            No cashflow entries yet. Add some expenses to start budgeting.
          </p>
        ) : (
          categories.map((cat) => (
            <BudgetRow
              key={cat}
              category={cat}
              actual={actualByCategory[cat] ?? 0}
              budget={budgets[cat] ?? 0}
              onSetBudget={handleSetBudget}
            />
          ))
        )}
      </div>

      <p className='text-[10px] text-center text-slate-400 dark:text-slate-600'>
        Budgets are saved locally. Categories come from your cashflow expense entries.
      </p>
    </div>
  );
}
