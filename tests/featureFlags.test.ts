// tests/featureFlags.test.ts — audit C2 launch-safety switches
import { describe, it, expect, beforeEach } from 'vitest';
import {
  FEATURE_FLAGS,
  isFeatureEnabled,
  isRouteEnabled,
} from '../src/config/featureFlags';

describe('feature flags (C2)', () => {
  const snapshot = { ...FEATURE_FLAGS };
  beforeEach(() => {
    // restore defaults between tests that mutate the shared object
    Object.assign(FEATURE_FLAGS, snapshot);
  });

  it('enables every optional surface by default (launch = no behaviour change)', () => {
    expect(isFeatureEnabled('simulator')).toBe(true);
    expect(isFeatureEnabled('reports')).toBe(true);
    expect(isRouteEnabled('/simulator')).toBe(true);
  });

  it('hides a flagged route from the nav when turned off, without deleting it', () => {
    FEATURE_FLAGS.simulator = false;
    expect(isRouteEnabled('/simulator')).toBe(false);
    expect(isRouteEnabled('/calendar')).toBe(true); // others unaffected
  });

  it('ignores ?query params when resolving a route (deep links still gate)', () => {
    FEATURE_FLAGS.reports = false;
    expect(isRouteEnabled('/reports?tab=annual')).toBe(false);
  });

  it('always allows core routes that have no flag', () => {
    expect(isRouteEnabled('/dashboard')).toBe(true);
    expect(isRouteEnabled('/cashflow')).toBe(true);
    expect(isRouteEnabled('/settings')).toBe(true);
  });
});
