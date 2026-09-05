// src/pages/Insurance/InsurancePage.tsx

import {
  FiAlertTriangle,
  FiCheck,
  FiClock,
  FiEdit2,
  FiPlus,
  FiShield,
  FiTrash2,
} from 'react-icons/fi';
import type {
  InsurancePayment,
  InsurancePolicy,
} from '../../types/investmentTypes';
import {
  addMonths,
  addYears,
  differenceInDays,
  format,
  parseISO,
  subMonths,
  subYears,
} from 'date-fns';
import { useEffect, useMemo, useState } from 'react';

import { Modal } from '../../components/ui/Modal';
import { UpsertInsuranceModal } from '../../components/insurance/UpsertInsuranceModal';
import { buildInsuranceInsights } from '../../utils/advancedInsights';
import { formatCurrency } from '../../utils/format';
import toast from 'react-hot-toast';
import { usePortfolioStore } from '../../store/portfolioStore';
import { FeatureInfo } from '../../components/ui/FeatureInfo';

// ── Constants ──────────────────────────────────────────────────────────────

const TYPE_META: Record<
  string,
  { label: string; color: string; bg: string; icon: string }
> = {
  life: {
    label: 'Life',
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10 border-indigo-500/20',
    icon: '❤️',
  },
  health: {
    label: 'Health',
    color: 'text-rose-400',
    bg: 'bg-rose-500/10 border-rose-500/20',
    icon: '🏥',
  },
  vehicle: {
    label: 'Vehicle',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20',
    icon: '🚗',
  },
  property: {
    label: 'Property',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
    icon: '🏠',
  },
  other: {
    label: 'Other',
    color: 'text-slate-500 dark:text-slate-400',
    bg: 'bg-slate-500/5 dark:bg-slate-500/10 border-slate-400/30 dark:border-slate-500/20',
    icon: '📋',
  },
};

const TABS = ['Overview', 'Policies', 'Payments', 'Reports'] as const;
type TabType = (typeof TABS)[number];

// ── Helpers ────────────────────────────────────────────────────────────────

// Safe date formatter to prevent React crashes if a date is invalid or empty
function safeFormat(
  dateStr: string | null | undefined,
  fmt: string = 'dd MMM yyyy',
): string {
  if (!dateStr) return '—';
  try {
    const d = parseISO(dateStr);
    if (isNaN(d.getTime())) return '—';
    return format(d, fmt);
  } catch {
    return '—';
  }
}

function annualPremium(p: InsurancePolicy) {
  const freq = p.premiumFrequency as string;
  if (freq === 'monthly') return p.premiumAmount * 12;
  if (freq === 'quarterly') return p.premiumAmount * 4;
  if (freq === 'half-yearly') return p.premiumAmount * 2;
  return p.premiumAmount;
}

function daysUntilRenewal(policy: InsurancePolicy) {
  try {
    const d = parseISO(policy.renewalDate);
    if (isNaN(d.getTime())) return 9999;
    return differenceInDays(d, new Date());
  } catch {
    return 9999;
  }
}

function computeNextRenewalDate(
  currentRenewal: string,
  frequency: InsurancePolicy['premiumFrequency'],
): string {
  try {
    let d = parseISO(currentRenewal);
    if (isNaN(d.getTime())) return currentRenewal;

    switch (frequency) {
      case 'monthly':
        d = addMonths(d, 1);
        break;
      case 'quarterly':
        d = addMonths(d, 3);
        break;
      case 'half-yearly':
        d = addMonths(d, 6);
        break;
      case 'yearly':
      default:
        d = addYears(d, 1);
        break;
    }
    return format(d, 'yyyy-MM-dd');
  } catch {
    return currentRenewal;
  }
}

function computePreviousRenewalDate(
  currentRenewal: string,
  frequency: InsurancePolicy['premiumFrequency'],
): string {
  try {
    let d = parseISO(currentRenewal);
    if (isNaN(d.getTime())) return currentRenewal;

    switch (frequency) {
      case 'monthly':
        d = subMonths(d, 1);
        break;
      case 'quarterly':
        d = subMonths(d, 3);
        break;
      case 'half-yearly':
        d = subMonths(d, 6);
        break;
      case 'yearly':
      default:
        d = subYears(d, 1);
        break;
    }
    return format(d, 'yyyy-MM-dd');
  } catch {
    return currentRenewal;
  }
}

function totalPaymentsForPolicy(policy: InsurancePolicy): number {
  const payingTermYears =
    (policy as any).premiumPayingTermYears || (policy as any).policyTermYears;
  if (!payingTermYears) return 0;
  const freqMultiplier =
    policy.premiumFrequency === 'monthly'
      ? 12
      : policy.premiumFrequency === 'quarterly'
        ? 4
        : policy.premiumFrequency === 'half-yearly'
          ? 2
          : 1;
  return payingTermYears * freqMultiplier;
}

// ── Overview Tab ───────────────────────────────────────────────────────────

