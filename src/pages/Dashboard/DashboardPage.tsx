// src/pages/Dashboard/DashboardPage.tsx
import {
  FiActivity,
  FiHome,
  FiLayers,
  FiPieChart,
  FiTarget,
  FiTrendingDown,
  FiTrendingUp,
} from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

import { AllocationCharts }               from '../../components/dashboard/AllocationCharts';
import { DashboardAccountsSummary }       from '../../components/dashboard/DashboardAccountsSummary';
import { DashboardCashflowSummary }       from '../../components/dashboard/DashboardCashflowSummary';
import { DashboardInsuranceSummary }      from '../../components/dashboard/DashboardInsuranceSummary';
import { DashboardLiabilitiesSummary }    from '../../components/dashboard/DashboardLiabilitiesSummary';
import { DashboardPaymentsSummary }       from '../../components/dashboard/DashboardPaymentsSummary';
import { DashboardReceivablesSummary }    from '../../components/dashboard/DashboardReceivablesSummary';
import { DashboardSIPSummary }            from '../../components/dashboard/DashboardSIPSummary';
import { DashboardSkeleton }              from '../../components/loader/skeletons';
import { DashboardSubscriptionBanner }    from '../../components/dashboard/DashboardSubscriptionBanner';
import { DashboardTopHoldingsInsights }   from '../../components/dashboard/DashboardTopHoldingsInsights';
import { GoalsEssentialsSummary }         from '../../components/dashboard/GoalsEssentialsSummary';
import { GrowthChart }                    from '../../components/dashboard/GrowthChart';
import { MarketCapAllocationChart }       from '../../components/dashboard/MarketCapAllocationChart';
import { MaturityTimeline }               from '../../components/dashboard/MaturityTimeline';
import { SummaryCards }                   from '../../components/dashboard/SummaryCards';
import { usePortfolioStore }              from '../../store/portfolioStore';
import { FeatureInfo } from '../../components/ui/FeatureInfo';

const QUICK_ACTIONS = [
  { label: 'Add Investment',  icon: FiTrendingUp,   path: '/wealth?tab=assets',     color: 'emerald' },
  { label: 'Log Cashflow',    icon: FiActivity,     path: '/cashflow',              color: 'purple'  },
  { label: 'Set Goal',        icon: FiTarget,       path: '/essentials?tab=goals',  color: 'amber'   },
  { label: 'Add Liability',   icon: FiTrendingDown, path: '/wealth?tab=liabilities', color: 'rose'   },
  { label: 'Money Owed',      icon: FiTrendingUp,   path: '/wealth?tab=liabilities&section=pending_payments', color: 'indigo' },
  { label: 'SIP Plan',        icon: FiLayers,       path: '/wealth?tab=allocation&sub=sip', color: 'teal' },
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

      {/* ── 4 · Net Worth KPI cards ── */}
      <section>
        <SummaryCards />
      </section>

      {/* ── 5 · Portfolio Insights deep dive ── */}
      <section className='rounded-3xl border border-slate-200/70 bg-gradient-to-br from-slate-50 to-white p-4 shadow-lg md:p-6 dark:border-slate-800/60 dark:from-slate-900/60 dark:to-slate-900/20'>
        <div className='mb-4 flex items-center gap-2.5'>
          <div className='flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500'>
            <FiPieChart className='h-5 w-5' />
          </div>
          <div>
            <h2 className='text-base font-bold tracking-tight text-slate-900 md:text-lg dark:text-white'>
              Portfolio Insights
            </h2>
            <p className='text-[11px] font-medium text-slate-500 md:text-xs dark:text-slate-400'>
              Top holdings, allocation and smart recommendations at a glance
            </p>
          </div>
        </div>
        <div className='flex flex-col gap-4 md:gap-5'>
          {/* Top holdings + insights (side by side) */}
          <DashboardTopHoldingsInsights />
          {/* Allocation donut · market-cap split · compact maturity timeline */}
          <div className='grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-3'>
            <AllocationCharts />
            <MarketCapAllocationChart />
            <MaturityTimeline />
          </div>
        </div>
      </section>

      {/* ── 6 · Activity & Accounts ── */}
      <section>
        <SectionHeading icon={FiActivity} label='Activity & Accounts' />
        <div className='grid grid-cols-1 gap-4 md:gap-5 sm:grid-cols-2 xl:grid-cols-4'>
          <DashboardAccountsSummary />
          <DashboardCashflowSummary />
          <DashboardPaymentsSummary />
          <DashboardInsuranceSummary />
        </div>
      </section>

      {/* ── 7 · Borrow, Lend & Planning ── */}
      <section>
        <SectionHeading icon={FiTrendingDown} label='Borrow, Lend & Planning' />
        <div className='grid grid-cols-1 gap-4 md:gap-5 sm:grid-cols-2 xl:grid-cols-3'>
          <DashboardLiabilitiesSummary />
          <DashboardReceivablesSummary />
          <DashboardSIPSummary />
        </div>
      </section>

      {/* ── 8 · Goals + emergency fund ── */}
      <section>
        <GoalsEssentialsSummary />
      </section>

      {/* ── 9 · Net-worth growth trend ── */}
      <section className='pt-1'>
        <GrowthChart />
      </section>

    </div>
  );
}
