import { FiX, FiZap } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useSubscription } from '../../context/SubscriptionContext';

type ModalCase = 'three_days' | 'one_day' | 'expired' | null;

const SESSION_KEY = 'fintrackly-upgrade-modal-dismissed';

function getModalCase(
  isTrial: boolean,
  hasPremiumAccess: boolean,
  isExpired: boolean,
  trialDaysRemaining: number | null,
): ModalCase {
  if (isExpired || (!hasPremiumAccess && !isTrial)) return 'expired';
  if (!isTrial || !hasPremiumAccess || trialDaysRemaining === null) return null;
  if (trialDaysRemaining === 3) return 'three_days';
  if (trialDaysRemaining === 1) return 'one_day';
  return null;
}

const COPY: Record<
  Exclude<ModalCase, null>,
  { title: string; message: string; primary: string; secondary: string }
> = {
  three_days: {
    title: 'Your free trial ends in 3 days',
    message: 'Subscribe now to continue using premium features without interruption.',
    primary: 'Upgrade Now',
    secondary: 'Later',
  },
  one_day: {
    title: 'Trial ends tomorrow',
    message: 'Upgrade today to avoid feature lock.',
    primary: 'Upgrade Now',
    secondary: 'Remind Me Later',
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
    trialDaysRemaining,
    upgradeModalDismissed,
    dismissUpgradeModalForSession,
  } = useSubscription();

  const [open, setOpen] = useState(false);
  const modalCase = getModalCase(isTrial, hasPremiumAccess, isExpired, trialDaysRemaining);

  useEffect(() => {
    if (loading) return;

    const sessionDismissed = sessionStorage.getItem(SESSION_KEY) === '1';
    if (modalCase === 'expired') {
      setOpen(true);
      return;
    }
    if (upgradeModalDismissed || sessionDismissed) return;
    if (modalCase) setOpen(true);
  }, [loading, modalCase, upgradeModalDismissed]);

  if (!open || !modalCase) return null;

  const copy = COPY[modalCase];

  const handleDismiss = () => {
    if (modalCase !== 'expired') {
      sessionStorage.setItem(SESSION_KEY, '1');
      dismissUpgradeModalForSession();
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
          {modalCase !== 'expired' && (
            <button
              type='button'
              onClick={handleDismiss}
              className='rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
            >
              <FiX className='h-4 w-4' />
            </button>
          )}
        </div>

        <h2 className='mt-4 text-xl font-black text-slate-900 dark:text-white'>{copy.title}</h2>
        <p className='mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400'>
          {copy.message}
        </p>

        <div className='mt-6 flex flex-col gap-2 sm:flex-row'>
          <Link
            to='/pricing'
            onClick={() => setOpen(false)}
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
