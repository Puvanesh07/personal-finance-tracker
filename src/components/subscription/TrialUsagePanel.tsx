// src/components/subscription/TrialUsagePanel.tsx
// Per-feature trial usage progress bars shown on the Pricing / Subscription page.
// - Trial users  → shows count / limit with colour-coded bar and "Limit reached" badge.
// - Premium users → shows "Unlimited ✓" for every feature.

import { FiCheck, FiLock, FiZap } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { useTrialLimits } from '../../hooks/useTrialLimits';
import type { FeatureUsage } from '../../hooks/useTrialLimits';
import { useSubscription } from '../../context/SubscriptionContext';

// ── Progress bar colour based on fill percentage ──────────────────────────────
function barColour(pct: number, atLimit: boolean): string {
  if (atLimit || pct >= 100) return 'bg-rose-500';
  if (pct >= 80) return 'bg-amber-400';
  return 'bg-emerald-500';
}

// ── Single feature row ────────────────────────────────────────────────────────
function FeatureRow({ f }: { f: FeatureUsage }) {
  if (f.unlimited) {
    return (
      <div className='flex items-center justify-between gap-3 rounded-xl border border-slate-200/60 dark:border-slate-700/50 bg-white dark:bg-slate-900/40 px-4 py-3'>
        <div className='flex items-center gap-2.5 min-w-0'>
          <span className='text-base shrink-0' aria-hidden='true'>{f.icon}</span>
          <span className='text-sm font-semibold text-slate-800 dark:text-slate-200 truncate'>
            {f.label}
          </span>
        </div>
        <div className='flex shrink-0 items-center gap-1.5 text-emerald-500'>
          <span className='text-sm font-bold leading-none' aria-hidden='true'>∞</span>
          <span className='text-xs font-bold'>Unlimited</span>
          <FiCheck className='h-3.5 w-3.5' aria-hidden='true' />
        </div>
      </div>
    );
  }

  const colour = barColour(f.pct, f.atLimit);

  return (
    <div className='rounded-xl border border-slate-200/60 dark:border-slate-700/50 bg-white dark:bg-slate-900/40 px-4 py-3 flex flex-col gap-2'>
      {/* Top row: icon + label + count/status */}
      <div className='flex items-center justify-between gap-3'>
        <div className='flex items-center gap-2.5 min-w-0'>
          <span className='text-base shrink-0' aria-hidden='true'>{f.icon}</span>
          <span className='text-sm font-semibold text-slate-800 dark:text-slate-200 truncate'>
            {f.label}
          </span>
        </div>

        <div className='shrink-0 flex items-center gap-2'>
          {f.atLimit ? (
            <span className='flex items-center gap-1 rounded-full bg-rose-500/15 border border-rose-500/25 px-2 py-0.5 text-[10px] font-bold text-rose-500'>
              <FiLock className='h-2.5 w-2.5' aria-hidden='true' />
              Limit reached
            </span>
          ) : (
            <span className='text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400'>
              {f.count}&nbsp;/&nbsp;{f.limit}
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div
        className='h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700/60'
        role='progressbar'
        aria-valuenow={f.count}
        aria-valuemin={0}
        aria-valuemax={f.limit}
        aria-label={`${f.label}: ${f.count} of ${f.limit} used`}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${colour}`}
          style={{ width: `${f.pct}%` }}
        />
      </div>

      {/* Sub-line */}
      {f.atLimit ? (
        <p className='text-[11px] text-rose-500 leading-snug'>
          You've used all {f.limit} {f.label.toLowerCase()} allowed on the free trial.{' '}
          <Link to='/pricing' className='font-bold underline underline-offset-2 hover:text-rose-400'>
            Upgrade
          </Link>{' '}
          to add more.
        </p>
      ) : (
        <p className='text-[11px] text-slate-400 dark:text-slate-500 tabular-nums'>
          {f.count} used · {Math.max(0, f.limit - f.count)} remaining
        </p>
      )}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────
export function TrialUsagePanel() {
  const { isTrialUser, isPremium, usageList, anyAtLimit } = useTrialLimits();
  const { trialDaysRemaining } = useSubscription();

  // Don't render anything while subscription data is still loading
  // (usageList will be all-zero, which looks correct anyway — but we hide
  // the panel entirely for non-trial, non-premium cases like loading state)
  if (!isTrialUser && !isPremium) return null;

  return (
    <section
      className='rounded-2xl border border-slate-200/70 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-900/50 p-5 flex flex-col gap-4'
      aria-label='Trial feature usage'
    >
      {/* Header */}
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div className='min-w-0'>
          <h2 className='text-base font-bold text-slate-900 dark:text-slate-100'>
            {isPremium ? 'Your Plan — Unlimited Access' : 'Free Trial Usage'}
          </h2>
          <p className='mt-0.5 text-xs text-slate-500 dark:text-slate-400'>
            {isPremium
              ? 'All features are fully unlocked. No limits apply.'
              : trialDaysRemaining !== null && trialDaysRemaining > 0
                ? `${trialDaysRemaining} day${trialDaysRemaining === 1 ? '' : 's'} remaining in your free trial`
                : 'Your free trial has ended — upgrade to continue.'}
          </p>
        </div>

        {/* "Upgrade Now" CTA — only shown to active trial users */}
        {isTrialUser && !isPremium && (
          <Link
            to='/pricing'
            className='shrink-0 flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-3 py-2 text-xs font-bold text-white hover:from-emerald-400 hover:to-emerald-500 transition-all shadow-sm shadow-emerald-500/20'
          >
            <FiZap className='h-3.5 w-3.5' aria-hidden='true' />
            Upgrade Now
          </Link>
        )}
      </div>

      {/* Limit-reached global banner */}
      {anyAtLimit && isTrialUser && (
        <div className='flex items-start gap-3 rounded-xl border border-rose-500/25 bg-rose-500/8 px-4 py-3'>
          <FiLock className='h-4 w-4 shrink-0 mt-0.5 text-rose-500' aria-hidden='true' />
          <p className='text-xs text-rose-600 dark:text-rose-400 leading-relaxed'>
            <span className='font-bold'>One or more features are at their trial limit.</span>{' '}
            Upgrade to a paid plan to remove all limits and keep adding records.
          </p>
        </div>
      )}

      {/* Feature rows — 2-col grid on sm+ for compactness */}
      <div className='grid gap-2.5 sm:grid-cols-2'>
        {usageList.map((f) => (
          <FeatureRow key={f.key} f={f} />
        ))}
      </div>

      {/* Footer note for trial users */}
      {isTrialUser && (
        <p className='text-center text-[11px] text-slate-400 dark:text-slate-600'>
          Counts update immediately when you add or delete records.
          Upgrading removes all limits instantly.
        </p>
      )}
    </section>
  );
}
