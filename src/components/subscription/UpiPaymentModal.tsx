import { FiCheck, FiLoader, FiX } from 'react-icons/fi';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { auth } from '../../services/firebase';
import {
  createRazorpayOrder,
  isValidUpiId,
  payWithUpiApp,
  payWithUpiIdAndWait,
  verifyRazorpayPayment,
} from '../../services/subscriptionService';
import { PRICING_PLANS, type PaidPlan } from '../../types/subscription';

type PayStep = 'form' | 'waiting' | 'processing';
type UpiApp = 'gpay' | 'phonepe' | 'paytm';

function isMobileDevice() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function GPayIcon() {
  return (
    <svg viewBox='0 0 48 48' className='h-10 w-10' aria-hidden>
      <circle cx='24' cy='24' r='24' fill='#fff' />
      <path
        fill='#4285F4'
        d='M35.5 24.2c0-.9-.1-1.8-.2-2.6H24v4.9h6.5c-.3 1.5-1.1 2.8-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-9z'
      />
      <path
        fill='#34A853'
        d='M24 36.5c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9h-4v3.1C15.4 33.9 19.4 36.5 24 36.5z'
      />
      <path
        fill='#FBBC05'
        d='M17.4 26.9c-.2-.7-.4-1.4-.4-2.1s.1-1.5.4-2.1v-3.1h-4c-.8 1.6-1.3 3.3-1.3 5.2s.5 3.7 1.3 5.2l4-3.1z'
      />
      <path
        fill='#EA4335'
        d='M24 17.2c1.7 0 3.3.6 4.5 1.7l3.4-3.4C29.9 13.6 27.2 12.5 24 12.5c-4.6 0-8.6 2.6-10.6 6.5l4 3.1c.9-2.8 3.5-4.9 6.6-4.9z'
      />
    </svg>
  );
}

function PhonePeIcon() {
  return (
    <svg viewBox='0 0 48 48' className='h-10 w-10' aria-hidden>
      <rect width='48' height='48' rx='12' fill='#5F259F' />
      <text
        x='24'
        y='31'
        textAnchor='middle'
        fill='#fff'
        fontSize='16'
        fontWeight='800'
        fontFamily='Arial, sans-serif'
      >
        Pe
      </text>
    </svg>
  );
}

function PaytmIcon() {
  return (
    <svg viewBox='0 0 48 48' className='h-10 w-10' aria-hidden>
      <rect width='48' height='48' rx='12' fill='#00BAF2' />
      <text
        x='24'
        y='31'
        textAnchor='middle'
        fill='#fff'
        fontSize='13'
        fontWeight='800'
        fontFamily='Arial, sans-serif'
      >
        paytm
      </text>
    </svg>
  );
}

const UPI_APPS: { id: UpiApp; label: string; Icon: () => React.ReactNode }[] = [
  { id: 'gpay', label: 'GPay', Icon: GPayIcon },
  { id: 'phonepe', label: 'PhonePe', Icon: PhonePeIcon },
  { id: 'paytm', label: 'Paytm', Icon: PaytmIcon },
];

interface UpiPaymentModalProps {
  plan: PaidPlan;
  onClose: () => void;
  onPaid: (plan: PaidPlan) => void;
}

