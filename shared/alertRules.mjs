/**
 * shared/alertRules.mjs
 *
 * THE ONE RULE ENGINE for "something is due / happening soon".
 *
 * Before this file the same money rules existed three times — in the daily
 * email job, in the browser notification hook, and in a dead Cloud Function —
 * with different thresholds, different wording and different de-duplication
 * keys, so the app and the email disagreed about what was urgent.
 *
 * Consumers:
 *   • scripts/send-notifications.js  (daily 08:00 IST email digest)
 *   • src/hooks/useDerivedNotifications.ts (the in-app bell)
 *
 * Written as dependency-free ESM (.mjs) so Node can `import()` it and Vite can
 * bundle it from the same file. Types live in shared/alertRules.d.mts.
 *
 * Keys are OCCURRENCE-scoped: `payment:due_today:{id}:{dueDate}`. One key = one
 * real-world event, so a reminder for a bill can fire at most once per
 * checkpoint (T-7, T-3, T-1, due, overdue…) and a new month's EMI is a new
 * occurrence rather than a "repeat" of the old one.
 */

const DAY_MS = 86_400_000;

/** Checkpoints each rule fires at. Shared so the app and the email cannot drift. */
export const ALERT_CHECKPOINTS = {
  paymentDefaults: [1, 3, 7],
  paymentOverdue: [-1, -3, -6, -9, -12],
  insurance: [30, 15, 7, 3, 1, 0],
  insuranceGraceAfter: -3,
  emi: [0, 1, 3],
  liabilityFinalSoon: [1, 2, 3],
  liabilityFinalOverdue: [-1, -3, -7, -14],
  investmentMaturity: [7, 30],
  receivable: [1, 5],
  receivableOverdue: [-1, -7, -14, -21, -30],
};

const inr = (n) => '₹' + Math.abs(Math.round(Number(n) || 0)).toLocaleString('en-IN');

