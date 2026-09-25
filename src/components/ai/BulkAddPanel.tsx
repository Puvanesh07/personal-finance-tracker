// src/components/ai/BulkAddPanel.tsx
// AI Coach — Bulk Add Panel
// Add multiple records at once across cashflow, payments, goals,
// liabilities, insurance, investments, and SIP instruments.
// Template button pre-fills example rows with today's date for easy copy-paste.
//
// Mobile: fields are sized/typed for one-handed entry — 16px text on phones (so
// iOS never auto-zooms the page under the keyboard), `inputMode` per field, and
// Enter/Next walking through every field of every row before triggering Save.

import { useMemo, useRef, useState } from 'react';
import {
  FiActivity, FiBell, FiCheck, FiChevronDown,
  FiCopy, FiFlag, FiLayers, FiPlus,
  FiShield, FiTrash2, FiTrendingDown, FiTrendingUp, FiX,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { usePortfolioStore } from '../../store/portfolioStore';
import { dismissKeyboard, useKeyboardFieldNavigation } from '../../hooks/useKeyboardFieldNavigation';

// ─── Feature types ────────────────────────────────────────────────────────────

type BulkFeature =
  | 'expense' | 'income' | 'payment' | 'goal'
  | 'liability' | 'insurance' | 'investment_fd'
  | 'investment_mf' | 'sip';

/**
 * Numeric fields are kept as *typed strings* and parsed only on save — binding a
 * number back into the input would eat the trailing `8.` while the user types
 * `8.5` and turn it into `85`.
 */
interface BulkEntry {
  id: string;
  feature: BulkFeature;
  // cashflow
  date: string; amount: string; category: string; notes: string;
  // payment
  title: string; dueDate: string; paymentType: string;
  // goal
  goalName: string; targetAmount: string;
  // liability
  liabilityName: string; principal: string; interestRate: string; emiAmount: string;
  // insurance
  policyName: string; provider: string; coverageAmount: string;
  renewalDate: string; insuranceType: string; premiumAmount: string;
  // investment
  investmentName: string; investedAmount: string;
  investmentRate: string; durationMonths: string;
  // sip
  sipName: string; sipPct: string;
}

const TODAY  = new Date().toISOString().slice(0, 10);
const IN30D  = new Date(Date.now() + 30  * 86400000).toISOString().slice(0, 10);
const IN365D = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);

let _seq = 0;
function uid() { return `bulk-${Date.now()}-${++_seq}`; }