function OverviewTab({
  policies,
  payments,
}: {
  policies: InsurancePolicy[];
  payments: InsurancePayment[];
}) {
  const totalCoverage = policies.reduce((a, p) => a + p.coverageAmount, 0);
  const totalPremium = policies.reduce((a, p) => a + annualPremium(p), 0);
  const expiringSoon = policies.filter((p) => {
    const d = daysUntilRenewal(p);
    return d >= 0 && d <= 30;
  });
  const expired = policies.filter((p) => daysUntilRenewal(p) < 0);

  const byType = Object.entries(TYPE_META)
    .map(([type, meta]) => ({
      ...meta,
      type,
      count: policies.filter((p) => p.type === type).length,
      coverage: policies
        .filter((p) => p.type === type)
        .reduce((a, p) => a + p.coverageAmount, 0),
    }))
    .filter((t) => t.count > 0);
  const insights = buildInsuranceInsights(policies, payments);

  return (
    <div className='space-y-5'>
      <div className='grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4'>
        {[
          {
            label: 'Total Policies',
            value: String(policies.length),
            sub: 'Active',
            color: 'text-sky-400',
          },
          {
            label: 'Total Coverage',
            value: formatCurrency(totalCoverage),
            sub: 'Sum assured',
            color: 'text-emerald-400',
          },
          {
            label: 'Annual Premium',
            value: formatCurrency(totalPremium),
            sub: `Mo: ${formatCurrency(totalPremium / 12)}`,
            color: 'text-violet-400',
          },
          {
            label: 'Upcoming Renewals',
            value: String(expiringSoon.length + expired.length),
            sub: 'In next 30 days',
            color: 'text-amber-400',
          },
        ].map((card) => (
          <div
            key={card.label}
            className='bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 md:p-5'
          >
            <p className='text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-500'>
              {card.label}
            </p>
            <p className={`text-xl md:text-2xl font-bold mt-1.5 ${card.color}`}>
              {card.value}
            </p>
            <p className='text-xs text-slate-900 dark:text-slate-500 mt-0.5'>{card.sub}</p>
          </div>
        ))}
      </div>

      <div className='grid grid-cols-2 md:grid-cols-5 gap-3'>
        <div className='rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4'>
          <p className='text-[10px] font-bold uppercase tracking-wider text-slate-500'>Protection health</p>
          <p className='mt-1 text-lg font-black text-emerald-600 dark:text-emerald-400'>{insights.healthScore}/100</p>
        </div>
        <div className='rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4'>
          <p className='text-[10px] font-bold uppercase tracking-wider text-slate-500'>Paid this year</p>
          <p className='mt-1 text-lg font-black text-slate-900 dark:text-slate-100'>{formatCurrency(insights.paidThisYear)}</p>
        </div>
        <div className='rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4'>
          <p className='text-[10px] font-bold uppercase tracking-wider text-slate-500'>Policy diversity</p>
          <p className='mt-1 text-lg font-black text-indigo-600 dark:text-indigo-400'>{insights.coveredTypes} types</p>
        </div>
        <div className='rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4'>
          <p className='text-[10px] font-bold uppercase tracking-wider text-slate-500'>Due in 30 days</p>
          <p className='mt-1 text-lg font-black text-amber-600 dark:text-amber-400'>{insights.dueSoon}</p>
        </div>
        <div className='rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4'>
          <p className='text-[10px] font-bold uppercase tracking-wider text-slate-500'>Annual premium</p>
          <p className='mt-1 text-lg font-black text-violet-600 dark:text-violet-400'>{formatCurrency(insights.annualPremium)}</p>
        </div>
      </div>

      {(expired.length > 0 || expiringSoon.length > 0) && (
        <div className='space-y-3'>
          {expired.map((p) => (
            <div
              key={p.id}
              className='flex items-start gap-3 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl'
            >
              <FiAlertTriangle className='h-5 w-5 text-rose-400 shrink-0 mt-0.5' />
              <div>
                <p className='text-sm font-bold text-rose-300'>
                  {p.policyName} — EXPIRED
                </p>
                <p className='text-xs text-rose-400/80 mt-1'>
                  Expired {Math.abs(daysUntilRenewal(p))} days ago •{' '}
                  {p.provider}
                </p>
              </div>
            </div>
          ))}
          {expiringSoon.map((p) => {
            const days = daysUntilRenewal(p);
            return (
              <div
                key={p.id}
                className='flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl'
              >
                <FiClock className='h-5 w-5 text-amber-400 shrink-0 mt-0.5' />
                <div>
                  <p className='text-sm font-bold text-amber-300'>
                    {p.policyName} — Renews in {days} days
                  </p>
                  <p className='text-xs text-amber-400/80 mt-1'>
                    Due: {safeFormat(p.renewalDate)} • Premium:{' '}
                    {formatCurrency(p.premiumAmount)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {byType.length > 0 && (
        <div className='bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-5'>
          <p className='text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-500 mb-4'>
            Coverage by Type
          </p>
          <div className='space-y-4'>
            {byType.map((t) => {
              const pct =
                totalCoverage > 0 ? (t.coverage / totalCoverage) * 100 : 0;
              return (
                <div key={t.type}>
                  <div className='flex items-center justify-between mb-2'>
                    <div className='flex items-center gap-2'>
                      <span className='text-lg'>{t.icon}</span>
                      <span className={`text-sm font-bold ${t.color}`}>
                        {t.label}
                      </span>
                      <span className='text-xs text-slate-900 dark:text-slate-500 ml-1 hidden sm:inline'>
                        ({t.count} {t.count === 1 ? 'policy' : 'policies'})
                      </span>
                    </div>
                    <span className='text-sm font-bold text-slate-900 dark:text-slate-200'>
                      {formatCurrency(t.coverage)}
                    </span>
                  </div>
                  <div className='h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden'>
                    <div
                      className='h-full rounded-full bg-emerald-500 transition-all duration-500'
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {policies.length === 0 && (
        <div className='text-center py-16 text-slate-900 dark:text-slate-500'>
          <FiShield className='h-12 w-12 mx-auto mb-3 opacity-30' />
          <p className='font-bold'>No policies yet</p>
          <p className='text-sm mt-1'>
            Add your first insurance policy to get started
          </p>
        </div>
      )}
    </div>
  );
}

// ── Policies Tab ───────────────────────────────────────────────────────────

function PoliciesTab({
  policies,
  onAdd,
  onEdit,
  onDelete,
}: {
  policies: InsurancePolicy[];
  onAdd: () => void;
  onEdit: (p: InsurancePolicy) => void;
  onDelete: (p: InsurancePolicy) => void;
}) {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');

  const filtered = useMemo(
    () =>
      policies.filter((p) => {
        const q = search.toLowerCase();
        const matchQuery =
          !q ||
          p.policyName.toLowerCase().includes(q) ||
          p.provider.toLowerCase().includes(q);
        const matchType = filterType === 'all' || p.type === filterType;
        return matchQuery && matchType;
      }),
    [policies, search, filterType],
  );

  return (
    <div className='space-y-4'>
      <div className='flex flex-col md:flex-row gap-3'>
        <input
          type='text'
          placeholder='Search policies…'
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className='flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-emerald-500/50 focus:outline-none transition-colors'
        />
        <div className='flex gap-3'>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className='flex-1 md:flex-none rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 px-3 py-3 text-sm text-slate-600 dark:text-slate-700 dark:text-slate-300 focus:outline-none transition-colors'
          >
            <option value='all'>All Types</option>
            {Object.entries(TYPE_META).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
          <button
            onClick={onAdd}
            className='shrink-0 inline-flex items-center cursor-pointer justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-3 rounded-xl text-sm font-bold transition-colors shadow-lg shadow-emerald-500/20'
          >
            <FiPlus className='h-4 w-4' />{' '}
            <span className='hidden sm:inline'>Add Policy</span>
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className='text-center py-12 text-slate-900 dark:text-slate-500 bg-white dark:bg-slate-900/30 rounded-2xl border border-slate-200 dark:border-slate-800 border-dashed'>
          <FiShield className='h-8 w-8 mx-auto mb-2 opacity-30' />
          <p className='text-sm'>No policies found</p>
        </div>
      ) : (
        <div className='grid grid-cols-1 xl:grid-cols-2 gap-4'>
          {filtered.map((policy) => {
            const meta = TYPE_META[policy.type] || TYPE_META.other;
            const days = daysUntilRenewal(policy);
            const isExpiring = days >= 0 && days <= 30;
            const isExpired = days < 0;

            return (
              <div
                key={policy.id}
                className={`bg-slate-100 dark:bg-slate-900/60 border rounded-2xl p-5 transition-all hover:bg-slate-100/90 dark:bg-slate-800/40 ${
                  isExpired
                    ? 'border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.05)]'
                    : isExpiring
                      ? 'border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.05)]'
                      : 'border-slate-300/70 dark:border-slate-700/60 hover:border-slate-500'
                }`}
              >
                <div className='flex flex-col sm:flex-row sm:items-start justify-between gap-4'>
                  <div className='flex items-start gap-4 flex-1 min-w-0'>
                    <div
                      className={`shrink-0 h-12 w-12 rounded-xl flex items-center justify-center border text-2xl ${meta.bg}`}
                    >
                      {meta.icon}
                    </div>
                    <div className='min-w-0 flex-1'>
                      <div className='flex items-center gap-2 flex-wrap'>
                        <h3 className='text-base font-bold text-slate-900 dark:text-slate-100'>
                          {policy.policyName}
                        </h3>
                        <span
                          className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${meta.bg} ${meta.color}`}
                        >
                          {meta.label}
                        </span>
                        {isExpired && (
                          <span className='text-[10px] font-black text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20'>
                            EXPIRED {Math.abs(days)}d AGO
                          </span>
                        )}
                        {isExpiring && !isExpired && (
                          <span className='text-[10px] font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20'>
                            {days}d left
                          </span>
                        )}
                      </div>
                      <p className='text-xs text-slate-500 dark:text-slate-400 mt-1'>
                        {policy.provider}
                        {policy.policyNumber
                          ? ` • #${policy.policyNumber}`
                          : ''}
                      </p>

                      <div className='grid grid-cols-2 gap-y-3 gap-x-4 mt-4'>
                        <div className='bg-slate-100 dark:bg-slate-800/50 p-2 rounded-lg'>
                          <p className='text-[10px] text-slate-900 dark:text-slate-500 uppercase tracking-wider font-bold mb-0.5'>
                            Coverage
                          </p>
                          <p className='text-sm font-bold text-slate-900 dark:text-slate-200'>
                            {formatCurrency(policy.coverageAmount)}
                          </p>
                        </div>
                        <div className='bg-slate-100 dark:bg-slate-800/50 p-2 rounded-lg'>
                          <p className='text-[10px] text-slate-900 dark:text-slate-500 uppercase tracking-wider font-bold mb-0.5'>
                            Premium ({policy.premiumFrequency})
                          </p>
                          <p className='text-sm font-bold text-slate-900 dark:text-slate-200'>
                            {formatCurrency(policy.premiumAmount)}
                          </p>
                        </div>
                        <div className='bg-slate-100 dark:bg-slate-800/50 p-2 rounded-lg'>
                          <p className='text-[10px] text-slate-900 dark:text-slate-500 uppercase tracking-wider font-bold mb-0.5'>
                            Next Due
                          </p>
                          <p
                            className={`text-sm font-bold ${isExpired ? 'text-rose-400' : isExpiring ? 'text-amber-400' : 'text-emerald-400'}`}
                          >
                            {safeFormat(policy.renewalDate)}
                          </p>
                        </div>
                        <div className='bg-slate-100 dark:bg-slate-800/50 p-2 rounded-lg'>
                          <p className='text-[10px] text-slate-900 dark:text-slate-500 uppercase tracking-wider font-bold mb-0.5'>
                            Last Paid
                          </p>
                          <p className='text-sm font-bold text-slate-600 dark:text-slate-700 dark:text-slate-300'>
                            {safeFormat(policy.lastPaymentDate)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions - Bottom right on Mobile, Top right on Desktop */}
                  <div className='flex sm:flex-col gap-2 shrink-0 border-t sm:border-t-0 border-slate-300/60 dark:border-slate-700/50 pt-3 sm:pt-0'>
                    <button
                      onClick={() => onEdit(policy)}
                      className='flex-1 sm:flex-none h-9 sm:w-9 rounded-lg cursor-pointer bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:bg-slate-700 text-slate-600 dark:text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors'
                    >
                      <FiEdit2 className='h-4 w-4' />{' '}
                      <span className='sm:hidden ml-2 text-xs font-bold'>
                        Edit
                      </span>
                    </button>
                    <button
                      onClick={() => onDelete(policy)}
                      className='flex-1 sm:flex-none h-9 sm:w-9 rounded-lg cursor-pointer bg-slate-200 dark:bg-slate-800 hover:bg-rose-500/20 text-slate-600 dark:text-slate-700 dark:text-slate-300 hover:text-rose-400 flex items-center justify-center transition-colors'
                    >
                      <FiTrash2 className='h-4 w-4' />{' '}
                      <span className='sm:hidden ml-2 text-xs font-bold'>
                        Delete
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Record Payment Modal ───────────────────────────────────────────────────

function RecordPaymentModal({
  open,
  policies,
  defaultPolicyId,
  onClose,
  onSave,
}: {
  open: boolean;
  policies: InsurancePolicy[];
  defaultPolicyId: string;
  onClose: () => void;
  onSave: (
    policyId: string,
    amount: number,
    paidAt: string,
    note: string,
  ) => Promise<void>;
}) {
  const [policyId, setPolicyId] = useState(
    defaultPolicyId || (policies[0]?.id ?? ''),
  );
  const [paidAt, setPaidAt] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  // Auto-fill amount from selected policy
  const selectedPolicy = policies.find((p) => p.id === policyId);
  const [amount, setAmount] = useState(
    selectedPolicy ? String(selectedPolicy.premiumAmount) : '',
  );

  const handlePolicyChange = (id: string) => {
    setPolicyId(id);
    const pol = policies.find((p) => p.id === id);
    if (pol) setAmount(String(pol.premiumAmount));
  };

  const inputCls =
    'w-full rounded-xl cursor-pointer border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-900/60 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-emerald-500/50 focus:outline-none transition-all';
  const labelCls =
    'block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2';

  const handleSave = async () => {
    if (!policyId || !amount || !paidAt) return;
    setSaving(true);
    try {
      await onSave(policyId, Number(amount), paidAt, note);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title='Record Premium Payment'>
      <div className='flex flex-col gap-5'>
        <div>
          <label className={labelCls}>Select Policy</label>
          <select
            value={policyId}
            onChange={(e) => handlePolicyChange(e.target.value)}
            className={inputCls}
          >
            {policies.map((p) => (
              <option key={p.id} value={p.id}>
                {p.policyName} ({formatCurrency(p.premiumAmount)})
              </option>
            ))}
          </select>
        </div>

        <div className='grid grid-cols-1 sm:grid-cols-2 gap-5'>
          <div>
            <label className={labelCls}>Amount Paid (₹)</label>
            <input
              type='number'
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={inputCls}
              placeholder='e.g. 5000'
            />
          </div>
          <div>
            <label className={labelCls}>Payment Date</label>
            <input
              type='date'
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>Transaction Note (Optional)</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={inputCls}
            placeholder='e.g. Online Netbanking, Auto-Debit'
          />
        </div>

        {selectedPolicy && (
          <div className='bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4'>
            <p className='text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-2'>
              <FiClock /> Next Renewal Automation
            </p>
            <p className='mt-2 text-sm text-indigo-800 dark:text-indigo-300'>
              After saving, the next due date will automatically advance to{' '}
              <strong className='text-slate-900 dark:text-white'>
                {safeFormat(
                  computeNextRenewalDate(
                    selectedPolicy.renewalDate,
                    selectedPolicy.premiumFrequency,
                  ),
                )}
              </strong>
            </p>
          </div>
        )}

        <div className='flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800 pt-5 mt-2'>
          <button
            onClick={onClose}
            className='px-5 py-2.5 rounded-xl cursor-pointer text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:bg-slate-800 transition-colors'
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !policyId || !amount || !paidAt}
            className='inline-flex items-center gap-2 px-6 py-2.5 rounded-xl cursor-pointer text-sm font-bold bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
          >
            <FiCheck className='h-4 w-4' />
            {saving ? 'Saving…' : 'Record Payment'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Payments Tab ───────────────────────────────────────────────────────────

function PaymentsTab({
  policies,
  payments,
  onAddPayment,
  onDeletePayment,
  deletingPaymentId,
}: {
  policies: InsurancePolicy[];
  payments: InsurancePayment[];
  onAddPayment: (
    policyId: string,
    amount: number,
    paidAt: string,
    note: string,
  ) => Promise<void>;
  onDeletePayment: (id: string) => void;
  deletingPaymentId?: string | null;
}) {
  const [selectedPolicyId, setSelectedPolicyId] = useState<string>('all');
  const [showAdd, setShowAdd] = useState(false);

  const filtered =
    selectedPolicyId === 'all'
      ? payments
      : payments.filter((p) => p.policyId === selectedPolicyId);

  const sorted = [...filtered].sort((a, b) => b.paidAt.localeCompare(a.paidAt));
  const totalPaid = filtered.reduce((a, p) => a + p.amount, 0);

  const selectedPolicy = policies.find((p) => p.id === selectedPolicyId);
  const totalExpected = selectedPolicy
    ? totalPaymentsForPolicy(selectedPolicy)
    : 0;
  const paidCount = selectedPolicy
    ? filtered.length + (selectedPolicy.paymentsAlreadyMade ?? 0)
    : 0;

  return (
    <div className='space-y-5'>
      {/* Action Bar */}
      <div className='flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl'>
        <div className='flex-1 max-w-md'>
          <select
            value={selectedPolicyId}
            onChange={(e) => setSelectedPolicyId(e.target.value)}
            className='w-full rounded-xl cursor-pointer border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 focus:border-emerald-500/50 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
          >
            <option value='all'>All Payment History</option>
            {policies.map((p) => (
              <option key={p.id} value={p.id}>
                {p.policyName}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className='shrink-0 inline-flex justify-center items-center cursor-pointer gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-lg shadow-emerald-500/20'
        >
          <FiPlus className='h-4 w-4' /> Record Payment
        </button>
      </div>

      {/* Progress bar for selected policy (if term known) */}
      {selectedPolicy && totalExpected > 0 && (
        <div className='bg-slate-100 dark:bg-slate-900/60 border border-slate-300/60 dark:border-slate-700/50 rounded-2xl p-5 space-y-3'>
          <p className='text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400'>
            Premium Payment Progress
          </p>
          <div className='flex justify-between items-end text-sm'>
            <span className='font-medium text-slate-600 dark:text-slate-700 dark:text-slate-300'>
              <strong className='text-lg text-slate-900 dark:text-slate-100'>
                {paidCount}
              </strong>{' '}
              of{' '}
              {totalExpected} payments complete
            </span>
            <span className='font-black text-emerald-400 text-lg'>
              {Math.min(100, Math.round((paidCount / totalExpected) * 100))}%
            </span>
          </div>
          <div className='h-3 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden'>
            <div
              className='h-full bg-emerald-500 transition-all duration-700'
              style={{
                width: `${Math.min(100, (paidCount / totalExpected) * 100)}%`,
              }}
            />
          </div>
          {(selectedPolicy.paymentsAlreadyMade ?? 0) > 0 && (
            <p className='text-[10px] text-slate-900 dark:text-slate-500 italic'>
              * Includes {selectedPolicy.paymentsAlreadyMade} legacy payments
              made before using this tracker.
            </p>
          )}
        </div>
      )}

      {/* Mobile-Friendly Payment Cards */}
      {sorted.length === 0 ? (
        <div className='text-center py-16 text-slate-900 dark:text-slate-500 bg-white dark:bg-slate-900/30 rounded-2xl border border-slate-200 dark:border-slate-800 border-dashed'>
          <p className='text-sm font-medium'>No payments recorded yet.</p>
          <p className='text-xs mt-1'>
            Click "Record Payment" to add your first transaction.
          </p>
        </div>
      ) : (
        <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
          {sorted.map((p) => {
            const policy = policies.find((x) => x.id === p.policyId);
            return (
              <div
                key={p.id}
                className='flex flex-col sm:flex-row sm:items-center gap-4 p-5 bg-slate-100 dark:bg-slate-900/60 border border-slate-300/60 dark:border-slate-700/50 rounded-2xl group transition-all hover:border-emerald-500/30'
              >
                <div className='flex items-center gap-4 flex-1 min-w-0'>
                  <div className='h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0'>
                    <FiCheck className='h-5 w-5 text-emerald-400' />
                  </div>
                  <div className='min-w-0'>
                    <p className='text-sm font-bold text-slate-900 dark:text-slate-100 truncate'>
                      {policy?.policyName || 'Unknown Policy (Deleted)'}
                    </p>
                    <p className='text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5'>
                      {p.note || 'Premium Payment'}
                    </p>
                  </div>
                </div>

                <div className='flex items-center justify-between sm:justify-end gap-5 w-full sm:w-auto mt-2 sm:mt-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-200 dark:border-slate-800'>
                  <div className='text-left sm:text-right'>
                    <p className='text-lg font-bold text-emerald-400 tabular-nums'>
                      {formatCurrency(p.amount)}
                    </p>
                    <p className='text-[10px] font-bold text-slate-900 dark:text-slate-500 uppercase tracking-wider mt-0.5'>
                      {safeFormat(p.paidAt)}
                    </p>
                  </div>
                  <button
                    onClick={() => onDeletePayment(p.id)}
                    disabled={!!deletingPaymentId}
                    className='btn-icon btn-icon-delete h-10 w-10 disabled:opacity-50 disabled:pointer-events-none'
                  >
                    <FiTrash2 className='h-4 w-4' />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary Footer */}
      {sorted.length > 0 && (
        <div className='flex items-center justify-between bg-white/95 dark:bg-slate-900/80 p-5 rounded-2xl border border-slate-300 dark:border-slate-700 mt-4'>
          <p className='text-sm font-bold text-slate-500 dark:text-slate-400'>
            Total Paid ({sorted.length} records)
          </p>
          <p className='text-xl font-black text-slate-900 dark:text-slate-100'>
            {formatCurrency(totalPaid)}
          </p>
        </div>
      )}

      <RecordPaymentModal
        open={showAdd}
        policies={policies}
        defaultPolicyId={
          selectedPolicyId === 'all'
            ? (policies[0]?.id ?? '')
            : selectedPolicyId
        }
        onClose={() => setShowAdd(false)}
        onSave={onAddPayment}
      />
    </div>
  );
}

// ── Reports Tab ────────────────────────────────────────────────────────────

function ReportsTab({
  policies,
  payments,
}: {
  policies: InsurancePolicy[];
  payments: InsurancePayment[];
}) {
  const totalCoverage = policies.reduce((a, p) => a + p.coverageAmount, 0);
  const totalPremium = policies.reduce((a, p) => a + annualPremium(p), 0);
  const totalPaid = payments.reduce((a, p) => a + p.amount, 0);

  const byType = Object.entries(TYPE_META)
    .map(([type, meta]) => {
      const tp = policies.filter((p) => p.type === type);
      return {
        ...meta,
        type,
        count: tp.length,
        coverage: tp.reduce((a, p) => a + p.coverageAmount, 0),
        premium: tp.reduce((a, p) => a + annualPremium(p), 0),
      };
    })
    .filter((t) => t.count > 0);

  const urgency = {
    expired: policies.filter((p) => daysUntilRenewal(p) < 0).length,
    urgent: policies.filter((p) => {
      const d = daysUntilRenewal(p);
      return d >= 0 && d <= 7;
    }).length,
    upcoming: policies.filter((p) => {
      const d = daysUntilRenewal(p);
      return d > 7 && d <= 30;
    }).length,
    ok: policies.filter((p) => daysUntilRenewal(p) > 30).length,
  };

  return (
    <div className='space-y-5'>
      <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
        {[
          {
            label: 'Total Policies',
            value: String(policies.length),
            icon: '📋',
          },
          {
            label: 'Total Coverage',
            value: formatCurrency(totalCoverage),
            icon: '🛡️',
          },
          {
            label: 'Annual Premium',
            value: formatCurrency(totalPremium),
            icon: '₹',
          },
          {
            label: 'Total Paid (App)',
            value: formatCurrency(totalPaid),
            icon: '✅',
          },
        ].map((card) => (
          <div
            key={card.label}
            className='bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-5'
          >
            <div className='flex items-center gap-2 mb-3'>
              <span className='text-xl'>{card.icon}</span>
              <p className='text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'>
                {card.label}
              </p>
            </div>
            <p className='text-2xl font-bold text-slate-900 dark:text-slate-100'>{card.value}</p>
          </div>
        ))}
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-5'>
        <div className='bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6'>
          <p className='text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-500 mb-5'>
            Coverage by Type
          </p>
          <div className='space-y-4'>
            {byType.length === 0 ? (
              <p className='text-sm text-slate-900 dark:text-slate-500'>No data available</p>
            ) : (
              byType.map((t) => {
                const pct =
                  totalCoverage > 0 ? (t.coverage / totalCoverage) * 100 : 0;
                return (
                  <div key={t.type}>
                    <div className='flex justify-between items-end mb-2'>
                      <span className={`text-sm font-bold ${t.color}`}>
                        {t.icon} {t.label}
                      </span>
                      <span className='text-xs font-bold text-slate-600 dark:text-slate-700 dark:text-slate-300'>
                        {pct.toFixed(0)}% • {formatCurrency(t.coverage)}
                      </span>
                    </div>
                    <div className='h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden'>
                      <div
                        className='h-full rounded-full bg-emerald-500'
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className='bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6'>
          <p className='text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-500 mb-5'>
            Renewal Urgency
          </p>
          <div className='space-y-4'>
            {[
              {
                label: 'Expired',
                count: urgency.expired,
                color: 'bg-rose-500',
                text: 'text-rose-400',
              },
              {
                label: 'Urgent (≤7 days)',
                count: urgency.urgent,
                color: 'bg-orange-500',
                text: 'text-orange-400',
              },
              {
                label: 'Upcoming (≤30 days)',
                count: urgency.upcoming,
                color: 'bg-amber-500',
                text: 'text-amber-400',
              },
              {
                label: 'Active & Secure',
                count: urgency.ok,
                color: 'bg-emerald-500',
                text: 'text-emerald-400',
              },
            ].map((row) => (
              <div
                key={row.label}
                className='flex items-center justify-between p-3 bg-slate-100/80 dark:bg-slate-800/30 rounded-xl border border-slate-300/60 dark:border-slate-700/50'
              >
                <div className='flex items-center gap-3'>
                  <div
                    className={`h-3.5 w-3.5 rounded-full ${row.color} shrink-0 shadow-[0_0_10px_currentColor]`}
                  />
                  <span className='text-sm font-medium text-slate-600 dark:text-slate-700 dark:text-slate-300'>
                    {row.label}
                  </span>
                </div>
                <span className={`text-base font-black ${row.text}`}>
                  {row.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className='bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 lg:col-span-2'>
          <p className='text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-500 mb-5'>
            Detailed Summary by Category
          </p>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            {byType.map((t) => (
              <div
                key={t.type}
                className={`flex flex-col p-4 rounded-xl border ${t.bg}`}
              >
                <div className='flex items-center gap-3 mb-3'>
                  <span className='text-2xl'>{t.icon}</span>
                  <div>
                    <p className={`text-sm font-bold ${t.color}`}>{t.label}</p>
                    <p className='text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-0.5'>
                      {t.count} {t.count === 1 ? 'policy' : 'policies'}
                    </p>
                  </div>
                </div>
                <div className='flex justify-between items-end mt-auto pt-3 border-t border-slate-300/60 dark:border-slate-700/50'>
                  <div>
                    <p className='text-[10px] text-slate-900 dark:text-slate-500 uppercase'>
                      Annual Premium
                    </p>
                    <p className='text-sm font-bold text-slate-600 dark:text-slate-700 dark:text-slate-300'>
                      {formatCurrency(t.premium)}
                    </p>
                  </div>
                  <div className='text-right'>
                    <p className='text-[10px] text-slate-900 dark:text-slate-500 uppercase'>
                      Total Coverage
                    </p>
                    <p className='text-lg font-black text-slate-900 dark:text-slate-100'>
                      {formatCurrency(t.coverage)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main InsurancePage ─────────────────────────────────────────────────────

export function InsurancePage() {
  const policies = usePortfolioStore((s) => s.insurancePolicies) || [];
  const payments = usePortfolioStore((s) => s.insurancePayments) || [];
  const loadInsurancePayments = usePortfolioStore((s) => s.loadInsurancePayments);

  // Lazy-load insurance payments the first time this page opens
  useEffect(() => { void loadInsurancePayments(); }, [loadInsurancePayments]);

  const deletePolicy = usePortfolioStore((s) => s.deleteInsurancePolicy);
  const updatePolicy = usePortfolioStore((s) => s.updateInsurancePolicy);
  const addPaymentStore = usePortfolioStore((s) => s.addInsurancePayment);
  const deletePaymentStore = usePortfolioStore((s) => s.deleteInsurancePayment);

  const [activeTab, setActiveTab] = useState<TabType>('Overview');
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingPolicy, setEditingPolicy] = useState<InsurancePolicy | null>(
    null,
  );
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingPolicy, setDeletingPolicy] = useState<InsurancePolicy | null>(
    null,
  );
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);

  const handleEdit = (policy: InsurancePolicy) => {
    setEditingPolicy(policy);
    setModalMode('edit');
  };

  const handleDeleteClick = (policy: InsurancePolicy) => {
    setDeletingPolicy(policy);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingPolicy) return;
    setDeleteLoading(true);
    try {
      // 1. Delete all associated payments first so they don't become ghosts
      const relatedPayments = payments.filter(
        (p) => p.policyId === deletingPolicy.id,
      );
      await Promise.all(relatedPayments.map((p) => deletePaymentStore(p.id)));

      // 2. Delete the policy itself
      await deletePolicy(deletingPolicy.id);

      setDeleteModalOpen(false);
      setDeletingPolicy(null);
      toast.success(`"${deletingPolicy.policyName}" and its records deleted`);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleAddPayment = async (
    policyId: string,
    amount: number,
    paidAt: string,
    note: string,
  ) => {
    await addPaymentStore({ policyId, amount, paidAt, note });

    const policy = policies.find((p) => p.id === policyId);
    if (policy) {
      const nextRenewal = computeNextRenewalDate(
        policy.renewalDate,
        policy.premiumFrequency,
      );
      await updatePolicy(policy.id, {
        renewalDate: nextRenewal,
        lastPaymentDate: paidAt,
      });
    }

    toast.success('Payment recorded! Renewal date automatically updated.');
  };

  const handleDeletePayment = async (id: string) => {
    if (deletingPaymentId) return;
    setDeletingPaymentId(id);
    try {
      const paymentToDelete = payments.find((p) => p.id === id);

      await deletePaymentStore(id);

      if (paymentToDelete) {
        const policy = policies.find((p) => p.id === paymentToDelete.policyId);
        if (policy) {
          const previousRenewal = computePreviousRenewalDate(
            policy.renewalDate,
            policy.premiumFrequency,
          );

          const remainingPayments = payments.filter(
            (p) => p.policyId === policy.id && p.id !== id,
          );
          remainingPayments.sort((a, b) => b.paidAt.localeCompare(a.paidAt));

          const newLastPaymentDate =
            remainingPayments.length > 0 ? remainingPayments[0].paidAt : '';

          await updatePolicy(policy.id, {
            renewalDate: previousRenewal,
            lastPaymentDate: newLastPaymentDate,
          });
        }
      }

      toast.success('Payment history removed. Renewal date adjusted.');
    } finally {
      setDeletingPaymentId(null);
    }
  };

  return (
    <div className='space-y-5 pb-20 animate-in fade-in duration-500'>
      {/* Page header */}
      <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-5 rounded-2xl bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-transparent p-6 border border-blue-500/20 shadow-sm'>
        <div>
          <h1 className='flex items-center gap-3 text-2xl font-bold text-slate-900 dark:text-white'>
            <div className='p-2 bg-blue-500/20 rounded-xl'>
              <FiShield className='text-blue-400' />
            </div>
            Insurance & Protection
            <FeatureInfo feature='insurance' />
          </h1>
          <p className='text-slate-500 dark:text-slate-400 text-sm mt-2'>
            Track life, health, vehicle, and property coverage.
          </p>
        </div>
        <button
          onClick={() => setModalMode('create')}
          className='inline-flex justify-center items-center gap-2 cursor-pointer bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-3 rounded-xl text-sm font-bold transition-colors shadow-lg shadow-emerald-500/20'
        >
          <FiPlus className='h-4 w-4' /> Add New Policy
        </button>
      </div>

      {/* Tabs */}
      <div className='flex gap-1 bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-1.5 w-full overflow-x-auto no-scrollbar'>
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 rounded-lg cursor-pointer text-sm font-bold transition-all whitespace-nowrap flex-1 sm:flex-none ${
              activeTab === tab
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/80 dark:bg-slate-800/80'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className='animate-in fade-in duration-300 mt-2'>
        {activeTab === 'Overview' && (
          <OverviewTab policies={policies} payments={payments} />
        )}
        {activeTab === 'Policies' && (
          <PoliciesTab
            policies={policies}
            onAdd={() => setModalMode('create')}
            onEdit={handleEdit}
            onDelete={handleDeleteClick}
          />
        )}
        {activeTab === 'Payments' && (
          <PaymentsTab
            policies={policies}
            payments={payments}
            onAddPayment={handleAddPayment}
            onDeletePayment={handleDeletePayment}
            deletingPaymentId={deletingPaymentId}
          />
        )}
        {activeTab === 'Reports' && (
          <ReportsTab policies={policies} payments={payments} />
        )}
      </div>

      {/* Create/Edit Policy Modal */}
      {modalMode === 'create' && (
        <UpsertInsuranceModal
          open
          mode='create'
          onClose={() => setModalMode(null)}
        />
      )}
      {modalMode === 'edit' && editingPolicy && (
        <UpsertInsuranceModal
          open
          mode='edit'
          entry={editingPolicy}
          onClose={() => {
            setModalMode(null);
            setEditingPolicy(null);
          }}
        />
      )}

      {/* Delete confirm Modal */}
      <Modal
        open={deleteModalOpen}
        onClose={() => !deleteLoading && setDeleteModalOpen(false)}
        title='Delete Policy'
      >
        <div className='space-y-6'>
          <div className='bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl'>
            <p className='text-sm text-slate-900 dark:text-slate-200'>
              Are you sure you want to permanently delete{' '}
              <strong>{deletingPolicy?.policyName}</strong>?
            </p>
            <p className='text-xs text-rose-400 font-bold mt-2'>
              ⚠️ Warning: All associated payment records will also be
              permanently deleted. This action cannot be undone.
            </p>
          </div>
          <div className='flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800 pt-5'>
            <button
              onClick={() => setDeleteModalOpen(false)}
              disabled={deleteLoading}
              className='px-5 py-2.5 rounded-xl text-sm font-bold cursor-pointer text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:bg-slate-800 transition-colors'
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteConfirm}
              disabled={deleteLoading}
              className='inline-flex items-center gap-2 px-6 py-2.5 cursor-pointer rounded-xl text-sm font-bold bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-60 transition-colors shadow-lg shadow-rose-500/20'
            >
              {deleteLoading ? 'Deleting…' : 'Yes, Delete Policy'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
