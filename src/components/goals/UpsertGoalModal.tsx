// src/components/goals/UpsertGoalModal.tsx
//
// UPDATED:
//  â€¢ Goal status: 'active' | 'completed' | 'success'
//  â€¢ Contribute modal: add amounts over time with a note + date
//  â€¢ completedAt date auto-fills when marked success/completed
//  â€¢ Contribution history is stored in GoalContribution Firestore sub-collection
//    (add addGoalContribution to your portfolioStore to persist)

import {
  FiCalendar,
  FiCheckCircle,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiPlus,
  FiSave,
  FiTrendingUp,
} from 'react-icons/fi';
import type { Goal, GoalStatus } from '../../types/investmentTypes';
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
import { usePortfolioStore } from '../../store/portfolioStore';

// â”€â”€ Smart Calendar Picker â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    const panelH = panelRef.current ? panelRef.current.offsetHeight : 340;
    const rawLeft = r.left + window.scrollX;
    const clampedLeft = Math.min(
      rawLeft,
      window.innerWidth + window.scrollX - panelW - 16,
    );
    const spaceBelow = window.innerHeight - r.bottom;
    let top = r.bottom + 8 + window.scrollY;
    if (spaceBelow < panelH && r.top > spaceBelow) {
      top = r.top - panelH - 8 + window.scrollY;
    }
    setPos({ top, left: Math.max(8, clampedLeft) });
  }, []);

  useEffect(() => {
    if (open) {
      updatePos();
      setTimeout(updatePos, 10);
    }
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
            ? 'border-emerald-500/50 bg-slate-200 dark:bg-slate-800 shadow-[0_0_15px_rgba(16,185,129,0.1)] text-emerald-400'
            : 'border-slate-300/80 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-200/70 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100'
        }`}
      >
        <FiCalendar
          className={`h-4 w-4 shrink-0 transition-colors ${open ? 'text-emerald-400' : 'text-slate-900 dark:text-slate-500'}`}
        />
        <span
          className={`flex-1 text-left ${!selectedDate ? 'text-slate-900 dark:text-slate-500' : ''}`}
        >
          {displayLabel}
        </span>
        <FiChevronDown
          className={`h-3.5 w-3.5 transition-transform duration-200 text-slate-900 dark:text-slate-500 ${open ? 'rotate-180 text-emerald-400' : ''}`}
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
              zIndex: 99999,
              width: 280,
            }}
            className='rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl backdrop-blur-xl overflow-hidden'
          >
            <div className='flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800'>
              <button
                type='button'
                onClick={() => setViewDate((d) => addMonths(d, -1))}
                className='flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-900 dark:text-slate-100 transition-colors'
              >
                <FiChevronLeft className='h-4 w-4' />
              </button>
              <span className='text-sm font-bold text-slate-900 dark:text-slate-800 dark:text-slate-200'>
                {format(viewDate, 'MMMM yyyy')}
              </span>
              <button
                type='button'
                onClick={() => setViewDate((d) => addMonths(d, 1))}
                className='flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-900 dark:text-slate-100 transition-colors'
              >
                <FiChevronRight className='h-4 w-4' />
              </button>
            </div>
            <div className='grid grid-cols-7 px-3 pt-3 pb-1'>
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                <div
                  key={d}
                  className='text-center text-[10px] font-bold text-slate-900 dark:text-slate-500 pb-1'
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
                            ? 'text-slate-600 dark:text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-900 dark:text-slate-100'
                            : 'text-slate-500 dark:text-slate-600 hover:bg-slate-100 dark:bg-slate-800/50'
                    }`}
                  >
                    {format(day, 'd')}
                  </button>
                );
              })}
            </div>
            <div className='px-3 pb-3 flex justify-between gap-2 border-t border-slate-200 dark:border-slate-800 pt-2'>
              <button
                type='button'
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
                className='text-xs font-bold text-slate-900 dark:text-slate-500 hover:text-slate-600 dark:text-slate-700 dark:hover:text-slate-600 dark:text-slate-700 dark:text-slate-300 transition-colors px-2 py-1'
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

// â”€â”€ Contribute Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Shown when clicking "Add Contribution" on an existing goal from GoalsPage.
// This is a separate export you can use from GoalsPage.

type ContributeProps = {
  open: boolean;
  onClose: () => void;
  goal: Goal;
  /** Called with the amount to add to currentAmount */
  onContribute: (amount: number, note: string, date: string) => Promise<void>;
};

