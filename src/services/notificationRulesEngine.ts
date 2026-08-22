/**
 * src/services/notificationRulesEngine.ts
 *
 * Client-side notification rules engine.
 * Runs after hydration and fires in-app notifications for events that haven't
 * already been notified today.  The Cloud Function handles the actual PUSH
 * (background) notifications; this handles the in-app bell.
 *
 * Each rule uses notificationStore.oncePerDay() / oncePerPeriod() to prevent
 * the same notification firing on every page visit.
 */

import { useNotificationStore } from '../store/notificationStore';

// ─── Types mirroring Firestore data shapes ────────────────────────────────────

interface TrackedPayment {
  id: string;
  title: string;
  amount: number;
  dueDate: string;       // YYYY-MM-DD
  status: string;        // 'pending' | 'paid'
  paymentType?: string;
}

interface InsurancePolicy {
  id: string;
  policyName: string;
  provider?: string;
  type?: string;
  coverageAmount?: number;
  renewalDate?: string;  // YYYY-MM-DD
  status?: string;
}

interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  status?: string;
  dueDate?: string;
}

interface Liability {
  id: string;
  name: string;
  outstanding: number;
  emiAmount?: number;
  endDate?: string;
  status?: string;
}

interface LendingBorrower {
  id: string;
  name: string;
  status: string;
  nextDueDate?: string;
}

interface SipPlan {
  id?: string;
  type?: string;       // 'budget' | 'instrument'
  budget?: number;
  name?: string;
  percentage?: number;
}

