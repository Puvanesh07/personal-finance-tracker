import { FiAlertTriangle, FiClock, FiZap } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { useSubscription } from '../../context/SubscriptionContext';

export function TrialBanner() {
  const {
    hasPremiumAccess,
    isTrial,
    isExpired,
    trialDaysRemaining,
    graceDaysRemaining,
    loading,
  } = useSubscription();

  if (loading) return null;

  const showTrialWarning =
    isTrial && hasPremiumAccess && trialDaysRemaining !== null && trialDaysRemaining <= 3;

  if (!showTrialWarning && !isExpired) return null;

  let message = '';
  let tone: 'warning' | 'danger' = 'warning';

  if (isExpired) {
    tone = 'danger';
    message =
      graceDaysRemaining !== null && graceDaysRemaining > 0
        ? `Trial expired — data deletion in ${graceDaysRemaining} day${graceDaysRemaining === 1 ? '' : 's'}`
        : 'Trial expired — subscribe to restore premium access';
  } else if (trialDaysRemaining === 1) {
    message = 'Trial ends tomorrow';
  } else if (trialDaysRemaining !== null) {
    message = `Trial ends in ${trialDaysRemaining} day${trialDaysRemaining === 1 ? '' : 's'}`;
  }

  if (!message) return null;

  const styles =
    tone === 'danger'
      ? 'border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-200'
      : 'border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100';

  return (
    <div
      className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${styles}`}
    >
      <div className='flex items-center gap-3 min-w-0'>
        {tone === 'danger' ? (
          <FiAlertTriangle className='h-5 w-5 shrink-0 text-rose-500' />
        ) : (
          <FiClock className='h-5 w-5 shrink-0 text-amber-500' />
        )}
        <p className='text-sm font-semibold'>{message}</p>
      </div>
      <Link
        to='/pricing'
        className='inline-flex shrink-0 items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-500'
      >
        <FiZap className='h-3.5 w-3.5' />
        Upgrade
      </Link>
    </div>
  );
}
