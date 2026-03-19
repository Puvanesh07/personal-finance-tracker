// src/pages/Insurance/InsurancePage.tsx
//
// FIXES:
//  1. Replaced window.confirm() with a proper modal popup for delete confirmation
//  2. Added toast notification after successful deletion

import {
  FiCheck,
  FiEdit2,
  FiPlus,
  FiShield,
  FiTrash2,
  FiX,
} from 'react-icons/fi';
import { format, parseISO } from 'date-fns';
import { useEffect, useState } from 'react';

import type { InsurancePolicy } from '../../types/investmentTypes';
import { Modal } from '../../components/ui/Modal';
import { UpsertInsuranceModal } from '../../components/insurance/UpsertInsuranceModal';
import { formatCurrency } from '../../utils/format';
import { usePortfolioStore } from '../../store/portfolioStore';

// ── Toast Component ────────────────────────────────────────────────────────
function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className='fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-bottom-4 fade-in duration-300'>
      <div className='flex items-center gap-3 rounded-2xl bg-slate-800 border border-slate-700 px-5 py-3.5 shadow-2xl shadow-black/40 backdrop-blur-xl'>
        <div className='flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20'>
          <FiCheck className='h-4 w-4 text-emerald-400' />
        </div>
        <p className='text-sm font-semibold text-slate-100'>{message}</p>
        <button
          onClick={onDone}
          className='ml-2 text-slate-500 hover:text-slate-300 transition-colors'
        >
          <FiX className='h-3.5 w-3.5' />
        </button>
      </div>
    </div>
  );
}

// ── Insurance Type Badge ───────────────────────────────────────────────────
const TYPE_COLORS: Record<string, string> = {
  life: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  health: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  vehicle: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  property: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  other: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
};

