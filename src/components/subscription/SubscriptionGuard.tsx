import { FiLock, FiZap } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { useSubscription } from '../../context/SubscriptionContext';
import type { PremiumFeature } from '../../types/subscription';

const FEATURE_LABELS: Record<PremiumFeature, string> = {
  portfolio_analytics: 'Portfolio Analytics',
  export: 'Export CSV/Excel',
  ai_insights: 'AI Insights',
  advanced_reports: 'Advanced Reports',
  cloud_backup: 'Cloud Backup',
  unlimited_accounts: 'Unlimited Accounts',
  unlimited_categories: 'Unlimited Categories',
};

interface SubscriptionGuardProps {
  feature: PremiumFeature;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  inline?: boolean;
}

export function SubscriptionGuard({
  feature,
  children,
  fallback,
  inline = false,
}: SubscriptionGuardProps) {
  const { hasPremiumAccess, loading, isExpired } = useSubscription();

  if (loading) {
    return (
      <div className='animate-pulse rounded-2xl border border-slate-200/70 dark:border-slate-800/60 bg-slate-100/60 dark:bg-slate-900/40 p-8'>
        <div className='h-4 w-32 rounded bg-slate-200 dark:bg-slate-800' />
      </div>
    );
  }

  if (hasPremiumAccess) return <>{children}</>;

  if (fallback) return <>{fallback}</>;

  const label = FEATURE_LABELS[feature];

  if (inline) {
    return (
      <div className='flex items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-700 dark:text-amber-300'>
        <FiLock className='h-3.5 w-3.5 shrink-0' />
        <span>{label} requires premium</span>
        <Link to='/pricing' className='ml-auto text-emerald-600 dark:text-emerald-400 hover:underline'>
          Upgrade
        </Link>
      </div>
    );
  }

  return (
    <div className='flex flex-col items-center justify-center rounded-2xl border border-slate-200/70 dark:border-slate-800/60 bg-gradient-to-b from-slate-100/80 to-white dark:from-slate-900/60 dark:to-slate-950/40 p-10 text-center'>
      <div className='mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-500'>
        <FiLock className='h-7 w-7' />
      </div>
      <h3 className='text-lg font-bold text-slate-900 dark:text-slate-100'>{label}</h3>
      <p className='mt-2 max-w-sm text-sm text-slate-600 dark:text-slate-400'>
        {isExpired
          ? 'Your trial has expired. Upgrade to unlock this feature and keep your data.'
          : 'Subscribe to unlock this premium feature and get the full FinTrackly experience.'}
      </p>
      <Link
        to='/pricing'
        className='mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:from-emerald-400 hover:to-emerald-500'
      >
        <FiZap className='h-4 w-4' />
        Upgrade Now
      </Link>
    </div>
  );
}
