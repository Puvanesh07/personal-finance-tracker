// src/pages/Insurance/InsurancePage.tsx — FULL REPLACEMENT
//
// FIXES:
//  1. Payment records stored properly using mapped portfolioStore functions
//  2. Removed redundant "Record Payment" button from top header
//  3. Removed "as any" cast hacks since types are now strictly defined

import {
  FiAlertTriangle,
  FiCheck,
  FiClock,
  FiEdit2,
  FiPlus,
  FiShield,
  FiTrash2,
  FiX,
} from 'react-icons/fi';
import type {
  InsurancePayment,
  InsurancePolicy,
} from '../../types/investmentTypes';
import { differenceInDays, format, parseISO } from 'date-fns';
import { useMemo, useState } from 'react';

import { Modal } from '../../components/ui/Modal';
import { UpsertInsuranceModal } from '../../components/insurance/UpsertInsuranceModal';
import { formatCurrency } from '../../utils/format';
import toast from 'react-hot-toast';
import { usePortfolioStore } from '../../store/portfolioStore';

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
    color: 'text-slate-400',
    bg: 'bg-slate-500/10 border-slate-500/20',
    icon: '📋',
  },
};

const TABS = ['Overview', 'Policies', 'Payments', 'Reports'] as const;
type TabType = (typeof TABS)[number];

// ── Helpers ────────────────────────────────────────────────────────────────

function annualPremium(p: InsurancePolicy) {
  const freq = p.premiumFrequency as string;
  if (freq === 'monthly') return p.premiumAmount * 12;
  if (freq === 'quarterly') return p.premiumAmount * 4;
  if (freq === 'half-yearly') return p.premiumAmount * 2;
  return p.premiumAmount;
}

function daysUntilRenewal(policy: InsurancePolicy) {
  return differenceInDays(parseISO(policy.renewalDate), new Date());
}

