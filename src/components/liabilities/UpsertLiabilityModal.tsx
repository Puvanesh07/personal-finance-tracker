// src/components/liabilities/UpsertLiabilityModal.tsx
//
// Add / Edit Liability — layout follows the shared reference:
//   Name → Type + Currency → Outstanding + Interest Rate →
//   Monthly EMI + Start Date → Principal + Due Date → First EMI Date
//   (with schedule hint) → "More details" expander (EMI day, status…).
// Every saved field flows automatically into Net Worth, Wealth, Cashflow,
// Dashboard, Goals and Essentials via the shared portfolioStore.

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
  currency: string;
  principal: string;
  outstanding: string;
  interestRate: string;
  startDate: string;
  endDate: string;
  firstEmiDate: string;
  emiAmount: string;
  emiDay: string;
  status: LiabilityStatus | '';
  returnedAt: string;
};

export const LIABILITY_TYPE_OPTIONS: { id: LiabilityType; label: string }[] = [
  { id: 'home_loan', label: 'Home Loan' },
  { id: 'vehicle_loan', label: 'Vehicle Loan' },
  { id: 'loan', label: 'Personal Loan' },
  { id: 'education_loan', label: 'Education Loan' },
  { id: 'credit_card', label: 'Credit Card' },
  { id: 'gold_loan', label: 'Gold Loan' },
  { id: 'business_loan', label: 'Business Loan' },
  { id: 'other', label: 'Friends / Family' },
  { id: 'misc', label: 'Other' },
];

export function liabilityTypeLabel(type: string): string {
  return LIABILITY_TYPE_OPTIONS.find((o) => o.id === type)?.label ?? type;
}

