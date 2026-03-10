import {
  FiCalendar,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
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

import type { Goal } from '../../types/investmentTypes';
import { Modal } from '../ui/Modal';
import { createPortal } from 'react-dom';
import { usePortfolioStore } from '../../store/portfolioStore';

// ── Calendar Picker ────────────────────────────────────────────────────────
function CalendarPicker({
  value,
  onChange,
  placeholder = 'Pick a date',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
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
    : placeholder;

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const panelW = 280;
    const panelH = 320;
    const spaceBelow = window.innerHeight - r.bottom;
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
        <span
          className={`flex-1 text-left ${!selectedDate ? 'text-slate-500' : ''}`}
        >
          {displayLabel}
        </span>
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

            {/* Days grid */}
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
  | { open: boolean; onClose: () => void; mode: 'create'; goal?: undefined }
  | { open: boolean; onClose: () => void; mode: 'edit'; goal: Goal };

type FormState = {
  name: string;
  targetAmount: string;
  currentAmount: string;
  dueDate: string;
};

function toNum(v: string) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function UpsertGoalModal(props: Props) {
  const addGoal = usePortfolioStore((s) => s.addGoal);
  const updateGoal = usePortfolioStore((s) => s.updateGoal);

  const initial = useMemo<FormState>(() => {
    const base: FormState = {
      name: '',
      targetAmount: '0',
      currentAmount: '0',
      dueDate: '',
    };
    if (props.mode === 'edit') {
      base.name = props.goal.name;
      base.targetAmount = String(props.goal.targetAmount);
      base.currentAmount = String(props.goal.currentAmount);
      base.dueDate = props.goal.dueDate ?? '';
    }
    return base;
  }, [props.mode, (props as any).goal]);

  const [state, setState] = useState<FormState>(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (props.open) setState(initial);
  }, [props.open, initial]);

  async function onSubmit() {
    setSaving(true);
    try {
      const payload = {
        name: state.name.trim(),
        targetAmount: toNum(state.targetAmount),
        currentAmount: toNum(state.currentAmount),
        dueDate: state.dueDate || undefined,
      };
      if (props.mode === 'create') await addGoal(payload as any);
      else await updateGoal(props.goal.id, payload as any);
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
      title={props.mode === 'create' ? 'Add Goal' : 'Edit Goal'}
    >
      <div className='grid grid-cols-1 gap-5'>
        {/* Goal Name */}
        <div>
          <label className={labelCls}>Goal Name</label>
          <input
            className={inputCls}
            value={state.name}
            onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
            placeholder='e.g. Retirement, Emergency fund, Child education'
          />
        </div>

        {/* Amounts + Due Date */}
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'>
          <div>
            <label className={labelCls}>Target Amount</label>
            <input
              inputMode='decimal'
              className={inputCls}
              value={state.targetAmount}
              onChange={(e) =>
                setState((s) => ({ ...s, targetAmount: e.target.value }))
              }
            />
          </div>

          <div>
            <label className={labelCls}>Current Amount</label>
            <input
              inputMode='decimal'
              className={inputCls}
              value={state.currentAmount}
              onChange={(e) =>
                setState((s) => ({ ...s, currentAmount: e.target.value }))
              }
            />
          </div>

          {/* Due Date — CalendarPicker */}
          <div>
            <label className={labelCls}>Due Date (Optional)</label>
            <CalendarPicker
              value={state.dueDate}
              onChange={(v) => setState((s) => ({ ...s, dueDate: v }))}
              placeholder='No due date'
            />
          </div>
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
              saving || !state.name.trim() || toNum(state.targetAmount) <= 0
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
                <span>Add Goal</span>
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
