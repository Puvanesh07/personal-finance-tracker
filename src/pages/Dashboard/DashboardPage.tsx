// src/pages/Dashboard/DashboardPage.tsx
//
// UPDATED: Added Top Holdings + Insights section (like FinBoom)
//          between the summary cards and the quick account/cashflow overviews

import { FiHome, FiPieChart } from 'react-icons/fi';

import { AllocationCharts } from '../../components/dashboard/AllocationCharts';
import { DashboardAccountsSummary } from '../../components/dashboard/DashboardAccountsSummary';
import { DashboardAgriSummary } from '../../components/dashboard/DashboardAgriSummary';
import { DashboardCashflowSummary } from '../../components/dashboard/DashboardCashflowSummary';
import { DashboardSkeleton } from '../../components/loader/skeletons';
import { DashboardTopHoldingsInsights } from '../../components/dashboard/DashboardTopHoldingsInsights';
import { GoalsEssentialsSummary } from '../../components/dashboard/GoalsEssentialsSummary';
import { GrowthChart } from '../../components/dashboard/GrowthChart';
import { MarketCapAllocationChart } from '../../components/dashboard/MarketCapAllocationChart';
import { MaturityTimeline } from '../../components/dashboard/MaturityTimeline';
import { SectorAllocationChart } from '../../components/dashboard/SectorAllocationChart';
import { SummaryCards } from '../../components/dashboard/SummaryCards';
import { usePortfolioStore } from '../../store/portfolioStore';

export function DashboardPage() {
  const ready = usePortfolioStore((s) => s.ready);
  if (!ready) return <DashboardSkeleton />;

  return (
    <div className='flex flex-col gap-4 md:gap-8 pb-10'>
      {/* Header Banner */}
      <header className='flex flex-col gap-2 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent p-4 md:p-6 border border-emerald-500/20 shadow-sm'>
        <div className='flex items-center gap-3 md:gap-4'>
          <div className='flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-500/20'>
            <FiHome className='h-5 w-5 md:h-6 md:w-6' />
          </div>
          <div>
            <h1 className='text-xl md:text-2xl font-semibold tracking-tight text-white leading-tight'>
              Dashboard
            </h1>
            <p className='mt-0.5 text-[11px] md:text-sm font-medium text-slate-400 leading-snug'>
              Unified portfolio overview and health summary.
            </p>
          </div>
        </div>
      </header>

      {/* Main Portfolio Summary Metrics */}
      <section>
        <SummaryCards />
      </section>

      {/* ✅ NEW: Top Holdings + Smart Insights (FinBoom-style) */}
      <section>
        <DashboardTopHoldingsInsights />
      </section>

      {/* Quick Overviews (Accounts, Cashflow, Agri) */}
      <section className='grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-3'>
        <div className='min-w-0'>
          <DashboardAccountsSummary />
        </div>
        <div className='min-w-0'>
          <DashboardCashflowSummary />
        </div>
        <div className='min-w-0'>
          <DashboardAgriSummary />
        </div>
      </section>

      {/* Asset Allocation Section */}
      <section>
        <div className='mb-3 flex items-center gap-2 px-1'>
          <FiPieChart className='h-4 w-4 text-emerald-500' />
          <h2 className='text-sm md:text-lg font-semibold text-slate-100'>
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

      {/* Goals & Insurance Section */}
      <section className='min-w-0'>
        <GoalsEssentialsSummary />
      </section>

      {/* Secondary Analytics Section */}
      <section className='grid grid-cols-1 gap-4 md:gap-6 xl:grid-cols-2'>
        <div className='min-w-0'>
          <SectorAllocationChart />
        </div>
        <div className='min-w-0'>
          <MarketCapAllocationChart />
        </div>
      </section>

      {/* Growth History */}
      <section className='pt-2 min-w-0'>
        <GrowthChart />
      </section>
    </div>
  );
}