function computeNextRenewalDate(
  currentRenewal: string,
  frequency: InsurancePolicy['premiumFrequency'],
): string {
  const d = new Date(currentRenewal);
  switch (frequency) {
    case 'monthly':
      d.setMonth(d.getMonth() + 1);
      break;
    case 'quarterly':
      d.setMonth(d.getMonth() + 3);
      break;
    case 'half-yearly':
      d.setMonth(d.getMonth() + 6);
      break;
    case 'yearly':
    default:
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return d.toISOString().split('T')[0];
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

function OverviewTab({ policies }: { policies: InsurancePolicy[] }) {
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

  return (
    <div className='space-y-5'>
      <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
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
            className='bg-slate-900/50 border border-slate-800 rounded-2xl p-4'
          >
            <p className='text-xs font-bold uppercase tracking-wider text-slate-500'>
              {card.label}
            </p>
            <p className={`text-xl font-bold mt-1.5 ${card.color}`}>
              {card.value}
            </p>
            <p className='text-xs text-slate-500 mt-0.5'>{card.sub}</p>
          </div>
        ))}
      </div>

      {(expired.length > 0 || expiringSoon.length > 0) && (
        <div className='space-y-2'>
          {expired.map((p) => (
            <div
              key={p.id}
              className='flex items-start gap-3 p-3.5 bg-rose-500/8 border border-rose-500/20 rounded-xl'
            >
              <FiAlertTriangle className='h-4 w-4 text-rose-400 mt-0.5 shrink-0' />
              <div>
                <p className='text-sm font-bold text-rose-300'>
                  {p.policyName} — EXPIRED
                </p>
                <p className='text-xs text-rose-400/70'>
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
                className='flex items-start gap-3 p-3.5 bg-amber-500/8 border border-amber-500/20 rounded-xl'
              >
                <FiClock className='h-4 w-4 text-amber-400 mt-0.5 shrink-0' />
                <div>
                  <p className='text-sm font-bold text-amber-300'>
                    {p.policyName} — Renews in {days} days
                  </p>
                  <p className='text-xs text-amber-400/70'>
                    Due: {format(parseISO(p.renewalDate), 'dd MMM yyyy')} •
                    Premium: {formatCurrency(p.premiumAmount)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {byType.length > 0 && (
        <div className='bg-slate-900/50 border border-slate-800 rounded-2xl p-4'>
          <p className='text-xs font-black uppercase tracking-widest text-slate-500 mb-3'>
            Coverage by Type
          </p>
          <div className='space-y-3'>
            {byType.map((t) => {
              const pct =
                totalCoverage > 0 ? (t.coverage / totalCoverage) * 100 : 0;
              return (
                <div key={t.type}>
                  <div className='flex items-center justify-between mb-1'>
                    <div className='flex items-center gap-2'>
                      <span>{t.icon}</span>
                      <span className={`text-xs font-bold ${t.color}`}>
                        {t.label}
                      </span>
                      <span className='text-[10px] text-slate-600'>
                        {t.count} {t.count === 1 ? 'policy' : 'policies'}
                      </span>
                    </div>
                    <span className='text-xs font-bold text-slate-300'>
                      {formatCurrency(t.coverage)}
                    </span>
                  </div>
                  <div className='h-1.5 bg-slate-800 rounded-full'>
                    <div
                      className='h-1.5 rounded-full bg-emerald-500 transition-all'
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
        <div className='text-center py-16 text-slate-500'>
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
      <div className='flex flex-col sm:flex-row gap-3'>
        <input
          type='text'
          placeholder='Search policies…'
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className='flex-1 rounded-xl border border-slate-700 bg-slate-900/50 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-500/50 focus:outline-none'
        />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className='rounded-xl border border-slate-700 bg-slate-900/50 px-3 py-2.5 text-sm text-slate-300 focus:outline-none'
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
          className='inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-lg shadow-emerald-500/20'
        >
          <FiPlus className='h-4 w-4' /> Add Policy
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className='text-center py-12 text-slate-500'>
          <FiShield className='h-8 w-8 mx-auto mb-2 opacity-30' />
          <p className='text-sm'>No policies found</p>
        </div>
      ) : (
        <div className='space-y-3'>
          {filtered.map((policy) => {
            const meta = TYPE_META[policy.type] || TYPE_META.other;
            const days = daysUntilRenewal(policy);
            const isExpiring = days >= 0 && days <= 30;
            const isExpired = days < 0;

            return (
              <div
                key={policy.id}
                className={`bg-slate-900/50 border rounded-2xl p-4 transition-all hover:border-slate-600 ${
                  isExpired
                    ? 'border-rose-500/30'
                    : isExpiring
                      ? 'border-amber-500/30'
                      : 'border-slate-800'
                }`}
              >
                <div className='flex items-start justify-between gap-3'>
                  <div className='flex items-start gap-3 flex-1 min-w-0'>
                    <div
                      className={`shrink-0 h-10 w-10 rounded-xl flex items-center justify-center border text-lg ${meta.bg}`}
                    >
                      {meta.icon}
                    </div>
                    <div className='min-w-0 flex-1'>
                      <div className='flex items-center gap-2 flex-wrap'>
                        <p className='text-sm font-bold text-slate-100'>
                          {policy.policyName}
                        </p>
                        <span
                          className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${meta.bg} ${meta.color}`}
                        >
                          {meta.label}
                        </span>
                        {isExpired && (
                          <span className='text-[10px] font-black text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20'>
                            EXPIRED
                          </span>
                        )}
                        {isExpiring && !isExpired && (
                          <span className='text-[10px] font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20'>
                            {days}d left
                          </span>
                        )}
                      </div>
                      <p className='text-xs text-slate-500 mt-0.5'>
                        {policy.provider}
                        {policy.policyNumber ? ` • ${policy.policyNumber}` : ''}
                      </p>

                      <div className='grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3'>
                        <div>
                          <p className='text-[10px] text-slate-600 uppercase tracking-wide'>
                            Coverage
                          </p>
                          <p className='text-xs font-bold text-slate-200'>
                            {formatCurrency(policy.coverageAmount)}
                          </p>
                        </div>
                        <div>
                          <p className='text-[10px] text-slate-600 uppercase tracking-wide'>
                            Premium
                          </p>
                          <p className='text-xs font-bold text-slate-200'>
                            {formatCurrency(policy.premiumAmount)} /{' '}
                            {policy.premiumFrequency}
                          </p>
                        </div>
                        <div>
                          <p className='text-[10px] text-slate-600 uppercase tracking-wide'>
                            Next Due
                          </p>
                          <p
                            className={`text-xs font-bold ${isExpired ? 'text-rose-400' : isExpiring ? 'text-amber-400' : 'text-slate-200'}`}
                          >
                            {format(
                              parseISO(policy.renewalDate),
                              'dd MMM yyyy',
                            )}
                          </p>
                        </div>
                        <div>
                          <p className='text-[10px] text-slate-600 uppercase tracking-wide'>
                            Last Paid
                          </p>
                          <p className='text-xs font-bold text-slate-400'>
                            {policy.lastPaymentDate
                              ? format(
                                  parseISO(policy.lastPaymentDate),
                                  'dd MMM yyyy',
                                )
                              : '—'}
                          </p>
                        </div>
                      </div>
                      {policy.nominee && (
                        <p className='text-[10px] text-slate-600 mt-2'>
                          Nominee:{' '}
                          <span className='text-slate-400'>
                            {policy.nominee}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className='flex gap-2 shrink-0'>
                    <button
                      onClick={() => onEdit(policy)}
                      className='h-8 w-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors'
                    >
                      <FiEdit2 className='h-3.5 w-3.5' />
                    </button>
                    <button
                      onClick={() => onDelete(policy)}
                      className='h-8 w-8 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 flex items-center justify-center transition-colors'
                    >
                      <FiTrash2 className='h-3.5 w-3.5' />
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

  // When policy changes, suggest its premium amount
  const handlePolicyChange = (id: string) => {
    setPolicyId(id);
    const pol = policies.find((p) => p.id === id);
    if (pol) setAmount(String(pol.premiumAmount));
  };

  const inputCls =
    'w-full rounded-xl border border-slate-700 bg-slate-900/50 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-500/50 focus:outline-none transition-all';
  const labelCls =
    'block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5';

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
      <div className='space-y-4'>
        {/* Policy selector */}
        <div>
          <label className={labelCls}>Policy</label>
          <select
            value={policyId}
            onChange={(e) => handlePolicyChange(e.target.value)}
            className={inputCls}
          >
            {policies.map((p) => (
              <option key={p.id} value={p.id}>
                {p.policyName} — {p.provider} ({formatCurrency(p.premiumAmount)}{' '}
                / {p.premiumFrequency})
              </option>
            ))}
          </select>
          {selectedPolicy && (
            <p className='text-[11px] text-emerald-400 mt-1.5'>
              💡 Suggested: {formatCurrency(selectedPolicy.premiumAmount)} (
              {selectedPolicy.premiumFrequency} premium)
            </p>
          )}
        </div>

        {/* Amount */}
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

        {/* Date */}
        <div>
          <label className={labelCls}>Payment Date</label>
          <input
            type='date'
            value={paidAt}
            onChange={(e) => setPaidAt(e.target.value)}
            className={inputCls}
          />
        </div>

        {/* Note */}
        <div>
          <label className={labelCls}>Note (optional)</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={inputCls}
            placeholder='e.g. Paid via ECS, Online payment'
          />
        </div>

        {/* Renewal notice */}
        {selectedPolicy && (
          <div className='bg-blue-500/8 border border-blue-500/20 rounded-xl p-3'>
            <p className='text-xs font-bold text-blue-300'>
              📅 After recording this payment:
            </p>
            <p className='text-[11px] text-blue-400/80 mt-1'>
              Next due date will automatically advance to{' '}
              <strong>
                {format(
                  parseISO(
                    computeNextRenewalDate(
                      selectedPolicy.renewalDate,
                      selectedPolicy.premiumFrequency,
                    ),
                  ),
                  'dd MMM yyyy',
                )}
              </strong>
            </p>
          </div>
        )}

        <div className='flex justify-end gap-3 border-t border-slate-800 pt-4'>
          <button
            onClick={onClose}
            className='px-4 py-2.5 rounded-xl text-sm font-bold text-slate-400 hover:bg-slate-800'
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !policyId || !amount || !paidAt}
            className='inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50 disabled:cursor-not-allowed'
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
}) {
  const [selectedPolicyId, setSelectedPolicyId] = useState<string>('all');
  const [showAdd, setShowAdd] = useState(false);

  const filtered =
    selectedPolicyId === 'all'
      ? payments
      : payments.filter((p) => p.policyId === selectedPolicyId);

  const sorted = [...filtered].sort((a, b) => b.paidAt.localeCompare(a.paidAt));
  const totalPaid = filtered.reduce((a, p) => a + p.amount, 0);
  const lastPayment = sorted[0];

  const selectedPolicy = policies.find((p) => p.id === selectedPolicyId);
  const totalExpected = selectedPolicy
    ? totalPaymentsForPolicy(selectedPolicy)
    : 0;
  const paidCount = selectedPolicy
    ? filtered.length + (selectedPolicy.paymentsAlreadyMade ?? 0)
    : 0;

  return (
    <div className='space-y-4'>
      {/* Header row */}
      <div className='flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between'>
        <select
          value={selectedPolicyId}
          onChange={(e) => setSelectedPolicyId(e.target.value)}
          className='rounded-xl border border-slate-700 bg-slate-900/50 px-4 py-2.5 text-sm text-slate-300 focus:outline-none max-w-xs'
        >
          <option value='all'>All Policies</option>
          {policies.map((p) => (
            <option key={p.id} value={p.id}>
              {p.policyName} — {p.provider}
            </option>
          ))}
        </select>
        <button
          onClick={() => setShowAdd(true)}
          className='inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-colors'
        >
          <FiPlus className='h-4 w-4' /> Record Payment
        </button>
      </div>

      {/* Summary */}
      <div className='grid grid-cols-3 gap-3'>
        <div className='bg-slate-900/50 border border-slate-800 rounded-xl p-3'>
          <p className='text-[10px] uppercase text-slate-500 font-bold'>
            Total Payments
          </p>
          <p className='text-lg font-bold text-slate-100 mt-1'>
            {filtered.length}
          </p>
        </div>
        <div className='bg-slate-900/50 border border-slate-800 rounded-xl p-3'>
          <p className='text-[10px] uppercase text-slate-500 font-bold'>
            Total Paid
          </p>
          <p className='text-lg font-bold text-emerald-400 mt-1'>
            {formatCurrency(totalPaid)}
          </p>
        </div>
        <div className='bg-slate-900/50 border border-slate-800 rounded-xl p-3'>
          <p className='text-[10px] uppercase text-slate-500 font-bold'>
            Last Payment
          </p>
          <p className='text-sm font-bold text-slate-200 mt-1'>
            {lastPayment
              ? format(parseISO(lastPayment.paidAt), 'dd MMM yy')
              : '—'}
          </p>
        </div>
      </div>

      {/* Progress bar for selected policy (if term known) */}
      {selectedPolicy && totalExpected > 0 && (
        <div className='bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-2'>
          <p className='text-xs font-black uppercase tracking-wider text-slate-500'>
            Payment Progress — {selectedPolicy.policyName}
          </p>
          <div className='flex justify-between text-xs font-bold text-slate-400'>
            <span>
              {paidCount} of {totalExpected} payments done
            </span>
            <span>
              {Math.min(100, Math.round((paidCount / totalExpected) * 100))}%
            </span>
          </div>
          <div className='h-2 bg-slate-800 rounded-full'>
            <div
              className='h-2 bg-emerald-500 rounded-full transition-all'
              style={{
                width: `${Math.min(100, (paidCount / totalExpected) * 100)}%`,
              }}
            />
          </div>
          {(selectedPolicy.paymentsAlreadyMade ?? 0) > 0 && (
            <p className='text-[10px] text-slate-600'>
              Includes {selectedPolicy.paymentsAlreadyMade} payments made before
              using this app.
            </p>
          )}
        </div>
      )}

      {/* Payment list */}
      {sorted.length === 0 ? (
        <div className='text-center py-10 text-slate-500 text-sm'>
          No payments recorded yet. Click "Record Payment" to add one.
        </div>
      ) : (
        <div className='space-y-2'>
          {sorted.map((p) => {
            const policy = policies.find((x) => x.id === p.policyId);
            return (
              <div
                key={p.id}
                className='flex items-center gap-3 p-3 bg-slate-900/50 border border-slate-800 rounded-xl group'
              >
                <div className='h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0'>
                  <FiCheck className='h-3.5 w-3.5 text-emerald-400' />
                </div>
                <div className='flex-1 min-w-0'>
                  <p className='text-xs font-bold text-slate-200'>
                    {policy?.policyName || 'Unknown Policy'}
                  </p>
                  {p.note && (
                    <p className='text-[10px] text-slate-500'>{p.note}</p>
                  )}
                </div>
                <div className='text-right'>
                  <p className='text-sm font-bold text-emerald-400'>
                    {formatCurrency(p.amount)}
                  </p>
                  <p className='text-[10px] text-slate-500'>
                    {format(parseISO(p.paidAt), 'dd MMM yyyy')}
                  </p>
                </div>
                <button
                  onClick={() => onDeletePayment(p.id)}
                  className='opacity-0 group-hover:opacity-100 h-7 w-7 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 flex items-center justify-center transition-all'
                >
                  <FiX className='h-3 w-3' />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Record Payment Modal */}
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
      <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
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
            className='bg-slate-900/50 border border-slate-800 rounded-xl p-4'
          >
            <div className='flex items-center gap-2 mb-2'>
              <span className='text-base'>{card.icon}</span>
              <p className='text-[10px] font-bold uppercase tracking-wider text-slate-500'>
                {card.label}
              </p>
            </div>
            <p className='text-lg font-bold text-slate-100'>{card.value}</p>
          </div>
        ))}
      </div>

      <div className='grid grid-cols-1 sm:grid-cols-2 gap-5'>
        <div className='bg-slate-900/50 border border-slate-800 rounded-2xl p-4'>
          <p className='text-xs font-black uppercase tracking-widest text-slate-500 mb-3'>
            Coverage by Type
          </p>
          <div className='space-y-3'>
            {byType.length === 0 ? (
              <p className='text-xs text-slate-500'>No data</p>
            ) : (
              byType.map((t) => {
                const pct =
                  totalCoverage > 0 ? (t.coverage / totalCoverage) * 100 : 0;
                return (
                  <div key={t.type}>
                    <div className='flex justify-between text-xs font-bold mb-1'>
                      <span className={t.color}>
                        {t.icon} {t.label}
                      </span>
                      <span className='text-slate-400'>
                        {pct.toFixed(0)}% • {formatCurrency(t.coverage)}
                      </span>
                    </div>
                    <div className='h-2 bg-slate-800 rounded-full'>
                      <div
                        className='h-2 rounded-full bg-emerald-500'
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className='bg-slate-900/50 border border-slate-800 rounded-2xl p-4'>
          <p className='text-xs font-black uppercase tracking-widest text-slate-500 mb-3'>
            Renewal Urgency
          </p>
          <div className='space-y-2.5'>
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
                label: 'Active & OK',
                count: urgency.ok,
                color: 'bg-emerald-500',
                text: 'text-emerald-400',
              },
            ].map((row) => (
              <div key={row.label} className='flex items-center gap-3'>
                <div className={`h-3 w-3 rounded-full ${row.color} shrink-0`} />
                <span className='text-xs text-slate-400 flex-1'>
                  {row.label}
                </span>
                <span className={`text-xs font-bold ${row.text}`}>
                  {row.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className='bg-slate-900/50 border border-slate-800 rounded-2xl p-4 sm:col-span-2'>
          <p className='text-xs font-black uppercase tracking-widest text-slate-500 mb-3'>
            Coverage Summary by Type
          </p>
          <div className='space-y-2'>
            {byType.map((t) => (
              <div
                key={t.type}
                className={`flex items-center justify-between p-2.5 rounded-lg border ${t.bg}`}
              >
                <div className='flex items-center gap-2'>
                  <span>{t.icon}</span>
                  <div>
                    <p className={`text-xs font-bold ${t.color}`}>{t.label}</p>
                    <p className='text-[10px] text-slate-500'>
                      {t.count} {t.count === 1 ? 'policy' : 'policies'} •
                      Annual: {formatCurrency(t.premium)}
                    </p>
                  </div>
                </div>
                <p className='text-sm font-bold text-slate-200'>
                  {formatCurrency(t.coverage)}
                </p>
              </div>
            ))}
            <div className='flex items-center justify-between px-2.5 pt-2 border-t border-slate-700'>
              <p className='text-xs font-bold text-slate-400'>Total Coverage</p>
              <p className='text-sm font-bold text-emerald-400'>
                {formatCurrency(totalCoverage)}
              </p>
            </div>
            <div className='flex items-center justify-between px-2.5'>
              <p className='text-xs font-bold text-slate-400'>
                Total Annual Premium
              </p>
              <p className='text-sm font-bold text-emerald-400'>
                {formatCurrency(totalPremium)}
              </p>
            </div>
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
      await deletePolicy(deletingPolicy.id);
      setDeleteModalOpen(false);
      setDeletingPolicy(null);
      toast.success(`"${deletingPolicy.policyName}" deleted`);
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── Record a payment: save to Firestore + advance renewal date ─────────
  const handleAddPayment = async (
    policyId: string,
    amount: number,
    paidAt: string,
    note: string,
  ) => {
    // 1. Save payment to Firestore
    await addPaymentStore({ policyId, amount, paidAt, note });

    // 2. Advance the policy's renewalDate by one period
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

    toast.success('Payment recorded! Renewal date updated.');
  };

  const handleDeletePayment = async (id: string) => {
    await deletePaymentStore(id);
    toast.success('Payment removed.');
  };

  return (
    <div className='space-y-5 pb-20 animate-in fade-in duration-500'>
      {/* Page header */}
      <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-transparent p-5 border border-blue-500/20'>
        <div>
          <h1 className='text-2xl font-bold text-slate-100 flex items-center gap-2'>
            <FiShield className='text-blue-400' /> Insurance & Protection
          </h1>
          <p className='text-slate-400 text-sm mt-1'>
            Track life, health, vehicle and property coverage.
          </p>
        </div>
        <div className='flex gap-2'>
          <button
            onClick={() => setModalMode('create')}
            className='inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-lg shadow-emerald-500/20'
          >
            <FiPlus className='h-4 w-4' /> Add Policy
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className='flex gap-1 bg-slate-900/50 border border-slate-800 rounded-xl p-1 w-fit overflow-x-auto'>
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${
              activeTab === tab
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className='animate-in fade-in duration-300'>
        {activeTab === 'Overview' && <OverviewTab policies={policies} />}
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

      {/* Delete confirm */}
      <Modal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title='Delete Policy'
      >
        <div className='space-y-5'>
          <p className='text-sm text-slate-400'>
            Delete{' '}
            <strong className='text-slate-200'>
              {deletingPolicy?.policyName}
            </strong>
            ? All payment records for this policy will remain but will show as
            "Unknown Policy".
          </p>
          <div className='flex justify-end gap-3 border-t border-slate-800 pt-4'>
            <button
              onClick={() => setDeleteModalOpen(false)}
              className='px-5 py-2.5 rounded-xl text-sm font-bold text-slate-400 hover:bg-slate-800'
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteConfirm}
              disabled={deleteLoading}
              className='px-5 py-2.5 rounded-xl text-sm font-bold bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-60'
            >
              {deleteLoading ? 'Deleting…' : 'Delete Policy'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
