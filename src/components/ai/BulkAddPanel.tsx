// src/components/ai/BulkAddPanel.tsx
// AI Coach — Bulk Add Panel
// Add multiple records at once across cashflow, payments, goals,
// liabilities, insurance, investments, and SIP instruments.
// Template button pre-fills example rows with today's date for easy copy-paste.

import { useState } from 'react';
import {
  FiActivity, FiBell, FiCheck, FiChevronDown,
  FiCopy, FiFlag, FiLayers, FiPlus,
  FiShield, FiTrash2, FiTrendingDown, FiTrendingUp, FiX,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { usePortfolioStore } from '../../store/portfolioStore';

// ─── Feature types ────────────────────────────────────────────────────────────

type BulkFeature =
  | 'expense' | 'income' | 'payment' | 'goal'
  | 'liability' | 'insurance' | 'investment_fd'
  | 'investment_mf' | 'sip';

interface BulkEntry {
  id: string;
  feature: BulkFeature;
  // cashflow
  date: string; amount: number; category: string; notes: string;
  // payment
  title: string; dueDate: string; paymentType: string;
  // goal
  goalName: string; targetAmount: number;
  // liability
  liabilityName: string; principal: number; interestRate: number; emiAmount: number;
  // insurance
  policyName: string; provider: string; coverageAmount: number;
  renewalDate: string; insuranceType: string; premiumAmount: number;
  // investment
  investmentName: string; investedAmount: number;
  investmentRate: number; durationMonths: number;
  // sip
  sipName: string; sipPct: number;
}

const TODAY  = new Date().toISOString().slice(0, 10);
const IN30D  = new Date(Date.now() + 30  * 86400000).toISOString().slice(0, 10);
const IN365D = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);

let _seq = 0;
function uid() { return `bulk-${Date.now()}-${++_seq}`; }

function blank(feature: BulkFeature): BulkEntry {
  return {
    id: uid(), feature,
    date: TODAY, amount: 0, category: feature === 'income' ? 'Salary' : 'Food', notes: '',
    title: '', dueDate: IN30D, paymentType: 'bill',
    goalName: '', targetAmount: 0,
    liabilityName: '', principal: 0, interestRate: 0, emiAmount: 0,
    policyName: '', provider: '', coverageAmount: 0,
    renewalDate: IN365D, insuranceType: 'health', premiumAmount: 0,
    investmentName: '', investedAmount: 0, investmentRate: 0, durationMonths: 12,
    sipName: '', sipPct: 0,
  };
}

// ─── Example templates ────────────────────────────────────────────────────────

