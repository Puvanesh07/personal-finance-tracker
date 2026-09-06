/**
 * src/components/ui/QuickAddFAB.tsx
 *
 * Global Quick Add FAB — fully inline, no navigation.
 * Opens a slide-up sheet with 8 action types.
 * Every action creates the record directly in Firestore without leaving the page.
 * Target: user completes any entry in < 10 seconds.
 */

import {
  useState, useCallback, useEffect, useRef, useMemo,
} from 'react';
import {
  FiPlus, FiX, FiCheck, FiChevronDown,
  FiArrowLeft, FiLoader,
} from 'react-icons/fi';
import { usePortfolioStore } from '../../store/portfolioStore';
import { formatINR } from '../../utils/format';
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from '../cashflow/UpsertCashflowModal';
import toast from 'react-hot-toast';

// ─── Shared helpers ───────────────────────────────────────────────────────────

function todayISO() { return new Date().toISOString().slice(0, 10); }

const FIELD_CLS =
  'w-full rounded-xl border border-slate-200 dark:border-slate-700 ' +
  'bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-medium ' +
  'text-slate-900 dark:text-slate-100 outline-none transition-all ' +
  'focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 ' +
  'placeholder:text-slate-400 dark:placeholder:text-slate-500';

const LABEL_CLS = 'text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 block';

function AmountInput({
  value, onChange, autoFocus = false,
}: {
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);
  return (
    <div className='flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20'>
      <span className='pl-4 pr-2 text-slate-400 dark:text-slate-500 font-bold text-lg shrink-0'>₹</span>
      <input
        ref={ref}
        type='number'
        min='0'
        step='1'
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder='0'
        className='flex-1 py-2.5 pr-4 text-lg font-bold text-slate-900 dark:text-slate-100 bg-transparent outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600'
      />
    </div>
  );
}

