import { SummaryCards } from '../../components/dashboard/SummaryCards'
import { AllocationCharts } from '../../components/dashboard/AllocationCharts'
import { GrowthChart } from '../../components/dashboard/GrowthChart'
import { MaturityTimeline } from '../../components/dashboard/MaturityTimeline'
import { SectorAllocationChart } from '../../components/dashboard/SectorAllocationChart'
import { MarketCapAllocationChart } from '../../components/dashboard/MarketCapAllocationChart'
import { GoalsEssentialsSummary } from '../../components/dashboard/GoalsEssentialsSummary'
import { FiHome, FiPieChart } from 'react-icons/fi'

export function DashboardPage() {
  return (
    <div className="flex flex-col gap-8 pb-8">
      {/* Header Banner */}
      <header className="flex flex-col gap-2 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent p-6 border border-emerald-500/20 dark:from-emerald-500/20 dark:via-teal-500/10 dark:border-emerald-500/30 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-500/30">
            <FiHome className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Dashboard</h1>
            <p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-300">
              Your unified portfolio overview and financial health summary.
            </p>
          </div>
        </div>
      </header>

      {/* Summary Metrics */}
      <section>
        <SummaryCards />
      </section>

      {/* First Chart Section */}
      <section>
        <div className="mb-4 flex items-center gap-2 px-1">
          <FiPieChart className="h-5 w-5 text-emerald-500" />
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Asset Allocation</h2>
        </div>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <AllocationCharts />
          <MaturityTimeline />
        </div>
      </section>

      {/* Goals Section */}
      <GoalsEssentialsSummary />

      {/* Second Chart Section */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SectorAllocationChart />
        <MarketCapAllocationChart />
      </div>

      {/* Full Width Chart Section */}
      <section className="pt-2">
        <GrowthChart />
      </section>
    </div>
  )
}