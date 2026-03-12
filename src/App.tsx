// src/App.tsx

import { Navigate, Route, Routes } from 'react-router-dom';

import { AccountsPage } from './pages/Accounts/AccountsPage';
import { AgriculturePage } from './pages/Agriculture/AgriculturePage';
import { AppLayout } from './components/layout/AppLayout';
import { CashflowPage } from './pages/Cashflow/CashflowPage';
import { DashboardPage } from './pages/Dashboard/DashboardPage';
import { GoalsPage } from './pages/Goals/GoalsPage';
import InsightsPage from './pages/Insights/InsightsPage';
import { InvestmentsPage } from './pages/Investments/InvestmentsPage';
import { LiabilitiesPage } from './pages/Liabilities/LiabilitiesPage';
import { ReportsPage } from './pages/Reports/ReportsPage';
import { SettingsPage } from './pages/Settings/SettingsPage';
import { SnapshotsPage } from './pages/Snapshots/SnapshotsPage';
import { Toaster } from 'react-hot-toast';
import { ToolsPage } from './Tools/ToolsPage';

// ✅ Removed: const ready = usePortfolioStore(s => s.ready)
// ✅ Removed: if (!ready) return <Loader />
// Loading is now handled entirely inside AuthWrapper — no double-loader race condition

export default function App() {
  return (
    <>
      <Toaster position='bottom-right' />

      <Routes>
        <Route element={<AppLayout />}>
          <Route path='/' element={<Navigate to='/dashboard' replace />} />
          <Route path='/dashboard' element={<DashboardPage />} />
          <Route path='/investments' element={<InvestmentsPage />} />
          <Route path='/liabilities' element={<LiabilitiesPage />} />
          <Route path='/cashflow' element={<CashflowPage />} />
          <Route path='/accounts' element={<AccountsPage />} />
          <Route path='/goals' element={<GoalsPage />} />
          <Route path='/insights' element={<InsightsPage />} />
          <Route path='/tools' element={<ToolsPage />} />
          <Route path='/snapshots' element={<SnapshotsPage />} />
          <Route path='/reports' element={<ReportsPage />} />
          <Route path='/settings' element={<SettingsPage />} />
          <Route path='/agriculture' element={<AgriculturePage />} />
        </Route>
        <Route path='*' element={<Navigate to='/dashboard' replace />} />
      </Routes>
    </>
  );
}
