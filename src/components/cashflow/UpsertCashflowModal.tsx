import type { CashflowEntry, CashflowType } from '../../types/investmentTypes';
import {
  FiCalendar,
  FiCheck,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiFilter,
  FiPlus,
  FiSave,
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
import { createPortal } from 'react-dom';
import { todayISO } from '../../utils/dateUtils';
import { usePortfolioStore } from '../../store/portfolioStore';

// ── Portal Dropdown ────────────────────────────────────────────────────────
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
    const panelW = Math.max(r.width, 200);
    const rawLeft = r.left + window.scrollX;
    const clampedLeft = Math.min(
      rawLeft,
      window.innerWidth + window.scrollX - panelW - 16,
    );
    setPos({
      top: r.bottom + 8 + window.scrollY,
      left: Math.max(8, clampedLeft),
      width: panelW,
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
        className={`flex w-full items-center justify-between rounded-xl border px-4 py-2.5 text-sm transition-all duration-200 ${
          open
            ? 'border-emerald-500/50 bg-slate-800 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
            : 'border-slate-700/80 bg-slate-900/50 hover:bg-slate-800/60'
        }`}
      >
        <div className='flex items-center gap-3'>
          <FiFilter
            className={`h-4 w-4 transition-colors ${open ? 'text-emerald-400' : 'text-slate-500'}`}
          />
          <span className='font-medium text-slate-100'>
            {selected?.label ?? label}
          </span>
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
              animation: 'none',
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
    const panelH = 320;
    const top =
      spaceBelow > panelH
        ? r.bottom + 8 + window.scrollY
        : r.top - panelH - 8 + window.scrollY;
    const rawLeft = r.left + window.scrollX;
    const clampedLeft = Math.min(
      rawLeft,
      window.innerWidth + window.scrollX - panelW - 16,
    );
    setPos({ top, left: Math.max(8, clampedLeft) });
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
        className={`flex w-full items-center gap-3 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
          open
            ? 'border-emerald-500/50 bg-slate-800 shadow-[0_0_15px_rgba(16,185,129,0.1)] text-emerald-400'
            : 'border-slate-700/80 bg-slate-900/50 hover:bg-slate-800/60 text-slate-100'
        }`}
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
              animation: 'none',
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

            {/* Day headers */}
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

            {/* Days */}
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
                onClick={() => selectDay(new Date())}
                className='text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors px-2 py-1'
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
};

function toNum(v: string) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

const TYPE_OPTIONS = [
  { key: 'expense', label: 'Expense' },
  { key: 'income', label: 'Income' },
];

export function UpsertCashflowModal(props: Props) {
  const addCashflow = usePortfolioStore((s) => s.addCashflow);
  const updateCashflow = usePortfolioStore((s) => s.updateCashflow);

  const initial = useMemo<FormState>(() => {
    const base: FormState = {
      type: 'expense',
      date: todayISO(),
      category: '',
      amount: '0',
      notes: '',
    };
    if (props.mode === 'edit') {
      base.type = props.entry.type;
      base.date = props.entry.date;
      base.category = props.entry.category;
      base.amount = String(props.entry.amount);
      base.notes = props.entry.notes ?? '';
    }
    return base;
  }, [props.mode, (props as any).entry]);

  const [state, setState] = useState<FormState>(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (props.open) setState(initial);
  }, [props.open, initial]);

  async function onSubmit() {
    setSaving(true);
    try {
      const payload = {
        type: state.type,
        date: state.date,
        category: state.category.trim() || 'Other',
        amount: toNum(state.amount),
        ...(state.notes.trim() ? { notes: state.notes.trim() } : {}),
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
    'text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 block';

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title={props.mode === 'create' ? 'Add Transaction' : 'Edit Transaction'}
    >
      <div className='grid grid-cols-1 gap-5'>
        {/* Row 1 — Type + Date */}
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          {/* Transaction Type — InvDropdown */}
          <div>
            <label className={labelCls}>Transaction Type</label>
            <InvDropdown
              value={state.type}
              onChange={(v) =>
                setState((s) => ({ ...s, type: v as CashflowType }))
              }
              options={TYPE_OPTIONS}
              label='Select type'
            />
          </div>

          {/* Date — CalendarPicker */}
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
          <input
            className={inputCls}
            value={state.category}
            onChange={(e) =>
              setState((s) => ({ ...s, category: e.target.value }))
            }
            placeholder='e.g. Rent, Groceries, Salary'
          />
        </div>

        {/* Amount */}
        <div>
          <label className={labelCls}>Amount</label>
          <input
            inputMode='decimal'
            className={inputCls}
            value={state.amount}
            onChange={(e) =>
              setState((s) => ({ ...s, amount: e.target.value }))
            }
          />
        </div>

        {/* Notes */}
        <div>
          <label className={labelCls}>Notes (Optional)</label>
          <input
            className={inputCls}
            value={state.notes}
            onChange={(e) => setState((s) => ({ ...s, notes: e.target.value }))}
            placeholder='Add any extra details...'
          />
        </div>

        {/* Footer */}
        <div className='mt-2 flex items-center justify-end gap-3 border-t border-slate-800/60 pt-5'>
          <button
            type='button'
            className='rounded-xl px-5 py-2.5 text-sm font-bold text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200'
            onClick={props.onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type='button'
            className='inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition-all hover:-translate-y-0.5 hover:shadow-emerald-500/40 disabled:opacity-60 disabled:hover:translate-y-0'
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
  );
}
