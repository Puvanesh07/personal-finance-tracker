// src/pages/Dashboard/DashboardPage.tsx
import { SummaryCards } from '../../components/dashboard/SummaryCards'
import { AllocationCharts } from '../../components/dashboard/AllocationCharts'
import { GrowthChart } from '../../components/dashboard/GrowthChart'
import { MaturityTimeline } from '../../components/dashboard/MaturityTimeline'
import { SectorAllocationChart } from '../../components/dashboard/SectorAllocationChart'
import { MarketCapAllocationChart } from '../../components/dashboard/MarketCapAllocationChart'
import { GoalsEssentialsSummary } from '../../components/dashboard/GoalsEssentialsSummary'
import { FiHome } from 'react-icons/fi'

export function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FiHome className="h-6 w-6 text-emerald-500" />
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Dashboard</h1>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Your unified portfolio overview.
          </p>
        </div>
      </header>

      <SummaryCards />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AllocationCharts />
        <MaturityTimeline />
      </div>

      <GoalsEssentialsSummary />

      {/* Sector + Market Cap side by side on large screens */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectorAllocationChart />
        <MarketCapAllocationChart />
      </div>

      <GrowthChart />
    </div>
  )
}