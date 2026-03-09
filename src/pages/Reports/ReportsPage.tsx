import { ReportsOverview } from '../../components/reports/ReportsOverview'
import { FiBarChart2 } from 'react-icons/fi'

export function ReportsPage() {
  return (
    <div className="flex flex-col gap-6 pb-8">
      {/* Premium Gradient Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent p-6 border border-emerald-500/20 dark:from-emerald-500/20 dark:via-teal-500/10 dark:border-emerald-500/30 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-500/30">
            <FiBarChart2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Reports & Analytics</h1>
            <p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-300">
              Detailed breakdowns, performance summaries, and data exports.
            </p>
          </div>
        </div>
      </header>

      <ReportsOverview />
    </div>
  )
}