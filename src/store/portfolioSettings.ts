// src/store/portfolioSettings.ts
//
// Settings-document vocabulary for the portfolio (audit Y1 — extracted
// verbatim from portfolioStore.ts). Types + defaults only, no Firestore and
// no store imports, so both the persistence layer and the store can depend
// on it without cycles.

import type { EssentialsConfig, NotionConfig } from '../types/investmentTypes';

/** Target asset-allocation percentages (macro buckets) persisted in the
 *  settings doc. `null` in state means "use DEFAULT_ALLOCATION_TARGETS". */
export type AllocationTargets = Record<
  'equity' | 'debt' | 'realEstate' | 'commodities' | 'cash',
  number
>;

export const DEFAULT_ALLOCATION_TARGETS: AllocationTargets = {
  equity: 55,
  debt: 20,
  realEstate: 10,
  commodities: 10,
  cash: 5,
};

export type SettingsRecord = {
  notion: NotionConfig;
  essentials?: EssentialsConfig;
  encryptionEnabled?: boolean;
  customCategories?: { expense: string[]; income: string[] };
  hiddenCategories?: { expense: string[]; income: string[] };
  customSubcategories?: Record<string, string[]>;
  allocationTargets?: AllocationTargets;
  /** Bumped by a migration run. One-time data fixes check this instead of
   *  re-reading and re-writing the user's whole history on every login. */
  schemaVersion?: number;
};

export const DEFAULT_NOTION: NotionConfig = { enabled: false };
export const DEFAULT_ESSENTIALS: EssentialsConfig = {};
