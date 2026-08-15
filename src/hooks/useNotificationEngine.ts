// src/hooks/useNotificationEngine.ts
import { differenceInDays, parseISO } from 'date-fns';

import { useEffect } from 'react';
import { useNotificationStore } from '../store/notificationStore';
import { usePortfolioStore } from '../store/portfolioStore';
import {
  buildPaymentReminderMessage,
  daysUntilDue,
} from '../utils/paymentTracker';

/** Session + day guard so StrictMode / re-renders never fire the same alert twice. */
const firedKeys = new Set<string>();

function onceToday(key: string): boolean {
  const full = `${new Date().toDateString()}:${key}`;
  if (firedKeys.has(full)) return false;
  firedKeys.add(full);
  return true;
}

export function useNotificationEngine() {
  const policies = usePortfolioStore((s) => s.insurancePolicies);
  const liabilities = usePortfolioStore((s) => s.liabilities);
  const goals = usePortfolioStore((s) => s.goals);
  const investments = usePortfolioStore((s) => s.investments);
  const pendingPayments = usePortfolioStore((s) => s.pendingPayments);
  const trackedPayments = usePortfolioStore((s) => s.trackedPayments);
  const addNotification = useNotificationStore((s) => s.addNotification);
  const addSoldTrade = usePortfolioStore((s) => s.addSoldTrade);
  const deleteInvestment = usePortfolioStore((s) => s.deleteInvestment);

  useEffect(() => {
    const today = new Date();

    // ── Investment Maturity Alerts & Auto-Profit Realization ───────────────
    investments?.forEach((inv) => {
      if (inv.type === 'bond' || inv.type === 'fixed_deposit') {
        if (!inv.maturityDate) return;

        const days = differenceInDays(parseISO(inv.maturityDate), today);

        // 1. Auto-update to profit if matured (0 days or past)
        if (days <= 0) {
          if (!onceToday(`matured_auto_${inv.id}`)) return;

          const invested = inv.investedAmount || 0;
          const rate = inv.interestRate || 0;
          const duration = inv.durationMonths || 0;

          // Simple interest calculation: P * R * T (Years)
          const profit = invested * (rate / 100) * (duration / 12);
          const sellPrice = invested + profit;

          // Automatically record the profit in SoldTrades
          void addSoldTrade({
            investmentName: inv.name,
            investmentType: inv.type,
            buyPrice: invested,
            sellPrice: sellPrice,
            soldDate: new Date().toISOString(),
            notes: 'Auto-realized upon reaching maturity date.',
            platform: inv.platform,
          });

          // Delete the original active investment
          void deleteInvestment(inv.id);

          // Notify the user of the automatic action
          addNotification({
            type: 'investment_matured',
            title: '🎉 Investment Matured & Profit Booked!',
            message: `Your ${inv.type === 'bond' ? 'Bond' : 'FD'} "${inv.name}" has reached maturity. ₹${profit.toLocaleString('en-IN', { maximumFractionDigits: 0 })} profit has been automatically added to your realized profits.`,
            dueDate: inv.maturityDate,
            entityId: `matured_auto_${inv.id}`,
            actionLabel: 'View Profits',
            actionPath: '/profits',
          });
        } else if (days <= 7) {
          // 2. Upcoming maturity notification (stable id — one per investment per day)
          if (!onceToday(`maturity_upcoming_${inv.id}`)) return;
          addNotification({
            type: 'investment_maturity_upcoming',
            title: '⏰ Upcoming Maturity',
            message: `Your ${inv.type === 'bond' ? 'Bond' : 'FD'} "${inv.name}" is maturing in ${days} day${days === 1 ? '' : 's'}!`,
            dueDate: inv.maturityDate,
            entityId: `maturity_upcoming_${inv.id}`,
            actionLabel: 'View Investments',
            actionPath: '/investments',
          });
        }
      }
    });

    // ── Insurance Renewal Alerts ────────────────────────────────────────────
    policies?.forEach((policy) => {
      if (!policy.renewalDate) return;

      const days = differenceInDays(parseISO(policy.renewalDate), today);

      if (days <= 30 && days >= -7) {
        if (!onceToday(`insurance_${policy.id}`)) return;
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
      if (liability.status === 'returned') return;

      if (
        !liability.emiDay ||
        typeof liability.emiDay !== 'number' ||
        liability.emiDay < 1 ||
        liability.emiDay > 31
      )
        return;

      if (liability.status === 'paid' || liability.status === 'paused') return;
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
        if (!onceToday(`liability_emi_${liability.id}`)) return;
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
    liabilities?.forEach((liability) => {
      if (
        liability.status === 'returned' ||
        liability.status === 'paid' ||
        liability.status === 'paused'
      )
        return;

      if (!liability.endDate) return;
      if ((liability.outstanding ?? 0) <= 0) return;

      const days = differenceInDays(parseISO(liability.endDate), today);

      if (days <= 3 && days >= -1) {
        if (!onceToday(`liability_duedate_${liability.id}`)) return;
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
          entityId: `liability_duedate_${liability.id}`,
          actionLabel: 'View Liabilities',
          actionPath: '/liabilities',
        });
      }
    });

    // ── Pending Payment Reminders (buyer/vendor receivables) ───────────────────
    pendingPayments?.forEach((payment) => {
      if (payment.status !== 'pending' || !payment.expectedPaymentDate) return;

      const days = differenceInDays(
        parseISO(payment.expectedPaymentDate),
        today,
      );

      if (days <= 5 && days >= -7) {
        if (!onceToday(`pending_payment_${payment.id}`)) return;
        const amountStr = `₹${payment.amount.toLocaleString('en-IN')}`;
        addNotification({
          type: 'pending_payment_due',
          title:
            days < 0
              ? `⚠️ Overdue: ${payment.buyerName}`
              : days === 0
                ? `🔴 Payment Due Today: ${payment.buyerName}`
                : `⏰ Payment Due in ${days} Day${days === 1 ? '' : 's'}: ${payment.buyerName}`,
          message:
            days < 0
              ? `${amountStr} for "${payment.itemDescription}" was due on ${new Date(payment.expectedPaymentDate).toLocaleDateString('en-IN')}.`
              : days === 0
                ? `${payment.buyerName} owes ${amountStr} for "${payment.itemDescription}" — due today.`
                : `${payment.buyerName} owes ${amountStr} for "${payment.itemDescription}" — due ${new Date(payment.expectedPaymentDate).toLocaleDateString('en-IN')}.`,
          dueDate: payment.expectedPaymentDate,
          entityId: `pending_payment_${payment.id}`,
          actionLabel: 'View Pending Payments',
          actionPath: '/liabilities?section=pending-payments',
        });
      }
    });

    // ── Payment Tracker Reminders ───────────────────────────────────────────
    trackedPayments?.forEach((payment) => {
      if (payment.status !== 'pending') return;

      const days = daysUntilDue(payment.dueDate);
      const shouldNotify =
        days < 0 ||
        payment.reminderDays.some((rd) => days === rd) ||
        days === 0;

      if (!shouldNotify) return;
      if (days < 0 && days < -7) return;
      if (!onceToday(`payment_tracker_${payment.id}`)) return;

      const { title, message } = buildPaymentReminderMessage(payment, days);

      addNotification({
        type: 'payment_tracker_due',
        title,
        message,
        dueDate: payment.dueDate,
        entityId: `payment_tracker_${payment.id}`,
        actionLabel: 'View Payments',
        actionPath: '/payments',
      });
    });

    // ── Goal Completion & Progress Alerts ───────────────────────────────────
    goals?.forEach((goal) => {
      if (!goal.targetAmount || goal.targetAmount <= 0) return;
      if (goal.status === 'completed' || goal.status === 'success') return;

      const pct = (goal.currentAmount / goal.targetAmount) * 100;

      if (pct >= 100) {
        if (!onceToday(`goal_achieved_${goal.id}`)) return;
        addNotification({
          type: 'goal_achieved',
          title: '🎉 Goal Achieved!',
          message: `You've reached your "${goal.name}" goal of ₹${goal.targetAmount.toLocaleString('en-IN')}. Mark it as success!`,
          entityId: `goal_achieved_${goal.id}`,
          actionLabel: 'View Goals',
          actionPath: '/goals',
        });
      } else if (pct >= 75) {
        if (!onceToday(`goal_75_${goal.id}`)) return;
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
  }, [
    policies,
    liabilities,
    goals,
    investments,
    pendingPayments,
    trackedPayments,
  ]);
}