export function UpiPaymentModal({ plan, onClose, onPaid }: UpiPaymentModalProps) {
  const user = auth.currentUser;
  const planInfo = useMemo(() => PRICING_PLANS.find((p) => p.id === plan), [plan]);
  const isMobile = isMobileDevice();
  const isTestMode = (import.meta.env.VITE_RAZORPAY_KEY_ID ?? '').startsWith('rzp_test_');

  const [upiId, setUpiId] = useState('');
  const [step, setStep] = useState<PayStep>('form');
  const [statusText, setStatusText] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleUpiIdPay = async () => {
    const vpa = upiId.trim().toLowerCase();
    if (!isValidUpiId(vpa)) {
      toast.error('Enter a valid UPI ID');
      return;
    }
    if (!user?.email) {
      toast.error('Please sign in to pay');
      return;
    }

    setStep('waiting');
    setStatusText('Sending payment request to your UPI app…');

    try {
      await payWithUpiIdAndWait({
        plan,
        vpa,
        email: user.email,
        contact: user.phoneNumber || '9999999999',
        onStatus: setStatusText,
      });
      setStep('processing');
      setStatusText('Payment confirmed!');
      onPaid(plan);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Payment failed');
      setStep('form');
      setStatusText('');
    }
  };

  const handleAppPay = async (app: UpiApp) => {
    if (!user?.email) {
      toast.error('Please sign in to pay');
      return;
    }

    setStep('waiting');
    setStatusText('Opening UPI app…');

    try {
      const order = await createRazorpayOrder(plan);
      const response = await payWithUpiApp({
        keyId: order.keyId,
        orderId: order.orderId,
        amount: order.amount,
        currency: order.currency,
        email: user.email,
        contact: user.phoneNumber || '9999999999',
        app,
      });
      setStep('processing');
      setStatusText('Confirming payment…');
      await verifyRazorpayPayment({ ...response, plan });
      onPaid(plan);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Payment failed');
      setStep('form');
      setStatusText('');
    }
  };

  return (
    <div className='fixed inset-0 z-[110] flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-4'>
      <div className='flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl dark:bg-slate-900 sm:rounded-3xl'>
        <div className='flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800'>
          <div>
            <p className='text-xs font-semibold uppercase tracking-wider text-slate-400'>Pay</p>
            <h2 className='text-lg font-black text-slate-900 dark:text-white'>
              {planInfo?.name} · {planInfo?.priceLabel}
            </h2>
          </div>
          <button
            type='button'
            onClick={onClose}
            className='rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            aria-label='Close'
          >
            <FiX className='h-5 w-5' />
          </button>
        </div>

        <div className='flex-1 overflow-y-auto px-5 py-5'>
          {step === 'form' ? (
            <>
              {isMobile && (
                <>
                  <p className='mb-3 text-xs font-bold uppercase tracking-wide text-slate-400'>
                    Pay using UPI app
                  </p>
                  <div className='grid grid-cols-3 gap-3'>
                    {UPI_APPS.map((app) => (
                      <button
                        key={app.id}
                        type='button'
                        onClick={() => handleAppPay(app.id)}
                        className='flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-2 py-4 text-xs font-bold text-slate-800 transition hover:border-emerald-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
                      >
                        <app.Icon />
                        {app.label}
                      </button>
                    ))}
                  </div>

                  <div className='my-5 flex items-center gap-3'>
                    <div className='h-px flex-1 bg-slate-200 dark:bg-slate-700' />
                    <span className='text-xs font-semibold uppercase tracking-wide text-slate-400'>
                      or
                    </span>
                    <div className='h-px flex-1 bg-slate-200 dark:bg-slate-700' />
                  </div>
                </>
              )}

              <label className='block text-sm font-bold text-slate-900 dark:text-white'>
                UPI ID
                <input
                  type='text'
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  placeholder={isTestMode ? 'success@razorpay' : 'name@upi'}
                  autoComplete='off'
                  autoCapitalize='none'
                  className='mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white'
                />
              </label>
              {isTestMode && (
                <p className='mt-2 text-xs text-slate-500'>
                  Test mode — enter{' '}
                  <button
                    type='button'
                    className='font-semibold text-emerald-600 hover:underline dark:text-emerald-400'
                    onClick={() => setUpiId('success@razorpay')}
                  >
                    success@razorpay
                  </button>{' '}
                  to complete payment without charging.
                </p>
              )}

              <button
                type='button'
                onClick={handleUpiIdPay}
                className='mt-4 flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-bold text-white hover:bg-emerald-500'
              >
                Pay {planInfo?.priceLabel}
              </button>
            </>
          ) : (
            <div className='flex flex-col items-center py-10 text-center'>
              {step === 'processing' ? (
                <span className='flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500'>
                  <FiCheck className='h-7 w-7' />
                </span>
              ) : (
                <FiLoader className='h-10 w-10 animate-spin text-emerald-500' />
              )}
              <p className='mt-4 text-lg font-bold text-slate-900 dark:text-white'>
                {step === 'waiting' ? 'Waiting for approval' : 'Payment confirmed'}
              </p>
              <p className='mt-2 max-w-sm text-sm text-slate-600 dark:text-slate-400'>
                {statusText || 'Open your UPI app and approve the request.'}
              </p>
              {step === 'waiting' && (
                <button
                  type='button'
                  onClick={() => {
                    setStep('form');
                    setStatusText('');
                  }}
                  className='mt-5 text-sm font-semibold text-slate-500 underline'
                >
                  Cancel
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