const TEMPLATES: Record<BulkFeature, Partial<BulkEntry>[]> = {
  expense: [
    { category: 'Groceries',   amount: 3500, notes: 'Weekly groceries' },
    { category: 'Dining',      amount: 1200, notes: 'Lunch out' },
    { category: 'Electricity', amount: 1800, notes: 'Monthly bill' },
    { category: 'Transport',   amount: 800,  notes: 'Fuel' },
    { category: 'OTT',         amount: 649,  notes: 'Netflix' },
  ],
  income: [
    { category: 'Salary',    amount: 85000, notes: 'Monthly salary' },
    { category: 'Freelance', amount: 15000, notes: 'Client project' },
    { category: 'Interest',  amount: 2400,  notes: 'FD interest' },
  ],
  payment: [
    { title: 'Electricity Bill', amount: 1800, paymentType: 'bill'         },
    { title: 'Internet',         amount: 999,  paymentType: 'bill'         },
    { title: 'Gym Membership',   amount: 1500, paymentType: 'subscription' },
    { title: 'Car EMI',          amount: 12000,paymentType: 'emi'          },
  ],
  goal: [
    { goalName: 'Emergency Fund', targetAmount: 300000 },
    { goalName: 'Vacation Fund',  targetAmount: 100000 },
    { goalName: 'New Laptop',     targetAmount: 80000  },
  ],
  liability: [
    { liabilityName: 'Home Loan',     principal: 5000000, interestRate: 8.5, emiAmount: 45000 },
    { liabilityName: 'Car Loan',      principal: 800000,  interestRate: 9.2, emiAmount: 16000 },
    { liabilityName: 'Personal Loan', principal: 200000,  interestRate: 14,  emiAmount: 8000  },
  ],
  insurance: [
    { policyName: 'Term Plan',    provider: 'LIC',        coverageAmount: 10000000, premiumAmount: 12000, insuranceType: 'life'    },
    { policyName: 'Health Cover', provider: 'Star Health', coverageAmount: 500000,  premiumAmount: 8500,  insuranceType: 'health'  },
    { policyName: 'Car Insurance',provider: 'HDFC Ergo',  coverageAmount: 800000,  premiumAmount: 6200,  insuranceType: 'vehicle' },
  ],
  investment_fd: [
    { investmentName: 'SBI FD 12M',  investedAmount: 100000, investmentRate: 7.1, durationMonths: 12 },
    { investmentName: 'HDFC FD 6M',  investedAmount: 50000,  investmentRate: 6.8, durationMonths: 6  },
    { investmentName: 'PNB FD 18M',  investedAmount: 75000,  investmentRate: 7.3, durationMonths: 18 },
  ],
  investment_mf: [
    { investmentName: 'Mirae Asset Large Cap',  investedAmount: 50000 },
    { investmentName: 'Parag Parikh Flexi Cap', investedAmount: 30000 },
    { investmentName: 'Axis Midcap Fund',       investedAmount: 20000 },
  ],
  sip: [
    { sipName: 'Nifty 50 Index Fund',      sipPct: 40 },
    { sipName: 'Midcap 150 Index Fund',    sipPct: 30 },
    { sipName: 'International ETF',        sipPct: 20 },
    { sipName: 'Gold ETF',                 sipPct: 10 },
  ],
};

const FEATURE_META: {
  key: BulkFeature; label: string; color: string;
  icon: React.ReactNode; activeClass: string;
}[] = [
  { key: 'expense',       label: 'Expense',     color: 'text-rose-500',    activeClass: 'bg-rose-600 text-white',    icon: <FiActivity   className='h-3.5 w-3.5'/> },
  { key: 'income',        label: 'Income',      color: 'text-emerald-500', activeClass: 'bg-emerald-600 text-white', icon: <FiActivity   className='h-3.5 w-3.5'/> },
  { key: 'payment',       label: 'Payment',     color: 'text-sky-500',     activeClass: 'bg-sky-600 text-white',     icon: <FiBell       className='h-3.5 w-3.5'/> },
  { key: 'goal',          label: 'Goal',        color: 'text-amber-500',   activeClass: 'bg-amber-600 text-white',   icon: <FiFlag       className='h-3.5 w-3.5'/> },
  { key: 'liability',     label: 'Liability',   color: 'text-orange-500',  activeClass: 'bg-orange-600 text-white',  icon: <FiTrendingDown className='h-3.5 w-3.5'/> },
  { key: 'insurance',     label: 'Insurance',   color: 'text-blue-500',    activeClass: 'bg-blue-600 text-white',    icon: <FiShield     className='h-3.5 w-3.5'/> },
  { key: 'investment_fd', label: 'Fixed Dep.',  color: 'text-indigo-500',  activeClass: 'bg-indigo-600 text-white',  icon: <FiTrendingUp className='h-3.5 w-3.5'/> },
  { key: 'investment_mf', label: 'Mutual Fund', color: 'text-violet-500',  activeClass: 'bg-violet-600 text-white',  icon: <FiTrendingUp className='h-3.5 w-3.5'/> },
  { key: 'sip',           label: 'SIP',         color: 'text-teal-500',    activeClass: 'bg-teal-600 text-white',    icon: <FiLayers     className='h-3.5 w-3.5'/> },
];

// ─── Field primitives ─────────────────────────────────────────────────────────

