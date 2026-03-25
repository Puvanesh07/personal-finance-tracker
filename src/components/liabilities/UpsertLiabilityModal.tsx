import { FiCalendar, FiChevronDown, FiPlus, FiSave } from 'react-icons/fi';
import type { Liability, LiabilityType } from '../../types/investmentTypes';
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
};

function toNum(v: string) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function UpsertLiabilityModal(props: Props) {
  const addLiability = usePortfolioStore((s) => s.addLiability);
  const updateLiability = usePortfolioStore((s) => s.updateLiability);

  // Create a reference to control the native date picker
  const dateInputRef = useRef<HTMLInputElement>(null);

  const initial = useMemo<FormState>(() => {
    const base: FormState = {
      type: 'loan',
      name: '',
      principal: '0',
      outstanding: '0',
      interestRate: '',
      endDate: '',
    };
    if (props.mode === 'edit') {
      base.type = props.liability.type;
      base.name = props.liability.name;
      base.principal = String(props.liability.principal);
      base.outstanding = String(props.liability.outstanding);
      base.interestRate =
        props.liability.interestRate == null
          ? ''
          : String(props.liability.interestRate);
      base.endDate = props.liability.endDate || '';
    }
    return base;
  }, [props.mode, (props as any).liability]);

  const [state, setState] = useState<FormState>(initial);
  const [saving, setSaving] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    if (props.open) {
      setState(initial);
      setIsDropdownOpen(false);
    }
  }, [props.open, initial]);

  async function onSubmit() {
    setSaving(true);
    try {
      const payload = {
        type: state.type,
        name: state.name.trim(),
        principal: toNum(state.principal),
        outstanding: toNum(state.outstanding),
        ...(state.interestRate.trim()
          ? { interestRate: toNum(state.interestRate) }
          : {}),
        ...(state.endDate.trim() ? { endDate: state.endDate } : {}),
      };
      if (props.mode === 'create') await addLiability(payload as any);
      else await updateLiability(props.liability.id, payload as any);
      props.onClose();
    } finally {
      setSaving(false);
    }
  }

  const formatDateLabel = (dateStr: string) => {
    if (!dateStr) return 'Select date...';
    const [year, month, day] = dateStr.split('-');
    const d = new Date(Number(year), Number(month) - 1, Number(day));
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  // Helper function to force open the date picker
  const handleDateClick = () => {
    if (dateInputRef.current) {
      try {
        // Modern browsers: forces the calendar popup to appear and auto-position
        dateInputRef.current.showPicker();
      } catch (error) {
        // Fallback for older browsers
        dateInputRef.current.focus();
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

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title={
        props.mode === 'create' ? 'Add Borrowed Money' : 'Edit Borrowed Money'
      }
    >
      <div className='grid grid-cols-1 gap-5'>
        {props.mode === 'create' ? (
          <div className='block relative'>
            <span className={labelCls}>Type of Debt</span>
            <button
              type='button'
              className={`${inputCls} flex items-center justify-between text-left`}
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <span className='truncate'>
                {typeOptions.find((opt) => opt.id === state.type)?.label}
              </span>
              <FiChevronDown
                className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {isDropdownOpen && (
              <>
                <div
                  className='fixed inset-0 z-40'
                  onClick={() => setIsDropdownOpen(false)}
                />
                {/* Changed to top-full to ensure it positions directly below the button automatically */}
                <div className='absolute left-0 top-full mt-2 z-50 w-full overflow-hidden rounded-xl border border-slate-200/80 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-800'>
                  {typeOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type='button'
                      className={`w-full px-4 py-3 text-left text-sm transition-colors ${state.type === opt.id ? 'bg-emerald-50 text-emerald-700 font-semibold dark:bg-emerald-500/10 dark:text-emerald-400' : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700/50'}`}
                      onClick={() => {
                        setState((s) => ({
                          ...s,
                          type: opt.id as LiabilityType,
                        }));
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
        ) : null}

        <label className='block'>
          <span className={labelCls}>Name / Description</span>
          <input
            className={inputCls}
            value={state.name}
            onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
            placeholder='e.g., Rent money from friend, Car EMI'
          />
        </label>

        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <label className='block'>
            <span className={labelCls}>Total Borrowed (Initial)</span>
            <NumericInput
              className={inputCls}
              value={state.principal}
              onChange={(v) => setState((s) => ({ ...s, principal: v }))}
            />
          </label>
          <label className='block'>
            <span className={labelCls}>Amount Left to Pay (Pending)</span>
            <NumericInput
              className={inputCls}
              value={state.outstanding}
              onChange={(v) => setState((s) => ({ ...s, outstanding: v }))}
            />
          </label>
        </div>

        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <label className='block'>
            <span className={labelCls}>Interest Rate (% Yearly)</span>
            <NumericInput
              className={inputCls}
              value={state.interestRate}
              onChange={(v) => setState((s) => ({ ...s, interestRate: v }))}
              placeholder='e.g. 0 for friends'
            />
          </label>

          <label className='block'>
            <span className={labelCls}>Expected Repayment Date</span>
            <div className='relative'>
              {/* This visual box now acts as a giant button that triggers the hidden input */}
              <div
                className={`${inputCls} flex items-center justify-between cursor-pointer`}
                onClick={handleDateClick}
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
                <FiCalendar className='h-4 w-4 shrink-0 text-slate-400' />
              </div>

              {/* Hidden Native Input: We make it pointer-events-none so it doesn't block clicks,
                but it remains visible to the browser so showPicker() works perfectly.
              */}
              <input
                ref={dateInputRef}
                type='date'
                className='absolute inset-0 h-full w-full opacity-0 pointer-events-none'
                value={state.endDate}
                onChange={(e) =>
                  setState((s) => ({ ...s, endDate: e.target.value }))
                }
              />
            </div>
          </label>
        </div>

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
