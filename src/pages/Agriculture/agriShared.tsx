// Shared agriculture UI helpers and constants

import { FiCheck, FiChevronDown } from 'react-icons/fi';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type {
  AgriExpenseCategory,
  LivestockType,
  Season,
} from '../../types/investmentTypes';
import type { CashflowEntry } from '../../types/investmentTypes';

export const SEASONS: { value: Season; label: string; emoji: string }[] = [
  { value: 'summer', label: 'Summer ☀️', emoji: '☀️' },
  { value: 'monsoon', label: 'Monsoon (Rainy) 🌧️', emoji: '🌧️' },
  { value: 'winter', label: 'Winter ❄️', emoji: '❄️' },
];

export const EXPENSE_CATS: { value: AgriExpenseCategory; label: string }[] = [
  { value: 'seeds', label: 'Seeds' },
  { value: 'fertilizer', label: 'Fertilizer' },
  { value: 'pesticides', label: 'Pesticides' },
  { value: 'labor', label: 'Labor' },
  { value: 'irrigation', label: 'Irrigation' },
  { value: 'tractor_fuel', label: 'Tractor / Land Work' },
  { value: 'equipment_repair', label: 'Equipment Repair' },
  { value: 'feed', label: 'Animal Feed' },
  { value: 'veterinary', label: 'Veterinary' },
  { value: 'medicine', label: 'Medicine' },
  { value: 'shed', label: 'Shed Maintenance' },
  { value: 'other', label: 'Other' },
];

export const LIVESTOCK_TYPES: {
  value: LivestockType;
  label: string;
  emoji: string;
}[] = [
  { value: 'cow', label: 'Cow', emoji: '🐄' },
  { value: 'buffalo', label: 'Buffalo', emoji: '🐃' },
  { value: 'goat', label: 'Goat', emoji: '🐐' },
  { value: 'sheep', label: 'Sheep', emoji: '🐑' },
  { value: 'poultry', label: 'Poultry', emoji: '🐓' },
  { value: 'other', label: 'Other', emoji: '🐾' },
];

export const PIE_COLORS = [
  '#22c55e',
  '#f59e0b',
  '#3b82f6',
  '#a78bfa',
  '#f43f5e',
  '#14b8a6',
  '#fb923c',
  '#64748b',
];

export const inputCls =
  'w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-200 dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20';
export const labelCls =
  'block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1';

export type DropdownOption = { value: string; label: string; emoji?: string };

