// src/components/liabilities/UpsertLiabilityModal.tsx

import {
  FiCalendar,
  FiCheck,
  FiChevronDown,
  FiPlus,
  FiSave,
} from 'react-icons/fi';
import type {
  Liability,
  LiabilityStatus,
  LiabilityType,
} from '../../types/investmentTypes';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Modal } from '../ui/Modal';
import { NumericInput } from '../ui/NumericInput';
import { usePortfolioStore } from '../../store/portfolioStore';

type Props =
  | {
      open: boolean;
      onClose: () => void;
      mode: 'create';
      liability?: undefined;
    }
  | { open: boolean; onClose: () => void; mode: 'edit'; liability: Liability };

type FormState = {
  type: LiabilityType;
  name: string;
  principal: string;
  outstanding: string;
  interestRate: string;
  endDate: string;
  emiAmount: string;
  emiDay: string;
  status: LiabilityStatus | '';
  returnedAt: string;
};

function toNum(v: string) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function UpsertLiabilityModal(props: Props) {
  const addLiability = usePortfolioStore((s) => s.addLiability);
  const updateLiability = usePortfolioStore((s) => s.updateLiability);

  const dateInputRef = useRef<HTMLInputElement>(null);
  const returnedDateRef = useRef<HTMLInputElement>(null);

  const initial = useMemo<FormState>(() => {
    const base: FormState = {
      type: 'loan',
      name: '',
      principal: '0',
      outstanding: '0',
      interestRate: '',
      endDate: '',
      emiAmount: '',
      emiDay: '',
      status: '',
      returnedAt: '',
    };
    if (props.mode === 'edit') {
      const l = props.liability;
      base.type = l.type;
      base.name = l.name;
      base.principal = String(l.principal);
      base.outstanding = String(l.outstanding);
      base.interestRate = l.interestRate == null ? '' : String(l.interestRate);
      base.endDate = l.endDate || '';
      base.emiAmount = l.emiAmount != null ? String(l.emiAmount) : '';
      base.emiDay = l.emiDay != null ? String(l.emiDay) : '';
      base.status = l.status || '';
      base.returnedAt = l.returnedAt || '';
    }
    return base;
  }, [props.mode, (props as any).liability]);

  const [state, setState] = useState<FormState>(initial);
  const [saving, setSaving] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const set = (patch: Partial<FormState>) =>
    setState((s) => ({ ...s, ...patch }));

  useEffect(() => {
    if (props.open) {
      setState(initial);
      setIsDropdownOpen(false);
    }
  }, [props.open, initial]);

  useEffect(() => {
    if (state.status === 'returned' && !state.returnedAt) {
      set({ returnedAt: new Date().toISOString().split('T')[0] });
    }
  }, [state.status]);

  async function onSubmit() {
    setSaving(true);
    try {
      const payload: Partial<Liability> = {
        type: state.type,
        name: state.name.trim(),
        principal: toNum(state.principal),
        outstanding: toNum(state.outstanding),
        ...(state.interestRate.trim()
          ? { interestRate: toNum(state.interestRate) }
          : {}),
        ...(state.endDate.trim() ? { endDate: state.endDate } : {}),
        ...(state.emiAmount.trim()
          ? { emiAmount: toNum(state.emiAmount) }
          : {}),
        ...(state.emiDay.trim() ? { emiDay: toNum(state.emiDay) } : {}),
        ...(state.status ? { status: state.status as LiabilityStatus } : {}),
        ...(state.status === 'returned' && state.returnedAt
          ? { returnedAt: state.returnedAt }
          : { returnedAt: undefined }),
      };

      if (props.mode === 'create') await addLiability(payload as any);
      else await updateLiability(props.liability.id, payload as any);

      props.onClose();
    } finally {
      setSaving(false);
    }
  }

  const formatDateLabel = (dateStr: string) => {
    if (!dateStr) return 'Select date…';
    const [year, month, day] = dateStr.split('-');
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
    ).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const handleDateClick = (ref: React.RefObject<HTMLInputElement>) => {
    if (ref.current) {
      try {
        ref.current.showPicker();
      } catch {
        ref.current.focus();
      }
    }
  };

  const inputCls =
    'w-full rounded-xl border border-slate-200/80 bg-white/50 px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm outline-none transition-all focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700/80 dark:bg-slate-900/50 dark:text-slate-100 dark:focus:border-emerald-500';
  const labelCls =
    'text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 block';

  const typeOptions = [
    { id: 'loan', label: 'Formal Loan (Bank/App)' },
    { id: 'credit_card', label: 'Credit Card Bill' },
    { id: 'other', label: 'Personal / Hand Loan (Friends/Family)' },
  ];

  const showEmiFields = state.type === 'loan';
  const isPersonalLoan = state.type === 'other';
  const isCreditCard = state.type === 'credit_card'; // NEW

  // Status chips adapt based on type
  const statusOptions = isPersonalLoan
    ? ([
        {
          value: 'active',
          label: '✅ Active',
          cls: 'border-emerald-500/40 bg-emerald-500/8 text-emerald-400',
        },
        {
          value: 'returned',
          label: '🤝 Returned',
          cls: 'border-teal-500/40 bg-teal-500/8 text-teal-400',
        },
      ] as const)
    : isCreditCard
      ? ([
          {
            value: 'active',
            label: '🔴 Pending',
            cls: 'border-rose-500/40 bg-rose-500/8 text-rose-400',
          },
          {
            value: 'paid',
            label: '✅ Paid Off',
            cls: 'border-emerald-500/40 bg-emerald-500/8 text-emerald-400',
          },
        ] as const)
      : ([
          {
            value: 'active',
            label: '✅ Active',
            cls: 'border-emerald-500/40 bg-emerald-500/8 text-emerald-400',
          },
          {
            value: 'paused',
            label: '⏸ Paused',
            cls: 'border-amber-500/40 bg-amber-500/8 text-amber-400',
          },
          {
            value: 'paid',
            label: '🏁 Paid Off',
            cls: 'border-blue-500/40 bg-blue-500/8 text-blue-400',
          },
        ] as const);

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title={
        props.mode === 'create' ? 'Add Liability or Bill' : 'Edit Liability'
      }
    >
      <div className='grid grid-cols-1 gap-5'>
        {/* Type picker */}
        {props.mode === 'create' && (
          <div className='block relative'>
            <span className={labelCls}>Type of Debt</span>
            <button
              type='button'
              className={`${inputCls} flex items-center justify-between text-left`}
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <span className='truncate'>
                {typeOptions.find((o) => o.id === state.type)?.label}
              </span>
              <FiChevronDown
                className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {isDropdownOpen && (
              <>
                <div
                  className='fixed inset-0 z-40'
                  onClick={() => setIsDropdownOpen(false)}
                />
                <div className='absolute left-0 top-full mt-2 z-50 w-full overflow-hidden rounded-xl border border-slate-200/80 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-800'>
                  {typeOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type='button'
                      className={`w-full px-4 py-3 text-left text-sm transition-colors ${state.type === opt.id ? 'bg-emerald-50 text-emerald-700 font-semibold dark:bg-emerald-500/10 dark:text-emerald-400' : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700/50'}`}
                      onClick={() => {
                        set({ type: opt.id as LiabilityType, status: '' });
                        setIsDropdownOpen(false);
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Dynamic Name */}
        <label className='block'>
          <span className={labelCls}>
            {isCreditCard
              ? 'Card Name & Month (e.g. HDFC Jan)'
              : 'Name / Description'}
          </span>
          <input
            className={inputCls}
            value={state.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder={
              isCreditCard
                ? 'e.g., SBI Millennia - Oct Bill'
                : 'e.g., Rent money, Car EMI'
            }
          />
        </label>

        {/* Dynamic Principal + Outstanding */}
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <label className='block'>
            <span className={labelCls}>
              {isCreditCard
                ? 'Total Statement Bill (₹)'
                : 'Total Borrowed (Initial)'}
            </span>
            <NumericInput
              className={inputCls}
              value={state.principal}
              onChange={(v) => set({ principal: v })}
            />
          </label>
          <label className='block'>
            <span className={labelCls}>
              {isCreditCard ? 'Pending Bill Amount (₹)' : 'Amount Left to Pay'}
            </span>
            <NumericInput
              className={inputCls}
              value={state.outstanding}
              onChange={(v) => set({ outstanding: v })}
            />
          </label>
        </div>

        {/* Interest + End Date */}
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          {/* Hide Interest Rate for Credit Cards to keep it simple */}
          {!isCreditCard && (
            <label className='block'>
              <span className={labelCls}>Interest Rate (% Yearly)</span>
              <NumericInput
                className={inputCls}
                value={state.interestRate}
                onChange={(v) => set({ interestRate: v })}
                placeholder='e.g. 0 for friends'
              />
            </label>
          )}

          <label className={`block ${isCreditCard ? 'md:col-span-2' : ''}`}>
            <span className={labelCls}>
              {isCreditCard ? 'Bill Due Date' : 'Expected Repayment Date'}
            </span>
            <div className='relative'>
              <div
                className={`${inputCls} flex items-center justify-between cursor-pointer ${isCreditCard && !state.endDate ? 'border-rose-300 dark:border-rose-500/50' : ''}`}
                onClick={() =>
                  handleDateClick(
                    dateInputRef as React.RefObject<HTMLInputElement>,
                  )
                }
              >
                <span
                  className={
                    state.endDate
                      ? 'text-slate-900 dark:text-slate-100'
                      : 'text-slate-400'
                  }
                >
                  {formatDateLabel(state.endDate)}
                </span>
                <FiCalendar
                  className={`h-4 w-4 shrink-0 ${isCreditCard && !state.endDate ? 'text-rose-400' : 'text-slate-400'}`}
                />
              </div>
              <input
                ref={dateInputRef}
                type='date'
                className='absolute inset-0 h-full w-full opacity-0 pointer-events-none'
                value={state.endDate}
                onChange={(e) => set({ endDate: e.target.value })}
              />
            </div>
            {isCreditCard && (
              <p className='mt-1 text-[10px] text-slate-500'>
                We will notify you 3 days before this due date.
              </p>
            )}
          </label>
        </div>

        {/* ── EMI Fields (formal loans only) ── */}
        {showEmiFields && (
          <div className='border-t border-slate-200/60 dark:border-slate-800/60 pt-4'>
            <p className='text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-600 mb-3'>
              EMI Details (Optional)
            </p>
            <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
              <label className='block'>
                <span className={labelCls}>Monthly EMI Amount (₹)</span>
                <NumericInput
                  className={inputCls}
                  value={state.emiAmount}
                  onChange={(v) => set({ emiAmount: v })}
                  placeholder='e.g. 5000'
                />
              </label>

              <label className='block'>
                <span className={labelCls}>EMI Due Day (Date of Month)</span>
                <input
                  type='number'
                  className={inputCls}
                  value={state.emiDay}
                  onChange={(e) => set({ emiDay: e.target.value })}
                  placeholder='e.g. 5  (5th of every month)'
                  min={1}
                  max={31}
                />
              </label>
            </div>
          </div>
        )}

        {/* ── Status ── */}
        <div className='border-t border-slate-200/60 dark:border-slate-800/60 pt-4'>
          <span className={labelCls}>
            {isPersonalLoan
              ? 'Repayment Status'
              : isCreditCard
                ? 'Bill Status'
                : 'Loan Status'}
          </span>

          <div className='flex gap-2'>
            {statusOptions.map((opt) => (
              <button
                key={opt.value}
                type='button'
                onClick={() => set({ status: opt.value })}
                className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                  state.status === opt.value
                    ? opt.cls
                    : 'border-slate-700 text-slate-500 hover:border-slate-500 dark:border-slate-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Returned Date (only for personal loans marked returned) ── */}
        {isPersonalLoan && state.status === 'returned' && (
          <div className='rounded-xl border border-teal-500/30 bg-teal-500/5 p-4 mt-2'>
            <div className='flex items-center gap-2 mb-3'>
              <FiCheck className='h-4 w-4 text-teal-400' />
              <span className='text-xs font-bold uppercase tracking-wider text-teal-400'>
                Mark as Returned
              </span>
            </div>
            <label className='block'>
              <span className={labelCls}>Date Returned</span>
              <div className='relative'>
                <div
                  className={`${inputCls} flex items-center justify-between cursor-pointer`}
                  onClick={() =>
                    handleDateClick(
                      returnedDateRef as React.RefObject<HTMLInputElement>,
                    )
                  }
                >
                  <span
                    className={
                      state.returnedAt
                        ? 'text-slate-900 dark:text-slate-100'
                        : 'text-slate-400'
                    }
                  >
                    {formatDateLabel(state.returnedAt)}
                  </span>
                  <FiCalendar className='h-4 w-4 shrink-0 text-slate-400' />
                </div>
                <input
                  ref={returnedDateRef}
                  type='date'
                  className='absolute inset-0 h-full w-full opacity-0 pointer-events-none'
                  value={state.returnedAt}
                  onChange={(e) => set({ returnedAt: e.target.value })}
                />
              </div>
            </label>
          </div>
        )}

        {/* Actions */}
        <div className='mt-4 flex items-center justify-end gap-3 border-t border-slate-200/60 pt-5 dark:border-slate-800/60'>
          <button
            type='button'
            className='rounded-xl px-5 py-2.5 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
            onClick={props.onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type='button'
            className='inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition-all hover:-translate-y-0.5 hover:shadow-emerald-500/40 disabled:opacity-60 disabled:hover:translate-y-0'
            onClick={() => void onSubmit()}
            disabled={saving || !state.name.trim()}
          >
            {saving ? (
              <>
                <FiSave className='h-4 w-4' />
                <span>Saving…</span>
              </>
            ) : props.mode === 'create' ? (
              <>
                <FiPlus className='h-4 w-4' />
                <span>Add Record</span>
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
