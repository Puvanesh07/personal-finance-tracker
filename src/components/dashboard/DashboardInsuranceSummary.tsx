// src/components/dashboard/DashboardInsuranceSummary.tsx
import { FiArrowUpRight, FiShield } from 'react-icons/fi';
import { formatINR } from '../../utils/format';
import { useNavigate } from 'react-router-dom';
import { usePortfolioStore } from '../../store/portfolioStore';
import { differenceInDays, parseISO } from 'date-fns';

export function DashboardInsuranceSummary() {
  const insurancePolicies = usePortfolioStore((s) => s.insurancePolicies) ?? [];
  const navigate = useNavigate();

  const today = new Date();

  const totalCoverage = insurancePolicies.reduce((s, p) => s + (p.coverageAmount || 0), 0);
  const totalPremium  = insurancePolicies.reduce((s, p) => s + (p.premiumAmount || 0), 0);

  // Policies renewing within 30 days
  const renewingSoon = insurancePolicies.filter((p) => {
    if (!p.renewalDate) return false;
    try {
      const days = differenceInDays(parseISO(p.renewalDate), today);
      return days >= 0 && days <= 30;
    } catch { return false; }
  });

  const expired = insurancePolicies.filter((p) => {
    if (!p.renewalDate) return false;
    try { return differenceInDays(parseISO(p.renewalDate), today) < 0; }
    catch { return false; }
  });

  return (
    <div className='rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-6 shadow-sm flex flex-col h-full'>
      <div className='mb-4 flex items-center justify-between'>
        <h2 className='flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100'>
          <FiShield className='text-sky-400' />
          Insurance
        </h2>
        <button
          onClick={() => navigate('/insurance')}
          title='Go to Insurance'
          className='flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-sky-400 transition-colors'
        >
          <FiArrowUpRight className='h-4 w-4' />
        </button>
      </div>

      {insurancePolicies.length === 0 ? (
        <div className='flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 py-8 text-center'>
          <FiShield className='h-6 w-6 text-slate-300 dark:text-slate-600' />
          <p className='text-xs text-slate-400 dark:text-slate-500'>No policies added yet</p>
          <button
            onClick={() => navigate('/insurance')}
            className='text-xs font-bold text-sky-400 hover:text-sky-300 transition-colors'
          >
            Add policy →
          </button>
        </div>
      ) : (
        <>
          <div className='mb-4'>
            <p className='text-xs font-medium text-slate-500 uppercase tracking-wider'>Total Coverage</p>
            <p className='text-2xl font-bold text-sky-400 tabular-nums'>{formatINR(totalCoverage)}</p>
          </div>

          <div className='mt-auto grid grid-cols-2 gap-3 border-t border-slate-200/70 dark:border-slate-800/60 pt-4'>
            <div>
              <p className='text-xs font-medium text-slate-500 mb-1'>Policies</p>
              <p className='text-sm font-bold text-slate-700 dark:text-slate-200'>{insurancePolicies.length}</p>
            </div>
            <div>
              <p className='text-xs font-medium text-slate-500 mb-1'>Annual Premium</p>
              <p className='text-sm font-bold text-slate-700 dark:text-slate-200'>{formatINR(totalPremium)}</p>
            </div>
            {renewingSoon.length > 0 && (
              <div className='col-span-2'>
                <p className='text-xs font-medium text-amber-500 mb-1'>Renewing within 30 days</p>
                <p className='text-sm font-bold text-amber-400'>{renewingSoon.length} {renewingSoon.length === 1 ? 'policy' : 'policies'}</p>
              </div>
            )}
            {expired.length > 0 && (
              <div className='col-span-2'>
                <p className='text-xs font-medium text-rose-500 mb-1'>Expired</p>
                <p className='text-sm font-bold text-rose-400'>{expired.length} {expired.length === 1 ? 'policy' : 'policies'}</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
