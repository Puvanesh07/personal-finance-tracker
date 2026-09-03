// src/components/cashflow/UpsertCashflowModal.tsx
//
// Rewritten:
//  • Category persistence moved from localStorage → Firestore (portfolioStore)
//  • ManageCategoriesModal: fully fixed dark mode — no conflicting className patterns
//  • CategoryDropdown: clean dark mode contrast throughout
//  • CalendarPicker: clean dark mode contrast throughout

import type { CashflowEntry, CashflowType } from '../../types/investmentTypes';
import {
  FiCalendar,
  FiCheck,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiEye,
  FiEyeOff,
  FiPlus,
  FiSave,
  FiSearch,
  FiSettings,
  FiTrash2,
  FiX,
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
} from 'date-fns';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Modal } from '../ui/Modal';
import { NumericInput } from '../ui/NumericInput';
import { createPortal } from 'react-dom';
import { todayISO } from '../../utils/dateUtils';
import { usePortfolioStore } from '../../store/portfolioStore';

// ── Default Categories ────────────────────────────────────────────────────

export const DEFAULT_EXPENSE_CATEGORIES = [
  { key: 'Housing & Rent',         icon: '🏠' },
  { key: 'Food & Dining',          icon: '🍽️' },
  { key: 'Groceries',              icon: '🛒' },
  { key: 'Transport',              icon: '🚗' },
  { key: 'Healthcare',             icon: '🏥' },
  { key: 'Education',              icon: '📚' },
  { key: 'Insurance',              icon: '🛡️' },
  { key: 'EMI & Loans',            icon: '🏦' },
  { key: 'Entertainment',          icon: '🎬' },
  { key: 'Utilities',              icon: '💡' },
  { key: 'Shopping',               icon: '🛍️' },
  { key: 'Investment',             icon: '📈' },
  { key: 'Travel & Vacations',     icon: '✈️' },
  { key: 'Subscriptions',          icon: '📱' },
  { key: 'Personal Care',          icon: '💆' },
  { key: 'Transfers & Remittance', icon: '💸' },
  { key: 'Credit Card Payment',    icon: '💳' },
  { key: 'Taxes',                  icon: '🧾' },
  { key: 'Cash Withdrawal',        icon: '💵' },
  { key: 'Childcare',              icon: '👶' },
  { key: 'Petrol',                 icon: '⛽' },
  { key: 'Rent',                   icon: '🏘️' },
  { key: 'Dining',                 icon: '🍜' },
  { key: 'Other Expense',          icon: '📦' },
];

export const DEFAULT_INCOME_CATEGORIES = [
  { key: 'Salary',          icon: '💼' },
  { key: 'Business',        icon: '🏢' },
  { key: 'Freelance',       icon: '💻' },
  { key: 'Dividend',        icon: '📊' },
  { key: 'Interest',        icon: '🏦' },
  { key: 'Rental Income',   icon: '🏠' },
  { key: 'Bonus',           icon: '🎁' },
  { key: 'Capital Gains',   icon: '📈' },
  { key: 'Pension',         icon: '👴' },
  { key: 'Refund',          icon: '↩️' },
  { key: 'Gift',            icon: '🎀' },
  { key: 'Lottery / Prize', icon: '🏆' },
  { key: 'Other Income',    icon: '💰' },
];

// ── Shared className helpers (light + dark) ───────────────────────────────

const INPUT_CLS =
  'w-full rounded-xl border border-slate-200 dark:border-slate-700 ' +
  'bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-medium ' +
  'text-slate-900 dark:text-slate-100 shadow-sm outline-none transition-all ' +
  'focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 ' +
  'placeholder:text-slate-400 dark:placeholder:text-slate-500';

const LABEL_CLS =
  'text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 block';

const ROW_CLS =
  'flex items-center justify-between rounded-xl px-3 py-2.5 transition-colors ' +
  'hover:bg-slate-100 dark:hover:bg-slate-700/60';

const ICON_BTN_CLS =
  'flex h-7 w-7 items-center justify-center rounded-lg transition-colors ' +
  'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 ' +
  'hover:bg-slate-200 dark:hover:bg-slate-600 hover:text-slate-800 dark:hover:text-slate-100';

// ── Manage Categories Modal ───────────────────────────────────────────────

