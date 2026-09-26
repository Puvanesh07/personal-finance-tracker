// src/store/slices/settingsSlice.ts
//
// Settings module: user categories/subcategories, hidden categories, the Notion
// and Essentials configs, and target allocations. All of these live inside the
// single settings document, so every write goes through saveSettings (which also
// stamps the change so other devices pick it up via live sync).
import type { StateCreator } from 'zustand';

import {
  DEFAULT_ALLOCATION_TARGETS,
  DEFAULT_ESSENTIALS,
  DEFAULT_NOTION,
} from '../portfolioSettings';
import { saveSettings } from '../shared';
import type { PortfolioState } from '../types';

export type SettingsSlice = Pick<
  PortfolioState,
  | 'notion'
  | 'essentials'
  | 'allocationTargets'
  | 'customCategories'
  | 'hiddenCategories'
  | 'customSubcategories'
  | 'addCustomCategory'
  | 'removeCustomCategory'
  | 'toggleHiddenCategory'
  | 'addCustomSubcategory'
  | 'removeCustomSubcategory'
  | 'setNotionConfig'
  | 'setEssentialsConfig'
  | 'setAllocationTargets'
>;

export const createSettingsSlice: StateCreator<
  PortfolioState,
  [],
  [],
  SettingsSlice
> = (set, get) => ({
  notion: DEFAULT_NOTION,
  essentials: DEFAULT_ESSENTIALS,
  allocationTargets: DEFAULT_ALLOCATION_TARGETS,
  customCategories: { expense: [], income: [] },
  hiddenCategories: { expense: [], income: [] },
  customSubcategories: {},

  // ── Custom category management (persisted in settings doc) ───────────────
  addCustomCategory: async (type, name) => {
    const uid = get().uid;
    if (!uid) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const current = get().customCategories;
    if (current[type].includes(trimmed)) return; // no duplicates
    const updated = { ...current, [type]: [...current[type], trimmed] };
    await saveSettings(uid, { customCategories: updated });
    set({ customCategories: updated });
  },

  removeCustomCategory: async (type, name) => {
    const uid = get().uid;
    if (!uid) return;
    const current = get().customCategories;
    const updated = { ...current, [type]: current[type].filter((c) => c !== name) };
    await saveSettings(uid, { customCategories: updated });
    set({ customCategories: updated });
  },

  toggleHiddenCategory: async (type, name) => {
    const uid = get().uid;
    if (!uid) return;
    const current = get().hiddenCategories;
    const list    = current[type];
    const updated = list.includes(name)
      ? { ...current, [type]: list.filter((c) => c !== name) }
      : { ...current, [type]: [...list, name] };
    await saveSettings(uid, { hiddenCategories: updated });
    set({ hiddenCategories: updated });
  },

  // ── Custom subcategory management (persisted in settings doc) ────────────
  // Keyed by parent category so a new subcategory is instantly available in
  // the Add Entry form, the subcategory filter and every count derived from it.
  addCustomSubcategory: async (category, name) => {
    const uid = get().uid;
    if (!uid) return;
    const parent = category.trim();
    const trimmed = name.trim();
    if (!parent || !trimmed) return;
    const current = get().customSubcategories;
    const list = current[parent] ?? [];
    if (list.includes(trimmed)) return; // no duplicates
    const updated = { ...current, [parent]: [...list, trimmed] };
    await saveSettings(uid, { customSubcategories: updated });
    set({ customSubcategories: updated });
  },

  removeCustomSubcategory: async (category, name) => {
    const uid = get().uid;
    if (!uid) return;
    const current = get().customSubcategories;
    const list = current[category];
    if (!list) return;
    const updated = { ...current, [category]: list.filter((c) => c !== name) };
    await saveSettings(uid, { customSubcategories: updated });
    set({ customSubcategories: updated });
  },

  setNotionConfig: async (patch) => {
    const uid = get().uid;
    if (!uid) return;
    const notion = { ...get().notion, ...patch };
    await saveSettings(uid, { notion, essentials: get().essentials });
    set({ notion });
  },

  setEssentialsConfig: async (patch) => {
    const uid = get().uid;
    if (!uid) return;
    const essentials = { ...get().essentials, ...patch };
    await saveSettings(uid, { notion: get().notion, essentials });
    set({ essentials });
  },

  setAllocationTargets: async (targets) => {
    const uid = get().uid;
    if (!uid) return;
    await saveSettings(uid, { allocationTargets: targets });
    set({ allocationTargets: targets });
  },
});
