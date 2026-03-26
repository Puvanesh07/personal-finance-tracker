// src/hooks/useNotificationEngine.ts
//
// Automatically generates in-app notifications from portfolio data.
// Call once inside AppLayout (already wired in AppLayout.tsx).
//
// FIXED: Uses only fields that actually exist on the Liability type.
//  • emiDay   — optional number (day of month EMI is due)
//  • emiAmount — optional number
//  • status   — optional 'active' | 'paid' | 'paused'
// All three are the new optional fields added to investmentTypes.ts.

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

    // ── Liability EMI Reminders ─────────────────────────────────────────────
    // Only fires when: emiDay is set AND status is 'active' (or status not set)
    liabilities?.forEach((liability) => {
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

      // Days until next EMI (handles month rollover)
      let daysUntilEMI: number;
      if (dueDay >= todayDate) {
        daysUntilEMI = dueDay - todayDate;
      } else {
        // Already passed this month — calculate days to next month's dueDay
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

    // ── Goal Completion & Progress Alerts ───────────────────────────────────
    goals?.forEach((goal) => {
      if (!goal.targetAmount || goal.targetAmount <= 0) return;

      const pct = (goal.currentAmount / goal.targetAmount) * 100;

      if (pct >= 100) {
        addNotification({
          type: 'goal_achieved',
          title: '🎉 Goal Achieved!',
          message: `You've reached your "${goal.name}" goal of ₹${goal.targetAmount.toLocaleString('en-IN')}. Congratulations!`,
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

    // Re-run only when list lengths change (avoids infinite loops)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [policies?.length, liabilities?.length, goals?.length]);
}