/** Parse a typed amount — tolerant of `1,00,000.50` and a trailing point. */
function num(v: string): number {
  const n = Number.parseFloat((v || '').replace(/[, ]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function blank(feature: BulkFeature): BulkEntry {
  return {
    id: uid(), feature,
    date: TODAY, amount: '', category: feature === 'income' ? 'Salary' : 'Food', notes: '',
    title: '', dueDate: IN30D, paymentType: 'bill',
    goalName: '', targetAmount: '',
    liabilityName: '', principal: '', interestRate: '', emiAmount: '',
    policyName: '', provider: '', coverageAmount: '',
    renewalDate: IN365D, insuranceType: 'health', premiumAmount: '',
    investmentName: '', investedAmount: '', investmentRate: '', durationMonths: '12',
    sipName: '', sipPct: '',
  };
}

// ─── Validation ───────────────────────────────────────────────────────────────

function rowError(e: BulkEntry): string | null {
  switch (e.feature) {
    case 'expense': case 'income':
      if (!e.date)               return 'Pick a date';
      if (num(e.amount) <= 0)    return 'Enter an amount above 0';
      if (!e.category.trim())    return 'Enter a category';
      return null;
    case 'payment':
      if (!e.title.trim())       return 'Enter a title';
      if (num(e.amount) <= 0)    return 'Enter an amount above 0';
      if (!e.dueDate)            return 'Pick a due date';
      return null;
    case 'goal':
      if (!e.goalName.trim())    return 'Enter a goal name';
      if (num(e.targetAmount) <= 0) return 'Enter a target amount';
      return null;
    case 'liability':
      if (!e.liabilityName.trim()) return 'Enter a loan name';
      if (num(e.principal) <= 0)   return 'Enter the principal amount';
      return null;
    case 'insurance':
      if (!e.policyName.trim())     return 'Enter a policy name';
      if (num(e.premiumAmount) <= 0) return 'Enter the premium amount';
      if (!e.renewalDate)           return 'Pick a renewal date';
      return null;
    case 'investment_fd':
      if (!e.investmentName.trim())  return 'Enter the FD name';
      if (num(e.investedAmount) <= 0) return 'Enter the invested amount';
      return null;
    case 'investment_mf':
      if (!e.investmentName.trim())  return 'Enter the fund name';
      if (num(e.investedAmount) <= 0) return 'Enter the invested amount';
      return null;
    case 'sip':
      if (!e.sipName.trim()) return 'Enter a fund / instrument';
      if (num(e.sipPct) <= 0) return 'Enter an allocation %';
      return null;
    default:
      return null;
  }
}

// ─── Example templates ────────────────────────────────────────────────────────

const TEMPLATES: Record<BulkFeature, Partial<BulkEntry>[]> = {
  expense: [
    { category: 'Groceries',   amount: '3500', notes: 'Weekly groceries' },
    { category: 'Dining',      amount: '1200', notes: 'Lunch out' },
    { category: 'Electricity', amount: '1800', notes: 'Monthly bill' },
    { category: 'Transport',   amount: '800',  notes: 'Fuel' },
    { category: 'OTT',         amount: '649',  notes: 'Netflix' },
  ],
  income: [
    { category: 'Salary',    amount: '85000', notes: 'Monthly salary' },
    { category: 'Freelance', amount: '15000', notes: 'Client project' },
    { category: 'Interest',  amount: '2400',  notes: 'FD interest' },
  ],
  payment: [
    { title: 'Electricity Bill', amount: '1800', paymentType: 'bill'         },
    { title: 'Internet',         amount: '999',  paymentType: 'bill'         },
    { title: 'Gym Membership',   amount: '1500', paymentType: 'subscription' },
    { title: 'Car EMI',          amount: '12000',paymentType: 'emi'          },
  ],
  goal: [
    { goalName: 'Emergency Fund', targetAmount: '300000' },
    { goalName: 'Vacation Fund',  targetAmount: '100000' },
    { goalName: 'New Laptop',     targetAmount: '80000'  },
  ],
  liability: [
    { liabilityName: 'Home Loan',     principal: '5000000', interestRate: '8.5', emiAmount: '45000' },
    { liabilityName: 'Car Loan',      principal: '800000',  interestRate: '9.2', emiAmount: '16000' },
    { liabilityName: 'Personal Loan', principal: '200000',  interestRate: '14',  emiAmount: '8000'  },
  ],
  insurance: [
    { policyName: 'Term Plan',     provider: 'LIC',         coverageAmount: '10000000', premiumAmount: '12000', insuranceType: 'life'    },
    { policyName: 'Health Cover',  provider: 'Star Health', coverageAmount: '500000',   premiumAmount: '8500',  insuranceType: 'health'  },
    { policyName: 'Car Insurance', provider: 'HDFC Ergo',   coverageAmount: '800000',   premiumAmount: '6200',  insuranceType: 'vehicle' },
  ],
  investment_fd: [
    { investmentName: 'SBI FD 12M', investedAmount: '100000', investmentRate: '7.1', durationMonths: '12' },
    { investmentName: 'HDFC FD 6M', investedAmount: '50000',  investmentRate: '6.8', durationMonths: '6'  },
    { investmentName: 'PNB FD 18M', investedAmount: '75000',  investmentRate: '7.3', durationMonths: '18' },
  ],
  investment_mf: [
    { investmentName: 'Mirae Asset Large Cap',  investedAmount: '50000' },
    { investmentName: 'Parag Parikh Flexi Cap', investedAmount: '30000' },
    { investmentName: 'Axis Midcap Fund',       investedAmount: '20000' },
  ],
  sip: [
    { sipName: 'Nifty 50 Index Fund',   sipPct: '40' },
    { sipName: 'Midcap 150 Index Fund', sipPct: '30' },
    { sipName: 'International ETF',     sipPct: '20' },
    { sipName: 'Gold ETF',              sipPct: '10' },
  ],
};

const FEATURE_META: {
  key: BulkFeature; label: string; color: string;
  icon: React.ReactNode; activeClass: string;
}[] = [
  { key: 'expense',       label: 'Expense',     color: 'text-rose-500',    activeClass: 'bg-rose-600 text-white',    icon: <FiActivity   className='h-3 w-3 sm:h-3.5 sm:w-3.5'/> },
  { key: 'income',        label: 'Income',      color: 'text-emerald-500', activeClass: 'bg-emerald-600 text-white', icon: <FiActivity   className='h-3 w-3 sm:h-3.5 sm:w-3.5'/> },
  { key: 'payment',       label: 'Payment',     color: 'text-sky-500',     activeClass: 'bg-sky-600 text-white',     icon: <FiBell       className='h-3 w-3 sm:h-3.5 sm:w-3.5'/> },
  { key: 'goal',          label: 'Goal',        color: 'text-amber-500',   activeClass: 'bg-amber-600 text-white',   icon: <FiFlag       className='h-3 w-3 sm:h-3.5 sm:w-3.5'/> },
  { key: 'liability',     label: 'Liability',   color: 'text-orange-500',  activeClass: 'bg-orange-600 text-white',  icon: <FiTrendingDown className='h-3 w-3 sm:h-3.5 sm:w-3.5'/> },
  { key: 'insurance',     label: 'Insurance',   color: 'text-blue-500',    activeClass: 'bg-blue-600 text-white',    icon: <FiShield     className='h-3 w-3 sm:h-3.5 sm:w-3.5'/> },
  { key: 'investment_fd', label: 'Fixed Dep.',  color: 'text-indigo-500',  activeClass: 'bg-indigo-600 text-white',  icon: <FiTrendingUp className='h-3 w-3 sm:h-3.5 sm:w-3.5'/> },
  { key: 'investment_mf', label: 'Mutual Fund', color: 'text-violet-500',  activeClass: 'bg-violet-600 text-white',  icon: <FiTrendingUp className='h-3 w-3 sm:h-3.5 sm:w-3.5'/> },
  { key: 'sip',           label: 'SIP',         color: 'text-teal-500',    activeClass: 'bg-teal-600 text-white',    icon: <FiLayers     className='h-3 w-3 sm:h-3.5 sm:w-3.5'/> },
];

// ─── Field primitives ─────────────────────────────────────────────────────────

/**
 * Compact at every width: 13px text, 28px-tall fields on phones. iOS would
 * normally auto-zoom the page on a sub-16px input — the viewport meta in
 * index.html disables that scaling, which is what keeps the keyboard from
 * pushing the form out of view while still allowing small fields.
 */
const inputCls =
  'w-full min-w-0 rounded-md border border-slate-200 dark:border-slate-700 ' +
  'bg-white dark:bg-slate-800 px-1.5 py-1 sm:px-2.5 sm:py-2 text-[13px] leading-tight ' +
  'text-slate-900 dark:text-slate-100 ' +
  'placeholder:text-slate-400 dark:placeholder:text-slate-600 ' +
  'focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-400 ' +
  'transition-colors';

const labelCls =
  'text-[8px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 leading-none';

type FieldHint = 'next' | 'done';

function F({ label, wide, children }: {
  label: string; wide?: boolean; children: React.ReactNode;
}) {
  return (
    // `wide` only spans from `sm` up: on a phone every field is one cell of the
    // two-column grid, which keeps a whole record to two compact lines and lets
    // it stay visible above the keyboard.
    <div className={`flex flex-col gap-0.5 min-w-0 sm:gap-1 ${wide ? 'sm:col-span-2' : ''}`}>
      <span className={labelCls}>{label}</span>
      {children}
    </div>
  );
}

/** Text-ish field. `data-field` opts it into the Enter/Next keyboard walk. */
function TF({ label, value, onChange, placeholder, hint = 'next', wide, type = 'text', inputMode, autoCapitalize = 'none', prefix }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; hint?: FieldHint; wide?: boolean;
  type?: string; inputMode?: 'text' | 'numeric' | 'decimal';
  autoCapitalize?: 'none' | 'sentences' | 'words';
  prefix?: string;
}) {
  return (
    <F label={label} wide={wide}>
      <div className='relative flex items-center'>
        {prefix && (
          <span className='pointer-events-none absolute left-1.5 text-[11px] font-bold text-slate-400 dark:text-slate-500 sm:left-2.5 sm:text-[13px]'>
            {prefix}
          </span>
        )}
        <input
          data-field
          type={type}
          value={value}
          inputMode={inputMode}
          enterKeyHint={hint}
          autoCapitalize={autoCapitalize}
          autoComplete='off'
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`${inputCls} ${prefix ? 'pl-4 sm:pl-6' : ''}`}
        />
      </div>
    </F>
  );
}

/** ₹ amount → decimal keypad (no ₹ key, but the field is visibly an amount). */
function MoneyF({ label, value, onChange, hint, wide, placeholder = '0' }: {
  label: string; value: string; onChange: (v: string) => void;
  hint?: FieldHint; wide?: boolean; placeholder?: string;
}) {
  return (
    <TF
      label={label} value={value} onChange={onChange} hint={hint} wide={wide}
      inputMode='decimal' prefix='₹' placeholder={placeholder}
    />
  );
}

/** Whole numbers (months, quantities) → numeric keypad. */
function IntF({ label, value, onChange, hint, wide, placeholder }: {
  label: string; value: string; onChange: (v: string) => void;
  hint?: FieldHint; wide?: boolean; placeholder?: string;
}) {
  return (
    <TF
      label={label} value={value} onChange={onChange} hint={hint} wide={wide}
      inputMode='numeric' placeholder={placeholder}
    />
  );
}

/** Percentages / rates → decimal keypad. */
function RateF({ label, value, onChange, hint, wide, placeholder }: {
  label: string; value: string; onChange: (v: string) => void;
  hint?: FieldHint; wide?: boolean; placeholder?: string;
}) {
  return (
    <TF
      label={label} value={value} onChange={onChange} hint={hint} wide={wide}
      inputMode='decimal' placeholder={placeholder}
    />
  );
}

/** Native mobile date picker. */
function DateF({ label, value, onChange, hint, wide }: {
  label: string; value: string; onChange: (v: string) => void;
  hint?: FieldHint; wide?: boolean;
}) {
  return (
    <TF label={label} type='date' value={value} onChange={onChange} hint={hint} wide={wide} />
  );
}

/**
 * Small fixed option set → tap chips, not a native `<select>`.
 *
 * A phone picker opens *over* the form and, inside a viewport-pinned shell, it is
 * anchored into whatever sliver is left above the keyboard — which is what made
 * the choice feel unselectable. Six values fit in a strip and need no keyboard.
 */
function SF({ label, value, onChange, options, wide }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; wide?: boolean;
}) {
  return (
    <F label={label} wide={wide}>
      <div className='flex gap-1 overflow-x-auto pb-0.5 scrollbar-none'>
        {options.map((o) => (
          <button
            key={o.value} type='button'
            aria-pressed={value === o.value}
            onPointerDown={(ev) => ev.preventDefault()}
            onClick={() => onChange(o.value)}
            className={`h-6 shrink-0 rounded-md border px-1.5 text-[10px] font-bold transition-colors active:scale-95 sm:h-8 sm:px-2 sm:text-[11px] ${
              value === o.value
                ? 'border-violet-500 bg-violet-600 text-white shadow-sm'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </F>
  );
}

// ─── Per-feature row fields ───────────────────────────────────────────────────

/**
 * `done` marks the field that closes the keyboard walk for the whole panel —
 * it is the last field of the last row, and Enter there triggers Save All.
 */
function RowFields({ e, up, done }: {
  e: BulkEntry; up: (p: Partial<BulkEntry>) => void; done: boolean;
}) {
  const next: FieldHint = done ? 'done' : 'next';

  switch (e.feature) {
    case 'expense': case 'income': return (
      <div className='grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2'>
        <TF label='Category' wide value={e.category} autoCapitalize='words' placeholder='Groceries' onChange={(v) => up({ category: v })} />
        <MoneyF label='Amount' value={e.amount} onChange={(v) => up({ amount: v })} />
        <DateF label='Date' value={e.date} onChange={(v) => up({ date: v })} />
        <TF label='Notes' wide value={e.notes} autoCapitalize='sentences' placeholder='Optional' hint={next} onChange={(v) => up({ notes: v })} />
      </div>
    );
    case 'payment': return (
      <div className='grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2'>
        <TF label='Title' wide value={e.title} autoCapitalize='sentences' placeholder='Electricity Bill' onChange={(v) => up({ title: v })} />
        <MoneyF label='Amount' value={e.amount} onChange={(v) => up({ amount: v })} />
        <SF label='Type' wide value={e.paymentType} onChange={(v) => up({ paymentType: v })}
          options={[
            { value:'bill',label:'Bill' }, { value:'subscription',label:'Subscription' },
            { value:'emi', label:'EMI'  }, { value:'rent',label:'Rent' },
            { value:'other',label:'Other' },
          ]} />
        <DateF label='Due Date' value={e.dueDate} hint={next} onChange={(v) => up({ dueDate: v })} />
      </div>
    );
    case 'goal': return (
      <div className='grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2'>
        <TF label='Goal Name' wide value={e.goalName} autoCapitalize='sentences' placeholder='Emergency Fund' onChange={(v) => up({ goalName: v })} />
        <MoneyF label='Target Amount' value={e.targetAmount} placeholder='300000' onChange={(v) => up({ targetAmount: v })} />
        <DateF label='Target Date' value={e.dueDate} hint={next} onChange={(v) => up({ dueDate: v })} />
      </div>
    );
    case 'liability': return (
      <div className='grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2'>
        <TF label='Loan Name' wide value={e.liabilityName} autoCapitalize='sentences' placeholder='Home Loan' onChange={(v) => up({ liabilityName: v })} />
        <MoneyF label='Principal' value={e.principal} placeholder='5000000' onChange={(v) => up({ principal: v })} />
        <RateF label='Interest %' value={e.interestRate} placeholder='8.5' onChange={(v) => up({ interestRate: v })} />
        <MoneyF label='EMI' value={e.emiAmount} placeholder='45000' hint={next} onChange={(v) => up({ emiAmount: v })} />
      </div>
    );
    case 'insurance': return (
      <div className='grid grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-2'>
        <TF label='Policy Name' wide value={e.policyName} autoCapitalize='sentences' placeholder='Term Plan' onChange={(v) => up({ policyName: v })} />
        <TF label='Provider' value={e.provider} autoCapitalize='words' placeholder='LIC' onChange={(v) => up({ provider: v })} />
        <SF label='Type' wide value={e.insuranceType} onChange={(v) => up({ insuranceType: v })}
          options={[
            { value:'life',label:'Life' }, { value:'health',label:'Health' },
            { value:'vehicle',label:'Vehicle' }, { value:'property',label:'Property' },
            { value:'term',label:'Term' }, { value:'other',label:'Other' },
          ]} />
        <MoneyF label='Premium' value={e.premiumAmount} placeholder='12000' onChange={(v) => up({ premiumAmount: v })} />
        <MoneyF label='Coverage' value={e.coverageAmount} placeholder='1000000' onChange={(v) => up({ coverageAmount: v })} />
        <DateF label='Renewal Date' value={e.renewalDate} hint={next} onChange={(v) => up({ renewalDate: v })} />
      </div>
    );
    case 'investment_fd': return (
      <div className='grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2'>
        <TF label='FD Name' wide value={e.investmentName} autoCapitalize='words' placeholder='SBI FD 12M' onChange={(v) => up({ investmentName: v })} />
        <MoneyF label='Amount' value={e.investedAmount} placeholder='100000' onChange={(v) => up({ investedAmount: v })} />
        <RateF label='Rate %' value={e.investmentRate} placeholder='7.0' onChange={(v) => up({ investmentRate: v })} />
        <IntF label='Months' value={e.durationMonths} placeholder='12' onChange={(v) => up({ durationMonths: v })} />
        <DateF label='Start Date' value={e.date} hint={next} onChange={(v) => up({ date: v })} />
      </div>
    );
    case 'investment_mf': return (
      <div className='grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2'>
        <TF label='Fund Name' wide value={e.investmentName} autoCapitalize='words' placeholder='Mirae Asset Large Cap' onChange={(v) => up({ investmentName: v })} />
        <MoneyF label='Invested' value={e.investedAmount} placeholder='50000' onChange={(v) => up({ investedAmount: v })} />
        <DateF label='Date' value={e.date} hint={next} onChange={(v) => up({ date: v })} />
      </div>
    );
    case 'sip': return (
      <div className='grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2'>
        <TF label='Fund / Instrument' wide value={e.sipName} autoCapitalize='words' placeholder='Nifty 50 Index Fund' onChange={(v) => up({ sipName: v })} />
        <RateF label='Allocation %' value={e.sipPct} placeholder='25' hint={next} onChange={(v) => up({ sipPct: v })} />
      </div>
    );
    default: return null;
  }
}

// ─── Save single entry ────────────────────────────────────────────────────────

async function saveOne(e: BulkEntry): Promise<void> {
  const s = usePortfolioStore.getState();
  switch (e.feature) {
    case 'expense': case 'income':
      await s.addCashflow({ type: e.feature, date: e.date, category: e.category.trim() || 'Other', amount: num(e.amount), ...(e.notes.trim() ? { notes: e.notes.trim() } : {}) } as any);
      break;
    case 'payment':
      await s.addTrackedPayment({ title: e.title.trim(), amount: num(e.amount), dueDate: e.dueDate, paymentType: e.paymentType as any, recurrence: 'none', reminderDays: [1,3,7] });
      break;
    case 'goal':
      await s.addGoal({ name: e.goalName.trim(), targetAmount: num(e.targetAmount), currentAmount: 0, status: 'active', ...(e.dueDate ? { dueDate: e.dueDate } : {}) });
      break;
    case 'liability':
      await s.addLiability({ type: 'loan', name: e.liabilityName.trim(), principal: num(e.principal), outstanding: num(e.principal), status: 'active', ...(num(e.interestRate) ? { interestRate: num(e.interestRate) } : {}), ...(num(e.emiAmount) ? { emiAmount: num(e.emiAmount) } : {}) });
      break;
    case 'insurance':
      await s.addInsurancePolicy({ type: e.insuranceType as any, policyName: e.policyName.trim(), provider: e.provider.trim() || 'Unknown', premiumAmount: num(e.premiumAmount), premiumFrequency: 'yearly', coverageAmount: num(e.coverageAmount), renewalDate: e.renewalDate });
      break;
    case 'investment_fd':
      await s.addInvestment({ type: 'fixed_deposit', name: e.investmentName.trim(), investedAmount: num(e.investedAmount), interestRate: num(e.investmentRate), durationMonths: num(e.durationMonths) || 12, startDate: e.date } as any);
      break;
    case 'investment_mf':
      await s.addInvestment({ type: 'mutual_fund', name: e.investmentName.trim(), investedAmount: num(e.investedAmount), units: 0, nav: 0 } as any);
      break;
    case 'sip':
      await s.addSipInstrument({ name: e.sipName.trim(), percentage: num(e.sipPct) });
      break;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BulkAddPanel({ onClose }: { onClose: () => void }) {
  const panelRef = useRef<HTMLElement>(null);
  const [feature, setFeature]   = useState<BulkFeature>('expense');
  const [entries, setEntries]   = useState<BulkEntry[]>([blank('expense')]);
  const [saving,  setSaving]    = useState(false);
  const [copied,  setCopied]    = useState(false);
  const [showTips, setShowTips] = useState(false);
  /** Row id → what is still missing; only populated after a failed save. */
  const [errors,  setErrors]    = useState<Record<string, string>>({});

  const meta = FEATURE_META.find((m) => m.key === feature)!;

  /**
   * One-tap category fill. Below a 16px keyboard a phone has roughly two screen-
   * heights of form left, so typing every category is the slow path — the most
   * used ones (from the user's own history) sit in the toolbar strip instead.
   */
  const cashflows = usePortfolioStore((s) => s.cashflows);
  const categorySuggestions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const cf of cashflows) {
      if (cf.type !== feature) continue;
      counts.set(cf.category, (counts.get(cf.category) ?? 0) + 1);
    }
    const mine = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([category]) => category);
    const fallback = feature === 'income'
      ? ['Salary', 'Freelance', 'Interest', 'Rental Income', 'Dividend', 'Other Income']
      : ['Groceries', 'Dining', 'Rent', 'Electricity', 'Transport', 'Healthcare'];
    return [...new Set([...mine, ...fallback])].slice(0, 6);
  }, [cashflows, feature]);
  /** Row the chips / keyboard belong to — the one currently being edited. */
  const [activeRow, setActiveRow] = useState<string | null>(null);
  const showsCategories = feature === 'expense' || feature === 'income';
  /** Row the toolbar chips write to — the focused one, otherwise the last row. */
  const catTargetId = activeRow ?? entries[entries.length - 1]?.id ?? '';
  const catTarget   = entries.find((e) => e.id === catTargetId);

  const switchFeature = (f: BulkFeature) => {
    setFeature(f);
    setEntries([blank(f)]);
    setErrors({});
  };

  const loadTemplate = () => {
    const tmpl = TEMPLATES[feature];
    setEntries(tmpl.map((t) => ({ ...blank(feature), ...t, id: uid() })));
    setErrors({});
  };

  const copyAsText = async () => {
    const lines = entries.map((e, i) => {
      let line = `${i+1}.`;
      switch (e.feature) {
        case 'expense': case 'income':
          line += ` [${e.feature}] Date: ${e.date} | ₹${e.amount} | ${e.category}${e.notes ? ` | ${e.notes}` : ''}`;
          break;
        case 'payment':
          line += ` [payment] "${e.title}" ₹${e.amount} due ${e.dueDate} | ${e.paymentType}`;
          break;
        case 'goal':
          line += ` [goal] "${e.goalName}" target ₹${e.targetAmount} by ${e.dueDate}`;
          break;
        case 'liability':
          line += ` [loan] "${e.liabilityName}" ₹${e.principal} @ ${e.interestRate}% EMI ₹${e.emiAmount}`;
          break;
        case 'insurance':
          line += ` [insurance/${e.insuranceType}] "${e.policyName}" by ${e.provider} premium ₹${e.premiumAmount} cover ₹${e.coverageAmount}`;
          break;
        case 'investment_fd':
          line += ` [FD] "${e.investmentName}" ₹${e.investedAmount} @ ${e.investmentRate}% for ${e.durationMonths}mo`;
          break;
        case 'investment_mf':
          line += ` [MF] "${e.investmentName}" invested ₹${e.investedAmount}`;
          break;
        case 'sip':
          line += ` [SIP] "${e.sipName}" ${e.sipPct}%`;
          break;
      }
      return line;
    });
    await navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const addRow = () => {
    setEntries((p) => [...p, blank(feature)]);
    setErrors({});
  };
  const removeRow = (id: string) => {
    setEntries((p) => p.filter((e) => e.id !== id));
    setErrors((p) => { const n = { ...p }; delete n[id]; return n; });
  };
  const update = (id: string, patch: Partial<BulkEntry>) => {
    setEntries((p) => p.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    // Clear the row's error as soon as the user starts fixing it.
    setErrors((p) => { if (!p[id]) return p; const n = { ...p }; delete n[id]; return n; });
  };

  const sipTotal = feature === 'sip'
    ? entries.reduce((s, e) => s + num(e.sipPct), 0) : null;

  const handleSaveAll = async () => {
    if (!entries.length || saving) return;

    const found: Record<string, string> = {};
    entries.forEach((e) => {
      const err = rowError(e);
      if (err) found[e.id] = err;
    });
    if (Object.keys(found).length) {
      setErrors(found);
      const firstBad = entries.findIndex((e) => found[e.id]) + 1;
      toast.error(`Row ${firstBad}: ${found[entries[firstBad - 1].id]}`);
      return;
    }
    setErrors({});

    setSaving(true);
    let ok = 0, fail = 0;
    for (const e of entries) {
      try { await saveOne(e); ok++; }
      catch { fail++; }
    }
    setSaving(false);
    // The save is done — take the keyboard out of the way so the confirmation
    // and the rest of the panel are immediately visible.
    dismissKeyboard();
    if (fail === 0) {
      toast.success(`✅ ${ok} ${meta.label} record${ok !== 1 ? 's' : ''} saved!`);
      onClose();
    } else {
      toast.error(`${ok} saved, ${fail} failed — check the fields.`);
    }
  };

  // Enter/Next walks every field of every row; Enter on the last one saves.
  const handleFieldKeyDown = useKeyboardFieldNavigation(panelRef, handleSaveAll);

  return (
    <section
      ref={panelRef}
      onKeyDown={handleFieldKeyDown}
      onFocusCapture={(ev) => {
        // Remember which row owns focus so the toolbar chips (and the highlight)
        // follow the row the user is actually typing in.
        const row = (ev.target as HTMLElement).closest?.('[data-row-id]');
        if (row) setActiveRow(row.getAttribute('data-row-id'));
      }}
      className='flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl'
    >

      {/* ── Header ── dropped on phones: every pixel there belongs to the form, and
          the close action moves into the toolbar strip below. */}
      <div className='hidden shrink-0 items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-violet-500/10 to-transparent px-4 py-3 sm:flex'>
        <div className='flex min-w-0 items-center gap-1.5 sm:gap-2'>
          <FiLayers className='h-3.5 w-3.5 shrink-0 text-violet-500 sm:h-4 sm:w-4' />
          <span className='truncate text-[13px] sm:text-sm font-bold text-slate-900 dark:text-slate-100'>Bulk Add</span>
          <span className='shrink-0 rounded-full border border-violet-200 dark:border-violet-700/50 bg-violet-100 dark:bg-violet-900/30 px-1.5 py-0.5 text-[9px] font-bold text-violet-700 dark:text-violet-300 sm:px-2 sm:text-[10px]'>
            {entries.length} {entries.length === 1 ? 'row' : 'rows'}
          </span>
        </div>
        <div className='flex shrink-0 items-center gap-1'>
          <button
            type='button'
            onClick={() => setShowTips((v) => !v)}
            className='flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors'
          >
            <span className='hidden sm:inline'>How to use</span>
            <FiChevronDown className={`h-3 w-3 transition-transform ${showTips ? 'rotate-180' : ''}`} />
          </button>
          <button
            type='button' onClick={onClose} aria-label='Close bulk add'
            className='flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-rose-500 transition-colors'
          >
            <FiX className='h-4 w-4' />
          </button>
        </div>
      </div>

      {/* ── Tips ── */}
      {showTips && (
        <div className='shrink-0 border-b border-amber-200/60 dark:border-amber-700/30 bg-amber-50 dark:bg-amber-900/10 px-3 py-2 sm:px-4 sm:py-3'>
          <p className='text-[10px] text-amber-800 dark:text-amber-300 leading-relaxed sm:text-[11px]'>
            <strong>How to use:</strong> Pick a type → <em>Load template</em> for sample rows → edit amounts &amp; dates, pressing <em>Next</em> on the keyboard to jump fields → <em>Save</em> on the last field.
          </p>
        </div>
      )}

      {/* ── Type tabs ── */}
      <div className='flex shrink-0 gap-1 overflow-x-auto px-2 pb-1 pt-1 scrollbar-none sm:px-3 sm:pb-1.5 sm:pt-3'>
        {FEATURE_META.map((m) => (
          <button
            key={m.key} type='button'
            onClick={() => switchFeature(m.key)}
            className={`flex h-6 shrink-0 items-center gap-1 rounded-lg border px-1.5 text-[9px] font-bold transition-all sm:h-8 sm:gap-1.5 sm:rounded-xl sm:px-3 sm:text-[11px]
              ${feature === m.key
                ? `${m.activeClass} border-transparent shadow-md`
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 hover:border-violet-300 dark:hover:border-violet-600 hover:text-violet-600 dark:hover:text-violet-300'
              }`}
          >
            <span className={feature === m.key ? '' : m.color}>{m.icon}</span>
            {m.label}
          </button>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div className='flex shrink-0 items-center gap-1 overflow-x-auto border-b border-slate-100 dark:border-slate-800 px-2 py-1 scrollbar-none sm:flex-wrap sm:gap-1.5 sm:px-4 sm:py-2'>
        {/* Phone-only close — the panel header is hidden on this breakpoint. */}
        <button
          type='button' onClick={onClose} aria-label='Close bulk add'
          className='flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-rose-500 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors sm:hidden'
        >
          <FiX className='h-3.5 w-3.5' />
        </button>
        <span className='h-4 w-px shrink-0 bg-slate-200 dark:bg-slate-700 sm:hidden' aria-hidden />
        <button
          type='button' onClick={loadTemplate}
          className='flex h-6 shrink-0 items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-1.5 text-[10px] font-semibold text-slate-700 dark:text-slate-300 hover:border-violet-400 hover:text-violet-600 dark:hover:border-violet-500 dark:hover:text-violet-300 transition-colors sm:h-8 sm:gap-1.5 sm:rounded-lg sm:px-2.5 sm:text-[11px]'
        >
          ✨ <span className='hidden sm:inline'>Load example</span><span className='sm:hidden'>Template</span>
        </button>
        <button
          type='button' onClick={copyAsText}
          className='flex h-6 shrink-0 items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-1.5 text-[10px] font-semibold text-slate-700 dark:text-slate-300 hover:border-emerald-400 hover:text-emerald-600 dark:hover:border-emerald-500 dark:hover:text-emerald-300 transition-colors sm:h-8 sm:gap-1.5 sm:rounded-lg sm:px-2.5 sm:text-[11px]'
        >
          {copied
            ? <><FiCheck className='h-3.5 w-3.5 text-emerald-500' />Copied!</>
            : <><FiCopy  className='h-3.5 w-3.5' />Copy</>}
        </button>

        {showsCategories && <span className='h-5 w-px shrink-0 bg-slate-200 dark:bg-slate-700' />}
        {showsCategories && categorySuggestions.map((c) => (
          <button
            key={c} type='button'
            title={`Use “${c}” for the highlighted row`}
            /* Keep the field focused — the keyboard must not close between taps. */
            onPointerDown={(ev) => ev.preventDefault()}
            onClick={() => update(catTargetId, { category: c })}
            className={`h-6 shrink-0 rounded-full border px-2 text-[10px] font-semibold transition-colors active:scale-95 sm:h-7 sm:px-2.5 sm:text-[11px] ${
              catTarget?.category === c
                ? 'border-violet-400 bg-violet-100 text-violet-700 dark:border-violet-600 dark:bg-violet-900/40 dark:text-violet-200'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 hover:border-violet-300 hover:text-violet-600 dark:hover:border-violet-600 dark:hover:text-violet-300'
            }`}
          >
            {c}
          </button>
        ))}

        {sipTotal !== null && (
          <span className={`ml-auto shrink-0 text-[10px] font-bold sm:text-[11px] ${sipTotal === 100 ? 'text-emerald-500' : sipTotal > 100 ? 'text-rose-500' : 'text-amber-500'}`}>
            {sipTotal}%{sipTotal < 100 ? ` (${100 - sipTotal}% left)` : sipTotal > 100 ? ' ⚠ over' : ' ✓'}
          </span>
        )}
      </div>

      {/* ── Rows ── */}
      <div className='min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain px-2 py-2 sm:space-y-2 sm:px-3'>
        {entries.length === 0 && (
          <div className='flex flex-col items-center justify-center gap-2 py-8 text-slate-400 dark:text-slate-500 sm:py-10'>
            <FiPlus className='h-6 w-6 sm:h-8 sm:w-8' />
            <p className='text-[11px] font-semibold sm:text-xs'>No rows yet — add one or load a template</p>
          </div>
        )}
        {entries.map((e, idx) => {
          const err = errors[e.id];
          return (
            <div
              key={e.id}
              data-row-id={e.id}
              className={`overflow-hidden rounded-lg border bg-slate-50/60 dark:bg-slate-800/30 sm:rounded-xl ${
                err ? 'border-rose-300 dark:border-rose-700 ring-1 ring-rose-200 dark:ring-rose-800/50'
                  : e.id === catTargetId ? 'border-violet-300 dark:border-violet-700'
                  : 'border-slate-200 dark:border-slate-700'
              }`}
            >
              {/* Row header */}
              <div className='flex items-center justify-between gap-2 border-b border-slate-200/60 dark:border-slate-700/60 bg-slate-100/70 dark:bg-slate-800/60 px-2 py-0.5 sm:px-2.5 sm:py-1'>
                <span className={`truncate text-[9px] font-black uppercase tracking-wider sm:text-[10px] ${meta.color}`}>
                  Row {idx + 1} — {meta.label}
                </span>
                <button
                  type='button' onClick={() => removeRow(e.id)} aria-label='Remove row'
                  className='flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors sm:h-7 sm:w-7'
                >
                  <FiTrash2 className='h-3 w-3 sm:h-3.5 sm:w-3.5' />
                </button>
              </div>
              {/* Fields — the last field of the last row closes the Enter walk */}
              <div className='px-2 py-1.5 sm:px-3 sm:py-2.5'>
                <RowFields e={e} up={(p) => update(e.id, p)} done={idx === entries.length - 1} />
                {err && (
                  <p className='mt-1 text-[9px] font-semibold text-rose-600 dark:text-rose-400'>{err}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Footer (always above the keyboard — the shell is viewport-pinned) ── */}
      <div className='flex shrink-0 items-center gap-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/40 px-2 py-1.5 sm:px-4 sm:py-3'>
        <button
          type='button' onClick={addRow}
          className='flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800/50 px-2.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300 hover:border-violet-400 hover:text-violet-600 dark:hover:border-violet-500 dark:hover:text-violet-300 transition-colors active:scale-95 sm:h-11 sm:rounded-xl sm:px-3 sm:text-[11px]'
        >
          <FiPlus className='h-3.5 w-3.5 sm:h-4 sm:w-4' /> Row
        </button>

        <div className='ml-auto flex min-w-0 items-center gap-2'>
          <span className='hidden shrink-0 text-[10px] text-slate-400 dark:text-slate-500 sm:block'>
            {entries.length} to save
          </span>
          <button
            type='button' onClick={() => void handleSaveAll()}
            disabled={saving || entries.length === 0}
            className='flex h-9 w-full min-w-[110px] items-center justify-center gap-1.5 rounded-lg bg-violet-600 px-3 text-[12px] font-bold text-white shadow-md shadow-violet-500/25 transition-all hover:bg-violet-500 disabled:opacity-40 active:scale-95 sm:h-11 sm:w-auto sm:gap-2 sm:rounded-xl sm:px-4 sm:text-xs'
          >
            {saving
              ? <span className='h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin' />
              : <FiCheck className='h-4 w-4' />}
            {saving ? 'Saving…' : `Save All (${entries.length})`}
          </button>
        </div>
      </div>
    </section>
  );
}
