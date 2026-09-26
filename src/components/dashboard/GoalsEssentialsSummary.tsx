// src/components/dashboard/GoalsEssentialsSummary.tsx
//
// Two panels on the shared shell: goal progress (canonical effectiveGoalCurrent,
// so linked investments count) and Protection & Essentials (emergency fund +
// insurance coverage). Details live in the Essentials / Insurance modules.

import {
  FiActivity,
  FiHeart,
  FiShield,
  FiTarget,
  FiUmbrella,
} from 'react-icons/fi';

import { formatCurrency } from '../../utils/format';
import { effectiveGoalCurrent } from '../../utils/goalLinks';
import { useNavigate } from 'react-router-dom';
import { usePortfolioStore } from '../../store/portfolioStore';
import { ACCENT, CardGo, DashboardCard } from './DashboardCard';

export function GoalsEssentialsSummary() {
  const goals = usePortfolioStore((s) => s.goals);
  const investments = usePortfolioStore((s) => s.investments);
  const essentials = usePortfolioStore((s) => s.essentials);
  const insurancePolicies = usePortfolioStore((s) => s.insurancePolicies) || [];
  const navigate = useNavigate();

  const totalLifeCover = insurancePolicies
    .filter((p) => p.type === 'life')
    .reduce((sum, p) => sum + p.coverageAmount, 0);
  const totalHealthCover = insurancePolicies
    .filter((p) => p.type === 'health')
    .reduce((sum, p) => sum + p.coverageAmount, 0);

  const efTarget = essentials?.emergencyFundTarget || 0;
  const efCurrent = essentials?.emergencyFundCurrent || 0;
  const efProgress = efTarget > 0 ? Math.min((efCurrent / efTarget) * 100, 100) : 0;

  return (
    <div className='grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-2'>
      {/* ── Financial Goals ── */}
      <DashboardCard
        icon={<FiTarget className='h-5 w-5' />}
        accent={ACCENT.emerald}
        title='Financial Goals'
        subtitle='Progress toward your targets'
        action={<CardGo to='/essentials?tab=goals' />}
      >
        {goals.length === 0 ? (
          <div className='flex h-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 py-8 text-center dark:border-slate-700'>
            <FiTarget className='h-6 w-6 text-slate-300 dark:text-slate-600' />
            <p className='text-sm text-slate-500 dark:text-slate-400'>No goals set yet.</p>
            <button
              onClick={() => navigate('/essentials?tab=goals')}
              className='text-xs font-bold text-emerald-500 hover:text-emerald-400'
            >
              Set your first goal →
            </button>
          </div>
        ) : (
          <div className='space-y-4'>
            {goals.slice(0, 4).map((goal) => {
              const cur = effectiveGoalCurrent(goal, investments);
              const progress =
                goal.targetAmount > 0 ? Math.min((cur / goal.targetAmount) * 100, 100) : 0;
              const isComplete = progress >= 100;
              return (
                <div key={goal.id}>
                  <div className='mb-1.5 flex items-center justify-between gap-2 text-sm'>
                    <span className='truncate font-semibold text-slate-700 dark:text-slate-200'>
                      {goal.name}
                    </span>
                    <div className='flex shrink-0 items-center gap-2'>
                      <span className='text-xs tabular-nums text-slate-500 dark:text-slate-400'>
                        {formatCurrency(cur)} / {formatCurrency(goal.targetAmount)}
                      </span>
                      {isComplete && (
                        <span className='rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400'>
                          Done
                        </span>
                      )}
                    </div>
                  </div>
                  <div className='h-2 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800'>
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${isComplete ? 'bg-emerald-400' : 'bg-emerald-500'}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className='mt-1 text-right'>
                    <span className={`text-[10px] font-bold ${isComplete ? 'text-emerald-500' : 'text-slate-400'}`}>
                      {progress.toFixed(0)}%
                    </span>
                  </div>
                </div>
              );
            })}
            {goals.length > 4 && (
              <button
                onClick={() => navigate('/essentials?tab=goals')}
                className='w-full pt-1 text-center text-xs font-bold text-slate-400 hover:text-emerald-500'
              >
                +{goals.length - 4} more goals →
              </button>
            )}
          </div>
        )}
      </DashboardCard>

      {/* ── Protection & Essentials ── */}
      <DashboardCard
        icon={<FiShield className='h-5 w-5' />}
        accent={ACCENT.violet}
        title='Protection & Essentials'
        subtitle='Emergency fund & insurance cover'
        action={<CardGo to='/essentials' />}
      >
        <div className='space-y-4'>
          {/* Emergency Fund */}
          <div className='rounded-2xl bg-slate-50/80 p-4 dark:bg-slate-800/40'>
            <div className='mb-2 flex items-center justify-between text-sm'>
              <span className='flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200'>
                <FiActivity className='h-4 w-4 text-blue-500' /> Emergency Fund
              </span>
              <span className='text-xs tabular-nums text-slate-500 dark:text-slate-400'>
                {formatCurrency(efCurrent)} / {formatCurrency(efTarget || 0)}
              </span>
            </div>
            <div className='h-2 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-700'>
              <div
                className='h-full rounded-full bg-blue-500 transition-all duration-700'
                style={{ width: `${efProgress}%` }}
              />
            </div>
            {efTarget === 0 && (
              <button
                onClick={() => navigate('/essentials')}
                className='mt-2 text-[11px] font-bold text-blue-500 hover:text-blue-400'
              >
                Set a target in Essentials →
              </button>
            )}
          </div>

          {/* Coverage tiles */}
          <div className='grid grid-cols-2 gap-3'>
            <button
              type='button'
              onClick={() => navigate('/insurance')}
              className='group flex flex-col gap-2 rounded-2xl bg-slate-50/80 p-4 text-left transition-colors hover:bg-slate-100/80 dark:bg-slate-800/40 dark:hover:bg-slate-800/70'
            >
              <span className='flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500'>
                <FiUmbrella size={16} />
              </span>
              <span>
                <span className='block text-[11px] font-semibold text-slate-500 dark:text-slate-400'>
                  Life Cover
                </span>
                <span className='block text-sm font-black text-slate-800 dark:text-slate-100'>
                  {totalLifeCover > 0 ? formatCurrency(totalLifeCover) : '₹0'}
                </span>
              </span>
            </button>
            <button
              type='button'
              onClick={() => navigate('/insurance')}
              className='group flex flex-col gap-2 rounded-2xl bg-slate-50/80 p-4 text-left transition-colors hover:bg-slate-100/80 dark:bg-slate-800/40 dark:hover:bg-slate-800/70'
            >
              <span className='flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500'>
                <FiHeart size={16} />
              </span>
              <span>
                <span className='block text-[11px] font-semibold text-slate-500 dark:text-slate-400'>
                  Health Cover
                </span>
                <span className='block text-sm font-black text-slate-800 dark:text-slate-100'>
                  {totalHealthCover > 0 ? formatCurrency(totalHealthCover) : '₹0'}
                </span>
              </span>
            </button>
          </div>
        </div>
      </DashboardCard>
    </div>
  );
}
