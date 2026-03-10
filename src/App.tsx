// src/App.tsx
import { Navigate, Route, Routes } from 'react-router-dom'
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
import { Loader } from './components/loader/Loader'

export default function App() {
  const ready = usePortfolioStore((s) => s.ready)

  // We removed the useEffect with hydrate() because the 
  // AuthWrapper now handles hydration automatically upon login.

  if (!ready) {
    return (
      <Loader />
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