// src/hooks/useDerivedNotifications.ts
// Derives all in-app notifications directly from portfolio store data.
// No notification objects are persisted — they are computed fresh on every render.
// Read/dismissed state is tracked minimally via notificationStore (IDs only).

import { useMemo } from 'react';
import {
  differenceInDays,
  format,
  isBefore,
  parseISO,
  startOfMonth,
  endOfDay,
} from 'date-fns';

import { usePortfolioStore } from '../store/portfolioStore';
import { useNotificationStore } from '../store/notificationStore';
import { useSubscriptionOptional } from '../context/SubscriptionContext';
import type { NotifType, AppNotification } from '../store/notificationStore';
import { daysUntilDue, buildPaymentReminderMessage } from '../utils/paymentTracker';

const INR = (n: number) =>
  '₹' + Math.abs(Math.round(n || 0)).toLocaleString('en-IN');

function today() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfToday() {
  return endOfDay(today());
}

function isThisMonth(d?: string) {
  if (!d) return false;
  const dt = parseISO(d);
  const t = today();
  return dt.getFullYear() === t.getFullYear() && dt.getMonth() === t.getMonth();
}

function stableId(sourceType: string, sourceId: string, variant: string): string {
  return `${sourceType}:${sourceId}:${variant}`;
}

function makeNotif(
  type: NotifType,
  title: string,
  message: string,
  sourceId: string,
  sourceType: string,
  opts: {
    dueDate?: string;
    expiresAt?: string;
    severity?: 'info' | 'low' | 'medium' | 'high' | 'critical';
    actionLabel?: string;
    actionPath?: string;
    createdAt?: string;
  } = {},
): AppNotification {
  const now = new Date().toISOString();
  return {
    id: stableId(sourceType, sourceId, opts.dueDate || opts.createdAt || now),
    type,
    title,
    message,
    dueDate: opts.dueDate,
    read: false,
    dismissed: false,
    createdAt: opts.createdAt || now,
    updatedAt: now,
    entityId: sourceId,
    actionLabel: opts.actionLabel,
    actionPath: opts.actionPath,
    periodKey: opts.dueDate,
    severity: opts.severity,
  };
}