const inputCls =
  'rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 ' +
  'px-2.5 py-1.5 text-[12px] text-slate-900 dark:text-slate-100 w-full ' +
  'placeholder:text-slate-400 dark:placeholder:text-slate-600 ' +
  'focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-400 ' +
  'transition-colors';

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className='flex flex-col gap-0.5 min-w-0'>
      <span className='text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'>{label}</span>
      {children}
    </div>
  );
}

function TF({
  label, type = 'text', value, onChange, placeholder,
}: {
  label: string; type?: string;
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <F label={label}>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} className={inputCls} />
    </F>
  );
}

function SF({
  label, value, onChange, options,
}: {
  label: string; value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <F label={label}>
      <select value={value} onChange={e => onChange(e.target.value)} className={inputCls}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </F>
  );
}

// ─── Per-feature row fields ───────────────────────────────────────────────────

function RowFields({ e, up }: { e: BulkEntry; up: (p: Partial<BulkEntry>) => void }) {
  const g4 = 'grid grid-cols-2 sm:grid-cols-4 gap-2';
  const g3 = 'grid grid-cols-2 sm:grid-cols-3 gap-2';
  const g2 = 'grid grid-cols-2 gap-2';

  switch (e.feature) {
    case 'expense': case 'income': return (
      <div className={g4}>
        <TF label='Date'      type='date'   value={e.date}     onChange={v => up({ date: v })} />
        <TF label='Amount ₹'  type='number' value={e.amount||''} onChange={v => up({ amount: +v })} placeholder='0' />
        <TF label='Category'  value={e.category}  onChange={v => up({ category: v })} placeholder='Groceries' />
        <TF label='Notes'     value={e.notes}     onChange={v => up({ notes: v })}    placeholder='Optional' />
      </div>
    );
    case 'payment': return (
      <div className={g4}>
        <TF label='Title'     value={e.title}    onChange={v => up({ title: v })}  placeholder='Electricity' />
        <TF label='Amount ₹'  type='number' value={e.amount||''} onChange={v => up({ amount: +v })} placeholder='0' />
        <TF label='Due Date'  type='date'   value={e.dueDate}    onChange={v => up({ dueDate: v })} />
        <SF label='Type' value={e.paymentType} onChange={v => up({ paymentType: v })}
          options={[
            { value:'bill',label:'Bill' }, { value:'subscription',label:'Subscription' },
            { value:'emi', label:'EMI'  }, { value:'rent',label:'Rent' },
            { value:'other',label:'Other' },
          ]} />
      </div>
    );
    case 'goal': return (
      <div className={g3}>
        <TF label='Goal Name'     value={e.goalName}      onChange={v => up({ goalName: v })}      placeholder='Emergency Fund' />
        <TF label='Target Amt ₹'  type='number' value={e.targetAmount||''} onChange={v => up({ targetAmount: +v })} placeholder='300000' />
        <TF label='Target Date'   type='date'   value={e.dueDate}          onChange={v => up({ dueDate: v })} />
      </div>
    );
    case 'liability': return (
      <div className={g4}>
        <TF label='Loan Name'   value={e.liabilityName}  onChange={v => up({ liabilityName: v })} placeholder='Home Loan' />
        <TF label='Principal ₹' type='number' value={e.principal||''}    onChange={v => up({ principal: +v })}    placeholder='500000' />
        <TF label='Interest %'  type='number' value={e.interestRate||''} onChange={v => up({ interestRate: +v })} placeholder='8.5' />
        <TF label='EMI ₹'       type='number' value={e.emiAmount||''}    onChange={v => up({ emiAmount: +v })}    placeholder='15000' />
      </div>
    );
    case 'insurance': return (
      <div className='grid grid-cols-2 sm:grid-cols-3 gap-2'>
        <TF label='Policy Name'   value={e.policyName}      onChange={v => up({ policyName: v })}      placeholder='Term Plan' />
        <TF label='Provider'      value={e.provider}         onChange={v => up({ provider: v })}         placeholder='LIC' />
        <TF label='Premium ₹'    type='number' value={e.premiumAmount||''}  onChange={v => up({ premiumAmount: +v })}  placeholder='12000' />
        <TF label='Coverage ₹'   type='number' value={e.coverageAmount||''} onChange={v => up({ coverageAmount: +v })} placeholder='1000000' />
        <TF label='Renewal Date' type='date'   value={e.renewalDate}        onChange={v => up({ renewalDate: v })} />
        <SF label='Type' value={e.insuranceType} onChange={v => up({ insuranceType: v })}
          options={[
            { value:'life',label:'Life' }, { value:'health',label:'Health' },
            { value:'vehicle',label:'Vehicle' }, { value:'property',label:'Property' },
            { value:'term',label:'Term' }, { value:'other',label:'Other' },
          ]} />
      </div>
    );
    case 'investment_fd': return (
      <div className={g4}>
        <TF label='FD Name'      value={e.investmentName}   onChange={v => up({ investmentName: v })}   placeholder='SBI FD 12M' />
        <TF label='Amount ₹'     type='number' value={e.investedAmount||''}  onChange={v => up({ investedAmount: +v })}  placeholder='100000' />
        <TF label='Rate %'       type='number' value={e.investmentRate||''}  onChange={v => up({ investmentRate: +v })}  placeholder='7.0' />
        <TF label='Duration (mo)'type='number' value={e.durationMonths||''} onChange={v => up({ durationMonths: +v })} placeholder='12' />
        <TF label='Start Date'   type='date'   value={e.date}               onChange={v => up({ date: v })} />
      </div>
    );
    case 'investment_mf': return (
      <div className={g3}>
        <TF label='Fund Name'    value={e.investmentName}  onChange={v => up({ investmentName: v })}  placeholder='Mirae Asset Large Cap' />
        <TF label='Invested ₹'  type='number' value={e.investedAmount||''} onChange={v => up({ investedAmount: +v })} placeholder='50000' />
        <TF label='Date'         type='date'  value={e.date}                onChange={v => up({ date: v })} />
      </div>
    );
    case 'sip': return (
      <div className={g2}>
        <TF label='Fund / Instrument'  value={e.sipName} onChange={v => up({ sipName: v })} placeholder='Nifty 50 Index Fund' />
        <TF label='Allocation %' type='number' value={e.sipPct||''} onChange={v => up({ sipPct: +v })} placeholder='25' />
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
      await s.addCashflow({ type: e.feature, date: e.date, category: e.category || 'Other', amount: e.amount, ...(e.notes ? { notes: e.notes } : {}) } as any);
      break;
    case 'payment':
      await s.addTrackedPayment({ title: e.title, amount: e.amount, dueDate: e.dueDate, paymentType: e.paymentType as any, recurrence: 'none', reminderDays: [1,3,7] });
      break;
    case 'goal':
      await s.addGoal({ name: e.goalName, targetAmount: e.targetAmount, currentAmount: 0, status: 'active', ...(e.dueDate ? { dueDate: e.dueDate } : {}) });
      break;
    case 'liability':
      await s.addLiability({ type: 'loan', name: e.liabilityName, principal: e.principal, outstanding: e.principal, status: 'active', ...(e.interestRate ? { interestRate: e.interestRate } : {}), ...(e.emiAmount ? { emiAmount: e.emiAmount } : {}) });
      break;
    case 'insurance':
      await s.addInsurancePolicy({ type: e.insuranceType as any, policyName: e.policyName, provider: e.provider, premiumAmount: e.premiumAmount, premiumFrequency: 'yearly', coverageAmount: e.coverageAmount, renewalDate: e.renewalDate });
      break;
    case 'investment_fd':
      await s.addInvestment({ type: 'fixed_deposit', name: e.investmentName, investedAmount: e.investedAmount, interestRate: e.investmentRate, durationMonths: e.durationMonths, startDate: e.date } as any);
      break;
    case 'investment_mf':
      await s.addInvestment({ type: 'mutual_fund', name: e.investmentName, investedAmount: e.investedAmount, units: 0, nav: 0 } as any);
      break;
    case 'sip':
      await s.addSipInstrument({ name: e.sipName, percentage: e.sipPct });
      break;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BulkAddPanel({ onClose }: { onClose: () => void }) {
  const [feature, setFeature]   = useState<BulkFeature>('expense');
  const [entries, setEntries]   = useState<BulkEntry[]>([blank('expense')]);
  const [saving,  setSaving]    = useState(false);
  const [copied,  setCopied]    = useState(false);
  const [showTips, setShowTips] = useState(false);

  const meta = FEATURE_META.find(m => m.key === feature)!;

  const switchFeature = (f: BulkFeature) => {
    setFeature(f);
    setEntries([blank(f)]);
  };

  const loadTemplate = () => {
    const tmpl = TEMPLATES[feature];
    setEntries(tmpl.map(t => ({ ...blank(feature), ...t, id: uid() })));
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

  const addRow    = () => setEntries(p => [...p, blank(feature)]);
  const removeRow = (id: string) => setEntries(p => p.filter(e => e.id !== id));
  const update    = (id: string, patch: Partial<BulkEntry>) =>
    setEntries(p => p.map(e => e.id === id ? { ...e, ...patch } : e));

  const sipTotal = feature === 'sip'
    ? entries.reduce((s, e) => s + (e.sipPct || 0), 0) : null;

  const handleSaveAll = async () => {
    if (!entries.length || saving) return;
    setSaving(true);
    let ok = 0, fail = 0;
    for (const e of entries) {
      try   { await saveOne(e); ok++; }
      catch  { fail++; }
    }
    setSaving(false);
    if (fail === 0) {
      toast.success(`✅ ${ok} ${meta.label} record${ok !== 1 ? 's' : ''} saved!`);
      onClose();
    } else {
      toast.error(`${ok} saved, ${fail} failed — check the fields.`);
    }
  };

  return (
    <div className='flex flex-col gap-0 h-full min-h-0 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden shadow-xl'>

      {/* ── Header ── */}
      <div className='flex items-center justify-between gap-2 px-4 py-3 bg-gradient-to-r from-violet-500/10 to-transparent border-b border-slate-100 dark:border-slate-800 shrink-0'>
        <div className='flex items-center gap-2'>
          <FiLayers className='h-4 w-4 text-violet-500' />
          <span className='text-sm font-bold text-slate-900 dark:text-slate-100'>Bulk Add</span>
          <span className='rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 px-2 py-0.5 text-[10px] font-bold border border-violet-200 dark:border-violet-700/50'>
            {entries.length} {entries.length === 1 ? 'row' : 'rows'}
          </span>
        </div>
        <div className='flex items-center gap-1'>
          <button
            type='button'
            onClick={() => setShowTips(v => !v)}
            className='flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors'
          >
            How to use <FiChevronDown className={`h-3 w-3 transition-transform ${showTips ? 'rotate-180' : ''}`} />
          </button>
          <button
            type='button' onClick={onClose}
            className='flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-rose-500 transition-colors'
          >
            <FiX className='h-4 w-4' />
          </button>
        </div>
      </div>

      {/* ── Tips ── */}
      {showTips && (
        <div className='px-4 py-3 bg-amber-50 dark:bg-amber-900/10 border-b border-amber-200/60 dark:border-amber-700/30 shrink-0'>
          <p className='text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed'>
            <strong>How to use:</strong> Pick a feature tab → click <em>"Load example template"</em> to see sample rows with today's date → edit amounts and dates → add more rows with "+" → tap <em>Save All</em>.<br />
            <strong>Copy as text</strong> gives you a copy-paste summary of your rows.
          </p>
        </div>
      )}

      {/* ── Feature tabs ── */}
      <div className='flex gap-1 overflow-x-auto px-3 pt-3 pb-2 shrink-0 scrollbar-none'>
        {FEATURE_META.map(m => (
          <button
            key={m.key} type='button'
            onClick={() => switchFeature(m.key)}
            className={`flex items-center gap-1.5 shrink-0 rounded-xl px-3 py-1.5 text-[11px] font-bold border transition-all
              ${feature === m.key
                ? `${m.activeClass} border-transparent shadow-md`
                : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-violet-300 dark:hover:border-violet-600 hover:text-violet-600 dark:hover:text-violet-300 bg-white dark:bg-slate-800/50'
              }`}
          >
            <span className={feature === m.key ? '' : m.color}>{m.icon}</span>
            {m.label}
          </button>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div className='flex items-center gap-2 flex-wrap px-4 py-2 border-b border-slate-100 dark:border-slate-800 shrink-0'>
        <button
          type='button' onClick={loadTemplate}
          className='flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:border-violet-400 hover:text-violet-600 dark:hover:border-violet-500 dark:hover:text-violet-300 transition-colors'
        >
          ✨ Load example template
        </button>
        <button
          type='button' onClick={copyAsText}
          className='flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:border-emerald-400 hover:text-emerald-600 dark:hover:border-emerald-500 dark:hover:text-emerald-300 transition-colors'
        >
          {copied
            ? <><FiCheck className='h-3.5 w-3.5 text-emerald-500' />Copied!</>
            : <><FiCopy  className='h-3.5 w-3.5' />Copy as text</>}
        </button>

        {sipTotal !== null && (
          <span className={`ml-auto text-[11px] font-bold ${sipTotal === 100 ? 'text-emerald-500' : sipTotal > 100 ? 'text-rose-500' : 'text-amber-500'}`}>
            {sipTotal}% allocated{sipTotal < 100 ? ` (${100 - sipTotal}% remaining)` : sipTotal > 100 ? ' ⚠ over 100%' : ' ✓'}
          </span>
        )}
      </div>

      {/* ── Rows ── */}
      <div className='flex-1 overflow-y-auto overscroll-contain min-h-0 px-3 py-3 space-y-2'>
        {entries.length === 0 && (
          <div className='flex flex-col items-center justify-center py-10 gap-2 text-slate-400 dark:text-slate-500'>
            <FiPlus className='h-8 w-8' />
            <p className='text-xs font-semibold'>No rows yet — add one or load a template</p>
          </div>
        )}
        {entries.map((e, idx) => (
          <div key={e.id} className='rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/30 overflow-hidden'>
            {/* Row header */}
            <div className='flex items-center justify-between px-3 py-1.5 bg-slate-100/70 dark:bg-slate-800/60 border-b border-slate-200/60 dark:border-slate-700/60'>
              <span className={`text-[10px] font-black uppercase tracking-wider ${meta.color}`}>
                Row {idx + 1} — {meta.label}
              </span>
              <button
                type='button' onClick={() => removeRow(e.id)}
                className='flex h-5 w-5 items-center justify-center rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors'
                aria-label='Remove row'
              >
                <FiTrash2 className='h-3 w-3' />
              </button>
            </div>
            {/* Fields */}
            <div className='px-3 py-2.5'>
              <RowFields e={e} up={p => update(e.id, p)} />
            </div>
          </div>
        ))}
      </div>

      {/* ── Footer ── */}
      <div className='shrink-0 flex items-center gap-2 px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40'>
        <button
          type='button' onClick={addRow}
          className='flex items-center gap-1.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800/50 px-3 py-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:border-violet-400 hover:text-violet-600 dark:hover:border-violet-500 dark:hover:text-violet-300 transition-colors'
        >
          <FiPlus className='h-3.5 w-3.5' /> Add row
        </button>

        <div className='ml-auto flex items-center gap-3'>
          <span className='text-[10px] text-slate-400 dark:text-slate-500 hidden sm:block'>
            {entries.length} record{entries.length !== 1 ? 's' : ''} to save
          </span>
          <button
            type='button' onClick={handleSaveAll}
            disabled={saving || entries.length === 0}
            className='flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 px-4 py-2 text-xs font-bold text-white shadow-md shadow-violet-500/25 transition-all active:scale-95'
          >
            {saving
              ? <span className='h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin' />
              : <FiCheck className='h-3.5 w-3.5' />}
            {saving ? 'Saving…' : `Save All (${entries.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}
