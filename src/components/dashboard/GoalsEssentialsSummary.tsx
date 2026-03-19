// src/components/dashboard/GoalsEssentialsSummary.tsx
//
// FIX: Added redirect icons on Financial Goals and Protection & Essentials panels

import {
  FiActivity,
  FiArrowUpRight,
  FiHeart,
  FiShield,
  FiTarget,
  FiUmbrella,
} from 'react-icons/fi';

import { formatCurrency } from '../../utils/format';
import { useNavigate } from 'react-router-dom';
import { usePortfolioStore } from '../../store/portfolioStore';

export function GoalsEssentialsSummary() {
  const goals = usePortfolioStore((s) => s.goals);
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
  const efProgress =
    efTarget > 0 ? Math.min((efCurrent / efTarget) * 100, 100) : 0;

  return (
    <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
      {/* ── Financial Goals (Left) ── */}
      <div className='rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm'>
        <div className='mb-5 flex items-center justify-between'>
          <h2 className='flex items-center gap-2 text-lg font-bold text-slate-100'>
            <FiTarget className='text-emerald-400' />
            Financial Goals
          </h2>
          {/* ✅ Redirect icon */}
          <button
            onClick={() => navigate('/goals')}
            title='Go to Goals'
            className='flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-400 hover:bg-slate-800 hover:text-emerald-400 transition-colors group'
          >
            <span className='hidden sm:inline group-hover:text-emerald-400 transition-colors'>
              Manage
            </span>
            <FiArrowUpRight className='h-4 w-4' />
          </button>
        </div>

        {goals.length === 0 ? (
          <div className='flex flex-col h-36 items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-900/30 gap-3'>
            <p className='text-sm text-slate-500'>No goals set yet.</p>
            <button
              onClick={() => navigate('/goals')}
              className='text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors'
            >
              Set your first goal →
            </button>
          </div>
        ) : (
          <div className='space-y-4'>
            {goals.slice(0, 4).map((goal) => {
              const progress =
                goal.targetAmount > 0
                  ? Math.min(
                      (goal.currentAmount / goal.targetAmount) * 100,
                      100,
                    )
                  : 0;
              const isComplete = progress >= 100;
              return (
                <div key={goal.id}>
                  <div className='mb-2 flex justify-between items-center text-sm gap-2'>
                    <span className='font-medium text-slate-300 truncate flex-1'>
                      {goal.name}
                    </span>
                    <div className='flex items-center gap-2 shrink-0'>
                      <span className='text-slate-400 text-xs tabular-nums'>
                        {formatCurrency(goal.currentAmount)} /{' '}
                        {formatCurrency(goal.targetAmount)}
                      </span>
                      {isComplete && (
                        <span className='text-[9px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full'>
                          Done
                        </span>
                      )}
                    </div>
                  </div>
                  <div className='h-2 w-full overflow-hidden rounded-full bg-slate-800'>
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${isComplete ? 'bg-emerald-400' : 'bg-emerald-500'}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className='mt-1 text-right'>
                    <span
                      className={`text-[10px] font-bold ${isComplete ? 'text-emerald-400' : 'text-slate-500'}`}
                    >
                      {progress.toFixed(0)}%
                    </span>
                  </div>
                </div>
              );
            })}
            {goals.length > 4 && (
              <button
                onClick={() => navigate('/goals')}
                className='text-xs font-bold text-slate-500 hover:text-emerald-400 transition-colors w-full text-center pt-1'
              >
                +{goals.length - 4} more goals →
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Protection & Essentials (Right) ── */}
      <div className='rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm'>
        <div className='mb-5 flex items-center justify-between'>
          <h2 className='flex items-center gap-2 text-lg font-bold text-slate-100'>
            <FiShield className='text-emerald-400' />
            Protection & Essentials
          </h2>
          {/* ✅ Redirect icon — goes to Insurance page */}
          <button
            onClick={() => navigate('/insurance')}
            title='Go to Insurance'
            className='flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-400 hover:bg-slate-800 hover:text-emerald-400 transition-colors group'
          >
            <span className='hidden sm:inline group-hover:text-emerald-400 transition-colors'>
              Manage
            </span>
            <FiArrowUpRight className='h-4 w-4' />
          </button>
        </div>

        <div className='space-y-5'>
          {/* Emergency Fund */}
          <div>
            <div className='mb-2 flex justify-between text-sm'>
              <span className='flex items-center gap-2 font-medium text-slate-300'>
                <FiActivity className='text-blue-400' /> Emergency Fund
              </span>
              <span className='text-slate-400 tabular-nums text-xs'>
                {formatCurrency(efCurrent)} / {formatCurrency(efTarget || 0)}
              </span>
            </div>
            <div className='h-2 w-full overflow-hidden rounded-full bg-slate-800'>
              <div
                className='h-full rounded-full bg-blue-500 transition-all duration-700'
                style={{ width: `${efProgress}%` }}
              />
            </div>
            {efTarget === 0 && (
              <button
                onClick={() => navigate('/settings')}
                className='mt-1 text-[11px] font-bold text-slate-500 hover:text-blue-400 transition-colors'
              >
                Set a target in Settings →
              </button>
            )}
          </div>

          {/* Term Insurance — clickable to Insurance page */}
          <button
            type='button'
            onClick={() => navigate('/insurance')}
            className='group w-full flex items-center justify-between rounded-xl border border-slate-800/60 bg-slate-800/30 p-4 hover:border-indigo-500/30 hover:bg-slate-800/50 transition-all text-left'
          >
            <div className='flex items-center gap-3'>
              <div className='flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500/20 transition-colors'>
                <FiUmbrella size={18} />
              </div>
              <div>
                <p className='text-sm font-semibold text-slate-300'>
                  Term Insurance
                </p>
                <p className='text-xs text-slate-500'>Total life coverage</p>
              </div>
            </div>
            <div className='flex items-center gap-2'>
              <p className='text-lg font-bold text-slate-100'>
                {totalLifeCover > 0 ? formatCurrency(totalLifeCover) : '₹0'}
              </p>
              {/* ✅ Direction icon */}
              <FiArrowUpRight className='h-4 w-4 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity' />
            </div>
          </button>

          {/* Health Insurance — clickable to Insurance page */}
          <button
            type='button'
            onClick={() => navigate('/insurance')}
            className='group w-full flex items-center justify-between rounded-xl border border-slate-800/60 bg-slate-800/30 p-4 hover:border-rose-500/30 hover:bg-slate-800/50 transition-all text-left'
          >
            <div className='flex items-center gap-3'>
              <div className='flex h-10 w-10 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400 group-hover:bg-rose-500/20 transition-colors'>
                <FiHeart size={18} />
              </div>
              <div>
                <p className='text-sm font-semibold text-slate-300'>
                  Health Insurance
                </p>
                <p className='text-xs text-slate-500'>Total medical coverage</p>
              </div>
            </div>
            <div className='flex items-center gap-2'>
              <p className='text-lg font-bold text-slate-100'>
                {totalHealthCover > 0 ? formatCurrency(totalHealthCover) : '₹0'}
              </p>
              {/* ✅ Direction icon */}
              <FiArrowUpRight className='h-4 w-4 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity' />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
