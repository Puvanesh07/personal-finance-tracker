import { FiCheck, FiLoader, FiStar, FiZap } from 'react-icons/fi';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { auth } from '../../services/firebase';
import { UpiPaymentModal } from './UpiPaymentModal';
import { PRICING_PLANS, type PaidPlan } from '../../types/subscription';
import { useSubscription } from '../../context/SubscriptionContext';

export function PricingPage() {
  const navigate = useNavigate();
  const { hasPremiumAccess, userSubscription, refreshSubscription } = useSubscription();
  const [selectedPlan, setSelectedPlan] = useState<PaidPlan | null>(null);
  const user = auth.currentUser;

  const handleSubscribe = (plan: PaidPlan) => {
    if (!user?.email) {
      toast.error('Please sign in to subscribe');
      return;
    }
    setSelectedPlan(plan);
  };

  const handlePaid = async (plan: PaidPlan) => {
    await refreshSubscription();
    toast.success('Payment successful! Welcome to premium.');
    setSelectedPlan(null);
    navigate('/payment/success', { replace: true, state: { plan } });
  };

  return (
    <div className='flex flex-col gap-8 pb-10'>
      <header className='rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 to-slate-100/60 p-6 dark:from-emerald-500/10 dark:to-slate-900/40'>
        <div className='flex items-center gap-3'>
          <div className='flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'>
            <FiZap className='h-6 w-6' />
          </div>
          <div>
            <h1 className='text-2xl font-black text-slate-900 dark:text-white'>
              Upgrade to Premium
            </h1>
            <p className='text-sm text-slate-600 dark:text-slate-400'>
              Unlock analytics, AI insights, exports, cloud backup, and more.
            </p>
          </div>
        </div>
        {hasPremiumAccess && userSubscription?.plan !== 'trial' && (
          <p className='mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300'>
            You already have an active {userSubscription?.plan} plan.
          </p>
        )}
      </header>

      <div className='grid gap-5 md:grid-cols-3'>
        {PRICING_PLANS.map((plan) => {
          const isRecommended = Boolean(plan.recommended);

          return (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-2xl border p-6 transition ${
                isRecommended
                  ? 'border-emerald-500/40 bg-emerald-500/5 shadow-lg shadow-emerald-500/10'
                  : 'border-slate-200/70 bg-white dark:border-slate-800/60 dark:bg-slate-900/60'
              }`}
            >
              {isRecommended && (
                <span className='absolute -top-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-emerald-500 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white'>
                  <FiStar className='h-3 w-3' /> Recommended
                </span>
              )}

              <h2 className='text-lg font-bold text-slate-900 dark:text-white'>{plan.name}</h2>
              <div className='mt-3 flex items-end gap-1'>
                <span className='text-3xl font-black text-slate-900 dark:text-white'>
                  {plan.priceLabel}
                </span>
                <span className='pb-1 text-sm text-slate-500'>{plan.period}</span>
              </div>
              <p className='mt-2 text-sm text-slate-600 dark:text-slate-400'>{plan.description}</p>

              <ul className='mt-5 flex-1 space-y-2 text-sm text-slate-700 dark:text-slate-300'>
                {[
                  'Portfolio analytics',
                  'CSV & Excel export',
                  'AI insights',
                  'Advanced reports',
                  'Cloud backup',
                  'Unlimited accounts & categories',
                ].map((item) => (
                  <li key={item} className='flex items-center gap-2'>
                    <FiCheck className='h-4 w-4 shrink-0 text-emerald-500' />
                    {item}
                  </li>
                ))}
              </ul>

              <button
                type='button'
                disabled={Boolean(selectedPlan)}
                onClick={() => handleSubscribe(plan.id)}
                className={`mt-6 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition disabled:opacity-60 ${
                  isRecommended
                    ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-400 hover:to-emerald-500'
                    : 'border border-slate-200 bg-slate-50 text-slate-900 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700'
                }`}
              >
                {selectedPlan === plan.id ? (
                  <>
                    <FiLoader className='h-4 w-4 animate-spin' /> Paying…
                  </>
                ) : (
                  <>Subscribe with UPI</>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <p className='text-center text-xs text-slate-500'>Secure UPI payments via Razorpay</p>

      {selectedPlan && (
        <UpiPaymentModal
          plan={selectedPlan}
          onClose={() => setSelectedPlan(null)}
          onPaid={handlePaid}
        />
      )}
    </div>
  );
}
