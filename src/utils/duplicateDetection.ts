/**
 * src/utils/duplicateDetection.ts
 *
 * Duplicate Transaction Detection — Feature 12.
 * Detects likely duplicates based on:
 *   1. Same amount + same category + date within 3 days
 *   2. Same amount + similar description + same day
 *
 * Pure function — no store imports.
 */

import type { CashflowEntry } from '../types/investmentTypes';

export interface DuplicateWarning {
  existingId:  string;
  existingDate: string;
  existingCategory: string;
  amount: number;
  daysDiff: number;
  reason: string;
}

/**
 * Check if a NEW (unsaved) entry looks like a duplicate of existing entries.
 * Returns a warning if a likely duplicate is found, null otherwise.
 */
export function detectDuplicate(
  candidate: { amount: number; category: string; date: string; type: string },
  existing: CashflowEntry[],
  windowDays = 3,
): DuplicateWarning | null {
  const candDate = new Date(candidate.date).getTime();

  for (const entry of existing) {
    if (entry.type !== candidate.type) continue;
    if (Math.abs(entry.amount - candidate.amount) > 1) continue; // allow ₹1 rounding

    const entryDate = new Date(entry.date).getTime();
    const daysDiff  = Math.abs(Math.round((candDate - entryDate) / 86_400_000));

    if (daysDiff > windowDays) continue;

    const sameCategory = entry.category.toLowerCase() === candidate.category.toLowerCase();

    if (sameCategory) {
      return {
        existingId:       entry.id,
        existingDate:     entry.date,
        existingCategory: entry.category,
        amount:           entry.amount,
        daysDiff,
        reason: daysDiff === 0
          ? `Same amount (₹${Math.round(entry.amount).toLocaleString('en-IN')}) and category on the same day`
          : `Same amount (₹${Math.round(entry.amount).toLocaleString('en-IN')}) and category, ${daysDiff} day${daysDiff > 1 ? 's' : ''} apart`,
      };
    }
  }

  return null;
}

/**
 * Find ALL potential duplicates in an existing cashflow list.
 * Returns pairs of entry IDs that look like duplicates.
 */
export function findAllDuplicates(
  entries: CashflowEntry[],
  windowDays = 2,
): Array<{ id1: string; id2: string; reason: string }> {
  const results: Array<{ id1: string; id2: string; reason: string }> = [];
  const seen = new Set<string>();

  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i];
      const b = entries[j];
      if (a.type !== b.type) continue;
      if (Math.abs(a.amount - b.amount) > 1) continue;

      const daysDiff = Math.abs(
        (new Date(a.date).getTime() - new Date(b.date).getTime()) / 86_400_000,
      );
      if (daysDiff > windowDays) continue;

      const sameCategory =
        a.category.toLowerCase() === b.category.toLowerCase();
      if (!sameCategory) continue;

      const pairKey = [a.id, b.id].sort().join('|');
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);

      results.push({
        id1: a.id,
        id2: b.id,
        reason: `₹${Math.round(a.amount).toLocaleString('en-IN')} — ${a.category} — ${daysDiff === 0 ? 'same day' : `${Math.round(daysDiff)}d apart`}`,
      });
    }
  }

  return results;
}
