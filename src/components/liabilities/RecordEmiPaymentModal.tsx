// src/components/liabilities/RecordEmiPaymentModal.tsx
//
// Records a single EMI / installment against a liability (audit C1). The payment
// is split into principal + interest:
//   • principal reduces the liability's outstanding balance and moves out of a
//     funding account as a net-worth-neutral `transfer`, and
//   • interest is booked as a real `expense`.
// Together the funding account drops by the full EMI while the debt drops by the
// principal — so net worth falls by the interest only. Both derived cashflows are
// written in the same atomic batch as the liability update (C5).

import { useEffect, useMemo, useState } from 'react';
import { FiCreditCard } from 'react-icons/fi';
import type { Liability } from '../../types/investmentTypes';
import { Modal } from '../ui/Modal';
import { Select } from '../ui/Select';
import { NumericInput } from '../ui/NumericInput';
import { CalendarPicker } from '../ui/CalendarPicker';
import { usePortfolioStore } from '../../store/portfolioStore';
import { calcLiveAccountBalances } from '../../utils/calculations';
import { formatINR } from '../../utils/format';

type Props = {
  open: boolean;
  onClose: () => void;
  liability: Liability;
};

const toNum = (v: string) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n: number) => Math.round(n * 100) / 100;

/** One month of interest on the current outstanding at the stated annual rate. */
function suggestedInterest(liability: Liability) {
  const rate = liability.interestRate ?? 0;
  if (rate <= 0 || !(liability.outstanding > 0)) return 0;
  return round2((liability.outstanding * rate) / 12 / 100);
}

export function RecordEmiPaymentModal({ open, onClose, liability }: Props) {
  const accounts = usePortfolioStore((s) => s.accounts);
  const cashflows = usePortfolioStore((s) => s.cashflows);
  const recordLiabilityPayment = usePortfolioStore(
    (s) => s.recordLiabilityPayment,
  );
  const liveBalances = useMemo(
    () => calcLiveAccountBalances(accounts, cashflows),
    [accounts, cashflows],
  );

  const emi = liability.emiAmount ?? 0;
  const [amount, setAmount] = useState('');
  const [interest, setInterest] = useState('');
  const [principal, setPrincipal] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [accountId, setAccountId] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  // (Re)initialise the form each time it opens, pre-filling a sensible split.
  useEffect(() => {
    if (!open) return;
    const defaultAmount = emi > 0 ? emi : liability.outstanding ?? 0;
    const defaultInterest = Math.min(suggestedInterest(liability), defaultAmount);
    const defaultPrincipal = round2(defaultAmount - defaultInterest);
    setAmount(defaultAmount ? String(defaultAmount) : '');
    setInterest(String(defaultInterest));
    setPrincipal(String(defaultPrincipal));
    setDate(new Date().toISOString().split('T')[0]);
    setAccountId('');
    setNote('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, liability.id]);

  const inputCls =
    'w-full rounded-xl border border-slate-300/80 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-900/50 px-4 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100 shadow-sm outline-none transition-all focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 placeholder:text-slate-400 dark:placeholder:text-slate-500';
  const labelCls =
    'text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 block';

  // Keep the three figures consistent: Total = Principal + Interest.
  const onAmountChange = (v: string) => {
    setAmount(v);
    setPrincipal(String(Math.max(0, round2(toNum(v) - toNum(interest)))));
  };
  const onInterestChange = (v: string) => {
    setInterest(v);
    setPrincipal(String(Math.max(0, round2(toNum(amount) - toNum(v)))));
  };
  const onPrincipalChange = (v: string) => {
    setPrincipal(v);
    setInterest(String(Math.max(0, round2(toNum(amount) - toNum(v)))));
  };

  const pAmt = Math.max(0, toNum(principal));
  const iAmt = Math.max(0, toNum(interest));
  const total = round2(pAmt + iAmt);
  const overOutstanding = pAmt > (liability.outstanding ?? 0) + 0.01;
  const valid = total > 0 && !overOutstanding;

  async function handleSubmit() {
    if (!valid) return;
    setSaving(true);
    try {
      await recordLiabilityPayment(liability.id, {
        date,
        amount: total,
        principal: pAmt,
        interest: iAmt,
        accountId: accountId || undefined,
        note: note.trim() || undefined,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Record EMI — ${liability.name}`}
    >
      <div className='grid grid-cols-1 gap-5'>
        <div className='rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-4 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 flex justify-between'>
          <span>Outstanding: {formatINR(liability.outstanding ?? 0)}</span>
          {emi > 0 && <span>Monthly EMI: {formatINR(emi)}</span>}
        </div>

        <div>
          <label className={labelCls}>Date</label>
          <CalendarPicker value={date} onChange={setDate} placeholder='Select date' />
        </div>

        <div>
          <label className={labelCls}>Total Paid (₹)</label>
          <NumericInput
            className={inputCls}
            value={amount}
            onChange={onAmountChange}
            placeholder='e.g. 15000'
          />
        </div>

        <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
          <div>
            <label className={labelCls}>Principal (₹)</label>
            <NumericInput
              className={inputCls}
              value={principal}
              onChange={onPrincipalChange}
            />
          </div>
          <div>
            <label className={labelCls}>Interest (₹)</label>
            <NumericInput
              className={inputCls}
              value={interest}
              onChange={onInterestChange}
            />
          </div>
        </div>

        {overOutstanding && (
          <p className='text-[11px] font-semibold text-rose-500'>
            Principal exceeds the outstanding balance ({formatINR(liability.outstanding ?? 0)}).
            Reduce it before saving.
          </p>
        )}

        <div>
          <label className={labelCls}>Paid From (funding account)</label>
          <Select
            className={inputCls}
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            placeholder='Select account…'
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} · {formatINR(liveBalances[a.id] ?? a.balance)}
              </option>
            ))}
          </Select>
          <p className='mt-1.5 text-[11px] text-slate-500 dark:text-slate-400'>
            Choose the account the EMI leaves. Principal moves out as a transfer
            (not counted as spending); only the {formatINR(iAmt)} interest lowers your
            net worth.
          </p>
        </div>

        <div>
          <label className={labelCls}>Note (Optional)</label>
          <input
            className={inputCls}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder='e.g. March EMI via autopay'
          />
        </div>

        <div className='flex items-center justify-end gap-3 border-t border-slate-200/70 dark:border-slate-800/60 pt-4'>
          <button
            type='button'
            className='rounded-xl px-5 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors disabled:opacity-60'
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type='button'
            className='inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition-all hover:-translate-y-0.5 disabled:opacity-60'
            onClick={() => void handleSubmit()}
            disabled={saving || !valid}
          >
            <FiCreditCard className='h-4 w-4' />
            <span>{saving ? 'Saving…' : `Record ${formatINR(total)}`}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
