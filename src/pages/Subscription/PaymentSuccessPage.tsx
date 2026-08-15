import { FiCheckCircle, FiHome } from 'react-icons/fi';
import { Link, useLocation } from 'react-router-dom';
import { formatPlanLabel } from '../../utils/subscriptionUtils';
import type { PaidPlan } from '../../types/subscription';

export function PaymentSuccessPage() {
  const location = useLocation();
  const plan = (location.state as { plan?: PaidPlan } | null)?.plan;

  return (
    <div className='flex min-h-[60vh] flex-col items-center justify-center text-center'>
      <div className='flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500'>
        <FiCheckCircle className='h-9 w-9' />
      </div>
      <h1 className='mt-6 text-2xl font-black text-slate-900 dark:text-white'>
        Payment Successful!
      </h1>
      <p className='mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400'>
        {plan
          ? `Your ${formatPlanLabel(plan)} plan is now active. All premium features are unlocked.`
          : 'Your subscription is now active. All premium features are unlocked.'}
      </p>
      <Link
        to='/dashboard'
        className='mt-8 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-500'
      >
        <FiHome className='h-4 w-4' />
        Go to Dashboard
      </Link>
    </div>
  );
}