export function AgriDropdown({
  value,
  onChange,
  options,
  placeholder = 'Select…',
}: {
  value: string;
  onChange: (v: string) => void;
  options: DropdownOption[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  const selected = options.find((o) => o.value === value);

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const panelW = Math.max(r.width, 180);
    const rawLeft = r.left + window.scrollX;
    const clamped = Math.min(
      rawLeft,
      window.innerWidth + window.scrollX - panelW - 8,
    );
    const spaceBelow = window.innerHeight - r.bottom;
    const maxPanelH = Math.min(options.length * 44 + 16, 260);
    const top =
      spaceBelow > maxPanelH
        ? r.bottom + 6 + window.scrollY
        : r.top - maxPanelH - 6 + window.scrollY;
    setPos({ top, left: Math.max(8, clamped), width: panelW });
  }, [options.length]);

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
    window.addEventListener('resize', updatePos);
    return () => {
      document.removeEventListener('mousedown', onMouse);
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
        className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-sm transition-all duration-200 ${
          open
            ? 'border-emerald-500/50 bg-slate-200 dark:bg-slate-800 shadow-[0_0_12px_rgba(16,185,129,0.12)] text-slate-900 dark:text-slate-100'
            : 'border-slate-300 dark:border-slate-700 bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:border-slate-300 dark:border-slate-600'
        }`}
      >
        <span className='truncate'>
          {selected ? (
            `${selected.emoji ? selected.emoji + ' ' : ''}${selected.label}`
          ) : (
            <span className='text-slate-900 dark:text-slate-500'>
              {placeholder}
            </span>
          )}
        </span>
        <FiChevronDown
          className={`ml-2 h-3.5 w-3.5 shrink-0 text-slate-900 dark:text-slate-500 transition-transform duration-200 ${open ? 'rotate-180 text-emerald-400' : ''}`}
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
            className='overflow-hidden rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl backdrop-blur-xl'
          >
            <div className='flex max-h-64 flex-col overflow-y-auto p-1.5'>
              {options.map((opt) => (
                <button
                  key={opt.value}
                  type='button'
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-all text-left ${
                    value === opt.value
                      ? 'bg-emerald-500/10 text-emerald-400 font-semibold'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>
                    {opt.emoji ? opt.emoji + ' ' : ''}
                    {opt.label}
                  </span>
                  {value === opt.value && (
                    <FiCheck className='h-4 w-4 shrink-0 text-emerald-400' />
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

export function SummaryCard({
  icon,
  label,
  value,
  sub,
  color = '#22c55e',
}: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div
      className='rounded-xl p-4 flex flex-col gap-1 bg-slate-50 border border-slate-200/90 dark:bg-slate-900/70 dark:border-slate-800/80'
      style={{ borderTop: `2px solid ${color}` }}
    >
      <div className='flex items-center gap-2'>
        <span className='text-lg'>{icon}</span>
        <span className='text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'>
          {label}
        </span>
      </div>
      <div className='text-xl font-bold text-slate-900 dark:text-slate-100 font-mono'>
        {value}
      </div>
      {sub && (
        <div className='text-[11px] text-slate-500 dark:text-slate-400'>
          {sub}
        </div>
      )}
    </div>
  );
}

export function DeleteBtn({
  onDelete,
  disabled,
}: {
  onDelete: () => void | Promise<void>;
  disabled?: boolean;
}) {
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (deleting || disabled) return;
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
      setConfirm(false);
    }
  }

  if (confirm)
    return (
      <div className='flex gap-1'>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className='px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold disabled:opacity-50'
        >
          {deleting ? '…' : 'Yes'}
        </button>
        <button
          onClick={() => setConfirm(false)}
          disabled={deleting}
          className='px-3 py-1.5 rounded-lg bg-slate-300 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold'
        >
          No
        </button>
      </div>
    );
  return (
    <button
      onClick={() => setConfirm(true)}
      disabled={disabled || deleting}
      className='px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-red-400 text-xs font-bold hover:bg-red-500/10 disabled:opacity-50'
    >
      Delete
    </button>
  );
}

export async function pushToCashflow(
  type: 'income' | 'expense',
  category: string,
  amount: number,
  date: string,
  accountId: string | undefined,
  notes: string,
  addCashflow: (entry: Omit<CashflowEntry, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>,
) {
  if (amount <= 0) return;
  await addCashflow({
    type,
    category,
    amount,
    date,
    notes,
    accountId: accountId || undefined,
  });
}

export async function syncCashflow(
  cashflows: CashflowEntry[],
  addCashflow: (entry: Omit<CashflowEntry, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>,
  updateCashflow: (id: string, patch: Partial<CashflowEntry>) => Promise<void>,
  deleteCashflow: (id: string) => Promise<void>,
  type: 'income' | 'expense',
  oldCategory: string | undefined,
  oldAmount: number | undefined,
  oldDate: string | undefined,
  newCategory: string,
  newAmount: number,
  newDate: string,
  newAccountId: string | undefined,
  newNotes: string,
) {
  const existingCf =
    oldAmount && oldAmount > 0 && oldDate && oldCategory
      ? cashflows.find(
          (c) =>
            c.type === type &&
            c.category === oldCategory &&
            c.amount === oldAmount &&
            c.date === oldDate,
        )
      : undefined;

  if (existingCf) {
    if (newAmount <= 0) {
      await deleteCashflow(existingCf.id);
    } else {
      await updateCashflow(existingCf.id, {
        category: newCategory,
        amount: newAmount,
        date: newDate,
        accountId: newAccountId || undefined,
        notes: newNotes,
      });
    }
  } else if (newAmount > 0) {
    await pushToCashflow(
      type,
      newCategory,
      newAmount,
      newDate,
      newAccountId,
      newNotes,
      addCashflow,
    );
  }
}

export async function removeLinkedCashflow(
  cashflows: CashflowEntry[],
  deleteCashflow: (id: string) => Promise<void>,
  type: 'income' | 'expense',
  category: string,
  amount: number,
  date: string,
) {
  const cf = cashflows.find(
    (c) =>
      c.type === type &&
      c.category === category &&
      c.amount === amount &&
      c.date === date,
  );
  if (cf) await deleteCashflow(cf.id);
}
