// src/components/dashboard/DashboardSIPSummary.tsx
import { FiLayers } from 'react-icons/fi';
import { formatINR } from '../../utils/format';
import { usePortfolioStore } from '../../store/portfolioStore';
import type { SipBudgetPlan, SipInstrumentPlan } from '../../types/investmentTypes';
import { ACCENT, CardGo, DashboardCard } from './DashboardCard';

export function DashboardSIPSummary() {
  const sipPlans = usePortfolioStore((s) => s.sipPlans) ?? [];

  const sipBudget = sipPlans.find((x): x is SipBudgetPlan => x.type === 'budget');
  const sipInstruments = sipPlans.filter((x): x is SipInstrumentPlan => x.type === 'instrument');
  const monthlyBudget = sipBudget?.budget || 0;
  const totalAllocPct = sipInstruments.reduce((s, i) => s + (i.percentage || 0), 0);
  const unallocatedPct = Math.max(0, 100 - totalAllocPct);
  const overAllocated = totalAllocPct > 100;

  return (
    <DashboardCard
      icon={<FiLayers className='h-5 w-5' />}
      accent={ACCENT.teal}
      title='SIP Plan'
      subtitle='Monthly budget & allocation'
      action={<CardGo to='/wealth?tab=allocation&sub=sip' />}
    >
      {monthlyBudget === 0 && sipInstruments.length === 0 ? (
        <div className='flex h-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-200 py-5 text-center dark:border-slate-700'>
          <FiLayers className='h-5 w-5 text-slate-300 dark:text-slate-600' />
          <p className='text-xs text-slate-500 dark:text-slate-400'>No SIP plan set up yet</p>
        </div>
      ) : (
        <>
          <div className='mb-3'>
            <p className='text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500'>
              Monthly Budget
            </p>
            <p className='mt-0.5 text-xl font-black tracking-tight text-teal-600 tabular-nums dark:text-teal-400'>
              {formatINR(monthlyBudget)}
            </p>
          </div>

          <div className='grid grid-cols-2 gap-2'>
            <div className='rounded-xl bg-slate-50/80 px-3 py-2 dark:bg-slate-800/40'>
              <p className='text-[11px] font-medium text-slate-500 dark:text-slate-400'>Instruments</p>
              <p className='mt-0.5 text-sm font-black text-slate-800 dark:text-slate-100'>
                {sipInstruments.length}
              </p>
            </div>
            <div className='rounded-xl bg-slate-50/80 px-3 py-2 dark:bg-slate-800/40'>
              <p className='text-[11px] font-medium text-slate-500 dark:text-slate-400'>Allocated</p>
              <p
                className={`mt-0.5 text-sm font-black tabular-nums ${
                  overAllocated ? 'text-rose-600 dark:text-rose-400' : 'text-teal-600 dark:text-teal-400'
                }`}
              >
                {totalAllocPct.toFixed(0)}%
              </p>
            </div>
          </div>

          {!overAllocated && unallocatedPct > 0 && (
            <p className='mt-3 text-xs font-semibold text-amber-600 dark:text-amber-400'>
              {unallocatedPct.toFixed(0)}% unallocated ({formatINR((unallocatedPct / 100) * monthlyBudget)})
            </p>
          )}
          {overAllocated && (
            <p className='mt-3 text-xs font-semibold text-rose-600 dark:text-rose-400'>
              Over-allocated by {(totalAllocPct - 100).toFixed(0)}%
            </p>
          )}
        </>
      )}
    </DashboardCard>
  );
}
