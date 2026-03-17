import {
  FiActivity,
  FiHeart,
  FiShield,
  FiTarget,
  FiUmbrella,
} from 'react-icons/fi';

import { formatCurrency } from '../../utils/format';
import { usePortfolioStore } from '../../store/portfolioStore';

export function GoalsEssentialsSummary() {
  const goals = usePortfolioStore((s) => s.goals);
  const essentials = usePortfolioStore((s) => s.essentials);

  // 1. Pull the new insurance policies from the store
  const insurancePolicies = usePortfolioStore((s) => s.insurancePolicies) || [];

  // 2. Dynamically calculate total coverage for Life and Health
  const totalLifeCover = insurancePolicies
    .filter((p) => p.type === 'life')
    .reduce((sum, p) => sum + p.coverageAmount, 0);

  const totalHealthCover = insurancePolicies
    .filter((p) => p.type === 'health')
    .reduce((sum, p) => sum + p.coverageAmount, 0);

  // 3. Keep the Emergency Fund logic the same
  const efTarget = essentials?.emergencyFundTarget || 0;
  const efCurrent = essentials?.emergencyFundCurrent || 0;
  const efProgress =
    efTarget > 0 ? Math.min((efCurrent / efTarget) * 100, 100) : 0;

  return (
    <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
      {/* Financial Goals (Left Side) */}
      <div className='rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm'>
        <div className='mb-6 flex items-center justify-between'>
          <h2 className='flex items-center gap-2 text-lg font-bold text-slate-100'>
            <FiTarget className='text-emerald-400' />
            Financial Goals
          </h2>
        </div>

        {goals.length === 0 ? (
          <div className='flex h-32 items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-900/30'>
            <p className='text-sm text-slate-500'>No goals set yet.</p>
          </div>
        ) : (
          <div className='space-y-5'>
            {goals.slice(0, 4).map((goal) => {
              const progress =
                goal.targetAmount > 0
                  ? Math.min(
                      (goal.currentAmount / goal.targetAmount) * 100,
                      100,
                    )
                  : 0;
              return (
                <div key={goal.id}>
                  <div className='mb-2 flex justify-between text-sm'>
                    <span className='font-medium text-slate-300'>
                      {goal.name}
                    </span>
                    <span className='text-slate-400'>
                      {formatCurrency(goal.currentAmount)} /{' '}
                      {formatCurrency(goal.targetAmount)}
                    </span>
                  </div>
                  <div className='h-2 w-full overflow-hidden rounded-full bg-slate-800'>
                    <div
                      className='h-full rounded-full bg-emerald-500 transition-all duration-500'
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Protection & Essentials (Right Side) */}
      <div className='rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm'>
        <div className='mb-6 flex items-center justify-between'>
          <h2 className='flex items-center gap-2 text-lg font-bold text-slate-100'>
            <FiShield className='text-emerald-400' />
            Protection & Essentials
          </h2>
        </div>

        <div className='space-y-6'>
          {/* Emergency Fund Progress */}
          <div>
            <div className='mb-2 flex justify-between text-sm'>
              <span className='flex items-center gap-2 font-medium text-slate-300'>
                <FiActivity className='text-blue-400' /> Emergency Fund
              </span>
              <span className='text-slate-400'>
                {formatCurrency(efCurrent)} / {formatCurrency(efTarget)}
              </span>
            </div>
            <div className='h-2 w-full overflow-hidden rounded-full bg-slate-800'>
              <div
                className='h-full rounded-full bg-blue-500 transition-all duration-500'
                style={{ width: `${efProgress}%` }}
              />
            </div>
          </div>

          {/* Life / Term Insurance */}
          <div className='flex items-center justify-between rounded-xl border border-slate-800/60 bg-slate-800/30 p-4'>
            <div className='flex items-center gap-3'>
              <div className='flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400'>
                <FiUmbrella size={20} />
              </div>
              <div>
                <p className='text-sm font-medium text-slate-300'>
                  Term Insurance
                </p>
                <p className='text-xs text-slate-500'>Total life coverage</p>
              </div>
            </div>
            <div className='text-right'>
              <p className='text-lg font-bold text-slate-100'>
                {totalLifeCover > 0 ? formatCurrency(totalLifeCover) : '₹0'}
              </p>
            </div>
          </div>

          {/* Health Insurance */}
          <div className='flex items-center justify-between rounded-xl border border-slate-800/60 bg-slate-800/30 p-4'>
            <div className='flex items-center gap-3'>
              <div className='flex h-10 w-10 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400'>
                <FiHeart size={20} />
              </div>
              <div>
                <p className='text-sm font-medium text-slate-300'>
                  Health Insurance
                </p>
                <p className='text-xs text-slate-500'>Total medical coverage</p>
              </div>
            </div>
            <div className='text-right'>
              <p className='text-lg font-bold text-slate-100'>
                {totalHealthCover > 0 ? formatCurrency(totalHealthCover) : '₹0'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
