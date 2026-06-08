import { FiPlus, FiSave } from 'react-icons/fi';
import { useEffect, useMemo, useState } from 'react';

import type {
  PaymentRecurrence,
  PaymentTrackerType,
  TrackedPayment,
} from '../../types/investmentTypes';
import { Dropdown } from '../ui/Dropdown';
import { Modal } from '../ui/Modal';
import { NumericInput } from '../ui/NumericInput';
import {
  PAYMENT_TYPE_OPTIONS,
  REMINDER_PRESETS,
  paymentTypePlaceholder,
} from '../../utils/paymentTracker';
import { usePortfolioStore } from '../../store/portfolioStore';

type Props =
  | { open: boolean; onClose: () => void; mode: 'create'; payment?: undefined }
  | { open: boolean; onClose: () => void; mode: 'edit'; payment: TrackedPayment };

export function UpsertTrackedPaymentModal(props: Props) {
  const addTrackedPayment = usePortfolioStore((s) => s.addTrackedPayment);
  const updateTrackedPayment = usePortfolioStore((s) => s.updateTrackedPayment);

  const initial = useMemo(() => {
    if (props.mode === 'edit') {
      const p = props.payment;
      return {
        title: p.title,
        paymentType: p.paymentType,
        amount: String(p.amount),
        dueDate: p.dueDate,
        reminderDays: [...p.reminderDays],
        customReminder: '',
        recurrence: p.recurrence,
        notes: p.notes || '',
      };
    }
    const today = new Date().toISOString().split('T')[0];
    return {
      title: '',
      paymentType: 'credit_card' as PaymentTrackerType,
      amount: '',
      dueDate: today,
      reminderDays: [...REMINDER_PRESETS],
      customReminder: '',
      recurrence: 'none' as PaymentRecurrence,
      notes: '',
    };
  }, [props.mode, props.payment]);

  const [state, setState] = useState(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setState(initial);
  }, [initial, props.open]);

  const inputCls =
    'w-full rounded-xl border border-slate-300/80 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-900/50 px-4 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100 shadow-sm outline-none transition-all focus:border-sky-500/50 focus:ring-2 focus:ring-sky-500/20 placeholder:text-slate-500';
  const labelCls =
    'text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5 block ml-1';

  const toggleReminder = (day: number) => {
    setState((s) => ({
      ...s,
      reminderDays: s.reminderDays.includes(day)
        ? s.reminderDays.filter((d) => d !== day)
        : [...s.reminderDays, day].sort((a, b) => a - b),
    }));
  };

  const addCustomReminder = () => {
    const day = parseInt(state.customReminder, 10);
    if (!Number.isFinite(day) || day < 0 || day > 365) return;
    if (!state.reminderDays.includes(day)) {
      setState((s) => ({
        ...s,
        reminderDays: [...s.reminderDays, day].sort((a, b) => a - b),
        customReminder: '',
      }));
    }
  };

  const onSubmit = async () => {
    const amount = Number(state.amount);
    if (!state.title.trim() || !Number.isFinite(amount) || amount <= 0) return;
    if (!state.dueDate || state.reminderDays.length === 0) return;

    setSaving(true);
    try {
      const payload = {
        title: state.title.trim(),
        paymentType: state.paymentType,
        amount,
        dueDate: state.dueDate,
        reminderDays: state.reminderDays,
        recurrence: state.recurrence,
        notes: state.notes.trim() || undefined,
      };

      if (props.mode === 'create') await addTrackedPayment(payload);
      else await updateTrackedPayment(props.payment.id, payload);

      props.onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title={props.mode === 'create' ? 'Add Payment' : 'Edit Payment'}
    >
      <div className='flex flex-col gap-4'>
        <div>
          <label className={labelCls}>Payment Type</label>
          <Dropdown
            value={state.paymentType}
            options={PAYMENT_TYPE_OPTIONS.map((o) => ({
              value: o.value,
              label: o.label,
            }))}
            onChange={(paymentType) =>
              setState((s) => ({
                ...s,
                paymentType,
                title: s.title || paymentTypePlaceholder(paymentType),
              }))
            }
          />
        </div>

        <div>
          <label className={labelCls}>Title</label>
          <input
            className={inputCls}
            value={state.title}
            onChange={(e) => setState((s) => ({ ...s, title: e.target.value }))}
            placeholder={`e.g. ${paymentTypePlaceholder(state.paymentType)}`}
          />
        </div>

        <div>
          <label className={labelCls}>Amount (₹)</label>
          <NumericInput
            value={state.amount}
            onChange={(v) => setState((s) => ({ ...s, amount: v }))}
            className={inputCls}
            placeholder='e.g. 5,000'
          />
        </div>

        <div>
          <label className={labelCls}>Due Date</label>
          <input
            type='date'
            className={inputCls}
            value={state.dueDate}
            onChange={(e) =>
              setState((s) => ({ ...s, dueDate: e.target.value }))
            }
          />
        </div>

        <div>
          <label className={labelCls}>Remind Me Before (days)</label>
          <div className='flex flex-wrap gap-2'>
            {REMINDER_PRESETS.map((day) => (
              <button
                key={day}
                type='button'
                onClick={() => toggleReminder(day)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold border transition-colors ${
                  state.reminderDays.includes(day)
                    ? 'bg-sky-500/20 text-sky-700 dark:text-sky-400 border-sky-500/30'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                }`}
              >
                {day} day{day === 1 ? '' : 's'}
              </button>
            ))}
          </div>
          <div className='mt-2 flex gap-2'>
            <input
              type='number'
              min={0}
              max={365}
              className={`${inputCls} flex-1`}
              value={state.customReminder}
              onChange={(e) =>
                setState((s) => ({ ...s, customReminder: e.target.value }))
              }
              placeholder='Custom days (e.g. 14)'
            />
            <button
              type='button'
              onClick={addCustomReminder}
              className='rounded-xl border border-slate-300 dark:border-slate-700 px-4 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors'
            >
              Add
            </button>
          </div>
          {state.reminderDays.length > 0 && (
            <p className='mt-2 text-[11px] text-slate-500'>
              Reminders at: {state.reminderDays.join(', ')} day
              {state.reminderDays.length === 1 ? '' : 's'} before due
            </p>
          )}
        </div>

        <div>
          <label className={labelCls}>Recurrence</label>
          <Dropdown
            value={state.recurrence}
            options={[
              { value: 'none', label: 'One-time payment' },
              { value: 'monthly', label: 'Monthly (auto-create next)' },
              { value: 'yearly', label: 'Yearly (auto-create next)' },
            ]}
            onChange={(recurrence) =>
              setState((s) => ({ ...s, recurrence: recurrence as PaymentRecurrence }))
            }
          />
        </div>

        <div>
          <label className={labelCls}>Notes (optional)</label>
          <textarea
            className={`${inputCls} min-h-[72px] resize-y`}
            value={state.notes}
            onChange={(e) => setState((s) => ({ ...s, notes: e.target.value }))}
            placeholder='e.g. School Fees, Electricity Bill'
          />
        </div>

        <div className='flex justify-end gap-3 border-t border-slate-200/70 dark:border-slate-800/60 pt-5'>
          <button
            type='button'
            onClick={props.onClose}
            disabled={saving}
            className='rounded-xl px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors'
          >
            Cancel
          </button>
          <button
            type='button'
            onClick={onSubmit}
            disabled={
              saving ||
              !state.title.trim() ||
              !state.amount ||
              !state.dueDate ||
              state.reminderDays.length === 0
            }
            className='inline-flex items-center gap-2 rounded-xl bg-sky-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-sky-500 disabled:opacity-60 transition-colors'
          >
            {props.mode === 'create' ? (
              <FiPlus className='h-4 w-4' />
            ) : (
              <FiSave className='h-4 w-4' />
            )}
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