export function useDerivedNotifications() {
  const portfolio = usePortfolioStore();
  const notifStore = useNotificationStore();
  const subscription = useSubscriptionOptional();

  const readIds = new Set(notifStore.readIds);
  const dismissedIds = new Set(notifStore.dismissedIds);

  const derived = useMemo(() => {
    const notifs: AppNotification[] = [];
    const t = today();

    // ── Insurance renewals ──────────────────────────────────────────────────
    portfolio.insurancePolicies?.forEach((p) => {
      if (!p.renewalDate) return;
      const days = differenceInDays(parseISO(p.renewalDate), t);
      if (days < 0 && days >= -60) {
        notifs.push(
          makeNotif(
            'insurance_expired',
            `🚨 EXPIRED: ${p.policyName}`,
            `${p.policyName} with ${p.provider} lapsed ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago on ${format(parseISO(p.renewalDate), 'dd MMM yyyy')}. Coverage: ${INR(p.coverageAmount)} — renew NOW to avoid lapse.`,
            p.id,
            'insurance',
            {
              dueDate: p.renewalDate,
              expiresAt: new Date(t.getTime() - (days + 1) * 86_400_000).toISOString(),
              severity: 'critical',
              actionLabel: 'Renew Now',
              actionPath: '/insurance',
            },
          ),
        );
      } else if (days === 0) {
        notifs.push(
          makeNotif(
            'insurance_renewal',
            '🔴 Insurance Renewal — TODAY',
            `${p.policyName} (${p.provider}) expires TODAY. Premium ${INR(p.premiumAmount)}. Coverage ${INR(p.coverageAmount)}.`,
            p.id,
            'insurance',
            {
              dueDate: p.renewalDate,
              expiresAt: endOfToday().toISOString(),
              severity: 'high',
              actionLabel: 'View Insurance',
              actionPath: '/insurance',
            },
          ),
        );
      } else if (days === 1) {
        notifs.push(
          makeNotif(
            'insurance_renewal',
            '⏰ Renewal Tomorrow',
            `${p.policyName} — premium ${INR(p.premiumAmount)} due tomorrow.`,
            p.id,
            'insurance',
            {
              dueDate: p.renewalDate,
              expiresAt: new Date(t.getTime() + 2 * 86_400_000).toISOString(),
              severity: 'high',
              actionLabel: 'Insurance',
              actionPath: '/insurance',
            },
          ),
        );
      } else if (days === 7) {
        notifs.push(
          makeNotif(
            'insurance_renewal',
            '🛡️ Insurance Due in 7 Days',
            `${p.policyName} (${p.provider}) — ${INR(p.coverageAmount)} coverage renews in 7 days. Plan for ${INR(p.premiumAmount)}.`,
            p.id,
            'insurance',
            {
              dueDate: p.renewalDate,
              expiresAt: new Date(t.getTime() + 8 * 86_400_000).toISOString(),
              severity: 'medium',
              actionLabel: 'Insurance',
              actionPath: '/insurance',
            },
          ),
        );
      } else if (days === 30) {
        notifs.push(
          makeNotif(
            'insurance_renewal',
            '🛡️ Insurance Renewal Upcoming (30d)',
            `${p.policyName} renews in 30 days. Expected premium: ${INR(p.premiumAmount)}.`,
            p.id,
            'insurance',
            {
              dueDate: p.renewalDate,
              expiresAt: new Date(t.getTime() + 31 * 86_400_000).toISOString(),
              severity: 'low',
              actionLabel: 'Insurance',
              actionPath: '/insurance',
            },
          ),
        );
      }
    });

    // ── Liabilities ─────────────────────────────────────────────────────────
    portfolio.liabilities?.forEach((liab) => {
      if (
        liab.status === 'returned' ||
        liab.status === 'paid' ||
        liab.status === 'paused'
      )
        return;
      if ((liab.outstanding ?? 0) <= 0) return;

      if (typeof liab.emiDay === 'number' && liab.emiDay >= 1 && liab.emiDay <= 31) {
        const todayDate = t.getDate();
        const dueDay = liab.emiDay;
        let daysToEMI: number;
        if (dueDay >= todayDate) {
          daysToEMI = dueDay - todayDate;
        } else {
          const nextMonthSameDay = new Date(t.getFullYear(), t.getMonth() + 1, dueDay);
          daysToEMI = differenceInDays(nextMonthSameDay, t);
        }
        const emiAmount = liab.emiAmount ? INR(liab.emiAmount) : 'your EMI amount';
        const suffix = ['th', 'st', 'nd', 'rd'][
          [0, 1, 2, 3].includes(dueDay % 10) && ![11, 12, 13].includes(dueDay % 100)
            ? dueDay % 10
            : 0
        ];
        if (daysToEMI === 0) {
          notifs.push(
            makeNotif(
              'liability_emi',
              `💸 EMI Due Today: ${liab.name}`,
              `${liab.name} — ${emiAmount} is due today (${dueDay}${suffix} of every month). Outstanding: ${INR(liab.outstanding)}.`,
              liab.id,
              'liability',
              {
                dueDate: new Date(t.getFullYear(), t.getMonth(), dueDay).toISOString().slice(0, 10),
                expiresAt: endOfToday().toISOString(),
                severity: 'high',
                actionLabel: 'Liabilities',
                actionPath: '/liabilities',
              },
            ),
          );
        } else if (daysToEMI === 1) {
          notifs.push(
            makeNotif(
              'liability_emi',
              `💸 EMI Tomorrow: ${liab.name}`,
              `${emiAmount} for "${liab.name}" is due tomorrow (${dueDay}${suffix}).`,
              liab.id,
              'liability',
              {
                expiresAt: new Date(t.getTime() + 2 * 86_400_000).toISOString(),
                severity: 'medium',
                actionLabel: 'Liabilities',
                actionPath: '/liabilities',
              },
            ),
          );
        } else if (daysToEMI === 3) {
          notifs.push(
            makeNotif(
              'liability_emi',
              `⏰ EMI in 3 Days — ${liab.name}`,
              `Keep ${emiAmount} ready for "${liab.name}" on ${dueDay}${suffix}.`,
              liab.id,
              'liability',
              {
                expiresAt: new Date(t.getTime() + 4 * 86_400_000).toISOString(),
                severity: 'low',
                actionLabel: 'Liabilities',
                actionPath: '/liabilities',
              },
            ),
          );
        }
      }

      if (liab.endDate) {
        const days = differenceInDays(parseISO(liab.endDate), t);
        if (days === 0) {
          notifs.push(
            makeNotif(
              'liability_due',
              `🔴 FINAL Due Today — ${liab.name}`,
              `Final payment of ${INR(liab.outstanding)} for "${liab.name}" is DUE TODAY. Close this liability!`,
              liab.id,
              'liability',
              {
                dueDate: liab.endDate,
                expiresAt: endOfToday().toISOString(),
                severity: 'high',
                actionLabel: 'Close Liability',
                actionPath: '/liabilities',
              },
            ),
          );
        } else if (days > 0 && days <= 3) {
          notifs.push(
            makeNotif(
              'liability_due',
              `⏰ Final Payment in ${days}d — ${liab.name}`,
              `${INR(liab.outstanding)} remaining on "${liab.name}" — closes on ${format(parseISO(liab.endDate), 'dd MMM')}.`,
              liab.id,
              'liability',
              {
                dueDate: liab.endDate,
                expiresAt: new Date(t.getTime() + (days + 1) * 86_400_000).toISOString(),
                severity: 'medium',
                actionLabel: 'Liabilities',
                actionPath: '/liabilities',
              },
            ),
          );
        } else if (days < 0 && days >= -14) {
          notifs.push(
            makeNotif(
              'liability_overdue',
              `⚠️ OVERDUE ${Math.abs(days)}d — ${liab.name}`,
              `Final payment of ${INR(liab.outstanding)} was due ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago. Credit score impact risk — pay immediately.`,
              liab.id,
              'liability',
              {
                dueDate: liab.endDate,
                expiresAt: new Date(t.getTime() + (Math.abs(days) + 2) * 86_400_000).toISOString(),
                severity: 'critical',
                actionLabel: 'Pay Now',
                actionPath: '/liabilities',
              },
            ),
          );
        }
      }
    });

    // ── Payment tracker ─────────────────────────────────────────────────────
    portfolio.trackedPayments?.forEach((pay) => {
      if (pay.status === 'paid') return;
      const days = daysUntilDue(pay.dueDate);
      if (days < -14) return;

      let fire = false;
      let fireKey = '';
      if (days === 0) {
        fire = true;
        fireKey = 'today';
      } else if (days > 0 && (pay.reminderDays || []).includes(days)) {
        fire = true;
        fireKey = `${days}d`;
      } else if (days < 0) {
        if ([-1, -3, -6, -9, -12].includes(days)) {
          fire = true;
          fireKey = `overdue_${Math.abs(days)}d`;
        }
      }
      if (!fire || !fireKey) return;
      const { title, message } = buildPaymentReminderMessage(pay, days);
      notifs.push(
        makeNotif(
          days < 0 ? 'payment_tracker_overdue' : 'payment_tracker_due',
          title,
          message,
          pay.id,
          'payment',
          {
            dueDate: pay.dueDate,
            expiresAt:
              days < 0
                ? new Date(t.getTime() + (Math.abs(days) + 3) * 86_400_000).toISOString()
                : new Date(t.getTime() + (days + 1) * 86_400_000).toISOString(),
            severity: days < -3 ? 'high' : days < 0 ? 'medium' : days === 0 ? 'high' : 'low',
            actionLabel: 'View Payment',
            actionPath: '/payments',
          },
        ),
      );
    });

    // ── Pending payments ────────────────────────────────────────────────────
    portfolio.pendingPayments?.forEach((p) => {
      if (p.status !== 'pending' || !p.expectedPaymentDate) return;
      const days = differenceInDays(parseISO(p.expectedPaymentDate), t);
      if (days < -30) return;

      let fire = false;
      let fireKey = '';
      const type: NotifType = days < 0 ? 'pending_payment_overdue' : 'pending_payment_due';
      let title = '';
      let message = '';
      const amtStr = INR(p.amount);

      if (days === 0) {
        fire = true;
        fireKey = 'today';
        title = `🔴 Receive Today: ₹${p.amount.toLocaleString('en-IN')} from ${p.buyerName}`;
        message = `${p.buyerName} owes ${amtStr} for "${p.itemDescription}" — expected TODAY. Follow up!`;
      } else if (days === 1) {
        fire = true;
        fireKey = '1d';
        title = `⏰ Payment Tomorrow: ${p.buyerName}`;
        message = `Expect ${amtStr} from ${p.buyerName} tomorrow for "${p.itemDescription}".`;
      } else if (days === 5) {
        fire = true;
        fireKey = '5d';
        title = `💰 Incoming in 5d — ${p.buyerName}`;
        message = `${amtStr} receivable on ${format(parseISO(p.expectedPaymentDate), 'dd MMM')} for "${p.itemDescription}".`;
      } else if (days < 0 && [-1, -3, -7, -14, -21].includes(days)) {
        fire = true;
        fireKey = `overdue_${Math.abs(days)}d`;
        title = `⚠️ OVERDUE ${Math.abs(days)}d: ${p.buyerName}`;
        message = `${amtStr} was due ${Math.abs(days)}d ago from ${p.buyerName} for "${p.itemDescription}". Follow up urgently.`;
      }
      if (!fire || !fireKey) return;
      notifs.push(
        makeNotif(
          type,
          title,
          message,
          p.id,
          'pending',
          {
            dueDate: p.expectedPaymentDate,
            expiresAt:
              days < 0
                ? new Date(t.getTime() + (Math.abs(days) + 3) * 86_400_000).toISOString()
                : new Date(t.getTime() + (days + 1) * 86_400_000).toISOString(),
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
          },
        ),
      );
    });

    // ── Goals ───────────────────────────────────────────────────────────────
    portfolio.goals?.forEach((g) => {
      if (!g.targetAmount || g.targetAmount <= 0) return;
      const pct = Math.min(100, (g.currentAmount / g.targetAmount) * 100);

      if (pct >= 100 && g.status !== 'completed' && g.status !== 'success') {
        notifs.push(
          makeNotif(
            'goal_achieved',
            `🎉 GOAL ACHIEVED: ${g.name}`,
            `You hit ${pct.toFixed(0)}% of "${g.name}"! Saved ${INR(g.currentAmount)} of ${INR(g.targetAmount)}. Mark it completed!`,
            g.id,
            'goal',
            {
              expiresAt: new Date(t.getTime() + 7 * 86_400_000).toISOString(),
              severity: 'info',
              actionLabel: 'View Goal',
              actionPath: '/goals',
            },
          ),
        );
      }
      (
        [
          { p: 90, lbl: 'Almost There — 90%!', s: 'high' as const },
          { p: 75, lbl: '75% Milestone Reached', s: 'medium' as const },
          { p: 50, lbl: 'Halfway — 50% Done!', s: 'low' as const },
        ] as const
      ).forEach(({ p, lbl, s }) => {
        if (pct >= p && pct < p + 5) {
          notifs.push(
            makeNotif(
              'goal_progress',
              `🎯 ${lbl}: ${g.name}`,
              `"${g.name}" is at ${pct.toFixed(0)}% — ${INR(g.currentAmount)} / ${INR(g.targetAmount)}.`,
              g.id,
              'goal',
              {
                expiresAt: new Date(t.getTime() + 7 * 86_400_000).toISOString(),
                severity: s,
                actionLabel: 'Goals',
                actionPath: '/goals',
              },
            ),
          );
        }
      });

      if (pct < 100 && t.getDate() <= 10) {
        const contributed =
          portfolio.goalContributions
            ?.filter((c) => c.goalId === g.id && isThisMonth(c.date))
            .reduce((s, c) => s + (c.amount || 0), 0) || 0;
        if (contributed === 0) {
          notifs.push(
            makeNotif(
              'goal_contribution_reminder',
              `💸 Contribute to "${g.name}" this month`,
              `${INR(Math.max(0, g.targetAmount - g.currentAmount))} remaining to hit your target. Every ₹ counts — set your contribution aside early!`,
              g.id,
              'goal',
              {
                expiresAt: new Date(t.getFullYear(), t.getMonth() + 1, 0).toISOString(),
                severity: 'low',
                actionLabel: 'Add Contribution',
                actionPath: '/goals',
              },
            ),
          );
        }
      }
    });

    // Emergency fund low
    (() => {
      const efGoal = portfolio.goals?.find((g) =>
        (g.name || '').toLowerCase().includes('emergency'),
      );
      const efTarget =
        efGoal?.targetAmount || portfolio.essentials?.emergencyFundTarget || 0;
      const efCurrent =
        efGoal?.currentAmount || portfolio.essentials?.emergencyFundCurrent || 0;
      if (!efTarget || efTarget <= 0) return;
      const pct = (efCurrent / efTarget) * 100;
      if (pct < 40) {
        notifs.push(
          makeNotif(
            'emergency_fund_low',
            pct < 15
              ? '🛟 CRITICAL: Emergency Fund Too Low'
              : '🛟 Emergency Fund Needs a Top-Up',
            `You have ${INR(efCurrent)} / ${INR(efTarget)} saved (${pct.toFixed(0)}%). Aim for at least 3–6 months of expenses set aside.`,
            efGoal?.id || 'emergency_fund',
            'essential',
            {
              expiresAt: new Date(t.getFullYear(), t.getMonth() + 1, 0).toISOString(),
              severity: pct < 15 ? 'critical' : 'medium',
              actionLabel: 'Top Up Now',
              actionPath: efGoal ? '/goals' : '/reports',
            },
          ),
        );
      }
    })();

    // ── Investment maturity ─────────────────────────────────────────────────
    portfolio.investments?.forEach((inv) => {
      if (inv.type !== 'bond' && inv.type !== 'fixed_deposit') return;
      if (!inv.maturityDate) return;
      const days = differenceInDays(parseISO(inv.maturityDate), t);

      if (days <= 0) {
        notifs.push(
          makeNotif(
            'investment_matured',
            '🎉 Investment Matured & Profit Booked!',
            `Your ${inv.type === 'bond' ? 'Bond' : 'FD'} "${inv.name}" matured. Profit has been added to realized profits automatically.`,
            inv.id,
            'investment',
            {
              dueDate: inv.maturityDate,
              expiresAt: new Date(t.getTime() + 7 * 86_400_000).toISOString(),
              severity: 'info',
              actionLabel: 'View Profits',
              actionPath: '/profits',
            },
          ),
        );
      } else if (days === 7) {
        notifs.push(
          makeNotif(
            'investment_maturity_upcoming',
            '⏰ Investment Maturing in 7 Days',
            `Your ${inv.type === 'bond' ? 'Bond' : 'FD'} "${inv.name}" matures in 7 days. Expected payout ~${INR((inv.investedAmount || 0) + (inv.investedAmount || 0) * ((inv.interestRate || 0) / 100) * ((inv.durationMonths || 0) / 12))}.`,
            inv.id,
            'investment',
            {
              dueDate: inv.maturityDate,
              expiresAt: new Date(t.getTime() + 8 * 86_400_000).toISOString(),
              severity: 'low',
              actionLabel: 'View Investment',
              actionPath: '/investments',
            },
          ),
        );
      } else if (days === 30) {
        notifs.push(
          makeNotif(
            'investment_maturity_upcoming',
            '⏳ 30 Days Until Maturity',
            `"${inv.name}" ${inv.type === 'bond' ? 'bond' : 'FD'} matures in a month.`,
            inv.id,
            'investment',
            {
              dueDate: inv.maturityDate,
              expiresAt: new Date(t.getTime() + 31 * 86_400_000).toISOString(),
              severity: 'low',
              actionLabel: 'Investments',
              actionPath: '/investments',
            },
          ),
        );
      }
    });

    // ── SIP ─────────────────────────────────────────────────────────────────
    (() => {
      const budget = (portfolio.sipPlans || []).find((x: any) => x && x.type === 'budget');
      const instruments = (portfolio.sipPlans || []).filter((x: any) => x && x.type === 'instrument');
      const budgetAmt = budget?.budget || 0;
      const totalPct = instruments.reduce((s: number, i: any) => s + (i.percentage || 0), 0);

      if (budgetAmt > 0 && t.getDate() <= 7) {
        notifs.push(
          makeNotif(
            'sip_reminder',
            '📅 SIP Time — Invest This Month!',
            `Your planned SIP budget is ${INR(budgetAmt)} across ${instruments.length} instrument${instruments.length === 1 ? '' : 's'}. Execute your orders early in the month for better rupee-cost averaging.`,
            'sip_nudge',
            'sip',
            {
              expiresAt: new Date(t.getFullYear(), t.getMonth() + 1, 0).toISOString(),
              severity: 'low',
              actionLabel: 'Open SIP Plan',
              actionPath: '/investments?tab=sip-plan',
            },
          ),
        );
      }

      if (budgetAmt > 0 && instruments.length > 0 && (totalPct < 95 || totalPct > 100)) {
        notifs.push(
          makeNotif(
            'sip_allocation_mismatch',
            totalPct > 100 ? '🧭 SIP Over-Allocated!' : '🧭 SIP Not Fully Allocated',
            `Your planned instrument allocation sums to ${totalPct.toFixed(0)}%. ${
              totalPct > 100
                ? `That's over 100% of your budget — trim some allocations.`
                : `${(100 - totalPct).toFixed(0)}% of ${INR(budgetAmt)} is still unallocated.`
            }`,
            'sip_alloc',
            'sip',
            {
              expiresAt: new Date(t.getFullYear(), t.getMonth() + 1, 0).toISOString(),
              severity: totalPct > 100 ? 'high' : 'medium',
              actionLabel: 'Fix Allocation',
              actionPath: '/investments?tab=sip-plan',
            },
          ),
        );
      }
    })();

    // ── Lending ─────────────────────────────────────────────────────────────
    portfolio.lendingBorrowers?.forEach((borrower) => {
      if (borrower.status !== 'active') return;
      if (!borrower.nextDueDate) return;
      const days = differenceInDays(parseISO(borrower.nextDueDate), t);
      if (days < -30) return;
      const validIds = new Set(portfolio.lendingBorrowers.map((b) => b.id));
      const given = portfolio.lendingTransactions
        .filter((tx) => validIds.has(tx.borrowerId) && tx.borrowerId === borrower.id && tx.type === 'principal_given')
        .reduce((s, tx) => s + (tx.amount || 0), 0);
      const returned = portfolio.lendingTransactions
        .filter((tx) => validIds.has(tx.borrowerId) && tx.borrowerId === borrower.id && tx.type === 'principal_returned')
        .reduce((s, tx) => s + (tx.amount || 0), 0);
      const outstanding = given - returned;
      const amtLine = outstanding > 0 ? ` (${INR(outstanding)} due)` : '';

      let fire = false;
      let fireKey = '';
      let title = '';
      let message = '';
      if (days === 0) {
        fire = true;
        fireKey = 'today';
        title = `🤝 Collect Today: ${borrower.name}`;
        message = `Payment from ${borrower.name}${amtLine} is due today. Follow up!`;
      } else if (days === 3) {
        fire = true;
        fireKey = '3d';
        title = `🤝 3 Days Until ${borrower.name} Payment`;
        message = `Remind ${borrower.name} about the payment${amtLine} on ${format(parseISO(borrower.nextDueDate), 'dd MMM')}.`;
      } else if (days === 7) {
        fire = true;
        fireKey = '7d';
        title = `🤝 Lending Due in a Week — ${borrower.name}`;
        message = `${borrower.name}${amtLine} — due ${format(parseISO(borrower.nextDueDate), 'dd MMM')}.`;
      } else if (days < 0 && [-1, -3, -7, -14, -21].includes(days)) {
        fire = true;
        fireKey = `overdue_${Math.abs(days)}d`;
        title = `❗ OVERDUE ${Math.abs(days)}d: ${borrower.name}`;
        message = `${borrower.name}'s payment${amtLine} is ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue. Collect immediately.`;
      }
      if (!fire || !fireKey) return;
      notifs.push(
        makeNotif(
          days < 0 ? 'lending_overdue' : 'lending_due',
          title,
          message,
          borrower.id,
          'lending',
          {
            dueDate: borrower.nextDueDate,
            expiresAt:
              days < 0
                ? new Date(t.getTime() + (Math.abs(days) + 3) * 86_400_000).toISOString()
                : new Date(t.getTime() + (days + 1) * 86_400_000).toISOString(),
            severity: days < -7 ? 'high' : days < 0 ? 'medium' : days === 0 ? 'high' : 'low',
            actionLabel: 'Open Lending',
            actionPath: '/cashflow?tab=lending',
          },
        ),
      );
    });

    // ── Credentials ─────────────────────────────────────────────────────────
    portfolio.credentials?.forEach((c) => {
      if (!c.updatedAt && !c.createdAt) return;
      const updated = parseISO(c.updatedAt || c.createdAt);
      const ageDays = differenceInDays(t, updated);
      if (ageDays >= 365 && ageDays < 365 + 7) {
        notifs.push(
          makeNotif(
            'credential_stale',
            `🔐 "${c.title}" — ${c.category === 'login' ? 'Password' : 'Data'} Not Updated in 1+ Year`,
            `Your stored ${c.category || 'credential'} "${c.title}" was last updated ${ageDays} days ago. For security, review and rotate it.`,
            c.id,
            'credential',
            {
              expiresAt: new Date(updated.getTime() + 372 * 86_400_000).toISOString(),
              severity: 'low',
              actionLabel: 'Review Credentials',
              actionPath: '/credentials',
            },
          ),
        );
      }
    });

    // ── Net worth drop ──────────────────────────────────────────────────────
    (() => {
      const snaps = [...(portfolio.networthSnapshots || [])]
        .filter((s) => s && s.createdAt)
        .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
      if (snaps.length < 2) return;
      const cur = snaps[snaps.length - 1];
      const thisMonthStart = startOfMonth(t);
      let prev: typeof cur | null = null;
      for (let i = snaps.length - 2; i >= 0; i--) {
        if (isBefore(parseISO(snaps[i].createdAt!), thisMonthStart)) {
          prev = snaps[i];
          break;
        }
      }
      if (!prev) prev = snaps[Math.max(0, snaps.length - 5)];
      if (!prev) return;
      const drop =
        prev.netWorth > 0 && cur.netWorth > 0
          ? (cur.netWorth - prev.netWorth) / prev.netWorth
          : 0;
      if (drop <= -0.1) {
        notifs.push(
          makeNotif(
            'networth_drop',
            `📉 Net Worth Dropped ${Math.abs(drop * 100).toFixed(1)}% This Month`,
            `From ${INR(prev.netWorth)} on ${format(parseISO(prev.createdAt!), 'dd MMM')} to ${INR(cur.netWorth)} now. Review your largest holdings and liabilities.`,
            'nw_drop',
            'networth',
            {
              expiresAt: new Date(t.getFullYear(), t.getMonth() + 1, 0).toISOString(),
              severity: drop <= -0.2 ? 'critical' : 'high',
              actionLabel: 'View Insights',
              actionPath: '/insights',
            },
          ),
        );
      }
    })();

    // ── Welcome ─────────────────────────────────────────────────────────────
    const anyData =
      (portfolio.investments?.length ?? 0) +
      (portfolio.cashflows?.length ?? 0) +
      (portfolio.liabilities?.length ?? 0) +
      (portfolio.goals?.length ?? 0) +
      (portfolio.accounts?.length ?? 0) +
      (portfolio.trackedPayments?.length ?? 0) +
      (portfolio.insurancePolicies?.length ?? 0);
    if (anyData === 0) {
      notifs.push(
        makeNotif(
          'info',
          '👋 Welcome to FinTrackly!',
          'Start by adding 1) a bank account, 2) your first cashflow entry, 3) one goal. The more you track, the smarter these reminders become!',
          'welcome_nudge',
          'system',
          {
            actionLabel: 'Open Dashboard',
            actionPath: '/dashboard',
          },
        ),
      );
    }

    // ── Trial / subscription ────────────────────────────────────────────────
    if (subscription && !subscription.loading && subscription.userSubscription) {
      const plan = subscription.userSubscription.plan;
      const status = subscription.userSubscription.subscriptionStatus;

      if (plan === 'trial' && status === 'active') {
        notifs.push(
          makeNotif(
            'trial_started',
            'Your 7-Day Free Trial Has Started 🎉',
            'Welcome to Fintrackly! You now have access to all premium features during your free trial. Explore investments, goals, insurance, and more.',
            'trial_started',
            'subscription',
            {
              actionLabel: 'Explore Features',
              actionPath: '/dashboard',
            },
          ),
        );
      }

      if (subscription.isTrial && subscription.trialDaysRemaining !== null) {
        const tdr = subscription.trialDaysRemaining;
        if (tdr === 3) {
          notifs.push(
            makeNotif(
              'trial_ending',
              'Your Free Trial Ends in 3 Days ⏳',
              'Your Fintrackly free trial expires in 3 days. Upgrade now to keep accessing all premium features without interruption.',
              'trial_ending_3d',
              'subscription',
              {
                expiresAt: new Date(t.getTime() + 4 * 86_400_000).toISOString(),
                severity: 'medium',
                actionLabel: 'Upgrade Now',
                actionPath: '/pricing',
              },
            ),
          );
        } else if (tdr === 1) {
          notifs.push(
            makeNotif(
              'trial_ending',
              'Your Free Trial Ends Tomorrow ⏳',
              'Your Fintrackly free trial ends tomorrow. Subscribe today to continue using all premium features seamlessly.',
              'trial_ending_1d',
              'subscription',
              {
                expiresAt: new Date(t.getTime() + 2 * 86_400_000).toISOString(),
                severity: 'high',
                actionLabel: 'Upgrade Now',
                actionPath: '/pricing',
              },
            ),
          );
        } else if (tdr === 0) {
          notifs.push(
            makeNotif(
              'trial_ending',
              'Your Free Trial Ends Today ⏳',
              'This is the last day of your free trial. Subscribe before midnight to avoid losing access to premium features.',
              'trial_ending_today',
              'subscription',
              {
                expiresAt: endOfToday().toISOString(),
                severity: 'high',
                actionLabel: 'Subscribe Now',
                actionPath: '/pricing',
              },
            ),
          );
        }
      }

      if (subscription.isExpired && plan === 'trial') {
        notifs.push(
          makeNotif(
            'trial_expired',
            'Your Free Trial Has Ended 🔒',
            'Your 7-day free trial has ended. Upgrade your plan to continue accessing all premium features including exports, analytics, and unlimited transactions.',
            'trial_expired',
            'subscription',
            {
              expiresAt: new Date(t.getFullYear(), t.getMonth() + 1, 0).toISOString(),
              severity: 'critical',
              actionLabel: 'Upgrade Plan',
              actionPath: '/pricing',
            },
          ),
        );
      }

      if (plan !== 'trial' && plan !== 'lifetime' && status === 'active' && !subscription.isExpired) {
        const daysLeft = subscription.userSubscription.expiresAt
          ? differenceInDays(
              new Date(
                typeof subscription.userSubscription.expiresAt === 'object' && 'toDate' in subscription.userSubscription.expiresAt
                  ? (subscription.userSubscription.expiresAt as any).toDate()
                  : subscription.userSubscription.expiresAt,
              ),
              t,
            )
          : null;
        if (daysLeft !== null && daysLeft <= 7 && daysLeft >= 0) {
          notifs.push(
            makeNotif(
              'subscription_expiring',
              `Your Subscription Expires ${daysLeft === 0 ? 'Today' : `in ${daysLeft} Day${daysLeft === 1 ? '' : 's'}`} ⏰`,
              `Your Fintrackly ${plan} plan expires ${daysLeft === 0 ? 'today' : `in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`}. Renew now to avoid interruption.`,
              `sub_expiring_${daysLeft}d`,
              'subscription',
              {
                expiresAt: new Date(t.getTime() + (daysLeft + 1) * 86_400_000).toISOString(),
                severity: daysLeft <= 1 ? 'high' : 'medium',
                actionLabel: 'Renew Now',
                actionPath: '/pricing',
              },
            ),
          );
        }
      }

      if (plan !== 'trial' && subscription.isExpired) {
        notifs.push(
          makeNotif(
            'subscription_expired',
            'Your Subscription Has Expired 🔒',
            'Your Fintrackly subscription has ended. Renew your plan to continue accessing all premium features.',
            'sub_expired',
            'subscription',
            {
              expiresAt: new Date(t.getFullYear(), t.getMonth() + 1, 0).toISOString(),
              severity: 'critical',
              actionLabel: 'Renew Plan',
              actionPath: '/pricing',
            },
          ),
        );
      }

      if (plan !== 'trial' && status === 'active' && !subscription.isExpired && !subscription.isTrial) {
        const planLabel =
          plan === 'monthly'
            ? 'Monthly'
            : plan === 'yearly'
              ? 'Yearly'
              : 'Lifetime';
        notifs.push(
          makeNotif(
            'subscription_activated',
            `${planLabel} Plan Activated ⭐`,
            `Your Fintrackly ${planLabel} plan is now active. Enjoy full access to all premium features — thank you for subscribing!`,
            `sub_activated_${plan}`,
            'subscription',
            {
              actionLabel: 'View Dashboard',
              actionPath: '/dashboard',
            },
          ),
        );
      }
    }

    // ── Apply read/dismissed state ──────────────────────────────────────────
    const validIds = new Set(notifs.map((n) => n.id));
    const cleanedReadIds = new Set([...readIds].filter((id) => validIds.has(id)));
    const cleanedDismissedIds = new Set([...dismissedIds].filter((id) => validIds.has(id)));

    const enriched = notifs.map((n) => ({
      ...n,
      read: cleanedReadIds.has(n.id),
      dismissed: cleanedDismissedIds.has(n.id),
    }));

    // Filter out expired notifications
    const now = new Date().toISOString();
    const filtered = enriched.filter(
      (n) => !n.expiresAt || new Date(n.expiresAt) >= new Date(now),
    );

    // Filter out dismissed notifications
    const active = filtered.filter((n) => !n.dismissed);

    // Sort newest first
    const sorted = active.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    // Clean stale read/dismissed IDs
    if (cleanedReadIds.size !== readIds.size || cleanedDismissedIds.size !== dismissedIds.size) {
      const validReadIds = [...cleanedReadIds];
      const validDismissedIds = [...cleanedDismissedIds];
      useNotificationStore.getState().setReadState(validReadIds, validDismissedIds);
    }

    return sorted;
  }, [
    portfolio.insurancePolicies,
    portfolio.liabilities,
    portfolio.trackedPayments,
    portfolio.pendingPayments,
    portfolio.goals,
    portfolio.goalContributions,
    portfolio.investments,
    portfolio.sipPlans,
    portfolio.lendingBorrowers,
    portfolio.lendingTransactions,
    portfolio.credentials,
    portfolio.networthSnapshots,
    portfolio.essentials,
    subscription?.isTrial,
    subscription?.trialDaysRemaining,
    subscription?.isExpired,
    subscription?.hasPremiumAccess,
    subscription?.loading,
    subscription?.userSubscription,
    notifStore.readIds,
    notifStore.dismissedIds,
  ]);

  return derived;
}
