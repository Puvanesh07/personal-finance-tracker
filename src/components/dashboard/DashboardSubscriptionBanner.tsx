import { FiAlertTriangle, FiClock, FiZap } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import {
  formatSubscriptionDate,
  useSubscription,
} from '../../context/SubscriptionContext';
import { OWNER_EMAIL } from '../../utils/subscriptionUtils';
import { auth } from '../../services/firebase';

export function DashboardSubscriptionBanner() {
  const {
    loading,
    userSubscription,
    hasPremiumAccess,
    isTrial,
    isExpired,
    trialDaysRemaining,
    graceDaysRemaining,
  } = useSubscription();

  const email = auth.currentUser?.email?.trim().toLowerCase() ?? '';
  if (loading || email === OWNER_EMAIL) return null;
  if (userSubscription?.premiumGranted || userSubscription?.plan === 'lifetime') return null;

  if (isTrial && hasPremiumAccess) {
    return (
      <section className='rounded-2xl border border-emerald-500/25 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent p-4 md:p-5'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
          <div>
            <p className='flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-300'>
              <FiClock className='h-4 w-4' />
              Free trial active
            </p>
            <dl className='mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 sm:gap-3'>
              <div>
                <dt className='font-semibold uppercase tracking-wide text-slate-500'>Trial start</dt>
                <dd className='mt-0.5 font-bold text-slate-900 dark:text-white'>
                  {formatSubscriptionDate(userSubscription?.trialStart ?? null)}
                </dd>
              </div>
              <div>
                <dt className='font-semibold uppercase tracking-wide text-slate-500'>Trial end</dt>
                <dd className='mt-0.5 font-bold text-slate-900 dark:text-white'>
                  {formatSubscriptionDate(userSubscription?.trialEnd ?? null)}
                </dd>
              </div>
              <div>
                <dt className='font-semibold uppercase tracking-wide text-slate-500'>Days left</dt>
                <dd className='mt-0.5 font-bold text-slate-900 dark:text-white'>
                  {trialDaysRemaining ?? '—'}
                </dd>
              </div>
              <div>
                <dt className='font-semibold uppercase tracking-wide text-slate-500'>
                  Deletion date
                </dt>
                <dd className='mt-0.5 font-bold text-slate-900 dark:text-white'>
                  {formatSubscriptionDate(userSubscription?.gracePeriodEnd ?? null)}
                </dd>
              </div>
            </dl>
            <p className='mt-3 text-xs leading-relaxed text-slate-600 dark:text-slate-400'>
              Full premium access during the trial. If you do not upgrade after the trial ends, your
              data is scheduled for deletion on the date above.
            </p>
          </div>
          <Link
            to='/pricing'
            className='inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-500'
          >
            <FiZap className='h-3.5 w-3.5' />
            Upgrade
          </Link>
        </div>
      </section>
    );
  }

  if (isExpired || !hasPremiumAccess) {
    return (
      <section className='rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 md:p-5'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
          <div>
            <p className='flex items-center gap-2 text-sm font-bold text-rose-600 dark:text-rose-300'>
              <FiAlertTriangle className='h-4 w-4' />
              Trial expired — account deletion warning
            </p>
            <dl className='mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3'>
              <div>
                <dt className='font-semibold uppercase tracking-wide text-rose-500/80'>
                  Trial ended
                </dt>
                <dd className='mt-0.5 font-bold text-rose-700 dark:text-rose-200'>
                  {formatSubscriptionDate(
                    userSubscription?.trialEnd ?? userSubscription?.expiresAt ?? null,
                  )}
                </dd>
              </div>
              <div>
                <dt className='font-semibold uppercase tracking-wide text-rose-500/80'>
                  Days until deletion
                </dt>
                <dd className='mt-0.5 font-bold text-rose-700 dark:text-rose-200'>
                  {graceDaysRemaining ?? '—'}
                </dd>
              </div>
              <div>
                <dt className='font-semibold uppercase tracking-wide text-rose-500/80'>
                  Deletion date
                </dt>
                <dd className='mt-0.5 font-bold text-rose-700 dark:text-rose-200'>
                  {formatSubscriptionDate(userSubscription?.gracePeriodEnd ?? null)}
                </dd>
              </div>
            </dl>
            <p className='mt-3 text-xs leading-relaxed text-rose-700/90 dark:text-rose-200/90'>
              Premium features are locked. Subscribe now to restore access and cancel scheduled data
              deletion.
            </p>
          </div>
          <Link
            to='/pricing'
            className='inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-rose-500'
          >
            <FiZap className='h-3.5 w-3.5' />
            Upgrade now
          </Link>
        </div>
      </section>
    );
  }

  return null;
}
