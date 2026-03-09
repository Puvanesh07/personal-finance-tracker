import { Navigate, Route, Routes } from 'react-router-dom'
import { useEffect } from 'react'
import { AppLayout } from './components/layout/AppLayout'
import { DashboardPage } from './pages/Dashboard/DashboardPage'
import { InvestmentsPage } from './pages/Investments/InvestmentsPage'
import { ReportsPage } from './pages/Reports/ReportsPage'
import { SettingsPage } from './pages/Settings/SettingsPage'
import { LiabilitiesPage } from './pages/Liabilities/LiabilitiesPage'
import { CashflowPage } from './pages/Cashflow/CashflowPage'
import { GoalsPage } from './pages/Goals/GoalsPage'
import { SnapshotsPage } from './pages/Snapshots/SnapshotsPage'
import { usePortfolioStore } from './store/portfolioStore'

export default function App() {
  const hydrate = usePortfolioStore((s) => s.hydrate)
  const ready = usePortfolioStore((s) => s.ready)

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  if (!ready) {
    return (
      <div className="grid h-screen w-full place-items-center bg-slate-50 transition-colors duration-500 dark:bg-slate-950">
        <div className="flex animate-pulse items-center gap-4 rounded-2xl border border-slate-200/80 bg-white/80 px-8 py-5 shadow-2xl backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-900/80">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-emerald-500/30 border-t-emerald-500" />
          <span className="text-base font-bold tracking-tight text-slate-800 dark:text-slate-100">
            Loading WealthTrack...
          </span>
        </div>
      </div>
    )
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/investments" element={<InvestmentsPage />} />
        <Route path="/liabilities" element={<LiabilitiesPage />} />
        <Route path="/cashflow" element={<CashflowPage />} />
        <Route path="/goals" element={<GoalsPage />} />
        <Route path="/snapshots" element={<SnapshotsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}