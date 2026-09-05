import { FiPlus, FiSave } from 'react-icons/fi';
import { useMemo, useState } from 'react';

import type { PendingPayment } from '../../types/investmentTypes';
import { Modal } from '../ui/Modal';
import { NumericInput } from '../ui/NumericInput';
import { usePortfolioStore } from '../../store/portfolioStore';

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
    };
  }, [props.mode, props.payment]);

  const [state, setState] = useState<FormState>(initial);
  const [saving, setSaving] = useState(false);

  const inputCls =
    'w-full rounded-xl border border-slate-300/80 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-900/50 px-4 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100 shadow-sm outline-none transition-all focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 placeholder:text-slate-400 dark:placeholder:text-slate-500';
  const labelCls =
    'text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5 block ml-1';

  const onSubmit = async () => {
    if (!state.buyerName.trim() || !state.itemDescription.trim()) return;
    const amount = Number(state.amount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    if (!state.saleDate || !state.expectedPaymentDate) return;

    setSaving(true);
    try {
      const payload = {
        buyerName: state.buyerName.trim(),
        buyerPhone: state.buyerPhone.trim() || undefined,
        itemDescription: state.itemDescription.trim(),
        amount,
        saleDate: state.saleDate,
        expectedPaymentDate: state.expectedPaymentDate,
        notes: state.notes.trim() || undefined,
      };

      if (props.mode === 'create') await addPendingPayment(payload);
      else await updatePendingPayment(props.payment.id, payload);

      props.onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title={
        props.mode === 'create'
          ? 'Record Pending Payment'
          : 'Edit Pending Payment'
      }
    >
      <div className='flex flex-col gap-4'>
        <div>
          <label className={labelCls}>Buyer / Vendor Name</label>
          <input
            className={inputCls}
            value={state.buyerName}
            onChange={(e) =>
              setState((s) => ({ ...s, buyerName: e.target.value }))
            }
            placeholder='e.g. Arun'
          />
        </div>

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
          <label className={labelCls}>Item / Sale Description</label>
          <input
            className={inputCls}
            value={state.itemDescription}
            onChange={(e) =>
              setState((s) => ({ ...s, itemDescription: e.target.value }))
            }
            placeholder='e.g. Friend needs to give'
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

        <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
          <div>
            <label className={labelCls}>Sale Date</label>
            <input
              type='date'
              className={inputCls}
              value={state.saleDate}
              onChange={(e) =>
                setState((s) => ({ ...s, saleDate: e.target.value }))
              }
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
        </div>

        <div>
          <label className={labelCls}>Notes (optional)</label>
          <textarea
            className={`${inputCls} min-h-[80px] resize-y`}
            value={state.notes}
            onChange={(e) =>
              setState((s) => ({ ...s, notes: e.target.value }))
            }
            placeholder='e.g. Agreed to pay by next week'
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
