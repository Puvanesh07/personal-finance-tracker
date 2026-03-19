// src/components/cashflow/UpsertCashflowModal.tsx
//
// UPDATED:
//  1. Full FinBoom-style expense category list (Housing, Food, Transport, etc.)
//  2. Full income category list (Salary, Business, Freelance, etc.)
//  3. "Add new category" inline — type and save a custom one permanently
//  4. "Manage categories" modal — toggle visibility of any category (eye icon)
//  5. User categories + hidden preferences saved in localStorage

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

// ── Default Categories (FinBoom-style complete list) ──────────────────────

const DEFAULT_EXPENSE_CATEGORIES = [
  { key: 'Housing & Rent', icon: '🏠' },
  { key: 'Food & Dining', icon: '🍽️' },
  { key: 'Groceries', icon: '🛒' },
  { key: 'Transport', icon: '🚗' },
  { key: 'Healthcare', icon: '🏥' },
  { key: 'Education', icon: '📚' },
  { key: 'Insurance', icon: '🛡️' },
  { key: 'EMI & Loans', icon: '🏦' },
  { key: 'Entertainment', icon: '🎬' },
  { key: 'Utilities', icon: '💡' },
  { key: 'Shopping', icon: '🛍️' },
  { key: 'Investment', icon: '📈' },
  { key: 'Travel & Vacations', icon: '✈️' },
  { key: 'Subscriptions', icon: '📱' },
  { key: 'Personal Care', icon: '💆' },
  { key: 'Transfers & Remittance', icon: '💸' },
  { key: 'Credit Card Payment', icon: '💳' },
  { key: 'Taxes', icon: '🧾' },
  { key: 'Cash Withdrawal', icon: '💵' },
  { key: 'Childcare', icon: '👶' },
  { key: 'Petrol', icon: '⛽' },
  { key: 'Rent', icon: '🏘️' },
  { key: 'Dining', icon: '🍜' },
  { key: 'Other Expense', icon: '📦' },
];

const DEFAULT_INCOME_CATEGORIES = [
  { key: 'Salary', icon: '💼' },
  { key: 'Business', icon: '🏢' },
  { key: 'Freelance', icon: '💻' },
  { key: 'Dividend', icon: '📊' },
  { key: 'Interest', icon: '🏦' },
  { key: 'Rental Income', icon: '🏠' },
  { key: 'Bonus', icon: '🎁' },
  { key: 'Capital Gains', icon: '📈' },
  { key: 'Pension', icon: '👴' },
  { key: 'Refund', icon: '↩️' },
  { key: 'Agriculture Income', icon: '🌾' },
  { key: 'Gift', icon: '🎀' },
  { key: 'Lottery / Prize', icon: '🏆' },
  { key: 'Other Income', icon: '💰' },
];

// ── localStorage keys ─────────────────────────────────────────────────────
const CUSTOM_CATS_KEY = 'fintrackly_custom_categories';
const HIDDEN_CATS_KEY = 'fintrackly_hidden_categories';

type CustomCats = { expense: string[]; income: string[] };
type HiddenCats = { expense: string[]; income: string[] };

function loadCustomCats(): CustomCats {
  try {
    return JSON.parse(
      localStorage.getItem(CUSTOM_CATS_KEY) || '{"expense":[],"income":[]}',
    );
  } catch {
    return { expense: [], income: [] };
  }
}
function saveCustomCats(v: CustomCats) {
  try {
    localStorage.setItem(CUSTOM_CATS_KEY, JSON.stringify(v));
  } catch {}
}
function loadHiddenCats(): HiddenCats {
  try {
    return JSON.parse(
      localStorage.getItem(HIDDEN_CATS_KEY) || '{"expense":[],"income":[]}',
    );
  } catch {
    return { expense: [], income: [] };
  }
}
function saveHiddenCats(v: HiddenCats) {
  try {
    localStorage.setItem(HIDDEN_CATS_KEY, JSON.stringify(v));
  } catch {}
}

