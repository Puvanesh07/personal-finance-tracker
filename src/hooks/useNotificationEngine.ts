// src/hooks/useNotificationEngine.ts
// Automatically generates notifications from portfolio data
// Call once at AppLayout level

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

    // ── Insurance Renewal Alerts ─────────────────────────────────────────
    policies?.forEach((policy) => {
      const days = differenceInDays(parseISO(policy.renewalDate), today);
      if (days <= 30 && days >= -7) {
        const urgency = days <= 7 ? 'urgent' : 'upcoming';
        addNotification({
          type: 'insurance_renewal',
          title: `${urgency === 'urgent' ? '🚨 Urgent: ' : ''}Insurance Renewal Due`,
          message: `${policy.policyName} (${policy.provider}) expires in ${days < 0 ? `${Math.abs(days)} days ago` : `${days} days`}. Premium: ₹${policy.premiumAmount.toLocaleString('en-IN')}`,
          dueDate: policy.renewalDate,
          entityId: `insurance_${policy.id}`,
          actionLabel: 'View Insurance',
          actionPath: '/insurance',
        });
      }
    });

    // // ── Liability EMI Due ────────────────────────────────────────────────
    // liabilities?.forEach((liability) => {
    //   if (liability.emiDay && liability.status === 'active') {
    //     const dueDay = liability.emiDay as number;
    //     const todayDate = today.getDate();
    //     const daysUntilEMI = dueDay >= todayDate ? dueDay - todayDate : (new Date(today.getFullYear(), today.getMonth() + 1, dueDay).getDate()) - todayDate + 30;
    //     if (daysUntilEMI <= 5) {
    //       addNotification({
    //         type: 'liability_due',
    //         title: 'EMI Payment Reminder',
    //         message: `${liability.name} EMI of ₹${liability.emiAmount?.toLocaleString('en-IN') || 'N/A'} is due in ${daysUntilEMI} days.`,
    //         entityId: `liability_${liability.id}`,
    //         actionLabel: 'View Liabilities',
    //         actionPath: '/liabilities',
    //       });
    //     }
    //   }
    // });

    // ── Goal Progress ────────────────────────────────────────────────────
    goals?.forEach((goal) => {
      if (goal.currentAmount >= goal.targetAmount) {
        addNotification({
          type: 'goal_achieved',
          title: '🎉 Goal Achieved!',
          message: `Congratulations! You've reached your "${goal.name}" goal of ₹${goal.targetAmount.toLocaleString('en-IN')}.`,
          entityId: `goal_achieved_${goal.id}`,
          actionLabel: 'View Goals',
          actionPath: '/goals',
        });
      } else if (goal.targetAmount > 0) {
        const pct = (goal.currentAmount / goal.targetAmount) * 100;
        if (pct >= 75 && pct < 100) {
          addNotification({
            type: 'goal_progress',
            title: 'Goal 75% Complete!',
            message: `Your "${goal.name}" goal is ${pct.toFixed(0)}% complete. Keep going!`,
            entityId: `goal_75_${goal.id}`,
            actionLabel: 'View Goals',
            actionPath: '/goals',
          });
        }
      }
    });
  }, [policies?.length, liabilities?.length, goals?.length]);
}
