// src/pages/Dashboard/DashboardPage.tsx
import {
  FiActivity,
  FiCamera,
  FiHome,
  FiLayers,
  FiPieChart,
  FiTarget,
  FiTrendingDown,
  FiTrendingUp,
} from 'react-icons/fi';
import { Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';

import { AllocationCharts }               from '../../components/dashboard/AllocationCharts';
import { CashflowForecastCard }           from '../../components/dashboard/CashflowForecastCard';
import { CommandCenter }                  from '../../components/dashboard/CommandCenter';
import { DashboardAccountsSummary }       from '../../components/dashboard/DashboardAccountsSummary';
import { DashboardCashflowSummary }       from '../../components/dashboard/DashboardCashflowSummary';
import { DashboardInsuranceSummary }      from '../../components/dashboard/DashboardInsuranceSummary';
import { DashboardLiabilitiesSummary }    from '../../components/dashboard/DashboardLiabilitiesSummary';
import { DashboardPaymentsSummary }       from '../../components/dashboard/DashboardPaymentsSummary';
import { DashboardSIPSummary }            from '../../components/dashboard/DashboardSIPSummary';
import { DashboardSkeleton }              from '../../components/loader/skeletons';
import { DashboardSubscriptionBanner }    from '../../components/dashboard/DashboardSubscriptionBanner';
import { DashboardTopHoldingsInsights }   from '../../components/dashboard/DashboardTopHoldingsInsights';
import { GoalsEssentialsSummary }         from '../../components/dashboard/GoalsEssentialsSummary';
import { GrowthChart }                    from '../../components/dashboard/GrowthChart';
import { MaturityTimeline }               from '../../components/dashboard/MaturityTimeline';
import { SummaryCards }                   from '../../components/dashboard/SummaryCards';
import { usePortfolioStore }              from '../../store/portfolioStore';
import { FeatureInfo } from '../../components/ui/FeatureInfo';

const MarketCapAllocationChart = lazy(() =>
  import('../../components/dashboard/MarketCapAllocationChart').then((m) => ({
    default: m.MarketCapAllocationChart,
  })),
);

const QUICK_ACTIONS = [
  { label: 'Add Investment',  icon: FiTrendingUp,   path: '/investments',           color: 'emerald' },
  { label: 'Log Cashflow',    icon: FiActivity,     path: '/cashflow',              color: 'purple'  },
  { label: 'Set Goal',        icon: FiTarget,       path: '/goals',                 color: 'amber'   },
  { label: 'Add Liability',   icon: FiTrendingDown, path: '/liabilities',           color: 'rose'    },
  { label: 'SIP Plan',        icon: FiLayers,       path: '/investments?tab=sip-plan', color: 'teal' },
  { label: 'Take Snapshot',   icon: FiCamera,       path: '/snapshots',             color: 'indigo'  },
] as const;

const COLOR_MAP: Record<string, string> = {
  emerald: 'text-emerald-500',
  purple:  'text-purple-500',
  amber:   'text-amber-500',
  rose:    'text-rose-500',
  teal:    'text-teal-500',
  indigo:  'text-indigo-500',
  violet:  'text-violet-500',
};

function SectionFallback() {
  return (
    <div className='h-48 animate-pulse rounded-2xl border border-slate-200/70 bg-slate-100 dark:border-slate-800 dark:bg-slate-900/40' />
  );
}

function SectionHeading({
  icon: Icon,
  label,
}: {
  icon: React.ElementType;
  label: string;
}) {
  return (
    <div className='mb-3 flex items-center gap-2 px-1'>
      <Icon className='h-4 w-4 text-emerald-500' />
      <h2 className='text-sm font-semibold text-slate-900 dark:text-slate-100 md:text-base'>
        {label}
      </h2>
    </div>
  );
}

export function DashboardPage() {
  const ready    = usePortfolioStore((s) => s.ready);
  const navigate = useNavigate();

  if (!ready) return <DashboardSkeleton />;

  return (
    <div className='flex flex-col gap-6 md:gap-8 pb-10'>

      {/* ── Page header ── */}
      <header className='flex flex-col gap-2 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent p-4 md:p-6 border border-emerald-500/20 shadow-sm'>
        <div className='flex items-center gap-3 md:gap-4'>
          <div className='flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-500/20'>
            <FiHome className='h-5 w-5 md:h-6 md:w-6' />
          </div>
          <div>
            <h1 className='text-xl font-semibold leading-tight tracking-tight text-slate-900 md:text-2xl dark:text-white flex items-center gap-2'>
              Dashboard
              <FeatureInfo feature='dashboard' />
            </h1>
            <p className='mt-0.5 text-[11px] md:text-sm font-medium text-slate-500 dark:text-slate-400 leading-snug'>
              Unified portfolio overview and health summary.
            </p>
          </div>
        </div>
      </header>

      {/* ── Subscription banner ── */}
      <DashboardSubscriptionBanner />

      {/* ── Quick actions ── */}
      <section className='grid grid-cols-3 sm:grid-cols-6 gap-2 md:gap-3'>
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.path}
            type='button'
            onClick={() => navigate(action.path)}
            className='flex flex-col sm:flex-row items-center sm:items-center gap-1.5 sm:gap-2 rounded-xl border border-slate-200/70 bg-white px-2 py-2.5 sm:px-3 text-center sm:text-left text-[10px] sm:text-xs font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-500/30 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-200 md:py-3'
          >
            <action.icon className={`h-4 w-4 shrink-0 ${COLOR_MAP[action.color]}`} />
            <span className='leading-tight'>{action.label}</span>
          </button>
        ))}
      </section>

      {/* ── Hero KPI cards ── */}
      <section>
        <SummaryCards />
      </section>

      {/* ── Top holdings + AI insights ── */}
      <section>
        <DashboardTopHoldingsInsights />
      </section>

      {/* ── Row 1: Accounts · Cashflow · Payments · Insurance ── */}
      <section>
        <SectionHeading icon={FiActivity} label='Activity & Accounts' />
        <div className='grid grid-cols-1 gap-4 md:gap-5 sm:grid-cols-2 xl:grid-cols-4'>
          <DashboardAccountsSummary />
          <DashboardCashflowSummary />
          <DashboardPaymentsSummary />
          <DashboardInsuranceSummary />
        </div>
      </section>

      {/* ── Row 2: Liabilities · SIP ── */}
      <section>
        <SectionHeading icon={FiTrendingDown} label='Obligations & Planning' />
        <div className='grid grid-cols-1 gap-4 md:gap-5 sm:grid-cols-2 xl:grid-cols-2'>
          <DashboardLiabilitiesSummary />
          <DashboardSIPSummary />
        </div>
      </section>

      {/* ── Asset allocation + maturity timeline ── */}
      <section>
        <SectionHeading icon={FiPieChart} label='Asset Allocation' />
        <div className='grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-2'>
          <AllocationCharts />
          <MaturityTimeline />
        </div>
      </section>

      {/* ── Goals + emergency fund ── */}
      <section>
        <GoalsEssentialsSummary />
      </section>

      {/* ── Market-cap allocation (lazy) ── */}
      <section>
        <Suspense fallback={<SectionFallback />}>
          <MarketCapAllocationChart />
        </Suspense>
      </section>

      {/* ── Portfolio growth chart ── */}
      <section className='pt-1'>
        <GrowthChart />
      </section>

      {/* ── Cashflow forecast ── */}
      <section>
        <CashflowForecastCard compact />
      </section>

      {/* ── Command center ── */}
      <section>
        <CommandCenter />
      </section>

    </div>
  );
}
