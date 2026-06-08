import type {
  PaymentRecurrence,
  PaymentTrackerType,
  TrackedPayment,
} from '../types/investmentTypes';
import {
  differenceInDays,
  endOfMonth,
  isSameMonth,
  parseISO,
  startOfMonth,
} from 'date-fns';

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
  return differenceInDays(parseISO(dueDate), new Date());
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
  if (recurrence === 'none') return null;
  const d = parseISO(current);
  if (recurrence === 'monthly') {
    d.setMonth(d.getMonth() + 1);
  } else {
    d.setFullYear(d.getFullYear() + 1);
  }
  return d.toISOString().split('T')[0];
}