function ManageCategoriesModal({
  type,
  onClose,
}: {
  type: 'expense' | 'income';
  onClose: () => void;
}) {
  const customCategories  = usePortfolioStore((s) => s.customCategories);
  const hiddenCategories  = usePortfolioStore((s) => s.hiddenCategories);
  const addCustomCategory = usePortfolioStore((s) => s.addCustomCategory);
  const removeCustomCategory = usePortfolioStore((s) => s.removeCustomCategory);
  const toggleHiddenCategory = usePortfolioStore((s) => s.toggleHiddenCategory);

  const [newCat,   setNewCat]   = useState('');
  const [saving,   setSaving]   = useState(false);
  const inputRef               = useRef<HTMLInputElement>(null);

  const defaults = type === 'expense' ? DEFAULT_EXPENSE_CATEGORIES : DEFAULT_INCOME_CATEGORIES;
  const customs  = customCategories[type];
  const hidden   = hiddenCategories[type];

  const handleAdd = async () => {
    const trimmed = newCat.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      await addCustomCategory(type, trimmed);
      setNewCat('');
      inputRef.current?.focus();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className='fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4'>
      <div className='w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl flex flex-col max-h-[90vh]'>

        {/* Header */}
        <div className='flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700 shrink-0'>
          <div>
            <h3 className='text-base font-bold text-slate-900 dark:text-slate-100'>
              {type === 'expense' ? 'Expense' : 'Income'} Categories
            </h3>
            <p className='text-[11px] text-slate-400 dark:text-slate-500 mt-0.5'>
              Toggle visibility · Add custom · Delete custom
            </p>
          </div>
          <button
            type='button'
            onClick={onClose}
            className='flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300 transition-colors'
          >
            <FiX className='h-4 w-4' />
          </button>
        </div>

        {/* Category list */}
        <div className='flex-1 overflow-y-auto px-4 py-3 space-y-0.5'>
          {/* Default categories */}
          <p className='text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2 px-1'>
            Default ({defaults.length})
          </p>
          {defaults.map((cat) => {
            const isHidden = hidden.includes(cat.key);
            return (
              <div
                key={cat.key}
                className={`${ROW_CLS} ${isHidden ? 'opacity-50' : ''}`}
              >
                <div className='flex items-center gap-3'>
                  <span className='text-base w-6 text-center'>{cat.icon}</span>
                  <span className={`text-sm font-medium ${isHidden ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-200'}`}>
                    {cat.key}
                  </span>
                </div>
                <button
                  type='button'
                  onClick={() => void toggleHiddenCategory(type, cat.key)}
                  className={ICON_BTN_CLS}
                  title={isHidden ? 'Show in list' : 'Hide from list'}
                >
                  {isHidden
                    ? <FiEyeOff className='h-3.5 w-3.5' />
                    : <FiEye    className='h-3.5 w-3.5' />
                  }
                </button>
              </div>
            );
          })}

          {/* Custom categories */}
          {customs.length > 0 && (
            <>
              <p className='text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mt-4 mb-2 px-1'>
                Custom ({customs.length})
              </p>
              {customs.map((cat) => {
                const isHidden = hidden.includes(cat);
                return (
                  <div
                    key={cat}
                    className={`${ROW_CLS} ${isHidden ? 'opacity-50' : ''}`}
                  >
                    <div className='flex items-center gap-3'>
                      <span className='text-base w-6 text-center'>🏷️</span>
                      <span className={`text-sm font-medium ${isHidden ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-200'}`}>
                        {cat}
                      </span>
                    </div>
                    <div className='flex items-center gap-1.5'>
                      <button
                        type='button'
                        onClick={() => void toggleHiddenCategory(type, cat)}
                        className={ICON_BTN_CLS}
                        title={isHidden ? 'Show' : 'Hide'}
                      >
                        {isHidden
                          ? <FiEyeOff className='h-3.5 w-3.5' />
                          : <FiEye    className='h-3.5 w-3.5' />
                        }
                      </button>
                      <button
                        type='button'
                        onClick={() => void removeCustomCategory(type, cat)}
                        className='flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-500 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors'
                        title='Delete custom category'
                      >
                        <FiTrash2 className='h-3.5 w-3.5' />
                      </button>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Add new category */}
        <div className='px-4 pb-4 pt-3 border-t border-slate-200 dark:border-slate-700 shrink-0 space-y-2'>
          <p className='text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500'>
            Add New Category
          </p>
          <div className='flex gap-2'>
            <input
              ref={inputRef}
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleAdd(); }}
              placeholder='e.g. Dog Food, Gym…'
              className={INPUT_CLS}
              autoFocus
            />
            <button
              type='button'
              onClick={() => void handleAdd()}
              disabled={!newCat.trim() || saving}
              className='flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40 transition-colors whitespace-nowrap'
            >
              {saving ? '…' : <><FiPlus className='h-4 w-4' /> Add</>}
            </button>
          </div>
          <button
            type='button'
            onClick={onClose}
            className='w-full rounded-xl border border-slate-200 dark:border-slate-700 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors'
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Category Picker Dropdown ──────────────────────────────────────────────

function CategoryDropdown({
  value,
  onChange,
  type,
  onOpenManage,
}: {
  value: string;
  onChange: (v: string) => void;
  type: 'expense' | 'income';
  onOpenManage: () => void;
}) {
  const customCategories  = usePortfolioStore((s) => s.customCategories);
  const hiddenCategories  = usePortfolioStore((s) => s.hiddenCategories);
  const addCustomCategory = usePortfolioStore((s) => s.addCustomCategory);

  const [open,       setOpen]       = useState(false);
  const [search,     setSearch]     = useState('');
  const [newCatMode, setNewCatMode] = useState(false);
  const [newCatVal,  setNewCatVal]  = useState('');
  const triggerRef  = useRef<HTMLButtonElement>(null);
  const panelRef    = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  const defaults = type === 'expense' ? DEFAULT_EXPENSE_CATEGORIES : DEFAULT_INCOME_CATEGORIES;
  const customs  = customCategories[type];
  const hidden   = hiddenCategories[type];

  const allCategories = useMemo(() => {
    const customWithIcon = customs.map((c) => ({ key: c, icon: '🏷️' }));
    return [...defaults, ...customWithIcon].filter((c) => !hidden.includes(c.key));
  }, [defaults, customs, hidden]);

  const filtered = useMemo(() => {
    if (!search.trim()) return allCategories;
    return allCategories.filter((c) =>
      c.key.toLowerCase().includes(search.toLowerCase()),
    );
  }, [allCategories, search]);

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const r      = triggerRef.current.getBoundingClientRect();
    const panelW = Math.max(r.width, 280);
    const left   = Math.min(r.left + window.scrollX, window.innerWidth + window.scrollX - panelW - 16);
    const spaceBelow = window.innerHeight - r.bottom;
    const top    = spaceBelow > 380
      ? r.bottom + 8 + window.scrollY
      : r.top - 380 - 8 + window.scrollY;
    setPos({ top, left: Math.max(8, left), width: panelW });
  }, []);

  useEffect(() => { if (open) updatePos(); }, [open, updatePos]);

  useEffect(() => {
    if (!open) return;
    const onMouse = (e: MouseEvent) => {
      if (
        panelRef.current   && !panelRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', onMouse);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      document.removeEventListener('mousedown', onMouse);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [open, updatePos]);

  const selectedCat = allCategories.find((c) => c.key === value) ??
    (value ? { key: value, icon: '🏷️' } : null);

  const handleAddNew = async () => {
    const trimmed = newCatVal.trim();
    if (!trimmed) return;
    await addCustomCategory(type, trimmed);
    onChange(trimmed);
    setNewCatVal('');
    setNewCatMode(false);
    setOpen(false);
  };

  return (
    <>
      {/* Trigger */}
      <button
        ref={triggerRef}
        type='button'
        onClick={() => { setOpen((v) => !v); setSearch(''); setNewCatMode(false); }}
        className={`flex w-full items-center justify-between rounded-xl border px-4 py-2.5 text-sm transition-all ${
          open
            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10 shadow-sm'
            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
        }`}
      >
        <div className='flex items-center gap-2.5'>
          {selectedCat ? (
            <>
              <span className='text-base leading-none'>{selectedCat.icon}</span>
              <span className='font-medium text-slate-900 dark:text-slate-100'>{selectedCat.key}</span>
            </>
          ) : (
            <span className='text-slate-400 dark:text-slate-500'>Select a category</span>
          )}
        </div>
        <FiChevronDown className={`h-3.5 w-3.5 text-slate-400 dark:text-slate-500 transition-transform ${open ? 'rotate-180 text-emerald-500' : ''}`} />
      </button>

      {/* Portal dropdown */}
      {open && createPortal(
        <div
          ref={panelRef}
          style={{ position: 'absolute', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999, maxHeight: 400 }}
          className='flex flex-col rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden'
        >
          {/* Search */}
          <div className='flex items-center gap-2 px-3 py-2.5 border-b border-slate-100 dark:border-slate-800'>
            <FiSearch className='h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0' />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder='Search categories…'
              className='flex-1 bg-transparent text-sm text-slate-800 dark:text-slate-200 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500'
              autoFocus
            />
            {search && (
              <button type='button' onClick={() => setSearch('')}
                className='text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'>
                <FiX className='h-3.5 w-3.5' />
              </button>
            )}
          </div>

          {/* List */}
          <div className='flex-1 overflow-y-auto p-1.5'>
            {filtered.length === 0 ? (
              <p className='px-3 py-4 text-center text-xs text-slate-400 dark:text-slate-500'>No categories found</p>
            ) : filtered.map((cat) => (
              <button
                key={cat.key}
                type='button'
                onClick={() => { onChange(cat.key); setOpen(false); }}
                className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-left transition-colors ${
                  value === cat.key
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-semibold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <span className='text-base leading-none w-5 text-center'>{cat.icon}</span>
                <span className='flex-1'>{cat.key}</span>
                {value === cat.key && <FiCheck className='h-4 w-4 shrink-0 text-emerald-500' />}
              </button>
            ))}
          </div>

          {/* Footer */}
          <div className='border-t border-slate-100 dark:border-slate-800 p-1.5 space-y-0.5'>
            {newCatMode ? (
              <div className='flex items-center gap-2 px-2 py-1.5'>
                <input
                  value={newCatVal}
                  onChange={(e) => setNewCatVal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter')  void handleAddNew();
                    if (e.key === 'Escape') { setNewCatMode(false); setNewCatVal(''); }
                  }}
                  placeholder='New category name…'
                  className='flex-1 rounded-lg border border-emerald-400 dark:border-emerald-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/20 placeholder:text-slate-400 dark:placeholder:text-slate-500'
                  autoFocus
                />
                <button type='button' onClick={() => void handleAddNew()} disabled={!newCatVal.trim()}
                  className='flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white disabled:opacity-40 hover:bg-emerald-500'>
                  <FiCheck className='h-3.5 w-3.5' />
                </button>
                <button type='button' onClick={() => { setNewCatMode(false); setNewCatVal(''); }}
                  className='flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'>
                  <FiX className='h-3.5 w-3.5' />
                </button>
              </div>
            ) : (
              <button type='button' onClick={() => { setNewCatMode(true); setSearch(''); }}
                className='w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors'>
                <FiPlus className='h-4 w-4' /> Add new category
              </button>
            )}
            <button type='button' onClick={() => { setOpen(false); onOpenManage(); }}
              className='w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors'>
              <FiSettings className='h-4 w-4' /> Manage categories
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

// ── Calendar Picker ───────────────────────────────────────────────────────

function CalendarPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open,     setOpen]     = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef   = useRef<HTMLDivElement>(null);
  const [pos,      setPos]      = useState({ top: 0, left: 0 });
  const [viewDate, setViewDate] = useState<Date>(() => {
    const d = value ? parse(value, 'yyyy-MM-dd', new Date()) : new Date();
    return isValid(d) ? d : new Date();
  });

  const selectedDate = useMemo(() => {
    if (!value) return null;
    const d = parse(value, 'yyyy-MM-dd', new Date());
    return isValid(d) ? d : null;
  }, [value]);

  const displayLabel = selectedDate ? format(selectedDate, 'dd MMM yyyy') : 'Pick a date';

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const r      = triggerRef.current.getBoundingClientRect();
    const panelW = 280;
    const spaceBelow = window.innerHeight - r.bottom;
    const top    = spaceBelow > 320
      ? r.bottom + 8 + window.scrollY
      : r.top - 320 - 8 + window.scrollY;
    const left   = Math.min(r.left + window.scrollX, window.innerWidth + window.scrollX - panelW - 16);
    setPos({ top, left: Math.max(8, left) });
  }, []);

  useEffect(() => { if (open) updatePos(); }, [open, updatePos]);

  useEffect(() => {
    if (!open) return;
    const onMouse = (e: MouseEvent) => {
      if (
        panelRef.current   && !panelRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) setOpen(false);
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
    const end   = endOfWeek(endOfMonth(viewDate),   { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [viewDate]);

  return (
    <>
      <button
        ref={triggerRef}
        type='button'
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center gap-3 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${
          open
            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400'
            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:border-slate-300 dark:hover:border-slate-600'
        }`}
      >
        <FiCalendar className={`h-4 w-4 shrink-0 ${open ? 'text-emerald-500' : 'text-slate-400 dark:text-slate-500'}`} />
        <span className='flex-1 text-left'>{displayLabel}</span>
        <FiChevronDown className={`h-3.5 w-3.5 text-slate-400 dark:text-slate-500 transition-transform ${open ? 'rotate-180 text-emerald-500' : ''}`} />
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          style={{ position: 'absolute', top: pos.top, left: pos.left, zIndex: 9999, width: 280 }}
          className='rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden'
        >
          {/* Month nav */}
          <div className='flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800'>
            <button type='button' onClick={() => setViewDate((d) => addMonths(d, -1))}
              className='flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300'>
              <FiChevronLeft className='h-4 w-4' />
            </button>
            <span className='text-sm font-bold text-slate-800 dark:text-slate-200'>
              {format(viewDate, 'MMMM yyyy')}
            </span>
            <button type='button' onClick={() => setViewDate((d) => addMonths(d, 1))}
              className='flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300'>
              <FiChevronRight className='h-4 w-4' />
            </button>
          </div>

          {/* Day headers */}
          <div className='grid grid-cols-7 px-3 pt-3 pb-1'>
            {['Su','Mo','Tu','We','Th','Fr','Sa'].map((d) => (
              <div key={d} className='text-center text-[10px] font-bold text-slate-400 dark:text-slate-500 pb-1'>{d}</div>
            ))}
          </div>

          {/* Days */}
          <div className='grid grid-cols-7 px-3 pb-3 gap-y-0.5'>
            {days.map((day) => {
              const isSelected   = selectedDate ? isSameDay(day, selectedDate) : false;
              const isCurMonth   = isSameMonth(day, viewDate);
              const isTodayDay   = isToday(day);
              return (
                <button
                  key={day.toISOString()}
                  type='button'
                  onClick={() => { onChange(format(day, 'yyyy-MM-dd')); setOpen(false); }}
                  className={`flex h-8 w-8 mx-auto items-center justify-center rounded-lg text-xs font-medium transition-all ${
                    isSelected
                      ? 'bg-emerald-500 text-white font-bold shadow-md shadow-emerald-500/30'
                      : isTodayDay
                        ? 'border border-emerald-400 dark:border-emerald-600 text-emerald-600 dark:text-emerald-400'
                        : isCurMonth
                          ? 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                          : 'text-slate-300 dark:text-slate-600'
                  }`}
                >
                  {format(day, 'd')}
                </button>
              );
            })}
          </div>

          {/* Quick actions */}
          <div className='px-3 pb-3 pt-2 flex justify-between border-t border-slate-100 dark:border-slate-800'>
            <button type='button' onClick={() => { onChange(''); setOpen(false); }}
              className='text-xs font-bold text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 px-2 py-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800'>
              Clear
            </button>
            <button type='button' onClick={() => { onChange(format(new Date(), 'yyyy-MM-dd')); setOpen(false); }}
              className='text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 px-2 py-1 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20'>
              Today
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────

type Props =
  | { open: boolean; onClose: () => void; mode: 'create'; entry?: undefined }
  | { open: boolean; onClose: () => void; mode: 'edit'; entry: CashflowEntry };

type FormState = {
  type: CashflowType;
  date: string;
  category: string;
  amount: string;
  notes: string;
  accountId: string;
};

function toNum(v: string) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

const TYPE_OPTIONS = [
  { key: 'expense', label: '💸 Expense' },
  { key: 'income',  label: '💰 Income'  },
];

export function UpsertCashflowModal(props: Props) {
  const addCashflow    = usePortfolioStore((s) => s.addCashflow);
  const updateCashflow = usePortfolioStore((s) => s.updateCashflow);
  const accounts       = usePortfolioStore((s) => s.accounts);

  const [showManage, setShowManage] = useState(false);

  const initial = useMemo<FormState>(() => {
    const base: FormState = {
      type: 'expense', date: todayISO(), category: '', amount: '0', notes: '', accountId: '',
    };
    if (props.mode === 'edit') {
      base.type      = props.entry.type;
      base.date      = props.entry.date;
      base.category  = props.entry.category;
      base.amount    = String(props.entry.amount);
      base.notes     = props.entry.notes ?? '';
      base.accountId = props.entry.accountId ?? '';
    }
    return base;
  }, [props.mode, (props as any).entry]);

  const [state,  setState]  = useState<FormState>(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (props.open) setState(initial); }, [props.open, initial]);

  async function onSubmit() {
    setSaving(true);
    try {
      const payload = {
        type:     state.type,
        date:     state.date,
        category: state.category.trim() || 'Other',
        amount:   toNum(state.amount),
        ...(state.notes.trim()  ? { notes:     state.notes.trim()  } : {}),
        ...(state.accountId     ? { accountId: state.accountId     } : {}),
      };
      if (props.mode === 'create') await addCashflow(payload as any);
      else                          await updateCashflow(props.entry.id, payload as any);
      props.onClose();
    } finally {
      setSaving(false);
    }
  }

  const isExpense = state.type === 'expense';
  const accentCls = isExpense
    ? 'bg-rose-500/10 border-rose-500/40 text-rose-600 dark:text-rose-400'
    : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400';
  const inactiveCls =
    'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 ' +
    'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700';

  return (
    <>
      <Modal
        open={props.open}
        onClose={props.onClose}
        title={props.mode === 'create' ? 'Add Transaction' : 'Edit Transaction'}
      >
        <div className='grid grid-cols-1 gap-5'>

          {/* Type + Date */}
          <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
            {/* Type toggle */}
            <div>
              <label className={LABEL_CLS}>Transaction Type</label>
              <div className='flex gap-2'>
                {TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    type='button'
                    onClick={() => setState((s) => ({ ...s, type: opt.key as CashflowType, category: '' }))}
                    className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-bold transition-all ${
                      state.type === opt.key ? accentCls : inactiveCls
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Date */}
            <div>
              <label className={LABEL_CLS}>Date</label>
              <CalendarPicker
                value={state.date}
                onChange={(v) => setState((s) => ({ ...s, date: v }))}
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className={LABEL_CLS}>Category</label>
            <CategoryDropdown
              value={state.category}
              onChange={(v) => setState((s) => ({ ...s, category: v }))}
              type={state.type as 'expense' | 'income'}
              onOpenManage={() => setShowManage(true)}
            />
          </div>

          {/* Amount */}
          <div>
            <label className={LABEL_CLS}>Amount (₹)</label>
            <NumericInput
              className={INPUT_CLS}
              value={state.amount}
              onChange={(v) => setState((s) => ({ ...s, amount: v }))}
            />
          </div>

          {/* Account */}
          {accounts.length > 0 && (
            <div>
              <label className={LABEL_CLS}>Account (Optional)</label>
              <select
                className={INPUT_CLS}
                value={state.accountId}
                onChange={(e) => setState((s) => ({ ...s, accountId: e.target.value }))}
              >
                <option value=''>No Account</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className={LABEL_CLS}>Notes (Optional)</label>
            <input
              className={INPUT_CLS}
              value={state.notes}
              onChange={(e) => setState((s) => ({ ...s, notes: e.target.value }))}
              placeholder='Add any extra details…'
            />
          </div>

          {/* Footer */}
          <div className='flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800 pt-5'>
            <button
              type='button'
              onClick={props.onClose}
              disabled={saving}
              className='rounded-xl px-5 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50'
            >
              Cancel
            </button>
            <button
              type='button'
              onClick={() => void onSubmit()}
              disabled={saving || !state.category.trim() || toNum(state.amount) <= 0}
              className='inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0'
            >
              {saving ? (
                <><FiSave className='h-4 w-4' /> Saving…</>
              ) : props.mode === 'create' ? (
                <><FiPlus className='h-4 w-4' /> Add Entry</>
              ) : (
                <><FiSave className='h-4 w-4' /> Save Changes</>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Manage Categories overlay — rendered outside Modal via portal */}
      {showManage && (
        <ManageCategoriesModal
          type={state.type as 'expense' | 'income'}
          onClose={() => setShowManage(false)}
        />
      )}
    </>
  );
}
