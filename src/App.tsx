// src/App.tsx

import {
  AccountsSkeleton,
  AIAgentSkeleton,
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
import { Loader } from './components/loader/Loader';
import { Toaster } from 'react-hot-toast';
import { useThemeStore } from './store/themeStore';

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
const PaymentTrackerPage = lazy(() =>
  import('./pages/Payments/PaymentTrackerPage').then((m) => ({
    default: m.PaymentTrackerPage,
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
const CredentialsPage = lazy(() =>
  import('./pages/Credentials/CredentialsPage').then((m) => ({
    default: m.CredentialsPage,
  })),
); // ← NEW
const InsightsPage = lazy(() => import('./pages/Insights/InsightsPage'));
const AIAgentPage = lazy(() => import('./pages/AIAgent/AIAgentPage'));
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
const ProfitsPage = lazy(() =>
  import('./pages/Profits/ProfitsPage').then((m) => ({
    default: m.ProfitsPage,
  })),
);
const InsurancePage = lazy(() =>
  import('./pages/Insurance/InsurancePage').then((m) => ({
    default: m.InsurancePage,
  })),
);
const PricingPage = lazy(() =>
  import('./components/subscription/PricingPage').then((m) => ({
    default: m.PricingPage,
  })),
);
const PaymentSuccessPage = lazy(() =>
  import('./pages/Subscription/PaymentSuccessPage').then((m) => ({
    default: m.PaymentSuccessPage,
  })),
);
const PaymentFailurePage = lazy(() =>
  import('./pages/Subscription/PaymentFailurePage').then((m) => ({
    default: m.PaymentFailurePage,
  })),
);
const PrivacyPolicyPage = lazy(() =>
  import('./pages/Legal/PrivacyPolicyPage').then((m) => ({
    default: m.PrivacyPolicyPage,
  })),
);
const TermsPage = lazy(() =>
  import('./pages/Legal/TermsPage').then((m) => ({
    default: m.TermsPage,
  })),
);
const FeedbackPage = lazy(() =>
  import('./pages/Support/FeedbackPage').then((m) => ({
    default: m.FeedbackPage,
  })),
);
const ContactUsPage = lazy(() =>
  import('./pages/Support/ContactUsPage').then((m) => ({
    default: m.ContactUsPage,
  })),
);

function AppToaster() {
  const mode = useThemeStore((s) => s.mode);
  const isDark = mode === 'dark';
  return (
    <Toaster
      position='bottom-right'
      toastOptions={{
        style: {
          background: isDark ? '#1e293b' : '#ffffff',
          color: isDark ? '#f8fafc' : '#0f172a',
          border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
          boxShadow: isDark
            ? '0 10px 40px rgba(0,0,0,0.35)'
            : '0 10px 40px rgba(15,23,42,0.08)',
        },
      }}
    />
  );
}

export default function App() {
  return (
    <>
      <AppToaster />
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
              path='/payments'
              element={
                <Suspense fallback={<LiabilitiesSkeleton />}>
                  <PaymentTrackerPage />
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
            <Route
              path='/insurance'
              element={
                <Suspense fallback={<LiabilitiesSkeleton />}>
                  <InsurancePage />
                </Suspense>
              }
            />
            <Route
              path='/goals'
              element={
                <Suspense fallback={<GoalsSkeleton />}>
                  <GoalsPage />
                </Suspense>
              }
            />
            <Route
              path='/credentials'
              element={
                <Suspense fallback={<ToolsSkeleton />}>
                  <CredentialsPage />
                </Suspense>
              }
            />{' '}
            {/* ← NEW */}
            <Route
              path='/insights'
              element={
                <Suspense fallback={<InsightsSkeleton />}>
                  <InsightsPage />
                </Suspense>
              }
            />
            <Route
              path='/ai-agent'
              element={
                <Suspense fallback={<AIAgentSkeleton />}>
                  <AIAgentPage />
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
              path='/pricing'
              element={
                <Suspense fallback={<SettingsSkeleton />}>
                  <PricingPage />
                </Suspense>
              }
            />
            <Route
              path='/payment/success'
              element={
                <Suspense fallback={<SettingsSkeleton />}>
                  <PaymentSuccessPage />
                </Suspense>
              }
            />
            <Route
              path='/payment/failure'
              element={
                <Suspense fallback={<SettingsSkeleton />}>
                  <PaymentFailurePage />
                </Suspense>
              }
            />
            <Route
              path='/privacy'
              element={
                <Suspense fallback={<SettingsSkeleton />}>
                  <PrivacyPolicyPage />
                </Suspense>
              }
            />
            <Route
              path='/terms'
              element={
                <Suspense fallback={<SettingsSkeleton />}>
                  <TermsPage />
                </Suspense>
              }
            />
            <Route
              path='/feedback'
              element={
                <Suspense fallback={<SettingsSkeleton />}>
                  <FeedbackPage />
                </Suspense>
              }
            />
            <Route
              path='/contact'
              element={
                <Suspense fallback={<SettingsSkeleton />}>
                  <ContactUsPage />
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