function CategorySelect({
  value, onChange, type,
}: {
  value: string;
  onChange: (v: string) => void;
  type: 'expense' | 'income';
}) {
  const custom = usePortfolioStore((s) => s.customCategories[type]);
  const hidden = usePortfolioStore((s) => s.hiddenCategories[type]);
  const defaults = type === 'expense' ? DEFAULT_EXPENSE_CATEGORIES : DEFAULT_INCOME_CATEGORIES;

  const all = useMemo(() => {
    const customItems = custom.map((c) => ({ key: c, icon: '🏷️' }));
    return [...defaults, ...customItems].filter((c) => !hidden.includes(c.key));
  }, [defaults, custom, hidden]);

  return (
    <div className='relative'>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${FIELD_CLS} appearance-none pr-9`}
      >
        <option value=''>Select category</option>
        {all.map((c) => (
          <option key={c.key} value={c.key}>{c.icon} {c.key}</option>
        ))}
      </select>
      <FiChevronDown className='pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500' />
    </div>
  );
}

function AccountSelect({
  value, onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const accounts = usePortfolioStore((s) => s.accounts);
  if (!accounts.length) return null;
  return (
    <div>
      <label className={LABEL_CLS}>Account</label>
      <div className='relative'>
        <select value={value} onChange={(e) => onChange(e.target.value)} className={`${FIELD_CLS} appearance-none pr-9`}>
          <option value=''>No account</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name} ({formatINR(a.balance)})</option>
          ))}
        </select>
        <FiChevronDown className='pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500' />
      </div>
    </div>
  );
}

// ─── Individual inline forms ──────────────────────────────────────────────────

// Shared save button
function SaveBtn({ saving, label = 'Save' }: { saving: boolean; label?: string }) {
  return (
    <button
      type='submit'
      disabled={saving}
      className='w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 py-3 text-sm font-bold text-white transition-all disabled:opacity-40 active:scale-[0.98]'
    >
      {saving
        ? <><FiLoader className='h-4 w-4 animate-spin' /> Saving…</>
        : <><FiCheck className='h-4 w-4' /> {label}</>
      }
    </button>
  );
}

// ── 1. Expense / Income form ──────────────────────────────────────────────────

function CashflowForm({ type, onDone }: { type: 'expense' | 'income'; onDone: () => void }) {
  const addCashflow = usePortfolioStore((s) => s.addCashflow);
  const [amount,    setAmount]    = useState('');
  const [category,  setCategory]  = useState('');
  const [accountId, setAccountId] = useState('');
  const [date,      setDate]      = useState(todayISO());
  const [notes,     setNotes]     = useState('');
  const [saving,    setSaving]    = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0 || !category) return;
    setSaving(true);
    try {
      await addCashflow({
        type, date, category, amount: amt,
        ...(notes.trim()  ? { notes: notes.trim() } : {}),
        ...(accountId     ? { accountId }           : {}),
      } as any);
      toast.success(`${type === 'income' ? 'Income' : 'Expense'} added!`);
      onDone();
    } catch {
      toast.error('Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className='space-y-3'>
      <div>
        <label className={LABEL_CLS}>Amount</label>
        <AmountInput value={amount} onChange={setAmount} autoFocus />
      </div>
      <div>
        <label className={LABEL_CLS}>Category</label>
        <CategorySelect value={category} onChange={setCategory} type={type} />
      </div>
      <div className='grid grid-cols-2 gap-2'>
        <div>
          <label className={LABEL_CLS}>Date</label>
          <input type='date' value={date} onChange={(e) => setDate(e.target.value)} className={FIELD_CLS} />
        </div>
        <AccountSelect value={accountId} onChange={setAccountId} />
      </div>
      <div>
        <label className={LABEL_CLS}>Notes (optional)</label>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder='e.g. Swiggy order' className={FIELD_CLS} />
      </div>
      <SaveBtn saving={saving} label={type === 'income' ? 'Add Income' : 'Add Expense'} />
    </form>
  );
}

// ── 2. Payment / Bill reminder ────────────────────────────────────────────────

function PaymentForm({ onDone }: { onDone: () => void }) {
  const addTrackedPayment = usePortfolioStore((s) => s.addTrackedPayment);
  const [title,    setTitle]    = useState('');
  const [amount,   setAmount]   = useState('');
  const [dueDate,  setDueDate]  = useState(todayISO());
  const [recur,    setRecur]    = useState<import('../../types/investmentTypes').PaymentRecurrence>('none');
  const [saving,   setSaving]   = useState(false);

  const PAYMENT_TYPES = ['custom','rent','emi','credit_card','insurance','subscription','utilities','other'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!title.trim() || !amt || amt <= 0) return;
    setSaving(true);
    try {
      await addTrackedPayment({
        title:        title.trim(),
        amount:       amt,
        dueDate,
        paymentType:  'custom' as any,
        recurrence:   recur,
        reminderDays: [1, 3, 7],
      });
      toast.success('Payment reminder added!');
      onDone();
    } catch {
      toast.error('Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  void PAYMENT_TYPES;

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className='space-y-3'>
      <div>
        <label className={LABEL_CLS}>Title</label>
        <input
          value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder='e.g. Electricity Bill, EMI…' className={FIELD_CLS} autoFocus
        />
      </div>
      <div>
        <label className={LABEL_CLS}>Amount</label>
        <AmountInput value={amount} onChange={setAmount} />
      </div>
      <div className='grid grid-cols-2 gap-2'>
        <div>
          <label className={LABEL_CLS}>Due Date</label>
          <input type='date' value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={FIELD_CLS} />
        </div>
        <div>
          <label className={LABEL_CLS}>Recurrence</label>
          <div className='relative'>
            <select value={recur} onChange={(e) => setRecur(e.target.value as any)} className={`${FIELD_CLS} appearance-none pr-9`}>
              <option value='none'>One-time</option>
              <option value='weekly'>Weekly</option>
              <option value='every_2_weeks'>Every 2 weeks</option>
              <option value='monthly'>Monthly</option>
              <option value='every_2_months'>Every 2 months</option>
              <option value='quarterly'>Quarterly (3 months)</option>
              <option value='half_yearly'>Half-yearly (6 months)</option>
              <option value='yearly'>Yearly</option>
            </select>
            <FiChevronDown className='pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400' />
          </div>
        </div>
      </div>
      <SaveBtn saving={saving} label='Add Payment Reminder' />
    </form>
  );
}

// ── 3. Goal ───────────────────────────────────────────────────────────────────

function GoalForm({ onDone }: { onDone: () => void }) {
  const addGoal  = usePortfolioStore((s) => s.addGoal);
  const [name,   setName]   = useState('');
  const [target, setTarget] = useState('');
  const [due,    setDue]    = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(target);
    if (!name.trim() || !amt || amt <= 0) return;
    setSaving(true);
    try {
      await addGoal({
        name: name.trim(),
        targetAmount: amt,
        currentAmount: 0,
        status: 'active',
        ...(due ? { dueDate: due } : {}),
      } as any);
      toast.success('Goal created!');
      onDone();
    } catch {
      toast.error('Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className='space-y-3'>
      <div>
        <label className={LABEL_CLS}>Goal Name</label>
        <input
          value={name} onChange={(e) => setName(e.target.value)}
          placeholder='e.g. Emergency Fund, Car…' className={FIELD_CLS} autoFocus
        />
      </div>
      <div>
        <label className={LABEL_CLS}>Target Amount</label>
        <AmountInput value={target} onChange={setTarget} />
      </div>
      <div>
        <label className={LABEL_CLS}>Target Date (optional)</label>
        <input type='date' value={due} onChange={(e) => setDue(e.target.value)} className={FIELD_CLS} />
      </div>
      <SaveBtn saving={saving} label='Create Goal' />
    </form>
  );
}

// ── 4. Liability / Loan ───────────────────────────────────────────────────────

function LiabilityForm({ onDone }: { onDone: () => void }) {
  const addLiability = usePortfolioStore((s) => s.addLiability);
  const [name,    setName]    = useState('');
  const [amount,  setAmount]  = useState('');
  const [rate,    setRate]    = useState('');
  const [emi,     setEmi]     = useState('');
  const [saving,  setSaving]  = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const principal = parseFloat(amount);
    if (!name.trim() || !principal || principal <= 0) return;
    setSaving(true);
    try {
      await addLiability({
        type: 'loan',
        name: name.trim(),
        principal,
        outstanding: principal,
        status: 'active',
        ...(rate ? { interestRate: parseFloat(rate) } : {}),
        ...(emi  ? { emiAmount:   parseFloat(emi)  } : {}),
      } as any);
      toast.success('Loan added!');
      onDone();
    } catch {
      toast.error('Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className='space-y-3'>
      <div>
        <label className={LABEL_CLS}>Loan / Liability Name</label>
        <input
          value={name} onChange={(e) => setName(e.target.value)}
          placeholder='e.g. Home Loan, Car Loan…' className={FIELD_CLS} autoFocus
        />
      </div>
      <div>
        <label className={LABEL_CLS}>Total Amount</label>
        <AmountInput value={amount} onChange={setAmount} />
      </div>
      <div className='grid grid-cols-2 gap-2'>
        <div>
          <label className={LABEL_CLS}>Interest Rate % (opt.)</label>
          <input type='number' min='0' step='0.01' value={rate} onChange={(e) => setRate(e.target.value)} placeholder='e.g. 8.5' className={FIELD_CLS} />
        </div>
        <div>
          <label className={LABEL_CLS}>EMI Amount (opt.)</label>
          <input type='number' min='0' value={emi} onChange={(e) => setEmi(e.target.value)} placeholder='Monthly EMI' className={FIELD_CLS} />
        </div>
      </div>
      <SaveBtn saving={saving} label='Add Liability' />
    </form>
  );
}

// ── 5. Insurance policy ───────────────────────────────────────────────────────

function InsuranceForm({ onDone }: { onDone: () => void }) {
  const addInsurancePolicy = usePortfolioStore((s) => s.addInsurancePolicy);
  const [name,      setName]      = useState('');
  const [provider,  setProvider]  = useState('');
  const [premium,   setPremium]   = useState('');
  const [coverage,  setCoverage]  = useState('');
  const [renewal,   setRenewal]   = useState(todayISO());
  const [insType,   setInsType]   = useState<'life' | 'health' | 'vehicle' | 'property' | 'other'>('life');
  const [saving,    setSaving]    = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const prem = parseFloat(premium);
    if (!name.trim() || !prem || prem <= 0) return;
    setSaving(true);
    try {
      await addInsurancePolicy({
        type:             insType,
        policyName:       name.trim(),
        provider:         provider.trim() || 'Unknown',
        premiumAmount:    prem,
        premiumFrequency: 'yearly',
        coverageAmount:   parseFloat(coverage) || 0,
        renewalDate:      renewal,
      } as any);
      toast.success('Insurance policy added!');
      onDone();
    } catch {
      toast.error('Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className='space-y-3'>
      <div>
        <label className={LABEL_CLS}>Policy Name</label>
        <input
          value={name} onChange={(e) => setName(e.target.value)}
          placeholder='e.g. LIC Term Plan…' className={FIELD_CLS} autoFocus
        />
      </div>
      <div className='grid grid-cols-2 gap-2'>
        <div>
          <label className={LABEL_CLS}>Type</label>
          <div className='relative'>
            <select value={insType} onChange={(e) => setInsType(e.target.value as any)} className={`${FIELD_CLS} appearance-none pr-9`}>
              <option value='life'>Life</option>
              <option value='health'>Health</option>
              <option value='vehicle'>Vehicle</option>
              <option value='property'>Property</option>
              <option value='other'>Other</option>
            </select>
            <FiChevronDown className='pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400' />
          </div>
        </div>
        <div>
          <label className={LABEL_CLS}>Provider (opt.)</label>
          <input value={provider} onChange={(e) => setProvider(e.target.value)} placeholder='e.g. LIC, HDFC…' className={FIELD_CLS} />
        </div>
      </div>
      <div className='grid grid-cols-2 gap-2'>
        <div>
          <label className={LABEL_CLS}>Annual Premium</label>
          <AmountInput value={premium} onChange={setPremium} />
        </div>
        <div>
          <label className={LABEL_CLS}>Coverage (opt.)</label>
          <AmountInput value={coverage} onChange={setCoverage} />
        </div>
      </div>
      <div>
        <label className={LABEL_CLS}>Renewal Date</label>
        <input type='date' value={renewal} onChange={(e) => setRenewal(e.target.value)} className={FIELD_CLS} />
      </div>
      <SaveBtn saving={saving} label='Add Insurance' />
    </form>
  );
}



// ── 7. Investment (stock) ─────────────────────────────────────────────────────

function InvestmentForm({ onDone }: { onDone: () => void }) {
  const addInvestment = usePortfolioStore((s) => s.addInvestment);
  const [name,     setName]     = useState('');
  const [symbol,   setSymbol]   = useState('');
  const [qty,      setQty]      = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [invType,  setInvType]  = useState<'stock' | 'mutual_fund' | 'fixed_deposit' | 'other'>('stock');
  const [saving,   setSaving]   = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (invType === 'stock') {
        const q = parseFloat(qty) || 1;
        const bp = parseFloat(buyPrice) || 0;
        await addInvestment({
          type: 'stock', name: name.trim(),
          symbol: symbol.trim() || name.trim().toUpperCase().slice(0, 6),
          quantity: q, buyPrice: bp, currentPrice: bp,
          platform: 'manual', status: 'active',
        } as any);
      } else if (invType === 'mutual_fund') {
        const amt = parseFloat(buyPrice) || 0;
        const nav = parseFloat(qty) || 1;
        await addInvestment({
          type: 'mutual_fund', name: name.trim(),
          units: amt > 0 && nav > 0 ? amt / nav : 0,
          nav, investedAmount: amt,
          platform: 'manual', status: 'active',
        } as any);
      } else {
        const amt = parseFloat(buyPrice) || 0;
        await addInvestment({
          type: invType, name: name.trim(),
          investedAmount: amt, currentValue: amt,
          platform: 'manual', status: 'active',
        } as any);
      }
      toast.success('Investment added!');
      onDone();
    } catch {
      toast.error('Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const qtyLabel    = invType === 'mutual_fund' ? 'NAV (₹)' : 'Quantity';
  const amountLabel = invType === 'mutual_fund' ? 'Invested Amount' : invType === 'stock' ? 'Buy Price (₹)' : 'Amount (₹)';

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className='space-y-3'>
      <div>
        <label className={LABEL_CLS}>Type</label>
        <div className='flex gap-1.5 flex-wrap'>
          {(['stock','mutual_fund','fixed_deposit','other'] as const).map((t) => (
            <button key={t} type='button' onClick={() => setInvType(t)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold border transition-colors ${
                invType === t
                  ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-600 dark:text-indigo-400'
                  : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}>
              {t.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className={LABEL_CLS}>Name</label>
        <input
          value={name} onChange={(e) => setName(e.target.value)}
          placeholder={invType === 'stock' ? 'e.g. TCS, Reliance…' : 'Fund / Asset name…'}
          className={FIELD_CLS} autoFocus
        />
      </div>
      {invType === 'stock' && (
        <div>
          <label className={LABEL_CLS}>Symbol (opt.)</label>
          <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder='e.g. TCS' className={FIELD_CLS} />
        </div>
      )}
      <div className='grid grid-cols-2 gap-2'>
        {invType !== 'other' && invType !== 'fixed_deposit' && (
          <div>
            <label className={LABEL_CLS}>{qtyLabel}</label>
            <input type='number' min='0' step='any' value={qty} onChange={(e) => setQty(e.target.value)} placeholder='0' className={FIELD_CLS} />
          </div>
        )}
        <div>
          <label className={LABEL_CLS}>{amountLabel}</label>
          <AmountInput value={buyPrice} onChange={setBuyPrice} />
        </div>
      </div>
      <SaveBtn saving={saving} label='Add Investment' />
    </form>
  );
}

// ─── Action definitions ───────────────────────────────────────────────────────

const ACTIONS = [
  { id: 'expense',    emoji: '💸', label: 'Expense',     bg: 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800',     text: 'text-rose-700 dark:text-rose-300' },
  { id: 'income',     emoji: '💰', label: 'Income',      bg: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800', text: 'text-emerald-700 dark:text-emerald-300' },
  { id: 'payment',    emoji: '💳', label: 'Payment',     bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',   text: 'text-amber-700 dark:text-amber-300' },
  { id: 'investment', emoji: '📈', label: 'Investment',  bg: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800', text: 'text-indigo-700 dark:text-indigo-300' },
  { id: 'goal',       emoji: '🎯', label: 'Goal',        bg: 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800', text: 'text-violet-700 dark:text-violet-300' },
  { id: 'liability',  emoji: '🏦', label: 'Loan',        bg: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800', text: 'text-orange-700 dark:text-orange-300' },
  { id: 'insurance',  emoji: '🛡️', label: 'Insurance',   bg: 'bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-800',         text: 'text-sky-700 dark:text-sky-300' },
] as const;

type ActionId = typeof ACTIONS[number]['id'];

// ─── Main FAB ─────────────────────────────────────────────────────────────────

export function QuickAddFAB() {
  const [open,   setOpen]   = useState(false);
  const [active, setActive] = useState<ActionId | null>(null);

  const close = useCallback(() => { setOpen(false); setActive(null); }, []);
  const done  = useCallback(() => { setActive(null); setOpen(false); }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [close]);

  const activeMeta = ACTIONS.find((a) => a.id === active);

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className='fixed inset-0 z-[90] bg-black/40 dark:bg-black/60 backdrop-blur-sm'
          onClick={close}
        />
      )}

      {/* Sheet */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-[100] bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl border-t border-slate-200 dark:border-slate-800 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className='mx-auto max-w-md'>
          {/* Handle */}
          <div className='flex justify-center pt-3 pb-1'>
            <div className='h-1 w-10 rounded-full bg-slate-200 dark:bg-slate-700' />
          </div>

          {/* Header */}
          <div className='flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800'>
            {active ? (
              <button type='button' onClick={() => setActive(null)}
                className='flex items-center gap-1.5 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors'>
                <FiArrowLeft className='h-4 w-4' />
                Back
              </button>
            ) : (
              <span className='text-sm font-bold text-slate-900 dark:text-slate-100'>Quick Add</span>
            )}
            <span className='flex-1' />
            {activeMeta && (
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${activeMeta.bg} ${activeMeta.text}`}>
                {activeMeta.emoji} {activeMeta.label}
              </span>
            )}
            <button type='button' onClick={close}
              className='flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors'>
              <FiX className='h-4 w-4' />
            </button>
          </div>

          {/* Content */}
          <div className='px-4 py-4 pb-8 overflow-y-auto max-h-[70vh]'>
            {!active ? (
              /* Action grid */
              <>
                <div className='grid grid-cols-4 gap-2'>
                  {ACTIONS.map((a) => (
                    <button
                      key={a.id}
                      type='button'
                      onClick={() => setActive(a.id)}
                      className={`flex flex-col items-center gap-2 rounded-2xl border py-3.5 px-2 transition-all hover:-translate-y-0.5 hover:shadow-sm active:scale-95 ${a.bg}`}
                    >
                      <span className='text-2xl'>{a.emoji}</span>
                      <span className={`text-[10px] font-bold text-center leading-tight ${a.text}`}>{a.label}</span>
                    </button>
                  ))}
                </div>
                <p className='text-center text-[10px] text-slate-400 dark:text-slate-500 mt-4'>
                  All entries save directly to your account
                </p>
              </>
            ) : (
              /* Inline form */
              <>
                {active === 'expense'    && <CashflowForm   type='expense'  onDone={done} />}
                {active === 'income'     && <CashflowForm   type='income'   onDone={done} />}
                {active === 'payment'    && <PaymentForm                    onDone={done} />}
                {active === 'investment' && <InvestmentForm                 onDone={done} />}
                {active === 'goal'       && <GoalForm                       onDone={done} />}
                {active === 'liability'  && <LiabilityForm                  onDone={done} />}
                {active === 'insurance'  && <InsuranceForm                  onDone={done} />}
              </>
            )}
          </div>
        </div>
      </div>

      {/* FAB button */}
      <button
        type='button'
        onClick={() => setOpen((p) => !p)}
        aria-label='Quick Add'
        className={`fixed bottom-8 right-5 z-[85] flex h-14 w-14 items-center justify-center rounded-full shadow-2xl transition-all duration-300 active:scale-90 md:bottom-6 md:right-6 ${
          open
            ? 'bg-slate-100 dark:bg-slate-800 rotate-45 shadow-none'
            : 'bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-500/40 hover:-translate-y-1 hover:shadow-emerald-500/60'
        }`}
      >
        <FiPlus className='h-6 w-6 text-white' strokeWidth={2.5} />
      </button>
    </>
  );
}
