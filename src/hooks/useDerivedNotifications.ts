// src/hooks/useDerivedNotifications.ts
// Derives in-app notifications directly from portfolio store data.
//
// DESIGN (rewamped):
//   - This hook performs ONLY pure derivation: build the raw list of
//     notifications that are currently "active" (not expired, conditions met).
//   - Read / dismissed / clearedAt state are NOT applied here. Instead the
//     consuming components (NotificationBell, NotificationsPage) call
//     `useNotificationStore.getState().enrichAndFilter(raw)` which is the
//     SINGLE truth pipeline that:
//        1. Applies Zustand readIds/dismissedIds on top
//        2. Filters out anything createdAt <= store.clearedAt
//        3. Filters out expired items
//        4. Dedupes + sorts newest-first
//   - No store write operations happen during render (eliminates the
//     "Cannot update a component while rendering a different component"
//     React warning entirely).
//   - NO stale-ID cleanup: previously the hook was deleting IDs from readIds
//     whenever a derived notification "wasn't firing today", which caused
//     the intermittent "mark read works / doesn't work" behaviour because
//     the next day the same logical notification (same stable ID) would
//     lose its read state.

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
import { useShallow } from 'zustand/react/shallow';
import { useSubscriptionOptional } from '../context/SubscriptionContext';
import type { NotifType, AppNotification } from '../store/notificationStore';
import {
  buildMoneyAlerts,
  sortBySeverity,
} from '../../shared/alertRules.mjs';
import { useNotificationSettings } from './useNotificationSettings';

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
    /** Stable identifier for *this occurrence* of the alert. Without it the id
     *  falls back to render time, which makes "mark as read" useless — the next
     *  re-render re-creates the notification under a fresh id. */
    occurrence?: string;
  } = {},
): AppNotification {
  const now = new Date().toISOString();
  return {
    id: stableId(
      sourceType,
      sourceId,
      opts.occurrence || opts.dueDate || opts.createdAt || 'general',
    ),
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
    expiresAt: opts.expiresAt,
  };
}

