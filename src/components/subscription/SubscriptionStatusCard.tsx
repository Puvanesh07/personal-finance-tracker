import { FiCreditCard, FiLoader, FiRefreshCw, FiShield, FiZap } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import toast from 'react-hot-toast';
import {
  formatSubscriptionDate,
  useSubscription,
} from '../../context/SubscriptionContext';
import { auth } from '../../services/firebase';
import { adminManageSubscription, restorePurchase } from '../../services/subscriptionService';
import { formatPlanLabel } from '../../utils/subscriptionUtils';

const ownerEmail = import.meta.env.VITE_OWNER_EMAIL?.trim().toLowerCase() ?? '';

export function SubscriptionStatusCard() {
  const {
    userSubscription,
    loading,
    hasPremiumAccess,
    daysRemaining,
    graceDaysRemaining,
    isTrial,
    isExpired,
    refreshSubscription,
  } = useSubscription();
  const [restoring, setRestoring] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminBusy, setAdminBusy] = useState(false);

  const currentEmail = auth.currentUser?.email?.trim().toLowerCase() ?? '';
  const isOwner = Boolean(ownerEmail && currentEmail === ownerEmail);
  const isGranted = userSubscription?.premiumGranted === true;

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const result = await restorePurchase();
      if (result.restored) toast.success(result.message);
      else toast.error(result.message);
    } catch {
      toast.error('Could not restore purchase');
    } finally {
      setRestoring(false);
    }
  };

  const handleSetAccess = async (enabled: boolean) => {
    const email = adminEmail.trim().toLowerCase();
    if (!email) {
      toast.error('Enter the user email');
      return;
    }

    setAdminBusy(true);
    try {
      await adminManageSubscription({
        action: 'setPremiumAccess',
        email,
        enabled,
      });
      await refreshSubscription();
      toast.success(enabled ? `Premium granted to ${email}` : `Premium removed from ${email}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update access');
    } finally {
      setAdminBusy(false);
    }
  };

  const handleBackfill = async () => {
    setAdminBusy(true);
    try {
      const result = await adminManageSubscription({ action: 'backfillPremiumGranted' });
      if ('updated' in result) {
        toast.success(`Backfilled premiumGranted on ${result.updated} of ${result.total} users`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Backfill failed');
    } finally {
      setAdminBusy(false);
    }
  };

  if (loading) {
    return (
      <div className='rounded-2xl border border-slate-200 bg-slate-100 p-6 animate-pulse dark:border-slate-800 dark:bg-slate-900/60'>
        <div className='h-5 w-40 rounded bg-slate-200 dark:bg-slate-800' />
      </div>
    );
  }

  const statusLabel = hasPremiumAccess
    ? 'Active'
    : isExpired
      ? 'Expired'
      : userSubscription?.subscriptionStatus ?? 'Unknown';

  const statusColor = hasPremiumAccess
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-rose-500';

  return (
    <div className='rounded-2xl border border-slate-200 bg-slate-100 p-6 dark:border-slate-800 dark:bg-slate-900/60'>
      <div className='mb-5 flex items-center gap-3'>
        <div className='flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500'>
          <FiCreditCard className='h-5 w-5' />
        </div>
        <div>
          <h2 className='text-lg font-bold text-slate-900 dark:text-white'>Subscription</h2>
          <p className='text-xs text-slate-500'>Manage your FinTrackly plan</p>
        </div>
      </div>

      <dl className='grid gap-3 sm:grid-cols-2'>
        <div className='rounded-xl bg-white/70 px-4 py-3 dark:bg-slate-800/50'>
          <dt className='text-[11px] font-bold uppercase tracking-wider text-slate-500'>
            Current Plan
          </dt>
          <dd className='mt-1 text-sm font-bold text-slate-900 dark:text-slate-100'>
            {formatPlanLabel(userSubscription?.plan)}
          </dd>
        </div>
        <div className='rounded-xl bg-white/70 px-4 py-3 dark:bg-slate-800/50'>
          <dt className='text-[11px] font-bold uppercase tracking-wider text-slate-500'>Status</dt>
          <dd className={`mt-1 text-sm font-bold capitalize ${statusColor}`}>{statusLabel}</dd>
        </div>
        {isGranted && (
          <div className='rounded-xl bg-violet-500/10 px-4 py-3 sm:col-span-2'>
            <dt className='text-[11px] font-bold uppercase tracking-wider text-violet-600'>
              Complimentary access
            </dt>
            <dd className='mt-1 text-sm font-semibold text-violet-700 dark:text-violet-300'>
              Premium granted by owner — no payment required
            </dd>
          </div>
        )}
        {isTrial && (
          <div className='rounded-xl bg-white/70 px-4 py-3 dark:bg-slate-800/50'>
            <dt className='text-[11px] font-bold uppercase tracking-wider text-slate-500'>
              Trial End Date
            </dt>
            <dd className='mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100'>
              {formatSubscriptionDate(userSubscription?.trialEnd ?? null)}
            </dd>
          </div>
        )}
        <div className='rounded-xl bg-white/70 px-4 py-3 dark:bg-slate-800/50'>
          <dt className='text-[11px] font-bold uppercase tracking-wider text-slate-500'>
            {userSubscription?.plan === 'lifetime' || isGranted ? 'Access' : 'Expiry Date'}
          </dt>
          <dd className='mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100'>
            {userSubscription?.plan === 'lifetime' || isGranted
              ? 'Never expires'
              : formatSubscriptionDate(userSubscription?.expiresAt ?? null)}
          </dd>
        </div>
        {daysRemaining !== null && userSubscription?.plan !== 'lifetime' && !isGranted && (
          <div className='rounded-xl bg-white/70 px-4 py-3 dark:bg-slate-800/50'>
            <dt className='text-[11px] font-bold uppercase tracking-wider text-slate-500'>
              Days Remaining
            </dt>
            <dd className='mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100'>
              {daysRemaining}
            </dd>
          </div>
        )}
        {isExpired && graceDaysRemaining !== null && (
          <div className='rounded-xl bg-rose-500/10 px-4 py-3'>
            <dt className='text-[11px] font-bold uppercase tracking-wider text-rose-500'>
              Data Deletion In
            </dt>
            <dd className='mt-1 text-sm font-bold text-rose-600 dark:text-rose-300'>
              {graceDaysRemaining} day{graceDaysRemaining === 1 ? '' : 's'}
            </dd>
          </div>
        )}
      </dl>

      <div className='mt-6 flex flex-wrap gap-3'>
        {!hasPremiumAccess && (
          <Link
            to='/pricing'
            className='inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-5 py-2.5 text-sm font-bold text-white'
          >
            <FiZap className='h-4 w-4' />
            Upgrade
          </Link>
        )}
        <button
          type='button'
          onClick={handleRestore}
          disabled={restoring}
          className='inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
        >
          {restoring ? (
            <FiLoader className='h-4 w-4 animate-spin' />
          ) : (
            <FiRefreshCw className='h-4 w-4' />
          )}
          Restore Purchase
        </button>
      </div>

      {isOwner && (
        <div className='mt-6 rounded-xl border border-violet-500/30 bg-violet-500/5 p-4'>
          <div className='mb-3 flex items-center gap-2'>
            <FiShield className='h-4 w-4 text-violet-500' />
            <h3 className='text-sm font-bold text-slate-900 dark:text-white'>
              Grant premium (no payment)
            </h3>
          </div>
          <p className='mb-3 text-xs text-slate-600 dark:text-slate-400'>
            Turn premium on or off for any signed-up email. They will not be asked to pay.
          </p>
          <label className='block text-xs font-semibold text-slate-600 dark:text-slate-400'>
            User email
            <input
              type='email'
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder='user@gmail.com'
              className='mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white'
            />
          </label>
          <div className='mt-3 flex flex-wrap gap-2'>
            <button
              type='button'
              disabled={adminBusy}
              onClick={() => handleSetAccess(true)}
              className='rounded-lg bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-500 disabled:opacity-60'
            >
              {adminBusy ? 'Working…' : 'Grant premium (true)'}
            </button>
            <button
              type='button'
              disabled={adminBusy}
              onClick={() => handleSetAccess(false)}
              className='rounded-lg border border-violet-500/40 px-4 py-2 text-xs font-bold text-violet-700 hover:bg-violet-500/10 disabled:opacity-60 dark:text-violet-300'
            >
              Remove premium (false)
            </button>
            <button
              type='button'
              disabled={adminBusy}
              onClick={handleBackfill}
              className='rounded-lg border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800'
            >
              Backfill all users
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
