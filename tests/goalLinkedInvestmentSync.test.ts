/**
 * tests/goalLinkedInvestmentSync.test.ts
 *
 * Feature: A Goal can link specific investments (via `linkedAssetIds`). Their
 * LIVE market value is rolled into the goal's "current amount" automatically —
 * no manual "add contribution" needed. When the stock price or MF NAV moves,
 * the goal's progress on the Goals page and its detail modal reflect it.
 *
 * Pinning:
 *   • goalLinkedCurrentValue uses currentValue (live), not investedValue.
 *   • effectiveGoalCurrent = saved currentAmount + extra contributions + linked.
 *   • Unknown linked ids are silently skipped (never crash the roll-up).
 *   • Re-pricing an investment automatically moves the goal needle.
 */

import { describe, expect, it } from 'vitest';
import {
  effectiveGoalCurrent,
  goalLinkedCurrentValue,
} from '../src/utils/goalLinks';
import type { Goal, Investment } from '../src/types/investmentTypes';

const stock = (currentPrice: number): Investment =>
  ({
    id: 'stk_1',
    type: 'stock',
    name: 'TCS',
    symbol: 'TCS',
    quantity: 10,
    buyPrice: 3_000,
    currentPrice,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    userId: 'u1',
  }) as Investment;

const mf = (nav: number): Investment =>
  ({
    id: 'mf_1',
    type: 'mutual_fund',
    name: 'Axis Bluechip',
    units: 100,
    nav,
    investedAmount: 8_000,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    userId: 'u1',
  }) as Investment;

const goal = (linked: string[], currentAmount = 5_000): Goal =>
  ({
    id: 'goal_1',
    name: 'Emergency Fund',
    targetAmount: 200_000,
    currentAmount,
    linkedAssetIds: linked,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    userId: 'u1',
  }) as Goal;

describe('Goal ↔ linked investments auto-sync', () => {
  it('linked value uses LIVE market price, not the invested amount', () => {
    // stock @ ₹3,500 × 10 = 35,000, mf @ ₹90 × 100 = 9,000
    const linked = goalLinkedCurrentValue(
      goal(['stk_1', 'mf_1']),
      [stock(3_500), mf(90)],
    );
    expect(linked).toBe(35_000 + 9_000);
  });

  it('no linked ids → contributes 0 regardless of how many investments exist', () => {
    expect(goalLinkedCurrentValue(goal([]), [stock(3_500), mf(90)])).toBe(0);
    expect(goalLinkedCurrentValue(goal(undefined as any), [stock(3_500)])).toBe(0);
  });

  it('a stale id (investment was deleted) is skipped silently', () => {
    const linked = goalLinkedCurrentValue(
      goal(['stk_1', 'gone_1']),
      [stock(3_500)],
    );
    expect(linked).toBe(35_000); // only stk_1 counted
  });

  it('effective goal current adds saved amount + extra cash contributions + linked', () => {
    const g = goal(['stk_1'], /* currentAmount */ 5_000);
    const invs = [stock(3_500)]; // live value 35,000
    expect(effectiveGoalCurrent(g, invs, 0)).toBe(5_000 + 0 + 35_000);
    expect(effectiveGoalCurrent(g, invs, 2_000)).toBe(5_000 + 2_000 + 35_000);
  });

  it('when the price moves, the goal needle moves automatically (no re-link needed)', () => {
    const g = goal(['stk_1'], 0);
    const low = effectiveGoalCurrent(g, [stock(3_000)], 0);
    const high = effectiveGoalCurrent(g, [stock(3_500)], 0);
    expect(high - low).toBe(5_000); // 10 shares × Δ 500
  });
});
