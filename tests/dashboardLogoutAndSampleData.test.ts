// tests/dashboardLogoutAndSampleData.test.ts
//
// Locks in the three dashboard/auth fixes requested together:
//   1. Loaded sample (dummy) data can always be cleared — the undo stays
//      reachable even after every checklist step turns green.
//   2. Logout is a *soft* transition (no window.location.href reload), and the
//      mobile menu now exposes a Logout action.
//   3. hydrate fetches the settings doc in parallel with the collections, and
//      the dashboard UI is compacted (smaller KPI cards, no text-2xl hero).
//
// These are source-text assertions (no DOM), matching the style of
// seoAndLanding.test.ts, so a later edit that regresses one of these fails here.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (relFromRoot: string): string =>
  readFileSync(fileURLToPath(new URL(relFromRoot, import.meta.url)), 'utf8');

const setupChecklist = read('../src/components/dashboard/SetupChecklist.tsx');
const dummyLoader = read('../src/components/settings/DummyDataLoader.tsx');
const appLayout = read('../src/components/layout/AppLayout.tsx');
const settingsPage = read('../src/pages/Settings/SettingsPage.tsx');
const portfolioStore = read('../src/store/portfolioStore.ts');
const summaryCards = read('../src/components/dashboard/SummaryCards.tsx');
const accountsCard = read('../src/components/dashboard/DashboardAccountsSummary.tsx');
const liabilitiesCard = read('../src/components/dashboard/DashboardLiabilitiesSummary.tsx');
const receivablesCard = read('../src/components/dashboard/DashboardReceivablesSummary.tsx');
const sipCard = read('../src/components/dashboard/DashboardSIPSummary.tsx');
const upcomingCard = read('../src/components/dashboard/UpcomingPaymentsCard.tsx');

describe('sample data can always be cleared', () => {
  it('SetupChecklist no longer hides entirely once every step is done', () => {
    // Old guard collapsed the whole card when all steps were complete, which
    // also hid the "Clear sample data" button. It must only bail on !ready /
    // dismissed up front.
    expect(setupChecklist).toContain('if (!ready || dismissed) return null;');
    expect(setupChecklist).not.toContain(
      'if (!ready || dismissed || doneCount === steps.length) return null;',
    );
  });

  it('SetupChecklist keeps a dedicated clear-sample banner when all done', () => {
    expect(setupChecklist).toContain("aria-label='Sample data'");
    expect(setupChecklist).toContain("'Clear sample data'");
    // Still wired to the exact undo helper.
    expect(setupChecklist).toContain('clearSampleData');
  });

  it('admin DummyDataLoader gained a matching Clear action', () => {
    expect(dummyLoader).toContain('clearSampleData');
    expect(dummyLoader).toContain('readSampleDataState');
    expect(dummyLoader).toContain('Clear Dummy Data');
  });
});

describe('logout is soft and reachable from the mobile menu', () => {
  it('AppLayout no longer hard-reloads on logout', () => {
    // A comment may mention the anti-pattern, but there must be no live reload.
    expect(appLayout).not.toContain("window.location.href = '/'");
    expect(appLayout).toContain("navigate('/', { replace: true })");
    expect(appLayout).toContain('signOut(auth)');
  });

  it('AppLayout mobile bottom sheet exposes a Logout button', () => {
    // Desktop sidebar already had one; the mobile menu now does too, opening
    // the shared confirm modal.
    expect(appLayout).toContain('Logout lives in the mobile menu');
    expect(appLayout).toContain('FiLogOut');
  });

  it('SettingsPage profile logout is soft too (no reload)', () => {
    expect(settingsPage).not.toContain("window.location.href = '/'");
    expect(settingsPage).toContain("navigate('/', { replace: true })");
  });
});

describe('dashboard load + UI optimisation', () => {
  it('hydrate fetches settings in the same parallel batch as collections', () => {
    // Previously `await getDoc(settingsDocRef(uid))` ran sequentially after the
    // Promise.all; now it is an element of the batch.
    expect(portfolioStore).toContain('getDoc(settingsDocRef(uid)),');
    expect(portfolioStore).not.toContain(
      'const settingsSnap = await getDoc(settingsDocRef(uid));',
    );
  });

  it('summary KPI cards are compacted', () => {
    expect(summaryCards).toContain('text-lg font-black');
    expect(summaryCards).toContain('rounded-2xl');
    expect(summaryCards).toContain('grid-cols-2 gap-2.5 lg:grid-cols-4');
    // No oversized hero values anywhere in the KPI row.
    expect(summaryCards).not.toContain('text-2xl');
    expect(summaryCards).not.toContain('text-xl');
  });

  it('no dashboard widget keeps an oversized 3xl/2xl headline total', () => {
    for (const card of [accountsCard, liabilitiesCard, receivablesCard, sipCard]) {
      expect(card).not.toContain('text-3xl');
      // Headline totals settle at text-xl, secondary stats at text-sm.
      expect(card).toContain('text-xl font-black');
    }
    expect(upcomingCard).not.toContain('text-2xl');
    expect(upcomingCard).toContain('text-lg font-black');
  });
});
