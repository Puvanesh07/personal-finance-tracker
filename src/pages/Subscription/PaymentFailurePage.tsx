import { FiAlertCircle, FiRefreshCw } from 'react-icons/fi';
import { Link } from 'react-router-dom';

export function PaymentFailurePage() {
  return (
    <div className='flex min-h-[60vh] flex-col items-center justify-center text-center'>
      <div className='flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/15 text-rose-500'>
        <FiAlertCircle className='h-9 w-9' />
      </div>
      <h1 className='mt-6 text-2xl font-black text-slate-900 dark:text-white'>Payment Failed</h1>
      <p className='mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400'>
        Something went wrong with your payment. No charges were made. Please try again or use a
        different payment method.
      </p>
      <div className='mt-8 flex flex-wrap justify-center gap-3'>
        <Link
          to='/pricing'
          className='inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-500'
        >
          <FiRefreshCw className='h-4 w-4' />
          Try Again
        </Link>
        <Link
          to='/dashboard'
          className='inline-flex items-center gap-2 rounded-xl border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-300'
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
