// src/components/cashflow/UpsertCashflowModal.tsx
//
// Two-step entry flow:
//   Step 1 — what kind of entry + category (+ subcategory when the category
//            has them, e.g. 🚜 Agriculture)
//   Step 2 — the money details: type, amount, date, account, notes
//
// Subcategories are just an optional `subcategory` string on the normal
// CashflowEntry, so Agriculture behaves exactly like every other category in
// the store, exports, charts and the AI — it only gains a drill-down level.
//
// Category/subcategory definitions live in utils/cashflowCategories so the
// filter bar and the AI share one source of truth.

import type { CashflowEntry, CashflowType } from '../../types/investmentTypes';
import {
  FiArrowLeft,
  FiCheck,
  FiPlus,
  FiSave,
  FiSearch,
  FiSettings,
  FiTrash2,
  FiX,
} from 'react-icons/fi';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Modal } from '../ui/Modal';
import { Select } from '../ui/Select';
import { NumericInput } from '../ui/NumericInput';
import { CalendarPicker } from '../ui/CalendarPicker';
import { todayISO } from '../../utils/dateUtils';
import { usePortfolioStore } from '../../store/portfolioStore';
import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
  categoryIcon,
  defaultCategoriesFor,
  getSubcategoryOptions,
  subcategoryIcon,
  type CategoryDef,
} from '../../utils/cashflowCategories';

// Kept for existing importers (ImportCashflowModal, QuickAddFAB).
export { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES };

// ── Shared className helpers (light + dark) ───────────────────────────────

const INPUT_CLS =
  'fx-field w-full rounded-xl px-4 py-2.5 text-sm font-medium shadow-sm outline-none transition-all';

const LABEL_CLS =
  'text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 block';

const ROW_CLS = 'fx-menu-item flex items-center justify-between rounded-xl px-3 py-2.5';

const ICON_BTN_CLS =
  'fx-control flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg';

const TILE_CLS =
  'fx-tile cursor-pointer px-2.5 py-2 text-[13px] font-semibold leading-tight';

const ADD_TILE_CLS =
  'flex cursor-pointer items-center gap-1.5 rounded-xl border border-dashed px-2.5 py-2 text-[13px] font-bold transition-colors';

// ── Small building blocks ─────────────────────────────────────────────────