export function useDerivedNotifications(): AppNotification[] {
  const portfolio = usePortfolioStore(
    useShallow((s) => ({
      liabilities: s.liabilities,
      trackedPayments: s.trackedPayments,
      pendingPayments: s.pendingPayments,
      goals: s.goals,
      goalContributions: s.goalContributions,
      essentials: s.essentials,
      investments: s.investments,
      sipPlans: s.sipPlans,
      credentials: s.credentials,
      networthSnapshots: s.networthSnapshots,
      cashflows: s.cashflows,
      accounts: s.accounts,
      insurancePolicies: s.insurancePolicies,
    })),
  );
  const subscription = useSubscriptionOptional();
  const notifSettings = useNotificationSettings();

  return useMemo(() => {
    const notifs: AppNotification[] = [];
    const t = today();
    const monthKey = format(t, 'yyyy-MM');

    // Flags from users/{uid}/notificationSettings/config. `pushEnabled` is the
    // master switch for every channel; the money rules read the same flags
    // inside the shared engine, so a category switched off stops appearing in
    // the bell *and* in the 08:00 email.
    const alertsOn = notifSettings.pushEnabled !== false;
    const wants = (flag: keyof typeof notifSettings) =>
      alertsOn && notifSettings[flag] !== false;

    // ── Money rules: payments, insurance, EMI, maturity, receivables ──────
    // Same engine, same wording and same occurrence keys as the 08:00 email
    // digest (shared/alertRules.mjs), so the bell and the mail can never
    // disagree about what is due.
    sortBySeverity(
      buildMoneyAlerts(
        {
          trackedPayments: portfolio.trackedPayments as any,
          pendingPayments: portfolio.pendingPayments as any,
          liabilities: portfolio.liabilities as any,
          investments: portfolio.investments as any,
          insurancePolicies: portfolio.insurancePolicies as any,
        },
        notifSettings,
      ),
    ).forEach((a) => {
      notifs.push({
        id: `alert:${a.key}`,
        type: a.notifType as NotifType,
        title: a.title,
        message: a.body,
        dueDate: a.dueDate,
        read: false,
        dismissed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        entityId: a.entityId,
        actionLabel: a.actionLabel,
        actionPath: a.clickUrl,
        periodKey: a.dueDate,
        severity: a.severity,
        // Stay visible a few days past the date it refers to, then retire.
        expiresAt: new Date(
          parseISO(a.dueDate.slice(0, 10)).getTime() + 4 * 86_400_000,
        ).toISOString(),
      });
    });

    // ── Goals ───────────────────────────────────────────────────────────────
    const goalAlertsOn = wants('goalReminders');
    portfolio.goals?.forEach((g) => {
      if (!goalAlertsOn) return;
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
              occurrence: 'achieved',
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
                // One lifetime acknowledgement per milestone, so dismissing the
                // 50% note does not silence it forever for a goal that keeps
                // moving — the milestone itself is the occurrence.
                occurrence: `p${p}`,
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
                occurrence: `contrib-${monthKey}`,
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
      if (!goalAlertsOn) return;
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
              occurrence: `low-${monthKey}`,
              expiresAt: new Date(t.getFullYear(), t.getMonth() + 1, 0).toISOString(),
              severity: pct < 15 ? 'critical' : 'medium',
              actionLabel: 'Top Up Now',
              actionPath: efGoal ? '/goals' : '/reports',
            },
          ),
        );
      }
    })();

    // ── SIP ─────────────────────────────────────────────────────────────────
    (() => {
      if (!wants('sipReminders')) return;
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
              occurrence: `nudge-${monthKey}`,
              expiresAt: new Date(t.getFullYear(), t.getMonth() + 1, 0).toISOString(),
              severity: 'low',
              actionLabel: 'Open SIP Plan',
              actionPath: '/wealth?tab=allocation&sub=sip',
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
              occurrence: `alloc-${monthKey}`,
              expiresAt: new Date(t.getFullYear(), t.getMonth() + 1, 0).toISOString(),
              severity: totalPct > 100 ? 'high' : 'medium',
              actionLabel: 'Fix Allocation',
              actionPath: '/wealth?tab=allocation&sub=sip',
            },
          ),
        );
      }
    })();

    // ── Credentials ─────────────────────────────────────────────────────────
    portfolio.credentials?.forEach((c) => {
      if (!alertsOn) return;
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
              occurrence: 'stale-1y',
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
      if (!alertsOn) return;
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
              // One note per calendar month: the drop is a monthly observation,
              // and next month's drop is a different occurrence.
              occurrence: monthKey,
              expiresAt: new Date(t.getFullYear(), t.getMonth() + 1, 0).toISOString(),
              severity: drop <= -0.2 ? 'critical' : 'high',
              actionLabel: 'View Insights',
              actionPath: '/cashflow?tab=insights',
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
    if (anyData === 0 && alertsOn) {
      notifs.push(
        makeNotif(
          'info',
          '👋 Welcome to FinTrackly!',
          'Start by adding 1) a bank account, 2) your first cashflow entry, 3) one goal. The more you track, the smarter these reminders become!',
          'welcome_nudge',
          'system',
          {
            occurrence: 'welcome',
            actionLabel: 'Open Dashboard',
            actionPath: '/dashboard',
          },
        ),
      );
    }

    // ── Trial / subscription ────────────────────────────────────────────────
    if (
      wants('subscriptionAlerts') &&
      subscription &&
      !subscription.loading &&
      subscription.userSubscription
    ) {
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

    return notifs;
  }, [
    portfolio.insurancePolicies,
    portfolio.liabilities,
    portfolio.trackedPayments,
    portfolio.pendingPayments,
    portfolio.goals,
    portfolio.goalContributions,
    portfolio.investments,
    portfolio.sipPlans,
    portfolio.credentials,
    portfolio.networthSnapshots,
    portfolio.essentials,
    subscription?.isTrial,
    subscription?.trialDaysRemaining,
    subscription?.isExpired,
    subscription?.hasPremiumAccess,
    subscription?.loading,
    subscription?.userSubscription,
  ]);
}
