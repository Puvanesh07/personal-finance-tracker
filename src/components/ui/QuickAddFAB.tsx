/**
 * src/components/ui/QuickAddFAB.tsx
 *
 * Global Quick Add FAB — floating "+" button visible on every page.
 * Opens a slide-up sheet with 8 quick-add actions.
 * Each action opens the corresponding page's add modal / navigates with
 * a ?quickAdd=true param that pages can detect.
 *
 * Design target: user can log any transaction in < 10 seconds.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPlus, FiX } from 'react-icons/fi';
import { usePortfolioStore } from '../../store/portfolioStore';
import { formatINR } from '../../utils/format';

// ─── Quick-add inline expense/income form ────────────────────────────────────

interface InlineEntry {
  type: 'income' | 'expense';
  amount: string;
  category: string;
  date: string;
  notes: string;
  accountId: string;
}

function InlineTransactionForm({
  type,
  onDone,
  onCancel,
}: {
  type: 'income' | 'expense';
  onDone: () => void;
  onCancel: () => void;
}) {
  const { addCashflow, accounts } = usePortfolioStore();
  const [form, setForm] = useState<InlineEntry>({
    type,
    amount: '',
    category: type === 'income' ? 'Salary' : 'Food',
    date: new Date().toISOString().slice(0, 10),
    notes: '',
    accountId: accounts[0]?.id ?? '',
  });
  const [saving, setSaving] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => { amountRef.current?.focus(); }, []);

  const INCOME_CATS = ['Salary', 'Freelance', 'Business', 'Dividend', 'Interest', 'Gift', 'Refund', 'Other'];
  const EXPENSE_CATS = ['Food', 'Rent', 'Transport', 'Shopping', 'Medical', 'Entertainment', 'Electricity', 'Internet', 'Phone', 'Education', 'Insurance', 'EMI', 'Other'];
  const cats = type === 'income' ? INCOME_CATS : EXPENSE_CATS;

  const handleSave = async () => {
    const amt = parseFloat(form.amount.replace(/,/g, ''));
    if (!amt || amt <= 0) return;
    setSaving(true);
    try {
      await addCashflow({
        type: form.type,
        date: form.date,
        category: form.category,
        amount: amt,
        ...(form.notes ? { notes: form.notes } : {}),
        ...(form.accountId ? { accountId: form.accountId } : {}),
      });
      onDone();
    } finally {
      setSaving(false);
    }
  };

  const isIncome = type === 'income';
  const accentBg    = isIncome ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500';
  const accentBorder = isIncome ? 'border-emerald-500/30' : 'border-rose-500/30';

  return (
    <div className={`rounded-2xl border ${accentBorder} bg-white dark:bg-slate-900 p-4 space-y-3`}>
      <div className='flex items-center justify-between'>
        <span className={`text-sm font-bold ${isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
          {isIncome ? '💰 Add Income' : '💸 Add Expense'}
        </span>
        <button type='button' onClick={onCancel} className='text-slate-400 hover:text-slate-600'>
          <FiX className='h-4 w-4' />
        </button>
      </div>

      {/* Amount */}
      <div className='flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2'>
        <span className='text-slate-400 font-bold'>₹</span>
        <input
          ref={amountRef}
          type='number'
          placeholder='Amount'
          value={form.amount}
          onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleSave(); }}
          className='flex-1 bg-transparent text-lg font-bold text-slate-900 dark:text-slate-100 outline-none placeholder:text-slate-400'
        />
      </div>

      {/* Category */}
      <select
        value={form.category}
        onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
        className='w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 outline-none'
      >
        {cats.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>

      {/* Account + Date row */}
      <div className='grid grid-cols-2 gap-2'>
        {accounts.length > 0 && (
          <select
            value={form.accountId}
            onChange={(e) => setForm((p) => ({ ...p, accountId: e.target.value }))}
            className='rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-700 dark:text-slate-300 outline-none'
          >
            <option value=''>No account</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name} ({formatINR(a.balance)})</option>
            ))}
          </select>
        )}
        <input
          type='date'
          value={form.date}
          onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
          className='rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-700 dark:text-slate-300 outline-none col-span-1'
        />
      </div>

      {/* Notes */}
      <input
        type='text'
        placeholder='Notes (optional)'
        value={form.notes}
        onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
        className='w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 outline-none placeholder:text-slate-400'
      />

      <button
        type='button'
        onClick={() => void handleSave()}
        disabled={saving || !form.amount}
        className={`w-full rounded-xl py-2.5 text-sm font-bold text-white transition-all disabled:opacity-40 ${accentBg}`}
      >
        {saving ? 'Saving…' : `Save ${isIncome ? 'Income' : 'Expense'}`}
      </button>
    </div>
  );
}