// ── Manage Categories Modal ───────────────────────────────────────────────
function ManageCategoriesModal({
  type,
  onClose,
  customCats,
  hiddenCats,
  onToggleHidden,
  onAddCustom,
  onRemoveCustom,
}: {
  type: 'expense' | 'income';
  onClose: () => void;
  customCats: CustomCats;
  hiddenCats: HiddenCats;
  onToggleHidden: (cat: string) => void;
  onAddCustom: (cat: string) => void;
  onRemoveCustom: (cat: string) => void;
}) {
  const [newCat, setNewCat] = useState('');
  const defaults =
    type === 'expense' ? DEFAULT_EXPENSE_CATEGORIES : DEFAULT_INCOME_CATEGORIES;
  const customs = customCats[type];
  const hidden = hiddenCats[type];

  const handleAdd = () => {
    const trimmed = newCat.trim();
    if (!trimmed) return;
    onAddCustom(trimmed);
    setNewCat('');
  };

  return (
    <div className='fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4'>
      <div className='w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl flex flex-col max-h-[85vh]'>
        {/* Header */}
        <div className='flex items-center justify-between px-5 py-4 border-b border-slate-800'>
          <h3 className='text-base font-bold text-slate-100'>
            Manage {type === 'expense' ? 'Expense' : 'Income'} Categories
          </h3>
          <button
            onClick={onClose}
            className='text-slate-500 hover:text-slate-200 transition-colors'
          >
            <FiX className='h-5 w-5' />
          </button>
        </div>

        {/* Category list */}
        <div className='flex-1 overflow-y-auto custom-scrollbar px-4 py-3 flex flex-col gap-1'>
          <p className='text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 px-1'>
            Default Categories
          </p>
          {defaults.map((cat) => {
            const isHidden = hidden.includes(cat.key);
            return (
              <div
                key={cat.key}
                className={`flex items-center justify-between rounded-xl px-3 py-2.5 transition-colors ${isHidden ? 'opacity-40' : 'hover:bg-slate-800/60'}`}
              >
                <div className='flex items-center gap-3'>
                  <span className='text-base'>{cat.icon}</span>
                  <span
                    className={`text-sm font-medium ${isHidden ? 'text-slate-500 line-through' : 'text-slate-200'}`}
                  >
                    {cat.key}
                  </span>
                </div>
                <button
                  onClick={() => onToggleHidden(cat.key)}
                  className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${isHidden ? 'bg-slate-800 text-slate-500 hover:text-slate-200' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}
                  title={isHidden ? 'Show category' : 'Hide category'}
                >
                  {isHidden ? (
                    <FiEyeOff className='h-3.5 w-3.5' />
                  ) : (
                    <FiEye className='h-3.5 w-3.5' />
                  )}
                </button>
              </div>
            );
          })}

          {customs.length > 0 && (
            <>
              <p className='text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-3 mb-2 px-1'>
                Custom Categories
              </p>
              {customs.map((cat) => {
                const isHidden = hidden.includes(cat);
                return (
                  <div
                    key={cat}
                    className={`flex items-center justify-between rounded-xl px-3 py-2.5 transition-colors ${isHidden ? 'opacity-40' : 'hover:bg-slate-800/60'}`}
                  >
                    <div className='flex items-center gap-3'>
                      <span className='text-base'>🏷️</span>
                      <span
                        className={`text-sm font-medium ${isHidden ? 'text-slate-500' : 'text-slate-200'}`}
                      >
                        {cat}
                      </span>
                    </div>
                    <div className='flex items-center gap-1'>
                      <button
                        onClick={() => onToggleHidden(cat)}
                        className='flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors'
                        title={isHidden ? 'Show' : 'Hide'}
                      >
                        {isHidden ? (
                          <FiEyeOff className='h-3.5 w-3.5' />
                        ) : (
                          <FiEye className='h-3.5 w-3.5' />
                        )}
                      </button>
                      <button
                        onClick={() => onRemoveCustom(cat)}
                        className='flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors'
                        title='Delete custom category'
                      >
                        <FiX className='h-3.5 w-3.5' />
                      </button>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Add new category */}
        <div className='px-4 py-4 border-t border-slate-800'>
          <p className='text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2'>
            Add New Category
          </p>
          <div className='flex gap-2'>
            <input
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder='e.g. Dog Food, Gym…'
              className='flex-1 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-100 outline-none focus:border-emerald-500/60 placeholder:text-slate-600'
              autoFocus
            />
            <button
              onClick={handleAdd}
              disabled={!newCat.trim()}
              className='flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors'
            >
              <FiPlus className='h-4 w-4' /> Add
            </button>
          </div>
        </div>

        <div className='px-4 pb-4'>
          <button
            onClick={onClose}
            className='w-full rounded-xl bg-slate-800 hover:bg-slate-700 px-4 py-2.5 text-sm font-bold text-slate-200 transition-colors'
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
  customCats,
  hiddenCats,
  onOpenManage,
  onAddCustom,
}: {
  value: string;
  onChange: (v: string) => void;
  type: 'expense' | 'income';
  customCats: CustomCats;
  hiddenCats: HiddenCats;
  onOpenManage: () => void;
  onAddCustom: (cat: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [newCatMode, setNewCatMode] = useState(false);
  const [newCatVal, setNewCatVal] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  const defaults =
    type === 'expense' ? DEFAULT_EXPENSE_CATEGORIES : DEFAULT_INCOME_CATEGORIES;
  const hidden = hiddenCats[type];
  const customs = customCats[type];

  const allCategories = useMemo(() => {
    const customWithIcon = customs.map((c) => ({ key: c, icon: '🏷️' }));
    return [...defaults, ...customWithIcon].filter(
      (c) => !hidden.includes(c.key),
    );
  }, [defaults, customs, hidden]);

  const filtered = useMemo(() => {
    if (!search.trim()) return allCategories;
    return allCategories.filter((c) =>
      c.key.toLowerCase().includes(search.toLowerCase()),
    );
  }, [allCategories, search]);

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const panelW = Math.max(r.width, 280);
    const rawLeft = r.left + window.scrollX;
    const clampedLeft = Math.min(
      rawLeft,
      window.innerWidth + window.scrollX - panelW - 16,
    );
    const spaceBelow = window.innerHeight - r.bottom;
    const panelH = 380;
    const top =
      spaceBelow > panelH
        ? r.bottom + 8 + window.scrollY
        : r.top - panelH - 8 + window.scrollY;
    setPos({ top, left: Math.max(8, clampedLeft), width: panelW });
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

  const selectedCat =
    allCategories.find((c) => c.key === value) ??
    (value ? { key: value, icon: '🏷️' } : null);

  const handleAddNew = () => {
    const trimmed = newCatVal.trim();
    if (!trimmed) return;
    onAddCustom(trimmed);
    onChange(trimmed);
    setNewCatVal('');
    setNewCatMode(false);
    setOpen(false);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type='button'
        onClick={() => {
          setOpen((v) => !v);
          setSearch('');
          setNewCatMode(false);
        }}
        className={`flex w-full items-center justify-between rounded-xl border px-4 py-2.5 text-sm transition-all duration-200 ${
          open
            ? 'border-emerald-500/50 bg-slate-800 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
            : 'border-slate-700/80 bg-slate-900/50 hover:bg-slate-800/60'
        }`}
      >
        <div className='flex items-center gap-2.5'>
          {selectedCat ? (
            <>
              <span className='text-base leading-none'>{selectedCat.icon}</span>
              <span className='font-medium text-slate-100'>
                {selectedCat.key}
              </span>
            </>
          ) : (
            <span className='text-slate-500'>Select a category</span>
          )}
        </div>
        <FiChevronDown
          className={`h-3.5 w-3.5 transition-transform duration-200 text-slate-500 ${open ? 'rotate-180 text-emerald-400' : ''}`}
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
              maxHeight: 380,
            }}
            className='flex flex-col rounded-xl border border-slate-800 bg-slate-900/98 shadow-2xl backdrop-blur-xl overflow-hidden'
          >
            {/* Search bar */}
            <div className='flex items-center gap-2 px-3 py-2.5 border-b border-slate-800'>
              <FiSearch className='h-3.5 w-3.5 text-slate-500 shrink-0' />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder='Search categories…'
                className='flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-600'
                autoFocus
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className='text-slate-500 hover:text-slate-300'
                >
                  <FiX className='h-3.5 w-3.5' />
                </button>
              )}
            </div>

            {/* Categories list */}
            <div className='flex-1 overflow-y-auto custom-scrollbar p-1.5 flex flex-col'>
              {filtered.length === 0 ? (
                <div className='px-3 py-4 text-center text-xs text-slate-500'>
                  No categories found
                </div>
              ) : (
                filtered.map((cat) => (
                  <button
                    key={cat.key}
                    type='button'
                    onClick={() => {
                      onChange(cat.key);
                      setOpen(false);
                    }}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all text-left ${
                      value === cat.key
                        ? 'bg-emerald-500/10 text-emerald-400 font-semibold'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-slate-100'
                    }`}
                  >
                    <span className='text-base leading-none w-5 text-center'>
                      {cat.icon}
                    </span>
                    <span className='flex-1'>{cat.key}</span>
                    {value === cat.key && (
                      <FiCheck className='h-4 w-4 shrink-0' />
                    )}
                  </button>
                ))
              )}
            </div>

            {/* Footer actions */}
            <div className='border-t border-slate-800 p-1.5 flex flex-col gap-0.5'>
              {/* Add new category inline */}
              {newCatMode ? (
                <div className='flex items-center gap-2 px-2 py-1.5'>
                  <input
                    value={newCatVal}
                    onChange={(e) => setNewCatVal(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddNew();
                      if (e.key === 'Escape') {
                        setNewCatMode(false);
                        setNewCatVal('');
                      }
                    }}
                    placeholder='New category name…'
                    className='flex-1 rounded-lg border border-emerald-500/40 bg-slate-800 px-3 py-1.5 text-sm text-slate-100 outline-none focus:border-emerald-500 placeholder:text-slate-600'
                    autoFocus
                  />
                  <button
                    onClick={handleAddNew}
                    disabled={!newCatVal.trim()}
                    className='flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white disabled:opacity-50'
                  >
                    <FiCheck className='h-3.5 w-3.5' />
                  </button>
                  <button
                    onClick={() => {
                      setNewCatMode(false);
                      setNewCatVal('');
                    }}
                    className='flex h-7 w-7 items-center justify-center rounded-lg bg-slate-700 text-slate-300'
                  >
                    <FiX className='h-3.5 w-3.5' />
                  </button>
                </div>
              ) : (
                <button
                  type='button'
                  onClick={() => {
                    setNewCatMode(true);
                    setSearch('');
                  }}
                  className='flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-emerald-400 hover:bg-emerald-500/10 transition-colors'
                >
                  <FiPlus className='h-4 w-4' />
                  Add new category
                </button>
              )}
              <button
                type='button'
                onClick={() => {
                  setOpen(false);
                  onOpenManage();
                }}
                className='flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-400 hover:bg-slate-800 transition-colors'
              >
                <FiSettings className='h-4 w-4' />
                Manage categories
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

// ── Calendar Picker ────────────────────────────────────────────────────────
function CalendarPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
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
    const panelW = 280;
    const spaceBelow = window.innerHeight - r.bottom;
    const top =
      spaceBelow > 320
        ? r.bottom + 8 + window.scrollY
        : r.top - 320 - 8 + window.scrollY;
    const left = Math.min(
      r.left + window.scrollX,
      window.innerWidth + window.scrollX - panelW - 16,
    );
    setPos({ top, left: Math.max(8, left) });
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
    <>
      <button
        ref={triggerRef}
        type='button'
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center gap-3 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all duration-200 ${open ? 'border-emerald-500/50 bg-slate-800 text-emerald-400' : 'border-slate-700/80 bg-slate-900/50 hover:bg-slate-800/60 text-slate-100'}`}
      >
        <FiCalendar
          className={`h-4 w-4 shrink-0 transition-colors ${open ? 'text-emerald-400' : 'text-slate-500'}`}
        />
        <span className='flex-1 text-left'>{displayLabel}</span>
        <FiChevronDown
          className={`h-3.5 w-3.5 transition-transform duration-200 text-slate-500 ${open ? 'rotate-180 text-emerald-400' : ''}`}
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
                className='flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              >
                <FiChevronLeft className='h-4 w-4' />
              </button>
              <span className='text-sm font-bold text-slate-200'>
                {format(viewDate, 'MMMM yyyy')}
              </span>
              <button
                type='button'
                onClick={() => setViewDate((d) => addMonths(d, 1))}
                className='flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-100'
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
                    className={`flex h-8 w-8 mx-auto items-center justify-center rounded-lg text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-500/30'
                        : isTodayDay
                          ? 'border border-emerald-500/40 text-emerald-400'
                          : isCurMonth
                            ? 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'
                            : 'text-slate-600 hover:bg-slate-800/50'
                    }`}
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

// ─────────────────────────────────────────────────────────────────────────

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
  { key: 'income', label: '💰 Income' },
];

export function UpsertCashflowModal(props: Props) {
  const addCashflow = usePortfolioStore((s) => s.addCashflow);
  const updateCashflow = usePortfolioStore((s) => s.updateCashflow);
  const accounts = usePortfolioStore((s) => s.accounts);

  // Category state from localStorage
  const [customCats, setCustomCats] = useState<CustomCats>(loadCustomCats);
  const [hiddenCats, setHiddenCats] = useState<HiddenCats>(loadHiddenCats);
  const [showManage, setShowManage] = useState(false);

  const accountOptions = [
    { key: '', label: 'No Account' },
    ...accounts.map((a) => ({ key: a.id, label: a.name })),
  ];

  const initial = useMemo<FormState>(() => {
    const base: FormState = {
      type: 'expense',
      date: todayISO(),
      category: '',
      amount: '0',
      notes: '',
      accountId: '',
    };
    if (props.mode === 'edit') {
      base.type = props.entry.type;
      base.date = props.entry.date;
      base.category = props.entry.category;
      base.amount = String(props.entry.amount);
      base.notes = props.entry.notes ?? '';
      base.accountId = props.entry.accountId ?? '';
    }
    return base;
  }, [props.mode, (props as any).entry]);

  const [state, setState] = useState<FormState>(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (props.open) setState(initial);
  }, [props.open, initial]);

  const handleToggleHidden = (cat: string) => {
    const type = state.type as 'expense' | 'income';
    const updated = {
      ...hiddenCats,
      [type]: hiddenCats[type].includes(cat)
        ? hiddenCats[type].filter((c) => c !== cat)
        : [...hiddenCats[type], cat],
    };
    setHiddenCats(updated);
    saveHiddenCats(updated);
  };

  const handleAddCustom = (cat: string) => {
    const type = state.type as 'expense' | 'income';
    if (customCats[type].includes(cat)) return;
    const updated = { ...customCats, [type]: [...customCats[type], cat] };
    setCustomCats(updated);
    saveCustomCats(updated);
  };

  const handleRemoveCustom = (cat: string) => {
    const type = state.type as 'expense' | 'income';
    const updated = {
      ...customCats,
      [type]: customCats[type].filter((c) => c !== cat),
    };
    setCustomCats(updated);
    saveCustomCats(updated);
  };

  async function onSubmit() {
    setSaving(true);
    try {
      const payload = {
        type: state.type,
        date: state.date,
        category: state.category.trim() || 'Other',
        amount: toNum(state.amount),
        ...(state.notes.trim() ? { notes: state.notes.trim() } : {}),
        ...(state.accountId ? { accountId: state.accountId } : {}),
      };
      if (props.mode === 'create') await addCashflow(payload as any);
      else await updateCashflow(props.entry.id, payload as any);
      props.onClose();
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    'w-full rounded-xl border border-slate-700/80 bg-slate-900/50 px-4 py-2.5 text-sm font-medium text-slate-100 shadow-sm outline-none transition-all focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 placeholder:text-slate-600';
  const labelCls =
    'text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block';

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
            {/* Type toggle pills */}
            <div>
              <label className={labelCls}>Transaction Type</label>
              <div className='flex gap-2'>
                {TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    type='button'
                    onClick={() =>
                      setState((s) => ({
                        ...s,
                        type: opt.key as CashflowType,
                        category: '',
                      }))
                    }
                    className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-bold transition-all ${
                      state.type === opt.key
                        ? opt.key === 'expense'
                          ? 'bg-rose-500/15 border-rose-500/40 text-rose-400'
                          : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                        : 'border-slate-700/80 bg-slate-900/50 text-slate-400 hover:bg-slate-800/60'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Date */}
            <div>
              <label className={labelCls}>Date</label>
              <CalendarPicker
                value={state.date}
                onChange={(v) => setState((s) => ({ ...s, date: v }))}
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className={labelCls}>Category</label>
            <CategoryDropdown
              value={state.category}
              onChange={(v) => setState((s) => ({ ...s, category: v }))}
              type={state.type as 'expense' | 'income'}
              customCats={customCats}
              hiddenCats={hiddenCats}
              onOpenManage={() => setShowManage(true)}
              onAddCustom={handleAddCustom}
            />
          </div>

          {/* Amount */}
          <div>
            <label className={labelCls}>Amount (₹)</label>
            <NumericInput
              className={inputCls}
              value={state.amount}
              onChange={(v) => setState((s) => ({ ...s, amount: v }))}
            />
          </div>

          {/* Account */}
          {accounts.length > 0 && (
            <div>
              <label className={labelCls}>Account (Optional)</label>
              <select
                className={inputCls}
                value={state.accountId}
                onChange={(e) =>
                  setState((s) => ({ ...s, accountId: e.target.value }))
                }
              >
                {accountOptions.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className={labelCls}>Notes (Optional)</label>
            <input
              className={inputCls}
              value={state.notes}
              onChange={(e) =>
                setState((s) => ({ ...s, notes: e.target.value }))
              }
              placeholder='Add any extra details…'
            />
          </div>

          {/* Footer */}
          <div className='flex items-center justify-end gap-3 border-t border-slate-800/60 pt-5'>
            <button
              type='button'
              className='rounded-xl px-5 py-2.5 text-sm font-bold text-slate-400 hover:bg-slate-800'
              onClick={props.onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type='button'
              className='inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:hover:translate-y-0'
              onClick={() => void onSubmit()}
              disabled={
                saving || !state.category.trim() || toNum(state.amount) <= 0
              }
            >
              {saving ? (
                <>
                  <FiSave className='h-4 w-4' />
                  <span>Saving…</span>
                </>
              ) : props.mode === 'create' ? (
                <>
                  <FiPlus className='h-4 w-4' />
                  <span>Add Entry</span>
                </>
              ) : (
                <>
                  <FiSave className='h-4 w-4' />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Manage Categories overlay */}
      {showManage && (
        <ManageCategoriesModal
          type={state.type as 'expense' | 'income'}
          onClose={() => setShowManage(false)}
          customCats={customCats}
          hiddenCats={hiddenCats}
          onToggleHidden={handleToggleHidden}
          onAddCustom={handleAddCustom}
          onRemoveCustom={handleRemoveCustom}
        />
      )}
    </>
  );
}
