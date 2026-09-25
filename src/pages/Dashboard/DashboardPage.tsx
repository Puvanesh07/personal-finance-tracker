// src/pages/Dashboard/DashboardPage.tsx
//
// Rebuilt financial dashboard. Every card reads the store reactively and reuses
// the application's source-of-truth calculations (calculateNetWorth,
// getAllocationTotals, computePaymentStats, effectiveGoalCurrent,
// useProactiveInsights) — no duplicated financial logic lives here.
//
// At-a-glance sections only; detail stays in each module. Removed from the old
// dashboard: the duplicated cash-flow card, the standalone insurance card
// (folded into Protection & Essentials + insights), market-cap chart (lives in
// Wealth), maturity timeline, the orphaned AI card, and the buggy hand-rolled
// insights (now the shared proactive insights).

import {
  FiActivity,
  FiBell,
  FiCreditCard,
  FiHome,
  FiLayers,
  FiTarget,
  FiTrendingDown,
  FiTrendingUp,
  FiZap,
} from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

import { AllocationCharts }            from '../../components/dashboard/AllocationCharts';
import { DashboardAccountsSummary }    from '../../components/dashboard/DashboardAccountsSummary';
import { DashboardLiabilitiesSummary } from '../../components/dashboard/DashboardLiabilitiesSummary';
import { DashboardReceivablesSummary } from '../../components/dashboard/DashboardReceivablesSummary';
import { DashboardSIPSummary }         from '../../components/dashboard/DashboardSIPSummary';
import { DashboardSkeleton }           from '../../components/loader/skeletons';
import { DashboardSubscriptionBanner } from '../../components/dashboard/DashboardSubscriptionBanner';
import { GoalsEssentialsSummary }      from '../../components/dashboard/GoalsEssentialsSummary';
import { GrowthChart }                 from '../../components/dashboard/GrowthChart';
import { InsightsCard }                from '../../components/dashboard/InsightsCard';
import { RecentActivityCard }          from '../../components/dashboard/RecentActivityCard';
import { SetupChecklist }              from '../../components/dashboard/SetupChecklist';
import { SummaryCards }                from '../../components/dashboard/SummaryCards';
import { TopHoldingsCard }             from '../../components/dashboard/TopHoldingsCard';
import { UpcomingPaymentsCard }        from '../../components/dashboard/UpcomingPaymentsCard';
import { usePortfolioStore }           from '../../store/portfolioStore';
import { FeatureInfo }                 from '../../components/ui/FeatureInfo';

const QUICK_ACTIONS = [
  { label: 'Investment', icon: FiTrendingUp,   path: '/wealth?tab=assets',            color: 'text-emerald-500' },
  { label: 'Cashflow',   icon: FiActivity,     path: '/cashflow',                     color: 'text-purple-500'  },
  { label: 'Goal',       icon: FiTarget,       path: '/essentials?tab=goals',         color: 'text-amber-500'   },
  { label: 'Liability',  icon: FiTrendingDown, path: '/wealth?tab=liabilities',       color: 'text-rose-500'    },
  { label: 'Reminder',   icon: FiBell,         path: '/payments',                     color: 'text-sky-500'     },
  { label: 'SIP Plan',   icon: FiLayers,       path: '/wealth?tab=allocation&sub=sip', color: 'text-teal-500'   },
] as const;

function SectionHeading({
  icon: Icon,
  label,
  hint,
}: {
  icon: React.ElementType;
  label: string;
  hint?: string;
}) {
  return (
    <div className='mb-3 flex items-center gap-3 px-1'>
      <span className='flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/10 text-violet-500'>
        <Icon className='h-4 w-4' />
      </span>
      <h2 className='text-sm font-bold tracking-tight text-slate-800 md:text-base dark:text-slate-100'>
        {label}
      </h2>
      {hint && (
        <span className='hidden text-xs font-medium text-slate-400 sm:inline dark:text-slate-500'>
          · {hint}
        </span>
      )}
      <span className='ml-1 hidden h-px flex-1 bg-gradient-to-r from-slate-200/80 to-transparent sm:block dark:from-slate-800/80' />
    </div>
  );
}

