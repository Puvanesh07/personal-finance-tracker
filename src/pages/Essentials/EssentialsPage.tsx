// src/pages/Essentials/EssentialsPage.tsx
//
// Essentials — financial health check, FinBoom-style:
//   • Essentials tab — Financial Profile form (single source of truth) +
//     auto-generated health cards (score, emergency fund, savings rate,
//     term & health insurance, debt ratio).
//   • Goals tab — the full goals manager, whose projections consume the
//     same saved Financial Profile (no second form anywhere).
//
// Replaces the old Settings → Essentials tab (emergency fund config now
// lives inside the Emergency Fund card).

import { FiFlag, FiShield } from 'react-icons/fi';
import { useSearchParams } from 'react-router-dom';

import { EssentialsHealthCards } from '../../components/essentials/EssentialsHealthCards';
import { FinancialProfileCard } from '../../components/essentials/FinancialProfileCard';
import { GoalsPage } from '../Goals/GoalsPage';
import { usePortfolioStore } from '../../store/portfolioStore';
import { GoalsSkeleton } from '../../components/loader/skeletons';

type TabId = 'essentials' | 'goals';

export function EssentialsPage() {
  const ready = usePortfolioStore((s) => s.ready);
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: TabId = searchParams.get('tab') === 'essentials' ? 'essentials' : 'goals';

  const setTab = (next: TabId) => {
    setSearchParams(next === 'essentials' ? { tab: 'essentials' } : {}, { replace: true });
  };

  if (!ready) return <GoalsSkeleton />;

  const tabCls = (id: TabId) =>
    `cursor-pointer border-b-2 px-4 py-2.5 text-sm font-bold transition-colors ${
      tab === id
        ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
        : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
    }`;

  return (
    <div className='flex flex-col gap-6 pb-10 animate-in fade-in duration-500'>
      {/* ── Page header ── */}
      <header className='flex flex-col gap-2'>
        <h1 className='text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white'>
          Goals
        </h1>
        <p className='text-sm font-medium text-slate-600 dark:text-slate-300'>
          Goals &amp; financial health
        </p>
      </header>

      {/* ── Tabs ── */}
      <div className='flex gap-2 border-b border-slate-200 dark:border-slate-800'>
        <button type='button' className={tabCls('goals')} onClick={() => setTab('goals')}>
          <span className='flex items-center gap-2'>
            <FiFlag className='h-4 w-4' /> Goals
          </span>
        </button>
        <button type='button' className={tabCls('essentials')} onClick={() => setTab('essentials')}>
          <span className='flex items-center gap-2'>
            <FiShield className='h-4 w-4' /> Health check
          </span>
        </button>
      </div>

      {tab === 'essentials' ? (
        <>
          <FinancialProfileCard />
          <EssentialsHealthCards />
        </>
      ) : (
        <GoalsPage />
      )}
    </div>
  );
}