export interface NotificationRuleInput {
  trackedPayments:  TrackedPayment[];
  insurancePolicies: InsurancePolicy[];
  goals:             Goal[];
  liabilities:       Liability[];
  lendingBorrowers:  LendingBorrower[];
  sipPlans:          SipPlan[];
  subscriptionStatus?: string;
  trialEndDate?:      Date | null;
  planName?:          string;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function daysDiff(dateStr: string): number {
  const target = new Date(dateStr);
  const today  = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function fmt(n: number): string {
  return '₹' + Math.abs(Math.round(n)).toLocaleString('en-IN');
}

// ─── Main engine ─────────────────────────────────────────────────────────────

export function runNotificationRules(input: NotificationRuleInput): void {
  const store = useNotificationStore.getState();
  if (!store.uid) return;

  // ── 1. Tracked Payments ──────────────────────────────────────────────────
  for (const p of input.trackedPayments) {
    if (p.status === 'paid') continue;
    const days = daysDiff(p.dueDate);

    if ((days === 1 || days === 3 || days === 7) &&
        store.oncePerDay(`payment_tracker_due:${p.id}:${days}d`)) {
      store.addNotification({
        type: 'payment_tracker_due',
        title: '🔔 Payment Due Soon',
        message: `${p.title} of ${fmt(p.amount)} is due in ${days} day${days > 1 ? 's' : ''}.`,
        entityId: `payment_tracker_due:${p.id}`,
        severity: days <= 1 ? 'high' : days <= 3 ? 'medium' : 'low',
        actionLabel: 'View Payments',
        actionPath: '/payments',
        dueDate: p.dueDate,
      });
    }

    if (days < 0 && store.oncePerDay(`payment_tracker_overdue:${p.id}`)) {
      store.addNotification({
        type: 'payment_tracker_overdue',
        title: '⚠️ Payment Overdue',
        message: `${p.title} of ${fmt(p.amount)} was due ${Math.abs(days)} day${Math.abs(days) > 1 ? 's' : ''} ago.`,
        entityId: `payment_tracker_overdue:${p.id}`,
        severity: 'critical',
        actionLabel: 'View Payments',
        actionPath: '/payments',
        dueDate: p.dueDate,
      });
    }
  }

  // ── 2. Insurance Renewals ────────────────────────────────────────────────
  for (const pol of input.insurancePolicies) {
    if (!pol.renewalDate) continue;
    if (pol.status === 'expired') continue;
    const days = daysDiff(pol.renewalDate);

    const triggerDays = [30, 15, 7, 3, 1];
    for (const d of triggerDays) {
      if (days === d && store.oncePerDay(`insurance_renewal:${pol.id}:${d}d`)) {
        store.addNotification({
          type: 'insurance_renewal',
          title: '🛡️ Insurance Renewal',
          message: `${pol.policyName}${pol.provider ? ` (${pol.provider})` : ''} expires in ${d} day${d > 1 ? 's' : ''}.`,
          entityId: `insurance_renewal:${pol.id}`,
          severity: d <= 3 ? 'critical' : d <= 7 ? 'high' : 'medium',
          actionLabel: 'View Insurance',
          actionPath: '/insurance',
          dueDate: pol.renewalDate,
        });
      }
    }

    if (days < 0 && store.oncePerDay(`insurance_expired:${pol.id}`)) {
      store.addNotification({
        type: 'insurance_expired',
        title: '🚨 Insurance Expired',
        message: `${pol.policyName} expired ${Math.abs(days)} day${Math.abs(days) > 1 ? 's' : ''} ago. Renew immediately.`,
        entityId: `insurance_expired:${pol.id}`,
        severity: 'critical',
        actionLabel: 'View Insurance',
        actionPath: '/insurance',
      });
    }
  }

  // ── 3. Goals ─────────────────────────────────────────────────────────────
  for (const g of input.goals) {
    if (g.status === 'completed') continue;

    const pct = g.targetAmount > 0
      ? Math.round((g.currentAmount / g.targetAmount) * 100)
      : 0;

    // Goal achieved
    if (pct >= 100 && store.oncePerPeriod(`goal_achieved:${g.id}`, 'once')) {
      store.addNotification({
        type: 'goal_achieved',
        title: '🎯 Goal Achieved!',
        message: `Congratulations! You've reached your "${g.name}" goal of ${fmt(g.targetAmount)}.`,
        entityId: `goal_achieved:${g.id}`,
        severity: 'info',
        actionLabel: 'View Goals',
        actionPath: '/goals',
        periodKey: 'once',
      });
    }

    // Goal deadline approaching
    if (g.dueDate) {
      const days = daysDiff(g.dueDate);
      if (days === 30 && pct < 80 && store.oncePerDay(`goal_deadline:${g.id}:30d`)) {
        store.addNotification({
          type: 'goal_progress',
          title: '📊 Goal Deadline Approaching',
          message: `"${g.name}" — ${pct}% complete with 30 days left. Target: ${fmt(g.targetAmount)}.`,
          entityId: `goal_deadline:${g.id}`,
          severity: 'medium',
          actionLabel: 'View Goals',
          actionPath: '/goals',
          dueDate: g.dueDate,
        });
      }
      if (days === 7 && pct < 100 && store.oncePerDay(`goal_deadline:${g.id}:7d`)) {
        store.addNotification({
          type: 'goal_progress',
          title: '⏰ Goal Deadline in 7 Days',
          message: `"${g.name}" — ${pct}% complete. ${fmt(g.targetAmount - g.currentAmount)} still needed.`,
          entityId: `goal_deadline_7d:${g.id}`,
          severity: 'high',
          actionLabel: 'View Goals',
          actionPath: '/goals',
          dueDate: g.dueDate,
        });
      }
    }

    // Monthly contribution reminder (1st of month)
    const today = new Date();
    if (today.getDate() === 1 && pct < 100 &&
        store.oncePerPeriod(`goal_contrib_reminder:${g.id}`, new Date().toISOString().slice(0, 7))) {
      store.addNotification({
        type: 'goal_contribution_reminder',
        title: '💰 Monthly Goal Contribution',
        message: `Don't forget to contribute to "${g.name}" — ${pct}% reached so far.`,
        entityId: `goal_monthly:${g.id}`,
        severity: 'low',
        actionLabel: 'Add Contribution',
        actionPath: '/goals',
        periodKey: new Date().toISOString().slice(0, 7),
      });
    }
  }

  // ── 4. EMI / Liability dues ──────────────────────────────────────────────
  for (const l of input.liabilities) {
    if (l.status === 'paid' || l.status === 'returned') continue;
    if (!l.emiAmount || l.emiAmount <= 0) continue;

    // Remind on 1st of each month about EMI
    const today = new Date();
    const monthKey = new Date().toISOString().slice(0, 7);
    if (today.getDate() === 1 &&
        store.oncePerPeriod(`emi_reminder:${l.id}`, monthKey)) {
      store.addNotification({
        type: 'liability_emi',
        title: '💸 EMI Reminder',
        message: `${l.name} EMI of ${fmt(l.emiAmount)} is due this month. Outstanding: ${fmt(l.outstanding)}.`,
        entityId: `emi_monthly:${l.id}`,
        severity: 'medium',
        actionLabel: 'View Liabilities',
        actionPath: '/liabilities',
        periodKey: monthKey,
      });
    }
  }

  // ── 5. Lending overdue ───────────────────────────────────────────────────
  for (const b of input.lendingBorrowers) {
    if (b.status !== 'active') continue;
    if (!b.nextDueDate) continue;
    const days = daysDiff(b.nextDueDate);

    if (days === 3 && store.oncePerDay(`lending_due:${b.id}`)) {
      store.addNotification({
        type: 'lending_due',
        title: '🤝 Lending Due Soon',
        message: `Payment from ${b.name} is due in 3 days.`,
        entityId: `lending_due:${b.id}`,
        severity: 'medium',
        actionLabel: 'View Lending',
        actionPath: '/liabilities',
      });
    }
    if (days < 0 && store.oncePerDay(`lending_overdue:${b.id}`)) {
      store.addNotification({
        type: 'lending_overdue',
        title: '❗ Lending Overdue',
        message: `Payment from ${b.name} is ${Math.abs(days)} day${Math.abs(days) > 1 ? 's' : ''} overdue.`,
        entityId: `lending_overdue:${b.id}`,
        severity: 'high',
        actionLabel: 'View Lending',
        actionPath: '/liabilities',
      });
    }
  }

  // ── 6. SIP Reminder — 5th of every month ────────────────────────────────
  const sipBudget = input.sipPlans.find((s) => s.type === 'budget');
  if (sipBudget?.budget && sipBudget.budget > 0) {
    const today = new Date();
    const monthKey = new Date().toISOString().slice(0, 7);
    if (today.getDate() === 5 &&
        store.oncePerPeriod('sip_monthly_reminder', monthKey)) {
      store.addNotification({
        type: 'sip_reminder',
        title: '📅 Monthly SIP Reminder',
        message: `Your monthly SIP budget is ${fmt(sipBudget.budget)}. Have you invested this month?`,
        entityId: `sip_monthly:${monthKey}`,
        severity: 'low',
        actionLabel: 'View SIP Plan',
        actionPath: '/investments',
        periodKey: monthKey,
      });
    }
  }

  // ── 7. Subscription / trial ──────────────────────────────────────────────
  if (input.subscriptionStatus === 'active' && input.trialEndDate) {
    const days = daysDiff(input.trialEndDate.toISOString().slice(0, 10));

    if (days === 3 && store.oncePerDay('trial_ending_3d')) {
      store.addNotification({
        type: 'trial_ending',
        title: '⏳ Trial Ending Soon',
        message: 'Your Fintrackly free trial ends in 3 days. Upgrade to keep all premium features.',
        entityId: 'trial_ending_3d',
        severity: 'high',
        actionLabel: 'Upgrade Now',
        actionPath: '/pricing',
      });
    }
    if (days === 1 && store.oncePerDay('trial_ending_1d')) {
      store.addNotification({
        type: 'trial_ending',
        title: '⏳ Trial Ends Tomorrow',
        message: 'Your free trial ends tomorrow. Upgrade now to avoid losing access.',
        entityId: 'trial_ending_1d',
        severity: 'critical',
        actionLabel: 'Upgrade Now',
        actionPath: '/pricing',
      });
    }
  }

  if (input.subscriptionStatus === 'expired' && store.oncePerDay('subscription_expired_daily')) {
    store.addNotification({
      type: 'subscription_expired',
      title: '🔒 Subscription Expired',
      message: 'Premium features are locked. Subscribe to restore full access.',
      entityId: 'subscription_expired',
      severity: 'critical',
      actionLabel: 'Subscribe',
      actionPath: '/pricing',
    });
  }
}
