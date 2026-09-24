// src/components/goals/UpsertGoalModal.tsx
//
// UPDATED:
//  • Goal status: 'active' | 'completed' | 'success'
//  • Contribute modal: add amounts over time with a note + date
//  • completedAt date auto-fills when marked success/completed
//  • Contribution history is stored in GoalContribution Firestore sub-collection
//    (add addGoalContribution to your portfolioStore to persist)
//  • Create/Edit form redesigned: template picker + collapsible Inflation
//    Calculator that auto-fills Target Amount & Target Date (no currency field).

import {
  FiCheckCircle,
  FiChevronDown,
  FiChevronUp,
  FiLink,
  FiPlus,
  FiSave,
  FiTrendingUp,
} from 'react-icons/fi';
import type { Goal, GoalStatus } from '../../types/investmentTypes';
import { useEffect, useMemo, useState } from 'react';
import { addYears, format } from 'date-fns';

import { Modal } from '../ui/Modal';
import { Select } from '../ui/Select';
import { NumericInput } from '../ui/NumericInput';
import { CalendarPicker } from '../ui/CalendarPicker';
import { AssetLinkPicker } from './AssetLinkPicker';
import { usePortfolioStore } from '../../store/portfolioStore';

// ── Smart Calendar Picker ──────────────────────────────────────────────────
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
            <span>Current: ₹{goal.currentAmount.toLocaleString('en-IN')}</span>
            <span>Target: ₹{goal.targetAmount.toLocaleString('en-IN')}</span>
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
            ₹{Math.max(0, remaining).toLocaleString('en-IN')} remaining
          </p>
        </div>

        {/* Amount */}
        <div>
          <label className={labelCls}>Contribution Amount (₹)</label>
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
            placeholder='e.g. Monthly SIP, Bonus allocation…'
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
            <span>{saving ? 'Saving…' : 'Add Contribution'}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Main Upsert Goal Modal ────────────────────────────────────────────────

type Props =
  | { open: boolean; onClose: () => void; mode: 'create'; goal?: undefined }
  | { open: boolean; onClose: () => void; mode: 'edit'; goal: Goal };

type FormState = {
  name: string;
  template: string;
  todayValue: string;
  inflationPct: string;
  years: string;
  targetAmount: string;
  currentAmount: string;
  dueDate: string;
  trackProgressBy: 'net_worth' | 'investments' | 'cash';
  notes: string;
  linkedAssetIds: string[];
  status: GoalStatus;
  completedAt: string;
};

function toNum(v: string) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// ── Inflation calculator presets & goal templates ─────────────────────────
const INFLATION_PRESETS = [
  { pct: 7, label: 'General' },
  { pct: 10, label: 'Education' },
  { pct: 12, label: 'Real Estate' },
  { pct: 14, label: 'Medical' },
];
const YEAR_CHIPS = [5, 10, 15, 20];
const TEMPLATES: {
  id: string;
  label: string;
  name?: string;
  infl?: number;
  years?: number;
}[] = [
  { id: '', label: 'Select a template...' },
  { id: 'education', label: 'Child Education', name: 'Child Education', infl: 10, years: 15 },
  { id: 'retirement', label: 'Retirement', name: 'Retirement Corpus', infl: 7, years: 20 },
  { id: 'home', label: 'Buy a Home', name: 'Dream Home', infl: 12, years: 10 },
  { id: 'car', label: 'New Car', name: 'New Car', infl: 7, years: 5 },
  { id: 'wedding', label: 'Wedding', name: 'Wedding Fund', infl: 10, years: 7 },
  { id: 'emergency', label: 'Emergency Fund', name: 'Emergency Fund', infl: 7, years: 1 },
];

