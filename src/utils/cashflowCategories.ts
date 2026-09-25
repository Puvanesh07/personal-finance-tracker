// src/utils/cashflowCategories.ts
//
// Single source of truth for Cashflow category + subcategory definitions.
//
// Subcategories are plain metadata on a normal CashflowEntry (`subcategory?:
// string`) — there is no separate "agriculture transaction" type, so every
// existing aggregator (budget, insights, AI, exports, charts) keeps working
// untouched and simply gains an optional drill-down level.

export type CategoryDef = { key: string; icon: string };

// ── Categories ────────────────────────────────────────────────────────────

export const AGRICULTURE_CATEGORY = 'Agriculture';

export const DEFAULT_EXPENSE_CATEGORIES: CategoryDef[] = [
  { key: 'Housing & Rent',         icon: '🏠' },
  { key: 'Food & Dining',          icon: '🍽️' },
  { key: 'Groceries',              icon: '🛒' },
  { key: 'Transport',              icon: '🚗' },
  { key: 'Healthcare',             icon: '🏥' },
  { key: 'Education',              icon: '📚' },
  { key: 'Insurance',              icon: '🛡️' },
  { key: 'EMI & Loans',            icon: '🏦' },
  { key: 'Entertainment',          icon: '🎬' },
  { key: 'Utilities',              icon: '💡' },
  { key: 'Shopping',               icon: '🛍️' },
  { key: 'Investment',             icon: '📈' },
  { key: 'Travel & Vacations',     icon: '✈️' },
  { key: 'Subscriptions',          icon: '📱' },
  { key: 'Personal Care',          icon: '💆' },
  { key: 'Transfers & Remittance', icon: '💸' },
  { key: 'Credit Card Payment',    icon: '💳' },
  { key: 'Taxes',                  icon: '🧾' },
  { key: 'Cash Withdrawal',        icon: '💵' },
  { key: 'Childcare',              icon: '👶' },
  { key: 'Petrol',                 icon: '⛽' },
  { key: 'Rent',                   icon: '🏘️' },
  { key: 'Dining',                 icon: '🍜' },
  { key: AGRICULTURE_CATEGORY,     icon: '🚜' },
  { key: 'Other Expense',          icon: '📦' },
];

export const DEFAULT_INCOME_CATEGORIES: CategoryDef[] = [
  { key: 'Salary',                 icon: '💼' },
  { key: 'Business',               icon: '🏢' },
  { key: 'Freelance',              icon: '💻' },
  { key: 'Dividend',               icon: '📊' },
  { key: 'Interest',               icon: '🏦' },
  { key: 'Rental Income',          icon: '🏠' },
  { key: 'Bonus',                  icon: '🎁' },
  { key: 'Capital Gains',          icon: '📈' },
  { key: 'Pension',                icon: '👴' },
  { key: 'Refund',                 icon: '↩️' },
  { key: 'Gift',                   icon: '🎀' },
  { key: 'Lottery / Prize',        icon: '🏆' },
  { key: AGRICULTURE_CATEGORY,     icon: '🚜' },
  { key: 'Other Income',           icon: '💰' },
];

export function defaultCategoriesFor(type: 'expense' | 'income'): CategoryDef[] {
  return type === 'expense' ? DEFAULT_EXPENSE_CATEGORIES : DEFAULT_INCOME_CATEGORIES;
}

// ── Built-in subcategories (per category) ─────────────────────────────────

/**
 * Built-in subcategories. Agriculture is farm-first: the sale of a crop is
 * income while seeds/fertiliser/labour are expenses, so the same list is
 * offered for both types and the user picks what fits.
 */
export const DEFAULT_SUBCATEGORIES: Record<string, CategoryDef[]> = {
  [AGRICULTURE_CATEGORY]: [
    { key: 'Drumstick',   icon: '🌱' },
    { key: 'Tomato',      icon: '🍅' },
    { key: 'Fertilizer',  icon: '🌾' },
    { key: 'Labour',      icon: '👷' },
    { key: 'Seeds',       icon: '🌿' },
    { key: 'Irrigation',  icon: '💧' },
    { key: 'Machinery',   icon: '🚜' },
    { key: 'Cattle',      icon: '🐄' },
    { key: 'Poultry',     icon: '🐔' },
    { key: 'Other',       icon: '📦' },
  ],
};

/** Icon lookup for any known subcategory name (used by lists & filters). */
const SUBCATEGORY_ICONS = new Map<string, string>();
for (const list of Object.values(DEFAULT_SUBCATEGORIES)) {
  for (const s of list) if (!SUBCATEGORY_ICONS.has(s.key)) SUBCATEGORY_ICONS.set(s.key, s.icon);
}

const CATEGORY_ICONS = new Map<string, string>();
for (const list of [...DEFAULT_EXPENSE_CATEGORIES, ...DEFAULT_INCOME_CATEGORIES]) {
  if (!CATEGORY_ICONS.has(list.key)) CATEGORY_ICONS.set(list.key, list.icon);
}

export function categoryIcon(category: string): string {
  return CATEGORY_ICONS.get(category) ?? '🏷️';
}

export function subcategoryIcon(subcategory: string): string {
  return SUBCATEGORY_ICONS.get(subcategory) ?? '🏷️';
}

/**
 * Every subcategory available for a category: built-ins first, then the
 * user-created ones (persisted in the settings doc). Custom entries reuse a
 * built-in icon when the name matches, otherwise they get a label icon.
 */
export function getSubcategoryOptions(
  category: string,
  customSubcategories: Record<string, string[]> = {},
): CategoryDef[] {
  if (!category) return [];
  const builtIns = DEFAULT_SUBCATEGORIES[category] ?? [];
  const customs = customSubcategories[category] ?? [];
  const seen = new Set(builtIns.map((b) => b.key));
  const customDefs = customs
    .filter((c) => !seen.has(c))
    .map((c) => ({ key: c, icon: SUBCATEGORY_ICONS.get(c) ?? '🏷️' }));
  return [...builtIns, ...customDefs];
}

/**
 * True when a category offers subcategories at all — drives the optional
 * subcategory step so every other category keeps the plain single-step form.
 */
export function hasSubcategories(
  category: string,
  customSubcategories: Record<string, string[]> = {},
): boolean {
  return getSubcategoryOptions(category, customSubcategories).length > 0;
}
