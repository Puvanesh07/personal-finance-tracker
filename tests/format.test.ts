// tests/format.test.ts
// Audit I7 — currency/negative formatting consistency. Guards the two things
// that used to drift between surfaces: the sign position on negatives, and the
// privacy mask.

import { describe, expect, it, vi } from 'vitest';

const { privacy } = vi.hoisted(() => ({ privacy: { hideAmounts: false } }));
vi.mock('../src/store/privacyStore', () => ({
  usePrivacyStore: { getState: () => privacy },
}));

import { formatINR, formatSignedINR } from '../src/utils/format';

describe('formatINR (audit I7)', () => {
  it('prefixes the rupee symbol for positive amounts', () => {
    expect(formatINR(1234567)).toBe('₹12,34,567');
  });

  it('puts the minus BEFORE the symbol, never "₹-1,000"', () => {
    const neg = formatINR(-1000);
    expect(neg).not.toContain('₹-');
    expect(neg.startsWith('-')).toBe(true);
    expect(neg).toBe('-₹1,000');
  });

  it('honours the privacy mask', () => {
    privacy.hideAmounts = true;
    expect(formatINR(5000)).toBe('*****');
    privacy.hideAmounts = false;
  });
});

describe('formatSignedINR (audit I7)', () => {
  it('shows a leading + for gains and - for losses, before the symbol', () => {
    expect(formatSignedINR(1500)).toBe('+₹1,500');
    expect(formatSignedINR(-1500)).toBe('-₹1,500');
  });

  it('renders zero without a sign, identical to formatINR', () => {
    expect(formatSignedINR(0)).toBe(formatINR(0));
  });

  it('masks like formatINR when amounts are hidden', () => {
    privacy.hideAmounts = true;
    expect(formatSignedINR(9999)).toBe('*****');
    expect(formatSignedINR(-9999)).toBe('*****');
    privacy.hideAmounts = false;
  });
});
