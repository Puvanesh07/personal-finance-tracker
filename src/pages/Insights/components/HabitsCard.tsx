import { useFinancialHabits } from '../../../hooks/useFinancialHabits';

export function HabitsCard() {
  const habits = useFinancialHabits();

  const scoreColor =
    habits.totalScore >= 70 ? 'text-emerald-600 dark:text-emerald-400'
    : habits.totalScore >= 40 ? 'text-amber-600 dark:text-amber-400'
    : 'text-rose-600 dark:text-rose-400';

  const scoreLabel =
    habits.totalScore >= 70 ? 'Excellent' : habits.totalScore >= 40 ? 'Good' : 'Building';

  return (
    <div className='rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 overflow-hidden'>
      <div className='px-5 py-4 border-b border-slate-100 dark:border-slate-800'>
        <div className='flex items-center justify-between'>
          <h3 className='text-sm font-bold text-slate-800 dark:text-slate-100'>🏆 Financial Habits</h3>
          <div className='flex items-center gap-2'>
            <span className={`text-lg font-black tabular-nums ${scoreColor}`}>{habits.totalScore}</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
              habits.totalScore >= 70 ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700/40 text-emerald-700 dark:text-emerald-400' :
              habits.totalScore >= 40 ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700/40 text-amber-700 dark:text-amber-400' :
              'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-700/40 text-rose-700 dark:text-rose-400'
            }`}>{scoreLabel}</span>
          </div>
        </div>
        <p className='text-[11px] text-slate-500 dark:text-slate-400 mt-1'>{habits.message}</p>
      </div>

      {/* Score bar */}
      <div className='px-5 pt-3 pb-1'>
        <div className='h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden'>
          <div className={`h-full rounded-full transition-all duration-700 ${
            habits.totalScore >= 70 ? 'bg-emerald-500' : habits.totalScore >= 40 ? 'bg-amber-500' : 'bg-rose-500'
          }`} style={{ width: `${habits.totalScore}%` }} />
        </div>
      </div>

      {/* Streaks */}
      <div className='px-5 py-3 grid grid-cols-1 sm:grid-cols-3 gap-3'>
        {habits.streaks.map((s, i) => (
          <div key={i} className={`rounded-xl border p-3 ${s.active ? 'border-violet-200 dark:border-violet-700/40 bg-violet-50 dark:bg-violet-900/10' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30'}`}>
            <div className='flex items-center gap-2 mb-2'>
              <span className='text-xl'>{s.emoji}</span>
              <p className='text-xs font-bold text-slate-700 dark:text-slate-200'>{s.label}</p>
            </div>
            <div className='flex items-end justify-between'>
              <div>
                <p className={`text-2xl font-black tabular-nums ${s.active ? 'text-violet-600 dark:text-violet-400' : 'text-slate-400'}`}>
                  {s.current}
                </p>
                <p className='text-[10px] text-slate-400'>{s.unit} current</p>
              </div>
              <div className='text-right'>
                <p className='text-sm font-bold text-slate-500 dark:text-slate-400 tabular-nums'>{s.best}</p>
                <p className='text-[10px] text-slate-400'>best</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* This month stats */}
      <div className='grid grid-cols-2 gap-px bg-slate-100 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-800'>
        {[
          { label: 'No-Spend Days', value: `${habits.noSpendDaysThisMonth}d`, sub: 'this month' },
          { label: 'Savings Days',  value: `${habits.savingsDaysThisMonth}d`,  sub: 'this month' },
        ].map(({ label, value, sub }) => (
          <div key={label} className='bg-white dark:bg-slate-900/60 px-4 py-3 text-center'>
            <p className='text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5'>{label}</p>
            <p className='text-base font-black text-violet-600 dark:text-violet-400'>{value}</p>
            <p className='text-[9px] text-slate-400'>{sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
