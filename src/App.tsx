// src/App.tsx

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
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Suspense, lazy, useEffect, useState } from 'react';

import { AppLayout } from './components/layout/AppLayout';
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

/**
 * Wrapper component to force the specific page skeleton to show
 * EVERY time the user navigates, not just on initial chunk load.
 */
function PageTransition({
  children,
  skeleton,
}: {
  children: React.ReactNode;
  skeleton: React.ReactNode;
}) {
  const [showSkeleton, setShowSkeleton] = useState(true);
  const location = useLocation();

  useEffect(() => {
    // Show skeleton on every route change
    setShowSkeleton(true);
    const timer = setTimeout(() => {
      setShowSkeleton(false);
    }, 1000); // 600ms artificial delay for the skeleton loader

    return () => clearTimeout(timer);
  }, [location.pathname]);

  return showSkeleton ? <>{skeleton}</> : <>{children}</>;
}

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

      {/* Outer Suspense: only on very first load before AppLayout mounts */}
      <Suspense fallback={<Loader />}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path='/' element={<Navigate to='/dashboard' replace />} />

            <Route
              path='/dashboard'
              element={
                <Suspense fallback={<DashboardSkeleton />}>
                  <PageTransition skeleton={<DashboardSkeleton />}>
                    <DashboardPage />
                  </PageTransition>
                </Suspense>
              }
            />

            <Route
              path='/investments'
              element={
                <Suspense fallback={<InvestmentsSkeleton />}>
                  <PageTransition skeleton={<InvestmentsSkeleton />}>
                    <InvestmentsPage />
                  </PageTransition>
                </Suspense>
              }
            />

            <Route
              path='/profits'
              element={
                <Suspense fallback={<ProfitsSkeleton />}>
                  <PageTransition skeleton={<ProfitsSkeleton />}>
                    <ProfitsPage />
                  </PageTransition>
                </Suspense>
              }
            />

            <Route
              path='/liabilities'
              element={
                <Suspense fallback={<LiabilitiesSkeleton />}>
                  <PageTransition skeleton={<LiabilitiesSkeleton />}>
                    <LiabilitiesPage />
                  </PageTransition>
                </Suspense>
              }
            />

            <Route
              path='/cashflow'
              element={
                <Suspense fallback={<CashflowSkeleton />}>
                  <PageTransition skeleton={<CashflowSkeleton />}>
                    <CashflowPage />
                  </PageTransition>
                </Suspense>
              }
            />

            <Route
              path='/accounts'
              element={
                <Suspense fallback={<AccountsSkeleton />}>
                  <PageTransition skeleton={<AccountsSkeleton />}>
                    <AccountsPage />
                  </PageTransition>
                </Suspense>
              }
            />

            <Route
              path='/goals'
              element={
                <Suspense fallback={<GoalsSkeleton />}>
                  <PageTransition skeleton={<GoalsSkeleton />}>
                    <GoalsPage />
                  </PageTransition>
                </Suspense>
              }
            />

            <Route
              path='/insights'
              element={
                <Suspense fallback={<InsightsSkeleton />}>
                  <PageTransition skeleton={<InsightsSkeleton />}>
                    <InsightsPage />
                  </PageTransition>
                </Suspense>
              }
            />

            <Route
              path='/tools'
              element={
                <Suspense fallback={<ToolsSkeleton />}>
                  <PageTransition skeleton={<ToolsSkeleton />}>
                    <ToolsPage />
                  </PageTransition>
                </Suspense>
              }
            />

            <Route
              path='/snapshots'
              element={
                <Suspense fallback={<SnapshotsSkeleton />}>
                  <PageTransition skeleton={<SnapshotsSkeleton />}>
                    <SnapshotsPage />
                  </PageTransition>
                </Suspense>
              }
            />

            <Route
              path='/reports'
              element={
                <Suspense fallback={<ReportsSkeleton />}>
                  <PageTransition skeleton={<ReportsSkeleton />}>
                    <ReportsPage />
                  </PageTransition>
                </Suspense>
              }
            />

            <Route
              path='/settings'
              element={
                <Suspense fallback={<SettingsSkeleton />}>
                  <PageTransition skeleton={<SettingsSkeleton />}>
                    <SettingsPage />
                  </PageTransition>
                </Suspense>
              }
            />

            <Route
              path='/agriculture'
              element={
                <Suspense fallback={<AgricultureSkeleton />}>
                  <PageTransition skeleton={<AgricultureSkeleton />}>
                    <AgriculturePage />
                  </PageTransition>
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
