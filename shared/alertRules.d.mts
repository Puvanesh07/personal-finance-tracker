/**
 * shared/alertRules.d.mts — types for the hand-written alertRules.mjs.
 *
 * The implementation is plain JS on purpose: it has to be importable by the
 * Node email job (no build step) and by the browser bundle from one file.
 */

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface MoneyAlert {
  /** Occurrence-scoped de-duplication key, e.g. `payment:due_today:tp_1:2026-09-30`. */
  key: string;
  kind: string;
  variant: string;
  severity: AlertSeverity;
  title: string;
  body: string;
  /** In-app route, also used as the email click-through path. */
  clickUrl: string;
  actionLabel: string;
  /** Matches the `type` values stored in notifications/{uid}/items. */
  notifType: string;
  entityId: string;
  dueDate: string;
}

export interface AlertSourceData {
  trackedPayments?: Array<Record<string, any>> | null;
  pendingPayments?: Array<Record<string, any>> | null;
  liabilities?: Array<Record<string, any>> | null;
  investments?: Array<Record<string, any>> | null;
  insurancePolicies?: Array<Record<string, any>> | null;
}

/** Category flags from users/{uid}/notificationSettings/config. Missing = on. */
export type AlertSettings = Partial<Record<
  | 'pushEnabled'
  | 'paymentReminders'
  | 'insuranceReminders'
  | 'goalReminders'
  | 'emiReminders'
  | 'sipReminders'
  | 'investmentAlerts'
  | 'subscriptionAlerts'
  | 'monthlyReport',
  boolean
>>;

export declare const ALERT_CHECKPOINTS: {
  paymentDefaults: number[];
  paymentOverdue: number[];
  insurance: number[];
  insuranceGraceAfter: number;
  emi: number[];
  liabilityFinalSoon: number[];
  liabilityFinalOverdue: number[];
  investmentMaturity: number[];
  receivable: number[];
  receivableOverdue: number[];
};

export declare function daysUntil(iso: string | undefined | null): number;

export declare function nextMonthlyOccurrence(
  emiDay: number,
  from?: Date,
): { date: string; days: number };

export declare function buildMoneyAlerts(
  data: AlertSourceData,
  settings?: AlertSettings,
): MoneyAlert[];

export declare function sortBySeverity<T extends { severity: AlertSeverity }>(
  alerts: T[],
): T[];
