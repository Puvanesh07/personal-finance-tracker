// src/services/dateService.ts
/**
 * Centralized Date Service for Fintrackly
 * Timezone: Asia/Kolkata
 * Format: YYYY-MM-DD for business & financial dates
 */

import {
  addDays as addDaysFns,
  addMonths as addMonthsFns,
  addYears as addYearsFns,
  differenceInDays,
  endOfMonth as endOfMonthFns,
  format,
  isValid,
  parseISO,
  startOfMonth as startOfMonthFns,
  subDays as subDaysFns,
} from 'date-fns';

export const BUSINESS_TIMEZONE = 'Asia/Kolkata';
export type BusinessDateString = string; // YYYY-MM-DD

/**
 * Returns today's date in Asia/Kolkata as a YYYY-MM-DD string.
 */
export function todayBusinessDate(): BusinessDateString {
  const now = new Date();
  // Format in Asia/Kolkata timezone
  const kolkataDateStr = now.toLocaleDateString('en-CA', {
    timeZone: BUSINESS_TIMEZONE,
  }); // returns YYYY-MM-DD
  return kolkataDateStr;
}

/**
 * Returns current timestamp in ISO format.
 */
export function currentTimestampISO(): string {
  return new Date().toISOString();
}

/**
 * Parses a YYYY-MM-DD string or ISO string safely into a Date object.
 */
export function parseBusinessDate(dateStr: string): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const cleanStr = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  const parsed = parseISO(cleanStr);
  return isValid(parsed) ? parsed : null;
}

/**
 * Formats a Date object or ISO string to YYYY-MM-DD.
 */
export function formatBusinessDate(date: Date | string): BusinessDateString {
  if (typeof date === 'string') {
    const parsed = parseBusinessDate(date);
    if (!parsed) return todayBusinessDate();
    return format(parsed, 'yyyy-MM-dd');
  }
  if (!isValid(date)) return todayBusinessDate();
  return format(date, 'yyyy-MM-dd');
}

/**
 * Formats a business date string into a user-friendly label (e.g. 24 Aug 2026).
 */
export function formatBusinessDateLabel(dateStr: string): string {
  const parsed = parseBusinessDate(dateStr);
  return parsed ? format(parsed, 'dd MMM yyyy') : dateStr;
}

/**
 * Calculates difference in days between target date and base date (default today).
 * Positive = target is in future. Negative = target is in past.
 */
export function daysBetween(targetDateStr: string, baseDateStr?: string): number {
  const target = parseBusinessDate(targetDateStr);
  const base = baseDateStr ? parseBusinessDate(baseDateStr) : parseBusinessDate(todayBusinessDate());
  if (!target || !base) return 0;
  return differenceInDays(target, base);
}

/**
 * Convenience helper: returns days until target date from today.
 */
export function getDaysUntil(targetDateStr: string): number {
  return daysBetween(targetDateStr);
}

/**
 * Adds or subtracts days from a business date string, returning YYYY-MM-DD.
 */
export function addDays(dateStr: string, days: number): BusinessDateString {
  const parsed = parseBusinessDate(dateStr);
  if (!parsed) return todayBusinessDate();
  const result = days >= 0 ? addDaysFns(parsed, days) : subDaysFns(parsed, Math.abs(days));
  return format(result, 'yyyy-MM-dd');
}

/**
 * Correctly adds months to a business date without date overflow.
 * Example:
 * 31 Jan -> 28 Feb (or 29 Feb in leap year)
 * 31 Mar -> 30 Apr
 * 30 Apr -> 31 May
 */
export function addMonths(dateStr: string, months: number): BusinessDateString {
  const parsed = parseBusinessDate(dateStr);
  if (!parsed) return todayBusinessDate();
  const result = addMonthsFns(parsed, months);
  return format(result, 'yyyy-MM-dd');
}

/**
 * Adds years to a business date string.
 */
export function addYears(dateStr: string, years: number): BusinessDateString {
  const parsed = parseBusinessDate(dateStr);
  if (!parsed) return todayBusinessDate();
  const result = addYearsFns(parsed, years);
  return format(result, 'yyyy-MM-dd');
}

/**
 * Returns YYYY-MM-DD for the first day of the month for the given date.
 */
export function monthStart(dateStr: string): BusinessDateString {
  const parsed = parseBusinessDate(dateStr);
  if (!parsed) return todayBusinessDate();
  return format(startOfMonthFns(parsed), 'yyyy-MM-dd');
}

/**
 * Returns YYYY-MM-DD for the last day of the month for the given date.
 */
export function monthEnd(dateStr: string): BusinessDateString {
  const parsed = parseBusinessDate(dateStr);
  if (!parsed) return todayBusinessDate();
  return format(endOfMonthFns(parsed), 'yyyy-MM-dd');
}

/**
 * Returns month key in YYYY-MM format.
 */
export function monthKey(dateStr: string): string {
  const parsed = parseBusinessDate(dateStr);
  if (!parsed) return todayBusinessDate().slice(0, 7);
  return format(parsed, 'yyyy-MM');
}

/**
 * Computes reminder dates based on due date and reminder days array.
 * Example: dueDate = "2026-08-24", reminderDays = [7, 3, 1]
 * Returns ["2026-08-17", "2026-08-21", "2026-08-23"]
 */
export function getReminderDates(dueDateStr: string, reminderDays: number[]): BusinessDateString[] {
  return reminderDays.map((days) => addDays(dueDateStr, -days));
}

/**
 * Calculates next recurring date based on current date and recurrence type.
 * Handles month-end clamping correctly (e.g. 31 Jan monthly -> 28 Feb).
 */
export function getNextRecurringDate(
  currentDateStr: string,
  recurrence: 'none' | 'weekly' | 'monthly' | 'yearly',
): BusinessDateString | null {
  if (recurrence === 'none') return null;
  if (recurrence === 'weekly') return addDays(currentDateStr, 7);
  if (recurrence === 'monthly') return addMonths(currentDateStr, 1);
  if (recurrence === 'yearly') return addYears(currentDateStr, 1);
  return null;
}
