import { FiPlus, FiSave, FiPercent, FiCalendar, FiDollarSign } from 'react-icons/fi';
import { useMemo, useState } from 'react';

import type { PendingPayment } from '../../types/investmentTypes';
import { Modal } from '../ui/Modal';
import { NumericInput } from '../ui/NumericInput';
import { usePortfolioStore } from '../../store/portfolioStore';
import {
  buildYearlyAmortization,
  summarizeAmortization,
} from '../../utils/calculations';
import { formatINR } from '../../utils/format';

type Props =
  | {
      open: boolean;
      onClose: () => void;
      mode: 'create';
      payment?: undefined;
    }
  | {
      open: boolean;
      onClose: () => void;
      mode: 'edit';
      payment: PendingPayment;
    };

type FormState = {
  buyerName: string;
  buyerPhone: string;
  itemDescription: string;
  amount: string;
  saleDate: string;
  expectedPaymentDate: string;
  notes: string;
  isLoan: boolean;
  principal: string;
  interestRate: string;
  loanTenureYears: string;
};

export function UpsertPendingPaymentModal(props: Props) {
  const addPendingPayment = usePortfolioStore((s) => s.addPendingPayment);
  const updatePendingPayment = usePortfolioStore((s) => s.updatePendingPayment);

  const initial = useMemo<FormState>(() => {
    if (props.mode === 'edit') {
      const p = props.payment;
      return {
        buyerName: p.buyerName,
        buyerPhone: p.buyerPhone || '',
        itemDescription: p.itemDescription,
        amount: String(p.amount),
        saleDate: p.saleDate,
        expectedPaymentDate: p.expectedPaymentDate,
        notes: p.notes || '',
        isLoan: !!p.isLoan,
        principal: p.principal != null ? String(p.principal) : String(p.amount),
        interestRate: p.interestRate != null ? String(p.interestRate) : '',
        loanTenureYears: p.loanTenureYears != null ? String(p.loanTenureYears) : '3',
      };
    }
    const today = new Date().toISOString().split('T')[0];
    return {
      buyerName: '',
      buyerPhone: '',
      itemDescription: '',
      amount: '',
      saleDate: today,
      expectedPaymentDate: today,
      notes: '',
      isLoan: false,
      principal: '',
      interestRate: '',
      loanTenureYears: '3',
    };
  }, [props.mode, props.payment]);

  const [state, setState] = useState<FormState>(initial);

  const amort = useMemo(() => {
    if (!state.isLoan) return null;
    const principal = Number(state.principal || state.amount || 0);
    const rate = Number(state.interestRate || 0);
    const tenure = Number(state.loanTenureYears || 1);
    if (!principal || !state.saleDate) return null;
    const rows = buildYearlyAmortization({
      principal,
      annualRatePct: rate,
      startDate: state.saleDate,
      tenureYears: tenure,
    });
    return summarizeAmortization(rows);
  }, [state.isLoan, state.principal, state.amount, state.interestRate, state.loanTenureYears, state.saleDate]);

  const inputCls =
    'w-full rounded-xl border border-slate-300/80 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-900/50 px-4 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100 shadow-sm outline-none transition-all focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 placeholder:text-slate-400 dark:placeholder:text-slate-500';
  const labelCls =
    'text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5 block ml-1';
  const saving = false;

  const onSubmit = async () => {
    if (!state.buyerName.trim() || !state.itemDescription.trim()) return;
    const amount = Number(state.amount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    if (!state.saleDate || !state.expectedPaymentDate) return;

    const principal = state.isLoan ? Number(state.principal || state.amount) : undefined;
    const interestRate = state.isLoan ? Number(state.interestRate || 0) : undefined;
    const loanTenureYears = state.isLoan ? Number(state.loanTenureYears || 1) : undefined;

    const payload = {
      buyerName: state.buyerName.trim(),
      buyerPhone: state.buyerPhone.trim() || undefined,
      itemDescription: state.itemDescription.trim(),
      amount,
      saleDate: state.saleDate,
      expectedPaymentDate: state.expectedPaymentDate,
      notes: state.notes.trim() || undefined,
      isLoan: state.isLoan || undefined,
      principal,
      interestRate,
      loanTenureYears,
      interestAccruedToDate: amort?.totalInterest,
    };

    if (props.mode === 'create') await addPendingPayment(payload);
    else await updatePendingPayment(props.payment.id, payload);

    props.onClose();
  };

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title={
        props.mode === 'create'
          ? 'Add Money Owed To Me'
          : 'Edit Money Owed Entry'
      }
    >
      <div className='flex flex-col gap-4 max-h-[75vh] overflow-y-auto custom-scrollbar pr-1'>
        <div className='flex items-center justify-between rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3'>
          <div>
            <p className='text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300'>
              Record type
            </p>
            <p className='text-xs text-slate-600 dark:text-slate-400 mt-0.5'>
              Toggle ON for loans with interest. OFF for simple IOUs / sales.
            </p>
          </div>
          <label className='inline-flex items-center cursor-pointer gap-2'>
            <span className='text-xs font-bold text-slate-600 dark:text-slate-400'>Simple</span>
            <input
              type='checkbox'
              className='sr-only peer'
              checked={state.isLoan}
              onChange={(e) => setState((s) => ({ ...s, isLoan: e.target.checked }))}
            />
            <div className="relative w-12 h-6 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:bg-indigo-500 transition-colors">
              <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-6 shadow" />
            </div>
            <span className='text-xs font-black text-indigo-700 dark:text-indigo-300'>Loan w/ Interest</span>
          </label>
        </div>

        <div>
          <label className={labelCls}>From (Who Owes You)</label>
          <input
            className={inputCls}
            value={state.buyerName}
            onChange={(e) =>
              setState((s) => ({ ...s, buyerName: e.target.value }))
            }
            placeholder='e.g. Father, Rajesh, Company X'
          />
        </div>

        <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
          <div>
            <label className={labelCls}>Phone (optional)</label>
            <input
              className={inputCls}
              value={state.buyerPhone}
              onChange={(e) =>
                setState((s) => ({ ...s, buyerPhone: e.target.value }))
              }
              placeholder='e.g. 98765 43210'
            />
          </div>
          <div>
            <label className={labelCls}>Start / Disbursement Date</label>
            <input
              type='date'
              className={inputCls}
              value={state.saleDate}
              onChange={(e) =>
                setState((s) => ({ ...s, saleDate: e.target.value }))
              }
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>Description</label>
          <input
            className={inputCls}
            value={state.itemDescription}
            onChange={(e) =>
              setState((s) => ({ ...s, itemDescription: e.target.value }))
            }
            placeholder='e.g. Hand loan, Lemon sales, Consultant invoice'
          />
        </div>

        <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
          {state.isLoan ? (
            <>
              <div>
                <label className={labelCls}>
                  <FiDollarSign className='inline h-3 w-3 mr-1 -mt-0.5' />
                  Principal (₹)
                </label>
                <NumericInput
                  value={state.principal}
                  onChange={(v) => setState((s) => ({ ...s, principal: v, amount: v || s.amount }))}
                  className={inputCls}
                  placeholder='e.g. 2,00,00,000'
                />
              </div>
              <div>
                <label className={labelCls}>
                  <FiPercent className='inline h-3 w-3 mr-1 -mt-0.5' />
                  Interest Rate % p.a.
                </label>
                <NumericInput
                  value={state.interestRate}
                  onChange={(v) => setState((s) => ({ ...s, interestRate: v }))}
                  className={inputCls}
                  placeholder='e.g. 10'
                />
              </div>
              <div>
                <label className={labelCls}>
                  <FiCalendar className='inline h-3 w-3 mr-1 -mt-0.5' />
                  Tenure (Years)
                </label>
                <NumericInput
                  value={state.loanTenureYears}
                  onChange={(v) => setState((s) => ({ ...s, loanTenureYears: v }))}
                  className={inputCls}
                  placeholder='e.g. 3'
                  allowDecimal={false}
                />
              </div>
              <div>
                <label className={labelCls}>Expected (Maturity) Date</label>
                <input
                  type='date'
                  className={inputCls}
                  value={state.expectedPaymentDate}
                  onChange={(e) =>
                    setState((s) => ({
                      ...s,
                      expectedPaymentDate: e.target.value,
                    }))
                  }
                />
              </div>
            </>
          ) : (
            <>
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
                <label className={labelCls}>Expected Payment Date</label>
                <input
                  type='date'
                  className={inputCls}
                  value={state.expectedPaymentDate}
                  onChange={(e) =>
                    setState((s) => ({
                      ...s,
                      expectedPaymentDate: e.target.value,
                    }))
                  }
                />
              </div>
            </>
          )}
        </div>

        {state.isLoan && amort && amort.rows.length > 0 && (
          <div className='rounded-2xl border border-indigo-500/20 bg-indigo-50 dark:bg-indigo-500/5 p-4'>
            <div className='grid grid-cols-3 gap-3 mb-4'>
              <div className='rounded-xl bg-white dark:bg-slate-900/60 p-3 border border-slate-200 dark:border-slate-800'>
                <p className='text-[10px] font-black uppercase tracking-wider text-slate-500'>Principal</p>
                <p className='text-sm font-black text-slate-900 dark:text-slate-100 tabular-nums mt-1'>
                  {formatINR(amort.rows[0].opening)}
                </p>
              </div>
              <div className='rounded-xl bg-white dark:bg-slate-900/60 p-3 border border-slate-200 dark:border-slate-800'>
                <p className='text-[10px] font-black uppercase tracking-wider text-slate-500'>Total Interest</p>
                <p className='text-sm font-black text-rose-600 dark:text-rose-400 tabular-nums mt-1'>
                  {formatINR(amort.totalInterest)}
                </p>
              </div>
              <div className='rounded-xl bg-white dark:bg-slate-900/60 p-3 border border-slate-200 dark:border-slate-800'>
                <p className='text-[10px] font-black uppercase tracking-wider text-slate-500'>Total Receivable</p>
                <p className='text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums mt-1'>
                  {formatINR(amort.totalRepayment)}
                </p>
              </div>
            </div>

            <div className='text-xs font-black uppercase tracking-wider text-slate-500 mb-2'>
              Year-by-Year Amortization
            </div>
            <div className='overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800'>
              <table className='w-full text-[11px]'>
                <thead className='bg-slate-100 dark:bg-slate-800/60'>
                  <tr className='text-slate-600 dark:text-slate-400'>
                    <th className='px-2 py-2 text-left font-black'>Year</th>
                    <th className='px-2 py-2 text-right font-black'>Opening</th>
                    <th className='px-2 py-2 text-right font-black'>Interest @ {state.interestRate || 0}%</th>
                    <th className='px-2 py-2 text-right font-black'>Closing</th>
                  </tr>
                </thead>
                <tbody>
                  {amort.rows.map((r) => (
                    <tr key={r.year} className='border-t border-slate-100 dark:border-slate-800/60'>
                      <td className='px-2 py-1.5 font-bold text-slate-800 dark:text-slate-200'>
                        Y{r.year}
                      </td>
                      <td className='px-2 py-1.5 text-right tabular-nums text-slate-700 dark:text-slate-300'>
                        {formatINR(r.opening)}
                      </td>
                      <td className='px-2 py-1.5 text-right tabular-nums text-rose-600 dark:text-rose-400'>
                        +{formatINR(r.interest)}
                      </td>
                      <td className='px-2 py-1.5 text-right tabular-nums font-black text-emerald-700 dark:text-emerald-400'>
                        {formatINR(r.closing)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div>
          <label className={labelCls}>Notes (optional)</label>
          <textarea
            className={`${inputCls} min-h-[80px] resize-y`}
            value={state.notes}
            onChange={(e) =>
              setState((s) => ({ ...s, notes: e.target.value }))
            }
            placeholder='Terms, part-payments, cheque details, etc.'
          />
        </div>

        <div className='mt-2 flex items-center justify-end gap-3 border-t border-slate-200/70 dark:border-slate-800/60 pt-5'>
          <button
            type='button'
            className='rounded-xl px-5 py-2.5 text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors'
            onClick={props.onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type='button'
            className='inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-60 transition-colors'
            onClick={onSubmit}
            disabled={
              saving ||
              !state.buyerName.trim() ||
              !state.itemDescription.trim() ||
              !state.amount ||
              !state.saleDate ||
              !state.expectedPaymentDate
            }
          >
            {saving ? (
              <FiSave className='h-4 w-4 animate-pulse' />
            ) : props.mode === 'create' ? (
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
