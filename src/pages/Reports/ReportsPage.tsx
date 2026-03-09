import { ReportsOverview } from '../../components/reports/ReportsOverview'

export function ReportsPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold">Reports</h1>
        <p className="text-sm text-slate-600">Breakdowns and exports.</p>
      </header>

      <ReportsOverview />
    </div>
  )
}