// ─── Action definitions ───────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { id: 'expense',     emoji: '💸', label: 'Expense',      color: 'text-rose-600 dark:text-rose-400',     bg: 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-700/40' },
  { id: 'income',      emoji: '💰', label: 'Income',       color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700/40' },
  { id: 'payment',     emoji: '💳', label: 'Payment',      color: 'text-amber-600 dark:text-amber-400',   bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700/40' },
  { id: 'investment',  emoji: '📈', label: 'Investment',   color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-700/40' },
  { id: 'goal',        emoji: '🎯', label: 'Goal',         color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-700/40' },
  { id: 'liability',   emoji: '🏦', label: 'Loan/Liability', color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700/40' },
  { id: 'insurance',   emoji: '🛡️', label: 'Insurance',    color: 'text-sky-600 dark:text-sky-400',       bg: 'bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-700/40' },
  { id: 'lent',        emoji: '🤝', label: 'Money Lent',   color: 'text-teal-600 dark:text-teal-400',     bg: 'bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-700/40' },
] as const;

type ActionId = typeof QUICK_ACTIONS[number]['id'];

// ─── Main FAB component ───────────────────────────────────────────────────────

export function QuickAddFAB() {
  const navigate  = useNavigate();
  const [open,    setOpen]   = useState(false);
  const [inline,  setInline] = useState<'income' | 'expense' | null>(null);

  const close = useCallback(() => { setOpen(false); setInline(null); }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [close]);

  const handleAction = (id: ActionId) => {
    switch (id) {
      case 'expense':    setInline('expense');             return;
      case 'income':     setInline('income');              return;
      case 'payment':    close(); navigate('/payments?quickAdd=1'); return;
      case 'investment': close(); navigate('/investments?quickAdd=1'); return;
      case 'goal':       close(); navigate('/goals?quickAdd=1'); return;
      case 'liability':  close(); navigate('/liabilities?quickAdd=1'); return;
      case 'insurance':  close(); navigate('/insurance?quickAdd=1'); return;
      case 'lent':       close(); navigate('/cashflow?tab=lending&quickAdd=1'); return;
    }
  };

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className='fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm'
          onClick={close}
        />
      )}

      {/* Slide-up sheet */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-[100] bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl border-t border-slate-200 dark:border-slate-800 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
          ${open ? 'translate-y-0' : 'translate-y-full'}`}
      >
        <div className='px-4 pt-3 pb-8 max-w-lg mx-auto'>
          {/* Handle */}
          <div className='w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto mb-4' />

          {inline ? (
            <InlineTransactionForm
              type={inline}
              onDone={() => { close(); }}
              onCancel={() => setInline(null)}
            />
          ) : (
            <>
              <div className='flex items-center justify-between mb-4'>
                <h2 className='text-base font-bold text-slate-900 dark:text-slate-100'>Quick Add</h2>
                <button type='button' onClick={close} className='p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'>
                  <FiX className='h-4 w-4' />
                </button>
              </div>

              <div className='grid grid-cols-4 gap-2.5'>
                {QUICK_ACTIONS.map((a) => (
                  <button
                    key={a.id}
                    type='button'
                    onClick={() => handleAction(a.id)}
                    className={`flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3.5 transition-all hover:-translate-y-0.5 hover:shadow-sm active:scale-95 ${a.bg}`}
                  >
                    <span className='text-2xl'>{a.emoji}</span>
                    <span className={`text-[10px] font-bold text-center leading-tight ${a.color}`}>
                      {a.label}
                    </span>
                  </button>
                ))}
              </div>

              <p className='text-center text-[10px] text-slate-400 mt-4'>
                Expense & Income save instantly · Others open the relevant page
              </p>
            </>
          )}
        </div>
      </div>

      {/* FAB button — top right on desktop, bottom-right on mobile */}
      <button
        type='button'
        onClick={() => setOpen((p) => !p)}
        aria-label='Quick Add'
        className={`fixed bottom-8 right-6 z-[85] flex h-14 w-14 items-center justify-center rounded-full shadow-2xl transition-all duration-300 active:scale-90
          md:bottom-6 md:right-6
          ${open
            ? 'bg-slate-200 dark:bg-slate-700 rotate-45 shadow-none'
            : 'bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-500/40 hover:-translate-y-1'
          }`}
      >
        <FiPlus className='h-6 w-6 text-white' strokeWidth={2.5} />
      </button>
    </>
  );
}
