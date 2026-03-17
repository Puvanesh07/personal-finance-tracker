import { FiEdit2, FiPlus, FiShield, FiTrash2 } from 'react-icons/fi';
import { format, parseISO } from 'date-fns';

import type { InsurancePolicy } from '../../types/investmentTypes';
import { UpsertInsuranceModal } from '../../components/insurance/UpsertInsuranceModal';
import { formatCurrency } from '../../utils/format';
import { usePortfolioStore } from '../../store/portfolioStore';
import { useState } from 'react';

export function InsurancePage() {
  const policies = usePortfolioStore((s) => s.insurancePolicies) || [];
  const deletePolicy = usePortfolioStore((s) => s.deleteInsurancePolicy);

  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingPolicy, setEditingPolicy] = useState<InsurancePolicy | null>(
    null,
  );

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

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this policy?')) {
      await deletePolicy(id);
    }
  };

  return (
    <div className='space-y-6 pb-20 animate-in fade-in duration-500'>
      <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
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
          className='inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl font-semibold transition-all shadow-lg shadow-emerald-500/20'
        >
          <FiPlus /> Add Policy
        </button>
      </div>

      {/* Summary Cards */}
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
        <div className='bg-slate-900/50 border border-slate-800 rounded-2xl p-5'>
          <p className='text-sm font-medium text-slate-400'>Total Coverage</p>
          <p className='text-2xl font-bold text-slate-100 mt-1'>
            {formatCurrency(totalCoverage)}
          </p>
        </div>
        <div className='bg-slate-900/50 border border-slate-800 rounded-2xl p-5'>
          <p className='text-sm font-medium text-slate-400'>
            Total Yearly Premium
          </p>
          <p className='text-2xl font-bold text-slate-100 mt-1'>
            {formatCurrency(totalYearlyPremium)}
          </p>
        </div>
      </div>

      {/* Policies List */}
      {policies.length === 0 ? (
        <div className='text-center py-12 bg-slate-900/30 rounded-2xl border border-slate-800 border-dashed'>
          <FiShield className='mx-auto h-10 w-10 text-slate-600 mb-3' />
          <h3 className='text-lg font-medium text-slate-300'>
            No policies found
          </h3>
          <p className='text-slate-500 text-sm mt-1'>
            Add your first insurance policy to track renewals and coverage.
          </p>
        </div>
      ) : (
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
          {policies.map((policy) => (
            <div
              key={policy.id}
              className='bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col hover:border-slate-700 transition-colors'
            >
              <div className='flex justify-between items-start mb-4'>
                <div>
                  <span className='text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300 px-2 py-1 rounded-md'>
                    {policy.type}
                  </span>
                  <h3 className='text-lg font-bold text-slate-100 mt-2'>
                    {policy.policyName}
                  </h3>
                  <p className='text-sm text-slate-400'>{policy.provider}</p>
                </div>
                <div className='flex gap-2'>
                  <button
                    onClick={() => handleEdit(policy)}
                    className='p-2 text-slate-400 hover:text-emerald-400 bg-slate-800 rounded-lg transition-colors'
                  >
                    <FiEdit2 size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(policy.id)}
                    className='p-2 text-slate-400 hover:text-red-400 bg-slate-800 rounded-lg transition-colors'
                  >
                    <FiTrash2 size={14} />
                  </button>
                </div>
              </div>

              <div className='grid grid-cols-2 gap-y-3 mt-auto pt-4 border-t border-slate-800/60'>
                <div>
                  <p className='text-xs text-slate-500'>Coverage</p>
                  <p className='text-sm font-semibold text-slate-200'>
                    {formatCurrency(policy.coverageAmount)}
                  </p>
                </div>
                <div>
                  <p className='text-xs text-slate-500'>
                    Premium (
                    {policy.premiumFrequency === 'monthly' ? 'Mo' : 'Yr'})
                  </p>
                  <p className='text-sm font-semibold text-slate-200'>
                    {formatCurrency(policy.premiumAmount)}
                  </p>
                </div>
                <div className='col-span-2'>
                  <p className='text-xs text-slate-500'>Next Renewal</p>
                  <p
                    className={`text-sm font-semibold ${new Date(policy.renewalDate) < new Date() ? 'text-red-400' : 'text-emerald-400'}`}
                  >
                    {format(parseISO(policy.renewalDate), 'dd MMM yyyy')}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {modalMode === 'create' && (
        <UpsertInsuranceModal
          open={true}
          onClose={() => setModalMode(null)}
          mode='create'
        />
      )}
      {modalMode === 'edit' && editingPolicy && (
        <UpsertInsuranceModal
          open={true}
          onClose={() => {
            setModalMode(null);
            setEditingPolicy(null);
          }}
          mode='edit'
          entry={editingPolicy}
        />
      )}
    </div>
  );
}
