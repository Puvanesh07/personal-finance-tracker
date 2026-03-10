// src/utils/format.ts

/**
 * Formats a number as Indian Rupee (INR) with no decimal places.
 * Example: 1234567 -> ₹12,34,567
 */
export function formatINR(value: number) {
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
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

/**
 * Formats a number using the Indian numbering system.
 * Example: 1234567 -> 12,34,567
 */
export function formatNumber(value: number, digits = 2) {
  return new Intl.NumberFormat('en-IN', { 
    maximumFractionDigits: digits 
  }).format(value)
}