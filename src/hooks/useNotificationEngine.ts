// src/hooks/useNotificationEngine.ts
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

    // ── Liability EMI & End Date Reminders ───────────────────────────────────
    liabilities?.forEach((liability) => {
      // Guard: skip if explicitly paid or paused
      if (liability.status === 'paid' || liability.status === 'paused') return;
      // Guard: skip if nothing outstanding
      if ((liability.outstanding ?? 0) <= 0) return;

      // 1. Overall Target / End Date Check (3 Days Before popup)
      if (liability.endDate) {
        const daysToTarget = differenceInDays(
          parseISO(liability.endDate),
          today,
        );
        if (daysToTarget >= 0 && daysToTarget <= 3) {
          addNotification({
            type: 'liability_due',
            title:
              daysToTarget === 0
                ? '🚨 Liability Due Today!'
                : `Liability Target Due in ${daysToTarget} Day${daysToTarget === 1 ? '' : 's'}`,
            message: `Repayment for "${liability.name}" (₹${liability.outstanding.toLocaleString('en-IN')}) is due.`,
            entityId: `liability_target_due_${liability.id}`,
            actionLabel: 'View Liabilities',
            actionPath: '/liabilities',
          });
        }
      }

      // 2. EMI Day Reminders
      if (
        liability.emiDay &&
        typeof liability.emiDay === 'number' &&
        liability.emiDay >= 1 &&
        liability.emiDay <= 31
      ) {
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
              daysUntilEMI === 0 ? 'today' : `on the ${dueDay}th`
            }.`,
            entityId: `liability_emi_${liability.id}`,
            actionLabel: 'View Liabilities',
            actionPath: '/liabilities',
          });
        }
      }
    });

    // ── Goal Completion & Progress Alerts ───────────────────────────────────
    goals?.forEach((goal) => {
      if (!goal.targetAmount || goal.targetAmount <= 0) return;

      const pct = (goal.currentAmount / goal.targetAmount) * 100;
      const isCompleted = pct >= 100 || goal.status === 'completed';

      if (isCompleted) {
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
  }, [policies?.length, liabilities?.length, goals?.length]);
}
