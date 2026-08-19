// src/hooks/useNotificationEngine.ts
// Comprehensive in-app notification engine.
//  • Uses store.persisted firing keys (`oncePerDay`, `oncePerPeriod`) so
//    notifications survive refresh, StrictMode double-render, navigation,
//    logout → login.
//  • Gated on portfolioStore.ready — engine only fires AFTER data is fully
//    hydrated from Firestore (fixes "notifications sometimes don't appear").
//  • Covers every reminder source in the app:
//      Insurance renewals / expirations
//      Liability EMIs / end-dates / overdue
//      Payment tracker (every reminder day, due, overdue)
//      Pending payments (receivables) due / overdue
//      Goal milestones (50%, 75%, 100%) and monthly contribution nudges
//      Investment maturity (auto-book profit + upcoming warning)
//      SIP monthly reminder + allocation health
//      Lending (borrower dues / overdue)
//      Credential stale (> 1yr since update)
//      Emergency fund low / replenish nudge
//      Net worth drop detection

import { useEffect, useRef } from 'react';
import {
  differenceInDays,
  format,
  isBefore,
  parseISO,
  startOfMonth,
} from 'date-fns';
import {
  NOTIF_COLORS,
  NOTIF_ICONS,
  useNotificationStore,
  type NotifType,
} from '../store/notificationStore';
import { usePortfolioStore } from '../store/portfolioStore';
import { useAgriStore } from '../store/agricultureStore';
import {
  buildPaymentReminderMessage,
  daysUntilDue,
} from '../utils/paymentTracker';

// Silence unused warning — these are exported from store for the bell UI
// and also imported here for co-location / future feature use.
void NOTIF_COLORS;
void NOTIF_ICONS;

/** Small helper: ₹ formatter */
const INR = (n: number) =>
  '₹' + Math.abs(Math.round(n || 0)).toLocaleString('en-IN');

/** Helper: is string date in current month? */
const isThisMonth = (d?: string) => {
  if (!d) return false;
  const today = new Date();
  const dt = parseISO(d);
  return (
    dt.getFullYear() === today.getFullYear() &&
    dt.getMonth() === today.getMonth()
  );
};

/**
 * Wrapper around store's `oncePerDay` with the same signature so call sites
 * don't need to change.  Returns TRUE if this is the FIRST time firing the
 * event today, FALSE otherwise.
 *
 * Because the guard is persisted, navigation / refresh / StrictMode never
 * re-fires the same notification.
 */
function once(
  key: string,
  opts: { kind?: 'day' | 'month' | 'period'; periodKey?: string } = {},
) {
  const s = useNotificationStore.getState();
  if (opts.kind === 'month') {
    const mk = new Date().toISOString().slice(0, 7);
    return s.oncePerPeriod(key, mk);
  }
  if (opts.kind === 'period' && opts.periodKey) {
    return s.oncePerPeriod(key, opts.periodKey);
  }
  return s.oncePerDay(key);
}