function toNum(v: string) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function UpsertLiabilityModal(props: Props) {
  const addLiability = usePortfolioStore((s) => s.addLiability);
  const updateLiability = usePortfolioStore((s) => s.updateLiability);

  const startDateRef = useRef<HTMLInputElement>(null);
  const dueDateRef = useRef<HTMLInputElement>(null);
  const firstEmiDateRef = useRef<HTMLInputElement>(null);
  const returnedDateRef = useRef<HTMLInputElement>(null);

  const initial = useMemo<FormState>(() => {
    const base: FormState = {
      type: 'home_loan',
      name: '',
      currency: 'INR',
      principal: '0',
      outstanding: '0',
      interestRate: '',
      startDate: '',
      endDate: '',
      firstEmiDate: '',
      emiAmount: '',
      emiDay: '',
      status: '',
      returnedAt: '',
    };
    if (props.mode === 'edit') {
      const l = props.liability;
      base.type = l.type;
      base.name = l.name;
      base.currency = l.currency || 'INR';
      base.principal = String(l.principal);
      base.outstanding = String(l.outstanding);
      base.interestRate = l.interestRate == null ? '' : String(l.interestRate);
      base.startDate = l.startDate || '';
      base.endDate = l.endDate || '';
      base.firstEmiDate = l.firstEmiDate || '';
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
  const [moreOpen, setMoreOpen] = useState(false);

  const set = (patch: Partial<FormState>) =>
    setState((s) => ({ ...s, ...patch }));

  useEffect(() => {
    if (props.open) {
      setState(initial);
      setIsDropdownOpen(false);
      setMoreOpen(false);
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
        currency: state.currency,
        principal: toNum(state.principal),
        outstanding: toNum(state.outstanding),
        ...(state.interestRate.trim()
          ? { interestRate: toNum(state.interestRate) }
          : {}),
        ...(state.startDate.trim() ? { startDate: state.startDate } : {}),
        ...(state.endDate.trim() ? { endDate: state.endDate } : {}),
        ...(state.firstEmiDate.trim()
          ? { firstEmiDate: state.firstEmiDate }
          : {}),
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
    if (!dateStr) return 'dd-mm-yyyy';
    const [year, month, day] = dateStr.split('-');
    return `${day}-${month}-${year}`;
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
    'w-full rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white/50 dark:bg-slate-900/50 px-4 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-sm outline-none transition-all focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:focus:border-emerald-500';
  const labelCls =
    'text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 block';

  const isPersonalLoan = state.type === 'other';
  const isCreditCard = state.type === 'credit_card';
  const showEmiFields = !isCreditCard;

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

  const DateField = ({
    label,
    value,
    onChange,
    refObj,
    required,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    refObj: React.RefObject<HTMLInputElement>;
    required?: boolean;
  }) => (
    <label className='block'>
      <span className={labelCls}>
        {label}
        {required ? ' *' : ''}
      </span>
      <div className='relative'>
        <div
          className={`${inputCls} flex items-center justify-between cursor-pointer`}
          onClick={() => handleDateClick(refObj)}
        >
          <span
            className={
              value
                ? 'text-slate-900 dark:text-slate-100'
                : 'text-slate-400 dark:text-slate-500'
            }
          >
            {formatDateLabel(value)}
          </span>
          <FiCalendar className='h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400' />
        </div>
        <input
          ref={refObj}
          type='date'
          className='absolute inset-0 h-full w-full opacity-0 pointer-events-none'
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </label>
  );

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title={props.mode === 'create' ? 'Add Liability' : 'Edit Liability'}
    >
      <div className='grid grid-cols-1 gap-5'>
        {/* Name */}
        <label className='block'>
          <span className={labelCls}>Name *</span>
          <input
            className={inputCls}
            value={state.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder='e.g. Home Loan - SBI'
            autoFocus
          />
        </label>

        {/* Type + Currency */}
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <div className='block relative'>
            <span className={labelCls}>Type *</span>
            <button
              type='button'
              className={`${inputCls} flex items-center justify-between text-left`}
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <span className='truncate'>
                {LIABILITY_TYPE_OPTIONS.find((o) => o.id === state.type)?.label}
              </span>
              <FiChevronDown
                className={`h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {isDropdownOpen && (
              <>
                <div
                  className='fixed inset-0 z-40'
                  onClick={() => setIsDropdownOpen(false)}
                />
                <div className='absolute left-0 top-full mt-2 z-50 w-full overflow-hidden rounded-xl border border-slate-200/80 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-800'>
                  {LIABILITY_TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type='button'
                      className={`w-full px-4 py-3 text-left text-sm transition-colors ${state.type === opt.id ? 'bg-emerald-50 text-emerald-700 font-semibold dark:bg-emerald-500/10 dark:text-emerald-400' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700/50 dark:hover:text-slate-200'}`}
                      onClick={() => {
                        set({ type: opt.id, status: '' });
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
          <label className='block'>
            <span className={labelCls}>Currency</span>
            <select
              className={`${inputCls} cursor-pointer`}
              value={state.currency}
              onChange={(e) => set({ currency: e.target.value })}
            >
              <option value='INR'>INR ₹</option>
            </select>
          </label>
        </div>

        {/* Outstanding + Interest Rate */}
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <label className='block'>
            <span className={labelCls}>
              {isCreditCard ? 'Pending Bill Amount *' : 'Outstanding Amount *'}
            </span>
            <NumericInput
              className={inputCls}
              value={state.outstanding}
              onChange={(v) => set({ outstanding: v })}
              placeholder='Amount'
            />
          </label>
          {!isCreditCard && (
            <label className='block'>
              <span className={labelCls}>Interest Rate (%) *</span>
              <NumericInput
                className={inputCls}
                value={state.interestRate}
                onChange={(v) => set({ interestRate: v })}
                placeholder='e.g. 8.5'
              />
            </label>
          )}
        </div>

        {/* Monthly EMI + Start Date */}
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          {showEmiFields ? (
            <label className='block'>
              <span className={labelCls}>Monthly EMI</span>
              <NumericInput
                className={inputCls}
                value={state.emiAmount}
                onChange={(v) => set({ emiAmount: v })}
                placeholder='Monthly payment'
              />
            </label>
          ) : (
            <div />
          )}
          <DateField
            label='Start Date'
            required={showEmiFields}
            value={state.startDate}
            onChange={(v) => set({ startDate: v })}
            refObj={startDateRef as React.RefObject<HTMLInputElement>}
          />
        </div>

        {/* Principal + Due Date */}
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <label className='block'>
            <span className={labelCls}>
              {isCreditCard ? 'Total Statement Bill' : 'Principal Amount'}
            </span>
            <NumericInput
              className={inputCls}
              value={state.principal}
              onChange={(v) => set({ principal: v })}
              placeholder='Original loan amount'
            />
          </label>
          <DateField
            label='Due Date'
            value={state.endDate}
            onChange={(v) => set({ endDate: v })}
            refObj={dueDateRef as React.RefObject<HTMLInputElement>}
          />
        </div>

        {/* First EMI Date */}
        {showEmiFields && (
          <div className='block'>
            <DateField
              label='First EMI Date'
              value={state.firstEmiDate}
              onChange={(v) => set({ firstEmiDate: v })}
              refObj={firstEmiDateRef as React.RefObject<HTMLInputElement>}
            />
            <p className='mt-1.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400'>
              Optional. Set this if the first EMI was due more than a month
              after the loan started, so the schedule matches your bank's.
            </p>
          </div>
        )}

        {/* More details expander */}
        <button
          type='button'
          onClick={() => setMoreOpen(!moreOpen)}
          className='flex items-center gap-1.5 self-start text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors cursor-pointer'
        >
          <FiChevronDown
            className={`h-3.5 w-3.5 transition-transform ${moreOpen ? 'rotate-180' : ''}`}
          />
          More details
        </button>

        {moreOpen && (
          <div className='flex flex-col gap-5 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-slate-50/60 dark:bg-slate-900/40 p-4'>
            {showEmiFields && (
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
            )}

            {/* ── Status ── */}
            <div className='block'>
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
                        : 'border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-500 hover:border-slate-500 dark:border-slate-700 dark:hover:text-slate-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Returned Date ── */}
            {isPersonalLoan && state.status === 'returned' && (
              <div className='rounded-xl border border-teal-500/30 bg-teal-500/5 p-4'>
                <div className='flex items-center gap-2 mb-3'>
                  <FiCheck className='h-4 w-4 text-teal-400' />
                  <span className='text-xs font-bold uppercase tracking-wider text-teal-400'>
                    Mark as Returned
                  </span>
                </div>
                <DateField
                  label='Date Returned'
                  value={state.returnedAt}
                  onChange={(v) => set({ returnedAt: v })}
                  refObj={returnedDateRef as React.RefObject<HTMLInputElement>}
                />
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className='mt-2 flex items-center justify-end gap-3 border-t border-slate-200/60 pt-5 dark:border-slate-800/60'>
          <button
            type='button'
            className='rounded-xl px-5 py-2.5 text-sm font-bold text-slate-900 dark:text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
            onClick={props.onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type='button'
            className='inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition-all hover:-translate-y-0.5 hover:shadow-emerald-500/40 disabled:opacity-60 disabled:hover:translate-y-0'
            onClick={() => void onSubmit()}
            disabled={saving || !state.name.trim() || !toNum(state.outstanding)}
          >
            {saving ? (
              <>
                <FiSave className='h-4 w-4' />
                <span>Saving…</span>
              </>
            ) : props.mode === 'create' ? (
              <>
                <FiPlus className='h-4 w-4' />
                <span>Add Liability</span>
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
