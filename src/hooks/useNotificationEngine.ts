// src/hooks/useNotificationEngine.ts
//
// UPDATED:
//  • Liability due date bell: fires 3 days before endDate (not just EMI day)
//  • Skips notifications for returned liabilities
//  • Skips goal notifications for completed/success goals
//  • New notification type: 'liability_due_date' for endDate-based alerts

import { differenceInDays, parseISO } from 'date-fns';

import { useEffect } from 'react';
import { useNotificationStore } from '../store/notificationStore';
import { usePortfolioStore } from '../store/portfolioStore';

export function useNotificationEngine() {
  const policies = usePortfolioStore((s) => s.insurancePolicies);
  const liabilities = usePortfolioStore((s) => s.liabilities);
  const goals = usePortfolioStore((s) => s.goals);
  const addNotification = useNotificationStore((s) => s.addNotification);

  useEffect(() => {
    const today = new Date();

    // ── Insurance Renewal Alerts ────────────────────────────────────────────
    policies?.forEach((policy) => {
      if (!policy.renewalDate) return;

      const days = differenceInDays(parseISO(policy.renewalDate), today);

      if (days <= 30 && days >= -7) {
        const isUrgent = days <= 7;
        addNotification({
          type: 'insurance_renewal',
          title: isUrgent
            ? '🚨 Urgent: Insurance Renewal Due'
            : 'Insurance Renewal Upcoming',
          message: `${policy.policyName} (${policy.provider}) ${
            days < 0
              ? `expired ${Math.abs(days)} days ago`
              : `expires in ${days} day${days === 1 ? '' : 's'}`
          }. Premium: ₹${policy.premiumAmount.toLocaleString('en-IN')}`,
          dueDate: policy.renewalDate,
          entityId: `insurance_${policy.id}`,
          actionLabel: 'View Insurance',
          actionPath: '/insurance',
        });
      }
    });

    // ── Liability EMI Reminders (EMI Day-based) ─────────────────────────────
    liabilities?.forEach((liability) => {
      // Skip returned liabilities entirely
      if (liability.status === 'returned') return;

      // Guard: emiDay must be a valid number 1-31
      if (
        !liability.emiDay ||
        typeof liability.emiDay !== 'number' ||
        liability.emiDay < 1 ||
        liability.emiDay > 31
      )
        return;

      // Guard: skip if explicitly paid or paused
      if (liability.status === 'paid' || liability.status === 'paused') return;

      // Guard: skip if nothing outstanding
      if ((liability.outstanding ?? 0) <= 0) return;

      const todayDate = today.getDate();
      const dueDay = liability.emiDay;

      let daysUntilEMI: number;
      if (dueDay >= todayDate) {
        daysUntilEMI = dueDay - todayDate;
      } else {
        const nextMonth = new Date(
          today.getFullYear(),
          today.getMonth() + 1,
          dueDay,
        );
        daysUntilEMI = differenceInDays(nextMonth, today);
      }

      if (daysUntilEMI <= 5) {
        const emiStr = liability.emiAmount
          ? `₹${liability.emiAmount.toLocaleString('en-IN')}`
          : 'Check amount';

        addNotification({
          type: 'liability_due',
          title:
            daysUntilEMI === 0
              ? 'EMI Due Today!'
              : `EMI Due in ${daysUntilEMI} Day${daysUntilEMI === 1 ? '' : 's'}`,
          message: `${liability.name} — EMI of ${emiStr} is due ${
            daysUntilEMI === 0
              ? 'today'
              : `on the ${dueDay}${['th', 'st', 'nd', 'rd'][[0, 1, 2, 3].includes(dueDay % 10) && ![11, 12, 13].includes(dueDay % 100) ? dueDay % 10 : 0] ?? 'th'}`
          }.`,
          entityId: `liability_emi_${liability.id}`,
          actionLabel: 'View Liabilities',
          actionPath: '/liabilities',
        });
      }
    });

    // ── Liability Due Date Alerts (endDate-based, 3-day warning) ───────────
    // This fires for ALL liability types (including personal loans) when
    // their endDate (repayment date) is within 3 days.
    liabilities?.forEach((liability) => {
      // Skip returned, paid, paused
      if (
        liability.status === 'returned' ||
        liability.status === 'paid' ||
        liability.status === 'paused'
      )
        return;

      if (!liability.endDate) return;
      if ((liability.outstanding ?? 0) <= 0) return;

      const days = differenceInDays(parseISO(liability.endDate), today);

      // Fire when 3 days or less (including 0 = today, and -1 = overdue)
      if (days <= 3 && days >= -1) {
        addNotification({
          type: 'liability_due',
          title:
            days < 0
              ? `⚠️ Overdue: ${liability.name}`
              : days === 0
                ? `🔴 Due Today: ${liability.name}`
                : `⏰ Due in ${days} Day${days === 1 ? '' : 's'}: ${liability.name}`,
          message:
            days < 0
              ? `Repayment of ₹${liability.outstanding.toLocaleString('en-IN')} for "${liability.name}" was due on ${new Date(liability.endDate).toLocaleDateString('en-IN')}.`
              : days === 0
                ? `₹${liability.outstanding.toLocaleString('en-IN')} for "${liability.name}" is due today.`
                : `₹${liability.outstanding.toLocaleString('en-IN')} for "${liability.name}" is due on ${new Date(liability.endDate).toLocaleDateString('en-IN')}.`,
          dueDate: liability.endDate,
          entityId: `liability_duedate_${liability.id}_${days}`,
          actionLabel: 'View Liabilities',
          actionPath: '/liabilities',
        });
      }
    });

    // ── Goal Completion & Progress Alerts ───────────────────────────────────
    goals?.forEach((goal) => {
      if (!goal.targetAmount || goal.targetAmount <= 0) return;

      // Skip goals already marked as completed/success
      if (goal.status === 'completed' || goal.status === 'success') return;

      const pct = (goal.currentAmount / goal.targetAmount) * 100;

      if (pct >= 100) {
        addNotification({
          type: 'goal_achieved',
          title: '🎉 Goal Achieved!',
          message: `You've reached your "${goal.name}" goal of ₹${goal.targetAmount.toLocaleString('en-IN')}. Mark it as success!`,
          entityId: `goal_achieved_${goal.id}`,
          actionLabel: 'View Goals',
          actionPath: '/goals',
        });
      } else if (pct >= 75) {
        addNotification({
          type: 'goal_progress',
          title: 'Goal Almost There — 75%!',
          message: `Your "${goal.name}" goal is ${pct.toFixed(0)}% complete. ₹${(goal.targetAmount - goal.currentAmount).toLocaleString('en-IN')} remaining.`,
          entityId: `goal_75_${goal.id}`,
          actionLabel: 'View Goals',
          actionPath: '/goals',
        });
      }
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [policies?.length, liabilities?.length, goals?.length]);
}
