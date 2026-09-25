// src/App.tsx

import {
  AIAgentSkeleton,
  CashflowSkeleton,
  DashboardSkeleton,
  GoalsSkeleton,
  InvestmentsSkeleton,
  LiabilitiesSkeleton,
  NotificationsSkeleton,
  ReportsSkeleton,
  SettingsSkeleton,
  ToolsSkeleton,
} from './components/loader/skeletons';
import { Navigate, Route, Routes, useSearchParams } from 'react-router-dom';
import { Suspense, lazy } from 'react';

import { AppLayout } from './components/layout/AppLayout';
import { RouteError } from './components/layout/RouteError';
import { Loader } from './components/loader/Loader';
import { Toaster } from 'react-hot-toast';
import { useThemeStore } from './store/themeStore';

const DashboardPage = lazy(() =>
  import('./pages/Dashboard/DashboardPage').then((m) => ({
    default: m.DashboardPage,
  })),
);
const WealthPage = lazy(() =>
  import('./pages/Wealth/WealthPage').then((m) => ({
    default: m.WealthPage,
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
const EssentialsPage = lazy(() =>
  import('./pages/Essentials/EssentialsPage').then((m) => ({
    default: m.EssentialsPage,
  })),
);
const CredentialsPage = lazy(() =>
  import('./pages/Credentials/CredentialsPage').then((m) => ({
    default: m.CredentialsPage,
  })),
);
const AIAgentPage = lazy(() => import('./pages/AIAgent/AIAgentPage'));
const ToolsPage = lazy(() =>
  import('./Tools/ToolsPage').then((m) => ({ default: m.ToolsPage })),
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
const NotificationsPage = lazy(() =>
  import('./pages/Notifications/NotificationsPage').then((m) => ({
    default: m.NotificationsPage,
  })),
);
const WhatIfSimulatorPage = lazy(() =>
  import('./pages/Simulator/WhatIfSimulatorPage'),
);
const FinancialCalendarPage = lazy(() =>
  import('./pages/Calendar/FinancialCalendarPage'),
);
const ForecastPage = lazy(() =>
  import('./pages/Forecast/ForecastPage'),
);
const PersonalCFOPage = lazy(() =>
  import('./pages/CFO/PersonalCFOPage'),
);

// ── Legacy route redirects ─────────────────────────────────────────────
// Old deep links keep working by mapping onto the new tab shells.

function InvestmentsRedirect() {
  const [params] = useSearchParams();
  const to =
    params.get('tab') === 'sip-plan'
      ? '/wealth?tab=allocation&sub=sip'
      : '/wealth?tab=assets';
  return <Navigate to={to} replace />;
}

function LiabilitiesRedirect() {
  const [params] = useSearchParams();
  const section = params.get('section');
  const to = section
    ? `/wealth?tab=liabilities&section=${encodeURIComponent(section)}`
    : '/wealth?tab=liabilities';
  return <Navigate to={to} replace />;
}

function InsightsRedirect() {
  const [params] = useSearchParams();
  const to =
    params.get('tab') === 'dna'
      ? '/cashflow?tab=dna'
      : '/cashflow?tab=insights';
  return <Navigate to={to} replace />;
}

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
          <Route element={<AppLayout />} errorElement={<RouteError />}>
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
              path='/wealth'
              element={
                <Suspense fallback={<InvestmentsSkeleton />}>
                  <WealthPage />
                </Suspense>
              }
            />
            <Route path='/investments' element={<InvestmentsRedirect />} />
            <Route path='/liabilities' element={<LiabilitiesRedirect />} />
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
              element={<Navigate to='/cashflow?tab=accounts' replace />}
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
              element={<Navigate to='/essentials?tab=goals' replace />}
            />
            <Route
              path='/essentials'
              element={
                <Suspense fallback={<GoalsSkeleton />}>
                  <EssentialsPage />
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
            />
            <Route path='/insights' element={<InsightsRedirect />} />
            <Route
              path='/ai-agent'
              element={
                <Suspense fallback={<AIAgentSkeleton />}>
                  <AIAgentPage />
                </Suspense>
              }
            />
            <Route
              path='/simulator'
              element={
                <Suspense fallback={<ToolsSkeleton />}>
                  <WhatIfSimulatorPage />
                </Suspense>
              }
            />
            <Route
              path='/timeline'
              element={<Navigate to='/wealth?tab=networth' replace />}
            />
            <Route
              path='/calendar'
              element={
                <Suspense fallback={<ToolsSkeleton />}>
                  <FinancialCalendarPage />
                </Suspense>
              }
            />
            <Route
              path='/budget'
              element={<Navigate to='/cashflow?tab=budget' replace />}
            />
            <Route
              path='/forecast'
              element={
                <Suspense fallback={<ToolsSkeleton />}>
                  <ForecastPage />
                </Suspense>
              }
            />
            <Route path='/dna' element={<Navigate to='/cashflow?tab=dna' replace />} />
            <Route path='/milestones' element={<Navigate to='/cfo#milestones' replace />} />
            <Route
              path='/cfo'
              element={
                <Suspense fallback={<ToolsSkeleton />}>
                  <PersonalCFOPage />
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
              element={<Navigate to='/wealth?tab=networth' replace />}
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
              path='/notifications'
              element={
                <Suspense fallback={<NotificationsSkeleton />}>
                  <NotificationsPage />
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