function TypeToggle({
  value,
  onChange,
  onCategoryReset,
}: {
  value: CashflowType;
  onChange: (v: CashflowType) => void;
  onCategoryReset: () => void;
}) {
  const options: { key: CashflowType; label: string }[] = [
    { key: 'expense', label: '💸 Expense' },
    { key: 'income', label: '💰 Income' },
  ];
  const accentCls =
    value === 'expense'
      ? 'border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400'
      : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
  return (
    <div className='flex gap-2'>
      {options.map((opt) => (
        <button
          key={opt.key}
          type='button'
          onClick={() => {
            if (opt.key === value) return;
            onChange(opt.key);
            onCategoryReset();
          }}
          className={`flex-1 cursor-pointer rounded-xl border px-4 py-2.5 text-sm font-bold transition-all ${
            value === opt.key ? accentCls : 'fx-control'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/** Inline "＋ Add new …" row used for both categories and subcategories. */
function InlineAddRow({
  placeholder,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  placeholder: string;
  submitLabel: string;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState('');
  return (
    <div className='flex items-center gap-2'>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && value.trim()) onSubmit(value.trim());
          if (e.key === 'Escape') onCancel();
        }}
        placeholder={placeholder}
        className='fx-field flex-1 rounded-lg px-3 py-2 text-sm outline-none'
        autoFocus
      />
      <button
        type='button'
        disabled={!value.trim()}
        onClick={() => value.trim() && onSubmit(value.trim())}
        className='fx-btn-primary flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg'
        title={submitLabel}
      >
        <FiCheck className='h-4 w-4' />
      </button>
      <button
        type='button'
        onClick={onCancel}
        className='fx-control flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg'
        title='Cancel'
      >
        <FiX className='h-4 w-4' />
      </button>
    </div>
  );
}

/** Icon-tile picker: tap-friendly on a phone, compact on a laptop. */
function TilePicker({
  label,
  options,
  value,
  onSelect,
  onAddRequest,
  adding,
  onAdd,
  onAddCancel,
  addLabel,
  addPlaceholder,
  columns = 'grid-cols-2 sm:grid-cols-3',
  maxHeight = 'max-h-[38vh]',
}: {
  label: string;
  options: CategoryDef[];
  value: string;
  onSelect: (v: string) => void;
  onAddRequest: () => void;
  adding: boolean;
  onAdd: (name: string) => void;
  onAddCancel: () => void;
  addLabel: string;
  addPlaceholder: string;
  columns?: string;
  maxHeight?: string;
}) {
  return (
    <div className='min-w-0'>
      <div className='flex items-center justify-between gap-2'>
        <label className={LABEL_CLS}>{label}</label>
        {options.length > 0 && (
          <span className='mb-1.5 text-[11px] font-semibold text-slate-400 dark:text-slate-400'>
            {options.length}
          </span>
        )}
      </div>
      <div className={`grid gap-2 overflow-y-auto pr-0.5 ${columns} ${maxHeight}`}>
        {options.map((opt) => {
          const active = value === opt.key;
          return (
            <button
              key={opt.key}
              type='button'
              aria-pressed={active}
              onClick={() => onSelect(opt.key)}
              className={`${TILE_CLS} ${active ? 'is-active' : ''}`}
            >
              <span className='text-base leading-none'>{opt.icon}</span>
              <span className='min-w-0 flex-1 truncate'>{opt.key}</span>
              {active && <FiCheck className='h-3.5 w-3.5 shrink-0' />}
            </button>
          );
        })}
        {adding ? (
          <div className={`col-span-2 ${columns}`}>
            <InlineAddRow
              placeholder={addPlaceholder}
              submitLabel={addLabel}
              onSubmit={onAdd}
              onCancel={onAddCancel}
            />
          </div>
        ) : (
          <button
            type='button'
            onClick={onAddRequest}
            className={`${ADD_TILE_CLS} border-emerald-300/70 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-500/40 dark:text-emerald-400 dark:hover:bg-emerald-500/10`}
          >
            <FiPlus className='h-3.5 w-3.5 shrink-0' />
            <span className='truncate'>{addLabel}</span>
          </button>
        )}
      </div>
    </div>
  );
}

// ── Manage Categories Modal ───────────────────────────────────────────────

function ManageCategoriesModal({
  type,
  category,
  onClose,
}: {
  type: 'expense' | 'income';
  /** When the caller has a category with subcategories selected, its
   *  subcategories become manageable from the same place. */
  category?: string;
  onClose: () => void;
}) {
  const customCategories = usePortfolioStore((s) => s.customCategories);
  const hiddenCategories = usePortfolioStore((s) => s.hiddenCategories);
  const addCustomCategory = usePortfolioStore((s) => s.addCustomCategory);
  const removeCustomCategory = usePortfolioStore((s) => s.removeCustomCategory);
  const toggleHiddenCategory = usePortfolioStore((s) => s.toggleHiddenCategory);
  const customSubcategories = usePortfolioStore((s) => s.customSubcategories);
  const addCustomSubcategory = usePortfolioStore((s) => s.addCustomSubcategory);
  const removeCustomSubcategory = usePortfolioStore((s) => s.removeCustomSubcategory);

  const [newCat, setNewCat] = useState('');
  const [newSub, setNewSub] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const defaults = defaultCategoriesFor(type);
  const customs = customCategories[type];
  const hidden = hiddenCategories[type];
  const subOptions = category ? getSubcategoryOptions(category, customSubcategories) : [];
  const customSubs = customSubcategories[category ?? ''] ?? [];

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

  const handleAddSub = async () => {
    const trimmed = newSub.trim();
    if (!trimmed || saving || !category) return;
    setSaving(true);
    try {
      await addCustomSubcategory(category, trimmed);
      setNewSub('');
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
            <p className='text-[11px] text-slate-400 dark:text-slate-400 mt-0.5'>
              Toggle visibility · Add custom · Delete custom
            </p>
          </div>
          <button
            type='button'
            onClick={onClose}
            className='fx-control flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg'
            aria-label='Close'
          >
            <FiX className='h-4 w-4' />
          </button>
        </div>

        {/* Category list */}
        <div className='flex-1 overflow-y-auto px-4 py-3 space-y-0.5'>
          <p className='text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 mb-2 px-1'>
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
                  <span className={`text-sm font-medium ${isHidden ? 'line-through' : ''}`}>
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
                    ? <FiX className='h-3.5 w-3.5' />
                    : <FiCheck className='h-3.5 w-3.5' />
                  }
                </button>
              </div>
            );
          })}

          {customs.length > 0 && (
            <>
              <p className='text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 mt-4 mb-2 px-1'>
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
                      <span className={`text-sm font-medium ${isHidden ? 'line-through' : ''}`}>
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
                          ? <FiX className='h-3.5 w-3.5' />
                          : <FiCheck className='h-3.5 w-3.5' />
                        }
                      </button>
                      <button
                        type='button'
                        onClick={() => void removeCustomCategory(type, cat)}
                        className={`${ICON_BTN_CLS} text-rose-500 hover:text-rose-600 dark:text-rose-400`}
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

          {/* Subcategories of the selected category */}
          {category && subOptions.length > 0 && (
            <>
              <p className='text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 mt-5 mb-2 px-1'>
                {categoryIcon(category)} {category} · Subcategories ({subOptions.length})
              </p>
              {subOptions.map((sub) => {
                const removable = customSubs.includes(sub.key);
                return (
                  <div key={sub.key} className={ROW_CLS}>
                    <div className='flex items-center gap-3'>
                      <span className='text-base w-6 text-center'>{sub.icon}</span>
                      <span className='text-sm font-medium'>{sub.key}</span>
                      {!removable && (
                        <span className='rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400'>
                          Built-in
                        </span>
                      )}
                    </div>
                    {removable && (
                      <button
                        type='button'
                        onClick={() => void removeCustomSubcategory(category, sub.key)}
                        className={`${ICON_BTN_CLS} text-rose-500 hover:text-rose-600 dark:text-rose-400`}
                        title='Delete custom subcategory'
                      >
                        <FiTrash2 className='h-3.5 w-3.5' />
                      </button>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Add new */}
        <div className='px-4 pb-4 pt-3 border-t border-slate-200 dark:border-slate-700 shrink-0 space-y-2'>
          <p className='text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400'>
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
            />
            <button
              type='button'
              onClick={() => void handleAdd()}
              disabled={!newCat.trim() || saving}
              className='fx-btn-primary flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold whitespace-nowrap disabled:cursor-not-allowed'
            >
              {saving ? '…' : <><FiPlus className='h-4 w-4' /> Add</>}
            </button>
          </div>
          {category && subOptions.length > 0 && (
            <>
              <p className='pt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400'>
                Add New {category} Subcategory
              </p>
              <div className='flex gap-2'>
                <input
                  value={newSub}
                  onChange={(e) => setNewSub(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleAddSub(); }}
                  placeholder='e.g. Groundnut, Coconut…'
                  className={INPUT_CLS}
                />
                <button
                  type='button'
                  onClick={() => void handleAddSub()}
                  disabled={!newSub.trim() || saving}
                  className='fx-btn-primary flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold whitespace-nowrap disabled:cursor-not-allowed'
                >
                  <FiPlus className='h-4 w-4' /> Add
                </button>
              </div>
            </>
          )}
          <button
            type='button'
            onClick={onClose}
            className='fx-control w-full cursor-pointer rounded-xl py-2.5 text-sm font-bold'
          >
            Done
          </button>
        </div>
      </div>
    </div>
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
  subcategory: string;
  amount: string;
  notes: string;
  accountId: string;
};

function toNum(v: string) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function UpsertCashflowModal(props: Props) {
  const addCashflow = usePortfolioStore((s) => s.addCashflow);
  const updateCashflow = usePortfolioStore((s) => s.updateCashflow);
  const accounts = usePortfolioStore((s) => s.accounts);
  const customCategories = usePortfolioStore((s) => s.customCategories);
  const hiddenCategories = usePortfolioStore((s) => s.hiddenCategories);
  const addCustomCategory = usePortfolioStore((s) => s.addCustomCategory);
  const customSubcategories = usePortfolioStore((s) => s.customSubcategories);
  const addCustomSubcategory = usePortfolioStore((s) => s.addCustomSubcategory);

  const [showManage, setShowManage] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [catSearch, setCatSearch] = useState('');
  const [addingCat, setAddingCat] = useState(false);
  const [addingSub, setAddingSub] = useState(false);
  const advanceTimer = useRef<number | null>(null);

  const initial = useMemo<FormState>(() => {
    const base: FormState = {
      type: 'expense', date: todayISO(), category: '', subcategory: '',
      amount: '0', notes: '', accountId: '',
    };
    if (props.mode === 'edit') {
      base.type = props.entry.type;
      base.date = props.entry.date;
      base.category = props.entry.category;
      base.subcategory = props.entry.subcategory ?? '';
      base.amount = String(props.entry.amount);
      base.notes = props.entry.notes ?? '';
      base.accountId = props.entry.accountId ?? '';
    }
    return base;
  }, [props.mode, (props as any).entry]);

  const [state, setState] = useState<FormState>(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!props.open) return;
    setState(initial);
    // Editing an existing entry goes straight to the details; creating one
    // starts at the category picker so the subcategory is never skipped.
    setStep(props.mode === 'edit' ? 2 : 1);
    setCatSearch('');
    setAddingCat(false);
    setAddingSub(false);
  }, [props.open, initial, props.mode]);

  useEffect(
    () => () => {
      if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    },
    [],
  );

  // ── Options ────────────────────────────────────────────────────────────
  const categoryOptions = useMemo(() => {
    const type = state.type as 'expense' | 'income';
    const customs = customCategories[type].map((c) => ({ key: c, icon: '🏷️' }));
    const all = [...defaultCategoriesFor(type), ...customs].filter(
      (c) => !hiddenCategories[type].includes(c.key),
    );
    const q = catSearch.trim().toLowerCase();
    return q ? all.filter((c) => c.key.toLowerCase().includes(q)) : all;
  }, [state.type, customCategories, hiddenCategories, catSearch]);

  const subcategoryOptions = useMemo(
    () => getSubcategoryOptions(state.category, customSubcategories),
    [state.category, customSubcategories],
  );
  const usesSubcategories = subcategoryOptions.length > 0;

  const step1Complete =
    !!state.category.trim() && (!usesSubcategories || !!state.subcategory);
  const canSave = step1Complete && toNum(state.amount) > 0;

  // ── Handlers ───────────────────────────────────────────────────────────
  const pickCategory = (key: string) => {
    setState((s) => ({ ...s, category: key, subcategory: '' }));
    setAddingSub(false);
    setCatSearch('');
  };

  const pickSubcategory = (key: string) => {
    setState((s) => ({ ...s, subcategory: key }));
    setAddingSub(false);
    // One less tap on a phone: the details step is the only thing left.
    if (props.mode === 'create') {
      if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
      advanceTimer.current = window.setTimeout(() => setStep(2), 180);
    }
  };

  const handleAddCategory = async (name: string) => {
    await addCustomCategory(state.type as 'expense' | 'income', name);
    setAddingCat(false);
    setState((s) => ({ ...s, category: name, subcategory: '' }));
  };

  const handleAddSubcategory = async (name: string) => {
    await addCustomSubcategory(state.category, name);
    setAddingSub(false);
    setState((s) => ({ ...s, subcategory: name }));
  };

  async function onSubmit() {
    setSaving(true);
    try {
      const payload = {
        type: state.type,
        date: state.date,
        category: state.category.trim() || 'Other',
        amount: toNum(state.amount),
        ...(state.subcategory ? { subcategory: state.subcategory } : {}),
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

  const subtitle =
    step === 1
      ? `Step 1 of 2 · Category${usesSubcategories ? ' + subcategory' : ''}`
      : 'Step 2 of 2 · Transaction details';

  const stepper = (
    <div className='mb-4 flex items-center gap-2'>
      {[1, 2].map((n) => (
        <div
          key={n}
          className={`h-1.5 flex-1 rounded-full transition-colors ${
            step === n
              ? 'bg-emerald-500'
              : 'bg-slate-200 dark:bg-slate-700'
          }`}
        />
      ))}
      <span className='shrink-0 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400'>
        {step}/2
      </span>
    </div>
  );

  /** Always visible above the soft keyboard: Back · Cancel · Next/Save. */
  const footer = (
    <div
      className='sticky bottom-0 -mx-5 -mb-5 mt-5 flex items-center gap-2 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:-mb-6 sm:px-6 dark:border-slate-800 dark:bg-slate-900/95'
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      {step === 2 && (
        <button
          type='button'
          onClick={() => setStep(1)}
          className='fx-btn-ghost inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-bold'
        >
          <FiArrowLeft className='h-4 w-4' />
          <span className='hidden sm:inline'>Back</span>
        </button>
      )}
      <button
        type='button'
        onClick={props.onClose}
        disabled={saving}
        className='fx-btn-ghost ml-auto rounded-xl px-4 py-2.5 text-sm font-bold disabled:cursor-not-allowed'
      >
        Cancel
      </button>
      {step === 1 ? (
        <button
          type='button'
          disabled={!step1Complete}
          onClick={() => setStep(2)}
          className='fx-btn-primary inline-flex cursor-pointer items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold disabled:cursor-not-allowed'
        >
          Next
          <FiArrowRightish />
        </button>
      ) : (
        <button
          type='button'
          onClick={() => void onSubmit()}
          disabled={saving || !canSave}
          className='fx-btn-primary inline-flex cursor-pointer items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold disabled:cursor-not-allowed'
        >
          {saving ? (
            <><FiSave className='h-4 w-4' /> Saving…</>
          ) : props.mode === 'create' ? (
            <><FiPlus className='h-4 w-4' /> Add Entry</>
          ) : (
            <><FiSave className='h-4 w-4' /> Save Changes</>
          )}
        </button>
      )}
    </div>
  );

  return (
    <>
      <Modal
        open={props.open}
        onClose={props.onClose}
        title={props.mode === 'create' ? 'Add Transaction' : 'Edit Transaction'}
        subtitle={subtitle}
      >
        {stepper}

        {step === 1 ? (
          <div className='grid grid-cols-1 gap-5'>
            <div>
              <label className={LABEL_CLS}>Transaction Type</label>
              <TypeToggle
                value={state.type}
                onChange={(v) => setState((s) => ({ ...s, type: v }))}
                onCategoryReset={() => setState((s) => ({ ...s, category: '', subcategory: '' }))}
              />
            </div>

            {categoryOptions.length > 8 && (
              <div className='fx-field flex items-center gap-2 rounded-xl px-3 py-2'>
                <FiSearch className='h-3.5 w-3.5 shrink-0 opacity-60' />
                <input
                  value={catSearch}
                  onChange={(e) => setCatSearch(e.target.value)}
                  placeholder='Search categories…'
                  className='w-full bg-transparent text-sm outline-none'
                />
                {catSearch && (
                  <button
                    type='button'
                    onClick={() => setCatSearch('')}
                    className='fx-btn-ghost cursor-pointer rounded-md p-1'
                    aria-label='Clear search'
                  >
                    <FiX className='h-3.5 w-3.5' />
                  </button>
                )}
              </div>
            )}

            <div className={`grid gap-5 ${usesSubcategories ? 'md:grid-cols-2' : ''}`}>
              <TilePicker
                label='Category'
                options={categoryOptions}
                value={state.category}
                onSelect={pickCategory}
                adding={addingCat}
                onAddRequest={() => { setAddingCat(true); setAddingSub(false); }}
                onAdd={(name) => void handleAddCategory(name)}
                onAddCancel={() => setAddingCat(false)}
                addLabel='Add new category'
                addPlaceholder='New category name…'
                columns={usesSubcategories ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}
              />

              {/* Subcategories appear the moment a category that has them is
                  picked (🚜 Agriculture), including brand-new user ones. */}
              {usesSubcategories && (
                <TilePicker
                  label={`${categoryIcon(state.category)} ${state.category} · Subcategory`}
                  options={subcategoryOptions}
                  value={state.subcategory}
                  onSelect={pickSubcategory}
                  adding={addingSub}
                  onAddRequest={() => { setAddingSub(true); setAddingCat(false); }}
                  onAdd={(name) => void handleAddSubcategory(name)}
                  onAddCancel={() => setAddingSub(false)}
                  addLabel='Add new subcategory'
                  addPlaceholder='New subcategory name…'
                  columns='grid-cols-2'
                  maxHeight='max-h-[38vh]'
                />
              )}
            </div>

            <button
              type='button'
              onClick={() => setShowManage(true)}
              className='fx-btn-ghost inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-xs font-bold'
            >
              <FiSettings className='h-3.5 w-3.5' /> Manage categories
            </button>
          </div>
        ) : (
          <div className='grid grid-cols-1 gap-5'>
            {/* What was chosen in step 1 — one tap to go back and change it. */}
            <button
              type='button'
              onClick={() => setStep(1)}
              className={`${TILE_CLS} w-full cursor-pointer py-2.5`}
            >
              <span className='text-base leading-none'>
                {categoryIcon(state.category)}
                {state.subcategory ? (
                  <span className='ml-0.5'>{subcategoryIcon(state.subcategory)}</span>
                ) : null}
              </span>
              <span className='min-w-0 flex-1 truncate text-slate-900 dark:text-slate-100'>
                {state.category || 'No category'}
                {state.subcategory && (
                  <span className='font-normal opacity-70'> · {state.subcategory}</span>
                )}
              </span>
              <span className='shrink-0 text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400'>
                Change
              </span>
            </button>

            <div>
              <label className={LABEL_CLS}>Income / Expense</label>
              <TypeToggle
                value={state.type}
                onChange={(v) => setState((s) => ({ ...s, type: v }))}
                onCategoryReset={() => undefined}
              />
            </div>

            <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
              <div>
                <label className={LABEL_CLS}>Amount (₹)</label>
                <NumericInput
                  className={INPUT_CLS}
                  value={state.amount}
                  onChange={(v) => setState((s) => ({ ...s, amount: v }))}
                  autoFocus
                />
              </div>
              <div>
                <label className={LABEL_CLS}>Date</label>
                <CalendarPicker
                  value={state.date}
                  onChange={(v) => setState((s) => ({ ...s, date: v }))}
                />
              </div>
            </div>

            {accounts.length > 0 && (
              <div>
                <label className={LABEL_CLS}>Account (Optional)</label>
                <Select
                  className={INPUT_CLS}
                  value={state.accountId}
                  onChange={(e) => setState((s) => ({ ...s, accountId: e.target.value }))}
                >
                  <option value=''>No Account</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </Select>
              </div>
            )}

            <div>
              <label className={LABEL_CLS}>Notes (Optional)</label>
              <input
                className={INPUT_CLS}
                value={state.notes}
                onChange={(e) => setState((s) => ({ ...s, notes: e.target.value }))}
                placeholder='Add any extra details…'
              />
            </div>
          </div>
        )}

        {footer}
      </Modal>

      {/* Manage Categories overlay — rendered outside Modal via portal */}
      {showManage && (
        <ManageCategoriesModal
          type={state.type as 'expense' | 'income'}
          category={state.category || undefined}
          onClose={() => setShowManage(false)}
        />
      )}
    </>
  );
}

/** Tiny right chevron so the Next button does not need another icon import. */
function FiArrowRightish() {
  return (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2.5'
      strokeLinecap='round'
      strokeLinejoin='round'
      className='h-4 w-4'
      aria-hidden='true'
    >
      <path d='M9 18l6-6-6-6' />
    </svg>
  );
}