export function UpsertGoalModal(props: Props) {
  const addGoal = usePortfolioStore((s) => s.addGoal);
  const updateGoal = usePortfolioStore((s) => s.updateGoal);
  const investments = usePortfolioStore((s) => s.investments);

  const initial = useMemo<FormState>(() => {
    const base: FormState = {
      name: '',
      template: '',
      todayValue: '',
      inflationPct: '7',
      years: '',
      targetAmount: '0',
      currentAmount: '0',
      dueDate: '',
      trackProgressBy: 'net_worth',
      notes: '',
      linkedAssetIds: [],
      status: 'active',
      completedAt: '',
    };
    if (props.mode === 'edit') {
      base.name = props.goal.name;
      base.template = props.goal.template ?? '';
      base.todayValue = props.goal.todayValue ? String(props.goal.todayValue) : '';
      base.inflationPct =
        props.goal.inflationPct != null ? String(props.goal.inflationPct) : '7';
      base.years = props.goal.years ? String(props.goal.years) : '';
      base.targetAmount = String(props.goal.targetAmount);
      base.currentAmount = String(props.goal.currentAmount);
      base.dueDate = props.goal.dueDate ?? '';
      base.trackProgressBy = props.goal.trackProgressBy ?? 'net_worth';
      base.notes = props.goal.notes ?? '';
      base.linkedAssetIds = props.goal.linkedAssetIds ?? [];
      base.status = props.goal.status ?? 'active';
      base.completedAt = props.goal.completedAt ?? '';
    }
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.mode, (props as any).goal]);

  const [state, setState] = useState<FormState>(initial);
  const [saving, setSaving] = useState(false);
  const [calcOpen, setCalcOpen] = useState(true);
  const [linkOpen, setLinkOpen] = useState(false);

  const set = (patch: Partial<FormState>) =>
    setState((s) => ({ ...s, ...patch }));

  useEffect(() => {
    if (props.open) {
      setState(initial);
      setCalcOpen(true);
      setLinkOpen((props.mode === 'edit' && (props.goal.linkedAssetIds?.length ?? 0) > 0));
    }
  }, [props.open, initial]);

  // Auto-fill completedAt when status changes to completed/success
  useEffect(() => {
    if (
      (state.status === 'completed' || state.status === 'success') &&
      !state.completedAt
    ) {
      set({ completedAt: new Date().toISOString().split('T')[0] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  // ── Inflation calculator: future value = today * (1 + infl/100)^years ──
  const futureValue = useMemo(() => {
    const tv = toNum(state.todayValue);
    const yr = toNum(state.years);
    const infl = toNum(state.inflationPct);
    if (tv <= 0 || yr <= 0) return 0;
    return Math.round(tv * Math.pow(1 + infl / 100, yr));
  }, [state.todayValue, state.years, state.inflationPct]);

  // Automatic setup: keep Target Amount + Target Date in sync with the
  // calculator while it has meaningful inputs.
  useEffect(() => {
    const yr = toNum(state.years);
    if (futureValue <= 0) return;
    const patch: Partial<FormState> = { targetAmount: String(futureValue) };
    if (yr > 0) {
      patch.dueDate = format(addYears(new Date(), yr), 'yyyy-MM-dd');
    }
    setState((s) => ({ ...s, ...patch }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [futureValue, state.years]);

  function applyTemplate(id: string) {
    const t = TEMPLATES.find((x) => x.id === id);
    set({ template: id });
    if (!t) return;
    const patch: Partial<FormState> = {};
    if (t.name && !state.name.trim()) patch.name = t.name;
    if (t.infl != null) patch.inflationPct = String(t.infl);
    if (t.years != null) patch.years = String(t.years);
    set(patch);
  }

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
        notes: state.notes.trim() || undefined,
        trackProgressBy: state.trackProgressBy,
        linkedAssetIds: state.linkedAssetIds,
        template: state.template || undefined,
        todayValue: toNum(state.todayValue) || undefined,
        inflationPct: toNum(state.inflationPct) || undefined,
        years: toNum(state.years) || undefined,
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
  const chipCls = (active: boolean) =>
    `rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-colors cursor-pointer ${
      active
        ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
        : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-emerald-500/40'
    }`;

  const statusOptions: { value: GoalStatus; label: string; cls: string }[] = [
    {
      value: 'active',
      label: '🎯 Active',
      cls: 'border-emerald-500/40 bg-emerald-500/8 text-emerald-400',
    },
    {
      value: 'completed',
      label: '✅ Completed',
      cls: 'border-blue-500/40 bg-blue-500/8 text-blue-400',
    },
    {
      value: 'success',
      label: '🏆 Success',
      cls: 'border-amber-500/40 bg-amber-500/8 text-amber-400',
    },
  ];

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title={props.mode === 'create' ? 'Create New Goal' : 'Edit Goal'}
    >
      <div className='grid grid-cols-1 gap-5'>
        {/* ── Row 1: Goal Name + Template ── */}
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <div>
            <label className={labelCls}>Goal Name *</label>
            <div className='flex items-center gap-2'>
              <span className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-base'>
                💰
              </span>
              <input
                className={inputCls}
                value={state.name}
                onChange={(e) => set({ name: e.target.value })}
                placeholder='Goal name'
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Template</label>
            <Select
              className={inputCls}
              value={state.template}
              onChange={(e) => applyTemplate(e.target.value)}
            >
              {TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* ── Inflation Calculator (collapsible) ── */}
        <div className='rounded-2xl border border-slate-200/70 dark:border-slate-800/60 bg-slate-100/60 dark:bg-slate-900/40 p-4'>
          <div className='mb-3 flex items-center justify-between gap-3'>
            <div className='flex items-center gap-2'>
              <FiTrendingUp className='h-4 w-4 text-emerald-500' />
              <span className='text-sm font-bold text-slate-900 dark:text-white'>
                Inflation Calculator
              </span>
              <span className='hidden text-[11px] font-medium text-slate-500 dark:text-slate-400 sm:inline'>
                — what will it cost in the future?
              </span>
            </div>
            <button
              type='button'
              onClick={() => setCalcOpen((v) => !v)}
              className='rounded-full border border-emerald-500/40 px-3 py-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 transition-colors hover:bg-emerald-500/10'
            >
              {calcOpen ? 'Hide Calculator' : 'Show Calculator'}
            </button>
          </div>

          {calcOpen && (
            <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
              <div>
                <label className={labelCls}>Today's Value</label>
                <NumericInput
                  className={inputCls}
                  value={state.todayValue}
                  onChange={(v) => set({ todayValue: v })}
                  placeholder="Today's value"
                />
              </div>
              <div>
                <label className={labelCls}>Inflation % / year</label>
                <input
                  type='number'
                  min={0}
                  max={30}
                  step={0.5}
                  className={inputCls}
                  value={state.inflationPct}
                  onChange={(e) => set({ inflationPct: e.target.value })}
                />
                <div className='mt-2 flex flex-wrap gap-1.5'>
                  {INFLATION_PRESETS.map((p) => (
                    <button
                      key={p.pct}
                      type='button'
                      onClick={() => set({ inflationPct: String(p.pct) })}
                      className={chipCls(toNum(state.inflationPct) === p.pct)}
                    >
                      {p.pct}% {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls}>Years from now</label>
                <input
                  type='number'
                  min={0}
                  max={60}
                  className={inputCls}
                  value={state.years}
                  onChange={(e) => set({ years: e.target.value })}
                  placeholder='Years'
                />
                <div className='mt-2 flex flex-wrap gap-1.5'>
                  {YEAR_CHIPS.map((y) => (
                    <button
                      key={y}
                      type='button'
                      onClick={() => set({ years: String(y) })}
                      className={chipCls(toNum(state.years) === y)}
                    >
                      {y}y
                    </button>
                  ))}
                </div>
              </div>

              {futureValue > 0 && (
                <div className='md:col-span-3 rounded-xl border border-emerald-500/25 bg-emerald-500/8 px-4 py-2.5 text-sm font-semibold text-emerald-700 dark:text-emerald-300'>
                  ₹{toNum(state.todayValue).toLocaleString('en-IN')} today →{' '}
                  <span className='font-bold'>
                    ₹{futureValue.toLocaleString('en-IN')}
                  </span>{' '}
                  in {toNum(state.years)} yrs @ {toNum(state.inflationPct)}% —
                  target auto-filled
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Row: Target Amount + Target Date (no currency) ── */}
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <div>
            <label className={labelCls}>Target Amount *</label>
            <NumericInput
              className={inputCls}
              value={state.targetAmount}
              onChange={(v) => set({ targetAmount: v })}
              placeholder='Target amount'
            />
          </div>
          <div>
            <label className={labelCls}>Target Date *</label>
            <CalendarPicker
              value={state.dueDate}
              onChange={(v) => set({ dueDate: v })}
              placeholder='Select target date'
            />
          </div>
        </div>

        {/* ── Row: Current Amount + Track Progress By ── */}
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <div>
            <label className={labelCls}>Current Amount (already saved)</label>
            <NumericInput
              className={inputCls}
              value={state.currentAmount}
              onChange={(v) => set({ currentAmount: v })}
            />
          </div>
          <div>
            <label className={labelCls}>Track Progress By</label>
            <Select
              className={inputCls}
              value={state.trackProgressBy}
              onChange={(e) =>
                set({
                  trackProgressBy: e.target.value as FormState['trackProgressBy'],
                })
              }
            >
              <option value='net_worth'>Net Worth (all assets)</option>
              <option value='investments'>Investments only</option>
              <option value='cash'>Cash & bank only</option>
            </Select>
          </div>
        </div>

        {/* ── Notes ── */}
        <div>
          <label className={labelCls}>Notes (optional)</label>
          <textarea
            className={`${inputCls} min-h-[80px] resize-y`}
            value={state.notes}
            onChange={(e) => set({ notes: e.target.value })}
            placeholder='Why this goal matters, milestones, plan...'
          />
        </div>

        {/* ── Link specific assets (optional, collapsible) ── */}
        <div className='rounded-2xl border border-slate-200/70 dark:border-slate-800/60 bg-slate-100/60 dark:bg-slate-900/40'>
          <button
            type='button'
            onClick={() => setLinkOpen((v) => !v)}
            className='flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3'
          >
            <span className='flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white'>
              <FiLink className='h-4 w-4 text-emerald-500' />
              {state.linkedAssetIds.length > 0
                ? `${state.linkedAssetIds.length} item${state.linkedAssetIds.length === 1 ? '' : 's'} linked`
                : 'Link specific assets or accounts (optional)'}
            </span>
            {linkOpen ? (
              <FiChevronUp className='h-4 w-4 text-slate-400' />
            ) : (
              <FiChevronDown className='h-4 w-4 text-slate-400' />
            )}
          </button>
          {linkOpen && (
            <div className='px-4 pb-4'>
              <AssetLinkPicker
                investments={investments}
                selected={state.linkedAssetIds}
                onChange={(ids) => set({ linkedAssetIds: ids })}
              />
            </div>
          )}
        </div>

        {/* ── Goal Status ── */}
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
                    : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-500'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Completion Date (only when completed or success) ── */}
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
                <span>Saving…</span>
              </>
            ) : props.mode === 'create' ? (
              <>
                <FiPlus className='h-4 w-4' />
                <span>Create Goal</span>
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
