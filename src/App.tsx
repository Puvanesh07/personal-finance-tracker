import {
  AccountsSkeleton,
  AgricultureSkeleton,
  CashflowSkeleton,
  DashboardSkeleton,
  GoalsSkeleton,
  InsightsSkeleton,
  InvestmentsSkeleton,
  LiabilitiesSkeleton,
  ProfitsSkeleton,
  ReportsSkeleton,
  SettingsSkeleton,
  SnapshotsSkeleton,
  ToolsSkeleton,
} from './components/loader/skeletons';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Suspense, lazy } from 'react';

import { AppLayout } from './components/layout/AppLayout';
import { InsurancePage } from './pages/Insurance/InsurancePage';
import { Loader } from './components/loader/Loader';
import { Toaster } from 'react-hot-toast';

const DashboardPage = lazy(() =>
  import('./pages/Dashboard/DashboardPage').then((m) => ({
    default: m.DashboardPage,
  })),
);
const InvestmentsPage = lazy(() =>
  import('./pages/Investments/InvestmentsPage').then((m) => ({
    default: m.InvestmentsPage,
  })),
);
const LiabilitiesPage = lazy(() =>
  import('./pages/Liabilities/LiabilitiesPage').then((m) => ({
    default: m.LiabilitiesPage,
  })),
);
const CashflowPage = lazy(() =>
  import('./pages/Cashflow/CashflowPage').then((m) => ({
    default: m.CashflowPage,
  })),
);
const AccountsPage = lazy(() =>
  import('./pages/Accounts/AccountsPage').then((m) => ({
    default: m.AccountsPage,
  })),
);
const GoalsPage = lazy(() =>
  import('./pages/Goals/GoalsPage').then((m) => ({ default: m.GoalsPage })),
);
const InsightsPage = lazy(() => import('./pages/Insights/InsightsPage'));
const ToolsPage = lazy(() =>
  import('./Tools/ToolsPage').then((m) => ({ default: m.ToolsPage })),
);
const SnapshotsPage = lazy(() =>
  import('./pages/Snapshots/SnapshotsPage').then((m) => ({
    default: m.SnapshotsPage,
  })),
);
const ReportsPage = lazy(() =>
  import('./pages/Reports/ReportsPage').then((m) => ({
    default: m.ReportsPage,
  })),
);
const SettingsPage = lazy(() =>
  import('./pages/Settings/SettingsPage').then((m) => ({
    default: m.SettingsPage,
  })),
);
const AgriculturePage = lazy(() =>
  import('./pages/Agriculture/AgriculturePage').then((m) => ({
    default: m.AgriculturePage,
  })),
);
const ProfitsPage = lazy(() =>
  import('./pages/Profits/ProfitsPage').then((m) => ({
    default: m.ProfitsPage,
  })),
);

export default function App() {
  return (
    <>
      <Toaster
        position='bottom-right'
        toastOptions={{
          style: {
            background: '#1e293b',
            color: '#f8fafc',
            border: '1px solid #334155',
          },
        }}
      />
      <Suspense fallback={<Loader />}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path='/' element={<Navigate to='/dashboard' replace />} />
            <Route
              path='/dashboard'
              element={
                <Suspense fallback={<DashboardSkeleton />}>
                  <DashboardPage />
                </Suspense>
              }
            />
            <Route
              path='/investments'
              element={
                <Suspense fallback={<InvestmentsSkeleton />}>
                  <InvestmentsPage />
                </Suspense>
              }
            />
            <Route
              path='/profits'
              element={
                <Suspense fallback={<ProfitsSkeleton />}>
                  <ProfitsPage />
                </Suspense>
              }
            />
            <Route
              path='/liabilities'
              element={
                <Suspense fallback={<LiabilitiesSkeleton />}>
                  <LiabilitiesPage />
                </Suspense>
              }
            />
            <Route
              path='/cashflow'
              element={
                <Suspense fallback={<CashflowSkeleton />}>
                  <CashflowPage />
                </Suspense>
              }
            />
            <Route
              path='/accounts'
              element={
                <Suspense fallback={<AccountsSkeleton />}>
                  <AccountsPage />
                </Suspense>
              }
            />
            <Route path='/insurance' element={<InsurancePage />} />
            <Route
              path='/goals'
              element={
                <Suspense fallback={<GoalsSkeleton />}>
                  <GoalsPage />
                </Suspense>
              }
            />
            <Route
              path='/insights'
              element={
                <Suspense fallback={<InsightsSkeleton />}>
                  <InsightsPage />
                </Suspense>
              }
            />
            <Route
              path='/tools'
              element={
                <Suspense fallback={<ToolsSkeleton />}>
                  <ToolsPage />
                </Suspense>
              }
            />
            <Route
              path='/snapshots'
              element={
                <Suspense fallback={<SnapshotsSkeleton />}>
                  <SnapshotsPage />
                </Suspense>
              }
            />
            <Route
              path='/reports'
              element={
                <Suspense fallback={<ReportsSkeleton />}>
                  <ReportsPage />
                </Suspense>
              }
            />
            <Route
              path='/settings'
              element={
                <Suspense fallback={<SettingsSkeleton />}>
                  <SettingsPage />
                </Suspense>
              }
            />
            <Route
              path='/agriculture'
              element={
                <Suspense fallback={<AgricultureSkeleton />}>
                  <AgriculturePage />
                </Suspense>
              }
            />
          </Route>

          <Route path='*' element={<Navigate to='/dashboard' replace />} />
        </Routes>
      </Suspense>
    </>
  );
}
