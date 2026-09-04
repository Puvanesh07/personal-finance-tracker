// src/components/dashboard/DashboardSIPSummary.tsx
import { FiArrowUpRight, FiLayers } from 'react-icons/fi';
import { formatINR } from '../../utils/format';
import { useNavigate } from 'react-router-dom';
import { usePortfolioStore } from '../../store/portfolioStore';

export function DashboardSIPSummary() {
  const sipPlans = usePortfolioStore((s) => s.sipPlans) ?? [];
  const navigate = useNavigate();

  const sipBudget      = sipPlans.find((x: any) => x?.type === 'budget');
  const sipInstruments = sipPlans.filter((x: any) => x?.type === 'instrument');
  const monthlyBudget  = sipBudget?.budget || 0;
  const totalAllocPct  = sipInstruments.reduce((s: number, i: any) => s + (i.percentage || 0), 0);
  const unallocatedPct = Math.max(0, 100 - totalAllocPct);
  const overAllocated  = totalAllocPct > 100;

  return (
    <div className='rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-6 shadow-sm flex flex-col h-full'>
      <div className='mb-4 flex items-center justify-between'>
        <h2 className='flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100'>
          <FiLayers className='text-teal-400' />
          SIP Plan
        </h2>
        <button
          onClick={() => navigate('/investments?tab=sip-plan')}
          title='Go to SIP Plan'
          className='flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-teal-400 transition-colors'
        >
          <FiArrowUpRight className='h-4 w-4' />
        </button>
      </div>

      {monthlyBudget === 0 && sipInstruments.length === 0 ? (
        <div className='flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 py-8 text-center'>
          <FiLayers className='h-6 w-6 text-slate-300 dark:text-slate-600' />
          <p className='text-xs text-slate-400 dark:text-slate-500'>No SIP plan set up yet</p>
          <button
            onClick={() => navigate('/investments?tab=sip-plan')}
            className='text-xs font-bold text-teal-400 hover:text-teal-300 transition-colors'
          >
            Set up SIP →
          </button>
        </div>
      ) : (
        <>
          <div className='mb-4'>
            <p className='text-xs font-medium text-slate-500 uppercase tracking-wider'>Monthly Budget</p>
            <p className='text-2xl font-bold text-teal-400 tabular-nums'>{formatINR(monthlyBudget)}</p>
          </div>

          <div className='mt-auto grid grid-cols-2 gap-3 border-t border-slate-200/70 dark:border-slate-800/60 pt-4'>
            <div>
              <p className='text-xs font-medium text-slate-500 mb-1'>Instruments</p>
              <p className='text-sm font-bold text-slate-700 dark:text-slate-200'>{sipInstruments.length}</p>
            </div>
            <div>
              <p className='text-xs font-medium text-slate-500 mb-1'>Allocated</p>
              <p className={`text-sm font-bold tabular-nums ${overAllocated ? 'text-rose-400' : 'text-teal-400'}`}>
                {totalAllocPct.toFixed(0)}%
              </p>
            </div>
            {!overAllocated && unallocatedPct > 0 && (
              <div className='col-span-2'>
                <p className='text-xs font-medium text-amber-500 mb-1'>Unallocated</p>
                <p className='text-sm font-bold text-amber-400'>
                  {unallocatedPct.toFixed(0)}% ({formatINR((unallocatedPct / 100) * monthlyBudget)})
                </p>
              </div>
            )}
            {overAllocated && (
              <div className='col-span-2'>
                <p className='text-xs font-medium text-rose-500 mb-1'>Over-allocated by</p>
                <p className='text-sm font-bold text-rose-400'>{(totalAllocPct - 100).toFixed(0)}%</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
