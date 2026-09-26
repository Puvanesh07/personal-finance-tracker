// src/store/portfolioStore.ts
//
// Composition root for the portfolio store. The state and every action now live
// in dedicated per-module slices under src/store/slices/*. Each slice is typed
// against the single canonical `PortfolioState` (src/store/types.ts) via
// `Pick<PortfolioState, ...>`, so this file only has to glue them together.
//
// The public surface is intentionally unchanged: the SAME `usePortfolioStore`
// hook is exported (so no consumer edits were required), and the settings
// vocabulary defined in portfolioSettings.ts is still re-exported from here for
// the handful of panels that import it alongside the hook.
import { create } from 'zustand';

import type { PortfolioState } from './types';
import { createSyncSlice } from './slices/syncSlice';
import { createAssetsSlice } from './slices/assetsSlice';
import { createCashflowSlice } from './slices/cashflowSlice';
import { createLiabilitiesSlice } from './slices/liabilitiesSlice';
import { createPaymentsSlice } from './slices/paymentsSlice';
import { createAccountsSlice } from './slices/accountsSlice';
import { createGoalsSlice } from './slices/goalsSlice';
import { createInsuranceSlice } from './slices/insuranceSlice';
import { createSipSlice } from './slices/sipSlice';
import { createSnapshotsSlice } from './slices/snapshotsSlice';
import { createCredentialsSlice } from './slices/credentialsSlice';
import { createSettingsSlice } from './slices/settingsSlice';

export type { PortfolioState, HydrateResult } from './types';

// Re-export the settings vocabulary so existing consumers (TargetAllocationPanel
// and the backup tooling) keep importing it from portfolioStore.
export {
  DEFAULT_ALLOCATION_TARGETS,
  DEFAULT_NOTION,
  DEFAULT_ESSENTIALS,
  type AllocationTargets,
  type SettingsRecord,
} from './portfolioSettings';

export const usePortfolioStore = create<PortfolioState>()((...args) => ({
  ...createSyncSlice(...args),
  ...createAssetsSlice(...args),
  ...createCashflowSlice(...args),
  ...createLiabilitiesSlice(...args),
  ...createPaymentsSlice(...args),
  ...createAccountsSlice(...args),
  ...createGoalsSlice(...args),
  ...createInsuranceSlice(...args),
  ...createSipSlice(...args),
  ...createSnapshotsSlice(...args),
  ...createCredentialsSlice(...args),
  ...createSettingsSlice(...args),
}));
