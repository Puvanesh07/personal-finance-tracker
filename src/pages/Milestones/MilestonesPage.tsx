import { useMemo } from 'react';
import { usePortfolioStore } from '../../store/portfolioStore';
import { computeMilestones } from '../../utils/milestones';
import { formatNumber } from '../../utils/format';

const CAT_COLORS: Record<string, string> = {
  investment: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-700/40',
  networth:   'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700/40',
  savings:    'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-700/40',
  debt:       'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-700/40',
  cashflow:   'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-700/40',
  goal:       'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700/40',
};

export default function MilestonesPage() {
  const { investments, liabilities, cashflows, essentials, accounts } = usePortfolioStore();
  const milestones = useMemo(
    () => computeMilestones(investments, liabilities, cashflows, essentials, accounts),
    [investments, liabilities, cashflows, essentials, accounts],
  );

  const unlocked = milestones.filter(m => m.unlocked);
  const locked   = milestones.filter(m => !m.unlocked);

  return (
    <div className='flex flex-col gap-6 pb-12'>
      {/* Header */}
      <header className='rounded-2xl bg-gradient-to-r from-amber-500/10 via-yellow-500/5 to-transparent p-6 border border-amber-500/20'>
        <div className='flex items-center gap-4'>
          <div className='flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 text-white shadow-lg text-2xl'>🏆</div>
          <div>
            <h1 className='text-2xl font-bold text-slate-900 dark:text-white'>Money Milestones</h1>
            <p className='text-sm text-slate-500 dark:text-slate-400 mt-0.5'>Track your financial achievements. {unlocked.length}/{milestones.length} unlocked.</p>
          </div>
        </div>
      </header>

      {/* Progress summary */}
      <div className='rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4'>
        <div className='flex justify-between text-xs mb-2'>
          <span className='font-bold text-slate-700 dark:text-slate-200'>Overall Progress</span>
          <span className='font-black text-amber-600 dark:text-amber-400'>{unlocked.length} / {milestones.length}</span>
        </div>
        <div className='h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden'>
          <div className='h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all duration-700'
            style={{ width: `${(unlocked.length / milestones.length) * 100}%` }} />
        </div>
      </div>

      {/* Unlocked */}
      {unlocked.length > 0 && (
        <div>
          <p className='text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3'>
            🏆 Achieved ({unlocked.length})
          </p>
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'>
            {unlocked.map(m => (
              <div key={m.id} className={`rounded-2xl border p-4 relative overflow-hidden ${CAT_COLORS[m.category]}`}>
                {/* Celebration glow */}
                <div className='absolute top-0 right-0 w-16 h-16 rounded-full bg-white/20 -translate-y-4 translate-x-4' />
                <div className='flex items-start gap-3'>
                  <span className='text-3xl'>{m.emoji}</span>
                  <div className='min-w-0'>
                    <p className='text-sm font-black text-slate-900 dark:text-slate-100'>{m.title}</p>
                    <p className='text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-0.5'>{m.reward}</p>
                    <p className='text-[11px] text-slate-600 dark:text-slate-400 mt-1'>{m.description}</p>
                  </div>
                </div>
                <div className='mt-3 flex items-center gap-2'>
                  <div className='h-1.5 flex-1 rounded-full bg-white/40 overflow-hidden'>
                    <div className='h-full rounded-full bg-white/90' style={{ width: '100%' }} />
                  </div>
                  <span className='text-[10px] font-bold'>100%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Locked */}
      {locked.length > 0 && (
        <div>
          <p className='text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3'>
            🔒 In Progress ({locked.length})
          </p>
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'>
            {locked.map(m => (
              <div key={m.id} className='rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4 opacity-75'>
                <div className='flex items-start gap-3'>
                  <span className='text-3xl grayscale'>{m.emoji}</span>
                  <div className='min-w-0'>
                    <p className='text-sm font-bold text-slate-700 dark:text-slate-300'>{m.title}</p>
                    <p className='text-[11px] text-slate-500 dark:text-slate-400 mt-1'>{m.description}</p>
                  </div>
                </div>
                {m.progress > 0 && (
                  <div className='mt-3'>
                    <div className='flex justify-between text-[10px] text-slate-400 mb-1'>
                      <span>{m.progressLabel}</span>
                      <span className='font-bold'>{formatNumber(m.progress, 0)}%</span>
                    </div>
                    <div className='h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden'>
                      <div className='h-full rounded-full bg-amber-400 transition-all duration-700' style={{ width: `${m.progress}%` }} />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
