// src/pages/Dashboard/DashboardPage.tsx
import { FiHome, FiPieChart, FiPlus, FiActivity, FiTarget } from 'react-icons/fi';
import { Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';

import { AllocationCharts } from '../../components/dashboard/AllocationCharts';
import { DashboardAccountsSummary } from '../../components/dashboard/DashboardAccountsSummary';
import { DashboardCashflowSummary } from '../../components/dashboard/DashboardCashflowSummary';
import { DashboardPaymentsSummary } from '../../components/dashboard/DashboardPaymentsSummary';
import { DashboardSkeleton } from '../../components/loader/skeletons';
import { DashboardSubscriptionBanner } from '../../components/dashboard/DashboardSubscriptionBanner';
import { DashboardTopHoldingsInsights } from '../../components/dashboard/DashboardTopHoldingsInsights';
import { GoalsEssentialsSummary } from '../../components/dashboard/GoalsEssentialsSummary';
import { GrowthChart } from '../../components/dashboard/GrowthChart';
import { MaturityTimeline } from '../../components/dashboard/MaturityTimeline';
import { SummaryCards } from '../../components/dashboard/SummaryCards';
import { CommandCenter } from '../../components/dashboard/CommandCenter';
import { usePortfolioStore } from '../../store/portfolioStore';

const MarketCapAllocationChart = lazy(() =>
  import('../../components/dashboard/MarketCapAllocationChart').then((m) => ({
    default: m.MarketCapAllocationChart,
  })),
);

const QUICK_ACTIONS = [
  { label: 'Add Investment', icon: FiPlus, path: '/investments', color: 'emerald' },
  { label: 'Log Cashflow', icon: FiActivity, path: '/cashflow', color: 'teal' },
  { label: 'Set Goal', icon: FiTarget, path: '/goals', color: 'violet' },
] as const;

function SectionFallback() {
  return (
    <div className='h-48 animate-pulse rounded-2xl border border-slate-200/70 bg-slate-100 dark:border-slate-800 dark:bg-slate-900/40' />
  );
}

export function DashboardPage() {
  const ready = usePortfolioStore((s) => s.ready);
  const navigate = useNavigate();

  if (!ready) return <DashboardSkeleton />;

  return (
    <div className='flex flex-col gap-4 md:gap-8 pb-10'>
      <header className='flex flex-col gap-2 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent p-4 md:p-6 border border-emerald-500/20 shadow-sm'>
        <div className='flex items-center gap-3 md:gap-4'>
          <div className='flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-500/20'>
            <FiHome className='h-5 w-5 md:h-6 md:w-6' />
          </div>
          <div>
            <h1 className='text-xl font-semibold leading-tight tracking-tight text-slate-900 md:text-2xl dark:text-white'>
              Dashboard
            </h1>
            <p className='mt-0.5 text-[11px] md:text-sm font-medium text-slate-500 dark:text-slate-400 leading-snug'>
              Unified portfolio overview and health summary.
            </p>
          </div>
        </div>
      </header>

      <DashboardSubscriptionBanner />

      <section className='grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3'>
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.path}
            type='button'
            onClick={() => navigate(action.path)}
            className='flex items-center gap-2 rounded-xl border border-slate-200/70 bg-white px-3 py-2.5 text-left text-xs font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-500/30 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-200 md:text-sm md:px-4 md:py-3'
          >
            <action.icon className='h-4 w-4 shrink-0 text-emerald-500' />
            {action.label}
          </button>
        ))}
      </section>

      <section>
        <SummaryCards />
      </section>

      <section>
        <DashboardTopHoldingsInsights />
      </section>

      <section className='grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-2 xl:grid-cols-4'>
        <div className='min-w-0'>
          <DashboardAccountsSummary />
        </div>
        <div className='min-w-0'>
          <DashboardCashflowSummary />
        </div>
        <div className='min-w-0'>
          <DashboardPaymentsSummary />
        </div>
      </section>

      <section>
        <div className='mb-3 flex items-center gap-2 px-1'>
          <FiPieChart className='h-4 w-4 text-emerald-500' />
          <h2 className='text-sm md:text-lg font-semibold text-slate-900 dark:text-slate-100'>
            Asset Allocation
          </h2>
        </div>
        <div className='grid grid-cols-1 gap-4 md:gap-6 xl:grid-cols-2'>
          <div className='min-w-0'>
            <AllocationCharts />
          </div>
          <div className='min-w-0'>
            <MaturityTimeline />
          </div>
        </div>
      </section>

      <section className='min-w-0'>
        <GoalsEssentialsSummary />
      </section>

      <section className='min-w-0'>
        <Suspense fallback={<SectionFallback />}>
          <MarketCapAllocationChart />
        </Suspense>
      </section>

      <section className='pt-2 min-w-0'>
        <GrowthChart />
      </section>

      <section className='min-w-0'>
        <CommandCenter />
      </section>
    </div>
  );
}
