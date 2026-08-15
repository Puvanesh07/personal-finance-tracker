import { FiX, FiZap } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { auth } from '../../services/firebase';
import { useSubscription } from '../../context/SubscriptionContext';
import { OWNER_EMAIL } from '../../utils/subscriptionUtils';

type ModalCase = 'trial_welcome' | 'expired' | null;

function storageKey(uid: string, kind: 'trial' | 'expired') {
  return `fintrackly-upgrade-modal-${kind}-${uid}`;
}

function getModalCase(
  isTrial: boolean,
  hasPremiumAccess: boolean,
  isExpired: boolean,
  authEmail: string | null,
): ModalCase {
  const email = authEmail?.trim().toLowerCase() ?? '';
  if (email === OWNER_EMAIL) return null;
  if (hasPremiumAccess && isTrial) return 'trial_welcome';
  if (isExpired || (!hasPremiumAccess && !isTrial)) return 'expired';
  return null;
}

const COPY: Record<
  Exclude<ModalCase, null>,
  { title: string; message: string; primary: string; secondary: string }
> = {
  trial_welcome: {
    title: 'Your 7-day free trial is active',
    message:
      'You have full access to all premium features during the trial. Upgrade anytime to keep access after the trial ends. After expiry, unpaid accounts are scheduled for data deletion in 30 days.',
    primary: 'Upgrade Now',
    secondary: 'Continue with Free Trial',
  },
  expired: {
    title: 'Trial expired',
    message:
      'Premium features are locked. Your data will be deleted after 30 days if you do not subscribe.',
    primary: 'Upgrade Now',
    secondary: 'Continue with Free Access',
  },
};

export function UpgradeModal() {
  const {
    loading,
    isTrial,
    hasPremiumAccess,
    isExpired,
    upgradeModalDismissed,
    dismissUpgradeModalForSession,
  } = useSubscription();

  const [open, setOpen] = useState(false);
  const authEmail = auth.currentUser?.email ?? null;
  const uid = auth.currentUser?.uid ?? '';
  const modalCase = getModalCase(isTrial, hasPremiumAccess, isExpired, authEmail);

  useEffect(() => {
    if (loading || !modalCase || !uid) {
      setOpen(false);
      return;
    }

    // Trial welcome: show once per account (survives refresh)
    if (modalCase === 'trial_welcome') {
      if (localStorage.getItem(storageKey(uid, 'trial')) === '1') {
        setOpen(false);
        return;
      }
      if (upgradeModalDismissed) {
        setOpen(false);
        return;
      }
      setOpen(true);
      return;
    }

    // Expired: show until they subscribe (can dismiss for this browser tab session)
    if (sessionStorage.getItem(storageKey(uid, 'expired')) === '1') {
      setOpen(false);
      return;
    }
    setOpen(true);
  }, [loading, modalCase, upgradeModalDismissed, uid]);

  if (!open || !modalCase) return null;

  const copy = COPY[modalCase];

  const handleDismiss = () => {
    if (modalCase === 'trial_welcome' && uid) {
      localStorage.setItem(storageKey(uid, 'trial'), '1');
      dismissUpgradeModalForSession();
    }
    if (modalCase === 'expired' && uid) {
      sessionStorage.setItem(storageKey(uid, 'expired'), '1');
    }
    setOpen(false);
  };

  return (
    <div className='fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm'>
      <div className='w-full max-w-md rounded-2xl border border-slate-700/80 bg-white p-6 shadow-2xl dark:bg-slate-900'>
        <div className='flex items-start justify-between gap-3'>
          <div className='flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500'>
            <FiZap className='h-6 w-6' />
          </div>
          <button
            type='button'
            onClick={handleDismiss}
            className='rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
            aria-label='Close'
          >
            <FiX className='h-4 w-4' />
          </button>
        </div>

        <h2 className='mt-4 text-xl font-black text-slate-900 dark:text-white'>{copy.title}</h2>
        <p className='mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400'>
          {copy.message}
        </p>

        <div className='mt-6 flex flex-col gap-2 sm:flex-row'>
          <Link
            to='/pricing'
            onClick={handleDismiss}
            className='flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-3 text-sm font-bold text-white'
          >
            <FiZap className='h-4 w-4' />
            {copy.primary}
          </Link>
          <button
            type='button'
            onClick={handleDismiss}
            className='flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
          >
            {copy.secondary}
          </button>
        </div>
      </div>
    </div>
  );
}
