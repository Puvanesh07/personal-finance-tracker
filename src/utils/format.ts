// src/utils/format.ts

import { usePrivacyStore } from '../store/privacyStore';

const MASK = '*****';

/**
 * The application-wide currency. Records (liabilities, investments, …) keep a
 * `currency` field for storage compatibility, but the user never picks it per
 * record — everything is written with this default.
 */
export const APP_CURRENCY = 'INR';

function shouldMask() {
  return usePrivacyStore.getState().hideAmounts;
}

/**
 * Formats a number as Indian Rupee (INR) with no decimal places.
 * Example: 1234567 -> ₹12,34,567
 */
export function formatINR(value: number) {
  if (shouldMask()) return MASK;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value)
}

/**
 * Standard currency formatter for the application. 
 * Currently defaults to INR formatting.
 */
export function formatCurrency(value: number) {
  if (shouldMask()) return MASK;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

/**
 * Canonical delta formatter (audit I7). Always places the sign in front of the
 * symbol (`+₹1,000` / `-₹1,000`) and respects privacy masking, so no surface can
 * produce the inconsistent `₹-1,000` form. Use for gains / losses / changes.
 */
export function formatSignedINR(value: number) {
  const n = Number(value) || 0;
  const formatted = formatINR(Math.abs(n));
  if (shouldMask()) return formatted;
  if (n > 0) return `+${formatted}`;
  if (n < 0) return `-${formatted}`;
  return formatted;
}

/**
 * Formats a number using the Indian numbering system.
 * Example: 1234567 -> 12,34,567
 */
export function formatNumber(value: number, digits = 2) {
  if (shouldMask()) return MASK;
  return new Intl.NumberFormat('en-IN', { 
    maximumFractionDigits: digits 
  }).format(value)
}