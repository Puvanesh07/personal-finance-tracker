// src/components/dashboard/InsightsCard.tsx
//
// Renders the application's single source-of-truth proactive insights
// (useProactiveInsights) on the shared card shell. Replaces the old hand-rolled
// dashboard insights that used incorrect allocation math and routed the
// emergency-fund tip to /settings. Updates instantly as data changes.

import { FiArrowUpRight, FiZap } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

import {
  useProactiveInsights,
  type InsightSeverity,
} from '../../hooks/useProactiveInsights';
import { ACCENT, CardGo, DashboardCard } from './DashboardCard';

const SEVERITY_CLS: Record<InsightSeverity, string> = {
  danger: 'border-rose-500/25 bg-rose-500/5 hover:bg-rose-500/10 dark:bg-rose-500/10',
  warning: 'border-amber-500/25 bg-amber-500/5 hover:bg-amber-500/10 dark:bg-amber-500/10',
  good: 'border-emerald-500/25 bg-emerald-500/5 hover:bg-emerald-500/10 dark:bg-emerald-500/10',
  info: 'border-slate-200/70 bg-slate-500/5 hover:bg-slate-500/10 dark:border-slate-700/60 dark:bg-slate-800/40',
};

const SEVERITY_TEXT: Record<InsightSeverity, { title: string; body: string }> = {
  danger: { title: 'text-rose-700 dark:text-rose-300', body: 'text-rose-600/90 dark:text-rose-400/90' },
  warning: { title: 'text-amber-700 dark:text-amber-300', body: 'text-amber-700/90 dark:text-amber-400/90' },
  good: { title: 'text-emerald-700 dark:text-emerald-300', body: 'text-emerald-700/90 dark:text-emerald-400/90' },
  info: { title: 'text-slate-700 dark:text-slate-200', body: 'text-slate-500 dark:text-slate-400' },
};

export function InsightsCard() {
  const insights = useProactiveInsights();
  const navigate = useNavigate();

  return (
    <DashboardCard
      icon={<FiZap className='h-5 w-5' />}
      accent={ACCENT.amber}
      title='Insights'
      subtitle='What needs your attention'
      action={<CardGo to='/cashflow?tab=insights' label='Full analysis' />}
    >
      {insights.length === 0 ? (
        <div className='flex h-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-200 py-6 text-center dark:border-slate-700'>
          <FiZap className='h-6 w-6 text-slate-300 dark:text-slate-600' />
          <p className='text-xs font-medium text-slate-500 dark:text-slate-400'>
            You're all clear — no insights yet.
          </p>
          <p className='text-[11px] text-slate-400 dark:text-slate-500'>
            Add data and proactive tips will appear here.
          </p>
        </div>
      ) : (
        <div className='flex flex-col gap-1.5'>
          {insights.map((ins) => (
            <button
              key={ins.id}
              type='button'
              onClick={() => ins.linkTo && navigate(ins.linkTo)}
              className={`flex w-full items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors ${SEVERITY_CLS[ins.severity]}`}
            >
              <span className='mt-0.5 shrink-0 text-sm' aria-hidden>{ins.emoji}</span>
              <span className='min-w-0 flex-1'>
                <span className={`block text-[13px] font-bold ${SEVERITY_TEXT[ins.severity].title}`}>
                  {ins.title}
                </span>
                <span className={`mt-0.5 block text-[11px] leading-snug ${SEVERITY_TEXT[ins.severity].body}`}>
                  {ins.body}
                </span>
              </span>
              {ins.linkTo && <FiArrowUpRight className='mt-1 h-3.5 w-3.5 shrink-0 text-slate-400' />}
            </button>
          ))}
        </div>
      )}
    </DashboardCard>
  );
}
