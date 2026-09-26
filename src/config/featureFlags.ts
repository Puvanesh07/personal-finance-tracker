/**
 * src/config/featureFlags.ts — launch-safety feature switches (audit C2).
 *
 * FinTrackly ships ~15 destinations, several of which are analytical
 * re-presentations of the same numbers (Simulator, CFO, Forecast, DNA, Tools,
 * Credentials). For a public launch you want a tight, obvious core, but you do
 * NOT want to delete those routes — they still work, deep links still resolve,
 * and you may want to re-enable one instantly.
 *
 * So each optional surface has a flag. `false` hides it from the sidebar /
 * mobile nav / command palette; the route itself stays mounted so nothing that
 * links to it breaks. Flip a flag to `false` and redeploy to pull an unfinished
 * or rough feature out of customers' sight without a code change.
 *
 * Core screens (Dashboard, Cashflow, Wealth, Payments, Insurance, Goals,
 * Settings) are intentionally NOT flaggable — they are the product.
 */

export type FeatureKey =
  | 'calendar'
  | 'credentials'
  | 'simulator'
  | 'tools'
  | 'reports'
  | 'aiCoach';

/**
 * Launch posture: everything is on by default so behaviour is unchanged until
 * you deliberately opt a surface out. Set a value to `false` to hide it.
 */
export const FEATURE_FLAGS: Record<FeatureKey, boolean> = {
  calendar: true,
  credentials: true,
  simulator: true,
  tools: true,
  reports: true,
  aiCoach: true,
};

/** Which flag gates a route. Routes not listed here are always enabled. */
const ROUTE_FLAGS: Record<string, FeatureKey> = {
  '/calendar': 'calendar',
  '/credentials': 'credentials',
  '/simulator': 'simulator',
  '/tools': 'tools',
  '/reports': 'reports',
  '/ai-agent': 'aiCoach',
};

export function isFeatureEnabled(key: FeatureKey): boolean {
  return FEATURE_FLAGS[key] !== false;
}

/** True when a nav target should be shown. Unknown/core routes are always on. */
export function isRouteEnabled(to: string): boolean {
  const key = ROUTE_FLAGS[to.split('?')[0]]; // ignore ?tab= query params
  return key ? isFeatureEnabled(key) : true;
}