/** Local midnight for an ISO `yyyy-mm-dd` (or ISO timestamp) string. */
function dayParts(iso) {
  const [datePart] = String(iso).split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function todayMidnight() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Whole days from today to `iso` (negative = in the past). */
export function daysUntil(iso) {
  if (!iso) return NaN;
  return Math.round((dayParts(iso) - todayMidnight()) / DAY_MS);
}

/** `yyyy-mm-dd` for a Date, without timezone drift. */
function toISODate(d) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Next calendar date on or after today whose day-of-month is `emiDay`. */
export function nextMonthlyOccurrence(emiDay, from = todayMidnight()) {
  const safeDay = Math.min(emiDay, 28); // Feb-proof: days 29–31 collapse to 28
  let d = new Date(from.getFullYear(), from.getMonth(), safeDay);
  if (d < from) d = new Date(from.getFullYear(), from.getMonth() + 1, safeDay);
  return { date: toISODate(d), days: Math.round((d - from) / DAY_MS) };
}

/** True when the user has switched this category on (missing = on). */
const enabled = (settings, flag) => settings?.[flag] !== false;

function alert(fields) {
  return {
    severity: 'medium',
    clickUrl: '/dashboard',
    actionLabel: 'View Details',
    ...fields,
  };
}

/**
 * Money alerts that are due for `data` right now.
 *
 * @param {{
 *   trackedPayments?: any[], pendingPayments?: any[], liabilities?: any[],
 *   investments?: any[], insurancePolicies?: any[],
 * }} data   Decrypted collections for one user.
 * @param {Record<string, boolean>} [settings] notificationSettings/config flags.
 * @returns {Array<{
 *   key: string, kind: string, severity: string, title: string, body: string,
 *   clickUrl: string, actionLabel: string, notifType: string, entityId: string,
 *   dueDate: string,
 * }>}
 */
export function buildMoneyAlerts(data, settings = {}) {
  // Master switch: the settings page calls it `pushEnabled` (legacy name) but it
  // pauses every channel, because nothing else can wake the user either.
  if (settings?.pushEnabled === false) return [];
  const out = [];
  const C = ALERT_CHECKPOINTS;

  // ── Bill / payment tracker ──────────────────────────────────────────────
  if (enabled(settings, 'paymentReminders')) {
    for (const p of data.trackedPayments || []) {
      if (!p || p.status === 'paid' || !p.dueDate) continue;
      const days = daysUntil(p.dueDate);
      if (Number.isNaN(days)) continue;
      const amount = inr(p.amount);
      const label = p.title || p.paymentType || 'Payment';
      const reminderDays =
        Array.isArray(p.reminderDays) && p.reminderDays.length
          ? p.reminderDays
          : C.paymentDefaults;

      let variant = null;
      let severity = 'medium';
      let title = '';
      let body = '';
      if (days === 0) {
        variant = 'due_today';
        severity = 'high';
        title = `🔔 Payment due today: ${label}`;
        body = `${label} — ${amount} is due today.`;
      } else if (days > 0 && reminderDays.includes(days)) {
        variant = `due_in_${days}d`;
        severity = days <= 1 ? 'high' : 'medium';
        title = `💳 Payment due in ${days} days: ${label}`;
        body = `${label} — ${amount} is due on ${p.dueDate}.`;
      } else if (days < 0 && C.paymentOverdue.includes(days)) {
        variant = `overdue_${Math.abs(days)}d`;
        severity = 'critical';
        const abs = Math.abs(days);
        title = `🚨 Payment overdue ${abs} day${abs === 1 ? '' : 's'}: ${label}`;
        body = `${label} — ${amount} was due ${p.dueDate} (${abs} day${abs === 1 ? '' : 's'} ago).`;
      }
      if (!variant) continue;
      out.push(
        alert({
          key: `payment:${variant}:${p.id}:${p.dueDate}`,
          kind: 'payment',
          variant,
          severity,
          title,
          body,
          clickUrl: '/payments',
          actionLabel: 'Open Bill Reminders',
          notifType: days < 0 ? 'payment_tracker_overdue' : 'payment_tracker_due',
          entityId: String(p.id),
          dueDate: p.dueDate,
        }),
      );
    }
  }

  // ── Insurance renewals ──────────────────────────────────────────────────
  if (enabled(settings, 'insuranceReminders')) {
    for (const pol of data.insurancePolicies || []) {
      if (!pol || !pol.renewalDate) continue;
      const days = daysUntil(pol.renewalDate);
      if (Number.isNaN(days)) continue;
      const name = pol.policyName || pol.provider || 'Policy';

      let variant = null;
      let severity = 'medium';
      let title = '';
      let body = '';
      if (days < 0 && days >= C.insuranceGraceAfter) {
        variant = 'expired';
        severity = 'critical';
        title = `🚨 Insurance expired: ${name}`;
        body = `${name} lapsed on ${pol.renewalDate}. Renew now to stay covered.`;
      } else if (days >= 0 && C.insurance.includes(days)) {
        variant = `due_in_${days}d`;
        severity = days <= 3 ? 'high' : 'medium';
        title =
          days === 0
            ? `🛡️ Insurance premium due today: ${name}`
            : `🛡️ Insurance renewal in ${days} days: ${name}`;
        body = `Premium ${inr(pol.premiumAmount)} is due on ${pol.renewalDate}.`;
      }
      if (!variant) continue;
      out.push(
        alert({
          key: `insurance:${variant}:${pol.id}:${pol.renewalDate}`,
          kind: 'insurance',
          variant,
          severity,
          title,
          body,
          clickUrl: '/insurance',
          actionLabel: 'Open Insurance',
          notifType: variant === 'expired' ? 'insurance_expired' : 'insurance_renewal',
          entityId: String(pol.id),
          dueDate: pol.renewalDate,
        }),
      );
    }
  }

  // ── Liabilities: monthly EMI day + final payment ────────────────────────
  if (enabled(settings, 'emiReminders')) {
    for (const l of data.liabilities || []) {
      if (!l) continue;
      if (['paid', 'returned', 'paused'].includes(l.status)) continue;
      if ((l.outstanding ?? 0) <= 0) continue;
      const amount = inr(l.emiAmount);
      const name = l.name || 'Loan';

      if (typeof l.emiDay === 'number' && l.emiDay >= 1 && l.emiDay <= 31) {
        const { date, days } = nextMonthlyOccurrence(l.emiDay);
        if (C.emi.includes(days)) {
          const variant = days === 0 ? 'due_today' : `due_in_${days}d`;
          out.push(
            alert({
              key: `emi:${variant}:${l.id}:${date}`,
              kind: 'emi',
              variant,
              severity: days === 0 ? 'high' : 'medium',
              title:
                days === 0
                  ? `💸 EMI due today: ${name}`
                  : `💸 EMI due in ${days} day${days === 1 ? '' : 's'}: ${name}`,
              body: `${name} — EMI of ${amount} is due on the ${l.emiDay} of every month (${date}). Outstanding: ${inr(l.outstanding)}.`,
              clickUrl: '/wealth?tab=liabilities',
              actionLabel: 'Open Liabilities',
              notifType: 'liability_emi',
              entityId: String(l.id),
              dueDate: date,
            }),
          );
        }
      }

      if (l.endDate) {
        const days = daysUntil(l.endDate);
        const isFinal =
          days === 0 || C.liabilityFinalSoon.includes(days) || C.liabilityFinalOverdue.includes(days);
        if (isFinal) {
          const variant = days === 0 ? 'final_today' : days > 0 ? `final_in_${days}d` : `final_overdue_${Math.abs(days)}d`;
          out.push(
            alert({
              key: `liability-final:${variant}:${l.id}:${l.endDate}`,
              kind: 'liability-final',
              variant,
              severity: days < 0 ? 'critical' : days === 0 ? 'high' : 'medium',
              title:
                days < 0
                  ? `⚠️ Final payment overdue ${Math.abs(days)} days: ${name}`
                  : days === 0
                    ? `🔴 Final payment due today: ${name}`
                    : `⏰ Final payment in ${days} days: ${name}`,
              body: `${name} closes on ${l.endDate} — ${inr(l.outstanding)} remaining.`,
              clickUrl: '/wealth?tab=liabilities',
              actionLabel: 'Open Liabilities',
              notifType: days < 0 ? 'liability_overdue' : 'liability_due',
              entityId: String(l.id),
              dueDate: l.endDate,
            }),
          );
        }
      }
    }
  }

  // ── Bond / FD maturity ──────────────────────────────────────────────────
  if (enabled(settings, 'investmentAlerts')) {
    for (const inv of data.investments || []) {
      if (!inv || !inv.maturityDate) continue;
      if (inv.type !== 'bond' && inv.type !== 'fixed_deposit') continue;
      const days = daysUntil(inv.maturityDate);
      const name = inv.name || 'Investment';
      const instrument = inv.type === 'bond' ? 'Bond' : 'FD';

      let variant = null;
      let severity = 'low';
      let title = '';
      let body = '';
      if (days <= 0) {
        variant = 'matured';
        severity = 'info';
        title = `🎉 ${instrument} matured: ${name}`;
        body = `"${name}" matured on ${inv.maturityDate}. Proceeds are ready to reinvest.`;
      } else if (C.investmentMaturity.includes(days)) {
        variant = `maturing_in_${days}d`;
        severity = 'low';
        title = `⏰ ${instrument} maturing in ${days} days: ${name}`;
        body = `"${name}" matures on ${inv.maturityDate}.`;
      }
      if (!variant) continue;
      out.push(
        alert({
          key: `investment:${variant}:${inv.id}:${inv.maturityDate}`,
          kind: 'investment',
          variant,
          severity,
          title,
          body,
          clickUrl: '/wealth?tab=assets',
          actionLabel: 'Open Investments',
          notifType: days <= 0 ? 'investment_matured' : 'investment_maturity_upcoming',
          entityId: String(inv.id),
          dueDate: inv.maturityDate,
        }),
      );
    }
  }

  // ── Money owed to the user ──────────────────────────────────────────────
  if (enabled(settings, 'lendingReminders')) {
    for (const p of data.pendingPayments || []) {
      if (!p || p.status !== 'pending' || !p.expectedPaymentDate) continue;
      const days = daysUntil(p.expectedPaymentDate);
      const amount = inr(p.amount);
      const who = p.buyerName || 'a borrower';
      const item = p.itemDescription || 'the item';

      let variant = null;
      let severity = 'low';
      let title = '';
      let body = '';
      if (days === 0) {
        variant = 'due_today';
        severity = 'high';
        title = `🔴 Receivable due today from ${who}`;
        body = `${who} owes ${amount} for ${item}, expected today. Follow up.`;
      } else if (C.receivable.includes(days)) {
        variant = `due_in_${days}d`;
        severity = 'low';
        title = `💰 Incoming in ${days} days from ${who}`;
        body = `${amount} receivable on ${p.expectedPaymentDate} for ${item}.`;
      } else if (days < 0 && C.receivableOverdue.includes(days)) {
        variant = `overdue_${Math.abs(days)}d`;
        severity = Math.abs(days) >= 14 ? 'high' : 'medium';
        title = `⚠️ Receivable overdue ${Math.abs(days)} days: ${who}`;
        body = `${amount} for ${item} was due ${p.expectedPaymentDate}. Chase it up.`;
      }
      if (!variant) continue;
      out.push(
        alert({
          key: `receivable:${variant}:${p.id}:${p.expectedPaymentDate}`,
          kind: 'receivable',
          variant,
          severity,
          title,
          body,
          clickUrl: '/wealth?tab=liabilities&section=pending-payments',
          actionLabel: 'Open Money Owed To Me',
          notifType: days < 0 ? 'pending_payment_overdue' : 'pending_payment_due',
          entityId: String(p.id),
          dueDate: p.expectedPaymentDate,
        }),
      );
    }
  }

  return out;
}

/** Sort by severity, most urgent first — used by both renderers. */
const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info'];

export function sortBySeverity(alerts) {
  return [...alerts].sort(
    (a, b) =>
      SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  );
}