export function GoalContributeModal({
  open,
  onClose,
  goal,
  onContribute,
}: ContributeProps) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount('');
      setNote('');
      setDate(new Date().toISOString().split('T')[0]);
    }
  }, [open]);

  const inputCls =
    'w-full rounded-xl border border-slate-300/80 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-900/50 px-4 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100 shadow-sm outline-none transition-all focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 placeholder:text-slate-400 dark:placeholder:text-slate-500';
  const labelCls =
    'text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-500 mb-1.5 block';

  const toNum = (v: string) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const remaining = goal.targetAmount - goal.currentAmount;

  async function handleSubmit() {
    const amt = toNum(amount);
    if (amt <= 0) return;
    setSaving(true);
    try {
      await onContribute(amt, note.trim(), date);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Contribute to "${goal.name}"`}>
      <div className='grid grid-cols-1 gap-5'>
        {/* Progress summary */}
        <div className='rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3'>
          <div className='flex justify-between text-xs font-bold text-slate-500 dark:text-slate-400 mb-2'>
            <span>Current: â‚¹{goal.currentAmount.toLocaleString('en-IN')}</span>
            <span>Target: â‚¹{goal.targetAmount.toLocaleString('en-IN')}</span>
          </div>
          <div className='h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800'>
            <div
              className='h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-700'
              style={{
                width: `${Math.min(100, (goal.currentAmount / goal.targetAmount) * 100)}%`,
              }}
            />
          </div>
          <p className='mt-2 text-[11px] text-slate-900 dark:text-slate-500'>
            â‚¹{Math.max(0, remaining).toLocaleString('en-IN')} remaining
          </p>
        </div>

        {/* Amount */}
        <div>
          <label className={labelCls}>Contribution Amount (â‚¹)</label>
          <NumericInput
            className={inputCls}
            value={amount}
            onChange={setAmount}
            placeholder='e.g. 5000'
          />
        </div>

        {/* Date */}
        <div>
          <label className={labelCls}>Date</label>
          <CalendarPicker
            value={date}
            onChange={setDate}
            placeholder='Select date'
          />
        </div>

        {/* Note */}
        <div>
          <label className={labelCls}>Note (Optional)</label>
          <input
            className={inputCls}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder='e.g. Monthly SIP, Bonus allocationâ€¦'
          />
        </div>

        {/* Footer */}
        <div className='flex items-center justify-end gap-3 border-t border-slate-200/70 dark:border-slate-800/60 pt-4'>
          <button
            type='button'
            className='rounded-xl px-5 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors disabled:opacity-60'
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type='button'
            className='inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition-all hover:-translate-y-0.5 disabled:opacity-60'
            onClick={() => void handleSubmit()}
            disabled={saving || toNum(amount) <= 0}
          >
            <FiTrendingUp className='h-4 w-4' />
            <span>{saving ? 'Savingâ€¦' : 'Add Contribution'}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}

// â”€â”€ Main Upsert Goal Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type Props =
  | { open: boolean; onClose: () => void; mode: 'create'; goal?: undefined }
  | { open: boolean; onClose: () => void; mode: 'edit'; goal: Goal };

type FormState = {
  name: string;
  targetAmount: string;
  currentAmount: string;
  dueDate: string;
  status: GoalStatus;
  completedAt: string;
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
      status: 'active',
      completedAt: '',
    };
    if (props.mode === 'edit') {
      base.name = props.goal.name;
      base.targetAmount = String(props.goal.targetAmount);
      base.currentAmount = String(props.goal.currentAmount);
      base.dueDate = props.goal.dueDate ?? '';
      base.status = props.goal.status ?? 'active';
      base.completedAt = props.goal.completedAt ?? '';
    }
    return base;
  }, [props.mode, (props as any).goal]);

  const [state, setState] = useState<FormState>(initial);
  const [saving, setSaving] = useState(false);

  const set = (patch: Partial<FormState>) =>
    setState((s) => ({ ...s, ...patch }));

  useEffect(() => {
    if (props.open) setState(initial);
  }, [props.open, initial]);

  // Auto-fill completedAt when status changes to completed/success
  useEffect(() => {
    if (
      (state.status === 'completed' || state.status === 'success') &&
      !state.completedAt
    ) {
      set({ completedAt: new Date().toISOString().split('T')[0] });
    }
  }, [state.status]);

  async function onSubmit() {
    setSaving(true);
    try {
      const payload = {
        name: state.name.trim(),
        targetAmount: toNum(state.targetAmount),
        currentAmount: toNum(state.currentAmount),
        dueDate: state.dueDate || undefined,
        status: state.status,
        completedAt:
          state.status === 'active'
            ? undefined
            : state.completedAt || undefined,
      };
      if (props.mode === 'create') await addGoal(payload as any);
      else await updateGoal(props.goal.id, payload as any);
      props.onClose();
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    'w-full rounded-xl border border-slate-300/80 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-900/50 px-4 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100 shadow-sm outline-none transition-all focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 placeholder:text-slate-400 dark:placeholder:text-slate-500';
  const labelCls =
    'text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 block';

  const statusOptions: { value: GoalStatus; label: string; cls: string }[] = [
    {
      value: 'active',
      label: 'ðŸŽ¯ Active',
      cls: 'border-emerald-500/40 bg-emerald-500/8 text-emerald-400',
    },
    {
      value: 'completed',
      label: 'âœ… Completed',
      cls: 'border-blue-500/40 bg-blue-500/8 text-blue-400',
    },
    {
      value: 'success',
      label: 'ðŸ† Success',
      cls: 'border-amber-500/40 bg-amber-500/8 text-amber-400',
    },
  ];

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
            onChange={(e) => set({ name: e.target.value })}
            placeholder='e.g. Retirement, Emergency fund, Child education'
          />
        </div>

        {/* Amounts + Due Date */}
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'>
          <div>
            <label className={labelCls}>Target Amount</label>
            <NumericInput
              className={inputCls}
              value={state.targetAmount}
              onChange={(v) => set({ targetAmount: v })}
            />
          </div>

          <div>
            <label className={labelCls}>Current Amount</label>
            <NumericInput
              className={inputCls}
              value={state.currentAmount}
              onChange={(v) => set({ currentAmount: v })}
            />
          </div>

          <div>
            <label className={labelCls}>Due Date (Optional)</label>
            <CalendarPicker
              value={state.dueDate}
              onChange={(v) => set({ dueDate: v })}
              placeholder='No due date'
            />
          </div>
        </div>

        {/* â”€â”€ Goal Status â”€â”€ */}
        <div className='border-t border-slate-200/70 dark:border-slate-800/60 pt-4'>
          <span className={labelCls}>Goal Status</span>
          <div className='flex gap-2'>
            {statusOptions.map((opt) => (
              <button
                key={opt.value}
                type='button'
                onClick={() => set({ status: opt.value })}
                className={`flex-1 py-2 px-2 rounded-xl border text-xs font-bold transition-all ${
                  state.status === opt.value
                    ? opt.cls
                    : 'border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-500 hover:border-slate-500'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* â”€â”€ Completion Date (only when completed or success) â”€â”€ */}
        {(state.status === 'completed' || state.status === 'success') && (
          <div className='rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3'>
            <div className='flex items-center gap-2 mb-3'>
              <FiCheckCircle className='h-4 w-4 text-amber-400' />
              <span className='text-xs font-bold uppercase tracking-wider text-amber-400'>
                {state.status === 'success'
                  ? 'Goal Achieved!'
                  : 'Goal Completed'}
              </span>
            </div>
            <label className={labelCls}>Date Achieved</label>
            <CalendarPicker
              value={state.completedAt}
              onChange={(v) => set({ completedAt: v })}
              placeholder='Select date'
            />
          </div>
        )}

        {/* Footer */}
        <div className='mt-2 flex items-center justify-end gap-3 border-t border-slate-200/70 dark:border-slate-800/60 pt-5'>
          <button
            type='button'
            className='rounded-xl px-5 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-200 transition-colors hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white disabled:opacity-60'
            onClick={props.onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type='button'
            className='inline-flex items-center cursor-pointer gap-2 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition-all hover:-translate-y-0.5 hover:shadow-emerald-500/40 disabled:opacity-60 disabled:hover:translate-y-0'
            onClick={() => void onSubmit()}
            disabled={
              saving || !state.name.trim() || toNum(state.targetAmount) <= 0
            }
          >
            {saving ? (
              <>
                <FiSave className='h-4 w-4 animate-pulse' />
                <span>Savingâ€¦</span>
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