export function useNotificationEngine() {
  const policies = usePortfolioStore((s) => s.insurancePolicies);
  const liabilities = usePortfolioStore((s) => s.liabilities);
  const goals = usePortfolioStore((s) => s.goals);
  const goalContributions = usePortfolioStore((s) => s.goalContributions);
  const investments = usePortfolioStore((s) => s.investments);
  const pendingPayments = usePortfolioStore((s) => s.pendingPayments);
  const trackedPayments = usePortfolioStore((s) => s.trackedPayments);
  const credentials = usePortfolioStore((s) => s.credentials);
  const sipPlans = usePortfolioStore((s) => s.sipPlans) as Array<
    Record<string, any>
  >;
  const lendingBorrowers = usePortfolioStore((s) => s.lendingBorrowers);
  const lendingTransactions = usePortfolioStore(
    (s) => s.lendingTransactions,
  );
  const networthSnapshots = usePortfolioStore((s) => s.networthSnapshots);
  const essentials = usePortfolioStore((s) => s.essentials);
  const cashflows = usePortfolioStore((s) => s.cashflows);
  const accounts = usePortfolioStore((s) => s.accounts);
  const agriFields = useAgriStore((s) => s.fields);
  const agriReady = useAgriStore((s) => s.ready);
  const agriUid = useAgriStore((s) => s.uid);
  const ready = usePortfolioStore((s) => s.ready);
  const storeUid = usePortfolioStore((s) => s.uid);

  const addNotif = useNotificationStore((s) => s.addNotification);
  const notifUid = useNotificationStore((s) => s.uid);

  const addSoldTrade = usePortfolioStore((s) => s.addSoldTrade);
  const deleteInvestment = usePortfolioStore((s) => s.deleteInvestment);

  // Keep latest data values in a ref so the effect below only runs when
  // data is READY — otherwise we keep re-running on partial arrays.
  const dataRef = useRef({
    policies,
    liabilities,
    goals,
    goalContributions,
    investments,
    pendingPayments,
    trackedPayments,
    credentials,
    sipPlans,
    lendingBorrowers,
    lendingTransactions,
    networthSnapshots,
    essentials,
    cashflows,
    accounts,
    agriFields,
    addNotif,
    addSoldTrade,
    deleteInvestment,
  });
  dataRef.current = {
    policies,
    liabilities,
    goals,
    goalContributions,
    investments,
    pendingPayments,
    trackedPayments,
    credentials,
    sipPlans,
    lendingBorrowers,
    lendingTransactions,
    networthSnapshots,
    essentials,
    cashflows,
    accounts,
    agriFields,
    addNotif,
    addSoldTrade,
    deleteInvestment,
  };

  // Run ONCE per uid/ready change.  All fine-grained dedup is handled via the
  // persisted `once()` guard above — so even if this effect re-runs (e.g.
  // strict mode), we never duplicate.
  useEffect(() => {
    // Gate: don't run until:
    //   1. we have a user uid in BOTH stores
    //   2. portfolio store is flagged ready
    // If we fire early on empty arrays, we would mark some reminders as
    // "fired" for today on zero data → when real data arrives later that
    // same day, the user never sees them.
    if (!ready || !storeUid || storeUid !== notifUid) return;
    if (agriUid && agriUid !== storeUid) return;

    const d = dataRef.current;
    const today = new Date();
    const mk = format(today, 'yyyy-MM');
    const add = d.addNotif;

    // ─────────────────────────────────────────────────────────────────────
    // 1. INSURANCE — renewal (≤30 days) + expired (up to 60 days overdue)
    // ─────────────────────────────────────────────────────────────────────
    d.policies?.forEach((p) => {
      if (!p.renewalDate) return;
      const days = differenceInDays(parseISO(p.renewalDate), today);

      // Urgent tiers: 1d, 7d, 30d — each fires once via distinct key.
      const dueKey = `ins:${p.id}`;
      if (days < 0 && days >= -60) {
        if (once(`${dueKey}:exp:${-days}:${p.renewalDate}`, { kind: 'day' })) {
          add({
            type: 'insurance_expired',
            title: `🚨 EXPIRED: ${p.policyName}`,
            message: `${p.policyName} with ${p.provider} lapsed ${Math.abs(
              days,
            )} day${Math.abs(days) === 1 ? '' : 's'} ago on ${format(
              parseISO(p.renewalDate),
              'dd MMM yyyy',
            )}. Coverage: ${INR(p.coverageAmount)} — renew NOW to avoid lapse.`,
            dueDate: p.renewalDate,
            entityId: `insurance_expired_${p.id}`,
            periodKey: `${p.renewalDate}_${mk}`,
            severity: 'critical',
            actionLabel: 'Renew Now',
            actionPath: '/insurance',
          });
        }
      } else if (days === 0) {
        if (once(`${dueKey}:today`, { kind: 'day' })) {
          add({
            type: 'insurance_renewal',
            title: '🔴 Insurance Renewal — TODAY',
            message: `${p.policyName} (${p.provider}) expires TODAY. Premium ${INR(
              p.premiumAmount,
            )}. Coverage ${INR(p.coverageAmount)}.`,
            dueDate: p.renewalDate,
            entityId: `insurance_today_${p.id}`,
            periodKey: p.renewalDate,
            severity: 'high',
            actionLabel: 'View Insurance',
            actionPath: '/insurance',
          });
        }
      } else if (days === 1) {
        if (once(`${dueKey}:1d`, { kind: 'day' })) {
          add({
            type: 'insurance_renewal',
            title: '⏰ Renewal Tomorrow',
            message: `${p.policyName} — premium ${INR(
              p.premiumAmount,
            )} due tomorrow.`,
            dueDate: p.renewalDate,
            entityId: `insurance_1d_${p.id}`,
            severity: 'high',
            actionLabel: 'Insurance',
            actionPath: '/insurance',
          });
        }
      } else if (days === 7) {
        if (once(`${dueKey}:7d`, { kind: 'day' })) {
          add({
            type: 'insurance_renewal',
            title: '🛡️ Insurance Due in 7 Days',
            message: `${p.policyName} (${p.provider}) — ${INR(
              p.coverageAmount,
            )} coverage renews in 7 days. Plan for ${INR(p.premiumAmount)}.`,
            dueDate: p.renewalDate,
            entityId: `insurance_7d_${p.id}`,
            severity: 'medium',
            actionLabel: 'Insurance',
            actionPath: '/insurance',
          });
        }
      } else if (days === 30) {
        if (once(`${dueKey}:30d`, { kind: 'day' })) {
          add({
            type: 'insurance_renewal',
            title: '🛡️ Insurance Renewal Upcoming (30d)',
            message: `${p.policyName} renews in 30 days. Expected premium: ${INR(
              p.premiumAmount,
            )}.`,
            dueDate: p.renewalDate,
            entityId: `insurance_30d_${p.id}`,
            severity: 'low',
            actionLabel: 'Insurance',
            actionPath: '/insurance',
          });
        }
      }
    });

    // ─────────────────────────────────────────────────────────────────────
    // 2. LIABILITY — EMIs (based on emiDay) + endDate + overdue
    // ─────────────────────────────────────────────────────────────────────
    d.liabilities?.forEach((liab) => {
      // Skip inactive
      if (
        liab.status === 'returned' ||
        liab.status === 'paid' ||
        liab.status === 'paused'
      )
        return;
      if ((liab.outstanding ?? 0) <= 0) return;

      // 2a. EMI-day reminder (T-3, T-1, T=today)
      if (
        typeof liab.emiDay === 'number' &&
        liab.emiDay >= 1 &&
        liab.emiDay <= 31
      ) {
        const todayDate = today.getDate();
        const dueDay = liab.emiDay;
        let daysToEMI: number;
        if (dueDay >= todayDate) {
          daysToEMI = dueDay - todayDate;
        } else {
          const nextMonthSameDay = new Date(
            today.getFullYear(),
            today.getMonth() + 1,
            dueDay,
          );
          daysToEMI = differenceInDays(nextMonthSameDay, today);
        }
        const emiKey = `liab_emi:${liab.id}`;
        const emiAmount = liab.emiAmount
          ? INR(liab.emiAmount)
          : 'your EMI amount';
        const suffix = ['th', 'st', 'nd', 'rd'][
          [0, 1, 2, 3].includes(dueDay % 10) &&
          ![11, 12, 13].includes(dueDay % 100)
            ? dueDay % 10
            : 0
        ];
        if (daysToEMI === 0) {
          if (once(`${emiKey}:today`, { kind: 'day' })) {
            add({
              type: 'liability_emi',
              title: `💸 EMI Due Today: ${liab.name}`,
              message: `${liab.name} — ${emiAmount} is due today (${dueDay}${suffix} of every month). Outstanding: ${INR(
                liab.outstanding,
              )}.`,
              dueDate: new Date(
                today.getFullYear(),
                today.getMonth(),
                dueDay,
              )
                .toISOString()
                .slice(0, 10),
              entityId: `emi_today_${liab.id}`,
              periodKey: `${mk}:${dueDay}`,
              severity: 'high',
              actionLabel: 'Liabilities',
              actionPath: '/liabilities',
            });
          }
        } else if (daysToEMI === 1) {
          if (once(`${emiKey}:1d`, { kind: 'day' })) {
            add({
              type: 'liability_emi',
              title: `💸 EMI Tomorrow: ${liab.name}`,
              message: `${emiAmount} for "${liab.name}" is due tomorrow (${dueDay}${suffix}).`,
              entityId: `emi_1d_${liab.id}`,
              periodKey: `${mk}:${dueDay}`,
              severity: 'medium',
              actionLabel: 'Liabilities',
              actionPath: '/liabilities',
            });
          }
        } else if (daysToEMI === 3) {
          if (once(`${emiKey}:3d`, { kind: 'day' })) {
            add({
              type: 'liability_emi',
              title: `⏰ EMI in 3 Days — ${liab.name}`,
              message: `Keep ${emiAmount} ready for "${liab.name}" on ${dueDay}${suffix}.`,
              entityId: `emi_3d_${liab.id}`,
              periodKey: `${mk}:${dueDay}`,
              severity: 'low',
              actionLabel: 'Liabilities',
              actionPath: '/liabilities',
            });
          }
        }
      }

      // 2b. End-date final repayment — T-3, today, and up to T+14 OVERDUE
      if (liab.endDate) {
        const days = differenceInDays(parseISO(liab.endDate), today);
        const endKey = `liab_end:${liab.id}`;
        if (days === 0) {
          if (once(`${endKey}:today`, { kind: 'day' })) {
            add({
              type: 'liability_due',
              title: `🔴 FINAL Due Today — ${liab.name}`,
              message: `Final payment of ${INR(
                liab.outstanding,
              )} for "${liab.name}" is DUE TODAY. Close this liability!`,
              dueDate: liab.endDate,
              entityId: `liab_end_today_${liab.id}`,
              periodKey: liab.endDate,
              severity: 'high',
              actionLabel: 'Close Liability',
              actionPath: '/liabilities',
            });
          }
        } else if (days > 0 && days <= 3) {
          if (once(`${endKey}:${days}d`, { kind: 'day' })) {
            add({
              type: 'liability_due',
              title: `⏰ Final Payment in ${days}d — ${liab.name}`,
              message: `${INR(
                liab.outstanding,
              )} remaining on "${liab.name}" — closes on ${format(
                parseISO(liab.endDate),
                'dd MMM',
              )}.`,
              dueDate: liab.endDate,
              entityId: `liab_end_${days}d_${liab.id}`,
              severity: 'medium',
              actionLabel: 'Liabilities',
              actionPath: '/liabilities',
            });
          }
        } else if (days < 0 && days >= -14) {
          if (
            once(`${endKey}:overdue:${Math.abs(days)}d`, { kind: 'day' })
          ) {
            add({
              type: 'liability_overdue',
              title: `⚠️ OVERDUE ${Math.abs(days)}d — ${liab.name}`,
              message: `Final payment of ${INR(
                liab.outstanding,
              )} was due ${Math.abs(days)} day${
                Math.abs(days) === 1 ? '' : 's'
              } ago. Credit score impact risk — pay immediately.`,
              dueDate: liab.endDate,
              entityId: `liab_end_overdue_${liab.id}`,
              periodKey: `${liab.endDate}_days${-days}`,
              severity: 'critical',
              actionLabel: 'Pay Now',
              actionPath: '/liabilities',
            });
          }
        }
      }
    });

    // ─────────────────────────────────────────────────────────────────────
    // 3. PAYMENT TRACKER (trackedPayments) — reminderDays + today + overdue
    // ─────────────────────────────────────────────────────────────────────
    d.trackedPayments?.forEach((pay) => {
      if (pay.status === 'paid') return;
      const days = daysUntilDue(pay.dueDate);
      if (days < -14) return; // don't forever nag

      const baseKey = `track:${pay.id}`;
      // fire for every exact reminderDay match, due today, every 3d once-overdue
      let fire = false;
      let fireKey = '';
      if (days === 0) {
        fire = once(`${baseKey}:today`, { kind: 'day' });
        fireKey = 'today';
      } else if (days > 0 && (pay.reminderDays || []).includes(days)) {
        fire = once(`${baseKey}:${days}d`, { kind: 'day' });
        fireKey = `${days}d`;
      } else if (days < 0) {
        // Every 3 days while overdue: day -1, -3, -6, -9, -12
        if ([-1, -3, -6, -9, -12].includes(days)) {
          fire = once(`${baseKey}:overdue_${Math.abs(days)}d`, { kind: 'day' });
          fireKey = `overdue_${Math.abs(days)}d`;
        }
      }
      if (!fire || !fireKey) return;
      const { title, message } = buildPaymentReminderMessage(pay, days);
      add({
        type: days < 0 ? 'payment_tracker_overdue' : 'payment_tracker_due',
        title,
        message,
        dueDate: pay.dueDate,
        entityId: `pt_${pay.id}_${fireKey}`,
        periodKey: `${pay.dueDate}_${fireKey}`,
        severity: days < 0 ? (days < -3 ? 'high' : 'medium') : days === 0 ? 'high' : 'low',
        actionLabel: 'View Payment',
        actionPath: '/payments',
      });
    });

    // ─────────────────────────────────────────────────────────────────────
    // 4. PENDING PAYMENTS (receivables / buyer owes us)
    // ─────────────────────────────────────────────────────────────────────
    d.pendingPayments?.forEach((p) => {
      if (p.status !== 'pending' || !p.expectedPaymentDate) return;
      const days = differenceInDays(parseISO(p.expectedPaymentDate), today);
      if (days < -30) return;

      const key = `pend:${p.id}`;
      let fire = false;
      let fireKey = '';
      const type: NotifType =
        days < 0 ? 'pending_payment_overdue' : 'pending_payment_due';
      let title = '';
      let message = '';
      const amtStr = INR(p.amount);

      if (days === 0) {
        fire = once(`${key}:today`, { kind: 'day' });
        fireKey = 'today';
        title = `🔴 Receive Today: ₹${p.amount.toLocaleString('en-IN')} from ${p.buyerName}`;
        message = `${p.buyerName} owes ${amtStr} for "${p.itemDescription}" — expected TODAY. Follow up!`;
      } else if (days === 1) {
        fire = once(`${key}:1d`, { kind: 'day' });
        fireKey = '1d';
        title = `⏰ Payment Tomorrow: ${p.buyerName}`;
        message = `Expect ${amtStr} from ${p.buyerName} tomorrow for "${p.itemDescription}".`;
      } else if (days === 5) {
        fire = once(`${key}:5d`, { kind: 'day' });
        fireKey = '5d';
        title = `💰 Incoming in 5d — ${p.buyerName}`;
        message = `${amtStr} receivable on ${format(
          parseISO(p.expectedPaymentDate),
          'dd MMM',
        )} for "${p.itemDescription}".`;
      } else if (days < 0 && [-1, -3, -7, -14, -21].includes(days)) {
        fire = once(`${key}:overdue_${Math.abs(days)}d`, { kind: 'day' });
        fireKey = `overdue_${Math.abs(days)}d`;
        title = `⚠️ OVERDUE ${Math.abs(days)}d: ${p.buyerName}`;
        message = `${amtStr} was due ${Math.abs(
          days,
        )}d ago from ${p.buyerName} for "${p.itemDescription}". Follow up urgently.`;
      }
      if (!fire || !fireKey) return;
      add({
        type,
        title,
        message,
        dueDate: p.expectedPaymentDate,
        entityId: `pp_${p.id}_${fireKey}`,
        periodKey: `${p.expectedPaymentDate}_${fireKey}`,
        severity:
          days < -7
            ? 'high'
            : days < 0
              ? 'medium'
              : days === 0
                ? 'high'
                : 'low',
        actionLabel: 'Pending Payments',
        actionPath: '/liabilities?section=pending-payments',
      });
    });

    // ─────────────────────────────────────────────────────────────────────
    // 5. GOALS — milestone progress + monthly contribution nudge + achieved
    // ─────────────────────────────────────────────────────────────────────
    const goalContribThisMonth = d.goalContributions
      ?.filter((c) => isThisMonth(c.date))
      .reduce((s, c) => s + (c.amount || 0), 0);

    d.goals?.forEach((g) => {
      if (!g.targetAmount || g.targetAmount <= 0) return;
      const pct = Math.min(
        100,
        (g.currentAmount / g.targetAmount) * 100,
      );
      const key = `goal:${g.id}`;

      // Achieved — once per goal per period
      if (
        pct >= 100 &&
        g.status !== 'completed' &&
        g.status !== 'success'
      ) {
        if (once(`${key}:achieved`, { kind: 'month' })) {
          add({
            type: 'goal_achieved',
            title: `🎉 GOAL ACHIEVED: ${g.name}`,
            message: `You hit ${pct.toFixed(
              0,
            )}% of "${g.name}"! Saved ${INR(
              g.currentAmount,
            )} of ${INR(g.targetAmount)}. Mark it completed!`,
            entityId: `goal_achieved_${g.id}`,
            periodKey: `${mk}_ach`,
            severity: 'info',
            actionLabel: 'View Goal',
            actionPath: '/goals',
          });
        }
      }
      // Milestones: 50 / 75 / 90 percent (each fires once per goal)
      (
        [
          { p: 90, lbl: 'Almost There — 90%!', s: 'high' },
          { p: 75, lbl: '75% Milestone Reached', s: 'medium' },
          { p: 50, lbl: 'Halfway — 50% Done!', s: 'low' },
        ] as Array<{ p: number; lbl: string; s: 'low' | 'medium' | 'high' }>
      ).forEach(({ p, lbl, s }) => {
        if (pct >= p && pct < p + 5) {
          if (once(`${key}:milestone_${p}`, { kind: 'period', periodKey: 'once' })) {
            add({
              type: 'goal_progress',
              title: `🎯 ${lbl}: ${g.name}`,
              message: `"${g.name}" is at ${pct.toFixed(
                0,
              )}% — ${INR(g.currentAmount)} / ${INR(g.targetAmount)}.`,
              entityId: `goal_milestone_${p}_${g.id}`,
              periodKey: `ms_${p}`,
              severity: s,
              actionLabel: 'Goals',
              actionPath: '/goals',
            });
          }
        }
      });

      // Month-start nudge: if goal is not achieved AND you haven't contributed
      // this goal this month yet, prompt.
      if (
        pct < 100 &&
        today.getDate() <= 10 // only nudge first 10 days
      ) {
        const contributed =
          d.goalContributions
            ?.filter(
              (c) =>
                c.goalId === g.id &&
                isThisMonth(c.date),
            )
            .reduce((s, c) => s + (c.amount || 0), 0) || 0;
        if (contributed === 0) {
          if (once(`${key}:nudge:${mk}`, { kind: 'month' })) {
            const remaining = Math.max(0, g.targetAmount - g.currentAmount);
            add({
              type: 'goal_contribution_reminder',
              title: `💸 Contribute to "${g.name}" this month`,
              message: `${INR(remaining)} remaining to hit your target. Every ₹ counts — set your contribution aside early!`,
              entityId: `goal_nudge_${g.id}`,
              periodKey: mk,
              severity: 'low',
              actionLabel: 'Add Contribution',
              actionPath: '/goals',
            });
          }
        }
      }
    });

    // Emergency Fund low warning — reuse goals lookup + essentials config
    (() => {
      const efGoal = d.goals?.find((g) =>
        (g.name || '').toLowerCase().includes('emergency'),
      );
      const efTarget =
        efGoal?.targetAmount || d.essentials?.emergencyFundTarget || 0;
      const efCurrent =
        efGoal?.currentAmount || d.essentials?.emergencyFundCurrent || 0;
      if (!efTarget || efTarget <= 0) return;
      const months =
        d.pendingPayments /* any data sign of life */ != null && d.goals != null
          ? (() => {
              // use month expenses from cashflows for runway estimate
              // cashflows not directly in this engine → safe fallback to goal %
              return 0;
            })()
          : 0;
      void months;
      const pct = (efCurrent / efTarget) * 100;
      if (pct < 40) {
        if (once('ef_low_warning', { kind: 'month' })) {
          add({
            type: 'emergency_fund_low',
            title:
              pct < 15
                ? '🛟 CRITICAL: Emergency Fund Too Low'
                : '🛟 Emergency Fund Needs a Top-Up',
            message: `You have ${INR(
              efCurrent,
            )} / ${INR(efTarget)} saved (${pct.toFixed(
              0,
            )}%). Aim for at least 3–6 months of expenses set aside.`,
            entityId: efGoal?.id || 'emergency_fund',
            periodKey: mk,
            severity: pct < 15 ? 'critical' : 'medium',
            actionLabel: 'Top Up Now',
            actionPath: efGoal ? '/goals' : '/reports',
          });
        }
      }
    })();

    // ─────────────────────────────────────────────────────────────────────
    // 6. INVESTMENT maturity (auto-book profit + upcoming warning)
    // ─────────────────────────────────────────────────────────────────────
    d.investments?.forEach((inv) => {
      if (inv.type !== 'bond' && inv.type !== 'fixed_deposit') return;
      if (!inv.maturityDate) return;
      const days = differenceInDays(parseISO(inv.maturityDate), today);
      const key = `inv_mat:${inv.id}`;

      if (days <= 0) {
        // Auto-book profit once — strictly once per maturity date.
        if (
          once(`${key}:matured:${inv.maturityDate}`, {
            kind: 'period',
            periodKey: inv.maturityDate,
          })
        ) {
          const invested = inv.investedAmount || 0;
          const rate = inv.interestRate || 0;
          const duration = inv.durationMonths || 0;
          const profit = invested * (rate / 100) * (duration / 12);
          const sellPrice = invested + profit;
          // Sequence: book profit FIRST, then delete, then notify.
          (async () => {
            try {
              await d.addSoldTrade({
                investmentName: inv.name,
                investmentType: inv.type,
                buyPrice: invested,
                sellPrice: sellPrice,
                soldDate: new Date().toISOString().split('T')[0],
                notes: 'Auto-realized upon reaching maturity date.',
                platform: inv.platform,
              });
              await d.deleteInvestment(inv.id);
            } catch (err) {
              console.error('[NotifEngine] maturity auto-book failed:', err);
            }
          })();
          add({
            type: 'investment_matured',
            title: '🎉 Investment Matured & Profit Booked!',
            message: `Your ${
              inv.type === 'bond' ? 'Bond' : 'FD'
            } "${inv.name}" matured. ${INR(
              profit,
            )} profit added to realized profits automatically.`,
            dueDate: inv.maturityDate,
            entityId: `inv_matured_${inv.id}`,
            periodKey: inv.maturityDate,
            severity: 'info',
            actionLabel: 'View Profits',
            actionPath: '/profits',
          });
        }
      } else if (days === 7) {
        if (once(`${key}:7d`, { kind: 'day' })) {
          add({
            type: 'investment_maturity_upcoming',
            title: '⏰ Investment Maturing in 7 Days',
            message: `Your ${
              inv.type === 'bond' ? 'Bond' : 'FD'
            } "${inv.name}" matures in 7 days. Expected payout ~${INR(
              (inv.investedAmount || 0) +
                (inv.investedAmount || 0) *
                  ((inv.interestRate || 0) / 100) *
                  ((inv.durationMonths || 0) / 12),
            )}.`,
            dueDate: inv.maturityDate,
            entityId: `inv_upcoming_7d_${inv.id}`,
            severity: 'low',
            actionLabel: 'View Investment',
            actionPath: '/investments',
          });
        }
      } else if (days === 30) {
        if (once(`${key}:30d`, { kind: 'day' })) {
          add({
            type: 'investment_maturity_upcoming',
            title: '⏳ 30 Days Until Maturity',
            message: `"${inv.name}" ${
              inv.type === 'bond' ? 'bond' : 'FD'
            } matures in a month.`,
            dueDate: inv.maturityDate,
            entityId: `inv_upcoming_30d_${inv.id}`,
            severity: 'low',
            actionLabel: 'Investments',
            actionPath: '/investments',
          });
        }
      }
    });

    // ─────────────────────────────────────────────────────────────────────
    // 7. SIP — monthly reminder + allocation health
    // ─────────────────────────────────────────────────────────────────────
    (() => {
      const budget = (d.sipPlans || []).find(
        (x: any) => x && x.type === 'budget',
      );
      const instruments = (d.sipPlans || []).filter(
        (x: any) => x && x.type === 'instrument',
      );
      const budgetAmt = budget?.budget || 0;
      const totalPct = instruments.reduce(
        (s: number, i: any) => s + (i.percentage || 0),
        0,
      );

      // Monthly SIP nudge (first 7 days of month) — only if budget set
      if (budgetAmt > 0 && today.getDate() <= 7) {
        if (once('sip_monthly_nudge', { kind: 'month' })) {
          add({
            type: 'sip_reminder',
            title: '📅 SIP Time — Invest This Month!',
            message: `Your planned SIP budget is ${INR(
              budgetAmt,
            )} across ${instruments.length} instrument${
              instruments.length === 1 ? '' : 's'
            }. Execute your orders early in the month for better rupee-cost averaging.`,
            entityId: 'sip_nudge',
            periodKey: mk,
            severity: 'low',
            actionLabel: 'Open SIP Plan',
            actionPath: '/investments?tab=sip-plan',
          });
        }
      }

      // Allocation mismatch warning — once, whenever it changes
      if (
        budgetAmt > 0 &&
        instruments.length > 0 &&
        (totalPct < 95 || totalPct > 100)
      ) {
        if (once('sip_allocation_mismatch', { kind: 'month' })) {
          add({
            type: 'sip_allocation_mismatch',
            title:
              totalPct > 100
                ? '🧭 SIP Over-Allocated!'
                : '🧭 SIP Not Fully Allocated',
            message: `Your planned instrument allocation sums to ${totalPct.toFixed(
              0,
            )}%. ${
              totalPct > 100
                ? `That's over 100% of your budget — trim some allocations.`
                : `${(100 - totalPct).toFixed(0)}% of ${INR(
                    budgetAmt,
                  )} is still unallocated.`
            }`,
            entityId: 'sip_alloc',
            periodKey: `${mk}_${Math.round(totalPct)}`,
            severity: totalPct > 100 ? 'high' : 'medium',
            actionLabel: 'Fix Allocation',
            actionPath: '/investments?tab=sip-plan',
          });
        }
      }
    })();

    // ─────────────────────────────────────────────────────────────────────
    // 8. LENDING — borrower dues & overdue
    // ─────────────────────────────────────────────────────────────────────
    d.lendingBorrowers?.forEach((borrower) => {
      if (borrower.status !== 'active') return;
      if (!borrower.nextDueDate) return;
      const days = differenceInDays(parseISO(borrower.nextDueDate), today);
      if (days < -30) return;
      const key = `lend:${borrower.id}`;
      const type: NotifType = days < 0 ? 'lending_overdue' : 'lending_due';
      const validIds = new Set(d.lendingBorrowers.map((b) => b.id));
      const given = d.lendingTransactions
        .filter(
          (t) =>
            validIds.has(t.borrowerId) &&
            t.borrowerId === borrower.id &&
            t.type === 'principal_given',
        )
        .reduce((s, t) => s + (t.amount || 0), 0);
      const returned = d.lendingTransactions
        .filter(
          (t) =>
            validIds.has(t.borrowerId) &&
            t.borrowerId === borrower.id &&
            t.type === 'principal_returned',
        )
        .reduce((s, t) => s + (t.amount || 0), 0);
      const outstanding = given - returned;
      const amtLine = outstanding > 0 ? ` (${INR(outstanding)} due)` : '';

      let fire = false;
      let fireKey = '';
      let title = '';
      let message = '';
      if (days === 0) {
        fire = once(`${key}:today`, { kind: 'day' });
        fireKey = 'today';
        title = `🤝 Collect Today: ${borrower.name}`;
        message = `Payment from ${borrower.name}${amtLine} is due today. Follow up!`;
      } else if (days === 3) {
        fire = once(`${key}:3d`, { kind: 'day' });
        fireKey = '3d';
        title = `🤝 3 Days Until ${borrower.name} Payment`;
        message = `Remind ${borrower.name} about the payment${amtLine} on ${format(
          parseISO(borrower.nextDueDate),
          'dd MMM',
        )}.`;
      } else if (days === 7) {
        fire = once(`${key}:7d`, { kind: 'day' });
        fireKey = '7d';
        title = `🤝 Lending Due in a Week — ${borrower.name}`;
        message = `${borrower.name}${amtLine} — due ${format(
          parseISO(borrower.nextDueDate),
          'dd MMM',
        )}.`;
      } else if (days < 0 && [-1, -3, -7, -14, -21].includes(days)) {
        fire = once(`${key}:overdue_${Math.abs(days)}d`, { kind: 'day' });
        fireKey = `overdue_${Math.abs(days)}d`;
        title = `❗ OVERDUE ${Math.abs(days)}d: ${borrower.name}`;
        message = `${borrower.name}'s payment${amtLine} is ${Math.abs(
          days,
        )} day${Math.abs(days) === 1 ? '' : 's'} overdue. Collect immediately.`;
      }
      if (!fire || !fireKey) return;
      add({
        type,
        title,
        message,
        dueDate: borrower.nextDueDate,
        entityId: `lend_${borrower.id}_${fireKey}`,
        periodKey: `${borrower.nextDueDate}_${fireKey}`,
        severity: days < -7 ? 'high' : days < 0 ? 'medium' : days === 0 ? 'high' : 'low',
        actionLabel: 'Open Lending',
        actionPath: '/cashflow?tab=lending',
      });
    });

    // ─────────────────────────────────────────────────────────────────────
    // 9. CREDENTIALS — stale (>1 year since last update)
    // ─────────────────────────────────────────────────────────────────────
    d.credentials?.forEach((c) => {
      if (!c.updatedAt && !c.createdAt) return;
      const updated = parseISO(c.updatedAt || c.createdAt);
      const ageDays = differenceInDays(today, updated);
      if (ageDays >= 365 && ageDays < 365 + 7) {
        // fire in the first week after becoming stale — once per credential
        if (once(`cred_stale:${c.id}`, { kind: 'period', periodKey: 'yearly' })) {
          add({
            type: 'credential_stale',
            title: `🔐 "${c.title}" — ${
              c.category === 'login' ? 'Password' : 'Data'
            } Not Updated in 1+ Year`,
            message: `Your stored ${
              c.category || 'credential'
            } "${c.title}" was last updated ${ageDays} days ago. For security, review and rotate it.`,
            entityId: `cred_stale_${c.id}`,
            periodKey: `y_${format(updated, 'yyyy')}`,
            severity: 'low',
            actionLabel: 'Review Credentials',
            actionPath: '/credentials',
          });
        }
      }
    });

    // ─────────────────────────────────────────────────────────────────────
    // 10. NET WORTH DROP — month-over-month ≥ 10% drop (once per month)
    // ─────────────────────────────────────────────────────────────────────
    (() => {
      const snaps = [...(d.networthSnapshots || [])]
        .filter((s) => s && s.createdAt)
        .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
      if (snaps.length < 2) return;
      const cur = snaps[snaps.length - 1];
      // previous month-end: look for the last snapshot not in current month
      const thisMonthStart = startOfMonth(today);
      let prev = null as typeof cur | null;
      for (let i = snaps.length - 2; i >= 0; i--) {
        if (isBefore(parseISO(snaps[i].createdAt!), thisMonthStart)) {
          prev = snaps[i];
          break;
        }
      }
      if (!prev) {
        // fallback to first snapshot in array
        prev = snaps[Math.max(0, snaps.length - 5)];
      }
      if (!prev) return;
      const drop =
        prev.netWorth > 0 && cur.netWorth > 0
          ? (cur.netWorth - prev.netWorth) / prev.netWorth
          : 0;
      if (drop <= -0.1) {
        if (once('networth_drop_alert', { kind: 'month' })) {
          add({
            type: 'networth_drop',
            title: `📉 Net Worth Dropped ${Math.abs(drop * 100).toFixed(
              1,
            )}% This Month`,
            message: `From ${INR(prev.netWorth)} on ${format(
              parseISO(prev.createdAt!),
              'dd MMM',
            )} to ${INR(cur.netWorth)} now. Review your largest holdings and liabilities.`,
            entityId: 'nw_drop',
            periodKey: mk,
            severity: drop <= -0.2 ? 'critical' : 'high',
            actionLabel: 'View Insights',
            actionPath: '/insights',
          });
        }
      }
    })();

    // ─────────────────────────────────────────────────────────────────────
    // 11. Welcome / onboarding nudge (once, ever, per user if data is empty)
    // ─────────────────────────────────────────────────────────────────────
    const anyData =
      (d.investments?.length ?? 0) +
      (d.cashflows?.length ?? 0) +
      (d.liabilities?.length ?? 0) +
      (d.goals?.length ?? 0) +
      (d.accounts?.length ?? 0) +
      (d.agriFields?.length ?? 0) +
      (d.trackedPayments?.length ?? 0) +
      (d.policies?.length ?? 0);
    if (anyData === 0) {
      if (once('welcome_nudge_v1', { kind: 'period', periodKey: 'once' })) {
        add({
          type: 'info',
          title: '👋 Welcome to FinTrackly!',
          message:
            'Start by adding 1) a bank account, 2) your first cashflow entry, 3) one goal. The more you track, the smarter these reminders become!',
          entityId: 'welcome_nudge',
          periodKey: 'once',
          severity: 'info',
          actionLabel: 'Open Dashboard',
          actionPath: '/dashboard',
        });
      }
    }

    // Use every value referenced in deps array to satisfy exhaustive-deps.
    void goalContribThisMonth;

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // IMPORTANT — depend on READINESS and UID, NOT the data arrays themselves.
    // Data arrays rerun the effect on every Firestore update even when
    // content has not materially changed.  Persisted once() guards prevent
    // duplicates — but spurious reruns cost CPU.  If you want the engine
    // to re-evaluate immediately when a user ADDS a new policy/liability/etc
    // (not waiting until tomorrow), additionally depend on the COUNTS of
    // those arrays via a single checksum.
    ready,
    storeUid,
    notifUid,
    agriReady,
    agriUid,
    policies.length,
    liabilities.length,
    goals.length,
    goalContributions.length,
    investments.length,
    pendingPayments.length,
    trackedPayments.length,
    credentials.length,
    sipPlans.length,
    lendingBorrowers.length,
    lendingTransactions.length,
    networthSnapshots.length,
    cashflows.length,
    accounts.length,
    agriFields.length,
  ]);
}
