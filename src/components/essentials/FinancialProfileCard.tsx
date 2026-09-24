// src/components/essentials/FinancialProfileCard.tsx
//
// The ONE Financial Profile form (Age · Monthly Income · Monthly Expense ·
// auto-calculated Monthly Savings). Saved into `essentials` on the shared
// store, so the Essentials cards, Goals projections and Dashboard cash-flow
// metrics all recalculate automatically from the same source of truth.

import { FiSave, FiUser } from 'react-icons/fi';
import { useEffect, useState } from 'react';

import { NumericInput } from '../ui/NumericInput';
import { formatINR } from '../../utils/format';
import { usePortfolioStore } from '../../store/portfolioStore';

const inputCls =
  'mt-1 w-full rounded-xl border border-slate-300/80 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-900/50 px-4 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100 outline-none transition-all focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 placeholder:text-slate-400 dark:placeholder:text-slate-500';
const labelCls =
  'block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400';

export function FinancialProfileCard() {
  const essentials = usePortfolioStore((s) => s.essentials);
  const setEssentialsConfig = usePortfolioStore((s) => s.setEssentialsConfig);

  const [local, setLocal] = useState({
    age: '',
    monthlyIncome: '0',
    monthlyExpense: '0',
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  // Sync from the shared store whenever the saved profile changes
  useEffect(() => {
    setLocal({
      age: essentials?.age ? String(essentials.age) : '',
      monthlyIncome: String(essentials?.monthlyIncome || 0),
      monthlyExpense: String(essentials?.monthlyExpense || 0),
    });
  }, [
    essentials?.age,
    essentials?.monthlyIncome,
    essentials?.monthlyExpense,
  ]);

  // Monthly Savings is always derived — never typed, never stored.
  const savings =
    (Number(local.monthlyIncome) || 0) - (Number(local.monthlyExpense) || 0);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setEssentialsConfig({
        age: Number(local.age) || 0,
        monthlyIncome: Number(local.monthlyIncome) || 0,
        monthlyExpense: Number(local.monthlyExpense) || 0,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save financial profile:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className='rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/30 p-5 sm:p-6 shadow-sm'>
      <div className='mb-5 flex items-center gap-2'>
        <FiUser className='h-4 w-4 text-emerald-500' />
        <h2 className='text-base font-bold text-slate-900 dark:text-slate-100'>
          Financial Profile
        </h2>
      </div>
      <p className='mb-5 text-xs text-slate-500 dark:text-slate-400'>
        Used for health scores and personalised guidance. All fields are
        optional.
      </p>

      <div className='grid gap-5 sm:grid-cols-2'>
        <div>
          <label className={labelCls}>Age</label>
          <NumericInput
            className={inputCls}
            allowDecimal={false}
            value={local.age}
            onChange={(v) => setLocal((s) => ({ ...s, age: v }))}
            placeholder='Years'
          />
        </div>
        <div>
          <label className={labelCls}>Monthly Income</label>
          <NumericInput
            className={inputCls}
            value={local.monthlyIncome}
            onChange={(v) => setLocal((s) => ({ ...s, monthlyIncome: v }))}
            placeholder='₹ per month'
          />
        </div>
        <div>
          <label className={labelCls}>Monthly Expense</label>
          <NumericInput
            className={inputCls}
            value={local.monthlyExpense}
            onChange={(v) => setLocal((s) => ({ ...s, monthlyExpense: v }))}
            placeholder='₹ per month'
          />
        </div>
        <div>
          <label className={labelCls}>Monthly Savings</label>
          <div className='mt-1 w-full rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-2.5 text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-400'>
            {formatINR(savings)}
          </div>
          <p className='mt-1 text-[11px] text-slate-500 dark:text-slate-400'>
            Auto-calculated from income − expense
          </p>
        </div>
      </div>

      <div className='mt-6 flex items-center gap-4'>
        <button
          onClick={() => void handleSave()}
          disabled={saving}
          className='inline-flex cursor-pointer items-center gap-2 rounded-xl bg-emerald-700 px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-500/20 transition-all hover:bg-emerald-600 disabled:opacity-50'
        >
          <FiSave className='h-4 w-4' />
          {saving ? 'Saving…' : 'Save'}
        </button>
        {success && (
          <span className='text-sm font-medium text-emerald-500 animate-pulse'>
            Saved — scores & projections updated ✓
          </span>
        )}
      </div>
    </div>
  );
}