export function InsurancePage() {
  const policies = usePortfolioStore((s) => s.insurancePolicies) || [];
  const deletePolicy = usePortfolioStore((s) => s.deleteInsurancePolicy);

  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingPolicy, setEditingPolicy] = useState<InsurancePolicy | null>(
    null,
  );

  // ✅ FIX 1: Delete confirmation modal state (replaces window.confirm)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingPolicy, setDeletingPolicy] = useState<InsurancePolicy | null>(
    null,
  );
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ✅ FIX 2: Toast state
  const [toast, setToast] = useState<string | null>(null);

  const totalCoverage = policies.reduce((acc, p) => acc + p.coverageAmount, 0);
  const totalYearlyPremium = policies.reduce((acc, p) => {
    return (
      acc +
      (p.premiumFrequency === 'monthly'
        ? p.premiumAmount * 12
        : p.premiumAmount)
    );
  }, 0);

  const handleEdit = (policy: InsurancePolicy) => {
    setEditingPolicy(policy);
    setModalMode('edit');
  };

  // ✅ FIX: Open modal instead of window.confirm
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
      // ✅ FIX 2: Show toast after deletion
      setToast(`"${deletingPolicy.policyName}" policy deleted`);
    } finally {
      setDeleteLoading(false);
    }
  };

  const isExpiringSoon = (renewalDate: string) => {
    const renewal = new Date(renewalDate);
    const today = new Date();
    const diffDays = Math.ceil(
      (renewal.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );
    return diffDays <= 30 && diffDays >= 0;
  };

  const isExpired = (renewalDate: string) => new Date(renewalDate) < new Date();

  return (
    <div className='space-y-6 pb-20 animate-in fade-in duration-500'>
      {/* Header */}
      <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent p-5 border border-emerald-500/20'>
        <div>
          <h1 className='text-2xl font-bold text-slate-100 flex items-center gap-2'>
            <FiShield className='text-emerald-400' /> Insurance & Protection
          </h1>
          <p className='text-slate-400 text-sm mt-1'>
            Track your life, health, and asset coverage.
          </p>
        </div>
        <button
          onClick={() => setModalMode('create')}
          className='inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-semibold transition-all shadow-lg shadow-emerald-500/20'
        >
          <FiPlus /> Add Policy
        </button>
      </div>

      {/* Summary Cards */}
      <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
        <div className='bg-slate-900/50 border border-slate-800 rounded-2xl p-5'>
          <p className='text-xs font-bold uppercase tracking-wider text-slate-400'>
            Total Coverage
          </p>
          <p className='text-2xl font-bold text-slate-100 mt-2'>
            {formatCurrency(totalCoverage)}
          </p>
        </div>
        <div className='bg-slate-900/50 border border-slate-800 rounded-2xl p-5'>
          <p className='text-xs font-bold uppercase tracking-wider text-slate-400'>
            Yearly Premium
          </p>
          <p className='text-2xl font-bold text-slate-100 mt-2'>
            {formatCurrency(totalYearlyPremium)}
          </p>
        </div>
        <div className='bg-slate-900/50 border border-slate-800 rounded-2xl p-5'>
          <p className='text-xs font-bold uppercase tracking-wider text-slate-400'>
            Active Policies
          </p>
          <p className='text-2xl font-bold text-slate-100 mt-2'>
            {policies.length}
          </p>
        </div>
      </div>

      {/* Policies List */}
      {policies.length === 0 ? (
        <div className='text-center py-16 bg-slate-900/30 rounded-2xl border border-slate-800 border-dashed'>
          <FiShield className='mx-auto h-12 w-12 text-slate-600 mb-4' />
          <h3 className='text-lg font-semibold text-slate-300'>
            No policies yet
          </h3>
          <p className='text-slate-500 text-sm mt-1'>
            Add your first insurance policy to track renewals and coverage.
          </p>
          <button
            onClick={() => setModalMode('create')}
            className='mt-4 inline-flex items-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 px-4 py-2 rounded-xl font-semibold transition-all text-sm'
          >
            <FiPlus className='h-4 w-4' /> Add Policy
          </button>
        </div>
      ) : (
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
          {policies.map((policy) => (
            <div
              key={policy.id}
              className='bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col hover:border-slate-700 transition-all duration-200 hover:shadow-lg hover:shadow-black/20'
            >
              <div className='flex justify-between items-start mb-4'>
                <div>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider border px-2 py-0.5 rounded-md ${TYPE_COLORS[policy.type] ?? TYPE_COLORS.other}`}
                  >
                    {policy.type}
                  </span>
                  <h3 className='text-base font-bold text-slate-100 mt-2 leading-tight'>
                    {policy.policyName}
                  </h3>
                  <p className='text-sm text-slate-400 mt-0.5'>
                    {policy.provider}
                  </p>
                </div>
                <div className='flex gap-2 shrink-0'>
                  <button
                    onClick={() => handleEdit(policy)}
                    className='p-1.5 text-slate-400 hover:text-emerald-400 bg-slate-800 rounded-lg transition-colors'
                    title='Edit policy'
                  >
                    <FiEdit2 size={13} />
                  </button>
                  {/* ✅ FIX: Opens modal instead of window.confirm */}
                  <button
                    onClick={() => handleDeleteClick(policy)}
                    className='p-1.5 text-slate-400 hover:text-red-400 bg-slate-800 rounded-lg transition-colors'
                    title='Delete policy'
                  >
                    <FiTrash2 size={13} />
                  </button>
                </div>
              </div>

              <div className='grid grid-cols-2 gap-y-3 mt-auto pt-4 border-t border-slate-800/60'>
                <div>
                  <p className='text-[10px] text-slate-500 uppercase tracking-wider'>
                    Coverage
                  </p>
                  <p className='text-sm font-semibold text-slate-200 mt-0.5'>
                    {formatCurrency(policy.coverageAmount)}
                  </p>
                </div>
                <div>
                  <p className='text-[10px] text-slate-500 uppercase tracking-wider'>
                    Premium (
                    {policy.premiumFrequency === 'monthly' ? 'Mo' : 'Yr'})
                  </p>
                  <p className='text-sm font-semibold text-slate-200 mt-0.5'>
                    {formatCurrency(policy.premiumAmount)}
                  </p>
                </div>
                {policy.nominee && (
                  <div>
                    <p className='text-[10px] text-slate-500 uppercase tracking-wider'>
                      Nominee
                    </p>
                    <p className='text-sm font-medium text-slate-300 mt-0.5'>
                      {policy.nominee}
                    </p>
                  </div>
                )}
                <div className={policy.nominee ? '' : 'col-span-2'}>
                  <p className='text-[10px] text-slate-500 uppercase tracking-wider'>
                    Next Renewal
                  </p>
                  <p
                    className={`text-sm font-semibold mt-0.5 flex items-center gap-1 ${
                      isExpired(policy.renewalDate)
                        ? 'text-red-400'
                        : isExpiringSoon(policy.renewalDate)
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                    }`}
                  >
                    {isExpired(policy.renewalDate) && '⚠ '}
                    {isExpiringSoon(policy.renewalDate) &&
                      !isExpired(policy.renewalDate) &&
                      '⏰ '}
                    {format(parseISO(policy.renewalDate), 'dd MMM yyyy')}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ✅ FIX 1: Delete Confirmation Modal — replaces window.confirm */}
      <Modal
        open={deleteModalOpen}
        onClose={() => {
          if (!deleteLoading) {
            setDeleteModalOpen(false);
            setDeletingPolicy(null);
          }
        }}
        title='Delete Insurance Policy'
      >
        <div className='space-y-5'>
          <div className='flex items-start gap-4 p-4 rounded-xl bg-red-500/5 border border-red-500/20'>
            <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/10'>
              <FiTrash2 className='h-5 w-5 text-red-400' />
            </div>
            <div>
              <p className='text-sm font-semibold text-slate-100'>
                Are you sure you want to delete this policy?
              </p>
              {deletingPolicy && (
                <p className='text-sm text-slate-400 mt-1'>
                  <span className='font-bold text-slate-200'>
                    {deletingPolicy.policyName}
                  </span>{' '}
                  by {deletingPolicy.provider} — coverage of{' '}
                  <span className='text-slate-200'>
                    {formatCurrency(deletingPolicy.coverageAmount)}
                  </span>
                </p>
              )}
              <p className='text-xs text-red-400/80 mt-2'>
                This action cannot be undone.
              </p>
            </div>
          </div>

          <div className='flex justify-end gap-3 border-t border-slate-800 pt-4'>
            <button
              onClick={() => {
                setDeleteModalOpen(false);
                setDeletingPolicy(null);
              }}
              disabled={deleteLoading}
              className='rounded-xl px-5 py-2.5 text-sm font-bold text-slate-400 hover:bg-slate-800 transition-colors disabled:opacity-50'
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteConfirm}
              disabled={deleteLoading}
              className='rounded-xl bg-red-600 hover:bg-red-700 px-6 py-2.5 text-sm font-bold text-white transition-colors flex items-center gap-2 disabled:opacity-60'
            >
              {deleteLoading ? (
                <>
                  <span className='h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin' />
                  Deleting…
                </>
              ) : (
                <>
                  <FiTrash2 className='h-3.5 w-3.5' />
                  Yes, Delete
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Create / Edit Modals */}
      {modalMode === 'create' && (
        <UpsertInsuranceModal
          open
          onClose={() => setModalMode(null)}
          mode='create'
        />
      )}
      {modalMode === 'edit' && editingPolicy && (
        <UpsertInsuranceModal
          open
          onClose={() => {
            setModalMode(null);
            setEditingPolicy(null);
          }}
          mode='edit'
          entry={editingPolicy}
        />
      )}

      {/* ✅ FIX 2: Toast notification */}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
