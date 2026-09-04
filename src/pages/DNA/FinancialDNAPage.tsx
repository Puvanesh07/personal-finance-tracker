import { useMemo } from 'react';
import { usePortfolioStore } from '../../store/portfolioStore';
import { computeFinancialDNA } from '../../utils/financialDNA';
import { formatNumber } from '../../utils/format';

const COLOR_CLASSES: Record<string, { bar: string; text: string; bg: string; border: string }> = {
  emerald: { bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-700/40' },
  amber:   { bar: 'bg-amber-500',   text: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-50 dark:bg-amber-900/20',     border: 'border-amber-200 dark:border-amber-700/40' },
  rose:    { bar: 'bg-rose-500',     text: 'text-rose-600 dark:text-rose-400',       bg: 'bg-rose-50 dark:bg-rose-900/20',       border: 'border-rose-200 dark:border-rose-700/40' },
  indigo:  { bar: 'bg-indigo-500',   text: 'text-indigo-600 dark:text-indigo-400',   bg: 'bg-indigo-50 dark:bg-indigo-900/20',   border: 'border-indigo-200 dark:border-indigo-700/40' },
  violet:  { bar: 'bg-violet-500',   text: 'text-violet-600 dark:text-violet-400',   bg: 'bg-violet-50 dark:bg-violet-900/20',   border: 'border-violet-200 dark:border-violet-700/40' },
  sky:     { bar: 'bg-sky-500',      text: 'text-sky-600 dark:text-sky-400',         bg: 'bg-sky-50 dark:bg-sky-900/20',         border: 'border-sky-200 dark:border-sky-700/40' },
  slate:   { bar: 'bg-slate-400',    text: 'text-slate-600 dark:text-slate-400',     bg: 'bg-slate-50 dark:bg-slate-800/40',     border: 'border-slate-200 dark:border-slate-700' },
};

export default function FinancialDNAPage() {
  const { cashflows, investments, liabilities, essentials } = usePortfolioStore();
  const dna = useMemo(
    () => computeFinancialDNA(cashflows, investments, liabilities, essentials),
    [cashflows, investments, liabilities, essentials],
  );

  const noData = !cashflows.length && !investments.length && !liabilities.length;

  return (
    <div className='flex flex-col gap-6 pb-12'>
      {/* Header */}
      <header className='rounded-2xl bg-gradient-to-r from-violet-500/10 via-purple-500/5 to-transparent p-6 border border-violet-500/20'>
        <div className='flex items-center gap-4'>
          <div className='flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 text-white shadow-lg text-2xl'>🧬</div>
          <div>
            <h1 className='text-2xl font-bold text-slate-900 dark:text-white'>Financial DNA</h1>
            <p className='text-sm text-slate-500 dark:text-slate-400 mt-0.5'>Your 5 financial behaviour dimensions based on actual data.</p>
          </div>
        </div>
      </header>

      {noData ? (
        <div className='rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center'>
          <p className='text-2xl mb-2'>🧬</p>
          <p className='text-sm font-semibold text-slate-500 dark:text-slate-400'>Add cashflows, investments and liabilities to unlock your Financial DNA.</p>
        </div>
      ) : (
        <>
          {/* Archetype card */}
          <div className='rounded-2xl border border-violet-200 dark:border-violet-700/50 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/10 p-6'>
            <div className='flex items-center gap-4'>
              <span className='text-4xl'>{dna.overallEmoji}</span>
              <div>
                <p className='text-[10px] font-bold uppercase tracking-widest text-violet-500 dark:text-violet-400 mb-0.5'>Your Archetype</p>
                <h2 className='text-xl font-black text-slate-900 dark:text-white'>{dna.archetype}</h2>
                <p className='text-sm text-slate-600 dark:text-slate-400 mt-0.5'>Overall: <strong className={dna.overallProfile === 'Excellent' ? 'text-emerald-600 dark:text-emerald-400' : dna.overallProfile === 'Good' ? 'text-sky-600 dark:text-sky-400' : 'text-amber-600 dark:text-amber-400'}>{dna.overallProfile}</strong></p>
              </div>
            </div>
            {(dna.strengths.length > 0 || dna.improvements.length > 0) && (
              <div className='grid grid-cols-2 gap-3 mt-4'>
                {dna.strengths.length > 0 && (
                  <div className='rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/40 px-3 py-2'>
                    <p className='text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1'>Strengths</p>
                    {dna.strengths.map(s => <p key={s} className='text-xs text-emerald-700 dark:text-emerald-300'>✓ {s}</p>)}
                  </div>
                )}
                {dna.improvements.length > 0 && (
                  <div className='rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 px-3 py-2'>
                    <p className='text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1'>Improve</p>
                    {dna.improvements.map(s => <p key={s} className='text-xs text-amber-700 dark:text-amber-300'>↑ {s}</p>)}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Dimensions */}
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            {dna.dimensions.map(d => {
              const cc = COLOR_CLASSES[d.color] ?? COLOR_CLASSES.slate;
              return (
                <div key={d.key} className={`rounded-2xl border ${cc.border} ${cc.bg} p-5`}>
                  <div className='flex items-center justify-between mb-3'>
                    <div className='flex items-center gap-2'>
                      <span className='text-xl'>{d.emoji}</span>
                      <div>
                        <p className='text-xs font-bold text-slate-500 dark:text-slate-400'>{d.label}</p>
                        <p className={`text-sm font-black ${cc.text}`}>{d.verdict}</p>
                      </div>
                    </div>
                    <span className={`text-2xl font-black tabular-nums ${cc.text}`}>{formatNumber(d.score, 0)}</span>
                  </div>
                  {/* Score bar */}
                  <div className='h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden mb-3'>
                    <div className={`h-full rounded-full transition-all duration-700 ${cc.bar}`} style={{ width: `${d.score}%` }} />
                  </div>
                  <p className='text-[11px] text-slate-600 dark:text-slate-400 mb-1'>{d.description}</p>
                  <p className={`text-[11px] font-semibold ${cc.text}`}>💡 {d.tip}</p>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
