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
      <div className="grid min-h-full place-items-center bg-slate-50 text-slate-700">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
          Loading your portfolio…
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

