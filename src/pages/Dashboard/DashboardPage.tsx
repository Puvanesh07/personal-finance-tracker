import { SummaryCards } from '../../components/dashboard/SummaryCards'
import { AllocationCharts } from '../../components/dashboard/AllocationCharts'
import { GrowthChart } from '../../components/dashboard/GrowthChart'
import { MaturityTimeline } from '../../components/dashboard/MaturityTimeline'
import { SectorAllocationChart } from '../../components/dashboard/SectorAllocationChart'
import { GoalsEssentialsSummary } from '../../components/dashboard/GoalsEssentialsSummary'

export function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-slate-600">Your unified portfolio overview.</p>
        </div>
      </header>

      <SummaryCards />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AllocationCharts />
        <MaturityTimeline />
      </div>

      <GoalsEssentialsSummary />

      <SectorAllocationChart />

      <GrowthChart />
    </div>
  )
}