export function DashboardPage() {
  const ready    = usePortfolioStore((s) => s.ready);
  const navigate = useNavigate();

  if (!ready) return <DashboardSkeleton />;

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className='flex flex-col gap-6 pb-10 md:gap-7'>
      {/* ── Header ── */}
      <header className='flex flex-col gap-4 rounded-3xl border border-violet-500/20 bg-gradient-to-r from-violet-500/10 via-fuchsia-500/5 to-transparent p-4 shadow-sm md:flex-row md:items-center md:justify-between md:p-6'>
        <div className='flex items-center gap-3'>
          <div className='flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-400 to-fuchsia-500 text-white shadow-lg shadow-violet-500/20 md:h-12 md:w-12'>
            <FiHome className='h-5 w-5 md:h-6 md:w-6' />
          </div>
          <div>
            <h1 className='flex items-center gap-2 text-xl font-bold leading-tight tracking-tight text-slate-900 md:text-2xl dark:text-white'>
              Dashboard
              <FeatureInfo feature='dashboard' />
            </h1>
            <p className='mt-0.5 text-[11px] font-medium text-slate-500 md:text-sm dark:text-slate-400'>
              {today} · your money at a glance
            </p>
          </div>
        </div>

        {/* Quick actions */}
        <div className='grid grid-cols-3 gap-2 sm:grid-cols-6 md:flex md:flex-wrap md:justify-end'>
          {QUICK_ACTIONS.map((a) => (
            <button
              key={a.path}
              type='button'
              onClick={() => navigate(a.path)}
              className='flex flex-col items-center gap-1 rounded-xl border border-slate-200/70 bg-white/80 px-2.5 py-2 text-[10px] font-semibold text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-500/30 hover:shadow-md sm:flex-row sm:text-xs dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-300 md:min-w-[7rem]'
            >
              <a.icon className={`h-4 w-4 shrink-0 ${a.color}`} />
              <span className='leading-tight'>{a.label}</span>
            </button>
          ))}
        </div>
      </header>

      {/* ── Subscription banner ── */}
      <DashboardSubscriptionBanner />

      {/* ── First-run checklist (hidden once basics exist) ── */}
      <SetupChecklist />

      {/* ── Net-worth KPI hero ── */}
      <SummaryCards />

      {/* ── Overview: insights + upcoming payments ── */}
      <section>
        <SectionHeading icon={FiZap} label='Overview' hint='what needs your attention' />
        <div className='grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-3'>
          <div className='xl:col-span-2'>
            <InsightsCard />
          </div>
          <UpcomingPaymentsCard />
        </div>
      </section>

      {/* ── Investments ── */}
      <section>
        <SectionHeading icon={FiTrendingUp} label='Investments' hint='holdings and allocation' />
        <div className='grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-3'>
          <div className='xl:col-span-2'>
            <TopHoldingsCard />
          </div>
          <AllocationCharts />
        </div>
      </section>

      {/* ── Cash & growth trend ── */}
      <section>
        <SectionHeading icon={FiCreditCard} label='Cash & Progress' hint='balances and net-worth trend' />
        <div className='grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-3'>
          <DashboardAccountsSummary />
          <div className='xl:col-span-2'>
            <GrowthChart />
          </div>
        </div>
      </section>

      {/* ── Goals & protection ── */}
      <section>
        <SectionHeading icon={FiTarget} label='Goals & Protection' hint='targets, emergency fund and cover' />
        <GoalsEssentialsSummary />
      </section>

      {/* ── Borrowing, lending & SIP ── */}
      <section>
        <SectionHeading icon={FiTrendingDown} label='Borrowing & Lending' hint='loans, money owed and SIP plan' />
        <div className='grid grid-cols-1 gap-4 md:gap-5 sm:grid-cols-2 xl:grid-cols-3'>
          <DashboardLiabilitiesSummary />
          <DashboardReceivablesSummary />
          <DashboardSIPSummary />
        </div>
      </section>

      {/* ── Recent activity ── */}
      <section>
        <SectionHeading icon={FiActivity} label='Recent Activity' hint='latest money movement' />
        <RecentActivityCard />
      </section>
    </div>
  );
}
