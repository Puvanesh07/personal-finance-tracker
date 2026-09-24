import type {
  PaymentIncreaseFrequency,
  PaymentRecurrence,
  PaymentTrackerType,
  TrackedPayment,
} from '../types/investmentTypes';
import {
  differenceInCalendarMonths,
  differenceInCalendarYears,
  endOfMonth,
  isSameMonth,
  parseISO,
  startOfMonth,
} from 'date-fns';
import {
  getDaysUntil,
  getNextRecurringDate,
} from '../services/dateService';

export const RECURRENCE_LABELS: Record<PaymentRecurrence, string> = {
  none: 'One-time',
  weekly: 'Weekly',
  every_2_weeks: 'Every 2 weeks',
  monthly: 'Monthly',
  every_2_months: 'Every 2 months',
  quarterly: 'Quarterly',
  half_yearly: 'Half-yearly',
  yearly: 'Yearly',
};

export const INCREASE_FREQUENCY_LABELS: Record<PaymentIncreaseFrequency, string> = {
  recurrence: 'Every recurrence',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

export const PAYMENT_TYPE_OPTIONS: {
  value: PaymentTrackerType;
  label: string;
  placeholder: string;
}[] = [
  { value: 'credit_card', label: 'Credit Card Bill', placeholder: 'Credit Card Bill' },
  { value: 'chit_fund', label: 'Chit Fund Payment', placeholder: 'Chit Fund Payment' },
  { value: 'fd_maturity', label: 'FD Maturity / Renewal', placeholder: 'FD Renewal' },
  { value: 'emi', label: 'EMI Payment', placeholder: 'Loan EMI' },
  { value: 'personal_loan', label: 'Personal Loan', placeholder: 'Personal Loan EMI' },
  { value: 'vehicle_loan', label: 'Vehicle Loan', placeholder: 'Vehicle Loan EMI' },
  { value: 'home_loan', label: 'Home Loan', placeholder: 'Home Loan EMI' },
  { value: 'rent', label: 'Rent Payment', placeholder: 'Rent Payment' },
  { value: 'insurance', label: 'Insurance Premium', placeholder: 'Insurance Premium' },
  { value: 'custom', label: 'Custom Payment', placeholder: 'Custom Payment' },
];

export const REMINDER_PRESETS = [1, 3, 7] as const;

export function paymentTypeLabel(type: PaymentTrackerType): string {
  return PAYMENT_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
}

export function paymentTypePlaceholder(type: PaymentTrackerType): string {
  return PAYMENT_TYPE_OPTIONS.find((o) => o.value === type)?.placeholder ?? 'Payment';
}

export function daysUntilDue(dueDate: string): number {
  return getDaysUntil(dueDate);
}

export function buildPaymentReminderMessage(
  payment: TrackedPayment,
  daysUntil: number,
): { title: string; message: string } {
  const label = payment.title || paymentTypeLabel(payment.paymentType);
  const amountStr = `₹${payment.amount.toLocaleString('en-IN')}`;

  if (daysUntil < 0) {
    const overdue = Math.abs(daysUntil);
    return {
      title: `⚠️ Payment Overdue`,
      message: `${label} of ${amountStr} — overdue by ${overdue} day${overdue === 1 ? '' : 's'}.`,
    };
  }
  if (daysUntil === 0) {
    return {
      title: `🔴 Payment Due Today`,
      message: `${label} of ${amountStr} is due today.`,
    };
  }
  if (daysUntil === 1) {
    return {
      title: `⏰ Payment Due Tomorrow`,
      message: `${label} of ${amountStr} is due tomorrow.`,
    };
  }
  return {
    title: `⏰ Upcoming Payment`,
    message: `${label} of ${amountStr} is due in ${daysUntil} days.`,
  };
}

export function computePaymentStats(payments: TrackedPayment[]) {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const pending = payments.filter((p) => p.status === 'pending');
  const paid = payments.filter((p) => p.status === 'paid');

  const dueThisMonth = pending.filter((p) => {
    const d = parseISO(p.dueDate);
    return d >= monthStart && d <= monthEnd;
  });

  const upcoming = pending
    .filter((p) => daysUntilDue(p.dueDate) >= 0 && daysUntilDue(p.dueDate) <= 14)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const overdue = pending
    .filter((p) => daysUntilDue(p.dueDate) < 0)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const recentlyPaid = paid
    .filter((p) => p.paidAt && isSameMonth(parseISO(p.paidAt), now))
    .sort((a, b) => (b.paidAt ?? '').localeCompare(a.paidAt ?? ''));

  return {
    dueThisMonthTotal: dueThisMonth.reduce((s, p) => s + p.amount, 0),
    dueThisMonthCount: dueThisMonth.length,
    upcoming,
    overdue,
    recentlyPaid,
    overdueTotal: overdue.reduce((s, p) => s + p.amount, 0),
  };
}

export function nextDueDate(
  current: string,
  recurrence: PaymentRecurrence,
): string | null {
  return getNextRecurringDate(current, recurrence);
}

// ── Recurring series with end date + automatic amount increase ─────────────
//
// A series is anchored at its first bill: seriesStartDate + seriesBaseAmount.
// Every generated occurrence carries seriesIndex (0-based) so the amount of
// any occurrence is a pure function of the anchor — editing or deleting one
// bill never rewrites history or drifts the escalation.

export function computeSeriesAmount(args: {
  baseAmount: number;
  increaseAmount?: number;
  increaseEvery?: PaymentIncreaseFrequency;
  startDate: string;
  date: string;
  index: number;
}): number {
  const step = args.increaseAmount ?? 0;
  if (step <= 0 || !args.increaseEvery) return args.baseAmount;
  let steps: number;
  if (args.increaseEvery === 'recurrence') {
    steps = args.index;
  } else {
    const s = parseISO(args.startDate);
    const d = parseISO(args.date);
    steps =
      args.increaseEvery === 'monthly'
        ? differenceInCalendarMonths(d, s)
        : differenceInCalendarYears(d, s);
  }
  steps = Math.max(0, steps);
  return Math.round((args.baseAmount + step * steps) * 100) / 100;
}

/** Amount for the occurrence that follows `current` in its series. */
export function nextSeriesAmount(
  current: TrackedPayment,
  nextDate: string,
  nextIndex: number,
): number {
  return computeSeriesAmount({
    baseAmount: current.seriesBaseAmount ?? current.amount,
    increaseAmount: current.increaseAmount,
    increaseEvery: current.increaseEvery,
    startDate: current.seriesStartDate ?? current.dueDate,
    date: nextDate,
    index: nextIndex,
  });
}

/** True when a recurrence may generate `date` (series end date respected). */
export function withinSeriesEnd(endDate: string | undefined, date: string): boolean {
  return !endDate || date <= endDate;
}

/** First `count` occurrences of a series (starting bill included) — used
 *  for the live preview in the Add/Edit Payment dialog. */
export function previewSeries(args: {
  dueDate: string;
  recurrence: PaymentRecurrence;
  endDate?: string;
  baseAmount: number;
  increaseAmount?: number;
  increaseEvery?: PaymentIncreaseFrequency;
  count?: number;
}): { date: string; amount: number }[] {
  const out: { date: string; amount: number }[] = [];
  const n = args.count ?? 4;
  let date = args.dueDate;
  let index = 0;
  if (!withinSeriesEnd(args.endDate, date)) return out;
  out.push({
    date,
    amount: computeSeriesAmount({
      baseAmount: args.baseAmount,
      increaseAmount: args.increaseAmount,
      increaseEvery: args.increaseEvery,
      startDate: args.dueDate,
      date,
      index,
    }),
  });
  while (out.length < n) {
    const next = getNextRecurringDate(date, args.recurrence);
    if (!next || !withinSeriesEnd(args.endDate, next)) break;
    index += 1;
    out.push({
      date: next,
      amount: computeSeriesAmount({
        baseAmount: args.baseAmount,
        increaseAmount: args.increaseAmount,
        increaseEvery: args.increaseEvery,
        startDate: args.dueDate,
        date: next,
        index,
      }),
    });
    date = next;
  }
  return out;
}

/** One-line summary of a recurring series for list rows. */
export function seriesSummary(p: TrackedPayment): string | null {
  if (!p.recurrence || p.recurrence === 'none') return null;
  const parts = [RECURRENCE_LABELS[p.recurrence] ?? p.recurrence];
  if (p.endDate) parts.push(`until ${p.endDate}`);
  const step = p.increaseAmount ?? 0;
  if (step > 0) {
    const every =
      p.increaseEvery === 'monthly'
        ? 'month'
        : p.increaseEvery === 'yearly'
          ? 'year'
          : 'cycle';
    parts.push(`+₹${step.toLocaleString('en-IN')}/${every}`);
  }
  return parts.join(' · ');
}

